// Task #415 — Custom domain TLS status poller.
//
// Server-side periodic scan that watches every tenant with an attached
// custom microsite domain and fires two operational emails:
//
//   1. Active   — first time the Cloudflare Custom Hostname transitions
//                 to status="active" + ssl.status="active".
//   2. Stuck    — domain has been attached for >= STUCK_THRESHOLD_HOURS
//                 and is still pending, so likely DNS misconfigured.
//
// The DomainPage UI also polls every 15s while open, but admins close
// the tab and DNS can take hours. This is the out-of-band loop that
// catches both the happy path ("it's live!") and the sad path
// ("you forgot the CNAME") without anyone watching the screen.
//
// ── Exactly-once delivery ────────────────────────────────────────────
// Three layers of de-duplication, in order:
//
//   1. Per-process in-flight Promise — prevents one process's own
//      overlapping ticks (slow scan, fast interval).
//
//   2. Postgres advisory lock (pg_try_advisory_lock(415, 1)) — held for
//      the duration of a scan. Prevents two app instances from scanning
//      concurrently. If another instance holds it, this tick is a no-op.
//
//   3. Atomic claim-before-send — the actual send-vs-stamp race is the
//      dangerous one. We UPDATE tenants SET notified_*_at = now() WHERE
//      notified_*_at IS NULL RETURNING id BEFORE sending. Only the
//      worker whose UPDATE returns rowCount === 1 has the right to send.
//      If the send then fails, we ROLLBACK the claim (set the column
//      back to NULL) so the next scan retries.
//
// (1) and (2) are optimizations to avoid wasted Cloudflare/Resend
// requests. (3) is what actually guarantees exactly-once user-visible
// behavior — even without (1) and (2), at most one worker would send.
//
// Detach re-arms because admin.ts NULLs all four state columns.

import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  CloudflareError,
  getCustomHostname,
  getZoneName,
  type CustomHostname,
} from "./cloudflare";
import {
  sendCustomDomainActiveEmail,
  sendCustomDomainStuckEmail,
} from "./notifications";

export const CUSTOM_DOMAIN_POLL_INTERVAL_MS = 2 * 60 * 1000;          // 2 minutes
export const CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS = 24;

// Arbitrary but stable pair-key for pg_try_advisory_lock. The first arg
// is the task number; the second leaves room for sibling locks if we
// add more pollers in this task family later.
const ADVISORY_LOCK_CLASSID = 415;
const ADVISORY_LOCK_OBJID = 1;

type TenantRow = {
  id: number;
  name: string;
  microsite_domain: string;
  cloudflare_hostname_id: string;
  custom_domain_attached_at: Date | null;
  custom_domain_notified_active_at: Date | null;
  custom_domain_notified_stuck_at: Date | null;
};

type AdminRow = { email: string };

/**
 * Derive a coarse status bucket from a CF Custom Hostname payload.
 * "active" is the strict TLS-active state; "blocked" covers
 * test_blocked / pending_blocked / blocked. Anything else is treated as
 * "pending" (i.e. still working its way through validation).
 */
export function classifyCustomHostname(ch: CustomHostname): "active" | "pending" | "blocked" {
  if ((ch.status === "active" || ch.status === "active_redeploying") && ch.ssl?.status === "active") {
    return "active";
  }
  if (ch.status === "blocked" || ch.status === "pending_blocked" || ch.status === "test_blocked") {
    return "blocked";
  }
  return "pending";
}

/**
 * Pure predicate: should the active email be considered for sending?
 * Used by the in-process pre-filter and by the unit tests. The DB-level
 * atomic claim is still the source of truth for exactly-once delivery.
 */
export function shouldFireActiveEmail(args: {
  status: "active" | "pending" | "blocked";
  notifiedActiveAt: Date | null;
}): boolean {
  return args.status === "active" && args.notifiedActiveAt === null;
}

/**
 * Pure predicate: should the stuck email be considered for sending?
 * True iff the domain is still pending, has been attached for at least
 * the threshold, and hasn't been notified yet.
 */
export function shouldFireStuckEmail(args: {
  status: "active" | "pending" | "blocked";
  attachedAt: Date | null;
  notifiedStuckAt: Date | null;
  now: Date;
  thresholdHours?: number;
}): boolean {
  if (args.status !== "pending") return false;
  if (args.notifiedStuckAt !== null) return false;
  if (!args.attachedAt) return false;
  const ageMs = args.now.getTime() - args.attachedAt.getTime();
  const thresholdMs = (args.thresholdHours ?? CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS) * 60 * 60 * 1000;
  return ageMs >= thresholdMs;
}

async function loadAdminEmails(tenantId: number): Promise<string[]> {
  try {
    const result = await pool.query<AdminRow>(
      `SELECT DISTINCT lower(tm.email) AS email
         FROM tenant_members tm
         JOIN tenant_roles tr ON tr.id = tm.role_id
        WHERE tm.tenant_id = $1
          AND tr.is_admin = true
          AND tm.accepted_at IS NOT NULL
          AND tm.email IS NOT NULL AND tm.email <> ''`,
      [tenantId],
    );
    return result.rows.map((r) => r.email);
  } catch (err) {
    logger.error({ err, tenantId }, "customDomainPoller: admin lookup failed");
    return [];
  }
}

