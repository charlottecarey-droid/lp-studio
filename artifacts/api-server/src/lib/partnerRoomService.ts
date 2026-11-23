/**
 * Partner rooms — work shared by the routes and the background poller:
 * the practice list (upsert, summary, reading a connected Google Sheet) and
 * the weekly digest (collect, render, send).
 */
import {
  db,
  lpPagesTable,
  lpBrandSettingsTable,
  lpRoomChoicesTable,
  lpRoomContactsTable,
  lpRoomPracticesTable,
  lpRoomDoctorsTable,
  lpRoomPracticeSnapshotsTable,
  lpRoomRequestsTable,
  lpRoomSettingsTable,
  lpRoomTaskStateTable,
  lpRoomWinLikesTable,
  lpRoomWinsTable,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";
import { doctorCountFromUpload, practiceNameKey, practiceNamesFromUpload, reconcilePractices } from "./partnerRoomReconcile";
import { lpRoomAutocreateAccountsTable, lpRoomAutocreateTable, lpRoomUploadsTable } from "@workspace/db";
import { accountKey, cleanAccountName } from "./partnerRoomNames";
import { roomSheetsRequest, sheetProblem } from "./partnerRoomSheets";
import { firstDateIn } from "./partnerRoomDates";
import { matchRoster, parseRoster, rosterTemplateCsv, type RosterResult } from "./partnerRoomRoster";
import { desc } from "drizzle-orm";
import { parsePracticeRow, resolveRoomBlocks, type RoomPracticeInput } from "./partnerRoom";
import { collectDigest, digestIsEmpty, renderDigestEmail, renderDigestSlack, type DigestData } from "./partnerRoomDigest";
import { sendRoomDigestEmail } from "./notifications";
import { slackService } from "./slack-service";

/** Practice counts by stage and the list of regions: safe for any visitor (no practice names). */
export interface PracticeTrendPoint {
  day: string;
  total: number;
  byStage: Record<string, number>;
}

/** One wave's (or the no-wave practices') counts by stage and region, and its scanners: what the Scorecard shows when that wave is picked. Counts only. */
export interface WaveBreakdown {
  byStage: Record<string, number>;
  byRegion: { region: string; total: number; live: number; trained: number }[];
  scanners?: { total: number; practices: number };
}

/** Rows of (wave, stage, region) counts folded into one breakdown per wave; "" holds the practices in no wave. */
export function waveBreakdowns(rows: Array<{ wave: string; stage: string; region: string | null; n: number; scanners: number; scannerPractices: number; scannerKnown: number }>): Map<string, WaveBreakdown> {
  const out = new Map<string, WaveBreakdown & { regions: Map<string, { region: string; total: number; live: number; trained: number }>; known: number }>();
  for (const r of rows) {
    const w = out.get(r.wave) ?? { byStage: {} as Record<string, number>, byRegion: [], regions: new Map(), known: 0, scanners: { total: 0, practices: 0 } };
    w.byStage[r.stage] = (w.byStage[r.stage] ?? 0) + r.n;
    w.scanners!.total += r.scanners;
    w.scanners!.practices += r.scannerPractices;
    w.known += r.scannerKnown;
    if (r.region) {
      const g = w.regions.get(r.region) ?? { region: r.region, total: 0, live: 0, trained: 0 };
      g.total += r.n;
      if (r.stage === "live") g.live += r.n;
      if (r.stage === "live" || r.stage === "trained") g.trained += r.n;
      w.regions.set(r.region, g);
    }
    out.set(r.wave, w);
  }
  const done = new Map<string, WaveBreakdown>();
  for (const [k, w] of out) {
    done.set(k, {
      byStage: w.byStage,
      byRegion: [...w.regions.values()].sort((a, b) => b.total - a.total || a.region.localeCompare(b.region)).slice(0, 60),
      ...(w.known > 0 ? { scanners: w.scanners } : {}),
    });
  }
  return done;
}

export interface PracticeSummary {
  total: number;
  byStage: Record<string, number>;
  regions: string[];
  scanners?: { total: number; practices: number };
  /** Per region: how many practices, and how many of them are live / trained or live. Largest first. */
  byRegion: { region: string; total: number; live: number; trained: number }[];
  waves: string[];
  /** Per wave, as the practice list names it: how many practices, how many are live, and how many trained or live. Counts only: safe for any visitor. */
  byWave: ({ wave: string; total: number; live: number; trained: number } & WaveBreakdown)[];
  /** Practices not in any wave yet (only when some are in one, or the hub plans waves). */
  noWave: number;
  /** The same breakdown for the practices in no wave, so the Scorecard can show them on their own. */
  noWaveDetail?: WaveBreakdown;
  /** One point per day the list was refreshed (oldest first, up to 120 days). */
  trend: PracticeTrendPoint[];
  /** Doctors on the customer's roster, and how many of them sit at a practice we hold. Absent until a roster with doctors is read. */
  doctors?: { total: number; matched: number };
  /** When the list was last refreshed from its connected sheet (it is re-read about every hour). Absent when no sheet is connected. */
  syncedAt?: string;
}

export async function practiceSummary(pageId: number): Promise<PracticeSummary> {
  const rows = (await db.execute(sql`SELECT stage, region, COUNT(*)::int AS n FROM lp_room_practices WHERE page_id = ${pageId} GROUP BY stage, region`)).rows as Array<{ stage: string; region: string | null; n: number }>;
  const byStage: Record<string, number> = {};
  const regions = new Map<string, { region: string; total: number; live: number; trained: number }>();
  let total = 0;
  for (const r of rows) {
    byStage[r.stage] = (byStage[r.stage] ?? 0) + r.n;
    total += r.n;
    if (!r.region) continue;
    const g = regions.get(r.region) ?? { region: r.region, total: 0, live: 0, trained: 0 };
    g.total += r.n;
    if (r.stage === "live") g.live += r.n;
    if (r.stage === "live" || r.stage === "trained") g.trained += r.n;
    regions.set(r.region, g);
  }
  // Scanner counts, when the list carries them (the scanner tracker's office breakdown).
  const [sc] = (await db.execute(sql`SELECT COALESCE(SUM(scanner_count), 0)::int AS total, COUNT(*) FILTER (WHERE scanner_count > 0)::int AS practices, COUNT(scanner_count)::int AS known FROM lp_room_practices WHERE page_id = ${pageId}`)).rows as Array<{ total: number; practices: number; known: number }>;
  const [waveCounts, trend, waveRows] = total
    ? await Promise.all([
        db.execute(sql`SELECT btrim(wave) AS wave, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE stage = 'live')::int AS live, COUNT(*) FILTER (WHERE stage IN ('live', 'trained'))::int AS trained FROM lp_room_practices WHERE page_id = ${pageId} AND wave IS NOT NULL AND btrim(wave) <> '' GROUP BY btrim(wave) ORDER BY btrim(wave) LIMIT 40`).then((r) => r.rows as Array<{ wave: string; total: number; live: number; trained: number }>),
        db.select({ day: lpRoomPracticeSnapshotsTable.day, total: lpRoomPracticeSnapshotsTable.total, byStage: lpRoomPracticeSnapshotsTable.byStage }).from(lpRoomPracticeSnapshotsTable).where(eq(lpRoomPracticeSnapshotsTable.pageId, pageId)).orderBy(desc(lpRoomPracticeSnapshotsTable.day)).limit(120),
        // Each wave's own stages, regions and scanners ("" = in no wave), so picking a wave re-counts the whole Scorecard.
        db.execute(sql`SELECT COALESCE(btrim(wave), '') AS wave, stage, region, COUNT(*)::int AS n, COALESCE(SUM(scanner_count), 0)::int AS scanners, COUNT(*) FILTER (WHERE scanner_count > 0)::int AS "scannerPractices", COUNT(scanner_count)::int AS "scannerKnown" FROM lp_room_practices WHERE page_id = ${pageId} GROUP BY 1, stage, region`).then((r) => r.rows as Array<{ wave: string; stage: string; region: string | null; n: number; scanners: number; scannerPractices: number; scannerKnown: number }>),
      ])
    : [[], [], []];
  const breakdowns = waveBreakdowns(waveRows);
  const empty: WaveBreakdown = { byStage: {}, byRegion: [] };
  const byWave = waveCounts.map((w) => ({ ...w, ...(breakdowns.get(w.wave) ?? empty) }));
  return {
    total,
    byStage,
    regions: [...regions.keys()].sort(),
    ...(sc && sc.known > 0 ? { scanners: { total: sc.total, practices: sc.practices } } : {}),
    byRegion: [...regions.values()].sort((a, b) => b.total - a.total || a.region.localeCompare(b.region)).slice(0, 60),
    waves: byWave.map((w) => w.wave),
    byWave,
    noWave: Math.max(0, total - byWave.reduce((n, w) => n + w.total, 0)),
    ...(breakdowns.has("") ? { noWaveDetail: breakdowns.get("")! } : {}),
    trend: trend.reverse(),
    ...(await doctorTotals(pageId, total)),
    ...(await lastSheetRead(pageId)),
  };
}

async function lastSheetRead(pageId: number): Promise<{ syncedAt?: string }> {
  const [s] = await db.select({ sheetId: lpRoomSettingsTable.practicesSheetId, at: lpRoomSettingsTable.practicesSyncedAt }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1);
  return s?.sheetId && s.at ? { syncedAt: s.at.toISOString() } : {};
}

async function doctorTotals(pageId: number, practices: number): Promise<{ doctors?: { total: number; matched: number } }> {
  if (!practices) return {};
  const [d] = (await db.execute(sql`SELECT COUNT(*)::int AS total, COUNT(practice_id)::int AS matched FROM lp_room_doctors WHERE page_id = ${pageId}`)).rows as Array<{ total: number; matched: number }>;
  return d && d.total > 0 ? { doctors: { total: d.total, matched: d.matched } } : {};
}

/**
 * Record today's stage counts for the trend line. One row per room per day
 * (the latest refresh of the day wins). An empty list records nothing.
 */
export async function recordPracticeSnapshot(page: { id: number; tenantId: number }, now: Date = new Date()): Promise<void> {
  const rows = (await db.execute(sql`SELECT stage, COUNT(*)::int AS n, COALESCE(SUM(scanner_count), 0)::int AS sc, COUNT(scanner_count)::int AS known FROM lp_room_practices WHERE page_id = ${page.id} GROUP BY stage`)).rows as Array<{ stage: string; n: number; sc: number; known: number }>;
  const total = rows.reduce((n, r) => n + r.n, 0);
  if (total === 0) return;
  const byStage = Object.fromEntries(rows.map((r) => [r.stage, r.n]));
  const scanners = rows.some((r) => r.known > 0) ? rows.reduce((n, r) => n + r.sc, 0) : null;
  await db
    .insert(lpRoomPracticeSnapshotsTable)
    .values({ tenantId: page.tenantId, pageId: page.id, day: now.toISOString().slice(0, 10), total, byStage, scanners })
    .onConflictDoUpdate({ target: [lpRoomPracticeSnapshotsTable.pageId, lpRoomPracticeSnapshotsTable.day], set: { total, byStage, scanners } });
}

/** What an upload can say about a practice that the synced sheet must then leave alone. */
export const KEPT_PRACTICE_FIELDS = ["city", "state", "address", "zip", "phone", "officeType", "regionalManager", "officeManager"] as const;
type KeptField = (typeof KEPT_PRACTICE_FIELDS)[number];

/**
 * Add or update practices: matched by Salesforce id when given, else by name.
 * A row that says nothing about the stage keeps the saved one.
 *
 * Two kinds of source:
 *   - a sync (the connected sheet, Salesforce): the default. With `mirror`,
 *     practices the source no longer lists are removed.
 *   - an upload (`upload: true`: a list the team imports): the customer's word.
 *     What it sets is remembered per practice and a later sync does not
 *     overwrite it; a practice it adds is never removed by a sync.
 */
export async function upsertPractices(page: { id: number; tenantId: number }, rows: RoomPracticeInput[], opts: { mirror?: boolean; upload?: boolean } = {}): Promise<{ added: number; updated: number; removed: number }> {
  const existing = await db.select({ id: lpRoomPracticesTable.id, externalId: lpRoomPracticesTable.externalId, name: lpRoomPracticesTable.name, source: lpRoomPracticesTable.source, keptFields: lpRoomPracticesTable.keptFields }).from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, page.id));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const byExt = new Map(existing.filter((e) => e.externalId).map((e) => [e.externalId as string, e.id]));
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));
  // An uploaded list rarely spells a practice exactly as Salesforce does ("Main St Dental" / "Main Street Dental, P.C."): fall back to the loose name.
  const byKey = new Map<string, number>();
  if (opts.upload) for (const e of existing) if (practiceNameKey(e.name) && !byKey.has(practiceNameKey(e.name))) byKey.set(practiceNameKey(e.name), e.id);
  const inserts: (typeof lpRoomPracticesTable.$inferInsert)[] = [];
  const matched = new Set<number>();
  let updated = 0;
  for (const r of rows) {
    const id = (r.externalId && byExt.get(r.externalId)) || byName.get(r.name.trim().toLowerCase()) || (opts.upload ? byKey.get(practiceNameKey(r.name)) : undefined);
    const given: Partial<Record<KeptField, string>> = {};
    for (const f of KEPT_PRACTICE_FIELDS) if (r[f]) given[f] = r[f] as string;
    if (id && id > 0) {
      matched.add(id);
      const kept = new Set<string>(byId.get(id)?.keptFields ?? []);
      // A sync leaves alone what an upload set; an upload sets what it carries and remembers it.
      const fields = Object.fromEntries(Object.entries(given).filter(([f]) => opts.upload || !kept.has(f)));
      if (opts.upload) for (const f of Object.keys(given)) kept.add(f);
      await db
        .update(lpRoomPracticesTable)
        .set({
          // The name stays as the sync has it once an upload matched loosely (the upload's spelling is not Salesforce's).
          ...(opts.upload ? {} : { name: r.name }),
          ...(r.externalId ? { externalId: r.externalId } : {}),
          ...fields,
          ...(r.wave ? { wave: r.wave } : {}),
          ...(r.stageGiven ? { stage: r.stage } : {}),
          ...(r.trainingDate ? { trainingDate: r.trainingDate } : {}),
          ...(r.liveDate ? { liveDate: r.liveDate } : {}),
          ...(r.scannerSent ? { scannerSent: r.scannerSent } : {}),
          ...(r.scannerActivated ? { scannerActivated: r.scannerActivated } : {}),
          ...(r.scannerCount != null ? { scannerCount: r.scannerCount } : {}),
          ...(r.scannerModels ? { scannerModels: r.scannerModels } : {}),
          ...(r.scannerBrand ? { scannerBrand: r.scannerBrand } : {}),
          ...(r.contractSigned ? { contractSigned: r.contractSigned } : {}),
          ...(r.sourceStatus ? { sourceStatus: r.sourceStatus } : {}),
          ...(r.owner ? { owner: r.owner } : {}),
          ...(r.lastActivity ? { lastActivity: r.lastActivity } : {}),
          // Orders: a list with these columns says what is true now, including "none" and "unknown".
          ...(r.products !== undefined ? { products: r.products.join(", ") } : {}),
          ...(r.lastOrderDay !== undefined ? { lastOrderDay: r.lastOrderDay } : {}),
          ...(r.tenthOrderDay !== undefined ? { tenthOrderDay: r.tenthOrderDay } : {}),
          ...(r.ordersAllTime !== undefined ? { ordersAllTime: r.ordersAllTime } : {}),
          ...(r.ordersLastMonth !== undefined ? { ordersLastMonth: r.ordersLastMonth } : {}),
          ...(r.ordersThisMonth !== undefined ? { ordersThisMonth: r.ordersThisMonth } : {}),
          ...(opts.upload ? { keptFields: [...kept] } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(lpRoomPracticesTable.id, id));
      updated++;
    } else if (!id) {
      inserts.push({ tenantId: page.tenantId, pageId: page.id, externalId: r.externalId, name: r.name, region: r.region, city: r.city, state: r.state, wave: r.wave, stage: r.stage, trainingDate: r.trainingDate, liveDate: r.liveDate, scannerSent: r.scannerSent, scannerActivated: r.scannerActivated, regionalManager: r.regionalManager, scannerCount: r.scannerCount, scannerModels: r.scannerModels, scannerBrand: r.scannerBrand ?? null, contractSigned: r.contractSigned ?? null, sourceStatus: r.sourceStatus ?? null, owner: r.owner ?? null, lastActivity: r.lastActivity ?? null, address: r.address ?? null, zip: r.zip ?? null, officeType: r.officeType ?? null, phone: r.phone ?? null, officeManager: r.officeManager ?? null, products: r.products ? r.products.join(", ") : null, lastOrderDay: r.lastOrderDay ?? null, tenthOrderDay: r.tenthOrderDay ?? null, ordersAllTime: r.ordersAllTime ?? null, ordersLastMonth: r.ordersLastMonth ?? null, ordersThisMonth: r.ordersThisMonth ?? null, ...(opts.upload ? { source: "upload", keptFields: Object.keys(given) } : {}) });
      byName.set(r.name.trim().toLowerCase(), -1);
      if (r.externalId) byExt.set(r.externalId, -1);
      if (opts.upload && practiceNameKey(r.name)) byKey.set(practiceNameKey(r.name), -1);
    }
  }
  for (let i = 0; i < inserts.length; i += 200) await db.insert(lpRoomPracticesTable).values(inserts.slice(i, i + 200));
  // Mirror mode (a connected sheet is the practice list): drop practices the sheet no longer lists, except the ones an upload added.
  let removed = 0;
  if (opts.mirror) {
    const gone = existing.filter((e) => !matched.has(e.id) && e.source !== "upload").map((e) => e.id);
    for (let i = 0; i < gone.length; i += 500) await db.delete(lpRoomPracticesTable).where(inArray(lpRoomPracticesTable.id, gone.slice(i, i + 500)));
    removed = gone.length;
  }
  // Today's counts, for the scorecard's trend. Never worth failing a refresh over.
  await recordPracticeSnapshot(page).catch((err) => logger.warn({ err, pageId: page.id }, "practice snapshot failed"));
  return { added: inserts.length, updated, removed };
}

/**
 * Each practice's training as a calendar entry ("Training: Main Street
 * Dental", all day). From the practice list's training date, read however the
 * sheet writes it; one that isn't a date ("TBD") is left out. Covers the last
 * two months onward. Ids are negative so they never collide with a synced
 * meeting's.
 */
export async function practiceTrainingEvents(pageId: number, now: Date = new Date()): Promise<{ id: number; title: string; startsAt: string; endsAt: null; allDay: true; kind: "training" }[]> {
  const rows = await db.select({ id: lpRoomPracticesTable.id, name: lpRoomPracticesTable.name, trainingDate: lpRoomPracticesTable.trainingDate }).from(lpRoomPracticesTable).where(and(eq(lpRoomPracticesTable.pageId, pageId), sql`${lpRoomPracticesTable.trainingDate} IS NOT NULL`)).orderBy(lpRoomPracticesTable.name).limit(5000);
  const from = new Date(now.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
  const out: { id: number; title: string; startsAt: string; endsAt: null; allDay: true; kind: "training" }[] = [];
  for (const r of rows) {
    const day = firstDateIn(r.trainingDate, now);
    if (!day || day < from) continue;
    out.push({ id: -r.id, title: `Training: ${r.name}`, startsAt: `${day}T00:00:00.000Z`, endsAt: null, allDay: true, kind: "training" });
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title)).slice(0, 600);
}

/* ── A connected Google Sheet as the practice list ───────────────────────── */

export const SHEET_ID_RE = /^[A-Za-z0-9_-]{20,}$/;
export const SHEET_TAB_RE = /^[A-Za-z0-9 _&().,'-]{1,80}$/;

/** A Google Sheets URL or a bare id → the spreadsheet id, or null. */
export function sheetIdFrom(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  const m = v.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  const id = m ? m[1] : v;
  return SHEET_ID_RE.test(id) ? id : null;
}

export interface SheetFilter {
  column: string;
  value: string;
  /** "sfid" compares Salesforce ids (15- and 18-character forms of one id match); "account" compares account names however they are decorated ("MB2 Dental-HQ" is "MB2 Dental"); default is "contains". */
  mode?: "contains" | "sfid" | "account";
}

const PARENT_ID_HEADERS = ["parent account id", "parent account id (18)", "parent account 18 digit id", "parent id", "parent account: account id", "parent account: 18 digit id", "parent 18 digit id"];

/** When the sheet has a parent-account-id column and the room knows the customer's Salesforce account id, filter on it. */
export function parentIdFilter(values: unknown, sfdcAccountId: string | null | undefined): SheetFilter | null {
  const id = (sfdcAccountId ?? "").trim();
  if (!/^[a-zA-Z0-9]{15,18}$/.test(id) || !Array.isArray(values) || !Array.isArray(values[0])) return null;
  const header = (values[0] as unknown[]).map((h) => String(h ?? "").trim()).find((h) => PARENT_ID_HEADERS.includes(h.toLowerCase()));
  return header ? { column: header, value: id, mode: "sfid" } : null;
}

const PARENT_NAME_HEADERS = ["parent account name", "parent account", "parent account: account name", "parent name", "dso", "dso name"];

/** When the sheet has a parent-account-name column and the room knows the customer's account name, filter on the name. */
export function parentNameFilter(values: unknown, accountName: string | null | undefined): SheetFilter | null {
  const key = accountKey(accountName ?? "");
  if (!key || !Array.isArray(values) || !Array.isArray(values[0])) return null;
  const header = (values[0] as unknown[]).map((h) => String(h ?? "").trim()).find((h) => PARENT_NAME_HEADERS.includes(h.toLowerCase()));
  return header ? { column: header, value: cleanAccountName(accountName), mode: "account" } : null;
}

/** The header's position for a filter column (case-insensitive), or -1. */
export function sheetFilterIndex(values: unknown, filter: SheetFilter | null): number {
  if (!filter || !Array.isArray(values) || !Array.isArray(values[0])) return -1;
  const want = filter.column.trim().toLowerCase();
  return (values[0] as unknown[]).findIndex((h) => String(h ?? "").trim().toLowerCase() === want);
}

/** Sheet values (first row = column names) → practice rows; with a filter, only rows whose filter column contains the value. */
export function practicesFromSheetValues(values: unknown, filter: SheetFilter | null = null): RoomPracticeInput[] {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = (values[0] as unknown[]).map((h) => String(h ?? "").trim().toLowerCase());
  const filterAt = sheetFilterIndex(values, filter);
  const needle = filter ? filter.value.trim().toLowerCase() : "";
  const nameKey = filter?.mode === "account" ? accountKey(filter.value) : "";
  const out: RoomPracticeInput[] = [];
  const seen = new Set<string>();
  for (const raw of values.slice(1, 20_001)) {
    if (!Array.isArray(raw)) continue;
    if (filter) {
      const cell = String(raw[filterAt] ?? "").trim();
      const hit = filterAt >= 0 && (filter.mode === "sfid" ? cell.length >= 15 && cell.slice(0, 15) === filter.value.trim().slice(0, 15) : filter.mode === "account" ? accountKey(cell) === nameKey : cell.toLowerCase().includes(needle));
      if (!hit) continue;
    }
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => (row[h] = String(raw[i] ?? "")));
    const parsed = parsePracticeRow(row);
    if (!parsed) continue;
    const key = parsed.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}


async function isSharedWorkbook(tenantId: number, sheetId: string): Promise<boolean> {
  const [cfg] = await db.select({ sheetId: lpRoomAutocreateTable.sheetId }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
  return !!cfg?.sheetId && cfg.sheetId === sheetId;
}

/** The account an automatic room was made for (rooms made by hand have none). */
async function roomAccountName(pageId: number): Promise<string | null> {
  const [row] = await db.select({ name: lpRoomAutocreateAccountsTable.accountName }).from(lpRoomAutocreateAccountsTable).where(eq(lpRoomAutocreateAccountsTable.pageId, pageId)).limit(1);
  return row?.name ?? null;
}

/**
 * Read the room's connected sheet and make the practice list match it.
 * The sheet is the source of truth while connected: practices it no longer
 * lists are removed. An empty or unreadable sheet changes nothing (so a
 * broken share never wipes the list); the note says what happened.
 */
export async function syncPracticesFromSheet(pageId: number): Promise<{ ok: boolean; note: string }> {
  const [settings] = await db.select().from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1);
  const sheetId = settings?.practicesSheetId;
  if (!settings || !sheetId || !SHEET_ID_RE.test(sheetId)) return { ok: false, note: "No sheet is connected." };
  const tab = settings.practicesSheetTab && SHEET_TAB_RE.test(settings.practicesSheetTab) ? settings.practicesSheetTab : "";
  const finish = async (ok: boolean, note: string) => {
    await db.update(lpRoomSettingsTable).set({ practicesSyncedAt: sql`now()`, practicesSyncNote: note.slice(0, 300) }).where(eq(lpRoomSettingsTable.pageId, pageId));
    return { ok, note };
  };
  try {
    const range = encodeURIComponent(tab ? `'${tab.replace(/'/g, "''")}'!A1:CZ20001` : "A1:CZ20001");
    const resp = await roomSheetsRequest(settings.tenantId, `/v4/spreadsheets/${sheetId}/values/${range}`);
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      logger.warn({ pageId, status: resp.status, body: body.slice(0, 300) }, "room practices sheet read failed");
      return finish(false, sheetProblem(resp.status, resp.sharedWith, tab));
    }
    const values = ((await resp.json()) as { values?: unknown }).values;
    // An explicit filter wins; otherwise filter by the customer's Salesforce account id when the sheet has a parent-id column.
    const filter: SheetFilter | null = settings.practicesSheetFilterColumn?.trim() && settings.practicesSheetFilterValue?.trim() ? { column: settings.practicesSheetFilterColumn, value: settings.practicesSheetFilterValue } : (parentIdFilter(values, settings.sfdcAccountId) ?? parentNameFilter(values, await roomAccountName(pageId)));
    // The workbook automatic rooms are made from lists every customer's locations: never load it into one room unfiltered.
    if (!filter && (await isSharedWorkbook(settings.tenantId, sheetId))) return finish(false, "This sheet lists every customer's locations. It needs a “Parent Account ID” or “Parent Account Name” column to pick out this customer's practices.");
    if (filter && sheetFilterIndex(values, filter) < 0) return finish(false, `The sheet has no “${filter.column}” column to filter on. Add it to the report, or change the filter.`);
    const rows = practicesFromSheetValues(values, filter);
    if (rows.length === 0) return finish(false, filter ? `No rows where “${filter.column}” ${filter.mode === "contains" || !filter.mode ? "contains" : "is"} “${filter.value}”.` : "The sheet has no rows with a practice name. The first row needs column names, including “name” or “Account Name”.");
    // A sheet this large is a report across customers: without a filter it would load everyone's practices into one room.
    if (!filter && rows.length > 2000) return finish(false, `This sheet lists ${rows.length} practices, which looks like every customer's. Save the customer's Salesforce account ID (the sheet needs a “Parent Account ID” column), or set a filter such as Parent Account Name contains the customer's name.`);
    const r = await upsertPractices({ id: pageId, tenantId: settings.tenantId }, rows, { mirror: true });
    return finish(true, `${rows.length} practices in the sheet (${r.added} added, ${r.updated} updated, ${r.removed} removed).`);
  } catch (err) {
    logger.error({ err, pageId }, "room practices sheet sync failed");
    return finish(false, "Couldn't reach Google Sheets.");
  }
}

/* ── The customer's roster ───────────────────────────────────────────────── */

/**
 * Read an uploaded file as a roster and apply it. The customer's roster is
 * their word on their own practices, so it wins:
 *   - the regional manager, office manager, address and the rest it gives are
 *     saved on each practice it matches, and the sheet sync leaves them alone;
 *   - a practice it lists that we don't hold is added (and the sync never
 *     removes it);
 *   - the room's doctors are replaced with the ones it lists, each tied to
 *     its practice.
 * Nothing is removed. What Salesforce is missing, and what Salesforce has
 * that the roster doesn't, is reported for the team (`unmatched`,
 * `notOnRoster`: both measured against the practices that came from the
 * sync, not the ones a roster added).
 * Returns null when the file isn't a roster (no practice column).
 */
export async function applyRoster(page: { id: number; tenantId: number }, upload: { id: number; fileName: string }, buf: Buffer): Promise<RosterResult | null> {
  const parsed = parseRoster(upload.fileName, buf);
  if (!parsed || parsed.rows.length === 0) return null;
  const load = () => db.select({ id: lpRoomPracticesTable.id, externalId: lpRoomPracticesTable.externalId, name: lpRoomPracticesTable.name, source: lpRoomPracticesTable.source, keptFields: lpRoomPracticesTable.keptFields }).from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, page.id));
  let practices = await load();
  // How the roster compares with what the sync lists: this is what the team is told.
  const gap = matchRoster(parsed.rows, practices.filter((p) => p.source !== "upload")).result;
  // Practices the roster names that we don't hold at all: add them, with what their first row says.
  let match = matchRoster(parsed.rows, practices);
  const missing = new Set(match.result.unmatched.map((n) => practiceNameKey(n)).filter(Boolean));
  const adds: (typeof lpRoomPracticesTable.$inferInsert)[] = [];
  for (const row of parsed.rows) {
    const key = practiceNameKey(row.practiceName);
    if (!key || !missing.has(key) || adds.length >= 2000) continue;
    missing.delete(key);
    const kept = KEPT_PRACTICE_FIELDS.filter((f) => row[f]);
    adds.push({ tenantId: page.tenantId, pageId: page.id, name: row.practiceName.slice(0, 160), region: row.state || null, city: row.city || null, state: row.state || null, address: row.address || null, zip: row.zip || null, phone: row.phone || null, officeType: row.officeType || null, regionalManager: row.regionalManager || null, officeManager: row.officeManager || null, source: "upload", keptFields: kept });
  }
  if (adds.length) {
    for (let i = 0; i < adds.length; i += 200) await db.insert(lpRoomPracticesTable).values(adds.slice(i, i + 200));
    practices = await load();
    match = matchRoster(parsed.rows, practices);
  }
  const keptById = new Map(practices.map((p) => [p.id, p.keptFields ?? []]));
  for (const u of match.updates) {
    const { id, ...fields } = u;
    const kept = [...new Set([...(keptById.get(id) ?? []), ...Object.keys(fields)])];
    await db.update(lpRoomPracticesTable).set({ ...fields, keptFields: kept, updatedAt: sql`now()` }).where(and(eq(lpRoomPracticesTable.id, id), eq(lpRoomPracticesTable.pageId, page.id)));
  }
  // The doctors are replaced as a whole, but only by a file that has a doctor column (a practices-only list leaves them alone).
  if (parsed.hasDoctors) {
    await db.delete(lpRoomDoctorsTable).where(eq(lpRoomDoctorsTable.pageId, page.id));
    for (let i = 0; i < match.doctors.length; i += 200) {
      await db.insert(lpRoomDoctorsTable).values(match.doctors.slice(i, i + 200).map((d) => ({ tenantId: page.tenantId, pageId: page.id, practiceId: d.practiceId, practiceName: d.practiceName || null, name: d.name, email: d.email, npi: d.npi, role: d.role, uploadId: upload.id })));
    }
  }
  if (adds.length) await recordPracticeSnapshot(page).catch((err) => logger.warn({ err, pageId: page.id }, "practice snapshot failed"));
  const result: RosterResult = { ...match.result, practices: gap.practices, matched: gap.matched, unmatched: gap.unmatched, notOnRoster: gap.notOnRoster, likely: gap.likely, doctorsUnmatched: gap.doctorsUnmatched, enriched: gap.enriched, added: adds.length };
  await db.update(lpRoomUploadsTable).set({ rosterResult: { ...result, hasDoctors: parsed.hasDoctors, fileName: upload.fileName } as Record<string, unknown> }).where(eq(lpRoomUploadsTable.id, upload.id));
  return result;
}

