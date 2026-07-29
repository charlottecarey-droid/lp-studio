/**
 * Re-import a RainFocus catalog and report what CHANGED.
 *
 * A conference catalog is not static: sessions get added, renamed, moved to a
 * different room or time, and cancelled outright — often after a rep has
 * already built and sent an agenda. This runs the same import as the manual
 * button and answers "what moved since last time".
 *
 * WHAT IT CANNOT DO: seat counts. A public widget token returns `capacity` and
 * `waitlistLimit` but not current registrations or a sold-out flag — that's
 * per-attendee state behind an authenticated attendee token. So there is no
 * "3 seats left"; what there IS, reliably, is "this session is no longer in the
 * catalog", which is the case that actually breaks a sent agenda.
 *
 * A DISAPPEARED SESSION IS MARKED, NEVER DELETED. A published agenda may
 * already reference it, and deleting the row would silently change a page a
 * customer has been sent. It's flagged `catalog_status = 'missing'` so the rep
 * can decide, and un-flagged automatically if it comes back (RainFocus
 * unpublishes and republishes sessions during setup, so a one-run absence is
 * not proof of cancellation).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, salesEventsTable, salesEventSessionsTable } from "@workspace/db";
import type { RainfocusConfig } from "@workspace/db";
import {
  cleanSessionTitle,
  fetchRainfocusCatalog,
  mapRainfocusSessions,
  pickFeaturedSpeakers,
  mapRainfocusSponsors,
  deriveEventDetails,
  type RainfocusCredentials,
} from "./rainfocus";
import { sessionSourceKey } from "./agenda-matching";
// Re-exported so callers have one import site; the implementations live in a
// db-free module so they can be unit-tested (see rainfocus-config.ts).
import { credsFromConfig, redactRainfocusConfig } from "./rainfocus-config";
export { credsFromConfig, redactRainfocusConfig };

export interface RainfocusSyncSummary {
  total: number;
  created: number;
  updated: number;
  /** Stored sessions the catalog no longer lists — newly flagged this run. */
  missing: number;
  /** Previously-missing sessions the catalog lists again. */
  restored: number;
  speakers: number;
  sponsors: number;
}

export type RainfocusSyncResult =
  | { ok: true; summary: RainfocusSyncSummary }
  | { ok: false; error: string };

/**
 * Run one sync. Shared by the manual "Sync now" button and the poller, so the
 * two can never drift.
 */
