/**
 * Partner rooms — the working state behind a customer-facing room page.
 *
 * PUBLIC (LP_PUBLIC allowlist, POST /lp/room/*): what a visitor to the room
 * page can do. Viewing is open; acting needs a proven identity (see
 * lib/partnerRoom.ts): a personal link (sales hotlink for THIS page) or a
 * room token emailed to an allowed address. Every handler re-derives the
 * tenant from the page row and re-checks the identity — nothing from the
 * browser is trusted.
 *
 * TENANT (auth-gated, /lp/partner-rooms/*): settings (allowed domains, Slack
 * channel), people (allow / deny / requests), completed tasks, and uploads —
 * the ONLY place an uploaded file can be downloaded.
 */
import { Router, type Request, type Response } from "express";
import { readXlsx } from "../../lib/xlsxLite";
import { PLAN_COLUMN_GUIDE, cleanPlanGroups, csvRows, mergeImportedPlan, parsePlanRows, planCsv, roomPlanInfo, setRoomPlan } from "../../lib/partnerRoomPlan";
import { Readable } from "stream";
import {
  db,
  lpPagesTable,
  lpRoomStandardAssetsTable,
  lpRoomAutocreateTable,
  lpRoomAutocreateAccountsTable,
  lpRoomDoctorsTable,
  appUsersTable,
  tenantMembersTable,
  lpAssetEventsTable,
  lpGoogleConnectionsTable,
  lpBrandSettingsTable,
  lpRoomEventsTable,
  lpRoomChoicesTable,
  lpRoomContactsTable,
  lpRoomMembersTable,
  lpRoomPracticesTable,
  lpRoomRequestsTable,
  lpRoomWinCommentsTable,
  lpRoomWinLikesTable,
  lpRoomWinsTable,
  lpRoomSettingsTable,
  lpRoomTaskStateTable,
  lpRoomUploadsTable,
  lpRoomViewsTable,
  salesContactsTable,
  salesHotlinksTable,
  tenantsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, or, sql, gte } from "drizzle-orm";
import { getTenantId, optionalAuth } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { ObjectStorageService } from "../../lib/objectStorage";
import { getActiveHostsForTenant } from "../../lib/tenantHosts";
import { getRequestHost, getRequestProto } from "../../lib/requestHost";
import { sendRoomAccessEmail, sendRoomDigestEmail, sendRoomInviteEmail } from "../../lib/notifications";
import { buildRoomPeople, countReactions, feedAlertEmail, feedAlertsFor, parseReaction, parseWinImages, resolveMentions, teamPeopleFromBlocks, type FeedAlert, type RoomPerson } from "../../lib/partnerRoomFeed";
import { CALENDAR_ID_RE, cleanMinutes, loadPublicRoomCalendar, minutesAreEmpty, syncRoomCalendar } from "../../lib/partnerRoomCalendar";
import { slackService } from "../../lib/slack-service";
import { parseAssetEventBody } from "../../lib/assetEvents";
import { roomSheetsAccount } from "../../lib/partnerRoomSheets";
import { ensurePracticeSite, setRoomPracticeLink, roomSignupSlug, signupPagesBySlug } from "../../lib/partnerRoomPracticeSite";
import { accountPeople, hubOwnerEmail, publicPageUrl, createRoomForAccount, hubTemplate, isSfdcFieldName, syncRoomAutocreate, testRoomAutocreate } from "../../lib/partnerRoomAutocreate";
import { summarizeAssetEvents, type RoomAssetStat } from "../../lib/partnerRoomEngagement";
import { unlistedPeople } from "../../lib/partnerRoomTeam";
import { hubSetupItems, parseRoomView, VISIT_ALERT_QUIET_MS } from "../../lib/partnerRoomViews";
import { hubActivity, recordHubActivity } from "../../lib/partnerRoomActivity";
import { createIntakeTask } from "../../lib/asana";
import { sfdcService } from "../../lib/sfdc-service";
import { zipCentroid } from "../../lib/zipCentroids";
import { playRequest } from "../../lib/partnerRoomPlays";
import { hubPlays, hubRestrictsOutreach, setNoDirectOutreach, setPlayState } from "../../lib/partnerRoomPlaysService";
import { extendRoomStage, parseRoomStage, roomStageFromProps, roomStageInfo, setRoomStage, waveKey } from "../../lib/partnerRoomStage";
import { buildExpansionPlan, expansionReview, type ExpansionDecision } from "../../lib/partnerRoomExpansionPlan";
import { giftFor, hubGiftStep, isGiftRequest, setGiftOff } from "../../lib/partnerRoomGift";
import { kitAsanaTask, kitNotice } from "../../lib/partnerRoomKit";
import { ASANA_GID_RE, hubAsanaTarget } from "../../lib/partnerRoomAsana";
import { buildPlanQueue, isDeclineChoice, planRequest } from "../../lib/partnerRoomPlanQueue";
import { parseNotifyVia, reminderEmail, teamNotifyEmail, type NotifyVia } from "../../lib/partnerRoomNotify";
import { sendWelcomeKits } from "../../lib/partnerRoomKitService";
import { practicesExportCsv } from "../../lib/partnerRoomRoster";
import { applyRoster, buildRoomDigest, practiceTrainingEvents, latestRosterResult, loadSalesforceGap, practiceSummary, roomRosterTemplate, revopsSlackLines, sendRoomDigest, sheetIdFrom, SHEET_TAB_RE, slackMention, syncPracticesFromSheet, upsertPractices } from "../../lib/partnerRoomService";
import { doctorCountFromUpload, practiceNamesFromUpload, reconcilePractices, rowsFromUpload } from "../../lib/partnerRoomReconcile";
import {
  ASANA_REQUEST_KINDS,
  asanaRequestTaskName,
  normalizePracticeStage,
  parsePracticeCsv,
  parsePracticeRow,
  ORDER_RECENCY,
  type OrderRecency,
  orderRecencySummary,
  recencyCutoffs,
  PRODUCT_LINES,
  productLineSummary,
  ROOM_PRACTICE_STAGES,
  roomCalendarIcs,
  roomRequiresEmail,
  roomSharesMap,
  roomWorkspaceProps,
  roomKitInfo,
  resolveRoomBlocks,
  ROOM_STANDARD_ASSETS,
  parseRoomKitAsset,
  setRoomKitAsset,
  setRoomGoals,
  setRoomCover,
  parseRoomCover,
  roomCoverInfo,
  roomKitAssetIsOwn,
  clearRoomKitAsset,
  roomLogoTask,
  isLogoImage,
  ROOM_LOGO_TASK_KEY,
  ROOM_LOGO_STEP_KEY,
  roomAccountInfo,
  parseRoomAccount,
  parseRoomTeam,
  setRoomProps,
  parseRoomOverviewHidden,
  parseRoomLinks,
  roomLinksInfo,
  setRoomLinks,
  roomOverviewHidden,
  setRoomOverviewHidden,
  parseRoomGoals,
  roomGoalsInfo,
  roomPartnerName,
  type RoomPracticeInput,
  extractRoomChoices,
  extractRoomTasks,
  onboardingTeamStepKey,
  parseRoomComment,
  parseRoomContact,
  parseMilestonePatch,
  parseRoomWin,
  setRoomMilestone,
  removeRoomMilestones,
  type RoomChoiceSpec,
  pageIsRoom,
  parseRoomRequest,
  ROOM_REQUEST_KIND_LABEL,
  ROOM_REQUEST_STATUSES,
  type RoomRequestKind,
  isEmailAllowed,
  normalizeDomain,
  normalizeEmail,
  parseRoomUpload,
  safeRoomPath,
  signRoomToken,
  verifyRoomToken,
  FREE_MAIL_DOMAINS,
  type RoomMemberStatus,
  type RoomTask,
} from "../../lib/partnerRoom";

const router = Router();

// The visitor routes are public, but a signed-in team member is recognised on them (see resolveViewer).
router.use((req: Request, res: Response, next) => (req.path.startsWith("/lp/room/") && !req.authUser ? optionalAuth(req, res, next) : next()));
const objectStorage = new ObjectStorageService();
const ROOM_UPLOAD_FOLDER = "room-uploads";

// Reads are cheap and fire on every room view; writes and access requests
// are rare for a real person, so their ceilings are low.
const stateLimiter = rateLimit({ name: "room-state", windowMs: 60_000, max: envLimit("RATE_LIMIT_ROOM_STATE_PER_MIN", 120) });
/**
 * Practices in a wave, however the list names it: "Wave 1", "wave 1" and "1" are the same wave (as on the
 * Overview's timeline, waveKey). "__none" is the practices in no wave.
 */
export const NO_WAVE = "__none";
function inWave(wave: string) {
  if (wave === NO_WAVE) return sql`(${lpRoomPracticesTable.wave} IS NULL OR btrim(${lpRoomPracticesTable.wave}) = '')`;
  return sql`regexp_replace(regexp_replace(lower(btrim(${lpRoomPracticesTable.wave})), '^wave[[:space:]]*', ''), '[[:space:]]+', ' ', 'g') = ${waveKey(wave)}`;
}

const actionLimiter = rateLimit({ name: "room-action", windowMs: 60_000, max: envLimit("RATE_LIMIT_ROOM_ACTION_PER_MIN", 60) });
const accessLimiter = rateLimit({ name: "room-access", windowMs: 10 * 60_000, max: envLimit("RATE_LIMIT_ROOM_ACCESS_PER_10MIN", 6) });

interface RoomPage {
  id: number;
  tenantId: number;
  title: string;
  slug: string;
  tasks: Map<string, RoomTask>;
  /** The page carries a room-workspace block (it has requests even with no customer tasks). */
  isWorkspace: boolean;
  /** Decisions the page offers (marketing programs with options). */
  choices: Map<string, RoomChoiceSpec>;
  /** The onboarding step that adding a team contact completes. */
  teamStepKey: string | null;
  /** The customer's name from the workspace block. */
  partnerName: string;
  /** Named people with an address on the Team module (they can be tagged in the feed). */
  teamPeople: { name: string; email: string }[];
  /** The hub asks for an email before showing its contents: a stranger gets the cover and nothing else. */
  gated: boolean;
  /** The team switched on "show the map to anyone who opens the hub". */
  mapShared: boolean;
  /** The getting-started step that accepts a welcome gift, when the hub shows one. */
  giftStep: { key: string; title: string } | null;
}

async function loadRoomPage(pageIdRaw: unknown): Promise<RoomPage | null> {
  const pageId = typeof pageIdRaw === "number" ? Math.floor(pageIdRaw) : NaN;
  if (!Number.isFinite(pageId) || pageId <= 0) return null;
  const [page] = await db
    .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, title: lpPagesTable.title, slug: lpPagesTable.slug, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, pageId))
    .limit(1);
  if (!page || page.tenantId == null) return null;
  // Everything read from the page uses the account name filled in, as the page itself shows it.
  page.blocks = resolveRoomBlocks(page.blocks);
  return { id: page.id, tenantId: page.tenantId, title: page.title, slug: page.slug, tasks: extractRoomTasks(page.blocks), giftStep: hubGiftStep(page.blocks), isWorkspace: pageIsRoom(page.blocks), choices: extractRoomChoices(page.blocks), teamStepKey: onboardingTeamStepKey(page.blocks), partnerName: roomPartnerName(page.blocks), teamPeople: teamPeopleFromBlocks(page.blocks), gated: roomRequiresEmail(page.blocks), mapShared: roomSharesMap(page.blocks) };
}

async function loadSettings(pageId: number): Promise<{ allowedDomains: string[]; slackChannelId: string | null; sfdcAccountId: string | null; asanaProjectGid: string | null; notifyVia: NotifyVia }> {
  const [row] = await db
    .select({ allowedDomains: lpRoomSettingsTable.allowedDomains, slackChannelId: lpRoomSettingsTable.slackChannelId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId, asanaProjectGid: lpRoomSettingsTable.asanaProjectGid, notifyVia: lpRoomSettingsTable.notifyVia })
    .from(lpRoomSettingsTable)
    .where(eq(lpRoomSettingsTable.pageId, pageId))
    .limit(1);
  return { allowedDomains: Array.isArray(row?.allowedDomains) ? row.allowedDomains : [], slackChannelId: row?.slackChannelId ?? null, sfdcAccountId: row?.sfdcAccountId ?? null, asanaProjectGid: row?.asanaProjectGid ?? null, notifyVia: parseNotifyVia(row?.notifyVia) };
}

/** The hub's welcome gift switches: on for the hub unless turned off, and the people it is turned off for. */
async function loadGiftSettings(pageId: number): Promise<{ giftsEnabled: boolean; giftOffEmails: string[] }> {
  const [row] = await db.select({ giftsEnabled: lpRoomSettingsTable.giftsEnabled, giftOffEmails: lpRoomSettingsTable.giftOffEmails }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, pageId)).limit(1);
  return { giftsEnabled: row ? row.giftsEnabled !== false : true, giftOffEmails: Array.isArray(row?.giftOffEmails) ? row.giftOffEmails : [] };
}

/** Everyone who has accepted their welcome gift on this hub (sent where to ship it). */
async function giftAcceptedBy(pageId: number, stepKey: string): Promise<string[]> {
  const rows = await db.select({ email: lpRoomRequestsTable.requestedByEmail, assetKey: lpRoomRequestsTable.assetKey, kind: lpRoomRequestsTable.kind, subject: lpRoomRequestsTable.subject }).from(lpRoomRequestsTable).where(eq(lpRoomRequestsTable.pageId, pageId)).limit(5000);
  return [...new Set(rows.filter((r) => isGiftRequest(r, stepKey)).map((r) => r.email.toLowerCase()))];
}

async function memberStatus(pageId: number, email: string): Promise<RoomMemberStatus | null> {
  const [row] = await db
    .select({ status: lpRoomMembersTable.status })
    .from(lpRoomMembersTable)
    .where(and(eq(lpRoomMembersTable.pageId, pageId), eq(lpRoomMembersTable.email, email)))
    .limit(1);
  return (row?.status as RoomMemberStatus | undefined) ?? null;
}

interface Viewer {
  email: string;
  name: string | null;
  via: "link" | "email";
  /** A member of the page's own team (their posts show as the team's). */
  team?: boolean;
}

/** A name for an email-verified visitor, when we already know one: a sales contact with that address, else a contact added in this room. */
/**
 * The name of a member of the page's own team (an active LP Studio user in
 * that tenant), or null. The team is always allowed in its own rooms: they
 * still confirm the address by email, but never need to be on the customer's
 * allowed list.
 */
async function teamMemberName(tenantId: number, email: string): Promise<string | null> {
  const [user] = await db
    .select({ id: appUsersTable.id, name: appUsersTable.name, tenantId: appUsersTable.tenantId })
    .from(appUsersTable)
    .where(and(sql`lower(${appUsersTable.email}) = ${email}`, eq(appUsersTable.status, "active")))
    .limit(1);
  if (!user) return null;
  if (user.tenantId !== tenantId) {
    const [member] = await db.select({ id: tenantMembersTable.id }).from(tenantMembersTable).where(and(eq(tenantMembersTable.tenantId, tenantId), eq(tenantMembersTable.userId, user.id))).limit(1);
    if (!member) return null;
  }
  return user.name.trim() || email.split("@")[0];
}

/** A room member's status, with the page's own team always allowed. */
async function accessStatus(page: RoomPage, email: string): Promise<RoomMemberStatus | null> {
  if (await teamMemberName(page.tenantId, email)) return "allowed";
  return memberStatus(page.id, email);
}

async function knownNameFor(page: RoomPage, email: string): Promise<string | null> {
  return (await teamMemberName(page.tenantId, email)) ?? customerNameFor(page, email);
}

/** A customer's name from the tenant's contacts or the people they added to the room. */
async function customerNameFor(page: RoomPage, email: string): Promise<string | null> {
  const [contact] = await db
    .select({ firstName: salesContactsTable.firstName, lastName: salesContactsTable.lastName })
    .from(salesContactsTable)
    .where(and(eq(salesContactsTable.tenantId, page.tenantId), sql`lower(${salesContactsTable.email}) = ${email}`))
    .limit(1);
  const fromContact = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() : "";
  if (fromContact) return fromContact;
  const [added] = await db.select({ name: lpRoomContactsTable.name }).from(lpRoomContactsTable).where(and(eq(lpRoomContactsTable.pageId, page.id), eq(lpRoomContactsTable.email, email))).limit(1);
  return added?.name?.trim() || null;
}

/**
 * Who is acting? A personal link for THIS page wins (the contact is known);
 * otherwise a valid room token whose address is still allowed. Null = anonymous.
 */
async function resolveViewer(page: RoomPage, body: { hl?: unknown; rt?: unknown }, signedIn?: { email?: string | null } | null): Promise<Viewer | null> {
  const hl = typeof body.hl === "string" ? body.hl.trim() : "";
  if (hl && hl.length <= 64) {
    const [row] = await db
      .select({
        pageId: salesHotlinksTable.pageId,
        isActive: salesHotlinksTable.isActive,
        tenantId: salesHotlinksTable.tenantId,
        email: salesContactsTable.email,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
      })
      .from(salesHotlinksTable)
      .leftJoin(salesContactsTable, eq(salesContactsTable.id, salesHotlinksTable.contactId))
      .where(eq(salesHotlinksTable.token, hl))
      .limit(1);
    const email = normalizeEmail(row?.email);
    if (row && row.isActive && row.pageId === page.id && row.tenantId === page.tenantId && email) {
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || null;
      return { email, name, via: "link" };
    }
  }
  const claims = verifyRoomToken(body.rt, page.id);
  if (claims) {
    // The page's own team first (one lookup), then the customer's allowed list.
    const team = await teamMemberName(page.tenantId, claims.email);
    if (team) return { email: claims.email, name: team, via: "email", team: true };
    const [settings, status] = await Promise.all([loadSettings(page.id), memberStatus(page.id, claims.email)]);
    if (isEmailAllowed(claims.email, settings.allowedDomains, status)) return { email: claims.email, name: await customerNameFor(page, claims.email), via: "email" };
  }
  // Someone signed in to LP Studio who is on this page's own team (the builder, an in-app preview): no link or email check needed.
  const own = normalizeEmail(signedIn?.email);
  if (own) {
    const team = await teamMemberName(page.tenantId, own);
    if (team) return { email: own, name: team, via: "email", team: true };
  }
  return null;
}

async function roomPageUrl(req: Request, page: RoomPage, pathRaw: unknown): Promise<string> {
  const hosts = await getActiveHostsForTenant(page.tenantId);
  const reqHost = getRequestHost(req).toLowerCase();
  const path = safeRoomPath(pathRaw);
  // The visitor is ON the room page, so their own host + path is the best
  // link — but only when that host really belongs to this tenant (or we are
  // not in production). Otherwise build it from the tenant's own domain.
  if (path && (hosts.includes(reqHost) || process.env.NODE_ENV !== "production")) {
    return `${getRequestProto(req)}://${reqHost}${path}`;
  }
  const [tenant] = await db
    .select({ domain: tenantsTable.domain, micrositeDomain: tenantsTable.micrositeDomain })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, page.tenantId))
    .limit(1);
  if (tenant?.micrositeDomain) return `https://${tenant.micrositeDomain}/${page.slug}`;
  if (tenant?.domain) return `https://${tenant.domain}/lp/${page.slug}`;
  return `${getRequestProto(req)}://${reqHost}/lp/${page.slug}`;
}

function postToSlack(page: RoomPage, channelId: string | null, headline: string, lines: string[], pageUrl?: string): void {
  const text = `${headline} — ${page.title}`;
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: headline, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    { type: "context", elements: [{ type: "mrkdwn", text: `${page.title}${pageUrl ? ` · <${pageUrl}|Open the hub>` : ""}` }] },
  ];
  void slackService.postMessage(page.tenantId, { blocks, text, channelId: channelId ?? undefined }).catch(() => {});
}

/**
 * Tell the account team something happened in a hub, the way the hub is set
 * to: its Slack channel (the default), an email to the account owner, or
 * both. Never blocks the request, and a failure to tell is not the visitor's
 * problem.
 */
function notifyTeam(page: RoomPage, settings: { slackChannelId: string | null; notifyVia: NotifyVia }, headline: string, lines: string[], pageUrl?: string): void {
  if (settings.notifyVia !== "email") postToSlack(page, settings.slackChannelId, headline, lines, pageUrl);
  if (settings.notifyVia === "slack") return;
  void (async () => {
    const to = await hubOwnerEmail(page.tenantId, page.id);
    if (!to) return;
    const [brand] = await db.select({ config: lpBrandSettingsTable.config }).from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, page.tenantId)).limit(1);
    const color = (brand?.config as { primaryColor?: unknown } | undefined)?.primaryColor;
    const mail = teamNotifyEmail({ hubTitle: page.title, headline, lines, hubUrl: pageUrl, brandColor: typeof color === "string" ? color : undefined });
    await sendRoomDigestEmail({ recipientEmail: to, subject: mail.subject, html: mail.html, tenantId: page.tenantId });
  })().catch(() => {});
}