/** The newest roster the customer uploaded that could be read, with what matched and what didn't. */
export async function latestRosterResult(pageId: number): Promise<(RosterResult & { fileName: string; hasDoctors: boolean; uploadedAt: string }) | null> {
  const [row] = await db
    .select({ result: lpRoomUploadsTable.rosterResult, createdAt: lpRoomUploadsTable.createdAt })
    .from(lpRoomUploadsTable)
    .where(and(eq(lpRoomUploadsTable.pageId, pageId), sql`${lpRoomUploadsTable.rosterResult} IS NOT NULL`))
    .orderBy(desc(lpRoomUploadsTable.createdAt))
    .limit(1);
  return row?.result ? ({ ...(row.result as unknown as RosterResult & { fileName: string; hasDoctors: boolean }), uploadedAt: row.createdAt.toISOString() }) : null;
}

/** The roster template for a room: its practices as we hold them, ready for the customer to add doctors and corrections. */
export async function roomRosterTemplate(pageId: number): Promise<string> {
  const practices = await db
    .select({ id: lpRoomPracticesTable.id, externalId: lpRoomPracticesTable.externalId, name: lpRoomPracticesTable.name, address: lpRoomPracticesTable.address, city: lpRoomPracticesTable.city, state: lpRoomPracticesTable.state, zip: lpRoomPracticesTable.zip, phone: lpRoomPracticesTable.phone, officeType: lpRoomPracticesTable.officeType, regionalManager: lpRoomPracticesTable.regionalManager, officeManager: lpRoomPracticesTable.officeManager })
    .from(lpRoomPracticesTable)
    .where(eq(lpRoomPracticesTable.pageId, pageId))
    .orderBy(lpRoomPracticesTable.name)
    .limit(5000);
  return rosterTemplateCsv(practices);
}

