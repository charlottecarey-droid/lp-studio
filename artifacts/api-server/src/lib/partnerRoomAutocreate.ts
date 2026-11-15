/**
 * Partner rooms created automatically.
 *
 * A workspace points at a sheet tab listing its signed accounts (a Salesforce
 * report such as "Accounts with MSAs Signed"). The first read records the
 * accounts already there, without making anything. After that, each account
 * that appears on the tab gets a DRAFT room built from the Partner Launch Room
 * template with the account's name filled in and the workspace's standard
 * guides attached, and the team is told in Slack. Nothing is published: a
 * person reviews the draft first.
 *
 * Read through the workspace's Google Sheets connection, like the practices
 * sheet. A room is made once per account (claimed by a unique row, so two app
 * instances reading at the same moment cannot both create it).
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, lpPagesTable, lpRoomAutocreateAccountsTable, lpRoomAutocreateTable, lpRoomSettingsTable, lpRoomStandardAssetsTable } from "@workspace/db";
import { logger } from "./logger";
import { ROOM_STANDARD_ASSETS, setRoomKitAsset } from "./partnerRoom";
import { SHEET_ID_RE, SHEET_TAB_RE, syncPracticesFromSheet } from "./partnerRoomService";
import { slackService } from "./slack-service";
import { buildPartnerWorkspaceBlocks } from "../seeds/partnerLaunchRoomTemplate";

/* ── Pure helpers ────────────────────────────────────────────────────────── */

const DECORATION = /\s*(?:[-–—]\s*)?\(?\b(?:enterprise|national|dso|parent|hq)\b\)?\s*$/i;

/**
 * A Salesforce account name as a customer would write it: the trailing
 * bookkeeping words are dropped ("Heartland Dental-HQ", "Smile Brands DSO
 * Enterprise Parent", "PepperPointe Partnerships - National DSO").
 */
export function cleanAccountName(raw: unknown): string {
  let name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  for (let i = 0; i < 6; i++) {
    const next = name.replace(DECORATION, "").replace(/[\s\-–—]+$/, "").trim();
    // Never strip a name down to nothing or to a single short word.
    if (next === name || next.length < 3) break;
    name = next;
  }
  return name.slice(0, 120);
}

/** One account, however it is decorated or capitalised. */
export function accountKey(name: string): string {
  return cleanAccountName(name).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 120);
}

export interface SignedAccount {
  key: string;
  name: string;
  signedDate: string | null;
  owner: string | null;
  /** The account's Salesforce id (15 or 18 characters), when the tab has an id column. */
  sfdcId: string | null;
}

const ID_HEADERS = ["account id", "account id (18)", "18 digit id", "account 18 digit id", "account: account id", "salesforce id", "sfdc id", "sfdc account id", "id"];

/** Sheet values (first row = column names) → the signed accounts on it. Needs an "Account Name" column. Null when there isn't one. */
export function signedAccountsFromSheet(values: unknown): SignedAccount[] | null {
  if (!Array.isArray(values) || !Array.isArray(values[0])) return null;
  const head = (values[0] as unknown[]).map((h) => String(h ?? "").trim().toLowerCase());
  const nameAt = head.findIndex((h) => h === "account name" || h === "account" || h === "name");
  if (nameAt < 0) return null;
  const dateAt = head.findIndex((h) => h.startsWith("contract signed") || h === "msa signed date" || h === "signed date");
  const ownerAt = head.findIndex((h) => h === "account owner" || h === "owner");
  const idAt = head.findIndex((h) => ID_HEADERS.includes(h));
  const out: SignedAccount[] = [];
  const seen = new Set<string>();
  for (const row of values.slice(1, 5001)) {
    if (!Array.isArray(row)) continue;
    const name = cleanAccountName(row[nameAt]);
    const key = accountKey(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    const cell = (at: number) => (at >= 0 && typeof row[at] === "string" && row[at].trim() ? row[at].trim().slice(0, 80) : at >= 0 && typeof row[at] === "number" ? String(row[at]) : null);
    const id = cell(idAt);
    out.push({ key, name, signedDate: cell(dateAt), owner: cell(ownerAt), sfdcId: id && /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(id) ? id : null });
  }
  return out;
}

export const roomSlugFor = (name: string) => `${accountKey(name).slice(0, 60).replace(/-+$/, "") || "partner"}-room`;

/* ── Creating a room ─────────────────────────────────────────────────────── */

/** The blocks of a new room for an account: the template with the name set (its text follows the name), plus the workspace's standard guides. */
export function roomBlocksForAccount(name: string, slug: string, standard: { assetKey: string; fileUrl: string }[]): unknown[] {
  let blocks: unknown[] = buildPartnerWorkspaceBlocks({ slug, partner: "[Partner name]", partnerShort: "[Partner]" }).map((b) => (b.type === "room-workspace" ? { ...b, props: { ...b.props, partnerName: name, partnerShort: "" } } : b));
  for (const spec of ROOM_STANDARD_ASSETS) {
    const file = standard.find((s) => s.assetKey === spec.key);
    const next = file ? setRoomKitAsset(blocks, { key: spec.key, kind: "pdf", title: spec.title, description: spec.description, fileUrl: file.fileUrl }) : null;
    if (next) blocks = next;
  }
  return blocks;
}

async function freeSlug(tenantId: number, base: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db.select({ id: lpPagesTable.id }).from(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug))).limit(1);
    if (!hit) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Point a room's practice list at the workbook's locations tab, filtered to
 * this account by its Salesforce id (the tab needs a "Parent Account ID"
 * column). Fills only what is still empty, so anything a person set by hand
 * on the room stays. Returns true when the room is now linked.
 */
