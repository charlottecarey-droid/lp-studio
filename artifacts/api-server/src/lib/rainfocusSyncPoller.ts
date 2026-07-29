/**
 * Periodic re-import for events whose catalog lives in RainFocus.
 *
 * A conference catalog changes right up to the doors: sessions get added,
 * moved, renamed and cancelled — often after a rep has already sent an agenda
 * to a customer. Without this, a page built in July is silently stale in
 * October.
 *
 * Opt-in per event (`rainfocus_config.autoSync`), and only for events that are
 * still relevant: an event that finished a week ago is never polled again.
 * That bound matters — a tenant with fifty historical events shouldn't be
 * spending Firecrawl-style API calls re-reading catalogs nobody will look at.
 */
import { and, eq, or, gte, isNull } from "drizzle-orm";
import { db, salesEventsTable } from "@workspace/db";
import type { RainfocusConfig } from "@workspace/db";
import { logger } from "./logger";
import { credsFromConfig, syncRainfocusEvent, recordSyncOutcome } from "./sales/rainfocus-sync";

/** Every 6 hours. A catalog is not a live feed; hourly would be noise. */
export const RAINFOCUS_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Keep polling a week past the end date — post-event tweaks still happen. */
const GRACE_DAYS = 7;

/** Serialise the sweep: overlapping runs would double-write the same rows. */
let running = false;

export async function runRainfocusSyncPoll(): Promise<{ scanned: number; synced: number; failed: number }> {
  if (running) {
    logger.info("rainfocusSyncPoller: previous sweep still running, skipping");
    return { scanned: 0, synced: 0, failed: 0 };
  }
  running = true;
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // `end_date` is a DATE column; an event with no end date can't be judged
    // finished, so it stays in scope rather than being dropped silently.
    const events = await db
      .select({
        id: salesEventsTable.id,
        tenantId: salesEventsTable.tenantId,
        name: salesEventsTable.name,
        config: salesEventsTable.rainfocusConfig,
      })
      .from(salesEventsTable)
      .where(
        and(
          or(isNull(salesEventsTable.endDate), gte(salesEventsTable.endDate, cutoff)),
          eq(salesEventsTable.status, "active"),
        ),
      );

    let synced = 0;
    let failed = 0;
    let scanned = 0;

    for (const event of events) {
      const config = (event.config ?? {}) as RainfocusConfig;
      if (!config.autoSync) continue;
      const creds = credsFromConfig(config);
      if (!creds) continue;
      scanned += 1;

      // One event's bad token must not stop the sweep.
      let result;
      try {
        result = await syncRainfocusEvent(event.tenantId, event.id, creds);
      } catch (err) {
        logger.error({ err, eventId: event.id }, "rainfocusSyncPoller: sync threw");
        result = { ok: false as const, error: "Sync failed unexpectedly." };
      }
      await recordSyncOutcome(event.tenantId, event.id, config, result).catch((err) =>
        logger.error({ err, eventId: event.id }, "rainfocusSyncPoller: could not record outcome"),
      );

      if (result.ok) {
        synced += 1;
        const s = result.summary;
        if (s.created || s.updated || s.missing || s.restored) {
          logger.info(
            { eventId: event.id, event: event.name, ...s },
            "rainfocusSyncPoller: catalog changed",
          );
        }
      } else {
        failed += 1;
        logger.warn({ eventId: event.id, error: result.error }, "rainfocusSyncPoller: sync failed");
      }
    }

    return { scanned, synced, failed };
  } finally {
    running = false;
  }
}

/**
 * Boot-time scheduler. Production only — a dev instance re-reading a live
 * conference catalog every six hours buys nothing and spends someone's API
 * quota. Returns the handle (unref'd) for tests.
 */
export function startRainfocusSyncPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production") return null;
  const safeRun = () =>
    runRainfocusSyncPoll().catch((err) =>
      logger.error({ err }, "rainfocusSyncPoller: sweep failed (will retry next interval)"),
    );
  void safeRun();
  const handle = setInterval(() => {
    void safeRun();
  }, RAINFOCUS_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