/* ── What Salesforce is missing ──────────────────────────────────────────── */

/** `<!subteam^S…>` for a user group, `<@U…>` for a person; empty when the setting isn't a Slack id. */
export function slackMention(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().replace(/^[<@!]+|[>]+$/g, "").replace(/^subteam\^/, "");
  if (/^S[A-Z0-9]{6,}$/.test(v)) return `<!subteam^${v}>`;
  if (/^[UW][A-Z0-9]{6,}$/.test(v)) return `<@${v}>`;
  return "";
}

export interface SalesforceGap {
  fileName: string;
  missing: string[];
  matched: number;
  uploaded: number;
  doctors: number | null;
  /** Practices we list (from Salesforce) that the customer's roster does not. */
  notOnRoster?: string[];
  /** How many practices we list. */
  listed?: number;
}

const storage = new ObjectStorageService();

/**
 * Compare the customer's most recent practice list (an .xlsx / .csv they
 * uploaded to the room) with the practices the room holds, and count the
 * doctors on their latest roster. Null when they have uploaded no list we
 * can read. Reads at most the eight newest uploads.
 */
export async function loadSalesforceGap(pageId: number): Promise<SalesforceGap | null> {
  const uploads = await db.select().from(lpRoomUploadsTable).where(eq(lpRoomUploadsTable.pageId, pageId)).orderBy(desc(lpRoomUploadsTable.createdAt)).limit(8);
  let names: { fileName: string; names: string[] } | null = null;
  let doctors: number | null = null;
  for (const u of uploads) {
    if (!/\.(xlsx|csv|tsv|txt)$/i.test(u.fileName) || (names && doctors !== null)) continue;
    try {
      const file = await storage.getObjectEntityFile(u.objectPath);
      const chunks: Buffer[] = [];
      for await (const chunk of file.createReadStream()) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
      const buf = Buffer.concat(chunks);
      if (!names) {
        const found = practiceNamesFromUpload(u.fileName, buf);
        if (found && found.names.length) names = { fileName: u.fileName, names: found.names };
      }
      if (doctors === null) {
        const d = doctorCountFromUpload(u.fileName, buf);
        if (d && d.count) doctors = d.count;
      }
    } catch (err) {
      logger.warn({ err, pageId, uploadId: u.id }, "room upload could not be read for the Salesforce gap");
    }
  }
  if (!names && doctors === null) return null;
  const roomNames = (await db.select({ name: lpRoomPracticesTable.name }).from(lpRoomPracticesTable).where(and(eq(lpRoomPracticesTable.pageId, pageId), sql`${lpRoomPracticesTable.source} IS DISTINCT FROM 'upload'`))).map((p) => p.name); // the gap is against what the sync lists, not what a roster added
  const r = names ? reconcilePractices(names.names, roomNames) : null;
  return { fileName: names?.fileName ?? "", missing: r?.missingFromRoom ?? [], matched: r?.matched ?? 0, uploaded: r?.uploaded ?? 0, doctors, notOnRoster: r?.notOnUpload ?? [], listed: roomNames.length };
}

