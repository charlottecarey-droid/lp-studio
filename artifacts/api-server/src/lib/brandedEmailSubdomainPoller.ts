// Task #787 — Branded email-subdomain retirement sweep.
//
// Tier 2 tenants auto-provision a branded sending subdomain
// (`mail.<slug>.lpstudio.ai`) via the Settings wizard. We register it in Resend
// and publish its SPF/DKIM/MX records into OUR Cloudflare zone, then wait for
// Resend to verify. The wizard auto-polls every few seconds WHILE OPEN, but
// admins close the tab — so today verification status only ever refreshes while
// someone is watching, and a subdomain that never verifies (abandoned setup,
// broken records) leaves the Resend domain + Cloudflare records lingering
// indefinitely.
//
// This out-of-band loop watches every tenant with a provisioned branded
// subdomain, refreshes its live Resend status, persists `brandedSubdomainActive`
// so the rest of the app sees fresh state without a live call, and AUTO-RETIRES
// any subdomain still unverified past STALE_THRESHOLD_HOURS — reusing the exact
// same deprovision path the wizard's DELETE handler uses, so no Resend/Cloudflare
// resources leak.
//
// ── Concurrency safety ───────────────────────────────────────────────
// Mirrors customDomainPoller / emailDomainPoller:
//
//   1. Per-process in-flight Promise — prevents one process's own overlapping
//      ticks (slow scan, fast interval).
//   2. Postgres advisory lock (pg_try_advisory_lock(787, 1)) — held for the
//      duration of a scan so two app instances never scan concurrently. If
//      another instance holds it, this tick is a no-op.
//
// Unlike the verification pollers there is no per-tenant email/claim — the only
// mutations are (a) an idempotent status refresh and (b) a one-shot deprovision
// that clears the config, so a re-run is naturally safe even without a claim.
//
// All state lives in lp_brand_settings.config.salesConsole (see
// brandedEmailSubdomain.ts) — no schema migration needed.

import { pool } from "@workspace/db";
import { logger } from "./logger";
import { getResendDomainById } from "./resendDomainStatus";
import {
  persistBrandedSubdomain,
  deprovisionBrandedEmailSubdomain,
} from "./brandedEmailSubdomain";

export const BRANDED_SUBDOMAIN_POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const BRANDED_SUBDOMAIN_STALE_THRESHOLD_HOURS = 72;        // 3 days

// Stable pair-key for pg_try_advisory_lock — the task number plus a sibling
// slot, matching the convention the sibling pollers established.
const ADVISORY_LOCK_CLASSID = 787;
const ADVISORY_LOCK_OBJID = 1;

type ProvisionedRow = {
  tenant_id: number;
  tenant_name: string;
  domain_id: string;
  sending_subdomain: string | null;
  provisioned_at: string | null;
  active: boolean | null;
};

// In-process guard so two overlapping scans within ONE process don't double up.
let inflight: Promise<void> | null = null;

/**
 * Pure predicate: should a provisioned-but-unverified subdomain be retired?
 * True iff it isn't verified and has been provisioned for at least the
 * threshold. Exported for unit testing the staleness math without a DB.
 */
export function shouldRetireBrandedSubdomain(args: {
  verified: boolean;
  provisionedAt: Date | null;
  now: Date;
  thresholdHours?: number;
}): boolean {
  if (args.verified) return false;
  if (!args.provisionedAt) return false;
  const ageMs = args.now.getTime() - args.provisionedAt.getTime();
  const thresholdMs = (args.thresholdHours ?? BRANDED_SUBDOMAIN_STALE_THRESHOLD_HOURS) * 60 * 60 * 1000;
  return ageMs >= thresholdMs;
}

/**
 * One scan pass under the cross-instance advisory lock. Visits every active
 * tenant with a provisioned branded subdomain, refreshes its status, and
 * retires the stale ones. Per-tenant failures (Resend outage, CF error) are
 * logged and skipped — they never abort the loop or block other tenants.
 */