/**
 * Atomic claim: stamp `notified_<kind>_at = now()` iff still NULL. The
 * returned boolean is the source of truth — only the caller that gets
 * `true` has the right (and the obligation) to send the email. Every
 * other concurrent worker gets `false` and bails.
 *
 * Internal helper; exported for the integration test that needs to
 * assert the race-resolution behavior directly.
 */
export async function claimNotificationSlot(tenantId: number, kind: "active" | "stuck"): Promise<boolean> {
  const column = kind === "active"
    ? "custom_domain_notified_active_at"
    : "custom_domain_notified_stuck_at";
  const result = await pool.query(
    `UPDATE tenants
        SET ${column} = now(), updated_at = now()
      WHERE id = $1
        AND ${column} IS NULL
      RETURNING id`,
    [tenantId],
  );
  return result.rowCount === 1;
}

/**
 * Roll back a claim — sets the column back to NULL so the next scan
 * retries. Only used when send fails after a successful claim. Errors
 * here are logged and swallowed: an orphaned claim means we lose one
 * email's worth of retries, which is strictly better than tearing the
 * loop down.
 */
async function releaseClaim(tenantId: number, kind: "active" | "stuck"): Promise<void> {
  const column = kind === "active"
    ? "custom_domain_notified_active_at"
    : "custom_domain_notified_stuck_at";
  try {
    await pool.query(
      `UPDATE tenants SET ${column} = NULL, updated_at = now() WHERE id = $1`,
      [tenantId],
    );
  } catch (err) {
    logger.error({ err, tenantId, kind }, "customDomainPoller: claim rollback failed");
  }
}

// In-process guard so two overlapping scans within ONE process don't
// double-fire. The DB advisory lock + atomic claim handle the
// cross-process case; this just avoids burning Cloudflare/Resend
// requests when our own setInterval ticks faster than a scan finishes.
let inflight: Promise<void> | null = null;

/**
 * One scan pass. Visits every tenant with a non-null
 * cloudflare_hostname_id, fetches its CF status, persists
 * last_seen_status, and (under an atomic claim) sends emails on
 * transitions. Failures on a single tenant (CF outage, send failure)
 * are logged and skipped — they never abort the loop or block other
 * tenants.
 */
