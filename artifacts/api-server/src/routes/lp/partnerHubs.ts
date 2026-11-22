/**
 * Partner Hubs for the Sales Console: the list of a workspace's hubs, making
 * one for an account, and how a hub is performing.
 *
 * All auth-gated (the /lp/partner-rooms prefix). The hub's own working state
 * and the visitor routes live in ./rooms.ts.
 */
import { Router, type Request, type Response } from "express";
import { db, lpPagesTable, lpPageVisitsTable, lpRoomAutocreateAccountsTable, lpRoomChoicesTable, lpRoomEventsTable, lpRoomMembersTable, lpRoomRequestsTable, lpRoomSettingsTable, lpRoomTaskStateTable, lpRoomViewsTable, salesAccountsTable } from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { extractRoomChoices, extractRoomTasks, pageIsRoom, resolveRoomBlocks, roomPartnerName, roomWorkspaceProps } from "../../lib/partnerRoom";
import { buildPlanQueue } from "../../lib/partnerRoomPlanQueue";
import { needsTotal, type HubNeeds } from "../../lib/partnerRoomNotify";
import { userCanPublish } from "./pages";
import { enforceFactFlagPublishGate } from "./fact-flags";
import { teamPeopleFromBlocks } from "../../lib/partnerRoomFeed";
import { digestRolloutDay } from "../../lib/partnerRoomDigest";
import { roomStageFromProps } from "../../lib/partnerRoomStage";
import { accountKey, cleanAccountName } from "../../lib/partnerRoomNames";
import { createRoom, publicPageUrl } from "../../lib/partnerRoomAutocreate";
import { hubIsMine, hubSetupItems, hubSetupState, sameSfdcId, summarizeRoomViews } from "../../lib/partnerRoomViews";
import { recordHubActivity } from "../../lib/partnerRoomActivity";
import { roomSignupSlug, signupPagesBySlug } from "../../lib/partnerRoomPracticeSite";
import { sfdcService } from "../../lib/sfdc-service";

const router = Router();
const DAY = 86_400_000;

/** Every page in the workspace that carries the hub block. Templates are left out. */
async function hubPages(tenantId: number) {
  return db
    .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status, blocks: lpPagesTable.blocks, accountId: lpPagesTable.accountId, sfdcAccountId: lpPagesTable.sfdcAccountId, createdBy: lpPagesTable.createdBy, updatedBy: lpPagesTable.updatedBy, createdAt: lpPagesTable.createdAt, updatedAt: lpPagesTable.updatedAt })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isTemplate, false), sql`${lpPagesTable.blocks} @> '[{"type":"room-workspace"}]'::jsonb`))
    .orderBy(desc(lpPagesTable.updatedAt))
    .limit(500);
}

type Account = { id: number; name: string; displayName: string | null; owner: string | null; salesforceId: string | null };

/** The account a hub belongs to: the page's own link, else its Salesforce id, else the account's name. */
function accountOf(page: { accountId: number | null; sfdcAccountId: string | null; name: string }, settingsSfdc: string | null, accounts: Account[]): Account | null {
  if (page.accountId) {
    const a = accounts.find((x) => x.id === page.accountId);
    if (a) return a;
  }
  for (const id of [page.sfdcAccountId, settingsSfdc]) {
    if (!id) continue;
    const a = accounts.find((x) => sameSfdcId(x.salesforceId, id));
    if (a) return a;
  }
  const key = accountKey(page.name);
  return key ? (accounts.find((x) => accountKey(x.displayName || x.name) === key || accountKey(x.name) === key) ?? null) : null;
}

