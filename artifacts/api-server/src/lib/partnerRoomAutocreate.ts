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
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { appUsersTable, db, lpPagesTable, lpRoomPracticesTable, salesAccountsTable, salesContactsTable, lpRoomAutocreateAccountsTable, lpRoomAutocreateTable, lpRoomSettingsTable, lpRoomStandardAssetsTable, tenantMembersTable, tenantsTable } from "@workspace/db";
import { sendRoomDigestEmail } from "./notifications";
import { sfdcService } from "./sfdc-service";
import { WILDCARD_BASE_HOSTS } from "./tenantHosts";
import { logger } from "./logger";
import { ROOM_STANDARD_ASSETS, setRoomKitAsset } from "./partnerRoom";
import { accountKey, cleanAccountName } from "./partnerRoomNames";
import { roomSheetsRequest, sheetProblem } from "./partnerRoomSheets";
import { ensurePracticeSite, type PracticeSite } from "./partnerRoomPracticeSite";
import { addTeamPeople, cleanDomain, EMPTY_SETUP_FACTS, mainEmailDomain, rankAccountContacts, roomCreatedSlackBlocks, roomSetupChecklist, type AccountContact, type RoomSetupFacts } from "./partnerRoomTeam";
import { SHEET_ID_RE, SHEET_TAB_RE, syncPracticesFromSheet } from "./partnerRoomService";
import { slackService } from "./slack-service";
import { buildPartnerWorkspaceBlocks } from "../seeds/partnerLaunchRoomTemplate";

/* ── Pure helpers ────────────────────────────────────────────────────────── */

export { accountKey, cleanAccountName };

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

export const roomSlugFor = (name: string) => `${accountKey(name).slice(0, 60).replace(/-+$/, "") || "partner"}-hub`;

/* ── Creating a room ─────────────────────────────────────────────────────── */

/** The blocks of a new room for an account: the template with the name set (its text follows the name), plus the workspace's standard guides. */
export const DEFAULT_ROOM_COVER = "/room/default-cover.jpg";

export function roomBlocksForAccount(name: string, slug: string, standard: { assetKey: string; fileUrl: string }[], signupUrl = ""): unknown[] {
  // The cover photo is the one on the model room; the "Next up" line on it follows the plan (the first milestone still open).
  let blocks: unknown[] = buildPartnerWorkspaceBlocks({ slug, partner: "[Partner name]", partnerShort: "[Partner]", heroImageUrl: DEFAULT_ROOM_COVER, ...(signupUrl ? { signupUrl } : {}) }).map((b) => (b.type === "room-workspace" ? { ...b, props: { ...b.props, partnerName: name, partnerShort: "", eyebrow: "Partner Hub" } } : b));
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
  // With no Salesforce id the sheet is still linked: the read then matches the account by name ("Parent Account Name").
  if (!sheetId || !practicesTab) return false;
  await db
    .insert(lpRoomSettingsTable)
    .values({ pageId, tenantId, sfdcAccountId: sfdcId, practicesSheetId: sheetId, practicesSheetTab: practicesTab })
    .onConflictDoUpdate({
      target: lpRoomSettingsTable.pageId,
      set: {
        sfdcAccountId: sql`COALESCE(${lpRoomSettingsTable.sfdcAccountId}, ${sfdcId}::text)`,
        practicesSheetId: sql`COALESCE(${lpRoomSettingsTable.practicesSheetId}, ${sheetId})`,
        practicesSheetTab: sql`CASE WHEN ${lpRoomSettingsTable.practicesSheetId} IS NULL THEN ${practicesTab} ELSE ${lpRoomSettingsTable.practicesSheetTab} END`,
      },
    });
  return true;
}

const sameSfdcId = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.length >= 15 && b.length >= 15 && a.slice(0, 15) === b.slice(0, 15);

export interface AccountPeople {
  /** The account's row under Accounts. */
  accountId: number;
  /** The account's Salesforce id as LP Studio has it. */
  sfdcId: string | null;
  domain: string | null;
  contacts: AccountContact[];
}