export async function runBrandedEmailSubdomainPoll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, $2) AS locked`,
        [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID],
      );
      if (!lockResult.rows[0]?.locked) {
        logger.debug("brandedEmailSubdomainPoller: another instance holds the lock — skipping");
        return;
      }
      try {
        await runBrandedEmailSubdomainPollLocked();
      } finally {
        await client.query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) => logger.warn({ err }, "brandedEmailSubdomainPoller: advisory unlock failed (will auto-release on disconnect)"));
      }
    } finally {
      client.release();
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

async function runBrandedEmailSubdomainPollLocked(): Promise<void> {
  let rows: ProvisionedRow[];
  try {
    const result = await pool.query<ProvisionedRow>(
      `SELECT lbs.tenant_id AS tenant_id,
              t.name AS tenant_name,
              lbs.config->'salesConsole'->>'brandedEmailSubdomainId' AS domain_id,
              lbs.config->'salesConsole'->>'brandedEmailSubdomain' AS sending_subdomain,
              lbs.config->'salesConsole'->>'brandedEmailSubdomainProvisionedAt' AS provisioned_at,
              (lbs.config->'salesConsole'->>'brandedSubdomainActive')::boolean AS active
         FROM lp_brand_settings lbs
         JOIN tenants t ON t.id = lbs.tenant_id
        WHERE lbs.config->'salesConsole'->>'brandedEmailSubdomainId' IS NOT NULL
          AND t.status = 'active'`,
    );
    rows = result.rows;
  } catch (err) {
    logger.error({ err }, "brandedEmailSubdomainPoller: tenant query failed (non-fatal)");
    return;
  }
  if (rows.length === 0) return;

  const now = new Date();
  for (const row of rows) {
    await processTenant(row, now);
  }
}

async function processTenant(row: ProvisionedRow, now: Date): Promise<void> {
  if (!row.domain_id) return;

  let verified: boolean;
  try {
    const result = await getResendDomainById(row.domain_id);
    if (!result.available || !result.domain) {
      // Resend down / domain gone — leave config untouched and retry next scan.
      // Never retire on an unconfirmed status: a transient outage must not nuke
      // a tenant's provisioned subdomain.
      return;
    }
    verified = result.domain.status === "verified";
  } catch (err) {
    logger.error(
      { err, tenantId: row.tenant_id, domainId: row.domain_id },
      "brandedEmailSubdomainPoller: getResendDomainById failed",
    );
    return;
  }

  // Backfill the staleness clock for subdomains provisioned before this sweep
  // existed (or whose timestamp was never stamped). Starting the clock at first
  // observation is the fail-safe choice — we never retire something we've only
  // just begun watching.
  let provisionedAt: Date | null = parseIso(row.provisioned_at);
  if (!provisionedAt) {
    provisionedAt = now;
    try {
      await persistBrandedSubdomain(row.tenant_id, {
        subdomain: row.sending_subdomain,
        domainId: row.domain_id,
        // dnsRecordIds untouched: persist re-reads them and we pass through.
        dnsRecordIds: await readDnsRecordIds(row.tenant_id),
        provisionedAt: now.toISOString(),
        active: verified,
      });
    } catch (err) {
      logger.warn({ err, tenantId: row.tenant_id }, "brandedEmailSubdomainPoller: provisionedAt backfill failed");
    }
  } else if (row.active !== verified) {
    // Persist the refreshed verified state so the app sees it without a live
    // call. Only write on an actual change to avoid needless churn.
    try {
      await persistRefreshedActive(row.tenant_id, row.domain_id, verified);
    } catch (err) {
      logger.warn({ err, tenantId: row.tenant_id }, "brandedEmailSubdomainPoller: active refresh failed");
    }
  }

  if (shouldRetireBrandedSubdomain({ verified, provisionedAt, now })) {
    await retire(row, now, provisionedAt);
  }
}

/** Parse an ISO timestamp string into a Date, or null when unparseable. */
function parseIso(raw: string | null): Date | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Read just the DNS record ids for a tenant (for a pass-through persist). */
async function readDnsRecordIds(tenantId: number): Promise<string[]> {
  const r = await pool.query<{ ids: unknown }>(
    `SELECT config->'salesConsole'->'brandedEmailSubdomainDnsRecordIds' AS ids
       FROM lp_brand_settings WHERE tenant_id = $1`,
    [tenantId],
  );
  const ids = r.rows[0]?.ids;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Targeted active-state refresh scoped to the CURRENT domain id, so we never
 * clobber a value a concurrent re-registration has since replaced. Uses a
 * narrow jsonb_set rather than the read-merge-write `persist` to avoid stomping
 * unrelated concurrent edits to the brand config.
 */
async function persistRefreshedActive(tenantId: number, domainId: string, active: boolean): Promise<void> {
  await pool.query(
    `UPDATE lp_brand_settings
        SET config = jsonb_set(
              config,
              '{salesConsole,brandedSubdomainActive}',
              to_jsonb($3::boolean),
              true
            ),
            updated_at = now()
      WHERE tenant_id = $1
        AND config->'salesConsole'->>'brandedEmailSubdomainId' = $2`,
    [tenantId, domainId, active],
  );
}

async function retire(row: ProvisionedRow, now: Date, provisionedAt: Date): Promise<void> {
  const hoursPending = Math.max(1, Math.round((now.getTime() - provisionedAt.getTime()) / (60 * 60 * 1000)));
  try {
    const did = await deprovisionBrandedEmailSubdomain(row.tenant_id);
    if (did) {
      logger.warn(
        {
          tenantId: row.tenant_id,
          tenantName: row.tenant_name,
          domainId: row.domain_id,
          subdomain: row.sending_subdomain,
          hoursPending,
        },
        "branded email subdomain retired: never verified past staleness threshold",
      );
    }
  } catch (err) {
    logger.error(
      { err, tenantId: row.tenant_id, domainId: row.domain_id },
      "brandedEmailSubdomainPoller: retire failed — will retry next scan",
    );
  }
}

/**
 * Boot-time scheduler. Production only — dev/staging would just spam Resend and
 * Cloudflare with no real value. Returns the interval handle (already
 * `.unref()`-ed) for tests.
 */
export function startBrandedEmailSubdomainPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production") return null;
  void runBrandedEmailSubdomainPoll();
  const handle = setInterval(() => {
    void runBrandedEmailSubdomainPoll();
  }, BRANDED_SUBDOMAIN_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