router.get("/lp/partner-rooms", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const everyPage = (await hubPages(tenantId)).filter((p) => pageIsRoom(p.blocks));
    // A retired hub is off the list unless the rep asks for the archive.
    const wantArchived = req.query.archived === "1";
    const archivedRows = everyPage.length ? await db.select({ pageId: lpRoomSettingsTable.pageId, archivedAt: lpRoomSettingsTable.archivedAt }).from(lpRoomSettingsTable).where(inArray(lpRoomSettingsTable.pageId, everyPage.map((p) => p.id))) : [];
    const archivedIds = new Set(archivedRows.filter((r) => r.archivedAt).map((r) => r.pageId));
    const pages = everyPage.filter((p) => archivedIds.has(p.id) === wantArchived);
    if (pages.length === 0) {
      res.json({ hubs: [], archived: archivedIds.size });
      return;
    }
    const ids = pages.map((p) => p.id);
    const since = new Date(Date.now() - 30 * DAY);
    // What needs the account team, per hub: the same things the pop-up's To do tab counts, plus minutes to review.
    const [asking, allowed, choiceRows, requestRows, minuteDrafts] = await Promise.all([
      db.select({ pageId: lpRoomMembersTable.pageId, n: sql<number>`count(*)::int` }).from(lpRoomMembersTable).where(and(inArray(lpRoomMembersTable.pageId, ids), eq(lpRoomMembersTable.status, "requested"))).groupBy(lpRoomMembersTable.pageId),
      db.select({ pageId: lpRoomMembersTable.pageId, n: sql<number>`count(*)::int` }).from(lpRoomMembersTable).where(and(inArray(lpRoomMembersTable.pageId, ids), eq(lpRoomMembersTable.status, "allowed"))).groupBy(lpRoomMembersTable.pageId),
      db.select().from(lpRoomChoicesTable).where(inArray(lpRoomChoicesTable.pageId, ids)),
      db.select({ id: lpRoomRequestsTable.id, pageId: lpRoomRequestsTable.pageId, assetKey: lpRoomRequestsTable.assetKey, status: lpRoomRequestsTable.status, asanaTaskGid: lpRoomRequestsTable.asanaTaskGid, createdAt: lpRoomRequestsTable.createdAt }).from(lpRoomRequestsTable).where(inArray(lpRoomRequestsTable.pageId, ids)),
      db.select({ pageId: lpRoomEventsTable.pageId, n: sql<number>`count(*)::int` }).from(lpRoomEventsTable).where(and(inArray(lpRoomEventsTable.pageId, ids), eq(lpRoomEventsTable.minutesStatus, "draft"))).groupBy(lpRoomEventsTable.pageId),
    ]);
    // The sign-up pages these hubs link to, looked up once: a draft one is a dead link in front of the customer.
    const signupPages = await signupPagesBySlug(tenantId, pages.map((p) => roomSignupSlug(roomWorkspaceProps(p.blocks))));
    const needsOf = (pageId: number, blocks: unknown): HubNeeds => {
      const specs = extractRoomChoices(blocks);
      const reqs = requestRows.filter((r) => r.pageId === pageId);
      const queue = buildPlanQueue(
        [...specs.values()].map((p) => ({ key: p.key, title: p.title })),
        choiceRows.filter((c) => c.pageId === pageId && specs.get(c.choiceKey)?.options.includes(c.value)).map((c) => ({ key: c.choiceKey, value: c.value, by: c.chosenByName || c.chosenByEmail, at: c.chosenAt })),
        reqs,
      );
      return { access: asking.find((a) => a.pageId === pageId)?.n ?? 0, marketing: queue.filter((i) => i.state === "queued").length, requests: reqs.filter((r) => r.status === "new").length, minutes: minuteDrafts.find((m) => m.pageId === pageId)?.n ?? 0 };
    };
    const [accounts, settings, doneTasks, openRequests, visits, lastVisits, people] = await Promise.all([
      db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, owner: salesAccountsTable.owner, salesforceId: salesAccountsTable.salesforceId }).from(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId)).limit(5000),
      db.select({ pageId: lpRoomSettingsTable.pageId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId, slackChannelId: lpRoomSettingsTable.slackChannelId }).from(lpRoomSettingsTable).where(inArray(lpRoomSettingsTable.pageId, ids)),
      db.select({ pageId: lpRoomTaskStateTable.pageId, taskKey: lpRoomTaskStateTable.taskKey }).from(lpRoomTaskStateTable).where(inArray(lpRoomTaskStateTable.pageId, ids)),
      db.select({ pageId: lpRoomRequestsTable.pageId, n: sql<number>`count(*)::int` }).from(lpRoomRequestsTable).where(and(inArray(lpRoomRequestsTable.pageId, ids), sql`${lpRoomRequestsTable.status} <> 'done'`)).groupBy(lpRoomRequestsTable.pageId),
      db.select({ pageId: lpPageVisitsTable.pageId, views: sql<number>`count(*)::int` }).from(lpPageVisitsTable).where(and(inArray(lpPageVisitsTable.pageId, ids), gte(lpPageVisitsTable.createdAt, since))).groupBy(lpPageVisitsTable.pageId),
      db.select({ pageId: lpPageVisitsTable.pageId, at: sql<string | null>`max(${lpPageVisitsTable.createdAt})` }).from(lpPageVisitsTable).where(inArray(lpPageVisitsTable.pageId, ids)).groupBy(lpPageVisitsTable.pageId),
      db.select({ pageId: lpRoomViewsTable.pageId, n: sql<number>`count(distinct ${lpRoomViewsTable.viewerEmail})::int`, at: sql<string | null>`max(${lpRoomViewsTable.createdAt})` }).from(lpRoomViewsTable).where(and(inArray(lpRoomViewsTable.pageId, ids), gte(lpRoomViewsTable.createdAt, since))).groupBy(lpRoomViewsTable.pageId),
    ]);
    const practiceCounts = (await db.execute(sql`SELECT page_id AS "pageId", COUNT(*)::int AS total, COUNT(*) FILTER (WHERE stage = 'live')::int AS live FROM lp_room_practices WHERE page_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) GROUP BY page_id`)).rows as { pageId: number; total: number; live: number }[];
    const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null);
    const now = new Date();
    const hubs = await Promise.all(
      pages.map(async (p) => {
        const blocks = resolveRoomBlocks(p.blocks);
        const props = roomWorkspaceProps(blocks) ?? {};
        const name = roomPartnerName(blocks) || p.title;
        const account = accountOf({ accountId: p.accountId, sfdcAccountId: p.sfdcAccountId, name }, settings.find((s) => s.pageId === p.id)?.sfdcAccountId ?? null, accounts);
        const tasks = extractRoomTasks(blocks);
        const done = new Set(doneTasks.filter((t) => t.pageId === p.id).map((t) => t.taskKey));
        const lastPage = iso(lastVisits.find((v) => v.pageId === p.id)?.at);
        const lastRoom = iso(people.find((v) => v.pageId === p.id)?.at);
        const needs = needsOf(p.id, blocks);
        return {
          pageId: p.id,
          title: p.title,
          name,
          slug: p.slug,
          status: p.status === "published" ? "live" : "draft",
          // In setup, ready to share, or shared: from the same checklist the hub's To do shows.
          setup: hubSetupState(hubSetupItems(props, { published: p.status === "published", invited: allowed.find((a) => a.pageId === p.id)?.n ?? 0, slackLinked: !!settings.find((x) => x.pageId === p.id)?.slackChannelId, signup: signupPages.get(roomSignupSlug(roomWorkspaceProps(p.blocks))) ?? null })),
          url: p.status === "published" ? await publicPageUrl(tenantId, p.slug).catch(() => "") : "",
          account: account ? { id: account.id, name: account.displayName || account.name, owner: account.owner } : null,
          day: digestRolloutDay(props.kickoffDate, now),
          // Internal: where the hub is in the partnership, whether to ask the team to move it on, and how many practices are live.
          stage: roomStageFromProps(props, now).stage,
          stagePrompt: roomStageFromProps(props, now).prompt,
          practices: practiceCounts.find((c) => c.pageId === p.id) ?? null,
          waitingOnCustomer: [...tasks.keys()].filter((k) => !done.has(k)).length,
          // Everything that needs the team: what the pop-up's To do tab counts, plus minutes to review. (It used to be open requests only.)
          waitingOnUs: needsTotal(needs),
          needs,
          // Requests someone has already picked up: in hand, not waiting.
          requestsInHand: Math.max(0, (openRequests.find((r) => r.pageId === p.id)?.n ?? 0) - needs.requests),
          archived: archivedIds.has(p.id),
          views30: visits.find((v) => v.pageId === p.id)?.views ?? 0,
          people30: people.find((v) => v.pageId === p.id)?.n ?? 0,
          lastVisitAt: [lastPage, lastRoom].filter((v): v is string => !!v).sort().pop() ?? null,
          mine: hubIsMine({ email: req.authUser?.email, name: req.authUser?.name }, { accountOwner: account?.owner, createdBy: p.createdBy, updatedBy: p.updatedBy, teamEmails: teamPeopleFromBlocks(blocks).map((t) => t.email) }),
          test: /\(test\)\s*$/.test(p.title),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    );
    res.json({ hubs, archived: archivedIds.size });
  } catch (err) {
    req.log.error({ err }, "partner hubs list failed");
    res.status(500).json({ error: "Could not load your Partner Hubs" });
  }
});

