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
import { appUsersTable, db, lpPagesTable, lpRoomAutocreateAccountsTable, lpRoomAutocreateTable, lpRoomSettingsTable, lpRoomStandardAssetsTable, tenantMembersTable, tenantsTable } from "@workspace/db";
import { sendRoomDigestEmail } from "./notifications";
import { sfdcService } from "./sfdc-service";
import { WILDCARD_BASE_HOSTS } from "./tenantHosts";
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
export async function createRoomForAccount(tenantId: number, account: SignedAccount, opts: { claimed?: boolean; test?: boolean } = {}): Promise<number | null> {
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
    const slug = await freeSlug(tenantId, opts.test ? roomSlugFor(account.name).replace(/-room$/, "-test-room") : roomSlugFor(account.name));
    const standard = await db.select({ assetKey: lpRoomStandardAssetsTable.assetKey, fileUrl: lpRoomStandardAssetsTable.fileUrl }).from(lpRoomStandardAssetsTable).where(eq(lpRoomStandardAssetsTable.tenantId, tenantId));
    const [page] = await db
      .insert(lpPagesTable)
      .values({ tenantId, title: `${account.name} Partner Room${opts.test ? " (test)" : ""}`, slug, blocks: roomBlocksForAccount(account.name, slug, standard) as never, status: "draft", createdBy: "automatic rooms" })
      .returning({ id: lpPagesTable.id });
    await db.update(lpRoomAutocreateAccountsTable).set({ pageId: page.id }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, account.key)));
    // Its practices come from the workbook's locations tab, by the account's Salesforce id. Best effort: the room exists either way.
    const [cfg] = await db.select({ sheetId: lpRoomAutocreateTable.sheetId, practicesTab: lpRoomAutocreateTable.practicesTab }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
    const linked = await linkRoomPractices(tenantId, page.id, account.sfdcId, cfg?.sheetId ?? null, cfg?.practicesTab ?? null).catch(() => false);
    if (linked) await syncPracticesFromSheet(page.id).catch((err) => logger.warn({ err, pageId: page.id }, "first practices read for an automatic room failed"));
    // Alerts, the sheet log and the Salesforce field. A test run does these itself so it can report each one.
    if (!opts.test) await afterRoomCreated(tenantId, account, page.id).catch((err) => logger.warn({ err, pageId: page.id }, "follow-ups for an automatic room failed"));
    return page.id;
  } catch (err) {
    // Release the claim so the next read tries again.
    await db.update(lpRoomAutocreateAccountsTable).set({ pageId: null }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, account.key), eq(lpRoomAutocreateAccountsTable.pageId, -1)));
    throw err;
  }
}

/* ── After a room is created: alerts, the sheet log, Salesforce ──────────── */

export const DEFAULT_ROOM_LOG_TAB = "Digital Sales Rooms";
export const ROOM_LOG_HEADERS = ["Created", "Account", "Status", "Room link", "Edit link", "Account owner", "Contract signed", "Salesforce ID", "Note"];
const SFDC_FIELD_RE = /^[A-Za-z][A-Za-z0-9_]{0,78}$/;
export const isSfdcFieldName = (v: string) => SFDC_FIELD_RE.test(v);

/** The row a new room adds to the log tab. Plain values only (written RAW, so a name can never run as a formula). */
export function roomLogRow(account: SignedAccount, links: { room: string; edit: string }, opts: { test?: boolean; now?: Date } = {}): string[] {
  return [(opts.now ?? new Date()).toISOString().slice(0, 10), account.name, "Draft", links.room, links.edit, account.owner ?? "", account.signedDate ?? "", account.sfdcId ?? "", opts.test ? "Test run" : ""];
}

const escHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function roomCreatedEmail(account: SignedAccount, links: { room: string; edit: string }, opts: { test?: boolean } = {}): { subject: string; html: string } {
  const name = escHtml(account.name);
  return {
    subject: `${opts.test ? "[Test] " : ""}New partner room: ${account.name}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#18201c;max-width:560px">
<p style="margin:0 0 12px"><strong>A partner room was created for ${name}.</strong>${opts.test ? " This is a test run." : ""}</p>
<p style="margin:0 0 12px">It is a draft: nobody outside your team can see it yet. Add the logo, kickoff date and team, check the launch kit, then publish.</p>
<p style="margin:0 0 16px"><a href="${escHtml(links.edit)}" style="display:inline-block;background:#18201c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open the room</a></p>
<p style="margin:0;color:#68726c;font-size:13px">${[account.owner ? `Account owner: ${escHtml(account.owner)}` : "", account.signedDate ? `Contract signed: ${escHtml(account.signedDate)}` : "", `Customer link once published: ${escHtml(links.room)}`].filter(Boolean).join("<br>")}</p>
</div>`,
  };
}

