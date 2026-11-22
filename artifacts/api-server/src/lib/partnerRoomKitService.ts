/**
 * Welcome kits: add the practices a team member ticked to the marketing
 * team's recipient sheet, and remember which practices are on it so none is
 * added twice.
 */
import { db, lpRoomAutocreateTable, lpRoomPracticesTable } from "@workspace/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { DEFAULT_KIT_TAB, kitRows, planKits, type KitPractice } from "./partnerRoomKit";
import { SHEET_ID_RE, SHEET_TAB_RE } from "./partnerRoomService";
import { roomSheetsRequest, sheetProblem } from "./partnerRoomSheets";

export interface KitTarget {
  sheetId: string;
  tab: string;
  url: string;
}

/** Where the workspace keeps its welcome kit list: its own setting, else a "Send Welcome Kits" tab in the hub log workbook. */
export async function kitTarget(tenantId: number): Promise<KitTarget | null> {
  const [cfg] = await db.select({ kitSheetId: lpRoomAutocreateTable.kitSheetId, kitTab: lpRoomAutocreateTable.kitTab, logSheetId: lpRoomAutocreateTable.logSheetId, sheetId: lpRoomAutocreateTable.sheetId }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
  // Unset = the workbook the hub log is in (the "Digital Sales Rooms" sheet); with no log sheet, the one the practices are read from.
  const sheetId = cfg?.kitSheetId || cfg?.logSheetId || cfg?.sheetId || "";
  if (!SHEET_ID_RE.test(sheetId)) return null;
  const tab = cfg?.kitTab && SHEET_TAB_RE.test(cfg.kitTab) ? cfg.kitTab : DEFAULT_KIT_TAB;
  return { sheetId, tab, url: `https://docs.google.com/spreadsheets/d/${sheetId}` };
}

export interface KitResult {
  ok: boolean;
  error?: string;
  /** Names, so the page can say exactly what will happen (or happened). */
  sent: string[];
  already: string[];
  noAddress: string[];
  sheetUrl?: string;
}

const range = (tab: string, cells: string) => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${cells}`);

/**
 * Add the ticked practices to the welcome kit list. `dryRun` only says what
 * would happen. Practices already on the list, and ones with no full mailing
 * address, are left out and named. A practice is marked as sent only after its
 * row is in the sheet.
 */
export async function sendWelcomeKits(page: { id: number; tenantId: number; partnerName: string }, opts: { ids: number[]; by: string; sfdcAccountId: string | null; dryRun: boolean; now?: Date }): Promise<KitResult> {
  const rows = await db
    .select({ id: lpRoomPracticesTable.id, externalId: lpRoomPracticesTable.externalId, name: lpRoomPracticesTable.name, address: lpRoomPracticesTable.address, city: lpRoomPracticesTable.city, state: lpRoomPracticesTable.state, zip: lpRoomPracticesTable.zip, phone: lpRoomPracticesTable.phone, owner: lpRoomPracticesTable.owner, kitSentAt: lpRoomPracticesTable.kitSentAt })
    .from(lpRoomPracticesTable)
    .where(and(eq(lpRoomPracticesTable.pageId, page.id), inArray(lpRoomPracticesTable.id, opts.ids)))
    .orderBy(lpRoomPracticesTable.name)
    .limit(2000);
  const plan = planKits(rows as KitPractice[]);
  const names = { sent: plan.send.map((p) => p.name), already: plan.already.map((p) => p.name), noAddress: plan.noAddress.map((p) => p.name) };
  const target = await kitTarget(page.tenantId);
  if (!target) return { ok: false, error: "No welcome kit sheet is set. Add its link in Settings → Partnerships.", ...names };
  if (opts.dryRun || plan.send.length === 0) return { ok: true, ...names, sheetUrl: target.url };

  const json = { headers: { "Content-Type": "application/json" } };
  const meta = await roomSheetsRequest(page.tenantId, `/v4/spreadsheets/${target.sheetId}?fields=sheets(properties(title))`);
  if (!meta.ok) return { ok: false, error: sheetProblem(meta.status, meta.sharedWith, "", "edit"), ...names };
  const cantEdit = `${meta.sharedWith} can view the welcome kit sheet but not edit it. Share it as an Editor.`;
  const exists = (((await meta.json()) as { sheets?: { properties?: { title?: string } }[] }).sheets ?? []).some((s) => s.properties?.title === target.tab);
  if (!exists) {
    const add = await roomSheetsRequest(page.tenantId, `/v4/spreadsheets/${target.sheetId}:batchUpdate`, { method: "POST", ...json, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: target.tab } } }] }) });
    if (!add.ok) return { ok: false, error: add.status === 403 ? cantEdit : `Couldn't add the “${target.tab}” tab (${add.status}).`, ...names };
  }
  // The tab's own column names decide where each value goes.
  let existing: unknown[] | null = null;
  if (exists) {
    const head = await roomSheetsRequest(page.tenantId, `/v4/spreadsheets/${target.sheetId}/values/${range(target.tab, "1:1")}`);
    if (!head.ok) return { ok: false, error: `Couldn't read the welcome kit tab (${head.status}).`, ...names };
    existing = (((await head.json()) as { values?: unknown[][] }).values ?? [])[0] ?? null;
  }
  const date = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const built = kitRows(existing, plan.send, { parentAccount: page.partnerName, parentAccountId: opts.sfdcAccountId, date });
  if (built.headersChanged) {
    const put = await roomSheetsRequest(page.tenantId, `/v4/spreadsheets/${target.sheetId}/values/${range(target.tab, "1:1")}?valueInputOption=RAW`, { method: "PUT", ...json, body: JSON.stringify({ values: [built.headers] }) });
    if (!put.ok) return { ok: false, error: put.status === 403 ? cantEdit : `Couldn't write the column names (${put.status}).`, ...names };
  }
  const append = await roomSheetsRequest(page.tenantId, `/v4/spreadsheets/${target.sheetId}/values/${range(target.tab, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", ...json, body: JSON.stringify({ values: built.rows }) });
  if (!append.ok) return { ok: false, error: append.status === 403 ? cantEdit : `Couldn't add the rows (${append.status}).`, ...names };
  // Only now are they on the list. `kit_sent_at IS NULL` keeps two people clicking at once from stamping twice.
  await db
    .update(lpRoomPracticesTable)
    .set({ kitSentAt: opts.now ?? new Date(), kitSentBy: opts.by.slice(0, 160), updatedAt: sql`now()` })
    .where(and(eq(lpRoomPracticesTable.pageId, page.id), inArray(lpRoomPracticesTable.id, plan.send.map((p) => p.id)), isNull(lpRoomPracticesTable.kitSentAt)));
  return { ok: true, ...names, sheetUrl: target.url };
}
