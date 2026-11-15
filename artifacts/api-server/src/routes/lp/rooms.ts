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
import { Readable } from "stream";
import {
  db,
  lpPagesTable,
  lpRoomStandardAssetsTable,
  appUsersTable,
  tenantMembersTable,
  lpAssetEventsTable,
  lpGoogleConnectionsTable,
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
  salesContactsTable,
  salesHotlinksTable,
  tenantsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, or, sql, gte } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { ObjectStorageService } from "../../lib/objectStorage";
import { getActiveHostsForTenant } from "../../lib/tenantHosts";
import { getRequestHost, getRequestProto } from "../../lib/requestHost";
import { sendRoomAccessEmail } from "../../lib/notifications";
import { CALENDAR_ID_RE, cleanMinutes, loadPublicRoomCalendar, minutesAreEmpty, syncRoomCalendar } from "../../lib/partnerRoomCalendar";
import { slackService } from "../../lib/slack-service";
import { parseAssetEventBody } from "../../lib/assetEvents";
import { summarizeAssetEvents, type RoomAssetStat } from "../../lib/partnerRoomEngagement";
import { createIntakeTask } from "../../lib/asana";
import { sfdcService } from "../../lib/sfdc-service";
import { buildRoomDigest, practiceSummary, revopsSlackLines, sendRoomDigest, sheetIdFrom, SHEET_TAB_RE, slackMention, syncPracticesFromSheet, upsertPractices } from "../../lib/partnerRoomService";
import { doctorCountFromUpload, practiceNamesFromUpload, reconcilePractices } from "../../lib/partnerRoomReconcile";
import {
  ASANA_REQUEST_KINDS,
  asanaRequestTaskName,
  normalizePracticeStage,
  parsePracticeCsv,
  ROOM_PRACTICE_STAGES,
  roomCalendarIcs,
  roomKitInfo,
  resolveRoomBlocks,
  ROOM_STANDARD_ASSETS,
  parseRoomKitAsset,
  setRoomKitAsset,
  roomPartnerName,
  type RoomPracticeInput,
  extractRoomChoices,
  extractRoomTasks,
  onboardingTeamStepKey,
  parseRoomComment,
  parseRoomContact,
  parseRoomWin,
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
const objectStorage = new ObjectStorageService();
const ROOM_UPLOAD_FOLDER = "room-uploads";

// Reads are cheap and fire on every room view; writes and access requests
// are rare for a real person, so their ceilings are low.
const stateLimiter = rateLimit({ name: "room-state", windowMs: 60_000, max: envLimit("RATE_LIMIT_ROOM_STATE_PER_MIN", 120) });
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
  return { id: page.id, tenantId: page.tenantId, title: page.title, slug: page.slug, tasks: extractRoomTasks(page.blocks), isWorkspace: pageIsRoom(page.blocks), choices: extractRoomChoices(page.blocks), teamStepKey: onboardingTeamStepKey(page.blocks), partnerName: roomPartnerName(page.blocks) };
}

async function loadSettings(pageId: number): Promise<{ allowedDomains: string[]; slackChannelId: string | null; sfdcAccountId: string | null; asanaProjectGid: string | null }> {
  const [row] = await db
    .select({ allowedDomains: lpRoomSettingsTable.allowedDomains, slackChannelId: lpRoomSettingsTable.slackChannelId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId, asanaProjectGid: lpRoomSettingsTable.asanaProjectGid })
    .from(lpRoomSettingsTable)
    .where(eq(lpRoomSettingsTable.pageId, pageId))
    .limit(1);
  return { allowedDomains: Array.isArray(row?.allowedDomains) ? row.allowedDomains : [], slackChannelId: row?.slackChannelId ?? null, sfdcAccountId: row?.sfdcAccountId ?? null, asanaProjectGid: row?.asanaProjectGid ?? null };
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
async function resolveViewer(page: RoomPage, body: { hl?: unknown; rt?: unknown }): Promise<Viewer | null> {
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
    if (team) return { email: claims.email, name: team, via: "email" };
    const [settings, status] = await Promise.all([loadSettings(page.id), memberStatus(page.id, claims.email)]);
    if (isEmailAllowed(claims.email, settings.allowedDomains, status)) return { email: claims.email, name: await customerNameFor(page, claims.email), via: "email" };
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
    { type: "context", elements: [{ type: "mrkdwn", text: `${page.title}${pageUrl ? ` · <${pageUrl}|Open the room>` : ""}` }] },
  ];
  void slackService.postMessage(page.tenantId, { blocks, text, channelId: channelId ?? undefined }).catch(() => {});
}

