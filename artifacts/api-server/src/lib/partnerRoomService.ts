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
import { doctorCountFromUpload, practiceNamesFromUpload, reconcilePractices } from "./partnerRoomReconcile";
import { lpRoomAutocreateAccountsTable, lpRoomAutocreateTable, lpRoomUploadsTable } from "@workspace/db";
import { accountKey, cleanAccountName } from "./partnerRoomNames";
import { roomSheetsRequest, sheetProblem } from "./partnerRoomSheets";
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

export interface PracticeSummary {
  total: number;
  byStage: Record<string, number>;
  regions: string[];
  scanners?: { total: number; practices: number };
  /** Per region: how many practices, and how many of them are live / trained or live. Largest first. */
  byRegion: { region: string; total: number; live: number; trained: number }[];
  waves: string[];
  /** One point per day the list was refreshed (oldest first, up to 120 days). */
  trend: PracticeTrendPoint[];
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
  const [waves, trend] = total
    ? await Promise.all([
        db.execute(sql`SELECT DISTINCT wave FROM lp_room_practices WHERE page_id = ${pageId} AND wave IS NOT NULL ORDER BY wave LIMIT 40`).then((r) => (r.rows as Array<{ wave: string }>).map((w) => w.wave)),
        db.select({ day: lpRoomPracticeSnapshotsTable.day, total: lpRoomPracticeSnapshotsTable.total, byStage: lpRoomPracticeSnapshotsTable.byStage }).from(lpRoomPracticeSnapshotsTable).where(eq(lpRoomPracticeSnapshotsTable.pageId, pageId)).orderBy(desc(lpRoomPracticeSnapshotsTable.day)).limit(120),
      ])
    : [[], []];
  return {
    total,
    byStage,
    regions: [...regions.keys()].sort(),
    ...(sc && sc.known > 0 ? { scanners: { total: sc.total, practices: sc.practices } } : {}),
    byRegion: [...regions.values()].sort((a, b) => b.total - a.total || a.region.localeCompare(b.region)).slice(0, 60),
    waves,
    trend: trend.reverse(),
  };
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

/** Add or update practices: matched by Salesforce id when given, else by name. A row that says nothing about the stage keeps the saved one. */
export async function upsertPractices(page: { id: number; tenantId: number }, rows: RoomPracticeInput[], opts: { mirror?: boolean } = {}): Promise<{ added: number; updated: number; removed: number }> {
  const existing = await db.select({ id: lpRoomPracticesTable.id, externalId: lpRoomPracticesTable.externalId, name: lpRoomPracticesTable.name }).from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, page.id));
  const byExt = new Map(existing.filter((e) => e.externalId).map((e) => [e.externalId as string, e.id]));
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));
  const inserts: (typeof lpRoomPracticesTable.$inferInsert)[] = [];
  let updated = 0;
  for (const r of rows) {
    const id = (r.externalId && byExt.get(r.externalId)) || byName.get(r.name.trim().toLowerCase());
    if (id) {
      await db
        .update(lpRoomPracticesTable)
        .set({
          name: r.name,
          ...(r.externalId ? { externalId: r.externalId } : {}),
          ...(r.region ? { region: r.region } : {}),
          ...(r.city ? { city: r.city } : {}),
          ...(r.state ? { state: r.state } : {}),
          ...(r.wave ? { wave: r.wave } : {}),
          ...(r.stageGiven ? { stage: r.stage } : {}),
          ...(r.trainingDate ? { trainingDate: r.trainingDate } : {}),
          ...(r.liveDate ? { liveDate: r.liveDate } : {}),
          ...(r.scannerSent ? { scannerSent: r.scannerSent } : {}),
          ...(r.scannerActivated ? { scannerActivated: r.scannerActivated } : {}),
          ...(r.regionalManager ? { regionalManager: r.regionalManager } : {}),
          ...(r.scannerCount != null ? { scannerCount: r.scannerCount } : {}),
          ...(r.scannerModels ? { scannerModels: r.scannerModels } : {}),
          ...(r.scannerBrand ? { scannerBrand: r.scannerBrand } : {}),
          ...(r.contractSigned ? { contractSigned: r.contractSigned } : {}),
          ...(r.sourceStatus ? { sourceStatus: r.sourceStatus } : {}),
          ...(r.owner ? { owner: r.owner } : {}),
          ...(r.lastActivity ? { lastActivity: r.lastActivity } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(lpRoomPracticesTable.id, id));
      updated++;
    } else {
      inserts.push({ tenantId: page.tenantId, pageId: page.id, externalId: r.externalId, name: r.name, region: r.region, city: r.city, state: r.state, wave: r.wave, stage: r.stage, trainingDate: r.trainingDate, liveDate: r.liveDate, scannerSent: r.scannerSent, scannerActivated: r.scannerActivated, regionalManager: r.regionalManager, scannerCount: r.scannerCount, scannerModels: r.scannerModels, scannerBrand: r.scannerBrand ?? null, contractSigned: r.contractSigned ?? null, sourceStatus: r.sourceStatus ?? null, owner: r.owner ?? null, lastActivity: r.lastActivity ?? null });
      byName.set(r.name.trim().toLowerCase(), -1);
      if (r.externalId) byExt.set(r.externalId, -1);
    }
  }
  for (let i = 0; i < inserts.length; i += 200) await db.insert(lpRoomPracticesTable).values(inserts.slice(i, i + 200));
  // Mirror mode (a connected sheet is the source of truth): drop practices the source no longer lists.
  let removed = 0;
  if (opts.mirror) {
    const keep = new Set(rows.map((r) => r.name.trim().toLowerCase()));
    const gone = existing.filter((e) => !keep.has(e.name.trim().toLowerCase())).map((e) => e.id);
    for (let i = 0; i < gone.length; i += 500) await db.delete(lpRoomPracticesTable).where(inArray(lpRoomPracticesTable.id, gone.slice(i, i + 500)));
    removed = gone.length;
  }
  // Today's counts, for the scorecard's trend. Never worth failing a refresh over.
  await recordPracticeSnapshot(page).catch((err) => logger.warn({ err, pageId: page.id }, "practice snapshot failed"));
  return { added: inserts.length, updated, removed };
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
    const range = encodeURIComponent(tab ? `'${tab.replace(/'/g, "''")}'!A1:AZ20001` : "A1:AZ20001");
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
  const roomNames = (await db.select({ name: lpRoomPracticesTable.name }).from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, pageId))).map((p) => p.name);
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
  const [settingsRows, tasks, requests, choices, wins, practices, tenantRows, brandRows] = await Promise.all([
    db.select().from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1),
    db.select().from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, pageId)),
    db.select().from(lpRoomRequestsTable).where(eq(lpRoomRequestsTable.pageId, pageId)),
    db.select().from(lpRoomChoicesTable).where(eq(lpRoomChoicesTable.pageId, pageId)),
    db.select().from(lpRoomWinsTable).where(eq(lpRoomWinsTable.pageId, pageId)),
    practiceSummary(pageId),
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
      wins: wins.map((w) => ({ body: w.body, headline: w.headline, by: w.authorName || (w.authorSide === "team" ? "The team" : "A team member"), likes: likeRows.filter((l) => l.winId === w.id).length, createdAt: w.createdAt })),
      practices,
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
    email: renderDigestEmail(data, { roomUrl, senderName, brandColor: typeof brand.primaryColor === "string" ? brand.primaryColor : undefined }),
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
  return { sent: true, emails, slack: !!slack };
}

/** Rooms due for a scheduled digest, and rooms with a connected sheet not read in the last 55 minutes. */
export async function roomsDueForWork(): Promise<{ digest: number[]; sheets: number[] }> {
  const rows = await db
    .select({ pageId: lpRoomSettingsTable.pageId, digestEnabled: lpRoomSettingsTable.digestEnabled, lastDigestAt: lpRoomSettingsTable.lastDigestAt, sheetId: lpRoomSettingsTable.practicesSheetId, syncedAt: lpRoomSettingsTable.practicesSyncedAt })
    .from(lpRoomSettingsTable);
  const now = Date.now();
  return {
    digest: rows.filter((r) => r.digestEnabled && (!r.lastDigestAt || now - r.lastDigestAt.getTime() > 6 * 86_400_000)).map((r) => r.pageId),
    sheets: rows.filter((r) => r.sheetId && (!r.syncedAt || now - r.syncedAt.getTime() > 55 * 60_000)).map((r) => r.pageId),
  };
}

// Kept so unused-import checks stay quiet where a caller only needs contacts.
export { lpRoomContactsTable };