const mrk = (s: string) => s.replace(/[<>&*_~`]/g, " ");

/** Wins with like counts and comments for a page. `viewerEmail` marks which the viewer liked; names are shown, addresses only to a known viewer. */
async function loadWins(pageId: number, viewerEmail: string | null, showEmails: boolean) {
  const wins = await db.select().from(lpRoomWinsTable).where(eq(lpRoomWinsTable.pageId, pageId)).orderBy(desc(lpRoomWinsTable.createdAt)).limit(100);
  if (wins.length === 0) return [];
  const ids = wins.map((w) => w.id);
  const [likes, comments] = await Promise.all([
    db.select({ winId: lpRoomWinLikesTable.winId, email: lpRoomWinLikesTable.email, emoji: lpRoomWinLikesTable.emoji }).from(lpRoomWinLikesTable).where(inArray(lpRoomWinLikesTable.winId, ids)),
    db.select().from(lpRoomWinCommentsTable).where(inArray(lpRoomWinCommentsTable.winId, ids)).orderBy(asc(lpRoomWinCommentsTable.createdAt)),
  ]);
  const who = (name: string | null, email: string, side: string) => name || (showEmails ? email : side === "team" ? "The team" : "A team member");
  const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((n): n is string => typeof n === "string") : []);
  return wins.map((w) => ({
    id: w.id,
    body: w.body,
    headline: w.headline,
    region: w.region,
    side: w.authorSide,
    by: who(w.authorName, w.authorEmail, w.authorSide),
    createdAt: w.createdAt.toISOString(),
    images: parseWinImages(w.images),
    mentions: names(w.mentions),
    likes: likes.filter((l) => l.winId === w.id).length,
    liked: !!viewerEmail && likes.some((l) => l.winId === w.id && l.email === viewerEmail),
    reactions: countReactions(likes.filter((l) => l.winId === w.id), viewerEmail),
    comments: comments
      .filter((c) => c.winId === w.id)
      .map((c) => ({ id: c.id, body: c.body, mentions: names(c.mentions), side: c.authorSide, by: who(c.authorName, c.authorEmail, c.authorSide), createdAt: c.createdAt.toISOString() })),
  }));
}

/**
 * Everyone who can be tagged in this room's feed: the Team module, contacts
 * the customer added, people with a personal link, and anyone who has posted
 * or commented. Each needs a name and an address.
 */
async function roomPeople(page: RoomPage): Promise<RoomPerson[]> {
  const [contacts, linked, posters, commenters] = await Promise.all([
    db.select({ name: lpRoomContactsTable.name, email: lpRoomContactsTable.email }).from(lpRoomContactsTable).where(eq(lpRoomContactsTable.pageId, page.id)),
    db
      .select({ firstName: salesContactsTable.firstName, lastName: salesContactsTable.lastName, email: salesContactsTable.email })
      .from(salesHotlinksTable)
      .innerJoin(salesContactsTable, eq(salesContactsTable.id, salesHotlinksTable.contactId))
      .where(and(eq(salesHotlinksTable.pageId, page.id), eq(salesHotlinksTable.tenantId, page.tenantId), eq(salesHotlinksTable.isActive, true)))
      .limit(200),
    db.select({ name: lpRoomWinsTable.authorName, email: lpRoomWinsTable.authorEmail }).from(lpRoomWinsTable).where(eq(lpRoomWinsTable.pageId, page.id)).limit(200),
    db
      .select({ name: lpRoomWinCommentsTable.authorName, email: lpRoomWinCommentsTable.authorEmail })
      .from(lpRoomWinCommentsTable)
      .innerJoin(lpRoomWinsTable, eq(lpRoomWinsTable.id, lpRoomWinCommentsTable.winId))
      .where(eq(lpRoomWinsTable.pageId, page.id))
      .limit(400),
  ]);
  return buildRoomPeople(page.id, [
    ...page.teamPeople,
    ...contacts,
    ...linked.map((c) => ({ name: [c.firstName, c.lastName].filter(Boolean).join(" "), email: c.email })),
    ...posters,
    ...commenters,
  ]);
}

/** Email the people a post or comment concerns. Never blocks or fails the action. */
function sendFeedAlerts(page: RoomPage, alerts: FeedAlert[], byName: string, text: string, url: string): void {
  for (const a of alerts) {
    const mail = feedAlertEmail({ kind: a.kind, byName, room: page.title, text, url });
    void sendRoomDigestEmail({ recipientEmail: a.email, subject: mail.subject, html: mail.html, tenantId: page.tenantId }).catch(() => {});
  }
}

/** Workspace state beyond tasks and requests: decisions and wins for everyone, added contacts for known viewers. */
async function loadWorkspaceState(page: RoomPage, viewer: Viewer | null) {
  const [choiceRows, wins, contactRows, people] = await Promise.all([
    db.select().from(lpRoomChoicesTable).where(eq(lpRoomChoicesTable.pageId, page.id)),
    loadWins(page.id, viewer?.email ?? null, !!viewer),
    viewer ? db.select().from(lpRoomContactsTable).where(eq(lpRoomContactsTable.pageId, page.id)).orderBy(asc(lpRoomContactsTable.createdAt)) : Promise.resolve([]),
    viewer ? roomPeople(page) : Promise.resolve([] as RoomPerson[]),
  ]);
  const choices: Record<string, { value: string; at: string; by?: string }> = {};
  for (const c of choiceRows) {
    const spec = page.choices.get(c.choiceKey);
    if (!spec || !spec.options.includes(c.value)) continue; // the page no longer offers it
    choices[c.choiceKey] = { value: c.value, at: c.chosenAt.toISOString(), ...(viewer ? { by: c.chosenByName || c.chosenByEmail } : {}) };
  }
  // Names and opaque keys only: the page never learns an address it wasn't already shown.
  return { choices, wins, contacts: [...contactRows.map((c) => ({ id: c.id, name: c.name, role: c.role, email: c.email })), ...(viewer ? await peopleInTheHub(page, viewer, contactRows.map((c) => c.email)) : [])], people: people.map((p) => ({ key: p.key, name: p.name })) };
}

/**
 * The customer's people who are in the hub (invited, or the visitor reading
 * this) but on neither the Team module nor the list the customer added. They
 * are shown with the added contacts, so "Add your team" never tells someone
 * who is already in that nobody is listed. Our own team is left out.
 */
async function peopleInTheHub(page: RoomPage, viewer: Viewer, contactEmails: (string | null)[]) {
  const members = await db.select({ id: lpRoomMembersTable.id, email: lpRoomMembersTable.email }).from(lpRoomMembersTable).where(and(eq(lpRoomMembersTable.pageId, page.id), eq(lpRoomMembersTable.status, "allowed"))).orderBy(asc(lpRoomMembersTable.createdAt)).limit(60);
  const access = [...members.map((m) => ({ email: m.email })), ...(viewer.team ? [] : [{ email: viewer.email }])];
  const extra = unlistedPeople(access, [...page.teamPeople.map((p) => p.email), ...contactEmails]);
  const out: { id: number; name: string; role: string | null; email: string; invited: true }[] = [];
  for (const [i, p] of extra.entries()) {
    if (await teamMemberName(page.tenantId, p.email)) continue; // one of ours
    const known = p.email === viewer.email ? viewer.name : await customerNameFor(page, p.email);
    // Negative ids: these are not rows a contact can be removed by.
    out.push({ id: -(members.find((m) => m.email === p.email)?.id ?? 1_000_000 + i), name: known?.trim() || p.name, role: null, email: p.email, invited: true });
  }
  return out;
}

/** An invitation that named the person: keep the name as a contact, so the hub lists them as they were written. */
async function rememberInvited(page: RoomPage, email: string, name: string, byEmail: string): Promise<void> {
  if (!name || page.teamPeople.some((p) => p.email.trim().toLowerCase() === email)) return;
  const [have] = await db.select({ id: lpRoomContactsTable.id }).from(lpRoomContactsTable).where(and(eq(lpRoomContactsTable.pageId, page.id), eq(lpRoomContactsTable.email, email))).limit(1);
  if (!have) await db.insert(lpRoomContactsTable).values({ tenantId: page.tenantId, pageId: page.id, name, email, addedByEmail: byEmail });
}

/** A known visitor on a workspace page, or a 401/404 already sent. */
async function requireWorkspaceViewer(req: Request, res: Response): Promise<{ page: RoomPage; viewer: Viewer } | null> {
  const page = await loadRoomPage(req.body?.pageId);
  if (!page || !page.isWorkspace) {
    res.status(404).json({ error: "Hub not found" });
    return null;
  }
  const viewer = await resolveViewer(page, req.body ?? {}, req.authUser);
  if (!viewer) {
    res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
    return null;
  }
  return { page, viewer };
}

/**
 * The hub's calendar from the server: synced meetings and published minutes
 * for everyone, plus each practice's training day for a recognised visitor
 * (a training names the practice, and practice names are not for strangers).
 */
async function calendarFor(pageId: number, known: boolean) {
  const cal = await loadPublicRoomCalendar(pageId);
  if (!known) return cal;
  const trainings = await practiceTrainingEvents(pageId).catch(() => []);
  return { ...cal, events: [...cal.events, ...trainings] };
}

/* ── PUBLIC ──────────────────────────────────────────────────────────────── */

/**
 * Room state for the page. Anyone gets which tasks are done (so the page
 * reads the same for every visitor); only an identified viewer gets WHO did
 * it and the name of the file received.
 */
router.post("/lp/room/state", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await loadRoomPage(req.body?.pageId);
    if (!page) {
      res.json({ viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], people: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] });
      return;
    }
    const signedInAs = await resolveViewer(page, req.body ?? {}, req.authUser);
    // "View as" a person (the team's contact rows): the page's own team may read the hub as one of the customer's
    // people sees it. Read only: every other route still acts as whoever is really signed in.
    const viewAsEmail = signedInAs?.team ? normalizeEmail(typeof req.body?.as === "string" ? req.body.as : "") : null;
    const viewer: Viewer | null = viewAsEmail ? { email: viewAsEmail, name: await customerNameFor(page, viewAsEmail), via: "email" } : signedInAs;
    // A gated hub tells a stranger nothing: no progress, no wins, no dates. They get the cover and an email box.
    if (page.gated && !viewer) {
      res.json({ viewer: null, gated: true, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], people: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] });
      return;
    }
    const [states, uploads] = await Promise.all([
      db.select().from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, page.id)),
      db
        .select({ taskKey: lpRoomUploadsTable.taskKey, fileName: lpRoomUploadsTable.fileName, createdAt: lpRoomUploadsTable.createdAt, by: lpRoomUploadsTable.uploadedByEmail })
        .from(lpRoomUploadsTable)
        .where(eq(lpRoomUploadsTable.pageId, page.id))
        .orderBy(desc(lpRoomUploadsTable.createdAt)),
    ]);
    const tasks: Record<string, { done: boolean; at: string; by?: string; fileName?: string }> = {};
    for (const s of states) {
      // The logo upload has no step of its own on some hubs, and the hub still shows that it was done.
      if (!page.tasks.has(s.taskKey) && s.taskKey !== ROOM_LOGO_TASK_KEY) continue;
      tasks[s.taskKey] = { done: true, at: s.completedAt.toISOString(), ...(viewer ? { by: s.completedByName || s.completedByEmail } : {}) };
    }
    if (viewer) {
      for (const u of uploads) {
        const t = tasks[u.taskKey];
        if (t && !t.fileName) t.fileName = u.fileName; // newest first
      }
    }
    // Requests are the customer's own conversation with the team: known viewers only.
    const requests = viewer
      ? (await db.select().from(lpRoomRequestsTable).where(eq(lpRoomRequestsTable.pageId, page.id)).orderBy(desc(lpRoomRequestsTable.createdAt)).limit(200)).map((r) => ({
          id: r.id,
          kind: r.kind,
          subject: r.subject,
          // What was asked, in the asker's words (for a marketing plan request: the programs it covers).
          details: r.details ? r.details.slice(0, 600) : null,
          status: r.status,
          owner: r.owner,
          due: r.due,
          assetKey: r.assetKey,
          by: r.requestedByName || r.requestedByEmail,
          createdAt: r.createdAt.toISOString(),
          // The account team's answer, when they have written one.
          ...(r.teamReply ? { reply: { text: r.teamReply, by: r.teamReplyBy ?? "", at: r.teamReplyAt?.toISOString() ?? "" } } : {}),
        }))
      : [];
    // Synced meetings and published minutes read the same for every visitor, like the page's own calendar. Drafts never leave the server.
    const extras = page.isWorkspace
      ? { ...(await loadWorkspaceState(page, viewer)), practices: await practiceSummary(page.id), ...(await calendarFor(page.id, !!viewer)) }
      : { choices: {}, wins: [], contacts: [], people: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] };
    // A recognised visitor to a gated hub is handed the hub itself: the page they loaded carried only the cover.
    // The account team sees who has already been let in, so the page can say "Invited" instead of offering it again.
    const invited = viewer?.team ? (await db.select({ email: lpRoomMembersTable.email }).from(lpRoomMembersTable).where(and(eq(lpRoomMembersTable.pageId, page.id), eq(lpRoomMembersTable.status, "allowed"))).limit(2000)).map((m) => m.email) : null;
    const props = page.gated && viewer ? roomWorkspaceProps((await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, page.id)).limit(1))[0]?.blocks) : null;
    // The welcome gift is this person's own: offered unless the team turned it off for the hub or for them; accepted once they sent where to ship it.
    const gift = page.giftStep && viewer ? giftFor(await loadGiftSettings(page.id), viewer, true, (await giftAcceptedBy(page.id, page.giftStep.key)).filter((e) => e.toLowerCase() === viewer.email.toLowerCase())) : null;
    res.json({ viewer: viewer ? { email: viewer.email, name: viewer.name, ...(viewer.team ? { team: true } : {}) } : null, ...(viewAsEmail ? { viewAs: true } : {}), tasks, requests, ...extras, ...(props ? { props } : {}), ...(invited ? { invited } : {}), ...(gift ? { gift } : {}), ...(page.giftStep && !viewer ? { giftsEnabled: (await loadGiftSettings(page.id)).giftsEnabled } : {}) });
  } catch (err) {
    req.log.error({ err }, "room state failed");
    res.status(500).json({ error: "Could not load the hub" });
  }
});

/**
 * Ask to act in the room with a work email. Allowed address → we email a
 * link carrying a room token. Anything else → recorded as a request and the
 * team is told in Slack. The answer says which, so the page can tell the
 * visitor what happens next.
 */
router.post("/lp/room/access", accessLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await loadRoomPage(req.body?.pageId);
    const email = normalizeEmail(req.body?.email);
    if (!page || !email) {
      res.status(400).json({ error: "Enter a valid work email" });
      return;
    }
    const [settings, status] = await Promise.all([loadSettings(page.id), accessStatus(page, email)]);
    const url = await roomPageUrl(req, page, req.body?.path);
    if (isEmailAllowed(email, settings.allowedDomains, status)) {
      const sent = await sendRoomAccessEmail({
        recipientEmail: email,
        roomUrl: `${url}?rt=${encodeURIComponent(signRoomToken(page.id, email))}`,
        roomTitle: page.title,
        tenantId: page.tenantId,
      });
      if (!sent) {
        res.status(502).json({ error: "We couldn't send the email. Please try again in a minute." });
        return;
      }
      res.json({ status: "sent" });
      return;
    }
    if (status === "denied") {
      // Same answer as a fresh request: don't tell a refused address it was refused.
      res.json({ status: "requested" });
      return;
    }
    if (status !== "requested") {
      await db
        .insert(lpRoomMembersTable)
        .values({ tenantId: page.tenantId, pageId: page.id, email, status: "requested" })
        .onConflictDoNothing();
      notifyTeam(page, settings, "🔑 Hub access requested", [`*${mrk(email)}* asked for access to upload files and mark tasks done.`, "Approve or decline it on the hub’s page in LP Studio, under To do."], url);
    }
    res.json({ status: "requested" });
  } catch (err) {
    req.log.error({ err }, "room access failed");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

/** An action item from published minutes of a synced meeting ("ev-<event id>-<what>"): a task that can be ticked off. */
async function syncedMinutesTask(pageId: number, key: string): Promise<RoomTask | null> {
  const m = /^ev-(\d{1,10})-([a-z0-9-]{1,60})$/.exec(key);
  if (!m) return null;
  const [ev] = await db.select({ minutes: lpRoomEventsTable.minutes, status: lpRoomEventsTable.minutesStatus }).from(lpRoomEventsTable).where(and(eq(lpRoomEventsTable.id, Number(m[1])), eq(lpRoomEventsTable.pageId, pageId))).limit(1);
  if (!ev || ev.status !== "published") return null;
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "");
  const action = cleanMinutes(ev.minutes).actions.find((a) => slug(a.text) === m[2]);
  return action ? { key, title: action.text, action: "check" } : null;
}

async function requireActor(req: Request, res: Response): Promise<{ page: RoomPage; viewer: Viewer; task: RoomTask } | null> {
  const page = await loadRoomPage(req.body?.pageId);
  if (!page) {
    res.status(404).json({ error: "Hub not found" });
    return null;
  }
  const viewer = await resolveViewer(page, req.body ?? {}, req.authUser);
  if (!viewer) {
    res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
    return null;
  }
  const key = typeof req.body?.taskKey === "string" ? req.body.taskKey : "";
  // The action plan's "Upload logo" is the same task as the Overview's logo step, where the hub has one.
  const task = (key === ROOM_LOGO_TASK_KEY ? roomLogoTask(page.tasks) : null) ?? page.tasks.get(key) ?? (await syncedMinutesTask(page.id, key));
  if (!task) {
    res.status(404).json({ error: "That task isn't on this page any more" });
    return null;
  }
  return { page, viewer, task };
}

/**
 * Make an uploaded picture the hub's logo: a copy the hub can show (the
 * customer's upload itself stays private to the team), set on the page. A JPG
 * has no see-through background, so it keeps its own colours rather than being
 * turned into a white block on the cover.
 */
async function useAsHubLogo(page: RoomPage, buffer: Buffer, contentType: string): Promise<string | null> {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
  if (!row) return null;
  const url = `/api/storage${await objectStorage.uploadObjectEntity(buffer, contentType, { tenantId: page.tenantId })}`;
  const next = setRoomProps(row.blocks, { partnerLogoUrl: url, ...(contentType === "image/jpeg" ? { partnerLogoOriginal: true } : {}) });
  if (!next) return null;
  await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
  return url;
}

async function markDone(page: RoomPage, taskKey: string, viewer: Viewer): Promise<void> {
  await db
    .insert(lpRoomTaskStateTable)
    .values({ tenantId: page.tenantId, pageId: page.id, taskKey, completedByEmail: viewer.email, completedByName: viewer.name })
    .onConflictDoUpdate({
      target: [lpRoomTaskStateTable.pageId, lpRoomTaskStateTable.taskKey],
      set: { completedByEmail: viewer.email, completedByName: viewer.name, completedAt: sql`now()` },
    });
}

/** Tick (or un-tick) a task the page marks as the customer's to complete. */
router.post("/lp/room/task", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = await requireActor(req, res);
    if (!actor) return;
    const { page, viewer, task } = actor;
    const done = req.body?.done !== false;
    if (task.action === "upload" && done) {
      res.status(400).json({ error: "Upload the file to complete this task" });
      return;
    }
    if (done) {
      await markDone(page, task.key, viewer);
      const settings = await loadSettings(page.id);
      notifyTeam(page, settings, "✅ Task marked done", [`*${mrk(viewer.name || viewer.email)}* marked *${mrk(task.title)}* as done.`], await roomPageUrl(req, page, req.body?.path));
    } else {
      await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, page.id), eq(lpRoomTaskStateTable.taskKey, task.key)));
    }
    res.json({ ok: true, done });
  } catch (err) {
    req.log.error({ err }, "room task failed");
    res.status(500).json({ error: "Could not update the task" });
  }
});

/**
 * Hand over a file for an upload task. JSON + base64 on purpose: the edge WAF
 * in front of custom-domain hosts rejects raw binary POSTs (see the PDF
 * upload route). The file lands in a private folder the public serve route
 * cannot reach; the response never includes a URL.
 */
router.post("/lp/room/upload", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = await requireActor(req, res);
    if (!actor) return;
    const { page, viewer, task } = actor;
    if (task.action !== "upload") {
      res.status(400).json({ error: "This task doesn't take a file" });
      return;
    }
    const parsed = parseRoomUpload(req.body?.fileName, req.body?.fileBase64);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const objectPath = await objectStorage.uploadObjectEntity(parsed.buffer, parsed.contentType, { tenantId: page.tenantId, folder: ROOM_UPLOAD_FOLDER });
    const [saved] = await db.insert(lpRoomUploadsTable).values({
      tenantId: page.tenantId,
      pageId: page.id,
      taskKey: task.key,
      fileName: parsed.fileName,
      contentType: parsed.contentType,
      sizeBytes: parsed.buffer.length,
      objectPath,
      uploadedByEmail: viewer.email,
      uploadedByName: viewer.name,
    }).returning({ id: lpRoomUploadsTable.id });
    await markDone(page, task.key, viewer);
    // A roster (a list with a practice column) is read straight away: doctors are tied to practices, and regionals and addresses fill in.
    const roster = page.isWorkspace ? await applyRoster(page, { id: saved.id, fileName: parsed.fileName }, parsed.buffer).catch((err) => (req.log.warn({ err }, "room roster read failed"), null)) : null;
    // A picture uploaded as the logo becomes the hub's logo straight away (Settings, Account shows it; the team can swap it there).
    const logoUrl = page.isWorkspace && (task.key === ROOM_LOGO_STEP_KEY || task.key === ROOM_LOGO_TASK_KEY) && isLogoImage(parsed.contentType) ? await useAsHubLogo(page, parsed.buffer, parsed.contentType).catch((err) => (req.log.warn({ err }, "room logo set failed"), null)) : null;
    const settings = await loadSettings(page.id);
    notifyTeam(
      page,
      settings,
      logoUrl ? "🖼️ Logo received" : "📎 File received",
      [`*${mrk(viewer.name || viewer.email)}* uploaded *${mrk(parsed.fileName)}* for *${mrk(task.title)}*.`, logoUrl ? "It is now the hub's logo. Change it or its size under Settings, Account." : "Download it from the hub’s page in LP Studio, under To do."],
      await roomPageUrl(req, page, req.body?.path),
    );
    // The customer hears what to fix in the file; which practices Salesforce is missing is for the team.
    res.json({ ok: true, fileName: parsed.fileName, ...(logoUrl ? { logoUrl } : {}), ...(roster ? { roster: { practices: roster.practices, doctors: roster.doctors, issues: roster.issues } } : {}) });
  } catch (err) {
    req.log.error({ err }, "room upload failed");
    res.status(500).json({ error: "Upload failed. Please try again." });
  }
});

/**
 * Ask the team for something: a change to a launch-kit asset, new material,
 * training, anything else. Needs a known visitor so the request has a name
 * on it; lands in the room's Requests module and in Slack.
 */
router.post("/lp/room/request", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await loadRoomPage(req.body?.pageId);
    if (!page || !page.isWorkspace) {
      res.status(404).json({ error: "Hub not found" });
      return;
    }
    const viewer = await resolveViewer(page, req.body ?? {}, req.authUser);
    if (!viewer) {
      res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
      return;
    }
    const parsed = parseRoomRequest(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    // A gift turned off for this hub or this person can't be accepted from a page that was open before.
    if (page.giftStep && parsed.assetKey === page.giftStep.key && !giftFor(await loadGiftSettings(page.id), viewer, true, []).offered) {
      res.status(403).json({ error: "Welcome gifts aren't offered here. Your account team can tell you more." });
      return;
    }
    const [row] = await db
      .insert(lpRoomRequestsTable)
      .values({
        tenantId: page.tenantId,
        pageId: page.id,
        kind: parsed.kind,
        subject: parsed.subject,
        details: parsed.details,
        assetKey: parsed.assetKey,
        requestedByEmail: viewer.email,
        requestedByName: viewer.name,
      })
      .returning({ id: lpRoomRequestsTable.id });
    const settings = await loadSettings(page.id);
    notifyTeam(
      page,
      settings,
      "📝 New request",
      [`*${mrk(viewer.name || viewer.email)}* asked: *${mrk(parsed.subject)}* (${ROOM_REQUEST_KIND_LABEL[parsed.kind as RoomRequestKind]})`, ...(parsed.details ? [mrk(parsed.details).slice(0, 500)] : []), "Set an owner and status from the page's Room panel in LP Studio."],
      await roomPageUrl(req, page, req.body?.path),
    );
    res.json({ ok: true, id: row.id });
    // Marketing work also goes to the marketing intake in Asana (after the response; never blocks the request).
    if (ASANA_REQUEST_KINDS.includes(parsed.kind)) {
      const asana = await hubAsanaTarget(page.tenantId, settings.asanaProjectGid);
      void createIntakeTask({
        tenantId: page.tenantId,
        pageId: page.id,
        name: asanaRequestTaskName(page.partnerName || page.title, parsed.subject),
        notes: [`Requested by ${viewer.name ? `${viewer.name} (${viewer.email})` : viewer.email} in the ${page.partnerName || page.title} partner room.`, `Requested: ${new Date().toISOString().slice(0, 10)}`, `Type: ${ROOM_REQUEST_KIND_LABEL[parsed.kind as RoomRequestKind]}`, "", parsed.details ?? "", "", `Room: ${await roomPageUrl(req, page, req.body?.path)}`].join("\n"),
        projectGid: asana.projectGid,
        assigneeGid: asana.assigneeGid,
      })
        .then(async (result) => {
          if (result.taskId) await db.update(lpRoomRequestsTable).set({ asanaTaskGid: result.taskId }).where(eq(lpRoomRequestsTable.id, row.id));
          if (result.warning) req.log.warn({ pageId: page.id, warning: result.warning }, "room request asana warning");
        })
        .catch((err) => req.log.error({ err }, "room request asana failed"));
    }
  } catch (err) {
    req.log.error({ err }, "room request failed");
    res.status(500).json({ error: "Could not send the request. Please try again." });
  }
});

/**
 * The practice list's filters as a WHERE clause: region, wave (loosely, or NO_WAVE), the scorecard's
 * stage tiles, scanners, a search, and (team only) a product line and order recency. Shared by the list
 * itself and by "select all" (practice-ids), so a selection is exactly what the list shows.
 */
function practiceListWhere(pageId: number, body: Record<string, unknown> | undefined, team: boolean) {
  const b = body ?? {};
  const region = typeof b.region === "string" ? b.region.trim().slice(0, 80) : "";
  const wave = typeof b.wave === "string" ? b.wave.trim().slice(0, 80) : "";
  // The scorecard's tiles: one stage, or a group of them ("trained" counts live ones too, as the tile does).
  const STAGE_GROUPS: Record<string, string[]> = { not_started: ["not_started"], scheduling: ["scheduling"], training_booked: ["training_booked"], trained: ["trained", "live"], live: ["live"], open: ["not_started", "scheduling", "training_booked"] };
  const stages = typeof b.stage === "string" ? STAGE_GROUPS[b.stage] : undefined;
  const scanner = b.scanner === "yes" || b.scanner === "no" ? (b.scanner as "yes" | "no") : null;
  const q = typeof b.q === "string" ? b.q.trim().slice(0, 80).replace(/[%_\\]/g, "") : "";
  // Team only: practices that order a product line, or (among those with orders on record) that don't.
  const product = team && typeof b.product === "string" ? (PRODUCT_LINES.find(([, label]) => label === b.product)?.[1] ?? null) : null;
  const productLacks = b.productMode === "lacks";
  // Team only: practices by how long since their last order.
  const recency = team && (ORDER_RECENCY as readonly unknown[]).includes(b.recency) ? (b.recency as OrderRecency) : null;
  const cut = recencyCutoffs();
  const day = lpRoomPracticesTable.lastOrderDay;
  return and(
    eq(lpRoomPracticesTable.pageId, pageId),
    region ? eq(lpRoomPracticesTable.region, region) : undefined,
    wave ? inWave(wave) : undefined,
    stages ? inArray(lpRoomPracticesTable.stage, stages) : undefined,
    scanner === "yes" ? sql`${lpRoomPracticesTable.scannerCount} > 0` : scanner === "no" ? sql`COALESCE(${lpRoomPracticesTable.scannerCount}, 0) = 0` : undefined,
    recency === "week" ? sql`${day} >= ${cut.week}` : recency === "month" ? sql`${day} < ${cut.week} AND ${day} >= ${cut.month}` : recency === "quarter" ? sql`${day} < ${cut.month} AND ${day} >= ${cut.quarter}` : recency === "lapsed" ? sql`${day} < ${cut.quarter}` : undefined,
    product ? (productLacks ? sql`COALESCE(${lpRoomPracticesTable.products}, '') <> '' AND (', ' || ${lpRoomPracticesTable.products} || ', ') NOT LIKE ${`%, ${product}, %`}` : sql`(', ' || COALESCE(${lpRoomPracticesTable.products}, '') || ', ') LIKE ${`%, ${product}, %`}`) : undefined,
    q ? or(ilike(lpRoomPracticesTable.name, `%${q}%`), ilike(lpRoomPracticesTable.city, `%${q}%`), ilike(lpRoomPracticesTable.regionalManager, `%${q}%`)) : undefined,
  );
}

/** The practice list, for a known visitor: filter by region and name, 50 a page. */
router.post("/lp/room/practices", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    // The same filters as "select all" (practiceListWhere), so the list and the selection always agree.
    const where = practiceListWhere(page.id, req.body, !!viewer.team);
    const pageNo = Math.max(0, Math.min(1000, Math.floor(Number(req.body?.page) || 0)));
    // Sorting: one of a fixed set of columns (never a name from the request), blanks last.
    const SORTS = {
      name: lpRoomPracticesTable.name,
      region: lpRoomPracticesTable.region,
      wave: lpRoomPracticesTable.wave,
      stage: sql`CASE ${lpRoomPracticesTable.stage} WHEN 'live' THEN 5 WHEN 'trained' THEN 4 WHEN 'training_booked' THEN 3 WHEN 'scheduling' THEN 2 ELSE 1 END`,
      trainingDate: lpRoomPracticesTable.trainingDate,
      liveDate: lpRoomPracticesTable.liveDate,
      scannerSent: lpRoomPracticesTable.scannerSent,
      scannerActivated: lpRoomPracticesTable.scannerActivated,
      regionalManager: lpRoomPracticesTable.regionalManager,
      officeManager: lpRoomPracticesTable.officeManager,
      officeType: lpRoomPracticesTable.officeType,
      kitSentAt: lpRoomPracticesTable.kitSentAt,
      products: sql`COALESCE(array_length(string_to_array(NULLIF(${lpRoomPracticesTable.products}, ''), ', '), 1), 0)`,
      lastOrderDay: lpRoomPracticesTable.lastOrderDay,
      doctors: sql`(SELECT COUNT(*) FROM lp_room_doctors d WHERE d.practice_id = ${lpRoomPracticesTable.id})`,
      scannerCount: lpRoomPracticesTable.scannerCount,
      scannerBrand: lpRoomPracticesTable.scannerBrand,
      contractSigned: lpRoomPracticesTable.contractSigned,
      state: lpRoomPracticesTable.state,
      owner: lpRoomPracticesTable.owner,
      lastActivity: lpRoomPracticesTable.lastActivity,
    } as const;
    const sortKey = typeof req.body?.sort === "string" && req.body.sort in SORTS ? (req.body.sort as keyof typeof SORTS) : null;
    const down = req.body?.dir === "desc";
    const order = sortKey ? [down ? sql`${SORTS[sortKey]} DESC NULLS LAST` : sql`${SORTS[sortKey]} ASC NULLS LAST`, asc(lpRoomPracticesTable.name)] : [asc(lpRoomPracticesTable.region), asc(lpRoomPracticesTable.name)];
    const [rows, [{ n }], [has]] = await Promise.all([
      db.select().from(lpRoomPracticesTable).where(where).orderBy(...order).limit(50).offset(pageNo * 50),
      db.select({ n: sql<number>`COUNT(*)::int` }).from(lpRoomPracticesTable).where(where),
      // Which optional columns this room has any data for, so the page shows only those.
      db
        .select({ scanner: sql<boolean>`bool_or(${lpRoomPracticesTable.scannerSent} IS NOT NULL OR ${lpRoomPracticesTable.scannerActivated} IS NOT NULL)`, scannerCount: sql<boolean>`bool_or(${lpRoomPracticesTable.scannerCount} IS NOT NULL)`, manager: sql<boolean>`bool_or(${lpRoomPracticesTable.regionalManager} IS NOT NULL)`, wave: sql<boolean>`bool_or(${lpRoomPracticesTable.wave} IS NOT NULL)`, brand: sql<boolean>`bool_or(${lpRoomPracticesTable.scannerBrand} IS NOT NULL)`, contract: sql<boolean>`bool_or(${lpRoomPracticesTable.contractSigned} IS NOT NULL)`, owner: sql<boolean>`bool_or(${lpRoomPracticesTable.owner} IS NOT NULL)`, activity: sql<boolean>`bool_or(${lpRoomPracticesTable.lastActivity} IS NOT NULL)` })
        .from(lpRoomPracticesTable)
        .where(eq(lpRoomPracticesTable.pageId, page.id)),
    ]);
    // The doctors at the practices on this page of the list.
    const ids = rows.map((p) => p.id);
    const docs = ids.length ? await db.select({ practiceId: lpRoomDoctorsTable.practiceId, name: lpRoomDoctorsTable.name, role: lpRoomDoctorsTable.role }).from(lpRoomDoctorsTable).where(and(eq(lpRoomDoctorsTable.pageId, page.id), inArray(lpRoomDoctorsTable.practiceId, ids))).orderBy(asc(lpRoomDoctorsTable.name)).limit(2000) : [];
    const doctorsByPractice = new Map<number, { name: string; role: string | null }[]>();
    for (const d of docs) if (d.practiceId) doctorsByPractice.set(d.practiceId, [...(doctorsByPractice.get(d.practiceId) ?? []), { name: d.name, role: d.role }]);
    const [extra] = await db
      .select({ address: sql<boolean>`bool_or(${lpRoomPracticesTable.address} IS NOT NULL)`, office: sql<boolean>`bool_or(${lpRoomPracticesTable.officeManager} IS NOT NULL)`, officeType: sql<boolean>`bool_or(${lpRoomPracticesTable.officeType} IS NOT NULL)`, kit: sql<boolean>`bool_or(${lpRoomPracticesTable.kitSentAt} IS NOT NULL)`, products: sql<boolean>`bool_or(${lpRoomPracticesTable.products} IS NOT NULL)`, orders: sql<boolean>`bool_or(${lpRoomPracticesTable.lastOrderDay} IS NOT NULL)` })
      .from(lpRoomPracticesTable)
      .where(eq(lpRoomPracticesTable.pageId, page.id));
    const [anyDoctor] = await db.select({ id: lpRoomDoctorsTable.id }).from(lpRoomDoctorsTable).where(eq(lpRoomDoctorsTable.pageId, page.id)).limit(1);
    // Team only: how many practices order each product line, across the whole hub (not just this page of the list).
    const productSummary = viewer.team && extra?.products ? productLineSummary((await db.select({ products: lpRoomPracticesTable.products }).from(lpRoomPracticesTable).where(and(eq(lpRoomPracticesTable.pageId, page.id), sql`COALESCE(${lpRoomPracticesTable.products}, '') <> ''`)).limit(5000)).map((r) => r.products ?? "")) : null;
    res.json({
      total: n,
      page: pageNo,
      pageSize: 50,
      // The account owner and last sales activity are ours: only the team's own view gets them.
      columns: { scanner: !!has?.scanner, scannerCount: !!has?.scannerCount, manager: !!has?.manager, wave: !!has?.wave, brand: !!has?.brand, contract: !!has?.contract, address: !!extra?.address, office: !!extra?.office, officeType: !!extra?.officeType, kit: !!viewer.team && !!extra?.kit, products: !!viewer.team && !!extra?.products, orders: !!viewer.team && !!extra?.orders, doctors: !!anyDoctor, owner: !!viewer.team && !!has?.owner, activity: !!viewer.team && !!has?.activity },
      ...(productSummary ? { productSummary } : {}),
      ...(viewer.team && extra?.orders ? { orderRecency: orderRecencySummary((await db.select({ day: lpRoomPracticesTable.lastOrderDay }).from(lpRoomPracticesTable).where(and(eq(lpRoomPracticesTable.pageId, page.id), sql`${lpRoomPracticesTable.lastOrderDay} IS NOT NULL`)).limit(5000)).map((r) => r.day)) } : {}),
      rows: rows.map((p) => ({
        id: p.id, name: p.name, region: p.region, city: p.city, state: p.state, wave: p.wave, stage: p.stage, trainingDate: p.trainingDate, liveDate: p.liveDate, scannerSent: p.scannerSent, scannerActivated: p.scannerActivated, regionalManager: p.regionalManager, scannerCount: p.scannerCount, scannerModels: p.scannerModels,
        scannerBrand: p.scannerBrand, contractSigned: p.contractSigned,
        address: p.address, zip: p.zip, officeManager: p.officeManager, officeType: p.officeType, phone: p.phone,
        ...(viewer.team ? { kitSentAt: p.kitSentAt ? p.kitSentAt.toISOString() : null } : {}),
        // What a practice orders and how recently is ours to see, not the customer's.
        ...(viewer.team ? { products: p.products == null ? null : p.products.split(", ").filter(Boolean), lastOrderDay: p.lastOrderDay, tenthOrderDay: p.tenthOrderDay } : {}),
        doctors: doctorsByPractice.get(p.id) ?? [],
        ...(viewer.team ? { owner: p.owner, lastActivity: p.lastActivity } : {}),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "room practices failed");
    res.status(500).json({ error: "Could not load practices" });
  }
});

/**
 * Team only: practices as a CSV, for a mailing list or a hand-off to another
 * tool. `ids` picks the ones ticked on the scorecard; without it, every
 * practice in the hub. Addresses and phone numbers are in it, so a customer
 * or a stranger never gets one.
 */
router.post("/lp/room/practices-export", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    if (!ctx.viewer.team) {
      res.status(403).json({ error: "Not available" });
      return;
    }
    const ids = Array.isArray(req.body?.ids) ? [...new Set((req.body.ids as unknown[]).filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0))].slice(0, 5000) : null;
    if (ids && ids.length === 0) {
      res.status(400).json({ error: "Nothing selected" });
      return;
    }
    const rows = await db
      .select({ id: lpRoomPracticesTable.id, externalId: lpRoomPracticesTable.externalId, name: lpRoomPracticesTable.name, address: lpRoomPracticesTable.address, city: lpRoomPracticesTable.city, state: lpRoomPracticesTable.state, zip: lpRoomPracticesTable.zip, phone: lpRoomPracticesTable.phone, officeType: lpRoomPracticesTable.officeType, regionalManager: lpRoomPracticesTable.regionalManager, officeManager: lpRoomPracticesTable.officeManager, region: lpRoomPracticesTable.region, wave: lpRoomPracticesTable.wave, stage: lpRoomPracticesTable.stage, sourceStatus: lpRoomPracticesTable.sourceStatus, scannerCount: lpRoomPracticesTable.scannerCount, trainingDate: lpRoomPracticesTable.trainingDate, liveDate: lpRoomPracticesTable.liveDate })
      .from(lpRoomPracticesTable)
      .where(and(eq(lpRoomPracticesTable.pageId, ctx.page.id), ids ? inArray(lpRoomPracticesTable.id, ids) : undefined))
      .orderBy(asc(lpRoomPracticesTable.name))
      .limit(5000);
    const slug = ctx.page.partnerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "hub";
    res.json({ fileName: `${slug}-practices-${new Date().toISOString().slice(0, 10)}.csv`, count: rows.length, csv: practicesExportCsv(rows) });
  } catch (err) {
    req.log.error({ err }, "room practices export failed");
    res.status(500).json({ error: "Could not export" });
  }
});

/**
 * Team only: add the ticked practices to the marketing team's welcome kit
 * list (a sheet their direct-mail workflow reads). `dryRun` answers what
 * would be sent, for the page's confirm step. A practice already on the list,
 * or with no full mailing address, is left out and named. Marketing is told
 * in Slack and with an intake task when practices were added.
 */
/**
 * Team only: the ids of every practice the list's filters match (the same filters as the list itself:
 * wave, region, status, scanners, search…), across every page, so "Select all" picks exactly what the
 * list shows. No filters = every practice on the hub.
 */
router.post("/lp/room/practice-ids", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    if (!viewer.team) {
      res.status(403).json({ error: "Not available" });
      return;
    }
    const wave = typeof req.body?.wave === "string" ? req.body.wave.trim().slice(0, 80) : "";
    const rows = await db.select({ id: lpRoomPracticesTable.id, kitSentAt: lpRoomPracticesTable.kitSentAt }).from(lpRoomPracticesTable).where(practiceListWhere(page.id, req.body, true)).orderBy(asc(lpRoomPracticesTable.id)).limit(5000);
    res.json({ wave, ids: rows.map((r) => r.id), kitSent: rows.filter((r) => r.kitSentAt).length });
  } catch (err) {
    req.log.error({ err }, "room practice ids failed");
    res.status(500).json({ error: "Could not load that wave" });
  }
});

/**
 * Team only, from the hub's Scorecard: put the ticked practices into a wave (by the wave's name, as the
 * hub's Stage and waves names it), or take them out of their wave with a blank one. The same change the
 * Sales Console's practice list makes, for a rep looking at the hub itself.
 */
router.post("/lp/room/practices-wave", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    if (!viewer.team) {
      res.status(403).json({ error: "Only the account team can change waves" });
      return;
    }
    const ids = Array.isArray(req.body?.ids) ? [...new Set((req.body.ids as unknown[]).filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0))].slice(0, 2000) : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "Nothing selected" });
      return;
    }
    const wave = typeof req.body?.wave === "string" ? req.body.wave.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    const updated = await db
      .update(lpRoomPracticesTable)
      .set({ wave: wave || null, updatedAt: sql`now()` })
      .where(and(eq(lpRoomPracticesTable.pageId, page.id), inArray(lpRoomPracticesTable.id, ids)))
      .returning({ id: lpRoomPracticesTable.id });
    res.json({ ok: true, moved: updated.length, wave: wave || null });
  } catch (err) {
    req.log.error({ err }, "room practices wave (hub) failed");
    res.status(500).json({ error: "Could not change the wave" });
  }
});

/**
 * Add practices to the welcome kit list and tell marketing. Shared by the
 * hub's own Scorecard (a team member looking at the hub) and the Sales
 * Console's practice list, so both follow the same rules: no kits where the
 * account bars direct outreach, none sent twice, none without an address.
 */
async function sendKitsFromRequest(req: Request, res: Response, page: RoomPage, by: string): Promise<void> {
    const ids = Array.isArray(req.body?.ids) ? [...new Set((req.body.ids as unknown[]).filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0))].slice(0, 2000) : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "Nothing selected" });
      return;
    }
    if (await hubRestrictsOutreach(page.id)) {
      res.status(400).json({ error: "This account doesn't allow direct outreach to its practices, so welcome kits can't be sent from the hub.", sent: [], already: [], noAddress: [] });
      return;
    }
    const settings = await loadSettings(page.id);
        const customer = page.partnerName || page.title;
    const result = await sendWelcomeKits({ id: page.id, tenantId: page.tenantId, partnerName: customer }, { ids, by, sfdcAccountId: settings.sfdcAccountId, dryRun: req.body?.dryRun === true });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? "Could not add to the welcome kit list", sent: [], already: result.already, noAddress: result.noAddress });
      return;
    }
    const dryRun = req.body?.dryRun === true;
    res.json({ ok: true, dryRun, sent: result.sent, already: result.already, noAddress: result.noAddress, sheetUrl: result.sheetUrl });
    if (dryRun || result.sent.length === 0) return;
    // Tell marketing (after the response; never blocks it): the hub's Slack channel, and the marketing intake in Asana.
    const notice = kitNotice(customer, result.sent, by, result.sheetUrl ?? "");
    // The sheet's link goes in as a link: `mrk` would break the underscores in its id.
    notifyTeam(page, settings, `📦 ${notice.title}`, [...notice.lines.slice(0, -1).map(mrk), ...(result.sheetUrl ? [`<${result.sheetUrl}|Open the welcome kit list>`] : [])], await roomPageUrl(req, page, req.body?.path));
    // The request to actually send the kits: marketing's intake in Asana, with the day it was asked and the list.
    const kitTask = kitAsanaTask(customer, result.sent, by, result.sheetUrl ?? "", new Date().toISOString().slice(0, 10));
    const asana = await hubAsanaTarget(page.tenantId, settings.asanaProjectGid);
    void createIntakeTask({ tenantId: page.tenantId, pageId: page.id, name: asanaRequestTaskName(customer, kitTask.subject), notes: `${kitTask.notes}\n\nHub: ${await roomPageUrl(req, page, req.body?.path)}`, projectGid: asana.projectGid, assigneeGid: asana.assigneeGid })
      .then((r) => r.warning && req.log.warn({ pageId: page.id, warning: r.warning }, "welcome kit asana warning"))
      .catch((err) => req.log.error({ err }, "welcome kit asana failed"));
}

router.post("/lp/room/welcome-kit", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    if (!viewer.team) {
      res.status(403).json({ error: "Not available" });
      return;
    }
    await sendKitsFromRequest(req, res, page, viewer.name || viewer.email);
  } catch (err) {
    req.log.error({ err }, "room welcome kit failed");
    if (!res.headersSent) res.status(500).json({ error: "Could not add to the welcome kit list" });
  }
});

/**
 * Every practice with a map position, for the scorecard's map.
 *
 * For the team by default: the map shows which of the customer's offices are
 * not ordering. A hub with "show the map to anyone who opens it" switched on
 * also answers visitors, with less detail (no street address, phone or scanner
 * count). A hub that asks for an email still tells a stranger nothing.
 *
 * A practice is placed at the middle of its ZIP code (looked up on the server,
 * so no address goes to an outside service); one with no ZIP we know is
 * counted in `unplaced` and listed without a position.
 */
router.post("/lp/room/practice-map", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await loadRoomPage(req.body?.pageId);
    if (!page || !page.isWorkspace) {
      res.status(404).json({ error: "Hub not found" });
      return;
    }
    const viewer = await resolveViewer(page, req.body ?? {}, req.authUser);
    if (page.gated && !viewer) {
      res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
      return;
    }
    const team = !!viewer?.team;
    if (!team && !page.mapShared) {
      res.status(403).json({ error: "Not available" });
      return;
    }
    const rows = await db
      .select({ id: lpRoomPracticesTable.id, name: lpRoomPracticesTable.name, stage: lpRoomPracticesTable.stage, region: lpRoomPracticesTable.region, city: lpRoomPracticesTable.city, state: lpRoomPracticesTable.state, zip: lpRoomPracticesTable.zip, address: lpRoomPracticesTable.address, regionalManager: lpRoomPracticesTable.regionalManager, officeType: lpRoomPracticesTable.officeType, phone: lpRoomPracticesTable.phone, scannerCount: lpRoomPracticesTable.scannerCount })
      .from(lpRoomPracticesTable)
      .where(eq(lpRoomPracticesTable.pageId, page.id))
      .orderBy(asc(lpRoomPracticesTable.name))
      .limit(5000);
    let unplaced = 0;
    const points = rows.map((p) => {
      const at = zipCentroid(p.zip);
      if (!at) unplaced++;
      const shared = { id: p.id, name: p.name, stage: p.stage, region: p.region, city: p.city, state: p.state, regionalManager: p.regionalManager, officeType: p.officeType, lat: at?.lat ?? null, lng: at?.lng ?? null };
      return team ? { ...shared, zip: p.zip, address: p.address, phone: p.phone, scannerCount: p.scannerCount } : { ...shared, zip: null, address: null, phone: null, scannerCount: null };
    });
    res.json({ points, unplaced });
  } catch (err) {
    req.log.error({ err }, "room practice map failed");
    res.status(500).json({ error: "Could not load the map" });
  }
});

/**
 * An asset event from a room (viewed, opened, downloaded, video progress, time
 * in the viewer). Same shape as the hub's beacon, plus who it was when the
 * visitor is identified. Always answers 204: tracking never blocks the page.
 */
/** The roster template for this room (its practices, ready for doctors and corrections), for a known visitor to download. */
router.post("/lp/room/roster-template", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const slug = ctx.page.partnerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "roster";
    res.json({ fileName: `${slug}-practice-and-doctor-roster.csv`, csv: await roomRosterTemplate(ctx.page.id) });
  } catch (err) {
    req.log.error({ err }, "room roster template failed");
    res.status(500).json({ error: "Could not make the template" });
  }
});

/**
 * Team only, from the live page: invite one of the customer's people. They
 * are let into the hub and emailed a personal link that opens it as them.
 * Same effect as the invite list in the Room panel, one person at a time.
 */
router.post("/lp/room/invite", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    if (!ctx.viewer.team) {
      res.status(403).json({ error: "Only the account team can send invitations" });
      return;
    }
    const email = normalizeEmail(req.body?.email);
    const name = typeof req.body?.name === "string" ? req.body.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (!email) {
      res.status(400).json({ error: "That person has no valid email address." });
      return;
    }
    const [row] = await db.select({ status: lpPagesTable.status }).from(lpPagesTable).where(eq(lpPagesTable.id, ctx.page.id)).limit(1);
    if (row?.status !== "published") {
      res.status(400).json({ error: "Publish the hub first. An invitation to a draft would open an empty page." });
      return;
    }
    await db
      .insert(lpRoomMembersTable)
      .values({ tenantId: ctx.page.tenantId, pageId: ctx.page.id, email, status: "allowed" })
      .onConflictDoUpdate({ target: [lpRoomMembersTable.pageId, lpRoomMembersTable.email], set: { status: "allowed", updatedAt: sql`now()` } });
    await rememberInvited(ctx.page, email, name, ctx.viewer.email).catch(() => {});
    const url = await roomPageUrl(req, ctx.page, req.body?.path);
    const sent = await sendRoomInviteEmail({ recipientEmail: email, recipientName: name, invitedBy: ctx.viewer.name || ctx.viewer.email, roomUrl: `${url}?rt=${encodeURIComponent(signRoomToken(ctx.page.id, email))}`, roomTitle: ctx.page.title, tenantId: ctx.page.tenantId }).catch(() => false);
    if (!sent) {
      res.status(502).json({ error: "They were added, but the email couldn't be sent. Try again in a minute." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room invite (live) failed");
    res.status(500).json({ error: "Could not send the invitation" });
  }
});

/**
 * Team only, from the live page: change a milestone's status, owners or
 * target date. Writes the page itself, so the builder and the customer see
 * the same plan. Setting a status other than "done" also clears a customer's
 * own "marked complete", or the row would keep showing as done.
 */
router.post("/lp/room/plan-edit", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    if (!ctx.viewer.team) {
      res.status(403).json({ error: "Only the account team can change the plan" });
      return;
    }
    const key = typeof req.body?.key === "string" ? req.body.key.trim().slice(0, 120) : "";
    const patch = parseMilestonePatch(req.body);
    if (!key || !patch) {
      res.status(400).json({ error: "Nothing to change" });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, ctx.page.id), eq(lpPagesTable.tenantId, ctx.page.tenantId))).limit(1);
    const next = row ? setRoomMilestone(row.blocks, key, patch) : null;
    if (!next) {
      res.status(404).json({ error: "That milestone isn't on this page any more" });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, ctx.page.id));
    if (patch.status && patch.status !== "done") await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, ctx.page.id), eq(lpRoomTaskStateTable.taskKey, key)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room plan edit failed");
    res.status(500).json({ error: "Could not save the change" });
  }
});

/**
 * Team only, from the live page: delete plan steps (several at once). They leave the page itself, so the
 * builder and the customer see the same plan, and their saved ticks and uploads' completion go with them.
 */
router.post("/lp/room/plan-delete", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    if (!ctx.viewer.team) {
      res.status(403).json({ error: "Only the account team can change the plan" });
      return;
    }
    const keys = Array.isArray(req.body?.keys) ? [...new Set((req.body.keys as unknown[]).filter((k): k is string => typeof k === "string" && !!k.trim()).map((k) => k.trim().slice(0, 120)))].slice(0, 500) : [];
    if (keys.length === 0) {
      res.status(400).json({ error: "Nothing selected" });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, ctx.page.id), eq(lpPagesTable.tenantId, ctx.page.tenantId))).limit(1);
    const out = row ? removeRoomMilestones(row.blocks, keys) : null;
    if (!out) {
      res.status(404).json({ error: "Those steps aren't on this page any more" });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: out.blocks as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, ctx.page.id));
    await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, ctx.page.id), inArray(lpRoomTaskStateTable.taskKey, keys)));
    res.json({ ok: true, removed: out.removed });
  } catch (err) {
    req.log.error({ err }, "room plan delete failed");
    res.status(500).json({ error: "Could not delete the steps" });
  }
});

/**
 * Move a request along from the live page. The account team can set its
 * status, owner and target date. The customer can do one thing: approve a
 * request that is ready for their review, which closes it.
 */
router.post("/lp/room/request-update", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Which request?" });
      return;
    }
    const mine = and(eq(lpRoomRequestsTable.id, id), eq(lpRoomRequestsTable.pageId, ctx.page.id), eq(lpRoomRequestsTable.tenantId, ctx.page.tenantId));
    if (!ctx.viewer.team) {
      if (req.body?.status !== "done" || req.body?.owner !== undefined || req.body?.due !== undefined) {
        res.status(403).json({ error: "Only the account team can change a request" });
        return;
      }
      const approved = await db.update(lpRoomRequestsTable).set({ status: "done", updatedAt: sql`now()` }).where(and(mine, eq(lpRoomRequestsTable.status, "review"))).returning({ id: lpRoomRequestsTable.id });
      if (approved.length === 0) {
        res.status(400).json({ error: "This request isn't waiting for your review" });
        return;
      }
      res.json({ ok: true });
      return;
    }
    const set: { status?: string; owner?: string | null; due?: string | null; teamReply?: string | null; teamReplyBy?: string | null; teamReplyAt?: Date | null; updatedAt: ReturnType<typeof sql> } = { updatedAt: sql`now()` };
    // An answer to the customer: it shows on the request in their hub. Blank takes it back.
    if (req.body?.reply !== undefined) {
      const reply = String(req.body.reply ?? "").trim().slice(0, 2000);
      set.teamReply = reply || null;
      set.teamReplyBy = reply ? (req.authUser?.name || req.authUser?.email || "Your account team") : null;
      set.teamReplyAt = reply ? new Date() : null;
    }
    if (req.body?.status !== undefined) {
      if (!(ROOM_REQUEST_STATUSES as readonly string[]).includes(String(req.body.status))) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      set.status = String(req.body.status);
    }
    if (req.body?.owner !== undefined) set.owner = String(req.body.owner ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
    if (req.body?.due !== undefined) set.due = String(req.body.due ?? "").trim().slice(0, 40) || null;
    const updated = await db.update(lpRoomRequestsTable).set(set).where(mine).returning({ id: lpRoomRequestsTable.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room request update failed");
    res.status(500).json({ error: "Could not update the request" });
  }
});

/**
 * Team only: does what Salesforce lists match the customer's own rosters?
 * Compares the practice list (from Salesforce) with the newest roster the
 * customer uploaded, and counts the doctors on their doctor roster. A
 * customer never gets this: it is about our data, and names their files.
 */
router.post("/lp/room/scorecard-check", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    if (!ctx.viewer.team) {
      res.status(403).json({ error: "Not available" });
      return;
    }
    // A roster read on upload has the fuller answer (matched by ID, doctors tied to practices); older uploads fall back to comparing names.
    const roster = await latestRosterResult(ctx.page.id);
    if (roster) {
      res.json({
        checked: true,
        fileName: roster.fileName,
        onRoster: roster.practices,
        matched: roster.matched,
        missingFromSalesforce: roster.unmatched.slice(0, 200),
        missingCount: roster.unmatched.length,
        notOnRoster: roster.notOnRoster.slice(0, 200),
        notOnRosterCount: roster.notOnRoster.length,
        doctors: roster.hasDoctors ? roster.doctors : null,
        doctorsUnmatched: roster.doctorsUnmatched,
        likely: roster.likely.slice(0, 100),
        issues: roster.issues,
        enriched: roster.enriched,
        added: roster.added ?? 0,
      });
      return;
    }
    const gap = await loadSalesforceGap(ctx.page.id);
    if (!gap) {
      res.json({ checked: false });
      return;
    }
    res.json({
      checked: true,
      fileName: gap.fileName,
      onRoster: gap.uploaded,
      listed: gap.listed ?? 0,
      matched: gap.matched,
      missingFromSalesforce: gap.missing.slice(0, 200),
      missingCount: gap.missing.length,
      notOnRoster: (gap.notOnRoster ?? []).slice(0, 200),
      notOnRosterCount: (gap.notOnRoster ?? []).length,
      doctors: gap.doctors,
    });
  } catch (err) {
    req.log.error({ err }, "room scorecard check failed");
    res.status(500).json({ error: "Could not compare the rosters" });
  }
});

router.post("/lp/room/asset", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = parseAssetEventBody(req.body);
    const page = parsed ? await loadRoomPage(parsed.pageId) : null;
    if (parsed && page) {
      const viewer = await resolveViewer(page, req.body ?? {}, req.authUser).catch(() => null);
      await db.insert(lpAssetEventsTable).values({
        tenantId: page.tenantId,
        pageId: page.id,
        blockId: parsed.blockId,
        assetKey: parsed.assetKey,
        assetTitle: parsed.assetTitle,
        assetKind: parsed.assetKind,
        action: parsed.action,
        sessionId: parsed.sessionId,
        value: parsed.value,
        detail: parsed.detail,
        viewerEmail: viewer?.email ?? null,
        viewerName: viewer?.name ?? null,
      });
    }
  } catch (err) {
    req.log.warn({ err }, "room asset event failed");
  }
  res.status(204).end();
});

/** "View as the customer" posts its visit alert at most this often per person and hub (each section opened would post otherwise). */
const PREVIEW_VISIT_QUIET_MS = 10 * 60 * 1000;
const previewVisitAt = new Map<string, number>();

/**
 * A visitor opened a section of the hub (seconds 0), or left it (the seconds
 * they spent). One row per opening; the page's own team is never recorded,
 * and nothing is recorded behind an email gate nobody has passed.
 */
router.post("/lp/room/view", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = parseRoomView(req.body);
    const page = parsed ? await loadRoomPage(parsed.pageId) : null;
    if (parsed && page?.isWorkspace) {
      const viewer = await resolveViewer(page, req.body ?? {}, req.authUser).catch(() => null);
      // A team member using "View as the customer" gets the same Slack visit alert a customer would set off
      // (marked as a preview), so the alert can be seen working. Nothing is recorded: Engagement stays the customer's.
      if (viewer?.team && req.body?.asCustomer === true && parsed.seconds === 0) {
        const at = previewVisitAt.get(`${page.id}:${viewer.email}`) ?? 0;
        if (Date.now() - at > PREVIEW_VISIT_QUIET_MS) {
          const [cfg] = await db.select({ visitAlert: lpRoomSettingsTable.visitAlert, slackChannelId: lpRoomSettingsTable.slackChannelId }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1);
          if (cfg?.visitAlert) {
            previewVisitAt.set(`${page.id}:${viewer.email}`, Date.now());
            postToSlack(page, cfg.slackChannelId, "Partner Hub visit", [`*${mrk(viewer.name || viewer.email)}* is in the hub, viewing it as the customer.`, "_A preview by your own team, not a customer visit._"], await roomPageUrl(req, page, req.body?.path).catch(() => undefined));
          }
        }
      }
      if (!viewer?.team && !(page.gated && !viewer)) {
        // Tell the team in Slack when a named customer arrives, if the hub asks for it and they have not been in for a while.
        if (viewer && parsed.seconds === 0) {
          const [cfg] = await db.select({ visitAlert: lpRoomSettingsTable.visitAlert, slackChannelId: lpRoomSettingsTable.slackChannelId }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1);
          if (cfg?.visitAlert) {
            const [seen] = await db
              .select({ id: lpRoomViewsTable.id })
              .from(lpRoomViewsTable)
              .where(and(eq(lpRoomViewsTable.pageId, page.id), eq(lpRoomViewsTable.viewerEmail, viewer.email), gte(lpRoomViewsTable.createdAt, new Date(Date.now() - VISIT_ALERT_QUIET_MS))))
              .limit(1);
            if (!seen) postToSlack(page, cfg.slackChannelId, "Partner Hub visit", [`*${mrk(viewer.name || viewer.email)}*${viewer.name ? ` (${mrk(viewer.email)})` : ""} is in the hub.`], await roomPageUrl(req, page, req.body?.path).catch(() => undefined));
          }
        }
        await db
          .insert(lpRoomViewsTable)
          .values({ tenantId: page.tenantId, pageId: page.id, viewId: parsed.viewId, sessionId: parsed.sessionId, module: parsed.module, seconds: parsed.seconds, viewerEmail: viewer?.email ?? null, viewerName: viewer?.name ?? null })
          .onConflictDoUpdate({
            target: [lpRoomViewsTable.pageId, lpRoomViewsTable.viewId],
            set: { seconds: sql`GREATEST(${lpRoomViewsTable.seconds}, ${parsed.seconds})`, viewerEmail: sql`COALESCE(${lpRoomViewsTable.viewerEmail}, ${viewer?.email ?? null})`, viewerName: sql`COALESCE(${lpRoomViewsTable.viewerName}, ${viewer?.name ?? null})` },
          });
      }
    }
  } catch (err) {
    req.log.warn({ err }, "room view event failed");
  }
  res.status(204).end();
});

/** The room's calendar as an iCalendar feed a calendar app can subscribe to. Events come from the page itself, which is already open to anyone with the link. */
router.get("/lp/room/calendar.ics", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const pageId = Number(req.query.pageId);
    const [found] = Number.isFinite(pageId) && pageId > 0 ? await db.select({ title: lpPagesTable.title, blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1) : [];
    // A gated hub's calendar is for its people: the feed address carries the subscriber's own room token.
    const room = found && roomRequiresEmail(found.blocks) ? await loadRoomPage(pageId) : null;
    const rt = typeof req.query.rt === "string" ? req.query.rt : "";
    // A subscriber whose feed address carries their room token is known: their feed includes the practice trainings.
    const subscriberRoom = rt && found ? (room ?? (await loadRoomPage(pageId))) : null;
    const known = subscriberRoom ? !!(await resolveViewer(subscriberRoom, { rt })) : false;
    const allowed = !found || !roomRequiresEmail(found.blocks) || (!!room && known);
    const page = allowed ? found : undefined;
    const synced = page ? (await calendarFor(pageId, known)).events : [];
    const ics = page ? roomCalendarIcs(resolveRoomBlocks(page.blocks), `${roomPartnerName(page.blocks) || page.title} partnership`, synced) : null;
    if (!ics) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", room || known ? "private, max-age=900" : "public, max-age=900");
    res.send(ics);
  } catch (err) {
    req.log.error({ err }, "room calendar feed failed");
    res.status(500).end();
  }
});

/** Record a decision the page offers (a marketing program's option). */
router.post("/lp/room/choice", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    const spec = page.choices.get(typeof req.body?.key === "string" ? req.body.key : "");
    const value = typeof req.body?.value === "string" ? req.body.value : "";
    if (!spec || !spec.options.includes(value)) {
      res.status(400).json({ error: "That option isn't available" });
      return;
    }
    await db
      .insert(lpRoomChoicesTable)
      .values({ tenantId: page.tenantId, pageId: page.id, choiceKey: spec.key, value, chosenByEmail: viewer.email, chosenByName: viewer.name })
      .onConflictDoUpdate({ target: [lpRoomChoicesTable.pageId, lpRoomChoicesTable.choiceKey], set: { value, chosenByEmail: viewer.email, chosenByName: viewer.name, chosenAt: sql`now()` } });
    const settings = await loadSettings(page.id);
    notifyTeam(page, settings, "🗳️ Marketing plan decision", [`*${mrk(viewer.name || viewer.email)}* chose *${mrk(value)}* for *${mrk(spec.title)}*.`, ...(isDeclineChoice(value) ? [] : ["It is waiting in the hub's marketing plan queue: send it to marketing from Manage → Activity."])], await roomPageUrl(req, page, req.body?.path));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room choice failed");
    res.status(500).json({ error: "Could not save your choice" });
  }
});

/** Add a person to the customer's side of the team; completes the "add your team" onboarding step. */
router.post("/lp/room/contact", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    const parsed = parseRoomContact(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [{ n }] = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM lp_room_contacts WHERE page_id = ${page.id}`)).rows as Array<{ n: number }>;
    if (n >= 100) {
      res.status(400).json({ error: "That's the most people a hub can hold. Ask your team to tidy the list." });
      return;
    }
    await db.insert(lpRoomContactsTable).values({ tenantId: page.tenantId, pageId: page.id, name: parsed.name, role: parsed.role, email: parsed.email, addedByEmail: viewer.email });
    if (page.teamStepKey) await markDone(page, page.teamStepKey, viewer);
    const settings = await loadSettings(page.id);
    notifyTeam(page, settings, "👤 Team contact added", [`*${mrk(viewer.name || viewer.email)}* added *${mrk(parsed.name)}*${parsed.role ? ` (${mrk(parsed.role)})` : ""}${parsed.email ? ` · ${mrk(parsed.email)}` : ""}.`], await roomPageUrl(req, page, req.body?.path));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room contact failed");
    res.status(500).json({ error: "Could not add that person" });
  }
});