const mrk = (s: string) => s.replace(/[<>&*_~`]/g, " ");

/** Wins with like counts and comments for a page. `viewerEmail` marks which the viewer liked; names are shown, addresses only to a known viewer. */
async function loadWins(pageId: number, viewerEmail: string | null, showEmails: boolean) {
  const wins = await db.select().from(lpRoomWinsTable).where(eq(lpRoomWinsTable.pageId, pageId)).orderBy(desc(lpRoomWinsTable.createdAt)).limit(100);
  if (wins.length === 0) return [];
  const ids = wins.map((w) => w.id);
  const [likes, comments] = await Promise.all([
    db.select({ winId: lpRoomWinLikesTable.winId, email: lpRoomWinLikesTable.email }).from(lpRoomWinLikesTable).where(inArray(lpRoomWinLikesTable.winId, ids)),
    db.select().from(lpRoomWinCommentsTable).where(inArray(lpRoomWinCommentsTable.winId, ids)).orderBy(asc(lpRoomWinCommentsTable.createdAt)),
  ]);
  const who = (name: string | null, email: string, side: string) => name || (showEmails ? email : side === "team" ? "The team" : "A team member");
  return wins.map((w) => ({
    id: w.id,
    body: w.body,
    headline: w.headline,
    region: w.region,
    side: w.authorSide,
    by: who(w.authorName, w.authorEmail, w.authorSide),
    createdAt: w.createdAt.toISOString(),
    likes: likes.filter((l) => l.winId === w.id).length,
    liked: !!viewerEmail && likes.some((l) => l.winId === w.id && l.email === viewerEmail),
    comments: comments.filter((c) => c.winId === w.id).map((c) => ({ id: c.id, body: c.body, side: c.authorSide, by: who(c.authorName, c.authorEmail, c.authorSide), createdAt: c.createdAt.toISOString() })),
  }));
}

/** Workspace state beyond tasks and requests: decisions and wins for everyone, added contacts for known viewers. */
async function loadWorkspaceState(page: RoomPage, viewer: Viewer | null) {
  const [choiceRows, wins, contactRows] = await Promise.all([
    db.select().from(lpRoomChoicesTable).where(eq(lpRoomChoicesTable.pageId, page.id)),
    loadWins(page.id, viewer?.email ?? null, !!viewer),
    viewer ? db.select().from(lpRoomContactsTable).where(eq(lpRoomContactsTable.pageId, page.id)).orderBy(asc(lpRoomContactsTable.createdAt)) : Promise.resolve([]),
  ]);
  const choices: Record<string, { value: string; at: string; by?: string }> = {};
  for (const c of choiceRows) {
    const spec = page.choices.get(c.choiceKey);
    if (!spec || !spec.options.includes(c.value)) continue; // the page no longer offers it
    choices[c.choiceKey] = { value: c.value, at: c.chosenAt.toISOString(), ...(viewer ? { by: c.chosenByName || c.chosenByEmail } : {}) };
  }
  return { choices, wins, contacts: contactRows.map((c) => ({ id: c.id, name: c.name, role: c.role, email: c.email })) };
}

/** A known visitor on a workspace page, or a 401/404 already sent. */
async function requireWorkspaceViewer(req: Request, res: Response): Promise<{ page: RoomPage; viewer: Viewer } | null> {
  const page = await loadRoomPage(req.body?.pageId);
  if (!page || !page.isWorkspace) {
    res.status(404).json({ error: "Room not found" });
    return null;
  }
  const viewer = await resolveViewer(page, req.body ?? {});
  if (!viewer) {
    res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
    return null;
  }
  return { page, viewer };
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
      res.json({ viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] });
      return;
    }
    const viewer = await resolveViewer(page, req.body ?? {});
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
      if (!page.tasks.has(s.taskKey)) continue;
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
          status: r.status,
          owner: r.owner,
          due: r.due,
          assetKey: r.assetKey,
          by: r.requestedByName || r.requestedByEmail,
          createdAt: r.createdAt.toISOString(),
        }))
      : [];
    // Synced meetings and published minutes read the same for every visitor, like the page's own calendar. Drafts never leave the server.
    const extras = page.isWorkspace
      ? { ...(await loadWorkspaceState(page, viewer)), practices: await practiceSummary(page.id), ...(await loadPublicRoomCalendar(page.id)) }
      : { choices: {}, wins: [], contacts: [], practices: { total: 0, byStage: {}, regions: [] }, events: [], minutes: [] };
    res.json({ viewer: viewer ? { email: viewer.email, name: viewer.name } : null, tasks, requests, ...extras });
  } catch (err) {
    req.log.error({ err }, "room state failed");
    res.status(500).json({ error: "Could not load the room" });
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
      postToSlack(page, settings.slackChannelId, "🔑 Room access requested", [`*${mrk(email)}* asked for access to upload files and mark tasks done.`, "Approve or decline from the page's Room panel in LP Studio."], url);
    }
    res.json({ status: "requested" });
  } catch (err) {
    req.log.error({ err }, "room access failed");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

async function requireActor(req: Request, res: Response): Promise<{ page: RoomPage; viewer: Viewer; task: RoomTask } | null> {
  const page = await loadRoomPage(req.body?.pageId);
  if (!page) {
    res.status(404).json({ error: "Room not found" });
    return null;
  }
  const viewer = await resolveViewer(page, req.body ?? {});
  if (!viewer) {
    res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
    return null;
  }
  const key = typeof req.body?.taskKey === "string" ? req.body.taskKey : "";
  const task = page.tasks.get(key);
  if (!task) {
    res.status(404).json({ error: "That task isn't on this page any more" });
    return null;
  }
  return { page, viewer, task };
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
      postToSlack(page, settings.slackChannelId, "✅ Task marked done", [`*${mrk(viewer.name || viewer.email)}* marked *${mrk(task.title)}* as done.`], await roomPageUrl(req, page, req.body?.path));
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
    await db.insert(lpRoomUploadsTable).values({
      tenantId: page.tenantId,
      pageId: page.id,
      taskKey: task.key,
      fileName: parsed.fileName,
      contentType: parsed.contentType,
      sizeBytes: parsed.buffer.length,
      objectPath,
      uploadedByEmail: viewer.email,
      uploadedByName: viewer.name,
    });
    await markDone(page, task.key, viewer);
    const settings = await loadSettings(page.id);
    postToSlack(
      page,
      settings.slackChannelId,
      "📎 File received",
      [`*${mrk(viewer.name || viewer.email)}* uploaded *${mrk(parsed.fileName)}* for *${mrk(task.title)}*.`, "Download it from the page's Room panel in LP Studio."],
      await roomPageUrl(req, page, req.body?.path),
    );
    res.json({ ok: true, fileName: parsed.fileName });
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
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const viewer = await resolveViewer(page, req.body ?? {});
    if (!viewer) {
      res.status(401).json({ error: "Confirm your email to continue", code: "identity_required" });
      return;
    }
    const parsed = parseRoomRequest(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
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
    postToSlack(
      page,
      settings.slackChannelId,
      "📝 New request",
      [`*${mrk(viewer.name || viewer.email)}* asked: *${mrk(parsed.subject)}* (${ROOM_REQUEST_KIND_LABEL[parsed.kind as RoomRequestKind]})`, ...(parsed.details ? [mrk(parsed.details).slice(0, 500)] : []), "Set an owner and status from the page's Room panel in LP Studio."],
      await roomPageUrl(req, page, req.body?.path),
    );
    res.json({ ok: true, id: row.id });
    // Marketing work also goes to the marketing intake in Asana (after the response; never blocks the request).
    if (ASANA_REQUEST_KINDS.includes(parsed.kind)) {
      void createIntakeTask({
        tenantId: page.tenantId,
        pageId: page.id,
        name: asanaRequestTaskName(page.partnerName || page.title, parsed.subject),
        notes: [`Requested by ${viewer.name ? `${viewer.name} (${viewer.email})` : viewer.email} in the ${page.partnerName || page.title} partner room.`, `Type: ${ROOM_REQUEST_KIND_LABEL[parsed.kind as RoomRequestKind]}`, "", parsed.details ?? "", "", `Room: ${await roomPageUrl(req, page, req.body?.path)}`].join("\n"),
        projectGid: settings.asanaProjectGid,
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

/** The practice list, for a known visitor: filter by region and name, 50 a page. */
router.post("/lp/room/practices", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page } = ctx;
    const region = typeof req.body?.region === "string" ? req.body.region.trim().slice(0, 80) : "";
    const q = typeof req.body?.q === "string" ? req.body.q.trim().slice(0, 80) : "";
    const pageNo = Math.max(0, Math.min(1000, Math.floor(Number(req.body?.page) || 0)));
    const where = and(
      eq(lpRoomPracticesTable.pageId, page.id),
      region ? eq(lpRoomPracticesTable.region, region) : undefined,
      q ? or(ilike(lpRoomPracticesTable.name, `%${q.replace(/[%_\\]/g, "")}%`), ilike(lpRoomPracticesTable.city, `%${q.replace(/[%_\\]/g, "")}%`)) : undefined,
    );
    const [rows, [{ n }]] = await Promise.all([
      db.select().from(lpRoomPracticesTable).where(where).orderBy(asc(lpRoomPracticesTable.region), asc(lpRoomPracticesTable.name)).limit(50).offset(pageNo * 50),
      db.select({ n: sql<number>`COUNT(*)::int` }).from(lpRoomPracticesTable).where(where),
    ]);
    res.json({
      total: n,
      page: pageNo,
      pageSize: 50,
      rows: rows.map((p) => ({ id: p.id, name: p.name, region: p.region, city: p.city, state: p.state, wave: p.wave, stage: p.stage, trainingDate: p.trainingDate, liveDate: p.liveDate })),
    });
  } catch (err) {
    req.log.error({ err }, "room practices failed");
    res.status(500).json({ error: "Could not load practices" });
  }
});

/**
 * An asset event from a room (viewed, opened, downloaded, video progress, time
 * in the viewer). Same shape as the hub's beacon, plus who it was when the
 * visitor is identified. Always answers 204: tracking never blocks the page.
 */
router.post("/lp/room/asset", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = parseAssetEventBody(req.body);
    const page = parsed ? await loadRoomPage(parsed.pageId) : null;
    if (parsed && page) {
      const viewer = await resolveViewer(page, req.body ?? {}).catch(() => null);
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

/** The room's calendar as an iCalendar feed a calendar app can subscribe to. Events come from the page itself, which is already open to anyone with the link. */
router.get("/lp/room/calendar.ics", stateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const pageId = Number(req.query.pageId);
    const [page] = Number.isFinite(pageId) && pageId > 0 ? await db.select({ title: lpPagesTable.title, blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, pageId)).limit(1) : [];
    const synced = page ? (await loadPublicRoomCalendar(pageId)).events : [];
    const ics = page ? roomCalendarIcs(resolveRoomBlocks(page.blocks), `${roomPartnerName(page.blocks) || page.title} partnership`, synced) : null;
    if (!ics) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=900");
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
    postToSlack(page, settings.slackChannelId, "🗳️ Marketing plan decision", [`*${mrk(viewer.name || viewer.email)}* chose *${mrk(value)}* for *${mrk(spec.title)}*.`], await roomPageUrl(req, page, req.body?.path));
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
      res.status(400).json({ error: "That's the most people a room can hold. Ask your team to tidy the list." });
      return;
    }
    await db.insert(lpRoomContactsTable).values({ tenantId: page.tenantId, pageId: page.id, name: parsed.name, role: parsed.role, email: parsed.email, addedByEmail: viewer.email });
    if (page.teamStepKey) await markDone(page, page.teamStepKey, viewer);
    const settings = await loadSettings(page.id);
    postToSlack(page, settings.slackChannelId, "👤 Team contact added", [`*${mrk(viewer.name || viewer.email)}* added *${mrk(parsed.name)}*${parsed.role ? ` (${mrk(parsed.role)})` : ""}${parsed.email ? ` · ${mrk(parsed.email)}` : ""}.`], await roomPageUrl(req, page, req.body?.path));
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
    const parsed = parseRoomWin({ body: req.body?.body, region: req.body?.region });
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    await db.insert(lpRoomWinsTable).values({ tenantId: page.tenantId, pageId: page.id, body: parsed.body, region: parsed.region, authorSide: "customer", authorEmail: viewer.email, authorName: viewer.name });
    const settings = await loadSettings(page.id);
    postToSlack(page, settings.slackChannelId, "🏆 New win posted", [`*${mrk(viewer.name || viewer.email)}*: ${mrk(parsed.body).slice(0, 500)}`], await roomPageUrl(req, page, req.body?.path));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room win failed");
    res.status(500).json({ error: "Could not post" });
  }
});

/** The win on THIS page, or null. */
async function winOnPage(page: RoomPage, winIdRaw: unknown): Promise<number | null> {
  const winId = typeof winIdRaw === "number" ? Math.floor(winIdRaw) : NaN;
  if (!Number.isFinite(winId)) return null;
  const [w] = await db.select({ id: lpRoomWinsTable.id }).from(lpRoomWinsTable).where(and(eq(lpRoomWinsTable.id, winId), eq(lpRoomWinsTable.pageId, page.id))).limit(1);
  return w?.id ?? null;
}

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
    const removed = await db.delete(lpRoomWinLikesTable).where(and(eq(lpRoomWinLikesTable.winId, winId), eq(lpRoomWinLikesTable.email, viewer.email))).returning({ id: lpRoomWinLikesTable.id });
    if (removed.length === 0) await db.insert(lpRoomWinLikesTable).values({ tenantId: page.tenantId, winId, email: viewer.email }).onConflictDoNothing();
    res.json({ ok: true, liked: removed.length === 0 });
  } catch (err) {
    req.log.error({ err }, "room like failed");
    res.status(500).json({ error: "Could not save" });
  }
});

/** Comment on a win. */
router.post("/lp/room/win/comment", actionLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireWorkspaceViewer(req, res);
    if (!ctx) return;
    const { page, viewer } = ctx;
    const winId = await winOnPage(page, req.body?.winId);
    const body = parseRoomComment(req.body?.body);
    if (!winId || !body) {
      res.status(winId ? 400 : 404).json({ error: winId ? "Write a comment first" : "That post is gone" });
      return;
    }
    await db.insert(lpRoomWinCommentsTable).values({ tenantId: page.tenantId, winId, body, authorSide: "customer", authorEmail: viewer.email, authorName: viewer.name });
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
    res.json({
      isWorkspace: page.isWorkspace,
      digest: { enabled: !!fullSettings?.digestEnabled, recipients: Array.isArray(fullSettings?.digestRecipients) ? fullSettings.digestRecipients : [], lastSentAt: fullSettings?.lastDigestAt?.toISOString() ?? null },
      sheet: { id: fullSettings?.practicesSheetId ?? null, tab: fullSettings?.practicesSheetTab ?? null, syncedAt: fullSettings?.practicesSyncedAt?.toISOString() ?? null, note: fullSettings?.practicesSyncNote ?? null, filterColumn: fullSettings?.practicesSheetFilterColumn ?? null, filterValue: fullSettings?.practicesSheetFilterValue ?? null },
      revopsSlackMention: fullSettings?.revopsSlackMention ?? null,
      engagement: page.isWorkspace ? await roomAssetEngagement(page.id) : { assets: [], recent: [] },
      kit: page.isWorkspace ? roomKitInfo(resolveRoomBlocks((await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(eq(lpPagesTable.id, page.id)).limit(1))[0]?.blocks)) : null,
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
    res.status(500).json({ error: "Could not load the room" });
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
    const extra: { digestEnabled?: boolean; digestRecipients?: string[]; practicesSheetId?: string | null; practicesSheetTab?: string | null; practicesSheetFilterColumn?: string | null; practicesSheetFilterValue?: string | null; revopsSlackMention?: string | null; calendarId?: string | null; calendarConnectionId?: number | null } = {};
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
    const values = { allowedDomains: domains, slackChannelId: channelRaw || null, sfdcAccountId: sfdcRaw || null, asanaProjectGid: asanaRaw || null, ...extra };
    await db
      .insert(lpRoomSettingsTable)
      .values({ pageId: page.id, tenantId: page.tenantId, ...values })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { ...values, updatedAt: sql`now()` } });
    res.json(values);
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
    const rows = parsePracticeCsv(req.body?.csv);
    if (rows.length === 0) {
      res.status(400).json({ error: "Nothing to import. The first line needs column names, including “name”." });
      return;
    }
    res.json({ ok: true, ...(await upsertPractices(page, rows)) });
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
      .map((a) => ({ externalId: String(a.Id), name: String(a.Name).slice(0, 160), region: a.BillingState ?? null, city: a.BillingCity ?? null, state: a.BillingState ?? null, wave: null, stage: "not_started", stageGiven: false, trainingDate: null, liveDate: null }));
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
      res.status(400).json({ error: "This page isn't a workspace room." });
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
      res.status(400).json({ error: "That isn't a launch asset this room can take." });
      return;
    }
    const [row] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId))).limit(1);
    const next = row ? setRoomKitAsset(row.blocks, asset) : null;
    if (!next) {
      res.status(400).json({ error: "This page isn't a workspace room." });
      return;
    }
    await db.update(lpPagesTable).set({ blocks: next as typeof row.blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "room kit asset save failed");
    res.status(500).json({ error: "Could not add the asset to the launch kit" });
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
    const roomNames = (await db.select({ name: lpRoomPracticesTable.name }).from(lpRoomPracticesTable).where(eq(lpRoomPracticesTable.pageId, page.id))).map((p) => p.name);
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
      res.status(502).json({ error: "Couldn't post to Slack. Check that Slack is connected and the room has a channel." });
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
      res.status(400).json({ error: "This page isn't a workspace room." });
      return;
    }
    res.json({ subject: digest.email.subject, html: digest.email.html, recipients: digest.recipients, slackText: (digest.slack.blocks[1] as { text?: { text?: string } })?.text?.text ?? "", empty: digest.empty });
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
    const rows = await db.select().from(lpRoomPracticesTable).where(where).orderBy(asc(lpRoomPracticesTable.name)).limit(100);
    res.json({ rows: rows.map((p) => ({ id: p.id, name: p.name, region: p.region, wave: p.wave, stage: p.stage, trainingDate: p.trainingDate, liveDate: p.liveDate })) });
  } catch (err) {
    req.log.error({ err }, "room practices list failed");
    res.status(500).json({ error: "Could not load practices" });
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
    await db.insert(lpRoomWinsTable).values({ tenantId: page.tenantId, pageId: page.id, body: parsed.body, headline: parsed.headline, region: parsed.region, authorSide: "team", authorEmail: email, authorName: req.authUser?.name || null });
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
    const winId = await winOnPage(page, Number(req.params.id));
    const body = parseRoomComment(req.body?.body);
    const email = req.authUser?.email?.toLowerCase();
    if (!winId || !body || !email) {
      res.status(winId ? 400 : 404).json({ error: winId ? "Write a comment first" : "Not found" });
      return;
    }
    await db.insert(lpRoomWinCommentsTable).values({ tenantId: page.tenantId, winId, body, authorSide: "team", authorEmail: email, authorName: req.authUser?.name || null });
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