/**
 * The account as LP Studio already knows it (Accounts and Contacts in the
 * sales workspace): matched by Salesforce id, else by name. Gives the
 * customer's email domain and its contacts, most senior first.
 */
export async function accountPeople(tenantId: number, account: { sfdcId: string | null; name: string }): Promise<AccountPeople | null> {
  const accounts = await db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, salesforceId: salesAccountsTable.salesforceId, domain: salesAccountsTable.domain }).from(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId));
  const key = accountKey(account.name);
  const hit = accounts.find((a) => sameSfdcId(a.salesforceId, account.sfdcId)) ?? (key ? accounts.find((a) => accountKey(a.name) === key || (a.displayName ? accountKey(a.displayName) === key : false)) : undefined);
  if (!hit) return null;
  const rows = await db
    .select({ firstName: salesContactsTable.firstName, lastName: salesContactsTable.lastName, title: salesContactsTable.title, email: salesContactsTable.email, titleLevel: salesContactsTable.titleLevel, status: salesContactsTable.status })
    .from(salesContactsTable)
    .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.accountId, hit.id)))
    .limit(2000);
  const domain = cleanDomain(hit.domain) ?? mainEmailDomain(rows.map((r) => r.email));
  return { accountId: hit.id, sfdcId: hit.salesforceId ?? null, domain, contacts: rankAccountContacts(rows, domain) };
}

/** How many of the account's contacts go on the room's Team module to start with. The rest can still be invited. */
export const TEAM_FROM_CONTACTS = 8;

/**
 * Fill a new room from what LP Studio knows about the account: the customer's
 * side of the Team module, the email domain the room accepts, and the account
 * owner on our side. Best effort; the room exists either way.
 */
async function fillRoomFromAccount(tenantId: number, pageId: number, account: SignedAccount, blocks: unknown[], people: AccountPeople | null): Promise<Pick<RoomSetupFacts, "teamFilled" | "contacts" | "domain" | "ownerNamed">> {
  const out = { teamFilled: 0, contacts: people?.contacts.length ?? 0, domain: people?.domain ?? null, ownerNamed: false };
  let next = blocks;
  const team = (people?.contacts ?? []).slice(0, TEAM_FROM_CONTACTS).map((c) => ({ name: c.name, role: c.title, email: c.email }));
  const withTeam = addTeamPeople(next, "partner", team);
  if (withTeam) {
    next = withTeam;
    out.teamFilled = team.length;
  }
  if (account.owner) {
    const owner = await ownerUser(tenantId, account.owner);
    const withOwner = addTeamPeople(next, "ours", [{ name: account.owner.trim(), role: "Account owner", email: owner?.email }], { first: true, keepPlaceholders: true });
    if (withOwner) {
      next = withOwner;
      out.ownerNamed = true;
    }
  }
  if (next !== blocks) await db.update(lpPagesTable).set({ blocks: next as never }).where(eq(lpPagesTable.id, pageId));
  if (out.domain) {
    await db
      .insert(lpRoomSettingsTable)
      .values({ pageId, tenantId, allowedDomains: [out.domain] })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { allowedDomains: [out.domain] }, setWhere: sql`COALESCE(jsonb_array_length(${lpRoomSettingsTable.allowedDomains}), 0) = 0` });
  }
  return out;
}

/** The active team member whose name is exactly the account owner's (the sheet gives a name, not an address). */
async function ownerUser(tenantId: number, ownerName: string): Promise<{ email: string } | null> {
  const users = await db.select({ id: appUsersTable.id, email: appUsersTable.email, tenantId: appUsersTable.tenantId }).from(appUsersTable).where(and(sql`lower(${appUsersTable.name}) = ${ownerName.trim().toLowerCase()}`, eq(appUsersTable.status, "active")));
  const own = users.find((u) => u.tenantId === tenantId);
  if (own) return own;
  for (const u of users) {
    const [m] = await db.select({ id: tenantMembersTable.id }).from(tenantMembersTable).where(and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, u.id))).limit(1);
    if (m) return u;
  }
  return null;
}