export async function linkRoomPractices(tenantId: number, pageId: number, sfdcId: string | null, sheetId: string | null, practicesTab: string | null): Promise<boolean> {
  if (!sfdcId || !sheetId || !practicesTab) return false;
  await db
    .insert(lpRoomSettingsTable)
    .values({ pageId, tenantId, sfdcAccountId: sfdcId, practicesSheetId: sheetId, practicesSheetTab: practicesTab })
    .onConflictDoUpdate({
      target: lpRoomSettingsTable.pageId,
      set: {
        sfdcAccountId: sql`COALESCE(${lpRoomSettingsTable.sfdcAccountId}, ${sfdcId})`,
        practicesSheetId: sql`COALESCE(${lpRoomSettingsTable.practicesSheetId}, ${sheetId})`,
        practicesSheetTab: sql`CASE WHEN ${lpRoomSettingsTable.practicesSheetId} IS NULL THEN ${practicesTab} ELSE ${lpRoomSettingsTable.practicesSheetTab} END`,
      },
    });
  return true;
}

/** Make the draft room for an account that has none yet. Returns the page id, or null when another reader already made it. */
export async function createRoomForAccount(tenantId: number, account: SignedAccount, opts: { claimed?: boolean } = {}): Promise<number | null> {
  if (!opts.claimed) {
    // Claim the account first: only the one that updates a still-empty row goes on to create the page.
    const claim = await db
      .insert(lpRoomAutocreateAccountsTable)
      .values({ tenantId, accountKey: account.key, accountName: account.name, signedDate: account.signedDate, owner: account.owner, sfdcAccountId: account.sfdcId, pageId: -1 })
      .onConflictDoUpdate({ target: [lpRoomAutocreateAccountsTable.tenantId, lpRoomAutocreateAccountsTable.accountKey], set: { pageId: -1 }, setWhere: sql`${lpRoomAutocreateAccountsTable.pageId} IS NULL` })
      .returning({ id: lpRoomAutocreateAccountsTable.id });
    if (claim.length === 0) return null;
  }
  try {
    const slug = await freeSlug(tenantId, roomSlugFor(account.name));
    const standard = await db.select({ assetKey: lpRoomStandardAssetsTable.assetKey, fileUrl: lpRoomStandardAssetsTable.fileUrl }).from(lpRoomStandardAssetsTable).where(eq(lpRoomStandardAssetsTable.tenantId, tenantId));
    const [page] = await db
      .insert(lpPagesTable)
      .values({ tenantId, title: `${account.name} Partner Room`, slug, blocks: roomBlocksForAccount(account.name, slug, standard) as never, status: "draft", createdBy: "automatic rooms" })
      .returning({ id: lpPagesTable.id });
    await db.update(lpRoomAutocreateAccountsTable).set({ pageId: page.id }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, account.key)));
    // Its practices come from the workbook's locations tab, by the account's Salesforce id. Best effort: the room exists either way.
    const [cfg] = await db.select({ sheetId: lpRoomAutocreateTable.sheetId, practicesTab: lpRoomAutocreateTable.practicesTab }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
    const linked = await linkRoomPractices(tenantId, page.id, account.sfdcId, cfg?.sheetId ?? null, cfg?.practicesTab ?? null).catch(() => false);
    if (linked) await syncPracticesFromSheet(page.id).catch((err) => logger.warn({ err, pageId: page.id }, "first practices read for an automatic room failed"));
    return page.id;
  } catch (err) {
    // Release the claim so the next read tries again.
    await db.update(lpRoomAutocreateAccountsTable).set({ pageId: null }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, account.key), eq(lpRoomAutocreateAccountsTable.pageId, -1)));
    throw err;
  }
}

/* ── Reading the sheet ───────────────────────────────────────────────────── */

let connectors: ReplitConnectors | null = null;
/** A reshuffled or renamed sheet could make many accounts look new at once; make a few rooms per read and say so. */
const MAX_ROOMS_PER_READ = 5;