export interface RoomFollowUps {
  alerts: { sent: string[]; ownerMatched: boolean | null } | null;
  sheet: { ok: boolean; note: string } | null;
  sfdc: { ok: boolean; note: string } | null;
}

async function appendRoomLog(sheetId: string, tab: string, row: string[]): Promise<void> {
  connectors ??= new ReplitConnectors();
  const meta = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}?fields=sheets(properties(title))`, { method: "GET" });
  if (!meta.ok) throw new Error(meta.status === 403 || meta.status === 404 ? "Couldn't open the sheet. It must be shared with edit access with the Google account connected to LP Studio." : `Google Sheets returned ${meta.status}`);
  const exists = (((await meta.json()) as { sheets?: { properties?: { title?: string } }[] }).sheets ?? []).some((s) => s.properties?.title === tab);
  const json = { method: "POST", headers: { "Content-Type": "application/json" } };
  if (!exists) {
    const add = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}:batchUpdate`, { ...json, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
    if (!add.ok) throw new Error(add.status === 403 ? "The connected Google account can view that sheet but not edit it." : `Couldn't add the “${tab}” tab (${add.status})`);
    const head = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1`)}?valueInputOption=RAW`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [ROOM_LOG_HEADERS] }) });
    if (!head.ok) throw new Error(`Couldn't write the column names (${head.status})`);
  }
  const append = await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { ...json, body: JSON.stringify({ values: [row] }) });
  if (!append.ok) throw new Error(append.status === 403 ? "The connected Google account can view that sheet but not edit it." : `Couldn't add the row (${append.status})`);
}

/**
 * What else happens when a room is created, as the workspace set it up: email
 * the account owner and any other addresses, add a row to the log tab, and
 * write the room's link to a Salesforce field. Each is best effort and
 * reports how it went; none can undo the room.
 */