/** Post a win to the feed. */
router.post("/lp/room/win", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    const images = parseWinImages(req.body?.images);
    // A photo can stand on its own; otherwise a few words are needed.
    const parsed = parseRoomWin({ body: req.body?.body || (images.length > 0 ? "(photo)" : ""), region: req.body?.region });
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const body = req.body?.body ? parsed.body : "";
    const mentioned = resolveMentions(body, req.body?.mentions, await roomPeople(page));
    await db.insert(lpRoomWinsTable).values({
      tenantId: page.tenantId,
      pageId: page.id,
      body,
      region: parsed.region,
      images,
      mentions: mentioned.map((m) => m.name),
      authorSide: viewer.team ? "team" : "customer",
      authorEmail: viewer.email,
      authorName: viewer.name,
    });
    const [settings, url] = await Promise.all([loadSettings(page.id), roomPageUrl(req, page, req.body?.path)]);
    const photos = images.length > 0 ? ` _(${images.length} ${images.length === 1 ? "photo" : "photos"})_` : "";
    notifyTeam(page, settings, "🏆 New win posted", [`*${mrk(viewer.name || viewer.email)}*: ${mrk(body).slice(0, 500)}${photos}`], url);
    sendFeedAlerts(page, feedAlertsFor({ authorEmail: viewer.email, mentioned, comment: false }), viewer.name || "Someone", body, url);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room win failed");
    res.status(500).json({ error: "Could not post" });
  }
});