/**
 * Make the hub for an account in Accounts. Same creation as the automatic
 * hubs (team, email domain, practices, standard files, practice microsite,
 * Slack note). An account that already has a hub gets that one back.
 */
router.post("/lp/partner-rooms", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const accountId = typeof req.body?.accountId === "number" && Number.isInteger(req.body.accountId) ? req.body.accountId : 0;
    const [account] = accountId ? await db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, owner: salesAccountsTable.owner, salesforceId: salesAccountsTable.salesforceId }).from(salesAccountsTable).where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId))).limit(1) : [];
    if (!account) {
      res.status(404).json({ error: "That account isn't in Accounts." });
      return;
    }
    const name = cleanAccountName(account.displayName || account.name);
    const key = accountKey(name);
    if (!key) {
      res.status(400).json({ error: "That account has no name to build a hub from." });
      return;
    }
    const pages = (await hubPages(tenantId)).filter((p) => !/\(test\)\s*$/.test(p.title));
    const settings = pages.length ? await db.select({ pageId: lpRoomSettingsTable.pageId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId }).from(lpRoomSettingsTable).where(inArray(lpRoomSettingsTable.pageId, pages.map((p) => p.id))) : [];
    const existing = pages.find((p) => accountOf({ accountId: p.accountId, sfdcAccountId: p.sfdcAccountId, name: roomPartnerName(p.blocks) || p.title }, settings.find((s) => s.pageId === p.id)?.sfdcAccountId ?? null, [account])?.id === account.id);
    if (existing) {
      res.json({ ok: true, pageId: existing.id, existed: true });
      return;
    }
    const room = await createRoom(tenantId, { key, name, signedDate: null, owner: account.owner, sfdcId: account.salesforceId });
    if (!room) {
      // Someone (or the automatic reader) got there first: hand back theirs once it exists.
      const [row] = await db.select({ pageId: lpRoomAutocreateAccountsTable.pageId }).from(lpRoomAutocreateAccountsTable).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, key))).limit(1);
      const [page] = row?.pageId && row.pageId > 0 ? await db.select({ id: lpPagesTable.id }).from(lpPagesTable).where(and(eq(lpPagesTable.id, row.pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1) : [];
      if (page) {
        res.json({ ok: true, pageId: page.id, existed: true });
        return;
      }
      if (row?.pageId === -1) {
        res.status(409).json({ error: "That hub is being created right now. Give it a minute." });
        return;
      }
      // The hub this account once had was deleted: free the account and make a new one.
      await db.update(lpRoomAutocreateAccountsTable).set({ pageId: null }).where(and(eq(lpRoomAutocreateAccountsTable.tenantId, tenantId), eq(lpRoomAutocreateAccountsTable.accountKey, key)));
      const again = await createRoom(tenantId, { key, name, signedDate: null, owner: account.owner, sfdcId: account.salesforceId });
      if (!again) {
        res.status(409).json({ error: "That hub is being created right now. Give it a minute." });
        return;
      }
      await linkHub(again.pageId, account, req.authUser?.email ?? null);
      res.json({ ok: true, pageId: again.pageId, checklist: again.facts });
      return;
    }
    await linkHub(room.pageId, account, req.authUser?.email ?? null);
    res.json({ ok: true, pageId: room.pageId, checklist: room.facts });
  } catch (err) {
    req.log.error({ err }, "partner hub create failed");
    res.status(500).json({ error: "Could not create the hub" });
  }
});