/** The RevOps lines for Slack: who to mention, how many child accounts and doctors to add, and the first names. Empty when there is no gap. */
export function revopsSlackLines(gap: SalesforceGap | null, mention: string, customer: string): string[] {
  if (!gap || (gap.missing.length === 0 && !gap.doctors)) return [];
  const m = (s: string) => s.replace(/[<>&*_~`]/g, " ");
  const parts = [gap.missing.length ? `${gap.missing.length} child account${gap.missing.length === 1 ? "" : "s"}` : null, gap.doctors ? `${gap.doctors} doctor${gap.doctors === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ");
  const lines = [`*RevOps${mention ? ` ${mention}` : ""}: add ${parts} to Salesforce for ${m(customer)}*`];
  if (gap.missing.length) {
    lines.push(`On ${m(customer)}'s list${gap.fileName ? ` (${m(gap.fileName)})` : ""} but not in Salesforce:\n${gap.missing.slice(0, 15).map((n) => `• ${m(n)}`).join("\n")}${gap.missing.length > 15 ? `\n• and ${gap.missing.length - 15} more (full list: LP Studio → page analytics → Room → Compare with practices)` : ""}`);
  }
  if (gap.doctors) lines.push(`Their doctor roster lists ${gap.doctors} doctor${gap.doctors === 1 ? "" : "s"} to add as contacts on their practices. The file is in the room's Files received.`);
  return lines;
}

/* ── Weekly digest ───────────────────────────────────────────────────────── */

export interface RoomDigest {
  data: DigestData;
  email: { subject: string; html: string };
  slack: { text: string; blocks: unknown[] };
  recipients: string[];
  roomUrl: string;
  tenantId: number;
  slackChannelId: string | null;
  empty: boolean;
  /** The Slack post carries a RevOps item (so it goes out even in an otherwise quiet week; the customer email still skips). */
  hasRevops: boolean;
}

/** Everything the weekly digest says for a room, or null when the page is not a workspace. */
export async function buildRoomDigest(pageId: number, now: Date = new Date()): Promise<RoomDigest | null> {
  const [page] = await db.select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug, blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  if (!page || page.tenantId == null) return null;
  const tenantId = page.tenantId;
  const [settingsRows, tasks, requests, choices, wins, practices, practiceRows, tenantRows, brandRows] = await Promise.all([
    db.select().from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1),
    db.select().from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, pageId)),
    db.select().from(lpRoomRequestsTable).where(eq(lpRoomRequestsTable.pageId, pageId)),
    db.select().from(lpRoomChoicesTable).where(eq(lpRoomChoicesTable.pageId, pageId)),
    db.select().from(lpRoomWinsTable).where(eq(lpRoomWinsTable.pageId, pageId)),
    practiceSummary(pageId),
    db
      .select({ name: lpRoomPracticesTable.name, region: lpRoomPracticesTable.region, stage: lpRoomPracticesTable.stage, trainingDate: lpRoomPracticesTable.trainingDate, liveDate: lpRoomPracticesTable.liveDate, lastOrderDay: lpRoomPracticesTable.lastOrderDay, tenthOrderDay: lpRoomPracticesTable.tenthOrderDay, ordersAllTime: lpRoomPracticesTable.ordersAllTime, ordersLastMonth: lpRoomPracticesTable.ordersLastMonth, ordersThisMonth: lpRoomPracticesTable.ordersThisMonth, kitSentAt: lpRoomPracticesTable.kitSentAt })
      .from(lpRoomPracticesTable)
      .where(eq(lpRoomPracticesTable.pageId, pageId))
      .limit(5000),
    db.select({ name: tenantsTable.name, domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1),
    db.select({ config: lpBrandSettingsTable.config }).from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1),
  ]);
  const likeRows = wins.length ? await db.select({ winId: lpRoomWinLikesTable.winId }).from(lpRoomWinLikesTable).where(inArray(lpRoomWinLikesTable.winId, wins.map((w) => w.id))) : [];
  const data = collectDigest(
    resolveRoomBlocks(page.blocks),
    {
      tasks: tasks.map((t) => ({ key: t.taskKey, at: t.completedAt, by: t.completedByName || t.completedByEmail })),
      requests: requests.map((q) => ({ subject: q.subject, status: q.status, updatedAt: q.updatedAt, createdAt: q.createdAt })),
      choices: choices.map((c) => ({ key: c.choiceKey, value: c.value })),
      wins: wins.map((w) => ({ body: w.body, headline: w.headline, by: w.authorName || (w.authorSide === "team" ? "The team" : "A team member"), likes: likeRows.filter((l) => l.winId === w.id).length, createdAt: w.createdAt, system: w.authorSide === "team" && !w.authorEmail.trim() })),
      practices: { total: practices.total, byStage: practices.byStage, rows: practiceRows, trend: practices.trend, byRegion: practices.byRegion, byWave: practices.byWave, scanners: practices.scanners, doctors: practices.doctors },
    },
    now,
  );
  if (!data) return null;
  const tenant = tenantRows[0];
  const brand = (brandRows[0]?.config ?? {}) as { primaryColor?: unknown; brandName?: unknown };
  const senderName = (typeof brand.brandName === "string" && brand.brandName.trim()) || tenant?.name || "Your partner";
  const roomUrl = tenant?.micrositeDomain ? `https://${tenant.micrositeDomain}/${page.slug}` : tenant?.domain ? `https://${tenant.domain}/lp/${page.slug}` : `/lp/${page.slug}`;
  const settings = settingsRows[0];
  const recipients = [...new Set((Array.isArray(settings?.digestRecipients) ? settings.digestRecipients : []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 50);
  // RevOps is told in the team's Slack digest (never in the customer email) while Salesforce is missing practices from the customer's list.
  const gap = await loadSalesforceGap(pageId).catch(() => null);
  const revops = revopsSlackLines(gap, slackMention(settingsRows[0]?.revopsSlackMention), data.partnerName);
  return {
    data,
    email: renderDigestEmail(data, { roomUrl, senderName, brandColor: typeof brand.primaryColor === "string" ? brand.primaryColor : undefined, now }),
    slack: renderDigestSlack(data, roomUrl, revops),
    recipients,
    roomUrl,
    tenantId,
    slackChannelId: settings?.slackChannelId ?? null,
    empty: digestIsEmpty(data),
    hasRevops: revops.length > 0,
  };
}

/**
 * Send a room's digest: the team's Slack post, and the email to each
 * customer recipient. `scheduled` sends claim the week first (an atomic
 * update of last_digest_at), so two app instances can never both send, and
 * skip a week with nothing to say. A manual send always goes.
 */
export async function sendRoomDigest(pageId: number, opts: { scheduled: boolean; now?: Date }): Promise<{ sent: boolean; emails: number; slack: boolean; reason?: string }> {
  if (opts.scheduled) {
    const claimed = await db
      .update(lpRoomSettingsTable)
      .set({ lastDigestAt: sql`now()` })
      .where(and(eq(lpRoomSettingsTable.pageId, pageId), eq(lpRoomSettingsTable.digestEnabled, true), sql`(${lpRoomSettingsTable.lastDigestAt} IS NULL OR ${lpRoomSettingsTable.lastDigestAt} < now() - interval '6 days')`))
      .returning({ pageId: lpRoomSettingsTable.pageId });
    if (claimed.length === 0) return { sent: false, emails: 0, slack: false, reason: "already sent this week" };
  }
  const digest = await buildRoomDigest(pageId, opts.now);
  if (!digest) return { sent: false, emails: 0, slack: false, reason: "not a workspace" };
  if (opts.scheduled && digest.empty && !digest.hasRevops) return { sent: false, emails: 0, slack: false, reason: "nothing to report" };
  const slack = await slackService.postMessage(digest.tenantId, { ...digest.slack, channelId: digest.slackChannelId ?? undefined }).catch(() => false);
  let emails = 0;
  // A scheduled send in a quiet week only went ahead for the RevOps item: Slack only, no customer email.
  for (const to of opts.scheduled && digest.empty ? [] : digest.recipients) {
    if (await sendRoomDigestEmail({ recipientEmail: to, subject: digest.email.subject, html: digest.email.html, tenantId: digest.tenantId })) emails++;
  }
  if (!opts.scheduled) await db.update(lpRoomSettingsTable).set({ lastDigestAt: sql`now()` }).where(eq(lpRoomSettingsTable.pageId, pageId));
  // Keep what went out, so the team can see what the customer was sent (only when an email actually went).
  if (emails > 0) await db.update(lpRoomSettingsTable).set({ lastDigestSubject: digest.email.subject.slice(0, 300), lastDigestHtml: digest.email.html }).where(eq(lpRoomSettingsTable.pageId, pageId)).catch(() => undefined);
  return { sent: true, emails, slack: !!slack };
}

/** Rooms due for a scheduled digest, and rooms with a connected sheet not read in the last 55 minutes. */
export async function roomsDueForWork(): Promise<{ digest: number[]; sheets: number[] }> {
  const rows = await db
    .select({ pageId: lpRoomSettingsTable.pageId, digestEnabled: lpRoomSettingsTable.digestEnabled, lastDigestAt: lpRoomSettingsTable.lastDigestAt, sheetId: lpRoomSettingsTable.practicesSheetId, syncedAt: lpRoomSettingsTable.practicesSyncedAt })
    .from(lpRoomSettingsTable)
    // A retired hub does no background work.
    .where(sql`${lpRoomSettingsTable.archivedAt} IS NULL`);
  const now = Date.now();
  return {
    digest: rows.filter((r) => r.digestEnabled && (!r.lastDigestAt || now - r.lastDigestAt.getTime() > 6 * 86_400_000)).map((r) => r.pageId),
    sheets: rows.filter((r) => r.sheetId && (!r.syncedAt || now - r.syncedAt.getTime() > 55 * 60_000)).map((r) => r.pageId),
  };
}

// Kept so unused-import checks stay quiet where a caller only needs contacts.
export { lpRoomContactsTable };