/** The win on THIS page (with who shared it), or null. */
async function winRowOnPage(page: RoomPage, winIdRaw: unknown): Promise<{ id: number; authorEmail: string } | null> {
  const winId = typeof winIdRaw === "number" ? Math.floor(winIdRaw) : NaN;
  if (!Number.isFinite(winId)) return null;
  const [w] = await db.select({ id: lpRoomWinsTable.id, authorEmail: lpRoomWinsTable.authorEmail }).from(lpRoomWinsTable).where(and(eq(lpRoomWinsTable.id, winId), eq(lpRoomWinsTable.pageId, page.id))).limit(1);
  return w ?? null;
}
async function winOnPage(page: RoomPage, winIdRaw: unknown): Promise<number | null> {
  return (await winRowOnPage(page, winIdRaw))?.id ?? null;
}

/**
 * A photo for a win. Sent as base64 like the task uploads, but it lands where
 * the page can show it: the feed is readable by anyone who can open the room,
 * and so are its photos. PNG or JPEG only, checked by content.
 */
router.post("/lp/room/win-image", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const parsed = parseRoomUpload(req.body?.fileName, req.body?.fileBase64);
    if (!parsed.ok || !parsed.contentType.startsWith("image/")) {
      res.status(400).json({ error: parsed.ok ? "Photos need to be PNG or JPEG images." : parsed.error });
      return;
    }
    const objectPath = await objectStorage.uploadObjectEntity(parsed.buffer, parsed.contentType, { tenantId: ctx.page.tenantId });
    res.json({ ok: true, url: `/api/storage${objectPath}` });
  } catch (err) {
    req.log.error({ err }, "room win image failed");
    res.status(500).json({ error: "Couldn't add that photo. Please try again." });
  }
});