/** Make the draft room for an account that has none yet. Returns the page id, or null when another reader already made it. */
export async function createRoomForAccount(tenantId: number, account: SignedAccount, opts: { claimed?: boolean; test?: boolean } = {}): Promise<number | null> {
  return (await createRoom(tenantId, account, opts))?.pageId ?? null;
}

/** Make the draft room for an account that has none yet. Returns the page id, or null when another reader already made it. */
export async function createRoom(tenantId: number, account: SignedAccount, opts: { claimed?: boolean; test?: boolean } = {}): Promise<{ pageId: number; facts: RoomSetupFacts } | null> {
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
    const slug = await freeSlug(tenantId, opts.test ? roomSlugFor(account.name).replace(/-hub$/, "-test-hub") : roomSlugFor(account.name));
    const standard = await db.select({ assetKey: lpRoomStandardAssetsTable.assetKey, fileUrl: lpRoomStandardAssetsTable.fileUrl }).from(lpRoomStandardAssetsTable).where(eq(lpRoomStandardAssetsTable.tenantId, tenantId));
    // What LP Studio already knows about the account: its contacts, its email domain, and its Salesforce id when the sheet has none.
    const people = await accountPeople(tenantId, account).catch((err) => {
      logger.warn({ err, account: account.name }, "account lookup for an automatic room failed");
      return null;
    });
    const sfdcId = account.sfdcId ?? people?.sfdcId ?? null;
    // The practice microsite: the account's own when one exists, else a draft from the workspace's template. The launch kit links to it.
    const site: PracticeSite | null = await ensurePracticeSite(tenantId, { name: account.name, sfdcId }, { accountId: people?.accountId ?? null, test: opts.test }).catch((err) => {
      logger.warn({ err, account: account.name }, "practice microsite for an automatic room failed");
      return null;
    });
    const siteUrl = site ? await publicPageUrl(tenantId, site.slug).catch(() => "") : "";
    const blocks = roomBlocksForAccount(account.name, slug, standard, siteUrl);
    const [page] = await db
      .insert(lpPagesTable)
      .values({ tenantId, title: `${account.name} Partner Hub${opts.test ? " (test)" : ""}`, slug, blocks: blocks as never, status: "draft", createdBy: "automatic rooms" })
      .returning({ id: lpPagesTable.id });
    await db.update(lpRoomAutocreateAccountsTable).set({ pageId: page.id }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, account.key)));
    // Its practices come from the workbook's locations tab, by the account's Salesforce id. Best effort: the room exists either way.
    const [cfg] = await db.select({ sheetId: lpRoomAutocreateTable.sheetId, practicesTab: lpRoomAutocreateTable.practicesTab }).from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
    const filled = await fillRoomFromAccount(tenantId, page.id, account, blocks, people).catch((err) => {
      logger.warn({ err, pageId: page.id }, "filling an automatic room from the account failed");
      return { teamFilled: 0, contacts: 0, domain: null, ownerNamed: false };
    });
    const linked = await linkRoomPractices(tenantId, page.id, sfdcId, cfg?.sheetId ?? null, cfg?.practicesTab ?? null).catch(() => false);
    const read = linked ? await syncPracticesFromSheet(page.id).catch((err) => (logger.warn({ err, pageId: page.id }, "first practices read for an automatic room failed"), { ok: false })) : { ok: false };
    const facts: RoomSetupFacts = { ...EMPTY_SETUP_FACTS, ...filled, standardFiles: standard.length, practicesLinked: linked && read.ok, practiceSite: site ? (site.existing ? "found" : "drafted") : null };
    lastPracticeSite.set(page.id, site);
    // Alerts, the sheet log and the Salesforce field. A test run does these itself so it can report each one.
    if (!opts.test) await afterRoomCreated(tenantId, { ...account, sfdcId }, page.id, { facts }).catch((err) => logger.warn({ err, pageId: page.id }, "follow-ups for an automatic room failed"));
    return { pageId: page.id, facts };
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

