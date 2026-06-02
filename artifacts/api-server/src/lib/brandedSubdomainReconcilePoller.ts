// Task #794 — Branded email-subdomain DNS drift reconcile poller.
//
// Tier 2 auto-provisions a tenant's branded sending subdomain
// (mail.<slug>.lpstudio.ai) by publishing Resend's required SPF/DKIM/MX
// records into OUR OWN Cloudflare zone. If those records are ever edited or
// deleted out-of-band (a dashboard mistake, a sweep gone wrong, a partial
// provision), sending silently breaks with NO self-healing — and nobody polls
// the verify endpoint once a domain is already verified, so the breakage stays
// invisible.
//
// This is the out-of-band loop that periodically re-derives each provisioned
// tenant's required records from Resend, compares them against what's live in
// Cloudflare, and re-publishes anything missing/changed — keeping deliverability
// healthy without manual intervention. The per-tenant repair work lives in
// `reconcileBrandedSubdomainDns` (idempotent, fails closed on a Resend outage);
// this module only schedules and fans it out.
//
// ── Concurrency ──────────────────────────────────────────────────────
// Mirrors emailDomainPoller's two outer layers:
//   1. Per-process in-flight Promise — a slow scan + fast interval never
//      overlap within one process.
//   2. Postgres advisory lock (pg_try_advisory_lock(794, 1)) — held for the
//      scan so two app instances never reconcile concurrently. The reconcile
//      itself is idempotent, so a missed lock is harmless; the lock just
//      avoids redundant Resend/Cloudflare calls.
//
// Per-tenant failures are logged and skipped — one tenant's Resend/Cloudflare
// error never aborts the sweep or blocks the others.

import { pool } from "@workspace/db";
import { logger } from "./logger";
import { reconcileBrandedSubdomainDns } from "../routes/lp/branded-email-subdomain";

// DNS drift is rare and not time-critical (a verified domain keeps sending
// until a record is actually broken), so a slow cadence is plenty and keeps
// Resend/Cloudflare call volume negligible.
export const BRANDED_SUBDOMAIN_RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Stable pair-key for pg_try_advisory_lock — the task number plus a sibling
// slot, matching the convention the other pollers established.
const ADVISORY_LOCK_CLASSID = 794;
const ADVISORY_LOCK_OBJID = 1;

type ProvisionedRow = { tenant_id: number };

// In-process guard so two overlapping scans within ONE process don't double
// the Resend/Cloudflare traffic when setInterval ticks faster than a scan
// finishes. The DB advisory lock handles the cross-process case.
let inflight: Promise<void> | null = null;

/**
 * One reconcile pass under the cross-instance advisory lock. Visits every
 * active tenant with a provisioned branded subdomain and reconciles its DNS.
 * Exported so a future on-demand trigger / test can invoke a single sweep.
 */
export async function runBrandedSubdomainReconcile(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, $2) AS locked`,
        [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID],
      );
      if (!lockResult.rows[0]?.locked) {
        logger.debug("brandedSubdomainReconcile: another instance holds the lock — skipping");
        return;
      }
      try {
        await runReconcileLocked();
      } finally {
        await client
          .query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) =>
            logger.warn({ err }, "brandedSubdomainReconcile: advisory unlock failed (will auto-release on disconnect)"),
          );
      }
    } finally {
      client.release();
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runReconcileLocked(): Promise<void> {
  let rows: ProvisionedRow[];
  try {
    const result = await pool.query<ProvisionedRow>(
      `SELECT lbs.tenant_id AS tenant_id
         FROM lp_brand_settings lbs
         JOIN tenants t ON t.id = lbs.tenant_id
        WHERE lbs.config->'salesConsole'->>'brandedEmailSubdomainId' IS NOT NULL
          AND t.status = 'active'`,
    );
    rows = result.rows;
  } catch (err) {
    logger.error({ err }, "brandedSubdomainReconcile: tenant query failed (non-fatal)");
    return;
  }
  if (rows.length === 0) return;

  let repairedTenants = 0;
  for (const row of rows) {
    try {
      const result = await reconcileBrandedSubdomainDns(row.tenant_id);
      if (result.repaired > 0) {
        repairedTenants++;
        logger.warn(
          {
            tenantId: row.tenant_id,
            repaired: result.repaired,
            records: result.repairedRecords,
          },
          "brandedSubdomainReconcile: repaired drifted DNS records",
        );
      }
    } catch (err) {
      logger.error(
        { err, tenantId: row.tenant_id },
        "brandedSubdomainReconcile: tenant reconcile failed (skipped)",
      );
    }
  }

  if (repairedTenants > 0) {
    logger.warn(
      { scanned: rows.length, repairedTenants },
      "brandedSubdomainReconcile: sweep repaired drift",
    );
  }
}

/**
 * Boot-time scheduler. Production only — dev/staging would just hammer
 * Resend/Cloudflare with no real value (and dev shares the prod CF zone, so a
 * stray reconcile there could touch real records). Returns the interval handle
 * (already `.unref()`-ed) for tests.
 */
export function startBrandedSubdomainReconcilePoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production") return null;
  void runBrandedSubdomainReconcile();
  const handle = setInterval(() => {
    void runBrandedSubdomainReconcile();
  }, BRANDED_SUBDOMAIN_RECONCILE_INTERVAL_MS);
  handle.unref();
  return handle;
}