/** Like or unlike a win (one per person). */
router.post("/lp/room/win/like", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    const winId = await winOnPage(page, req.body?.winId);
    if (!winId) {
      res.status(404).json({ error: "That post is gone" });
      return;
    }
    const emoji = parseReaction(req.body?.emoji);
    if (!emoji) {
      res.status(400).json({ error: "That reaction isn't available" });
      return;
    }
    const removed = await db
      .delete(lpRoomWinLikesTable)
      .where(and(eq(lpRoomWinLikesTable.winId, winId), eq(lpRoomWinLikesTable.email, viewer.email), eq(lpRoomWinLikesTable.emoji, emoji)))
      .returning({ id: lpRoomWinLikesTable.id });
    if (removed.length === 0) await db.insert(lpRoomWinLikesTable).values({ tenantId: page.tenantId, winId, email: viewer.email, emoji }).onConflictDoNothing();
    res.json({ ok: true, liked: removed.length === 0 });
  } catch (err) {
    req.log.error({ err }, "room like failed");
    res.status(500).json({ error: "Could not save" });
  }
});


// Who did what to a hub, noted after any change through these routes succeeds.
router.use("/lp/partner-rooms/:pageId", recordHubActivity);

/** Comment on a win. */
router.post("/lp/room/win/comment", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    const win = await winRowOnPage(page, req.body?.winId);
    const body = parseRoomComment(req.body?.body);
    if (!win || !body) {
      res.status(win ? 400 : 404).json({ error: win ? "Write a comment first" : "That post is gone" });
      return;
    }
    const mentioned = resolveMentions(body, req.body?.mentions, await roomPeople(page));
    await db.insert(lpRoomWinCommentsTable).values({ tenantId: page.tenantId, winId: win.id, body, mentions: mentioned.map((m) => m.name), authorSide: viewer.team ? "team" : "customer", authorEmail: viewer.email, authorName: viewer.name });
    sendFeedAlerts(page, feedAlertsFor({ authorEmail: viewer.email, mentioned, comment: true, winAuthorEmail: win.authorEmail }), viewer.name || "Someone", body, await roomPageUrl(req, page, req.body?.path));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room comment failed");
    res.status(500).json({ error: "Could not post" });
  }
});

/* ── TENANT (auth-gated) ─────────────────────────────────────────────────── */

async function ownedRoomPage(req: Request, res: Response): Promise<RoomPage | null> {
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return null;
  const page = await loadRoomPage(Number(req.params.pageId));
  if (!page || page.tenantId !== tenantId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return page;
}

router.get("/lp/partner-rooms/:pageId", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const [requests, settings, members, states, uploads] = await Promise.all([
      db.select().from(lpRoomRequestsTable).where(eq(lpRoomRequestsTable.pageId, page.id)).orderBy(desc(lpRoomRequestsTable.createdAt)),
      loadSettings(page.id),
      db.select().from(lpRoomMembersTable).where(eq(lpRoomMembersTable.pageId, page.id)).orderBy(desc(lpRoomMembersTable.updatedAt)),
      db.select().from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, page.id)),
      db.select().from(lpRoomUploadsTable).where(eq(lpRoomUploadsTable.pageId, page.id)).orderBy(desc(lpRoomUploadsTable.createdAt)),
    ]);
    const stateByKey = new Map(states.map((s) => [s.taskKey, s]));
    const [choiceRows, contactRows, wins] = page.isWorkspace
      ? await Promise.all([
          db.select().from(lpRoomChoicesTable).where(eq(lpRoomChoicesTable.pageId, page.id)),
          db.select().from(lpRoomContactsTable).where(eq(lpRoomContactsTable.pageId, page.id)).orderBy(asc(lpRoomContactsTable.createdAt)),
          loadWins(page.id, req.authUser?.email?.toLowerCase() ?? null, true),
        ])
      : [[], [], []];
    const [fullSettings] = await db.select().from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1);
    const [pageRow] = await db.select({ status: lpPagesTable.status, blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, page.id)).limit(1);
    res.json({
      isWorkspace: page.isWorkspace,
      digest: { enabled: !!fullSettings?.digestEnabled, recipients: Array.isArray(fullSettings?.digestRecipients) ? fullSettings.digestRecipients : [], lastSentAt: fullSettings?.lastDigestAt?.toISOString() ?? null },
      sheet: { id: fullSettings?.practicesSheetId ?? null, tab: fullSettings?.practicesSheetTab ?? null, syncedAt: fullSettings?.practicesSyncedAt?.toISOString() ?? null, note: fullSettings?.practicesSyncNote ?? null, filterColumn: fullSettings?.practicesSheetFilterColumn ?? null, filterValue: fullSettings?.practicesSheetFilterValue ?? null },
      revopsSlackMention: fullSettings?.revopsSlackMention ?? null,
      visitAlert: !!fullSettings?.visitAlert,
      // Welcome gifts: on for the hub unless turned off, who they are turned off for, and who has accepted theirs.
      ...(page.isWorkspace ? { gifts: { hasStep: !!page.giftStep, enabled: fullSettings ? fullSettings.giftsEnabled !== false : true, off: Array.isArray(fullSettings?.giftOffEmails) ? fullSettings.giftOffEmails : [], accepted: page.giftStep ? [...new Set(requests.filter((r) => isGiftRequest(r, page.giftStep!.key)).map((r) => r.requestedByEmail.toLowerCase()))] : [] } } : {}),
      // How the hub tells the team about activity, and who an email would go to (null = no account owner we can match to a team member).
      notify: { via: parseNotifyVia(fullSettings?.notifyVia), owner: page.isWorkspace ? await hubOwnerEmail(page.tenantId, page.id).catch(() => null) : null },
      archivedAt: fullSettings?.archivedAt?.toISOString() ?? null,
      // Who a reminder can go to: everyone let in by name, and whoever gets the weekly digest.
      reminder: {
        lastAt: fullSettings?.lastReminderAt?.toISOString() ?? null,
        people: [...new Set([...members.filter((m) => m.status === "allowed").map((m) => m.email.toLowerCase()), ...(Array.isArray(fullSettings?.digestRecipients) ? fullSettings.digestRecipients.map((e) => String(e).toLowerCase()) : [])])].slice(0, 100),
      },
      engagement: page.isWorkspace ? await roomAssetEngagement(page.id) : { assets: [], recent: [] },
      kit: page.isWorkspace ? await roomKitFor(page.id) : null,
      goals: page.isWorkspace ? await roomGoalsFor(page.id) : null,
      plan: page.isWorkspace ? await roomPlanFor(page.id) : null,
      cover: page.isWorkspace ? await roomCoverFor(page.id) : null,
      ...(page.isWorkspace ? await roomAccountFor(page.id) : { account: null, team: null }),
      overviewHidden: page.isWorkspace ? await roomOverviewHiddenFor(page.id) : null,
      links: page.isWorkspace ? await roomLinksFor(page.id) : null,
      stage: page.isWorkspace ? await roomStageFor(page.id) : null,
      calendar: { id: fullSettings?.calendarId ?? null, syncedAt: fullSettings?.calendarSyncedAt?.toISOString() ?? null, note: fullSettings?.calendarSyncNote ?? null, connection: await roomCalendarConnection(fullSettings?.calendarConnectionId ?? null, page.tenantId, req.authUser?.userId ?? null) },
      events: page.isWorkspace
        ? (await db.select().from(lpRoomEventsTable).where(eq(lpRoomEventsTable.pageId, page.id)).orderBy(desc(lpRoomEventsTable.startsAt)).limit(300)).map((e) => ({
            id: e.id,
            title: e.title,
            startsAt: e.startsAt.toISOString(),
            allDay: e.allDay,
            hidden: e.hidden,
            attendees: e.attendees,
            hasNotes: !!e.notesFileId,
            minutesStatus: e.minutesStatus,
            minutes: e.minutes ? cleanMinutes(e.minutes) : null,
          }))
        : [],
      practices: await practiceSummary(page.id),
      choices: [...page.choices.values()].map((spec) => {
        const c = choiceRows.find((x) => x.choiceKey === spec.key);
        return { key: spec.key, title: spec.title, options: spec.options, value: c && spec.options.includes(c.value) ? c.value : null, chosenBy: c ? c.chosenByName || c.chosenByEmail : null, chosenAt: c?.chosenAt.toISOString() ?? null };
      }),
      contacts: contactRows.map((c) => ({ id: c.id, name: c.name, role: c.role, email: c.email, addedBy: c.addedByEmail, createdAt: c.createdAt.toISOString() })),
      wins,
      isRoom: page.tasks.size > 0 || page.isWorkspace,
      published: pageRow?.status === "published",
      // What the account team has done to the hub lately, for teammates picking it up.
      activity: page.isWorkspace ? await hubActivity(page.tenantId, page.id) : [],
      // The last digest that went out can be looked at again.
      lastDigest: fullSettings?.lastDigestHtml ? { subject: fullSettings.lastDigestSubject ?? "", html: fullSettings.lastDigestHtml, sentAt: fullSettings.lastDigestAt?.toISOString() ?? null } : null,
      // What is left before the hub can go to the customer, read from the hub as it is now.
      setup: page.isWorkspace ? hubSetupItems(roomWorkspaceProps(resolveRoomBlocks(pageRow?.blocks)), { published: pageRow?.status === "published", invited: members.filter((m) => m.status === "allowed").length, slackLinked: !!fullSettings?.slackChannelId, signup: await signupPageFor(page.tenantId, roomWorkspaceProps(pageRow?.blocks)) }) : [],
      // The marketing plan as a queue: what the customer said yes to and whether marketing has it yet.
      planQueue: page.isWorkspace ? planQueueFor(page, choiceRows, requests) : [],
      requests: requests.map((r) => ({
        id: r.id,
        kind: r.kind,
        subject: r.subject,
        details: r.details,
        assetKey: r.assetKey,
        status: r.status,
        owner: r.owner,
        due: r.due,
        requestedBy: r.requestedByName || r.requestedByEmail,
        requestedByEmail: r.requestedByEmail,
        asanaTaskGid: r.asanaTaskGid,
        createdAt: r.createdAt.toISOString(),
        reply: r.teamReply ?? "",
        replyBy: r.teamReplyBy ?? "",
        replyAt: r.teamReplyAt?.toISOString() ?? null,
      })),
      settings,
      tasks: [...page.tasks.values()].map((t) => {
        const s = stateByKey.get(t.key);
        return { key: t.key, title: t.title, action: t.action, done: !!s, completedBy: s ? s.completedByName || s.completedByEmail : null, completedAt: s?.completedAt.toISOString() ?? null };
      }),
      members: members.map((m) => ({ id: m.id, email: m.email, status: m.status, updatedAt: m.updatedAt.toISOString() })),
      uploads: uploads.map((u) => ({
        id: u.id,
        taskKey: u.taskKey,
        taskTitle: page.tasks.get(u.taskKey)?.title ?? u.taskKey,
        fileName: u.fileName,
        sizeBytes: u.sizeBytes,
        uploadedBy: u.uploadedByName || u.uploadedByEmail,
        uploadedByEmail: u.uploadedByEmail,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "room detail failed");
    res.status(500).json({ error: "Could not load the hub" });
  }
});

router.patch("/lp/partner-rooms/:pageId/settings", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const rawDomains: unknown[] = Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains : [];
    const domains: string[] = [];
    for (const raw of rawDomains.slice(0, 25)) {
      const d = normalizeDomain(raw);
      if (!d) {
        res.status(400).json({ error: `"${String(raw)}" isn't a valid email domain` });
        return;
      }
      if (FREE_MAIL_DOMAINS.has(d)) {
        res.status(400).json({ error: `${d} is a public email provider, so anyone could get in. Add those people one by one instead.` });
        return;
      }
      if (!domains.includes(d)) domains.push(d);
    }
    const channelRaw = typeof req.body?.slackChannelId === "string" ? req.body.slackChannelId.trim() : "";
    if (channelRaw && !/^[A-Z0-9]{6,20}$/.test(channelRaw)) {
      res.status(400).json({ error: "That doesn't look like a Slack channel ID (for example C0123ABCDEF)" });
      return;
    }
    const sfdcRaw = typeof req.body?.sfdcAccountId === "string" ? req.body.sfdcAccountId.trim() : "";
    if (sfdcRaw && !/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(sfdcRaw)) {
      res.status(400).json({ error: "That doesn't look like a Salesforce account ID (15 or 18 characters, for example 0015d000041HyXrAAK)" });
      return;
    }
    const asanaRaw = typeof req.body?.asanaProjectGid === "string" ? req.body.asanaProjectGid.trim() : "";
    if (asanaRaw && !/^\d{6,24}$/.test(asanaRaw)) {
      res.status(400).json({ error: "That doesn't look like an Asana project ID (the long number in the project's URL)" });
      return;
    }
    // Optional keys: only touched when the request carries them.
    const extra: { digestEnabled?: boolean; digestRecipients?: string[]; practicesSheetId?: string | null; practicesSheetTab?: string | null; practicesSheetFilterColumn?: string | null; practicesSheetFilterValue?: string | null; revopsSlackMention?: string | null; calendarId?: string | null; calendarConnectionId?: number | null; visitAlert?: boolean } = {};
    if (typeof req.body?.visitAlert === "boolean") extra.visitAlert = req.body.visitAlert;
    // "mine" = read this room's calendar through the signed-in member's own Google connection; null = stop.
    if (req.body?.calendarConnection !== undefined) {
      if (req.body.calendarConnection === "mine") {
        const userId = req.authUser?.userId;
        const [conn] = userId ? await db.select({ id: lpGoogleConnectionsTable.id, status: lpGoogleConnectionsTable.status }).from(lpGoogleConnectionsTable).where(and(eq(lpGoogleConnectionsTable.tenantId, page.tenantId), eq(lpGoogleConnectionsTable.userId, userId))).limit(1) : [];
        if (!conn || conn.status !== "connected") {
          res.status(400).json({ error: "Connect Google first." });
          return;
        }
        extra.calendarConnectionId = conn.id;
      } else if (req.body.calendarConnection === null) {
        extra.calendarConnectionId = null;
      } else {
        res.status(400).json({ error: "Unknown calendar connection." });
        return;
      }
    }
    if (req.body?.calendarId !== undefined) {
      const raw = typeof req.body.calendarId === "string" ? req.body.calendarId.trim() : "";
      if (raw && !CALENDAR_ID_RE.test(raw)) {
        res.status(400).json({ error: "Use “primary” or the calendar's ID (it looks like an email address; find it in the calendar's settings under Integrate calendar)." });
        return;
      }
      extra.calendarId = raw || null;
    }
    if (req.body?.revopsSlackMention !== undefined) {
      const raw = typeof req.body.revopsSlackMention === "string" ? req.body.revopsSlackMention.trim() : "";
      if (raw && !slackMention(raw)) {
        res.status(400).json({ error: "Use a Slack user-group ID (starts with S) or a member ID (starts with U)." });
        return;
      }
      extra.revopsSlackMention = raw || null;
    }
    if (req.body?.practicesSheetFilterColumn !== undefined || req.body?.practicesSheetFilterValue !== undefined) {
      extra.practicesSheetFilterColumn = (typeof req.body?.practicesSheetFilterColumn === "string" ? req.body.practicesSheetFilterColumn.trim().slice(0, 80) : "") || null;
      extra.practicesSheetFilterValue = (typeof req.body?.practicesSheetFilterValue === "string" ? req.body.practicesSheetFilterValue.trim().slice(0, 120) : "") || null;
    }
    if (typeof req.body?.digestEnabled === "boolean") extra.digestEnabled = req.body.digestEnabled;
    if (Array.isArray(req.body?.digestRecipients)) {
      const list: string[] = [];
      for (const raw of (req.body.digestRecipients as unknown[]).slice(0, 50)) {
        const e = normalizeEmail(raw);
        if (!e) {
          res.status(400).json({ error: `"${String(raw)}" isn't a valid email address` });
          return;
        }
        if (!list.includes(e)) list.push(e);
      }
      extra.digestRecipients = list;
    }
    if (req.body?.practicesSheet !== undefined) {
      const rawSheet = typeof req.body.practicesSheet === "string" ? req.body.practicesSheet.trim() : "";
      const sheetId = rawSheet ? sheetIdFrom(rawSheet) : null;
      if (rawSheet && !sheetId) {
        res.status(400).json({ error: "Paste the Google Sheet's link (or its ID)." });
        return;
      }
      const tab = typeof req.body?.practicesSheetTab === "string" ? req.body.practicesSheetTab.trim() : "";
      if (tab && !SHEET_TAB_RE.test(tab)) {
        res.status(400).json({ error: "That tab name has characters a sheet tab can't be read by." });
        return;
      }
      extra.practicesSheetId = sheetId;
      extra.practicesSheetTab = tab || null;
    }
    // Every key is optional: a save that doesn't mention a setting leaves it alone. (Saving the
    // calendar used to send only the calendar and wipe the customer's domain, Slack channel and IDs.)
    const base: { allowedDomains?: string[]; slackChannelId?: string | null; sfdcAccountId?: string | null; asanaProjectGid?: string | null; notifyVia?: NotifyVia } = {};
    if (req.body?.notifyVia !== undefined) base.notifyVia = parseNotifyVia(req.body.notifyVia);
    if (req.body?.allowedDomains !== undefined) base.allowedDomains = domains;
    if (req.body?.slackChannelId !== undefined) base.slackChannelId = channelRaw || null;
    if (req.body?.sfdcAccountId !== undefined) base.sfdcAccountId = sfdcRaw || null;
    if (req.body?.asanaProjectGid !== undefined) base.asanaProjectGid = asanaRaw || null;
    const values = { ...base, ...extra };
    const [saved] = await db
      .insert(lpRoomSettingsTable)
      .values({ pageId: page.id, tenantId: page.tenantId, allowedDomains: [], ...values })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { ...values, updatedAt: sql`now()` } })
      .returning({ allowedDomains: lpRoomSettingsTable.allowedDomains, slackChannelId: lpRoomSettingsTable.slackChannelId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId, asanaProjectGid: lpRoomSettingsTable.asanaProjectGid });
    res.json({ ...saved, ...extra });
  } catch (err) {
    req.log.error({ err }, "room settings failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/** Allow, deny or remove one address. `status: null` removes the row. */
router.post("/lp/partner-rooms/:pageId/members", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const email = normalizeEmail(req.body?.email);
    const status = req.body?.status;
    if (!email) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    if (status === null) {
      await db.delete(lpRoomMembersTable).where(and(eq(lpRoomMembersTable.pageId, page.id), eq(lpRoomMembersTable.email, email)));
      res.json({ ok: true });
      return;
    }
    if (status !== "allowed" && status !== "denied") {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    await db
      .insert(lpRoomMembersTable)
      .values({ tenantId: page.tenantId, pageId: page.id, email, status })
      .onConflictDoUpdate({ target: [lpRoomMembersTable.pageId, lpRoomMembersTable.email], set: { status, updatedAt: sql`now()` } });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room member failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/**
 * A link that opens the published hub as the signed-in team member, on the
 * customer-facing address (where LP Studio's own sign-in doesn't reach).
 */
router.get("/lp/partner-rooms/:pageId/my-link", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const email = normalizeEmail(req.authUser?.email);
    if (!email) {
      res.status(400).json({ error: "Sign in again to get your link" });
      return;
    }
    const [row] = await db.select({ status: lpPagesTable.status }).from(lpPagesTable).where(eq(lpPagesTable.id, page.id)).limit(1);
    if (row?.status !== "published") {
      res.status(400).json({ error: "This hub isn't published yet, so it has no public page. Use Preview in the builder: you're recognised there automatically." });
      return;
    }
    // "As the customer sees it": the same signed-in link, with a flag the hub reads to leave out everything that is the team's only.
    // "As one person" (?as=<email>): the hub reads its state as them, and nothing can be done from it.
    const asCustomer = req.query.as === "customer";
    const asPerson = typeof req.query.as === "string" && req.query.as !== "customer" ? normalizeEmail(req.query.as) : null;
    if (typeof req.query.as === "string" && req.query.as !== "customer" && !asPerson) {
      res.status(400).json({ error: "That email address doesn't look right." });
      return;
    }
    const view = asPerson ? `&preview=person&as=${encodeURIComponent(asPerson)}` : asCustomer ? "&preview=customer" : "";
    res.json({ url: `${await roomPageUrl(req, page, undefined)}?rt=${encodeURIComponent(signRoomToken(page.id, email))}${view}` });
  } catch (err) {
    req.log.error({ err }, "room my-link failed");
    res.status(500).json({ error: "Could not make your link" });
  }
});

/** The account behind a room: its Salesforce id from the room's settings, else the account the room was made for, else the name on the page. */
async function roomAccountPeople(page: RoomPage) {
  const [[settings], [auto]] = await Promise.all([
    db.select({ sfdcAccountId: lpRoomSettingsTable.sfdcAccountId }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1),
    db.select({ name: lpRoomAutocreateAccountsTable.accountName, sfdcId: lpRoomAutocreateAccountsTable.sfdcAccountId }).from(lpRoomAutocreateAccountsTable).where(eq(lpRoomAutocreateAccountsTable.pageId, page.id)).limit(1),
  ]);
  return accountPeople(page.tenantId, { sfdcId: settings?.sfdcAccountId ?? auto?.sfdcId ?? null, name: auto?.name ?? page.partnerName });
}

/**
 * The practice microsite for this hub: the account's own page when the
 * workspace already has one, otherwise a new draft from the workspace's
 * practice-microsite template. Either way it is linked at the top of the
 * launch kit, so the one-pager and media kit print its address.
 */
router.post("/lp/partner-rooms/:pageId/practice-site", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    if (!page.partnerName.trim() || /^\[.*\]$/.test(page.partnerName.trim())) {
      res.status(400).json({ error: "Set the customer's name on the hub first." });
      return;
    }
    const [[settings], [auto], [row]] = await Promise.all([
      db.select({ sfdcAccountId: lpRoomSettingsTable.sfdcAccountId }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1),
      db.select({ name: lpRoomAutocreateAccountsTable.accountName, sfdcId: lpRoomAutocreateAccountsTable.sfdcAccountId }).from(lpRoomAutocreateAccountsTable).where(eq(lpRoomAutocreateAccountsTable.pageId, page.id)).limit(1),
      db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1),
    ]);
    const name = auto?.name ?? page.partnerName;
    const people = await accountPeople(page.tenantId, { sfdcId: settings?.sfdcAccountId ?? auto?.sfdcId ?? null, name }).catch(() => null);
    const sfdcId = settings?.sfdcAccountId ?? auto?.sfdcId ?? people?.sfdcId ?? null;
    // A test hub (made by "Run a test") keeps to test microsites; a real hub never picks one up.
    const site = await ensurePracticeSite(page.tenantId, { name, sfdcId }, { accountId: people?.accountId ?? null, test: /-test-hub(-\d+)?$/.test(page.slug) });
    if (!site) {
      res.status(404).json({ error: "No practice microsite was found for this account, and this workspace has no practice-microsite template to make one from. Save one of your practice sign-up pages as a template, then try again." });
      return;
    }
    const url = await publicPageUrl(page.tenantId, site.slug);
    // The blocks keep the short-name variable; the link's title is written out the way the page shows it.
    const short = (row?.blocks as { type?: string; props?: { partnerShort?: string } }[] | undefined)?.find((b) => b?.type === "room-workspace")?.props?.partnerShort?.trim() || name;
    const next = row && url ? setRoomPracticeLink(row.blocks, { url, short }) : null;
    if (next && next !== row?.blocks) await db.update(lpPagesTable).set({ blocks: next as never, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, pageId: site.pageId, title: site.title, status: site.status, existing: site.existing, url, link: { key: "practice-site", title: `${short} practice sign-up page`, description: url.replace(/^https?:\/\//, ""), url } });
  } catch (err) {
    req.log.error({ err }, "room practice site failed");
    res.status(500).json({ error: "Could not set up the practice microsite" });
  }
});

/** The account's contacts for this room (from the workspace's Accounts), each with whether they already have access. */
router.get("/lp/partner-rooms/:pageId/account-contacts", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const [people, members] = await Promise.all([roomAccountPeople(page), db.select({ email: lpRoomMembersTable.email, status: lpRoomMembersTable.status }).from(lpRoomMembersTable).where(eq(lpRoomMembersTable.pageId, page.id))]);
    const status = new Map(members.map((m) => [m.email, m.status]));
    res.json({ found: !!people, domain: people?.domain ?? null, contacts: (people?.contacts ?? []).slice(0, 500).map((c) => ({ ...c, invited: status.get(c.email) === "allowed" })) });
  } catch (err) {
    req.log.error({ err }, "room account contacts failed");
    res.status(500).json({ error: "Could not load the account's contacts" });
  }
});

const INVITE_MAX = 25;

/**
 * Invite the customer's people: each address is let into the room and emailed
 * a personal link that opens it as them. Only for a published room (a draft's
 * link shows nothing).
 */
router.post("/lp/partner-rooms/:pageId/invite", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const raw: unknown[] = Array.isArray(req.body?.people) ? req.body.people : [];
    const people = new Map<string, string>();
    for (const p of raw.slice(0, 200)) {
      const email = normalizeEmail((p as { email?: unknown })?.email);
      const name = typeof (p as { name?: unknown })?.name === "string" ? (p as { name: string }).name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
      if (email && !people.has(email)) people.set(email, name);
    }
    if (people.size === 0) {
      res.status(400).json({ error: "Choose at least one person with a valid email address." });
      return;
    }
    if (people.size > INVITE_MAX) {
      res.status(400).json({ error: `Invite up to ${INVITE_MAX} people at a time.` });
      return;
    }
    const [row] = await db.select({ status: lpPagesTable.status }).from(lpPagesTable).where(eq(lpPagesTable.id, page.id)).limit(1);
    if (row?.status !== "published") {
      res.status(400).json({ error: "Publish the hub first. An invitation to a draft would open an empty page." });
      return;
    }
    const invitedBy = req.authUser?.name?.trim() || req.authUser?.email || "Your partner team";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 600) : "";
    const url = await roomPageUrl(req, page, undefined);
    const sent: string[] = [];
    const failed: string[] = [];
    for (const [email, name] of people) {
      await db
        .insert(lpRoomMembersTable)
        .values({ tenantId: page.tenantId, pageId: page.id, email, status: "allowed" })
        .onConflictDoUpdate({ target: [lpRoomMembersTable.pageId, lpRoomMembersTable.email], set: { status: "allowed", updatedAt: sql`now()` } });
      if (page.isWorkspace) await rememberInvited(page, email, name, req.authUser?.email ?? "team").catch(() => {});
      const ok = await sendRoomInviteEmail({ recipientEmail: email, recipientName: name, invitedBy, note, roomUrl: `${url}?rt=${encodeURIComponent(signRoomToken(page.id, email))}`, roomTitle: page.title, tenantId: page.tenantId }).catch(() => false);
      (ok ? sent : failed).push(email);
    }
    res.json({ ok: failed.length === 0, sent, failed });
  } catch (err) {
    req.log.error({ err }, "room invite failed");
    res.status(500).json({ error: "Could not send the invitations" });
  }
});

