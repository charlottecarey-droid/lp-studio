/**
 * Partner rooms — work shared by the routes and the background poller:
 * the practice list (upsert, summary, reading a connected Google Sheet) and
 * the weekly digest (collect, render, send).
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  db,
  lpPagesTable,
  lpBrandSettingsTable,
  lpRoomChoicesTable,
  lpRoomContactsTable,
  lpRoomPracticesTable,
  lpRoomRequestsTable,
  lpRoomSettingsTable,
  lpRoomTaskStateTable,
  lpRoomWinLikesTable,
  lpRoomWinsTable,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { parsePracticeRow, type RoomPracticeInput } from "./partnerRoom";
import { collectDigest, digestIsEmpty, renderDigestEmail, renderDigestSlack, type DigestData } from "./partnerRoomDigest";
import { sendRoomDigestEmail } from "./notifications";
import { slackService } from "./slack-service";

/** Practice counts by stage and the list of regions: safe for any visitor (no practice names). */
export async function practiceSummary(pageId: number): Promise<{ total: number; byStage: Record<string, number>; regions: string[] }> {
  const rows = (await db.execute(sql`SELECT stage, region, COUNT(*)::int AS n FROM lp_room_practices WHERE page_id = ${pageId} GROUP BY stage, region`)).rows as Array<{ stage: string; region: string | null; n: number }>;
  const byStage: Record<string, number> = {};
  const regions = new Set<string>();
  let total = 0;
  for (const r of rows) {
    byStage[r.stage] = (byStage[r.stage] ?? 0) + r.n;
    total += r.n;
    if (r.region) regions.add(r.region);
  }
  return { total, byStage, regions: [...regions].sort() };
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
          updatedAt: sql`now()`,
        })
        .where(eq(lpRoomPracticesTable.id, id));
      updated++;
    } else {
      inserts.push({ tenantId: page.tenantId, pageId: page.id, externalId: r.externalId, name: r.name, region: r.region, city: r.city, state: r.state, wave: r.wave, stage: r.stage, trainingDate: r.trainingDate, liveDate: r.liveDate });
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

/** Sheet values (first row = column names) → practice rows. */
export function practicesFromSheetValues(values: unknown): RoomPracticeInput[] {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = (values[0] as unknown[]).map((h) => String(h ?? "").trim().toLowerCase());
  const out: RoomPracticeInput[] = [];
  const seen = new Set<string>();
  for (const raw of values.slice(1, 10_001)) {
    if (!Array.isArray(raw)) continue;
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

let connectors: ReplitConnectors | null = null;

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
    connectors ??= new ReplitConnectors();
    const range = encodeURIComponent(tab ? `'${tab.replace(/'/g, "''")}'!A1:Z10001` : "A1:Z10001");
    const resp = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}/values/${range}`, { method: "GET" });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      logger.warn({ pageId, status: resp.status, body: body.slice(0, 300) }, "room practices sheet read failed");
      return finish(false, resp.status === 403 || resp.status === 404 ? "Couldn't open the sheet. Share it with the Google account connected to LP Studio, and check the tab name." : `Google Sheets returned an error (${resp.status}).`);
    }
    const rows = practicesFromSheetValues(((await resp.json()) as { values?: unknown }).values);
    if (rows.length === 0) return finish(false, "The sheet has no rows with a practice name. The first row needs column names, including “name”.");
    const r = await upsertPractices({ id: pageId, tenantId: settings.tenantId }, rows, { mirror: true });
    return finish(true, `${rows.length} practices in the sheet (${r.added} added, ${r.updated} updated, ${r.removed} removed).`);
  } catch (err) {
    logger.error({ err, pageId }, "room practices sheet sync failed");
    return finish(false, "Couldn't reach Google Sheets.");
  }
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
    page.blocks,
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
  return {
    data,
    email: renderDigestEmail(data, { roomUrl, senderName, brandColor: typeof brand.primaryColor === "string" ? brand.primaryColor : undefined }),
    slack: renderDigestSlack(data, roomUrl),
    recipients,
    roomUrl,
    tenantId,
    slackChannelId: settings?.slackChannelId ?? null,
    empty: digestIsEmpty(data),
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
  if (opts.scheduled && digest.empty) return { sent: false, emails: 0, slack: false, reason: "nothing to report" };
  const slack = await slackService.postMessage(digest.tenantId, { ...digest.slack, channelId: digest.slackChannelId ?? undefined }).catch(() => false);
  let emails = 0;
  for (const to of digest.recipients) {
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