export async function afterRoomCreated(tenantId: number, account: SignedAccount, pageId: number, opts: { test?: boolean } = {}): Promise<RoomFollowUps> {
  const [[cfg], [page], [tenant]] = await Promise.all([
    db.select().from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1),
    db.select({ slug: lpPagesTable.slug }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1),
    db.select({ slug: tenantsTable.slug, domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1),
  ]);
  const baseHost = WILDCARD_BASE_HOSTS.find((h) => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
  const workspace = tenant?.domain ? `https://${tenant.domain.toLowerCase()}` : baseHost && tenant?.slug ? `https://${tenant.slug.toLowerCase()}.${baseHost}` : "";
  const links = {
    edit: `${workspace}/builder/${pageId}`,
    room: tenant?.micrositeDomain ? `https://${tenant.micrositeDomain}/${page?.slug ?? ""}` : `${workspace}/lp/${page?.slug ?? ""}`,
  };
  const out: RoomFollowUps = { alerts: null, sheet: null, sfdc: null };

  // 1. Alerts
  const extra = Array.isArray(cfg?.alertEmails) ? cfg.alertEmails : [];
  if (cfg?.alertOwner || extra.length) {
    const to = new Set(extra.map((e) => e.toLowerCase()));
    let ownerMatched: boolean | null = null;
    if (cfg?.alertOwner && account.owner) {
      // The sheet gives the owner's name; their address is the team member with that name.
      const users = await db.select({ id: appUsersTable.id, email: appUsersTable.email, tenantId: appUsersTable.tenantId }).from(appUsersTable).where(and(sql`lower(${appUsersTable.name}) = ${account.owner.trim().toLowerCase()}`, eq(appUsersTable.status, "active")));
      let match = users.find((u) => u.tenantId === tenantId);
      for (const u of users) {
        if (match) break;
        const [m] = await db.select({ id: tenantMembersTable.id }).from(tenantMembersTable).where(and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, u.id))).limit(1);
        if (m) match = u;
      }
      ownerMatched = !!match;
      if (match) to.add(match.email.toLowerCase());
    }
    const mail = roomCreatedEmail(account, links, opts);
    const sent: string[] = [];
    for (const email of [...to].slice(0, 25)) {
      const ok = await sendRoomDigestEmail({ recipientEmail: email, subject: mail.subject, html: mail.html, tenantId }).catch(() => false);
      if (ok) sent.push(email);
    }
    out.alerts = { sent, ownerMatched };
  }

  // 2. The sheet log
  const logSheet = cfg?.logSheetId || cfg?.sheetId;
  if (cfg && cfg.logEnabled && logSheet && SHEET_ID_RE.test(logSheet)) {
    const tab = cfg.logTab && SHEET_TAB_RE.test(cfg.logTab) ? cfg.logTab : DEFAULT_ROOM_LOG_TAB;
    try {
      await appendRoomLog(logSheet, tab, roomLogRow(account, links, opts));
      out.sheet = { ok: true, note: `Added to “${tab}”` };
    } catch (err) {
      out.sheet = { ok: false, note: err instanceof Error ? err.message : "Couldn't write to the sheet" };
      logger.warn({ err, tenantId, pageId }, "room log sheet append failed");
    }
  }

  // 3. Salesforce (never on a test run: a test link doesn't belong on a real account)
  if (cfg?.sfdcField && isSfdcFieldName(cfg.sfdcField)) {
    if (opts.test) out.sfdc = { ok: true, note: `Skipped on a test. A real room writes its link to Account.${cfg.sfdcField}` };
    else if (!account.sfdcId) out.sfdc = { ok: false, note: "The account has no Salesforce ID on the sheet" };
    else {
      try {
        const conn = await sfdcService.getActiveConnection(tenantId);
        if (!conn) out.sfdc = { ok: false, note: "Salesforce isn't connected for this workspace" };
        else {
          await sfdcService.updateSObject(conn.id, "Account", account.sfdcId, { [cfg.sfdcField]: links.room });
          out.sfdc = { ok: true, note: `Wrote the link to Account.${cfg.sfdcField}` };
        }
      } catch (err) {
        out.sfdc = { ok: false, note: "Salesforce refused the update. Check the field's API name and that it is editable." };
        logger.warn({ err, tenantId, pageId }, "room salesforce field update failed");
      }
    }
  }
  return out;
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

/**
 * A dry run of what happens when an account is added to the signed-accounts
 * sheet, for an account name typed in by hand: the same draft room, standard
 * files and Slack note, marked as a test. The sheet and the list of accounts
 * seen are not touched.
 */
export async function testRoomAutocreate(tenantId: number, rawName: string, sfdcId: string | null, owner: string | null = null): Promise<{ pageId: number; name: string; standardFiles: number; practicesLinked: boolean; followUps: RoomFollowUps } | null> {
  const name = cleanAccountName(rawName);
  if (!name) return null;
  const account: SignedAccount = { key: `test-${accountKey(name)}-${Date.now().toString(36)}`, name, signedDate: null, owner: owner?.trim().slice(0, 80) || null, sfdcId: sfdcId && /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(sfdcId) ? sfdcId : null };
  const pageId = await createRoomForAccount(tenantId, account, { claimed: true, test: true });
  if (!pageId) return null;
  const [standard, [cfg]] = await Promise.all([
    db.select({ k: lpRoomStandardAssetsTable.assetKey }).from(lpRoomStandardAssetsTable).where(eq(lpRoomStandardAssetsTable.tenantId, tenantId)),
    db.select({ sheetId: lpRoomAutocreateTable.sheetId, practicesTab: lpRoomAutocreateTable.practicesTab }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1),
  ]);
  const safe = name.replace(/[<>&*_~`]/g, " ");
  await slackService
    .postMessage(tenantId, { text: `Test: partner room created for ${safe}`, blocks: [{ type: "section", text: { type: "mrkdwn", text: `🧪 *Test run:* a partner room was created as a draft for *${safe}*, the way it would be when an account is added to the signed-accounts sheet. Nothing was published.` } }] })
    .catch(() => false);
  const followUps = await afterRoomCreated(tenantId, account, pageId, { test: true }).catch((): RoomFollowUps => ({ alerts: null, sheet: null, sfdc: null }));
  return { pageId, name, standardFiles: standard.length, practicesLinked: !!(account.sfdcId && cfg?.sheetId && cfg?.practicesTab), followUps };
}