/** Move a request along: status, who is handling it, and the target date the customer sees. */
router.patch("/lp/partner-rooms/:pageId/requests/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const id = Number(req.params.id);
    const set: { status?: string; owner?: string | null; due?: string | null; updatedAt: ReturnType<typeof sql> } = { updatedAt: sql`now()` };
    if (req.body?.status !== undefined) {
      if (!(ROOM_REQUEST_STATUSES as readonly string[]).includes(String(req.body.status))) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      set.status = String(req.body.status);
    }
    if (req.body?.owner !== undefined) set.owner = String(req.body.owner ?? "").trim().slice(0, 120) || null;
    if (req.body?.due !== undefined) set.due = String(req.body.due ?? "").trim().slice(0, 40) || null;
    const updated = Number.isFinite(id)
      ? await db.update(lpRoomRequestsTable).set(set).where(and(eq(lpRoomRequestsTable.id, id), eq(lpRoomRequestsTable.pageId, page.id), eq(lpRoomRequestsTable.tenantId, page.tenantId))).returning({ id: lpRoomRequestsTable.id })
      : [];
    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room request update failed");
    res.status(500).json({ error: "Could not update" });
  }
});

/** Add or update practices from a pasted list (CSV or tab-separated; first line = column names). */
router.post("/lp/partner-rooms/:pageId/practices/import", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    // `fromCustomer` marks a list the customer gave us: it is their word, so the sheet sync never removes its practices or overwrites what it says.
    // Pasted text, or a file (.xlsx / .csv) such as the scanner tracker's Excel export. A file's rows are matched to
    // practices by name and only fill in what they carry, so a scanner export adds scanner counts without touching stages.
    let rows = parsePracticeCsv(req.body?.csv);
    let sheetName: string | null = null;
    if (rows.length === 0 && typeof req.body?.fileBase64 === "string" && typeof req.body?.fileName === "string") {
      const buf = Buffer.from(req.body.fileBase64, "base64");
      if (buf.length > 7 * 1024 * 1024) {
        res.status(400).json({ error: "That file is over 7 MB." });
        return;
      }
      let best: RoomPracticeInput[] = [];
      for (const sheet of rowsFromUpload(req.body.fileName.slice(0, 200), buf)) {
        const [head, ...body] = sheet.rows;
        if (!head) continue;
        const keys = head.map((h) => String(h ?? "").trim().toLowerCase());
        // The first column with a name wins: a summary table beside the list often repeats a heading ("Using Dandy" as a count).
        const firstAt = new Map<string, number>();
        keys.forEach((k, i) => k && !firstAt.has(k) && firstAt.set(k, i));
        const parsed = body.map((r) => parsePracticeRow(Object.fromEntries([...firstAt].map(([k, i]) => [k, r[i] ?? ""])))).filter((r): r is RoomPracticeInput => !!r);
        // A workbook can hold several sheets (a timeline, a change log): take the one that reads as a list of practices.
        if (parsed.length > best.length) {
          best = parsed;
          sheetName = sheet.sheet;
        }
      }
      rows = best.slice(0, 5000);
    }
    if (rows.length === 0) {
      res.status(400).json({ error: "Nothing to import. The first row needs column names, including “name” (or “office”)." });
      return;
    }
    res.json({ ok: true, ...(sheetName ? { sheet: sheetName } : {}), ...(await upsertPractices(page, rows, { upload: req.body?.fromCustomer === true })) });
  } catch (err) {
    req.log.error({ err }, "room practices import failed");
    res.status(500).json({ error: "Import failed" });
  }
});

/** Pull the customer's practices from Salesforce: the child accounts of the room's parent account. Names and locations only; stages are kept. */
router.post("/lp/partner-rooms/:pageId/practices/sync-salesforce", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const settings = await loadSettings(page.id);
    if (!settings.sfdcAccountId || !/^[a-zA-Z0-9]{15,18}$/.test(settings.sfdcAccountId)) {
      res.status(400).json({ error: "Save the customer's Salesforce account ID first." });
      return;
    }
    const conn = await sfdcService.getActiveConnection(page.tenantId);
    if (!conn) {
      res.status(400).json({ error: "Salesforce isn't connected for this workspace." });
      return;
    }
    const result = await sfdcService.querySalesforce(conn.id, `SELECT Id, Name, BillingCity, BillingState FROM Account WHERE ParentId = '${settings.sfdcAccountId}' ORDER BY Name LIMIT 2000`);
    const rows: RoomPracticeInput[] = (result.records as Array<{ Id?: string; Name?: string; BillingCity?: string | null; BillingState?: string | null }>)
      .filter((a) => a.Id && a.Name)
      .map((a) => ({ externalId: String(a.Id), name: String(a.Name).slice(0, 160), region: a.BillingState ?? null, city: a.BillingCity ?? null, state: a.BillingState ?? null, wave: null, stage: "not_started", stageGiven: false, trainingDate: null, liveDate: null, scannerSent: null, scannerActivated: null, regionalManager: null, scannerCount: null, scannerModels: null }));
    if (rows.length === 0) {
      res.json({ ok: true, added: 0, updated: 0, note: "Salesforce returned no child accounts for that account." });
      return;
    }
    res.json({ ok: true, ...(await upsertPractices(page, rows)) });
  } catch (err) {
    req.log.error({ err }, "room practices sfdc sync failed");
    res.status(502).json({ error: "Could not read from Salesforce. Check the connection and try again." });
  }
});

/** Read the connected Google Sheet now and make the practice list match it. */
router.post("/lp/partner-rooms/:pageId/practices/sync-sheet", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const result = await syncPracticesFromSheet(page.id);
    res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true, note: result.note } : { error: result.note });
  } catch (err) {
    req.log.error({ err }, "room sheet sync failed");
    res.status(500).json({ error: "Could not read the sheet" });
  }
});

/** Automatic rooms for the workspace: the sheet being watched, how the last read went, and the accounts seen. */
router.get("/lp/room-autocreate", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const [[cfg], accounts] = await Promise.all([
      db.select().from(lpRoomAutocreateTable).where(eq(lpRoomAutocreateTable.tenantId, tenantId)).limit(1),
      db.select().from(lpRoomAutocreateAccountsTable).where(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId)).orderBy(desc(lpRoomAutocreateAccountsTable.createdAt)).limit(500),
    ]);
    res.json({
      enabled: !!cfg?.enabled,
      sheetId: cfg?.sheetId ?? null,
      sheetTab: cfg?.sheetTab ?? null,
      practicesTab: cfg?.practicesTab ?? null,
      alertOwner: !!cfg?.alertOwner,
      alertEmails: Array.isArray(cfg?.alertEmails) ? cfg.alertEmails : [],
      logEnabled: cfg ? cfg.logEnabled : true,
      logSheetId: cfg?.logSheetId ?? null,
      logTab: cfg?.logTab ?? null,
      kitSheetId: cfg?.kitSheetId ?? null,
      kitTab: cfg?.kitTab ?? null,
      asanaProjectGid: cfg?.asanaProjectGid ?? null,
      asanaAssigneeGid: cfg?.asanaAssigneeGid ?? null,
      sfdcField: cfg?.sfdcField ?? null,
      syncedAt: cfg?.syncedAt?.toISOString() ?? null,
      note: cfg?.syncNote ?? null,
      // The address the workbook must be shared with (the workspace's Google service account), when there is one.
      shareWith: await roomSheetsAccount(tenantId),
      // What a new hub starts as: the workspace's own saved hub template, or the built-in one.
      hubTemplate: await hubTemplate(tenantId).then((t) => (t ? { id: t.id, label: t.label } : null)).catch(() => null),
      accounts: accounts.map((a) => ({ key: a.accountKey, name: a.accountName, signedDate: a.signedDate, owner: a.owner, sfdcId: a.sfdcAccountId, pageId: a.pageId && a.pageId > 0 ? a.pageId : null })),
    });
  } catch (err) {
    req.log.error({ err }, "room autocreate read failed");
    res.status(500).json({ error: "Could not load automatic rooms" });
  }
});

/** Turn automatic rooms on or off and say which sheet tab lists the signed accounts. */
router.put("/lp/room-autocreate", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const rawSheet = typeof req.body?.sheet === "string" ? req.body.sheet.trim() : "";
    const sheetId = rawSheet ? sheetIdFrom(rawSheet) : null;
    const tab = typeof req.body?.tab === "string" ? req.body.tab.trim() : "";
    if (rawSheet && !sheetId) {
      res.status(400).json({ error: "Paste the Google Sheet's link (or its ID)." });
      return;
    }
    const practicesTab = typeof req.body?.practicesTab === "string" ? req.body.practicesTab.trim() : "";
    if ((tab && !SHEET_TAB_RE.test(tab)) || (practicesTab && !SHEET_TAB_RE.test(practicesTab))) {
      res.status(400).json({ error: "That tab name has characters a sheet tab can't be read by." });
      return;
    }
    // What else happens when a room is created: alerts, the sheet log, the Salesforce field.
    const alertEmails: string[] = [];
    for (const raw of (Array.isArray(req.body?.alertEmails) ? (req.body.alertEmails as unknown[]) : []).slice(0, 25)) {
      const e = normalizeEmail(raw);
      if (!e) {
        res.status(400).json({ error: `"${String(raw)}" isn't a valid email address` });
        return;
      }
      if (!alertEmails.includes(e)) alertEmails.push(e);
    }
    const rawLogSheet = typeof req.body?.logSheet === "string" ? req.body.logSheet.trim() : "";
    const logSheetId = rawLogSheet ? sheetIdFrom(rawLogSheet) : null;
    const logTab = typeof req.body?.logTab === "string" ? req.body.logTab.trim() : "";
    const sfdcField = typeof req.body?.sfdcField === "string" ? req.body.sfdcField.trim() : "";
    if (rawLogSheet && !logSheetId) {
      res.status(400).json({ error: "Paste the log sheet's link (or leave it blank to use the same workbook)." });
      return;
    }
    if (logTab && !SHEET_TAB_RE.test(logTab)) {
      res.status(400).json({ error: "That log tab name has characters a sheet tab can't be read by." });
      return;
    }
    const rawKitSheet = typeof req.body?.kitSheet === "string" ? req.body.kitSheet.trim() : "";
    const kitSheetId = rawKitSheet ? sheetIdFrom(rawKitSheet) : null;
    const kitTab = typeof req.body?.kitTab === "string" ? req.body.kitTab.trim() : "";
    if (rawKitSheet && !kitSheetId) {
      res.status(400).json({ error: "Paste the welcome kit sheet's link (or leave it blank to use the hub log workbook)." });
      return;
    }
    if (kitTab && !SHEET_TAB_RE.test(kitTab)) {
      res.status(400).json({ error: "That welcome kit tab name has characters a sheet tab can't be read by." });
      return;
    }
    const hubAsanaProject = typeof req.body?.asanaProjectGid === "string" ? req.body.asanaProjectGid.trim() : "";
    const hubAsanaAssignee = typeof req.body?.asanaAssigneeGid === "string" ? req.body.asanaAssigneeGid.trim() : "";
    if ((hubAsanaProject && !ASANA_GID_RE.test(hubAsanaProject)) || (hubAsanaAssignee && !ASANA_GID_RE.test(hubAsanaAssignee))) {
      res.status(400).json({ error: "An Asana project or person ID is a number, for example 1212535445652653." });
      return;
    }
    if (sfdcField && !isSfdcFieldName(sfdcField)) {
      res.status(400).json({ error: "Use the Salesforce field's API name, for example Digital_Sales_Room__c." });
      return;
    }
    const enabled = req.body?.enabled === true && !!sheetId;
    const values = { enabled, sheetId, sheetTab: tab || null, practicesTab: practicesTab || null, alertOwner: req.body?.alertOwner === true, alertEmails, logEnabled: req.body?.logEnabled !== false, logSheetId, logTab: logTab || null, kitSheetId, kitTab: kitTab || null, asanaProjectGid: hubAsanaProject || null, asanaAssigneeGid: hubAsanaAssignee || null, sfdcField: sfdcField || null, updatedBy: req.authUser?.email ?? null, updatedAt: new Date() };
    await db.insert(lpRoomAutocreateTable).values({ tenantId, ...values }).onConflictDoUpdate({ target: lpRoomAutocreateTable.tenantId, set: values });
    res.json({ ok: true, enabled });
  } catch (err) {
    req.log.error({ err }, "room autocreate save failed");
    res.status(500).json({ error: "Could not save automatic rooms" });
  }
});

/** Read the signed-accounts sheet now (it is also read about every hour). */
router.post("/lp/room-autocreate/sync", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const result = await syncRoomAutocreate(tenantId);
    res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true, note: result.note, created: result.created } : { error: result.note });
  } catch (err) {
    req.log.error({ err }, "room autocreate sync failed");
    res.status(500).json({ error: "Could not read the sheet" });
  }
});

/** Try the whole thing for a typed-in account name: the same draft room, standard files and Slack note a new signed account gets, marked as a test. */
router.post("/lp/room-autocreate/test", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) : "";
    const sfdcId = typeof req.body?.sfdcId === "string" ? req.body.sfdcId.trim() : "";
    if (sfdcId && !/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(sfdcId)) {
      res.status(400).json({ error: "A Salesforce account ID is 15 or 18 letters and numbers, for example 0015d000041HyXrAAK." });
      return;
    }
    if (name.length < 2 && !sfdcId) {
      res.status(400).json({ error: "Type an account name or a Salesforce account ID to test with." });
      return;
    }
    const result = await testRoomAutocreate(tenantId, name, sfdcId || null, typeof req.body?.owner === "string" ? req.body.owner : null);
    if (!result || "error" in result) {
      res.status(400).json({ error: result && "error" in result ? result.error : "That name can't be used." });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err }, "room autocreate test failed");
    res.status(500).json({ error: "The test run failed" });
  }
});

/** Make the room now for one account that is on the list without one (an account that was already there when the sheet was connected). */
router.post("/lp/room-autocreate/create", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const key = typeof req.body?.key === "string" ? req.body.key : "";
    const [row] = await db.select().from(lpRoomAutocreateAccountsTable).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, key))).limit(1);
    if (!row) {
      res.status(404).json({ error: "That account isn't on the list." });
      return;
    }
    if (row.pageId && row.pageId > 0) {
      res.json({ ok: true, pageId: row.pageId, existed: true });
      return;
    }
    const pageId = await createRoomForAccount(tenantId, { key: row.accountKey, name: row.accountName, signedDate: row.signedDate, owner: row.owner, sfdcId: row.sfdcAccountId });
    if (!pageId) {
      res.status(409).json({ error: "That hub is already being created." });
      return;
    }
    res.json({ ok: true, pageId });
  } catch (err) {
    req.log.error({ err }, "room autocreate create failed");
    res.status(500).json({ error: "Could not create the hub" });
  }
});

/** The workspace's standard launch-kit files (the same for every customer), set or not. */
router.get("/lp/room-standard-assets", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const rows = await db.select().from(lpRoomStandardAssetsTable).where(eq(lpRoomStandardAssetsTable.tenantId, tenantId));
    res.json({ assets: ROOM_STANDARD_ASSETS.map((a) => { const row = rows.find((r) => r.assetKey === a.key); return { ...a, fileUrl: row?.fileUrl ?? null, updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row?.updatedBy ?? null }; }) });
  } catch (err) {
    req.log.error({ err }, "room standard assets read failed");
    res.status(500).json({ error: "Could not load the standard files" });
  }
});

/** Set (or replace) one standard file for the whole workspace. Rooms that already carry the old file keep it until it is added again. */
router.put("/lp/room-standard-assets/:key", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const spec = ROOM_STANDARD_ASSETS.find((a) => a.key === req.params.key);
    const asset = spec ? parseRoomKitAsset({ key: spec.key, kind: "pdf", title: spec.title, fileUrl: req.body?.fileUrl }) : null;
    if (!spec || !asset) {
      res.status(400).json({ error: "Upload the PDF first, then save it as the standard file." });
      return;
    }
    const values = { title: spec.title, description: spec.description, fileUrl: asset.fileUrl, updatedBy: req.authUser?.email ?? null, updatedAt: new Date() };
    await db.insert(lpRoomStandardAssetsTable).values({ tenantId, assetKey: spec.key, ...values }).onConflictDoUpdate({ target: [lpRoomStandardAssetsTable.tenantId, lpRoomStandardAssetsTable.assetKey], set: values });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room standard asset save failed");
    res.status(500).json({ error: "Could not save the standard file" });
  }
});

