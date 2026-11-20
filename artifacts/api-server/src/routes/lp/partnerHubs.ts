/**
 * Partner Hubs for the Sales Console: the list of a workspace's hubs, making
 * one for an account, and how a hub is performing.
 *
 * All auth-gated (the /lp/partner-rooms prefix). The hub's own working state
 * and the visitor routes live in ./rooms.ts.
 */
import { Router, type Request, type Response } from "express";
import { db, lpPagesTable, lpPageVisitsTable, lpRoomAutocreateAccountsTable, lpRoomMembersTable, lpRoomRequestsTable, lpRoomSettingsTable, lpRoomTaskStateTable, lpRoomViewsTable, salesAccountsTable } from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { extractRoomTasks, pageIsRoom, resolveRoomBlocks, roomPartnerName, roomWorkspaceProps } from "../../lib/partnerRoom";
import { teamPeopleFromBlocks } from "../../lib/partnerRoomFeed";
import { digestRolloutDay } from "../../lib/partnerRoomDigest";
import { roomStageFromProps } from "../../lib/partnerRoomStage";
import { accountKey, cleanAccountName } from "../../lib/partnerRoomNames";
import { createRoom, publicPageUrl } from "../../lib/partnerRoomAutocreate";
import { hubIsMine, hubSetupItems, sameSfdcId, summarizeRoomViews } from "../../lib/partnerRoomViews";

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
    const pages = (await hubPages(tenantId)).filter((p) => pageIsRoom(p.blocks));
    if (pages.length === 0) {
      res.json({ hubs: [] });
      return;
    }
    const ids = pages.map((p) => p.id);
    const since = new Date(Date.now() - 30 * DAY);
    const [accounts, settings, doneTasks, openRequests, visits, lastVisits, people] = await Promise.all([
      db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name, displayName: salesAccountsTable.displayName, owner: salesAccountsTable.owner, salesforceId: salesAccountsTable.salesforceId }).from(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId)).limit(5000),
      db.select({ pageId: lpRoomSettingsTable.pageId, sfdcAccountId: lpRoomSettingsTable.sfdcAccountId }).from(lpRoomSettingsTable).where(inArray(lpRoomSettingsTable.pageId, ids)),
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
        return {
          pageId: p.id,
          title: p.title,
          name,
          slug: p.slug,
          status: p.status === "published" ? "live" : "draft",
          url: p.status === "published" ? await publicPageUrl(tenantId, p.slug).catch(() => "") : "",
          account: account ? { id: account.id, name: account.displayName || account.name, owner: account.owner } : null,
          day: digestRolloutDay(props.kickoffDate, now),
          // Internal: where the hub is in the partnership, whether to ask the team to move it on, and how many practices are live.
          stage: roomStageFromProps(props, now).stage,
          stagePrompt: roomStageFromProps(props, now).prompt,
          practices: practiceCounts.find((c) => c.pageId === p.id) ?? null,
          waitingOnCustomer: [...tasks.keys()].filter((k) => !done.has(k)).length,
          waitingOnUs: openRequests.find((r) => r.pageId === p.id)?.n ?? 0,
          views30: visits.find((v) => v.pageId === p.id)?.views ?? 0,
          people30: people.find((v) => v.pageId === p.id)?.n ?? 0,
          lastVisitAt: [lastPage, lastRoom].filter((v): v is string => !!v).sort().pop() ?? null,
          mine: hubIsMine({ email: req.authUser?.email, name: req.authUser?.name }, { accountOwner: account?.owner, createdBy: p.createdBy, updatedBy: p.updatedBy, teamEmails: teamPeopleFromBlocks(blocks).map((t) => t.email) }),
          test: /\(test\)\s*$/.test(p.title),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    );
    res.json({ hubs });
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
router.get("/lp/partner-rooms/:pageId/setup", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const pageId = Number(req.params.pageId);
    const [page] = Number.isInteger(pageId) && pageId > 0 ? await db.select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status, blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1) : [];
    if (!page || !pageIsRoom(page.blocks)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const blocks = resolveRoomBlocks(page.blocks);
    const [invited] = await db.select({ n: sql<number>`count(*)::int` }).from(lpRoomMembersTable).where(and(eq(lpRoomMembersTable.pageId, page.id), eq(lpRoomMembersTable.status, "allowed")));
    const published = page.status === "published";
    res.json({
      pageId: page.id,
      title: page.title,
      name: roomPartnerName(blocks) || page.title,
      status: published ? "live" : "draft",
      url: published ? await publicPageUrl(tenantId, page.slug).catch(() => "") : "",
      setup: hubSetupItems(roomWorkspaceProps(blocks), { published, invited: invited?.n ?? 0 }),
    });
  } catch (err) {
    req.log.error({ err }, "partner hub setup failed");
    res.status(500).json({ error: "Could not load the hub" });
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
    res.json({ accounts: accounts.map((a) => ({ id: a.id, name: a.displayName || a.name, owner: a.owner, locations: a.numLocations, hubPageId: hubOf.get(a.id) ?? null })) });
  } catch (err) {
    req.log.error({ err }, "partner hub accounts failed");
    res.status(500).json({ error: "Could not search accounts" });
  }
});

export default router;