export async function syncRainfocusEvent(
  tenantId: number,
  eventId: number,
  creds: RainfocusCredentials,
): Promise<RainfocusSyncResult> {
  const catalog = await fetchRainfocusCatalog(creds, "session");
  if ("error" in catalog) return { ok: false, error: catalog.error };

  const { rows } = mapRainfocusSessions(catalog.items);
  if (rows.length === 0) {
    // An empty catalog from a working token is far more likely to be a widget
    // scoped to something else than an event that cancelled everything. Bail
    // rather than flag every session missing.
    return { ok: false, error: "The catalog came back empty — nothing was changed." };
  }

  const existing = await db
    .select({
      id: salesEventSessionsTable.id,
      sourceKey: salesEventSessionsTable.sourceKey,
      catalogStatus: salesEventSessionsTable.catalogStatus,
      tagsEditedInApp: salesEventSessionsTable.tagsEditedInApp,
      title: salesEventSessionsTable.title,
      day: salesEventSessionsTable.day,
      startTime: salesEventSessionsTable.startTime,
      endTime: salesEventSessionsTable.endTime,
      room: salesEventSessionsTable.room,
      description: salesEventSessionsTable.description,
    })
    .from(salesEventSessionsTable)
    .where(and(eq(salesEventSessionsTable.tenantId, tenantId), eq(salesEventSessionsTable.eventId, eventId)));

  const bySourceKey = new Map(existing.filter((s) => s.sourceKey).map((s) => [s.sourceKey as string, s]));

  /**
   * Fallback index for rows imported BEFORE titles were cleaned.
   *
   * The source key is derived from the title, so stripping "OFFERING 2" changes
   * it. Without this, the first sync after that change would treat all 168
   * sessions as new — inserting duplicates AND flagging every original as
   * "missing". Matching a cleaned incoming title against a cleaned STORED title
   * migrates the row in place instead.
   *
   * Only unambiguous cleaned titles are indexed; if two stored rows clean to the
   * same key we leave them to the normal path rather than guess which is which.
   */
  const cleanedKey = (title: string, day: string | null, startTime: string | null) =>
    sessionSourceKey(cleanSessionTitle(title), day, startTime);
  const cleanedCounts = new Map<string, number>();
  for (const row of existing) {
    const k = cleanedKey(row.title, row.day, row.startTime);
    cleanedCounts.set(k, (cleanedCounts.get(k) ?? 0) + 1);
  }
  const byCleanedTitle = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const k = cleanedKey(row.title, row.day, row.startTime);
    if ((cleanedCounts.get(k) ?? 0) === 1) byCleanedTitle.set(k, row);
  }

  let created = 0;
  let updated = 0;
  let restored = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const key = sessionSourceKey(row.title, row.day ?? null, row.startTime ?? null);
    seen.add(key);
    // Exact key first; then the pre-cleaning fallback above.
    const prior = bySourceKey.get(key) ?? byCleanedTitle.get(key);
    if (prior?.sourceKey && prior.sourceKey !== key) seen.add(prior.sourceKey);

    if (!prior) {
      await db.insert(salesEventSessionsTable).values({
        tenantId,
        eventId,
        title: row.title,
        day: row.day ?? null,
        startTime: row.startTime ?? null,
        endTime: row.endTime ?? null,
        room: row.room ?? null,
        sessionType: row.sessionType ?? null,
        track: row.track ?? null,
        description: row.description ?? null,
        speakers: row.speakers ?? [],
        tags: row.tags ?? {},
        sourceKey: key,
        catalogStatus: "active",
      });
      created += 1;
      continue;
    }

    // Only write when something actually differs — an unchanged catalog
    // shouldn't bump updatedAt on 168 rows every hour.
    const changed =
      prior.title !== row.title ||
      (prior.sourceKey ?? null) !== key ||
      (prior.endTime ?? null) !== (row.endTime ?? null) ||
      (prior.room ?? null) !== (row.room ?? null) ||
      (prior.description ?? null) !== (row.description ?? null);
    const wasMissing = prior.catalogStatus === "missing";

    if (changed || wasMissing) {
      await db
        .update(salesEventSessionsTable)
        .set({
          // Adopt the cleaned title and its key, so a row matched via the
          // fallback stops needing the fallback next time.
          title: row.title,
          sourceKey: key,
          endTime: row.endTime ?? null,
          room: row.room ?? null,
          description: row.description ?? null,
          sessionType: row.sessionType ?? null,
          track: row.track ?? null,
          speakers: row.speakers ?? [],
          // Tags the rep edited here are theirs — a re-sync must not stomp them.
          ...(prior.tagsEditedInApp ? {} : { tags: row.tags ?? {} }),
          catalogStatus: "active",
          missingSince: null,
        })
        .where(eq(salesEventSessionsTable.id, prior.id));
      if (wasMissing) restored += 1;
      else updated += 1;
    }
  }

  // Anything we hold that the catalog didn't list this run.
  const goneIds = existing
    .filter((s) => s.sourceKey && !seen.has(s.sourceKey) && s.catalogStatus !== "missing")
    .map((s) => s.id);
  if (goneIds.length > 0) {
    await db
      .update(salesEventSessionsTable)
      .set({ catalogStatus: "missing", missingSince: new Date() })
      .where(inArray(salesEventSessionsTable.id, goneIds));
  }

  // Refresh the non-session catalog too, best-effort.
  const [speakerCat, exhibitorCat] = await Promise.all([
    fetchRainfocusCatalog(creds, "speaker").catch(() => ({ error: "unavailable" })),
    fetchRainfocusCatalog(creds, "exhibitor").catch(() => ({ error: "unavailable" })),
  ]);
  const speakers = "error" in speakerCat ? [] : pickFeaturedSpeakers(speakerCat.items);
  const sponsors = "error" in exhibitorCat ? [] : mapRainfocusSponsors(exhibitorCat.items);
  const derived = deriveEventDetails(catalog.items);

  await db
    .update(salesEventsTable)
    .set({
      catalogExtras: { speakers, sponsors, derived, importedAt: new Date().toISOString() },
    })
    .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));

  return {
    ok: true,
    summary: {
      total: rows.length,
      created,
      updated,
      missing: goneIds.length,
      restored,
      speakers: speakers.length,
      sponsors: sponsors.length,
    },
  };
}

/** Persist the outcome onto the event so the UI can show last-sync state. */
export async function recordSyncOutcome(
  tenantId: number,
  eventId: number,
  config: RainfocusConfig,
  result: RainfocusSyncResult,
): Promise<void> {
  const next: RainfocusConfig = {
    ...config,
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: result.ok ? "ok" : "error",
    lastSyncMessage: result.ok ? undefined : result.error,
    lastSyncSummary: result.ok
      ? {
          created: result.summary.created,
          updated: result.summary.updated,
          missing: result.summary.missing,
          restored: result.summary.restored,
          total: result.summary.total,
        }
      : config.lastSyncSummary,
  };
  await db
    .update(salesEventsTable)
    .set({ rainfocusConfig: next })
    .where(and(eq(salesEventsTable.tenantId, tenantId), eq(salesEventsTable.id, eventId)));
}