/** Add the workspace's standard files to this room's launch kit. A file the room already has under that key is replaced only when `replace` is true. */
router.post("/lp/partner-rooms/:pageId/standard-assets", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const info = row ? roomKitInfo(resolveRoomBlocks(row.blocks)) : null;
    if (!row || !info) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    const standard = await db.select().from(lpRoomStandardAssetsTable).where(eq(lpRoomStandardAssetsTable.tenantId, page.tenantId));
    const replace = req.body?.replace === true;
    let blocks: unknown[] = row.blocks as unknown[];
    const added: string[] = [];
    const kept: string[] = [];
    for (const spec of ROOM_STANDARD_ASSETS) {
      const file = standard.find((r) => r.assetKey === spec.key);
      if (!file) continue;
      // A room that already carries its own file (a custom guide) keeps it.
      if (!replace && info.assets.some((a) => a.key === spec.key && a.hasFile)) {
        kept.push(spec.title);
        continue;
      }
      const next = setRoomKitAsset(blocks, { key: spec.key, kind: "pdf", title: spec.title, description: spec.description, fileUrl: file.fileUrl });
      if (next) {
        blocks = next;
        added.push(spec.title);
      }
    }
    if (added.length) await db.update(lpPagesTable).set({ blocks: blocks as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, added, kept, missing: ROOM_STANDARD_ASSETS.filter((s) => !standard.some((r) => r.assetKey === s.key)).map((s) => s.title) });
  } catch (err) {
    req.log.error({ err }, "room standard assets add failed");
    res.status(500).json({ error: "Could not add the standard files" });
  }
});

/**
 * Put a generated launch asset (a one-pager, a social graphic) into the room's
 * launch kit. The file was just uploaded to this app's storage by the same
 * signed-in member; only the kit entry on the page changes.
 */
router.post("/lp/partner-rooms/:pageId/kit-asset", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const asset = parseRoomKitAsset(req.body);
    if (!asset) {
      res.status(400).json({ error: "That isn't a launch asset this hub can take." });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    // A file the team uploaded in place of ours stays: nothing generated replaces it, whoever or whatever asks.
    // It goes only when someone removes it, or uploads another over it.
    if (row && asset.madeFrom && roomKitAssetIsOwn(row.blocks, asset.key)) {
      res.json({ ok: true, kept: true });
      return;
    }
    const next = row ? setRoomKitAsset(row.blocks, asset) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room kit asset save failed");
    res.status(500).json({ error: "Could not add the asset to the launch kit" });
  }
});

/** Take the team's own file back out of a kit entry, so the generated one can be made again. */
router.delete("/lp/partner-rooms/:pageId/kit-asset/:key", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const key = String(req.params.key ?? "");
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(key)) {
      res.status(400).json({ error: "That isn't a launch asset." });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? clearRoomKitAsset(row.blocks, key) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room kit asset removal failed");
    res.status(500).json({ error: "Could not remove the file" });
  }
});

/**
 * Recommended plays for the account team: rules over the hub's own numbers
 * (where the practices are, which are live, what has been sent), named and
 * dated as the Expansion Playbook has them. Plays the team already asked
 * for, did or set aside are left out until their quiet period ends.
 */
router.get("/lp/partner-rooms/:pageId/plays", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const got = await hubPlays(page);
    if (!got) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    res.json({ plays: got.plays, quiet: got.quiet, noDirectOutreach: got.noDirectOutreach });
  } catch (err) {
    req.log.error({ err }, "room plays failed");
    res.status(500).json({ error: "Could not work out the plays" });
  }
});

/** Act on a play: ask marketing for it (an intake task and a Slack note), mark it done, or set it aside. Either way it stays quiet for 30 days. */
router.post("/lp/partner-rooms/:pageId/plays/act", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const key = typeof req.body?.key === "string" ? req.body.key.trim().slice(0, 80) : "";
    const action = req.body?.action === "request" || req.body?.action === "done" || req.body?.action === "dismiss" ? (req.body.action as "request" | "done" | "dismiss") : null;
    if (!key || !action) {
      res.status(400).json({ error: "Unknown play or action" });
      return;
    }
    const by = req.authUser?.name || req.authUser?.email || "A team member";
    if (action !== "request") {
      await setPlayState(page, key, action === "done" ? "done" : "dismissed", by);
      res.json({ ok: true });
      return;
    }
    const got = await hubPlays(page);
    const play = got?.all.find((p) => p.key === key);
    if (!got || !play) {
      res.status(404).json({ error: "That play no longer applies." });
      return;
    }
    const settings = await loadSettings(page.id);
    const hubUrl = await roomPageUrl(req, page, undefined).catch(() => "");
    const task = playRequest(got.customer, play, by, new Date().toISOString().slice(0, 10), hubUrl);
    const asana = await hubAsanaTarget(page.tenantId, settings.asanaProjectGid);
    const result = await createIntakeTask({ tenantId: page.tenantId, pageId: page.id, name: asanaRequestTaskName(got.customer, task.subject), notes: task.notes, projectGid: asana.projectGid, assigneeGid: asana.assigneeGid });
    if (!result.ok) {
      res.status(502).json({ error: result.warning ?? "Asana didn't take the request." });
      return;
    }
    await setPlayState(page, key, "requested", by);
    notifyTeam(page, settings, `🎯 Play requested: ${mrk(play.title)}`, [`*${mrk(by)}* asked marketing for this play.`, mrk(play.why)], hubUrl || undefined);
    res.json({ ok: true, taskId: result.taskId ?? null, warning: result.warning ?? null });
  } catch (err) {
    req.log.error({ err }, "room play action failed");
    res.status(500).json({ error: "Could not do that" });
  }
});

/** Whether the account allows direct outreach to its practices. Off = no welcome kits or mail from the hub. */
router.put("/lp/partner-rooms/:pageId/plays/settings", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    await setNoDirectOutreach(page, req.body?.noDirectOutreach === true);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room plays settings failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/**
 * The hub's stage (rollout or expansion: internal names, the customer only
 * sees "Partnership"), its waves and which timeline the Overview leads with.
 * A team member moves a hub on; nothing does it for them.
 */
router.put("/lp/partner-rooms/:pageId/stage", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const parsed = parseRoomStage(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const ctx = parsed.value.stage === "expansion" ? await expansionPlanContext(page.id) : {};
    const next = row ? setRoomStage(row.blocks, parsed.value, new Date(), { ...ctx, decisions: expansionDecisions(req.body?.plan?.decisions) }) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    // The plan changes with the stage: an open builder takes it too, so its next save doesn't put the old plan back.
    const hubProps = (next as { type?: string; props?: Record<string, unknown> }[]).find((b) => b?.type === "room-workspace")?.props ?? {};
    res.json({ ok: true, stage: roomStageInfo(next), planGroups: hubProps.planGroups ?? [], rolloutPlanGroups: hubProps.rolloutPlanGroups ?? null });
  } catch (err) {
    req.log.error({ err }, "room stage save failed");
    res.status(500).json({ error: "Could not save the stage" });
  }
});

/**
 * Before moving a hub past its rollout: the plan steps still open, what the
 * rules suggest for each (keep or retire), and what the new plan will add.
 */
router.get("/lp/partner-rooms/:pageId/stage/expansion-preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const hubProps = (Array.isArray(row?.blocks) ? (row!.blocks as { type?: string; props?: Record<string, unknown> }[]) : []).find((b) => b?.type === "room-workspace")?.props;
    if (!hubProps) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    const ctx = await expansionPlanContext(page.id);
    const stage = roomStageFromProps(hubProps);
    const today = new Date().toISOString().slice(0, 10);
    const adds = buildExpansionPlan([], { waves: stage.waves, productSummary: ctx.productSummary, today }).map((g) => ({ title: g.title, steps: g.rows.length }));
    res.json({ open: expansionReview(hubProps.rolloutPlanGroups ?? hubProps.planGroups, ctx.ticked), adds });
  } catch (err) {
    req.log.error({ err }, "room expansion preview failed");
    res.status(500).json({ error: "Could not load the plan" });
  }
});

/**
 * Welcome gifts: turn them on or off for the whole hub ({ enabled }), or for
 * one person ({ email, off }). Some customers don't accept gifts.
 */
router.put("/lp/partner-rooms/:pageId/gifts", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const now = await loadGiftSettings(page.id);
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "That email address doesn't look right." });
      return;
    }
    const next = {
      giftsEnabled: typeof req.body?.enabled === "boolean" ? req.body.enabled : now.giftsEnabled,
      giftOffEmails: email ? setGiftOff(now.giftOffEmails, email, req.body?.off === true) : now.giftOffEmails,
    };
    await db
      .insert(lpRoomSettingsTable)
      .values({ pageId: page.id, tenantId: page.tenantId, allowedDomains: [], ...next })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { ...next, updatedAt: sql`now()` } });
    res.json({ ok: true, enabled: next.giftsEnabled, off: next.giftOffEmails });
  } catch (err) {
    req.log.error({ err }, "room gifts save failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/** "Not yet": keep the hub in rollout and ask again later (30 days unless told otherwise). */
router.post("/lp/partner-rooms/:pageId/stage/extend", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? extendRoomStage(row.blocks, req.body?.days) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, stage: roomStageInfo(next) });
  } catch (err) {
    req.log.error({ err }, "room stage extend failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/**
 * Save the hub's goals from the manage pop-up. Goals live on the page (the
 * Goals section reads them), so only that part of the page changes.
 */
router.put("/lp/partner-rooms/:pageId/cover", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const parsed = parseRoomCover(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomCover(row.blocks, parsed.cover) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, cover: roomCoverInfo(next) });
  } catch (err) {
    req.log.error({ err }, "room cover save failed");
    res.status(500).json({ error: "Could not save the cover" });
  }
});

/**
 * Account settings and the team list, saved from the hub's manage pop-up (the
 * same fields the page builder has): send `account`, `team`, or both. Only
 * what is sent is changed; the rest of the page is untouched.
 */
router.put("/lp/partner-rooms/:pageId/account", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const patch: Record<string, unknown> = {};
    if (req.body?.account !== undefined) {
      const parsed = parseRoomAccount(req.body.account);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      Object.assign(patch, parsed.value);
    }
    if (req.body?.team !== undefined) {
      const parsed = parseRoomTeam(req.body.team);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      Object.assign(patch, parsed.value);
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomProps(row.blocks, patch) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, patch, ...roomAccountInfo(next) });
  } catch (err) {
    req.log.error({ err }, "room account save failed");
    res.status(500).json({ error: "Could not save the settings" });
  }
});

/**
 * Remind the customer what is waiting on them: one short email to the people
 * the rep picked, listing the next few things and linking to the hub. Only
 * goes to addresses that already have access or get the digest.
 */
router.post("/lp/partner-rooms/:pageId/remind", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const digest = await buildRoomDigest(page.id);
    if (!digest) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    const [row] = await db.select({ status: lpPagesTable.status }).from(lpPagesTable).where(eq(lpPagesTable.id, page.id)).limit(1);
    if (row?.status !== "published") {
      res.status(400).json({ error: "Publish the hub first: the reminder links to it." });
      return;
    }
    const d = digest.data;
    const items = [...d.reviewRequests.map((x) => `Review: ${x}`), ...d.waitingOnCustomer.filter((x) => !(d.rollout && /^upload your practice list$/i.test(x.trim()))), ...d.undecided.map((x) => `Decide: ${x}`)];
    if (items.length === 0) {
      res.status(400).json({ error: "Nothing is waiting on the customer." });
      return;
    }
    const [settingsRow, members] = await Promise.all([
      db.select({ digestRecipients: lpRoomSettingsTable.digestRecipients }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1),
      db.select({ email: lpRoomMembersTable.email, status: lpRoomMembersTable.status }).from(lpRoomMembersTable).where(eq(lpRoomMembersTable.pageId, page.id)),
    ]);
    const allowed = new Set([...members.filter((m) => m.status === "allowed").map((m) => m.email.toLowerCase()), ...(Array.isArray(settingsRow[0]?.digestRecipients) ? settingsRow[0].digestRecipients.map((e) => String(e).toLowerCase()) : [])]);
    const asked: string[] = (Array.isArray(req.body?.emails) ? (req.body.emails as unknown[]) : []).filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase());
    const to = [...new Set(asked)].filter((e) => allowed.has(e)).slice(0, 50);
    if (to.length === 0) {
      res.status(400).json({ error: "Pick at least one person who has access to the hub." });
      return;
    }
    const by = req.authUser?.name || req.authUser?.email || "Your account team";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 600) : "";
    const [tenant] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, page.tenantId)).limit(1);
    const [brand] = await db.select({ config: lpBrandSettingsTable.config }).from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, page.tenantId)).limit(1);
    const cfg = (brand?.config ?? {}) as { primaryColor?: unknown; brandName?: unknown };
    const mail = reminderEmail({ partnerName: d.partnerName, senderName: (typeof cfg.brandName === "string" && cfg.brandName.trim()) || tenant?.name || "Your partner", by, items, hubUrl: digest.roomUrl, note, brandColor: typeof cfg.primaryColor === "string" ? cfg.primaryColor : undefined });
    const sent: string[] = [];
    for (const email of to) {
      if (await sendRoomDigestEmail({ recipientEmail: email, subject: mail.subject, html: mail.html, tenantId: page.tenantId }).catch(() => false)) sent.push(email);
    }
    if (sent.length === 0) {
      res.status(502).json({ error: "The reminder couldn't be sent. Try again in a moment." });
      return;
    }
    await db
      .insert(lpRoomSettingsTable)
      .values({ pageId: page.id, tenantId: page.tenantId, allowedDomains: [], lastReminderAt: new Date() })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { lastReminderAt: new Date() } });
    req.log.info({ pageId: page.id, sent: sent.length, by: req.authUser?.email }, "room reminder sent");
    res.json({ ok: true, sent, items: items.length });
  } catch (err) {
    req.log.error({ err }, "room reminder failed");
    res.status(500).json({ error: "Could not send the reminder" });
  }
});

/**
 * Send the programs a rep ticked in the marketing plan queue to marketing's
 * request intake, as ONE request: an intake task in Asana with the brief, and
 * a request on the hub the customer can follow. Nothing is recorded as sent
 * unless the intake took it.
 */
router.post("/lp/partner-rooms/:pageId/plan-queue/send", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const keys = new Set((Array.isArray(req.body?.keys) ? req.body.keys : []).filter((k: unknown): k is string => typeof k === "string").map((k: string) => k.trim()));
    const note = typeof req.body?.note === "string" ? req.body.note.replace(/\s+/g, " ").trim().slice(0, 600) : "";
    const [choiceRows, requests] = await Promise.all([
      db.select().from(lpRoomChoicesTable).where(eq(lpRoomChoicesTable.pageId, page.id)),
      db.select().from(lpRoomRequestsTable).where(eq(lpRoomRequestsTable.pageId, page.id)),
    ]);
    // Only what is actually waiting can be sent: a stale tab can't send a program twice or one the customer has since declined.
    const items = planQueueFor(page, choiceRows, requests).filter((i) => i.state === "queued" && keys.has(i.key));
    if (items.length === 0) {
      res.status(400).json({ error: "Nothing to send: those programs were already sent, or the customer changed their answer. Refresh and try again." });
      return;
    }
    const by = req.authUser?.name || req.authUser?.email || "A team member";
    const customer = page.partnerName || page.title;
    const settings = await loadSettings(page.id);
    const hubUrl = await roomPageUrl(req, page, undefined).catch(() => "");
    const brief = planRequest(customer, items, by, new Date().toISOString().slice(0, 10), hubUrl, note);
    const asana = await hubAsanaTarget(page.tenantId, settings.asanaProjectGid);
    const result = await createIntakeTask({ tenantId: page.tenantId, pageId: page.id, name: asanaRequestTaskName(customer, brief.subject), notes: brief.notes, projectGid: asana.projectGid, assigneeGid: asana.assigneeGid });
    if (!result.ok) {
      res.status(502).json({ error: result.warning ?? "Marketing's request intake didn't take it. Nothing was sent." });
      return;
    }
    const [row] = await db
      .insert(lpRoomRequestsTable)
      .values({ tenantId: page.tenantId, pageId: page.id, kind: "marketing", subject: brief.subject, details: brief.details, assetKey: brief.assetKey, requestedByEmail: req.authUser?.email ?? "team", requestedByName: req.authUser?.name ?? null, asanaTaskGid: result.taskId ?? null })
      .returning({ id: lpRoomRequestsTable.id });
    notifyTeam(page, settings, "📣 Marketing plan sent to marketing", [`*${mrk(by)}* sent ${items.length === 1 ? "1 program" : `${items.length} programs`} to marketing's request intake:`, ...items.map((i) => `• ${mrk(i.title)}${i.value ? ` (${mrk(i.value)})` : ""}`), ...(note ? [mrk(note)] : [])], hubUrl || undefined);
    res.json({ ok: true, requestId: row.id, taskId: result.taskId ?? null, sent: items.map((i) => i.key), warning: result.warning ?? null });
  } catch (err) {
    req.log.error({ err }, "room plan queue send failed");
    res.status(500).json({ error: "Could not send to marketing" });
  }
});

/** Save the hub's Important links from the manage pop-up. They live on the page, so only that part of it changes. */
router.put("/lp/partner-rooms/:pageId/links", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const parsed = parseRoomLinks(req.body?.links);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomLinks(row.blocks, parsed.links) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, links: roomLinksInfo(next) ?? [] });
  } catch (err) {
    req.log.error({ err }, "room links save failed");
    res.status(500).json({ error: "Could not save the links" });
  }
});

/** Save which parts of the hub's Overview are hidden. They live on the page, so only that part of it changes. */
router.put("/lp/partner-rooms/:pageId/overview", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const hidden = parseRoomOverviewHidden(req.body?.hidden);
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomOverviewHidden(row.blocks, hidden) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, hidden: roomOverviewHidden(next) ?? [] });
  } catch (err) {
    req.log.error({ err }, "room overview save failed");
    res.status(500).json({ error: "Could not save the Overview" });
  }
});

router.put("/lp/partner-rooms/:pageId/goals", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const parsed = parseRoomGoals(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomGoals(row.blocks, parsed.goals) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, goals: roomGoalsInfo(next) });
  } catch (err) {
    req.log.error({ err }, "room goals save failed");
    res.status(500).json({ error: "Could not save the goals" });
  }
});

/* ── The mutual action plan, edited from the hub's Settings ─────────────── */

/** Save the hub's plan (what the Action plan tab shows). Only the plan changes on the page. */
router.put("/lp/partner-rooms/:pageId/plan", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    if (!Array.isArray(req.body?.groups)) {
      res.status(400).json({ error: "No plan sent." });
      return;
    }
    const groups = cleanPlanGroups(req.body.groups);
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomPlan(row.blocks, groups) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true, plan: roomPlanInfo(next) });
  } catch (err) {
    req.log.error({ err }, "room plan save failed");
    res.status(500).json({ error: "Could not save the plan" });
  }
});

/** The MAP spreadsheet: the blank template (example steps), or ?current=1 for this hub's plan to edit and bring back in. */
router.get("/lp/partner-rooms/:pageId/plan/template", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const current = req.query.current === "1" ? (await roomPlanFor(page.id))?.groups ?? [] : null;
    const slug = (page.title || "hub").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "hub";
    res.json({ fileName: current ? `${slug}-action-plan.csv` : "mutual-action-plan-template.csv", csv: planCsv(current), columns: PLAN_COLUMN_GUIDE });
  } catch (err) {
    req.log.error({ err }, "room plan template failed");
    res.status(500).json({ error: "Could not make the spreadsheet" });
  }
});

/**
 * Read an uploaded MAP (CSV or .xlsx, base64) and show what the plan would become: replace it, or add the
 * file's steps to it. Nothing is saved here; the Settings section shows the result and saves it with PUT /plan.
 */
router.post("/lp/partner-rooms/:pageId/plan/import", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.slice(0, 200) : "";
    const b64 = typeof req.body?.fileBase64 === "string" ? req.body.fileBase64 : "";
    const mode = req.body?.mode === "add" ? "add" : "replace";
    if (!fileName || !b64) {
      res.status(400).json({ error: "Choose a CSV or Excel file." });
      return;
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: "That file is over 5 MB." });
      return;
    }
    const ext = (fileName.split(".").pop() ?? "").toLowerCase();
    let rows: string[][];
    try {
      if (ext === "xlsx") {
        const sheets = readXlsx(buf);
        // The first sheet with a Step column (a workbook may keep notes on another tab).
        rows = (sheets.find((sh) => !parsePlanRows(sh.rows).error) ?? sheets[0])?.rows ?? [];
      } else if (ext === "csv" || ext === "tsv" || ext === "txt") {
        rows = csvRows(buf.toString("utf8"));
      } else {
        res.status(400).json({ error: "Use a .csv or .xlsx file." });
        return;
      }
    } catch {
      res.status(400).json({ error: "That file couldn't be read. Save it as .csv or .xlsx and try again." });
      return;
    }
    const parsed = parsePlanRows(rows);
    if (parsed.error) {
      res.status(400).json({ error: parsed.error, warnings: parsed.warnings });
      return;
    }
    const current = (await roomPlanFor(page.id))?.groups ?? [];
    res.json({ groups: mergeImportedPlan(current, parsed.groups, mode), steps: parsed.steps, phases: parsed.groups.length, warnings: parsed.warnings, mode });
  } catch (err) {
    req.log.error({ err }, "room plan import failed");
    res.status(500).json({ error: "Could not read the file" });
  }
});

/** Re-read the room's Google Calendar now (it is also re-read about every hour). */
router.post("/lp/partner-rooms/:pageId/calendar/sync", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const result = await syncRoomCalendar(page.id, { customer: page.partnerName || page.title });
    res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true, note: result.note, drafted: result.drafted } : { error: result.note });
  } catch (err) {
    req.log.error({ err }, "room calendar sync failed");
    res.status(500).json({ error: "Could not read the calendar" });
  }
});

/**
 * A synced meeting: hide it from the customer, edit its minutes, and publish,
 * unpublish or dismiss them. Publishing is the only way minutes reach the customer.
 */