export function roomCreatedEmail(account: SignedAccount, links: { room: string; edit: string }, opts: { test?: boolean; facts?: RoomSetupFacts } = {}): { subject: string; html: string } {
  const name = escHtml(account.name);
  const list = roomSetupChecklist(opts.facts ?? EMPTY_SETUP_FACTS)
    .map((i) => `<tr><td style="padding:3px 8px 3px 0;vertical-align:top">${i.done ? "✅" : "◻️"}</td><td style="padding:3px 0;${i.done ? "color:#68726c" : ""}">${escHtml(i.text)}</td></tr>`)
    .join("");
  return {
    subject: `${opts.test ? "[Test] " : ""}New Partner Hub: ${account.name}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#18201c;max-width:560px">
<p style="margin:0 0 12px"><strong>A Partner Hub was created for ${name}.</strong>${opts.test ? " This is a test run." : ""}</p>
<p style="margin:0 0 12px">It is a draft: nobody outside your team can see it yet. Here is what was done for you and what is left:</p>
<table style="margin:0 0 16px;border-collapse:collapse;font-size:14px">${list}</table>
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

async function appendRoomLog(tenantId: number, sheetId: string, tab: string, row: string[]): Promise<void> {
  const meta = await roomSheetsRequest(tenantId, `/v4/spreadsheets/${sheetId}?fields=sheets(properties(title))`);
  if (!meta.ok) throw new Error(sheetProblem(meta.status, meta.sharedWith, "", "edit"));
  const cantEdit = `${meta.sharedWith} can view that sheet but not edit it. Share it as an Editor.`;
  const exists = (((await meta.json()) as { sheets?: { properties?: { title?: string } }[] }).sheets ?? []).some((s) => s.properties?.title === tab);
  const json = { method: "POST", headers: { "Content-Type": "application/json" } };
  if (!exists) {
    const add = await roomSheetsRequest(tenantId, `/v4/spreadsheets/${sheetId}:batchUpdate`, { ...json, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
    if (!add.ok) throw new Error(add.status === 403 ? cantEdit : `Couldn't add the “${tab}” tab (${add.status})`);
    const head = await roomSheetsRequest(tenantId, `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1`)}?valueInputOption=RAW`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [ROOM_LOG_HEADERS] }) });
    if (!head.ok) throw new Error(`Couldn't write the column names (${head.status})`);
  }
  const append = await roomSheetsRequest(tenantId, `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { ...json, body: JSON.stringify({ values: [row] }) });
  if (!append.ok) throw new Error(append.status === 403 ? cantEdit : `Couldn't add the row (${append.status})`);
}

/**
 * What else happens when a room is created, as the workspace set it up: email
 * the account owner and any other addresses, add a row to the log tab, and
 * write the room's link to a Salesforce field. Each is best effort and
 * reports how it went; none can undo the room.
 */
/** The practice microsite found or made for each room created in this process, for the test run's report. */
const lastPracticeSite = new Map<number, PracticeSite | null>();
export const practiceSiteOfRoom = (pageId: number) => lastPracticeSite.get(pageId) ?? null;

