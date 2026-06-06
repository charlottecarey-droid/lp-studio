// Scheduled HubSpot contact sync poller.
//
// Keeps the Sales Console continuously up to date with new/updated HubSpot
// contacts without anyone clicking "Sync". On a fixed cadence it runs the bulk
// contact import for every tenant whose HubSpot connection is connected AND
// sync-enabled, resuming from the cursor saved on the connection (see
// hubspot-service `importContacts` scheduled mode).
//
// ── Overlap protection ───────────────────────────────────────────────
// Two layers (mirrors marketoSyncPoller):
//
//   1. Per-process in-flight Promise — prevents one process's own overlapping
//      ticks (a slow import still running when the next interval fires).
//
//   2. Per-tenant Postgres advisory lock, transaction-scoped
//      (pg_try_advisory_xact_lock(951, tenantId)). Held for the duration of
//      that tenant's import so two app instances can't import the same tenant
//      concurrently. The xact-scoped variant auto-releases on COMMIT/ROLLBACK,
//      so it can't leak on the Neon -pooler endpoint (see memory:
//      pooler-advisory-lock-leak). NOTE: the class id (951) deliberately
//      differs from Marketo's (950) so the two pollers never contend.
//
// Each tenant's import fails closed and is observable: importContacts records a
// per-run row in hubspot_sync_log (status running → completed/failed) and stamps
// hubspot_connections.lastSyncError on failure. A failure on one tenant is
// logged and skipped — it never aborts the loop or blocks other tenants.
//
// HUBSPOT_FAKE_MODE is respected end-to-end: the service short-circuits every
// network call to a canned empty response, so the loop runs harmlessly in
// dev/e2e. The scheduler itself only starts in production OR when fake mode is
// on, so a plain dev boot stays quiet.

import { pool, db, hubspotConnectionsTable, tenantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { hubspotService } from "./hubspot-service";

// 15-minute cadence: frequent enough to feel like a live CRM sync, infrequent
// enough not to hammer HubSpot's rate-limited API across many tenants.
export const HUBSPOT_SYNC_POLL_INTERVAL_MS = 15 * 60 * 1000;
// Defer the first sweep off the cold-start path so its network I/O doesn't
// compete with the deploy startup probe.
export const HUBSPOT_SYNC_BOOT_DELAY_MS = 90 * 1000;

// Advisory-lock class id; the tenant id is the object id, so the lock is
// per-tenant. MUST differ from the Marketo poller's class id (950).
const ADVISORY_LOCK_CLASSID = 951;

const FAKE_MODE = process.env.HUBSPOT_FAKE_MODE === "1";

export type EligibleConnection = { connectionId: number; tenantId: number };

// In-process guard so two overlapping sweeps within ONE process don't both run
// (slow sweep, fast interval). The advisory lock handles the cross-process case.
let inflight: Promise<void> | null = null;

/**
 * Every connection eligible for a scheduled import: status "connected", sync
 * enabled, and an active tenant. Tenant id is carried through for the per-tenant
 * advisory lock.
 */
export async function listEligibleConnections(): Promise<EligibleConnection[]> {
  const rows = await db
    .select({
      connectionId: hubspotConnectionsTable.id,
      tenantId: hubspotConnectionsTable.tenantId,
    })
    .from(hubspotConnectionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, hubspotConnectionsTable.tenantId))
    .where(and(
      eq(hubspotConnectionsTable.status, "connected"),
      eq(hubspotConnectionsTable.syncEnabled, true),
      eq(tenantsTable.status, "active"),
    ));
  return rows;
}

/**
 * Run one tenant's scheduled import under a per-tenant transaction-scoped
 * advisory lock. Returns "ran" when the lock was acquired and the import was
 * attempted, "skipped" when another instance held the lock (or an unexpected
 * error occurred before/around the import — the import itself records its own
 * failure to hubspot_sync_log and does not throw).
 */
export async function runHubspotSyncForConnection(conn: EligibleConnection): Promise<"ran" | "skipped"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1, $2) AS locked",
      [ADVISORY_LOCK_CLASSID, conn.tenantId],
    );
    if (!lock.rows[0]?.locked) {
      await client.query("ROLLBACK");
      logger.debug({ tenantId: conn.tenantId }, "hubspotSyncPoller: another instance holds the tenant lock — skipping");
      return "skipped";
    }
    try {
      const r = await hubspotService.importContacts(conn.connectionId, conn.tenantId, {
        syncType: "scheduled",
        resume: true,
      });
      logger.info(
        { tenantId: conn.tenantId, connectionId: conn.connectionId, ...r },
        "hubspotSyncPoller: scheduled import finished",
      );
    } finally {
      await client.query("COMMIT").catch((err) =>
        logger.warn({ err, tenantId: conn.tenantId }, "hubspotSyncPoller: commit (lock release) failed — auto-releases on disconnect"),
      );
    }
    return "ran";
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    logger.error(
      { err, tenantId: conn.tenantId, connectionId: conn.connectionId },
      "hubspotSyncPoller: tenant sync failed (non-fatal)",
    );
    return "skipped";
  } finally {
    client.release();
  }
}

/**
 * One sweep pass: import for every eligible connection, one tenant at a time.
 * Serialized per process (the in-flight guard) and per tenant across instances
 * (the advisory lock). A single tenant's failure never aborts the sweep.
 */
export async function runHubspotSyncPoll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    let conns: EligibleConnection[];
    try {
      conns = await listEligibleConnections();
    } catch (err) {
      logger.error({ err }, "hubspotSyncPoller: eligible-connection query failed (non-fatal)");
      return;
    }
    if (conns.length === 0) return;
    for (const c of conns) {
      await runHubspotSyncForConnection(c);
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

/**
 * Boot-time scheduler. Runs in production OR when HUBSPOT_FAKE_MODE is set (so
 * e2e/dev can exercise the loop without live creds); otherwise a no-op so a
 * plain dev boot stays quiet. The first sweep is deferred off the cold-start
 * path; thereafter it runs every HUBSPOT_SYNC_POLL_INTERVAL_MS. Returns the
 * interval handle (already `.unref()`-ed) for tests, or null when not started.
 */
export function startHubspotSyncPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production" && !FAKE_MODE) return null;
  const handle = setInterval(() => {
    void runHubspotSyncPoll().catch((err) => logger.error({ err }, "hubspotSyncPoller: interval run failed"));
  }, HUBSPOT_SYNC_POLL_INTERVAL_MS);
  handle.unref();
  setTimeout(() => {
    void runHubspotSyncPoll().catch((err) => logger.error({ err }, "hubspotSyncPoller: boot run failed"));
  }, HUBSPOT_SYNC_BOOT_DELAY_MS).unref();
  return handle;
}