router.patch("/lp/partner-rooms/:pageId/events/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const id = Number(req.params.id);
    const [row] = Number.isFinite(id) ? await db.select().from(lpRoomEventsTable).where(and(eq(lpRoomEventsTable.id, id), eq(lpRoomEventsTable.pageId, page.id), eq(lpRoomEventsTable.tenantId, page.tenantId))).limit(1) : [];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const set: Partial<typeof lpRoomEventsTable.$inferInsert> = {};
    if (typeof req.body?.hidden === "boolean") set.hidden = req.body.hidden;
    const minutes = req.body?.minutes !== undefined ? cleanMinutes(req.body.minutes) : row.minutes;
    if (req.body?.minutes !== undefined) set.minutes = minutes;
    if (req.body?.minutesStatus !== undefined) {
      const status = req.body.minutesStatus;
      if (status !== "draft" && status !== "published" && status !== "dismissed") {
        res.status(400).json({ error: "Minutes can be a draft, published or dismissed." });
        return;
      }
      if (status === "published" && minutesAreEmpty(minutes)) {
        res.status(400).json({ error: "There is nothing to publish yet: add a summary, a decision or an action item." });
        return;
      }
      set.minutesStatus = status;
    } else if (req.body?.minutes !== undefined && !row.minutesStatus) {
      set.minutesStatus = "draft"; // minutes typed in by hand start as a draft too
    }
    if (Object.keys(set).length === 0) {
      res.status(400).json({ error: "Nothing to change" });
      return;
    }
    await db.update(lpRoomEventsTable).set({ ...set, updatedAt: sql`now()` }).where(eq(lpRoomEventsTable.id, row.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room event update failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/** Who looked at which asset, for the team: one row per asset plus the latest activity. Last 90 days. */
async function roomAssetEngagement(pageId: number): Promise<{ assets: RoomAssetStat[]; recent: { title: string; action: string; value: number | null; who: string | null; at: string }[] }> {
  const rows = await db
    .select()
    .from(lpAssetEventsTable)
    .where(and(eq(lpAssetEventsTable.pageId, pageId), gte(lpAssetEventsTable.createdAt, new Date(Date.now() - 90 * 86_400_000))))
    .orderBy(desc(lpAssetEventsTable.createdAt))
    .limit(5000);
  const events = rows.filter((r) => r.assetKind !== "hub" && r.action !== "seen");
  return { assets: summarizeAssetEvents(events), recent: events.filter((r) => r.action !== "progress").slice(0, 25).map((r) => ({ title: r.assetTitle || r.assetKey, action: r.action, value: r.value, who: r.viewerName || r.viewerEmail, at: r.createdAt.toISOString() })) };
}

/** What the launch-asset generator needs, plus whether the room was created automatically (its kit is then made on first open). */
async function roomKitFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks, createdBy: lpPagesTable.createdBy, tenantId: lpPagesTable.tenantId }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  const kit = row ? roomKitInfo(resolveRoomBlocks(row.blocks)) : null;
  if (!kit || !row) return null;
  // Is the sign-up page the one-pager points at live? One of our own pages still in draft is a dead link; an address we
  // cannot check (the customer's own site) is taken as live.
  const slug = kit.signupUrl ? roomSignupSlug({ links: [{ url: kit.signupUrl }] }) : "";
  const ours = slug ? (await signupPagesBySlug(row.tenantId, [slug])).get(slug) : undefined;
  return { ...kit, signupPublished: !!kit.signupUrl && (ours ? ours.published : true), automatic: row.createdBy === "automatic rooms" };
}

/** The hub's goals as stored on the page, for the manage pop-up to edit. */
/** What moving a hub past its rollout needs to know: what the customer has ticked, and how many practices order each product line. */
async function expansionPlanContext(pageId: number): Promise<{ ticked: string[]; productSummary: ReturnType<typeof productLineSummary> | null }> {
  const [ticks, products] = await Promise.all([
    db.select({ key: lpRoomTaskStateTable.taskKey }).from(lpRoomTaskStateTable).where(eq(lpRoomTaskStateTable.pageId, pageId)),
    db.select({ products: lpRoomPracticesTable.products }).from(lpRoomPracticesTable).where(and(eq(lpRoomPracticesTable.pageId, pageId), sql`COALESCE(${lpRoomPracticesTable.products}, '') <> ''`)).limit(5000),
  ]);
  return { ticked: ticks.map((t) => t.key), productSummary: products.length ? productLineSummary(products.map((r) => r.products ?? "")) : null };
}

/** The rep's keep / retire choices for the open rollout steps, as sent. */
function expansionDecisions(raw: unknown): Record<string, ExpansionDecision> {
  const out: Record<string, ExpansionDecision> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 200)) if (v === "keep" || v === "retire") out[k.slice(0, 80)] = v;
  return out;
}

async function roomStageFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return row ? roomStageInfo(row.blocks) : null;
}

/** The hub's marketing plan as a queue, from its decisions and the requests already sent for them. */
function planQueueFor(page: RoomPage, choiceRows: { choiceKey: string; value: string; chosenByName: string | null; chosenByEmail: string; chosenAt: Date }[], requests: { id: number; assetKey: string | null; status: string; asanaTaskGid: string | null; createdAt: Date }[]) {
  const programs = [...page.choices.values()];
  return buildPlanQueue(
    programs.map((p) => ({ key: p.key, title: p.title, description: p.description, audience: p.audience, when: p.when })),
    // A choice the plan no longer offers is not a decision.
    choiceRows.filter((c) => page.choices.get(c.choiceKey)?.options.includes(c.value)).map((c) => ({ key: c.choiceKey, value: c.value, by: c.chosenByName || c.chosenByEmail, at: c.chosenAt })),
    requests,
  );
}

async function roomLinksFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return row ? roomLinksInfo(row.blocks) : null;
}

async function roomOverviewHiddenFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return row ? roomOverviewHidden(row.blocks) : null;
}

/** The practice sign-up page a hub links to, when it is one of this workspace's own pages. */
async function signupPageFor(tenantId: number, props: Record<string, unknown> | null) {
  const slug = roomSignupSlug(props);
  return slug ? ((await signupPagesBySlug(tenantId, [slug])).get(slug) ?? null) : null;
}

async function roomAccountFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return (row ? roomAccountInfo(row.blocks) : null) ?? { account: null, team: null };
}

async function roomCoverFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return row ? roomCoverInfo(row.blocks) : null;
}

async function roomPlanFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return row ? roomPlanInfo(row.blocks) : null;
}

async function roomGoalsFor(pageId: number) {
  const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1);
  return row ? roomGoalsInfo(row.blocks) : null;
}

/** Whose Google account a room reads through, for the team's panel (never the token). */
async function roomCalendarConnection(connectionId: number | null, tenantId: number, userId: number | null): Promise<{ googleEmail: string; status: string; mine: boolean } | null> {
  if (!connectionId) return null;
  const [c] = await db.select().from(lpGoogleConnectionsTable).where(and(eq(lpGoogleConnectionsTable.id, connectionId), eq(lpGoogleConnectionsTable.tenantId, tenantId))).limit(1);
  return c ? { googleEmail: c.googleEmail, status: c.status, mine: c.userId === userId } : null;
}

async function readUpload(page: RoomPage, idRaw: unknown): Promise<{ fileName: string; buffer: Buffer } | null> {
  const id = Number(idRaw);
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(lpRoomUploadsTable).where(and(eq(lpRoomUploadsTable.id, id), eq(lpRoomUploadsTable.pageId, page.id), eq(lpRoomUploadsTable.tenantId, page.tenantId))).limit(1);
  if (!row) return null;
  const file = await objectStorage.getObjectEntityFile(row.objectPath);
  const chunks: Buffer[] = [];
  for await (const chunk of file.createReadStream() as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return { fileName: row.fileName, buffer: Buffer.concat(chunks) };
}

/**
 * Compare a file the customer uploaded (their practice list or doctor roster)
 * with the practices we hold for the room: what is on their list but not in
 * ours (Salesforce is missing it), and the reverse.
 */
router.post("/lp/partner-rooms/:pageId/uploads/:id/compare", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const upload = await readUpload(page, req.params.id);
    if (!upload) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    let names: ReturnType<typeof practiceNamesFromUpload>;
    let doctors: ReturnType<typeof doctorCountFromUpload>;
    try {
      names = practiceNamesFromUpload(upload.fileName, upload.buffer);
      doctors = doctorCountFromUpload(upload.fileName, upload.buffer);
    } catch {
      res.status(400).json({ error: "That file can't be compared. Use an .xlsx or .csv list." });
      return;
    }
    if (!names && !doctors) {
      res.status(400).json({ error: "Couldn't find a practice or doctor column in that file. The header row needs a column like “Practice name” or “Doctor”." });
      return;
    }
    const roomNames = (await db.select({ name: lpRoomPracticesTable.name }).from(lpRoomPracticesTable).where(and(eq(lpRoomPracticesTable.pageId, page.id), sql`${lpRoomPracticesTable.source} IS DISTINCT FROM 'upload'`))).map((p) => p.name); // the gap is against what the sync lists, not what a roster added
    const result = names ? reconcilePractices(names.names, roomNames) : null;
    res.json({
      fileName: upload.fileName,
      practices: result && { ...result, sheet: names!.sheet, missingFromRoom: result.missingFromRoom.slice(0, 2000), notOnUpload: result.notOnUpload.slice(0, 2000) },
      doctors: doctors && { count: doctors.count, sheet: doctors.sheet },
    });
  } catch (err) {
    req.log.error({ err }, "room upload compare failed");
    res.status(500).json({ error: "Could not compare that file" });
  }
});

/**
 * Tell RevOps now, in the room's Slack channel, what Salesforce is missing
 * (the weekly Slack digest repeats it until the gap closes). Slack only:
 * RevOps does not get an Asana task.
 */
router.post("/lp/partner-rooms/:pageId/revops-task", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const missing = (Array.isArray(req.body?.missing) ? (req.body.missing as unknown[]) : []).map((m) => String(m ?? "").trim().slice(0, 160)).filter(Boolean).slice(0, 2000);
    const doctors = Number.isFinite(Number(req.body?.doctors)) ? Math.max(0, Math.floor(Number(req.body.doctors))) : 0;
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.slice(0, 160) : "";
    if (missing.length === 0 && doctors === 0) {
      res.status(400).json({ error: "Nothing to raise: no missing practices or doctors." });
      return;
    }
    const [full] = await db.select({ mention: lpRoomSettingsTable.revopsSlackMention, channel: lpRoomSettingsTable.slackChannelId }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1);
    const lines = revopsSlackLines({ fileName, missing, matched: 0, uploaded: missing.length, doctors: doctors || null }, slackMention(full?.mention), page.partnerName || page.title);
    const posted = await slackService
      .postMessage(page.tenantId, { text: `RevOps action item: ${page.partnerName || page.title}`, channelId: full?.channel ?? undefined, blocks: [{ type: "header", text: { type: "plain_text", text: "🧾 RevOps action item", emoji: true } }, { type: "section", text: { type: "mrkdwn", text: lines.join("\n\n").slice(0, 2900) } }] })
      .catch(() => false);
    if (!posted) {
      res.status(502).json({ error: "Couldn't post to Slack. Check that Slack is connected and the hub has a channel." });
      return;
    }
    res.json({ ok: true, mentioned: !!slackMention(full?.mention) });
  } catch (err) {
    req.log.error({ err }, "room revops post failed");
    res.status(500).json({ error: "Could not post the action item" });
  }
});

/** The weekly digest as it would go out now: the email, who gets it, and the Slack text. */
router.post("/lp/partner-rooms/:pageId/digest/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const digest = await buildRoomDigest(page.id);
    if (!digest) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    res.json({ subject: digest.email.subject, html: digest.email.html, recipients: digest.recipients, slackText: (digest.slack.blocks[1] as { text?: { text?: string } })?.text?.text ?? "", slackHeader: (digest.slack.blocks[0] as { text?: { text?: string } })?.text?.text ?? "", slackContext: (digest.slack.blocks[2] as { elements?: { text?: string }[] })?.elements?.[0]?.text ?? "", empty: digest.empty });
  } catch (err) {
    req.log.error({ err }, "room digest preview failed");
    res.status(500).json({ error: "Could not build the digest" });
  }
});

/** Send the digest now (Slack post + an email to each recipient). */
router.post("/lp/partner-rooms/:pageId/digest/send", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    res.json(await sendRoomDigest(page.id, { scheduled: false }));
  } catch (err) {
    req.log.error({ err }, "room digest send failed");
    res.status(500).json({ error: "Could not send the digest" });
  }
});

/** The practice list for the team (same filters as the customer's view). */
router.get("/lp/partner-rooms/:pageId/practices", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80).replace(/[%_\\]/g, "") : "";
    const where = and(eq(lpRoomPracticesTable.pageId, page.id), q ? ilike(lpRoomPracticesTable.name, `%${q}%`) : undefined);
    const rows = await db.select().from(lpRoomPracticesTable).where(where).orderBy(asc(lpRoomPracticesTable.name)).limit(2000);
    res.json({
      rows: rows.map((p) => ({ id: p.id, name: p.name, region: p.region, city: p.city, state: p.state, wave: p.wave, stage: p.stage, trainingDate: p.trainingDate, liveDate: p.liveDate, hasAddress: !!(p.address ?? "").trim(), kitSentAt: p.kitSentAt ? p.kitSentAt.toISOString() : null })),
      noDirectOutreach: await hubRestrictsOutreach(page.id),
    });
  } catch (err) {
    req.log.error({ err }, "room practices list failed");
    res.status(500).json({ error: "Could not load practices" });
  }
});

/** Send welcome kits to the practices picked on the Sales Console's practice list (`dryRun` only says what would happen). */
router.post("/lp/partner-rooms/:pageId/welcome-kits", async (req: Request, res: Response): Promise<void> => {
  try {
    const owned = await ownedRoomPage(req, res);
    if (!owned) return;
    const page = await loadRoomPage(owned.id);
    if (!page || !page.isWorkspace) {
      res.status(400).json({ error: "This page isn't a Partner Hub." });
      return;
    }
    await sendKitsFromRequest(req, res, page, req.authUser?.name || req.authUser?.email || "The account team");
  } catch (err) {
    req.log.error({ err }, "partner hub welcome kits failed");
    if (!res.headersSent) res.status(500).json({ error: "Could not add to the welcome kit list" });
  }
});

/** Put the practices picked on the Sales Console's list into a wave (or take them out of one, with a blank wave). */
router.post("/lp/partner-rooms/:pageId/practices/wave", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const ids = Array.isArray(req.body?.ids) ? [...new Set((req.body.ids as unknown[]).filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0))].slice(0, 2000) : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "Nothing selected" });
      return;
    }
    const wave = typeof req.body?.wave === "string" ? req.body.wave.trim().slice(0, 80) : "";
    const updated = await db.update(lpRoomPracticesTable).set({ wave: wave || null, updatedAt: sql`now()` }).where(and(eq(lpRoomPracticesTable.pageId, page.id), inArray(lpRoomPracticesTable.id, ids))).returning({ id: lpRoomPracticesTable.id });
    res.json({ ok: true, moved: updated.length, wave: wave || null });
  } catch (err) {
    req.log.error({ err }, "room practices wave failed");
    res.status(500).json({ error: "Could not move the practices" });
  }
});

/** Change one practice: stage, wave, region, dates. */
router.patch("/lp/partner-rooms/:pageId/practices/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const id = Number(req.params.id);
    const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) || null : undefined);
    const set: Partial<typeof lpRoomPracticesTable.$inferInsert> = {};
    if (req.body?.stage !== undefined) {
      if (!(ROOM_PRACTICE_STAGES as readonly string[]).includes(String(req.body.stage))) {
        res.status(400).json({ error: "Invalid stage" });
        return;
      }
      set.stage = normalizePracticeStage(req.body.stage);
    }
    for (const k of ["wave", "region", "trainingDate", "liveDate"] as const) {
      const v = str(req.body?.[k]);
      if (v !== undefined) set[k] = v;
    }
    const updated = Number.isFinite(id)
      ? await db.update(lpRoomPracticesTable).set({ ...set, updatedAt: sql`now()` }).where(and(eq(lpRoomPracticesTable.id, id), eq(lpRoomPracticesTable.pageId, page.id))).returning({ id: lpRoomPracticesTable.id })
      : [];
    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room practice update failed");
    res.status(500).json({ error: "Could not update" });
  }
});

/** Remove every practice from the room (to start the list over). */
router.delete("/lp/partner-rooms/:pageId/practices", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    await db.delete(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, page.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room practices clear failed");
    res.status(500).json({ error: "Could not clear" });
  }
});

/** Post a win from the team's side (shows in the room as the signed-in person). */
router.post("/lp/partner-rooms/:pageId/wins", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const parsed = parseRoomWin(req.body ?? {});
    const email = req.authUser?.email?.toLowerCase();
    if (!parsed.ok || !email) {
      res.status(400).json({ error: parsed.ok ? "Sign in again to post" : parsed.error });
      return;
    }
    const mentioned = resolveMentions(parsed.body, req.body?.mentions, await roomPeople(page));
    await db.insert(lpRoomWinsTable).values({
      tenantId: page.tenantId,
      pageId: page.id,
      body: parsed.body,
      headline: parsed.headline,
      region: parsed.region,
      images: parseWinImages(req.body?.images),
      mentions: mentioned.map((m) => m.name),
      authorSide: "team",
      authorEmail: email,
      authorName: req.authUser?.name || null,
    });
    sendFeedAlerts(page, feedAlertsFor({ authorEmail: email, mentioned, comment: false }), req.authUser?.name || "The team", parsed.body, await roomPageUrl(req, page, null));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room team win failed");
    res.status(500).json({ error: "Could not post" });
  }
});

/** Reply to a win from the team's side. */
router.post("/lp/partner-rooms/:pageId/wins/:id/comments", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const win = await winRowOnPage(page, Number(req.params.id));
    const body = parseRoomComment(req.body?.body);
    const email = req.authUser?.email?.toLowerCase();
    if (!win || !body || !email) {
      res.status(win ? 400 : 404).json({ error: win ? "Write a comment first" : "Not found" });
      return;
    }
    const mentioned = resolveMentions(body, req.body?.mentions, await roomPeople(page));
    await db.insert(lpRoomWinCommentsTable).values({ tenantId: page.tenantId, winId: win.id, body, mentions: mentioned.map((m) => m.name), authorSide: "team", authorEmail: email, authorName: req.authUser?.name || null });
    sendFeedAlerts(page, feedAlertsFor({ authorEmail: email, mentioned, comment: true, winAuthorEmail: win.authorEmail }), req.authUser?.name || "The team", body, await roomPageUrl(req, page, null));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room team comment failed");
    res.status(500).json({ error: "Could not post" });
  }
});

/** Remove a win (and its likes and comments) from the feed. */
router.delete("/lp/partner-rooms/:pageId/wins/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const winId = await winOnPage(page, Number(req.params.id));
    if (!winId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(lpRoomWinCommentsTable).where(eq(lpRoomWinCommentsTable.winId, winId));
    await db.delete(lpRoomWinLikesTable).where(eq(lpRoomWinLikesTable.winId, winId));
    await db.delete(lpRoomWinsTable).where(eq(lpRoomWinsTable.id, winId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room win delete failed");
    res.status(500).json({ error: "Could not remove" });
  }
});

/** Remove a contact the customer added. */
router.delete("/lp/partner-rooms/:pageId/contacts/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const id = Number(req.params.id);
    if (Number.isFinite(id)) await db.delete(lpRoomContactsTable).where(and(eq(lpRoomContactsTable.id, id), eq(lpRoomContactsTable.pageId, page.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room contact delete failed");
    res.status(500).json({ error: "Could not remove" });
  }
});

/** Re-open a task the customer completed (their uploads are kept). */
router.delete("/lp/partner-rooms/:pageId/tasks/:taskKey", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, page.id), eq(lpRoomTaskStateTable.taskKey, String(req.params.taskKey))));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room task reset failed");
    res.status(500).json({ error: "Could not update" });
  }
});

/** The only way to read an uploaded file: signed in, same tenant, as an attachment. */
/**
 * Delete a file a customer uploaded: the record and the stored file. When it
 * was the only file for its step, the step is open again, so the customer is
 * asked for it again instead of the hub saying "received" with nothing behind
 * it. Practices or doctors already read from the file stay as they are.
 */
router.delete("/lp/partner-rooms/:pageId/uploads/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await ownedRoomPage(req, res);
    if (!page) return;
    const id = Number(req.params.id);
    const [row] = Number.isFinite(id)
      ? await db.select().from(lpRoomUploadsTable).where(and(eq(lpRoomUploadsTable.id, id), eq(lpRoomUploadsTable.pageId, page.id), eq(lpRoomUploadsTable.tenantId, page.tenantId))).limit(1)
      : [];
    if (!row) {
      res.status(404).json({ error: "That file is already gone." });
      return;
    }
    await db.delete(lpRoomUploadsTable).where(and(eq(lpRoomUploadsTable.id, row.id), eq(lpRoomUploadsTable.tenantId, page.tenantId)));
    // The record is what the hub goes by; a stored file that won't delete is logged, not shown as a failure.
    await objectStorage.deleteObjectEntity(row.objectPath).catch((err) => req.log.warn({ err, uploadId: row.id }, "room upload file could not be removed from storage"));
    const [{ n }] = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM lp_room_uploads WHERE page_id = ${page.id} AND task_key = ${row.taskKey}`)).rows as Array<{ n: number }>;
    const reopened = n === 0 && page.tasks.get(row.taskKey)?.action === "upload";
    if (reopened) await db.delete(lpRoomTaskStateTable).where(and(eq(lpRoomTaskStateTable.pageId, page.id), eq(lpRoomTaskStateTable.taskKey, row.taskKey)));
    req.log.info({ pageId: page.id, uploadId: row.id, fileName: row.fileName, by: req.authUser?.email }, "room upload deleted");
    res.json({ ok: true, reopened });
  } catch (err) {
    req.log.error({ err }, "room upload delete failed");
    res.status(500).json({ error: "Could not delete the file" });
  }
});

router.get("/lp/partner-rooms/uploads/:id/download", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const id = Number(req.params.id);
    const [row] = Number.isFinite(id)
      ? await db.select().from(lpRoomUploadsTable).where(and(eq(lpRoomUploadsTable.id, id), eq(lpRoomUploadsTable.tenantId, tenantId))).limit(1)
      : [];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const file = await objectStorage.getObjectEntityFile(row.objectPath);
    res.setHeader("Content-Type", row.contentType);
    res.setHeader("Content-Length", String(row.sizeBytes));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    (file.createReadStream() as Readable).on("error", () => res.destroy()).pipe(res);
  } catch (err) {
    req.log.error({ err }, "room download failed");
    if (!res.headersSent) res.status(404).json({ error: "Not found" });
  }
});

export default router;