/** The customer-facing address of one of the workspace's pages. */
export async function publicPageUrl(tenantId: number, slug: string): Promise<string> {
  const [tenant] = await db.select({ slug: tenantsTable.slug, domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (tenant?.micrositeDomain) return `https://${tenant.micrositeDomain}/${slug}`;
  const baseHost = WILDCARD_BASE_HOSTS.find((h) => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
  const workspace = tenant?.domain ? `https://${tenant.domain.toLowerCase()}` : baseHost && tenant?.slug ? `https://${tenant.slug.toLowerCase()}.${baseHost}` : "";
  return workspace ? `${workspace}/lp/${slug}` : "";
}

/** Where a room is edited (the builder) and where the customer opens it once it is published. */
export async function roomLinks(tenantId: number, pageId: number): Promise<{ edit: string; room: string }> {
  const [[page], [tenant]] = await Promise.all([
    db.select({ slug: lpPagesTable.slug }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1),
    db.select({ slug: tenantsTable.slug, domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1),
  ]);
  const baseHost = WILDCARD_BASE_HOSTS.find((h) => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
  const workspace = tenant?.domain ? `https://${tenant.domain.toLowerCase()}` : baseHost && tenant?.slug ? `https://${tenant.slug.toLowerCase()}.${baseHost}` : "";
  return {
    edit: `${workspace}/builder/${pageId}`,
    room: tenant?.micrositeDomain ? `https://${tenant.micrositeDomain}/${page?.slug ?? ""}` : `${workspace}/lp/${page?.slug ?? ""}`,
  };
}

export async function afterRoomCreated(tenantId: number, account: SignedAccount, pageId: number, opts: { test?: boolean; facts?: RoomSetupFacts } = {}): Promise<RoomFollowUps> {
  const [[cfg], links] = await Promise.all([db.select().from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1), roomLinks(tenantId, pageId)]);
  const out: RoomFollowUps = { alerts: null, sheet: null, sfdc: null };

  // 1. Alerts
  const extra = Array.isArray(cfg?.alertEmails) ? cfg.alertEmails : [];
  if (cfg?.alertOwner || extra.length) {
    const to = new Set(extra.map((e) => e.toLowerCase()));
    let ownerMatched: boolean | null = null;
    if (cfg?.alertOwner && account.owner) {
      // The sheet gives the owner's name; their address is the team member with that name.
      const match = await ownerUser(tenantId, account.owner);
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
      await appendRoomLog(tenantId, logSheet, tab, roomLogRow(account, links, opts));
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
    const tab = cfg.sheetTab && SHEET_TAB_RE.test(cfg.sheetTab) ? cfg.sheetTab : "";
    const range = encodeURIComponent(tab ? `'${tab.replace(/'/g, "''")}'!A1:Z5001` : "A1:Z5001");
    const resp = await roomSheetsRequest(tenantId, `/v4/spreadsheets/${cfg.sheetId}/values/${range}`);
    if (!resp.ok) {
      logger.warn({ tenantId, status: resp.status }, "room autocreate sheet read failed");
      return finish(false, sheetProblem(resp.status, resp.sharedWith, tab));
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
      const room = await createRoom(tenantId, a).catch((err) => {
        logger.error({ err, tenantId, account: a.name }, "automatic room creation failed");
        return null;
      });
      if (!room) continue;
      created.push({ name: a.name, pageId: room.pageId });
      // One message per room: where to open it, what was done, and what the team still has to set up.
      const links = await roomLinks(tenantId, room.pageId).catch(() => ({ edit: "", room: "" }));
      await slackService.postMessage(tenantId, { text: `Partner Hub created: ${a.name}`, blocks: roomCreatedSlackBlocks(a.name, links, room.facts) }).catch(() => false);
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

export interface TestRoomResult {
  pageId: number;
  name: string;
  standardFiles: number;
  practicesLinked: boolean;
  /** How many practices the new room read from the locations sheet. */
  practices: number;
  practicesNote: string | null;
  teamFilled: number;
  contacts: number;
  domain: string | null;
  /** The practice microsite found or drafted for the account. */
  practiceSite: (PracticeSite & { url: string }) | null;
  followUps: RoomFollowUps;
}

const SFDC_ID_RE = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

/**
 * The real account behind a Salesforce id, for a test run: from the
 * workspace's Accounts first, else its row on the signed-accounts sheet.
 * Null when neither knows the id.
 */
export async function accountForTest(tenantId: number, sfdcId: string): Promise<{ name: string; owner: string | null; signedDate: string | null } | null> {
  const accounts = await db.select({ name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, salesforceId: salesAccountsTable.salesforceId, owner: salesAccountsTable.owner }).from(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId));
  const hit = accounts.find((a) => sameSfdcId(a.salesforceId, sfdcId));
  const fromSheet = await signedAccountOnSheet(tenantId, sfdcId).catch(() => null);
  if (hit) return { name: cleanAccountName(hit.displayName || hit.name), owner: fromSheet?.owner ?? hit.owner ?? null, signedDate: fromSheet?.signedDate ?? null };
  return fromSheet ? { name: fromSheet.name, owner: fromSheet.owner, signedDate: fromSheet.signedDate } : null;
}

async function signedAccountOnSheet(tenantId: number, sfdcId: string): Promise<SignedAccount | null> {
  const [cfg] = await db.select().from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1);
  if (!cfg?.sheetId || !SHEET_ID_RE.test(cfg.sheetId)) return null;
  const tab = cfg.sheetTab && SHEET_TAB_RE.test(cfg.sheetTab) ? cfg.sheetTab : "";
  const range = encodeURIComponent(tab ? `'${tab.replace(/'/g, "''")}'!A1:Z5001` : "A1:Z5001");
  const resp = await roomSheetsRequest(tenantId, `/v4/spreadsheets/${cfg.sheetId}/values/${range}`);
  if (!resp.ok) return null;
  return (signedAccountsFromSheet(((await resp.json()) as { values?: unknown }).values) ?? []).find((a) => sameSfdcId(a.sfdcId, sfdcId)) ?? null;
}

/**
 * A dry run of what happens when an account is added to the signed-accounts
 * sheet: the same draft room, standard files and Slack note, marked as a
 * test. Give a Salesforce account id to run it on a real account (its real
 * name, owner, contacts and practices), or just a name to see the shape. The
 * sheet and the list of accounts seen are not touched, and nothing is
 * written to Salesforce.
 */
export async function testRoomAutocreate(tenantId: number, rawName: string, sfdcIdRaw: string | null, owner: string | null = null): Promise<TestRoomResult | { error: string } | null> {
  const sfdcId = sfdcIdRaw && SFDC_ID_RE.test(sfdcIdRaw.trim()) ? sfdcIdRaw.trim() : null;
  const real = sfdcId ? await accountForTest(tenantId, sfdcId) : null;
  if (sfdcId && !real && !cleanAccountName(rawName)) return { error: "No account with that Salesforce ID was found under Accounts or on the signed-accounts sheet. Check the ID, or type the account's name as well." };
  const name = cleanAccountName(rawName) || real?.name || "";
  if (!name) return null;
  const account: SignedAccount = { key: `test-${accountKey(name)}-${Date.now().toString(36)}`, name, signedDate: real?.signedDate ?? null, owner: owner?.trim().slice(0, 80) || real?.owner || null, sfdcId };
  const room = await createRoom(tenantId, account, { claimed: true, test: true });
  if (!room) return null;
  const { pageId, facts } = room;
  const links = await roomLinks(tenantId, pageId).catch(() => ({ edit: "", room: "" }));
  await slackService.postMessage(tenantId, { text: `Test: Partner Hub created for ${name}`, blocks: roomCreatedSlackBlocks(name, links, facts, { test: true }) }).catch(() => false);
  const followUps = await afterRoomCreated(tenantId, account, pageId, { test: true, facts }).catch((): RoomFollowUps => ({ alerts: null, sheet: null, sfdc: null }));
  const [[count], [settings]] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)::int` }).from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, pageId)),
    db.select({ note: lpRoomSettingsTable.practicesSyncNote }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1),
  ]);
  const site = practiceSiteOfRoom(pageId);
  return { pageId, name, practiceSite: site ? { ...site, url: await publicPageUrl(tenantId, site.slug).catch(() => "") } : null, standardFiles: facts.standardFiles, practicesLinked: facts.practicesLinked, practices: count?.n ?? 0, practicesNote: settings?.note ?? null, teamFilled: facts.teamFilled, contacts: facts.contacts, domain: facts.domain, followUps };
}