export async function syncRoomAutocreate(tenantId: number): Promise<{ ok: boolean; note: string; created: { name: string; pageId: number }[] }> {
  const [cfg] = await db.select().from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
  if (!cfg?.enabled || !cfg.sheetId || !SHEET_ID_RE.test(cfg.sheetId)) return { ok: false, note: "Automatic rooms are off.", created: [] };
  const finish = async (ok: boolean, note: string, created: { name: string; pageId: number }[] = []) => {
    await db.update(lpRoomAutocreateTable).set({ syncedAt: sql`now()`, syncNote: note.slice(0, 300) }).where(eq(lpRoomAutocreateTable.tenantId, tenantId));
    return { ok, note, created };
  };
  try {
    connectors ??= new ReplitConnectors();
    const tab = cfg.sheetTab && SHEET_TAB_RE.test(cfg.sheetTab) ? cfg.sheetTab : "";
    const range = encodeURIComponent(tab ? `'${tab.replace(/'/g, "''")}'!A1:Z5001` : "A1:Z5001");
    const resp = await connectors.proxy("google-sheet", `/v4/spreadsheets/${cfg.sheetId}/values/${range}`, { method: "GET" });
    if (!resp.ok) {
      logger.warn({ tenantId, status: resp.status }, "room autocreate sheet read failed");
      return finish(false, resp.status === 403 || resp.status === 404 ? "Couldn't open the sheet. Share it with the Google account connected to LP Studio, and check the tab name." : `Google Sheets returned an error (${resp.status}).`);
    }
    const accounts = signedAccountsFromSheet(((await resp.json()) as { values?: unknown }).values);
    if (!accounts) return finish(false, "The tab needs an “Account Name” column in its first row.");
    const known = await db.select({ key: lpRoomAutocreateAccountsTable.accountKey, sfdcId: lpRoomAutocreateAccountsTable.sfdcAccountId, pageId: lpRoomAutocreateAccountsTable.pageId }).from(lpRoomAutocreateAccountsTable).where(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId));
    const knownKeys = new Set(known.map((k) => k.key));
    // An id column added to the tab later: remember each account's id, and link the practices of rooms made here.
    for (const a of accounts) {
      const row = known.find((k) => k.key === a.key);
      if (!row || row.sfdcId || !a.sfdcId) continue;
      await db.update(lpRoomAutocreateAccountsTable).set({ sfdcAccountId: a.sfdcId }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, a.key)));
      if (row.pageId && row.pageId > 0) await linkRoomPractices(tenantId, row.pageId, a.sfdcId, cfg.sheetId, cfg.practicesTab).catch(() => false);
    }
    const fresh = accounts.filter((a) => !knownKeys.has(a.key));

    // First read: everything already on the list is recorded, and nothing is created.
    if (known.length === 0) {
      for (const a of accounts) {
        await db.insert(lpRoomAutocreateAccountsTable).values({ tenantId, accountKey: a.key, accountName: a.name, signedDate: a.signedDate, owner: a.owner, sfdcAccountId: a.sfdcId }).onConflictDoNothing();
      }
      return finish(true, `${accounts.length} accounts already on the list were recorded. A room will be created for each account added from now on.`);
    }

    const created: { name: string; pageId: number }[] = [];
    for (const a of fresh.slice(0, MAX_ROOMS_PER_READ)) {
      const pageId = await createRoomForAccount(tenantId, a).catch((err) => {
        logger.error({ err, tenantId, account: a.name }, "automatic room creation failed");
        return null;
      });
      if (pageId) created.push({ name: a.name, pageId });
    }
    if (created.length) {
      const safe = (s: string) => s.replace(/[<>&*_~`]/g, " ");
      await slackService
        .postMessage(tenantId, { text: `Partner room created: ${created.map((c) => c.name).join(", ")}`, blocks: [{ type: "section", text: { type: "mrkdwn", text: `🚪 *Partner room${created.length === 1 ? "" : "s"} created as a draft:* ${created.map((c) => safe(c.name)).join(", ")}\nNew on the signed-accounts sheet. Open the page in LP Studio to add the logo, kickoff date and team, create the launch kit, then publish.` } }] })
        .catch(() => false);
    }
    const waiting = fresh.length - created.length;
    return finish(true, `${accounts.length} accounts on the list${created.length ? ` · created ${created.length} room${created.length === 1 ? "" : "s"}: ${created.map((c) => c.name).join(", ")}` : " · nothing new"}${waiting > 0 ? ` · ${waiting} more will be created on the next reads` : ""}.`, created);
  } catch (err) {
    logger.error({ err, tenantId }, "room autocreate sync failed");
    return finish(false, "Couldn't reach Google Sheets.");
  }
}

/** Workspaces whose signed-accounts sheet was last read more than 55 minutes ago. */
export async function autocreateDue(now: number = Date.now()): Promise<number[]> {
  const rows = await db.select({ tenantId: lpRoomAutocreateTable.tenantId, syncedAt: lpRoomAutocreateTable.syncedAt }).from(lpRoomAutocreateTable).where(and(eq(lpRoomAutocreateTable.enabled, true), isNotNull(lpRoomAutocreateTable.sheetId)));
  return rows.filter((r) => !r.syncedAt || now - r.syncedAt.getTime() > 55 * 60_000).map((r) => r.tenantId);
}