export async function runCustomDomainPoll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    // Cross-instance lock: only one app server runs the scan at a time.
    // Session-scoped lock auto-releases when we return the client.
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, $2) AS locked`,
        [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID],
      );
      if (!lockResult.rows[0]?.locked) {
        logger.debug("customDomainPoller: another instance holds the lock — skipping");
        return;
      }
      try {
        await runCustomDomainPollLocked();
      } finally {
        await client.query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) => logger.warn({ err }, "customDomainPoller: advisory unlock failed (will auto-release on disconnect)"));
      }
    } finally {
      client.release();
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

async function runCustomDomainPollLocked(): Promise<void> {
  let rows: TenantRow[];
  try {
    const result = await pool.query<TenantRow>(
      `SELECT id, name, microsite_domain, cloudflare_hostname_id,
              custom_domain_attached_at,
              custom_domain_notified_active_at,
              custom_domain_notified_stuck_at
         FROM tenants
        WHERE cloudflare_hostname_id IS NOT NULL
          AND microsite_domain IS NOT NULL
          AND status = 'active'`,
    );
    rows = result.rows;
  } catch (err) {
    logger.error({ err }, "customDomainPoller: tenant query failed (non-fatal)");
    return;
  }
  if (rows.length === 0) return;

  // Resolve the zone CNAME once per scan — same across all tenants,
  // and the CF lib already caches it process-wide.
  let cnameTarget = "";
  try {
    cnameTarget = await getZoneName();
  } catch (err) {
    logger.warn({ err }, "customDomainPoller: getZoneName failed, stuck emails will omit CNAME hint");
  }

  const now = new Date();

  for (const row of rows) {
    await processTenant(row, now, cnameTarget);
  }
}

async function processTenant(row: TenantRow, now: Date, cnameTarget: string): Promise<void> {
  let ch: CustomHostname;
  try {
    ch = await getCustomHostname(row.cloudflare_hostname_id);
  } catch (err) {
    // Don't poison last_seen_status on transient CF errors. If the
    // hostname id is permanently gone (404), surface in logs but
    // leave the DB row alone — admin DELETE will clear it.
    const is404 = err instanceof CloudflareError && err.status === 404;
    logger.error(
      { err, tenantId: row.id, hostname: row.microsite_domain, cf404: is404 },
      "customDomainPoller: getCustomHostname failed",
    );
    return;
  }
  const status = classifyCustomHostname(ch);

  // Persist last_seen_status best-effort (purely informational).
  try {
    await pool.query(
      `UPDATE tenants SET custom_domain_last_seen_status = $1, updated_at = now()
        WHERE id = $2
          AND cloudflare_hostname_id = $3
          AND custom_domain_last_seen_status IS DISTINCT FROM $1`,
      [status, row.id, row.cloudflare_hostname_id],
    );
  } catch (err) {
    logger.warn({ err, tenantId: row.id }, "customDomainPoller: last_seen_status update failed");
  }

  // ── Active transition ──────────────────────────────────────────
  if (shouldFireActiveEmail({ status, notifiedActiveAt: row.custom_domain_notified_active_at })) {
    await tryFireActive(row);
    return; // Don't also evaluate stuck this pass — moot.
  }

  // ── Stuck transition ──────────────────────────────────────────
  if (shouldFireStuckEmail({
    status,
    attachedAt: row.custom_domain_attached_at,
    notifiedStuckAt: row.custom_domain_notified_stuck_at,
    now,
  })) {
    await tryFireStuck(row, now, cnameTarget);
  }
}

async function tryFireActive(row: TenantRow): Promise<void> {
  // Claim BEFORE doing any work, so concurrent workers (or workers on
  // other instances if the advisory lock were ever bypassed) cannot
  // both pass through to send.
  let claimed: boolean;
  try {
    claimed = await claimNotificationSlot(row.id, "active");
  } catch (err) {
    logger.error({ err, tenantId: row.id }, "customDomainPoller: active claim failed");
    return;
  }
  if (!claimed) {
    // Someone else got there first (or it was already sent in a prior
    // scan). Nothing to do.
    return;
  }

  const admins = await loadAdminEmails(row.id);
  if (admins.length === 0) {
    // Keep the claim — nobody to email, no point re-checking next scan.
    logger.info({ tenantId: row.id, hostname: row.microsite_domain }, "custom domain active: no admins to notify");
    return;
  }

  const publishedUrl = `https://${row.microsite_domain.toLowerCase()}`;
  let sent = 0;
  try {
    const results = await Promise.all(admins.map((email) =>
      sendCustomDomainActiveEmail({
        recipientEmail: email,
        tenantName: row.name,
        hostname: row.microsite_domain,
        publishedUrl,
      }),
    ));
    sent = results.filter(Boolean).length;
  } catch (err) {
    // Promise.all itself rejecting is unexpected (the senders catch
    // internally) but be defensive.
    logger.error({ err, tenantId: row.id }, "customDomainPoller: active send threw");
  }

  if (sent === 0) {
    // Every recipient failed — release the claim so we retry next scan.
    await releaseClaim(row.id, "active");
    logger.warn(
      { tenantId: row.id, hostname: row.microsite_domain, attempted: admins.length },
      "custom domain active: every send failed — claim released, will retry next scan",
    );
    return;
  }

  logger.info(
    { tenantId: row.id, hostname: row.microsite_domain, sent, attempted: admins.length },
    "custom domain active email sent",
  );
}

async function tryFireStuck(row: TenantRow, now: Date, cnameTarget: string): Promise<void> {
  let claimed: boolean;
  try {
    claimed = await claimNotificationSlot(row.id, "stuck");
  } catch (err) {
    logger.error({ err, tenantId: row.id }, "customDomainPoller: stuck claim failed");
    return;
  }
  if (!claimed) return;

  const admins = await loadAdminEmails(row.id);
  if (admins.length === 0) {
    logger.info({ tenantId: row.id, hostname: row.microsite_domain }, "custom domain stuck: no admins to notify");
    return;
  }

  const ageMs = now.getTime() - (row.custom_domain_attached_at as Date).getTime();
  const hoursPending = Math.max(1, Math.round(ageMs / (60 * 60 * 1000)));
  const settingsUrl = "https://app.lpstudio.ai/settings/domain";

  let sent = 0;
  try {
    const results = await Promise.all(admins.map((email) =>
      sendCustomDomainStuckEmail({
        recipientEmail: email,
        tenantName: row.name,
        hostname: row.microsite_domain,
        cnameTarget: cnameTarget || "lpstudio.ai",
        settingsUrl,
        hoursPending,
      }),
    ));
    sent = results.filter(Boolean).length;
  } catch (err) {
    logger.error({ err, tenantId: row.id }, "customDomainPoller: stuck send threw");
  }

  if (sent === 0) {
    await releaseClaim(row.id, "stuck");
    logger.warn(
      { tenantId: row.id, hostname: row.microsite_domain, attempted: admins.length },
      "custom domain stuck: every send failed — claim released, will retry next scan",
    );
    return;
  }

  logger.info(
    { tenantId: row.id, hostname: row.microsite_domain, sent, attempted: admins.length, hoursPending },
    "custom domain stuck email sent",
  );
}

/**
 * Boot-time scheduler. Production only — dev/staging would just spam
 * Cloudflare and Resend with no real value. Returns the interval handle
 * (already `.unref()`-ed) for tests.
 */
export function startCustomDomainPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production") return null;
  void runCustomDomainPoll();
  const handle = setInterval(() => {
    void runCustomDomainPoll();
  }, CUSTOM_DOMAIN_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