/** Tie the new hub to its account and to the rep who made it. `createdBy` stays as the automatic marker: the launch kit builds itself on first open because of it. */
async function linkHub(pageId: number, account: Account, email: string | null): Promise<void> {
  await db.update(lpPagesTable).set({ accountId: account.id, ...(account.salesforceId ? { sfdcAccountId: account.salesforceId } : {}), ...(email ? { updatedBy: email } : {}) }).where(eq(lpPagesTable.id, pageId));
}

/** Who visited the hub, when, for how long, and which sections they opened. The page's own team is never in here. */
router.get("/lp/partner-rooms/:pageId/performance", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const pageId = Number(req.params.pageId);
    const [page] = Number.isInteger(pageId) && pageId > 0 ? await db.select({ id: lpPagesTable.id, createdAt: lpPagesTable.createdAt }).from(lpPagesTable).where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1) : [];
    if (!page) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const days = Math.max(7, Math.min(90, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * DAY);
    const [rows, [pageViews], [first]] = await Promise.all([
      db
        .select({ sessionId: lpRoomViewsTable.sessionId, module: lpRoomViewsTable.module, seconds: lpRoomViewsTable.seconds, viewerEmail: lpRoomViewsTable.viewerEmail, viewerName: lpRoomViewsTable.viewerName, createdAt: lpRoomViewsTable.createdAt })
        .from(lpRoomViewsTable)
        .where(and(eq(lpRoomViewsTable.pageId, page.id), gte(lpRoomViewsTable.createdAt, since)))
        .orderBy(desc(lpRoomViewsTable.createdAt))
        .limit(20_000),
      db.select({ views: sql<number>`count(*)::int`, uniques: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int` }).from(lpPageVisitsTable).where(and(eq(lpPageVisitsTable.pageId, page.id), gte(lpPageVisitsTable.createdAt, since))),
      db.select({ at: sql<string | null>`min(${lpRoomViewsTable.createdAt})` }).from(lpRoomViewsTable).where(eq(lpRoomViewsTable.pageId, page.id)),
    ]);
    res.json({ windowDays: days, ...summarizeRoomViews(rows, { days }), pageViews: pageViews?.views ?? 0, pageVisitors: pageViews?.uniques ?? 0, trackedSince: first?.at ? new Date(first.at).toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "partner hub performance failed");
    res.status(500).json({ error: "Could not load the hub's performance" });
  }
});

/** One hub's header for the Sales Console: its name, links, and what is left to set up. */
/** The account's page in Salesforce, when this workspace is connected to one. */
async function salesforceRecordUrl(tenantId: number, salesforceId: string): Promise<string | null> {
  const connection = await sfdcService.getActiveConnection(tenantId).catch(() => null);
  const base = (connection?.instanceUrl ?? "").replace(/\/+$/, "");
  return /^https:\/\//.test(base) && /^[A-Za-z0-9]{15,18}$/.test(salesforceId) ? `${base}/${salesforceId}` : null;
}

// Who did what to a hub (publishing and archiving live in this file).
router.use("/lp/partner-rooms/:pageId", recordHubActivity);

router.get("/lp/partner-rooms/:pageId/setup", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const pageId = Number(req.params.pageId);
    const [page] = Number.isInteger(pageId) && pageId > 0 ? await db.select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status, blocks: lpPagesTable.blocks, accountId: lpPagesTable.accountId, sfdcAccountId: lpPagesTable.sfdcAccountId }).from(lpPagesTable).where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1) : [];
    if (!page || !pageIsRoom(page.blocks)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const blocks = resolveRoomBlocks(page.blocks);
    const [invited] = await db.select({ n: sql<number>`count(*)::int` }).from(lpRoomMembersTable).where(and(eq(lpRoomMembersTable.pageId, page.id), eq(lpRoomMembersTable.status, "allowed")));
    const published = page.status === "published";
    // The account behind the hub (by its link to Accounts, else its Salesforce id), for the owner's name and a way to it.
    const [hubSettings] = await db.select({ slackChannelId: lpRoomSettingsTable.slackChannelId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId }).from(lpRoomSettingsTable).where(eq(lpRoomSettingsTable.pageId, page.id)).limit(1);
    const sfdc = page.sfdcAccountId || hubSettings?.sfdcAccountId || null;
    const accountRows = page.accountId
      ? await db.select({ id: salesAccountsTable.id, owner: salesAccountsTable.owner, salesforceId: salesAccountsTable.salesforceId }).from(salesAccountsTable).where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, page.accountId))).limit(1)
      : sfdc
        ? (await db.select({ id: salesAccountsTable.id, owner: salesAccountsTable.owner, salesforceId: salesAccountsTable.salesforceId }).from(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId)).limit(5000)).filter((a) => sameSfdcId(a.salesforceId, sfdc)).slice(0, 1)
        : [];
    const account = accountRows[0] ?? null;
    res.json({
      pageId: page.id,
      title: page.title,
      name: roomPartnerName(blocks) || page.title,
      status: published ? "live" : "draft",
      url: published ? await publicPageUrl(tenantId, page.slug).catch(() => "") : "",
      // Internal: rollout or expansion. The pop-up names the launch sections by it ("Launch kit" / "Marketing").
      stage: roomStageFromProps(roomWorkspaceProps(blocks) ?? {}, new Date()).stage,
      setup: hubSetupItems(roomWorkspaceProps(blocks), { published, invited: invited?.n ?? 0, slackLinked: !!hubSettings?.slackChannelId, signup: (await signupPagesBySlug(tenantId, [roomSignupSlug(roomWorkspaceProps(page.blocks))])).get(roomSignupSlug(roomWorkspaceProps(page.blocks))) ?? null }),
      account: account ? { id: account.id, owner: account.owner, salesforceUrl: account.salesforceId ? await salesforceRecordUrl(tenantId, account.salesforceId) : null } : null,
    });
  } catch (err) {
    req.log.error({ err }, "partner hub setup failed");
    res.status(500).json({ error: "Could not load the hub" });
  }
});

/** The hub page behind a Sales Console action, or null (and a 404) when it isn't one of this workspace's hubs. */
async function hubPage(req: Request, res: Response): Promise<{ id: number; tenantId: number; status: string; slug: string } | null> {
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return null;
  const pageId = Number(req.params.pageId);
  const [page] = Number.isInteger(pageId) && pageId > 0 ? await db.select({ id: lpPagesTable.id, status: lpPagesTable.status, slug: lpPagesTable.slug, blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1) : [];
  if (!page || !pageIsRoom(page.blocks)) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return { id: page.id, tenantId, status: page.status, slug: page.slug };
}

/**
 * Publish a hub (or take it offline) from the Sales Console, without a trip
 * to the page builder. The same rules as publishing any page: the rep needs
 * to be allowed to publish in this workspace, and pending fact flags stop it.
 */
router.post("/lp/partner-rooms/:pageId/publish", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await hubPage(req, res);
    if (!page) return;
    const publish = req.body?.publish !== false;
    if (!(await userCanPublish(req.authUser, page.tenantId))) {
      res.status(403).json({ error: publish ? "You can't publish pages in this workspace. Open the editor and submit it for review, or ask an admin." : "You can't unpublish pages in this workspace. Ask an admin." });
      return;
    }
    if (publish && (await enforceFactFlagPublishGate(page.tenantId, page.id, req, res)).blocked) return;
    await db.update(lpPagesTable).set({ status: publish ? "published" : "draft", updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId)));
    res.json({ ok: true, status: publish ? "live" : "draft", url: publish ? await publicPageUrl(page.tenantId, page.slug).catch(() => "") : "" });
  } catch (err) {
    req.log.error({ err }, "partner hub publish failed");
    if (!res.headersSent) res.status(500).json({ error: "Could not change the hub's status" });
  }
});

/**
 * Retire a hub, or bring it back. Retiring takes it off the list, takes the
 * customer's page offline and stops its weekly digest; nothing is deleted.
 * Bringing it back leaves it a draft for the rep to publish again.
 */
router.post("/lp/partner-rooms/:pageId/archive", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = await hubPage(req, res);
    if (!page) return;
    const archive = req.body?.archived !== false;
    const at = archive ? new Date() : null;
    await db
      .insert(lpRoomSettingsTable)
      .values({ pageId: page.id, tenantId: page.tenantId, allowedDomains: [], archivedAt: at, ...(archive ? { digestEnabled: false } : {}) })
      .onConflictDoUpdate({ target: lpRoomSettingsTable.pageId, set: { archivedAt: at, ...(archive ? { digestEnabled: false } : {}), updatedAt: sql`now()` } });
    if (archive && page.status === "published") await db.update(lpPagesTable).set({ status: "draft", updatedAt: new Date(), updatedBy: req.authUser?.email ?? undefined }).where(and(eq(lpPagesTable.id, page.id), eq(lpPagesTable.tenantId, page.tenantId)));
    req.log.info({ pageId: page.id, archive, by: req.authUser?.email }, "partner hub archive changed");
    res.json({ ok: true, archived: archive });
  } catch (err) {
    req.log.error({ err }, "partner hub archive failed");
    res.status(500).json({ error: "Could not change the hub" });
  }
});

/** Accounts to make a hub for, by name. Each says whether it already has one. */
router.get("/lp/partner-hub-accounts", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    // One account by id (the account page asking whether it has a hub), else a search by name.
    const onlyId = Number(req.query.id);
    const byId = Number.isInteger(onlyId) && onlyId > 0 ? onlyId : 0;
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const accounts = await db
      .select({ id: salesAccountsTable.id, name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, owner: salesAccountsTable.owner, salesforceId: salesAccountsTable.salesforceId, numLocations: salesAccountsTable.numLocations })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), byId ? eq(salesAccountsTable.id, byId) : undefined, q && !byId ? or(ilike(salesAccountsTable.name, like), ilike(salesAccountsTable.displayName, like)) : undefined))
      .orderBy(desc(salesAccountsTable.updatedAt))
      .limit(25);
    const pages = accounts.length ? (await hubPages(tenantId)).filter((p) => !/\(test\)\s*$/.test(p.title)) : [];
    const settings = pages.length ? await db.select({ pageId: lpRoomSettingsTable.pageId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId }).from(lpRoomSettingsTable).where(inArray(lpRoomSettingsTable.pageId, pages.map((p) => p.id))) : [];
    const hubOf = new Map<number, number>();
    for (const p of pages) {
      const a = accountOf({ accountId: p.accountId, sfdcAccountId: p.sfdcAccountId, name: roomPartnerName(p.blocks) || p.title }, settings.find((s) => s.pageId === p.id)?.sfdcAccountId ?? null, accounts);
      if (a && !hubOf.has(a.id)) hubOf.set(a.id, p.id);
    }
    res.json({ accounts: accounts.map((a) => ({ id: a.id, name: a.displayName || a.name, owner: a.owner, locations: a.numLocations, salesforceId: a.salesforceId, hubPageId: hubOf.get(a.id) ?? null })) });
  } catch (err) {
    req.log.error({ err }, "partner hub accounts failed");
    res.status(500).json({ error: "Could not search accounts" });
  }
});

export default router;
