/**
 * Claude connector — the tools a rep's Claude can call.
 *
 * Every tool goes through `dispatch()` to an existing LP Studio route as the
 * rep, so it sees exactly what the rep sees in the app. Tools only reshape
 * and trim what the route returns so it reads well to a model.
 *
 * Two scopes:
 *   - lpstudio:read   — everything that only reads.
 *   - lpstudio:drafts — makes drafts the rep reviews in LP Studio (microsite,
 *                       Partner Hub) or text Claude hands back (email draft).
 *                       Nothing is published or sent by any tool.
 */
import { z } from "zod";
import type { AuthUser } from "../../middleware/requireAuth";
import { dispatch, dispatchError, type DispatchResult } from "./dispatch";
import { SCOPE_DRAFTS, SCOPE_READ, scopeHas } from "./oauthStore";

export interface ToolContext {
  user: AuthUser;
  scope: string;
  /** Public origin the rep reached LP Studio on, for links back into the app. */
  origin: string;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  scope: typeof SCOPE_READ | typeof SCOPE_DRAFTS;
  readOnly: boolean;
  input: z.ZodRawShape;
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

/* ── helpers ────────────────────────────────────────────────────────────── */

class ToolError extends Error {}

async function call(ctx: ToolContext, method: "GET" | "POST", path: string, body?: unknown, timeoutMs?: number): Promise<unknown> {
  const r: DispatchResult = await dispatch(ctx.user, { method, path, body, timeoutMs });
  if (r.status < 200 || r.status >= 300) throw new ToolError(dispatchError(r));
  return r.json;
}

const qs = (params: Record<string, string | number | undefined | null>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

const norm = (s: unknown): string => (typeof s === "string" ? s.trim().toLowerCase() : "");
const DAY_MS = 86_400_000;

/** Keys never worth sending to a model: page bodies, secrets-ish tracking tokens, raw HTML. */
const DROP_KEYS = new Set(["blocks", "html", "token", "brand", "brandJson", "settings", "theme", "styles", "rawBlocks", "embedding"]);

/** Bound the size of anything we return: long strings cut, long arrays capped, heavy keys dropped. */
export function compact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  if (typeof value !== "object") return value;
  if (depth > 5) return "…";
  if (Array.isArray(value)) {
    const head = value.slice(0, 40).map((v) => compact(v, depth + 1));
    return value.length > 40 ? [...head, `…${value.length - 40} more`] : head;
  }
  if (value instanceof Date) return value.toISOString();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (DROP_KEYS.has(k) || v === null || v === undefined || v === "") continue;
    out[k] = compact(v, depth + 1);
  }
  return out;
}

const pick = (o: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") out[k] = o[k];
  return out;
};

const links = (ctx: ToolContext) => ({
  account: (id: unknown) => `${ctx.origin}/sales/accounts/${id}`,
  page: (id: unknown) => `${ctx.origin}/builder/${id}`,
  hub: (id: unknown) => `${ctx.origin}/sales/partnerships/${id}`,
});

type Row = Record<string, unknown>;

/** Is this account the rep's? Same rule as Partner Hubs: owner name, or on the account team by email. */
function accountIsMine(user: AuthUser, a: Row): boolean {
  const name = norm(user.name);
  const email = norm(user.email);
  if (name && norm(a.owner) === name) return true;
  const team = (a.accountTeam ?? {}) as { members?: { email?: string | null }[] };
  return !!email && (team.members ?? []).some((m) => norm(m.email) === email);
}

async function myAccounts(ctx: ToolContext): Promise<Row[]> {
  const all = (await call(ctx, "GET", "/sales/accounts")) as Row[];
  return (Array.isArray(all) ? all : []).filter((a) => accountIsMine(ctx.user, a));
}

const accountSummary = (ctx: ToolContext, a: Row) => ({
  ...pick(a, ["id", "displayName", "name", "domain", "segment", "industry", "abmTier", "abmStage", "status", "owner", "numLocations", "contactCount", "state", "updatedAt"]),
  link: links(ctx).account(a.id),
});

const signalSummary = (s: Row) => {
  const meta = (s.metadata ?? {}) as Row;
  return {
    ...pick(s, ["type", "source", "createdAt", "accountId", "accountName", "contactId", "contactName"]),
    ...pick(meta, ["pageTitle", "page_title", "url", "dwellSeconds", "dwell_seconds", "subject", "formName", "title"]),
  };
};

async function signalsSince(ctx: ToolContext, sinceDays: number, filter: { accountId?: number; contactId?: number; type?: string }): Promise<Row[]> {
  const since = Date.now() - sinceDays * DAY_MS;
  // The route pages 500 newest-first; keep paging until we're past the window
  // (a busy workspace's 500 newest can be under two weeks), capped at 10 pages.
  const out: Row[] = [];
  for (let page = 0; page < 10; page++) {
    const res = (await call(ctx, "GET", `/sales/signals${qs({ limit: 500, offset: page * 500, accountId: filter.accountId, contactId: filter.contactId, type: filter.type })}`)) as { data?: Row[] };
    const rows = res.data ?? [];
    out.push(...rows.filter((s) => new Date(String(s.createdAt)).getTime() >= since));
    const oldest = rows.length ? new Date(String(rows[rows.length - 1].createdAt)).getTime() : 0;
    if (rows.length < 500 || oldest < since) break;
  }
  return out;
}

const countBy = (rows: Row[], key: string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key] ?? "other");
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

/* ── tool definitions ───────────────────────────────────────────────────── */

const days = (def: number, max = 365) => z.number().int().min(1).max(max).optional().describe(`Look-back window in days (default ${def}).`);

export const TOOLS: ToolDef[] = [
  {
    name: "whoami",
    title: "Who am I in LP Studio",
    description: "The LP Studio user and workspace this connection acts as, and what it is allowed to do. Call first if unsure whose data you are reading.",
    scope: SCOPE_READ,
    readOnly: true,
    input: {},
    run: async (ctx) => ({
      name: ctx.user.name,
      email: ctx.user.email,
      workspaceId: ctx.user.tenantId,
      role: ctx.user.role,
      canCreateDrafts: scopeHas(ctx.scope, SCOPE_DRAFTS),
      today: new Date().toISOString().slice(0, 10),
      app: ctx.origin,
    }),
  },
  {
    name: "weekly_summary",
    title: "My week in LP Studio",
    description:
      "One-call digest for a rep's weekly update: engagement signals on MY accounts (page views, email opens/clicks, form fills) grouped by account, MY pages that had visits, MY Partner Hubs with recent activity and what they're waiting on, and email campaigns sent in the window. 'Mine' = accounts where I'm the owner or on the account team, pages I created/edited or tied to my accounts, hubs I own/made/am on the team of.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { days: days(7, 31) },
    run: async (ctx, args) => {
      const window = Number(args.days ?? 7);
      const since = Date.now() - window * DAY_MS;
      const recent = (v: unknown) => !!v && new Date(String(v)).getTime() >= since;
      const [accounts, signals, pagesRes, hubsRes, campaignsRes] = await Promise.all([
        myAccounts(ctx),
        signalsSince(ctx, window, {}),
        call(ctx, "GET", "/sales/pages/overview").catch(() => ({ pages: [] })) as Promise<{ pages?: Row[] }>,
        call(ctx, "GET", "/lp/partner-rooms").catch(() => ({ hubs: [] })) as Promise<{ hubs?: Row[] }>,
        call(ctx, "GET", "/sales/campaigns/performance").catch(() => []) as Promise<unknown>,
      ]);
      const mineIds = new Set(accounts.map((a) => Number(a.id)));
      const mySignals = signals.filter((s) => s.accountId != null && mineIds.has(Number(s.accountId)));
      const byAccount = new Map<number, Row[]>();
      for (const s of mySignals) {
        const id = Number(s.accountId);
        byAccount.set(id, [...(byAccount.get(id) ?? []), s]);
      }
      const accountActivity = [...byAccount.entries()]
        .map(([id, rows]) => ({
          accountId: id,
          account: rows[0].accountName,
          signals: rows.length,
          byType: countBy(rows, "type"),
          people: [...new Set(rows.map((r) => r.contactName).filter(Boolean))].slice(0, 8),
          latest: rows.slice(0, 5).map(signalSummary),
          link: links(ctx).account(id),
        }))
        .sort((a, b) => b.signals - a.signals);
      const email = norm(ctx.user.email);
      const myPages = (pagesRes.pages ?? []).filter(
        (p) => norm(p.createdBy) === email || norm(p.updatedBy) === email || (p.accountId != null && mineIds.has(Number(p.accountId))),
      );
      const pagesWithVisits = myPages
        .filter((p) => recent(p.lastVisitAt))
        .map((p) => ({
          ...pick(p, ["pageId", "pageTitle", "pageStatus", "accountName", "lastVisitAt", "knownViewerCount"]),
          views30d: p.views,
          uniques30d: p.uniques,
          avgDwellSeconds30d: p.avgDwellSeconds,
          knownViewers: ((p.knownViewers as Row[] | undefined) ?? []).map((v) => compact(v)),
          link: links(ctx).page(p.pageId),
        }));
      const myHubs = (hubsRes.hubs ?? []).filter((h) => h.mine && !h.test);
      const hubs = myHubs
        .filter((h) => recent(h.lastVisitAt) || Number(h.waitingOnUs ?? 0) > 0 || h.stagePrompt)
        .map((h) => ({
          ...pick(h, ["pageId", "name", "status", "stage", "stagePrompt", "lastVisitAt", "views30", "people30", "waitingOnUs", "waitingOnCustomer", "needs", "practices", "day"]),
          link: links(ctx).hub(h.pageId),
        }));
      const campaigns = (Array.isArray(campaignsRes) ? (campaignsRes as Row[]) : ((campaignsRes as { campaigns?: Row[] })?.campaigns ?? []))
        .filter((c) => recent(c.sentAt ?? c.sent_at))
        .map((c) => compact(c));
      return {
        windowDays: window,
        rep: { name: ctx.user.name, email: ctx.user.email },
        myAccountCount: accounts.length,
        accountActivity,
        pagesWithVisits,
        partnerHubs: hubs,
        campaignsSent: campaigns,
        notes: [
          "Page view/uniques/dwell figures on pages are 30-day totals; lastVisitAt is within the window.",
          "Partner Hub views30/people30 are 30-day totals.",
          accounts.length === 0 ? `No accounts matched this rep as owner or account-team member (owner name '${ctx.user.name}').` : null,
        ].filter(Boolean),
      };
    },
  },
  {
    name: "list_my_accounts",
    title: "List my accounts",
    description: "Accounts where I'm the owner (Salesforce owner name) or listed on the account team. Most recently updated first.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { limit: z.number().int().min(1).max(200).optional().describe("Max accounts (default 50).") },
    run: async (ctx, args) => {
      const mine = await myAccounts(ctx);
      const limit = Number(args.limit ?? 50);
      return { total: mine.length, accounts: mine.slice(0, limit).map((a) => accountSummary(ctx, a)) };
    },
  },
  {
    name: "search_accounts",
    title: "Search accounts",
    description: "Find accounts in this workspace by name or domain (all accounts, not just mine). Returns ids to use with other tools.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { query: z.string().min(1).max(200).describe("Name or domain to search for."), limit: z.number().int().min(1).max(50).optional() },
    run: async (ctx, args) => {
      const res = (await call(ctx, "GET", `/sales/accounts/search${qs({ q: String(args.query), limit: Number(args.limit ?? 10) })}`)) as { results?: Row[] };
      return {
        accounts: (res.results ?? [])
          .filter((a) => a.source !== "crm" || a.id)
          .map((a) => ({ ...pick(a, ["id", "name", "domain", "segment", "source", "contactCount", "opportunityCount", "isLikelyDuplicateOf"]), ...(a.id ? { link: links(ctx).account(a.id) } : {}) })),
      };
    },
  },
  {
    name: "get_account",
    title: "Get account details",
    description: "One account: details, account team, contacts (up to 25) and the microsites made for it.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { accountId: z.number().int().positive() },
    run: async (ctx, args) => {
      const id = Number(args.accountId);
      const [account, contacts, microsites] = await Promise.all([
        call(ctx, "GET", `/sales/accounts/${id}`) as Promise<Row>,
        call(ctx, "GET", `/sales/accounts/${id}/contacts`).catch(() => []) as Promise<unknown>,
        call(ctx, "GET", `/sales/accounts/${id}/microsites`).catch(() => []) as Promise<unknown>,
      ]);
      const contactRows = (Array.isArray(contacts) ? contacts : ((contacts as { data?: Row[] })?.data ?? [])) as Row[];
      return {
        account: { ...(compact(account) as Row), link: links(ctx).account(id) },
        contacts: contactRows.slice(0, 25).map((c) => pick(c, ["id", "firstName", "lastName", "title", "titleLevel", "email", "status", "tier", "lastEngagedAt"])),
        microsites: compact(microsites),
      };
    },
  },
  {
    name: "search_contacts",
    title: "Search contacts",
    description: "Find contacts by name/email/title, optionally within one account.",
    scope: SCOPE_READ,
    readOnly: true,
    input: {
      query: z.string().max(200).optional(),
      accountId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    run: async (ctx, args) => {
      const res = (await call(ctx, "GET", `/sales/contacts${qs({ search: args.query as string, accountId: args.accountId as number, limit: Number(args.limit ?? 20) })}`)) as unknown;
      const rows = (Array.isArray(res) ? res : ((res as { data?: Row[]; contacts?: Row[] })?.data ?? (res as { contacts?: Row[] })?.contacts ?? [])) as Row[];
      return { contacts: rows.map((c) => pick(c, ["id", "firstName", "lastName", "title", "titleLevel", "email", "accountId", "accountName", "status", "tier"])) };
    },
  },
  {
    name: "list_signals",
    title: "List engagement signals",
    description:
      "Engagement events (page views with dwell, email opens/clicks, form fills, website visits) newest first. Filter by account, contact or type; set mineOnly to keep only my accounts.",
    scope: SCOPE_READ,
    readOnly: true,
    input: {
      days: days(7, 90),
      accountId: z.number().int().positive().optional(),
      contactId: z.number().int().positive().optional(),
      type: z.string().max(60).optional().describe("Signal type, e.g. page_view, email_open, email_click, form_submit."),
      mineOnly: z.boolean().optional().describe("Only signals on my accounts (default false)."),
      limit: z.number().int().min(1).max(200).optional(),
    },
    run: async (ctx, args) => {
      const window = Number(args.days ?? 7);
      let rows = await signalsSince(ctx, window, { accountId: args.accountId as number, contactId: args.contactId as number, type: args.type as string });
      if (args.mineOnly) {
        const ids = new Set((await myAccounts(ctx)).map((a) => Number(a.id)));
        rows = rows.filter((s) => s.accountId != null && ids.has(Number(s.accountId)));
      }
      const limit = Number(args.limit ?? 100);
      return { windowDays: window, total: rows.length, byType: countBy(rows, "type"), signals: rows.slice(0, limit).map(signalSummary) };
    },
  },
  {
    name: "list_pages",
    title: "List pages and microsites",
    description: "Pages/microsites with 30-day views, unique visitors, average dwell, last visit and known viewers. mineOnly (default true) keeps pages I created/edited or tied to my accounts.",
    scope: SCOPE_READ,
    readOnly: true,
    input: {
      mineOnly: z.boolean().optional(),
      accountId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    run: async (ctx, args) => {
      const res = (await call(ctx, "GET", "/sales/pages/overview")) as { pages?: Row[] };
      let pages = res.pages ?? [];
      if (args.accountId) pages = pages.filter((p) => Number(p.accountId) === Number(args.accountId));
      if (args.mineOnly !== false) {
        const ids = new Set((await myAccounts(ctx)).map((a) => Number(a.id)));
        const email = norm(ctx.user.email);
        pages = pages.filter((p) => norm(p.createdBy) === email || norm(p.updatedBy) === email || (p.accountId != null && ids.has(Number(p.accountId))));
      }
      const limit = Number(args.limit ?? 30);
      return {
        windowDays: 30,
        total: pages.length,
        pages: pages.slice(0, limit).map((p) => ({
          ...pick(p, ["pageId", "pageTitle", "pageStatus", "accountId", "accountName", "views", "uniques", "avgDwellSeconds", "lastVisitAt", "knownViewerCount", "pageUpdatedAt"]),
          knownViewers: ((p.knownViewers as Row[] | undefined) ?? []).map((v) => compact(v)),
          personalLinks: ((p.hotlinks as Row[] | undefined) ?? []).map((h) => h.contactName).filter(Boolean),
          link: links(ctx).page(p.pageId),
        })),
      };
    },
  },
  {
    name: "get_page_engagement",
    title: "Get page engagement",
    description: "Detailed engagement for one page: views, uniques, dwell vs the prior period, who viewed it, and personal-link activity.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { pageId: z.number().int().positive(), days: days(30) },
    run: async (ctx, args) => {
      const res = await call(ctx, "GET", `/sales/pages/${Number(args.pageId)}/engagement${qs({ days: Number(args.days ?? 30) })}`);
      return { ...(compact(res) as Row), link: links(ctx).page(args.pageId) };
    },
  },
  {
    name: "list_partner_hubs",
    title: "List Partner Hubs",
    description: "Partner Hubs (customer workspaces) with stage, setup state, 30-day views/people, last visit, and what each is waiting on from us or the customer. mineOnly default true.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { mineOnly: z.boolean().optional(), includeArchived: z.boolean().optional() },
    run: async (ctx, args) => {
      const res = (await call(ctx, "GET", `/lp/partner-rooms${args.includeArchived ? "?archived=1" : ""}`)) as { hubs?: Row[] };
      let hubs = (res.hubs ?? []).filter((h) => !h.test);
      if (args.mineOnly !== false) hubs = hubs.filter((h) => h.mine);
      return {
        total: hubs.length,
        hubs: hubs.map((h) => ({
          ...pick(h, ["pageId", "name", "status", "setup", "stage", "stagePrompt", "account", "day", "views30", "people30", "lastVisitAt", "waitingOnUs", "waitingOnCustomer", "needs", "practices", "url"]),
          link: links(ctx).hub(h.pageId),
        })),
      };
    },
  },
  {
    name: "get_partner_hub_activity",
    title: "Get Partner Hub activity",
    description: "Who visited one Partner Hub, when, for how long, and which sections they opened (the hub's own team is excluded).",
    scope: SCOPE_READ,
    readOnly: true,
    input: { pageId: z.number().int().positive() },
    run: async (ctx, args) => {
      const res = await call(ctx, "GET", `/lp/partner-rooms/${Number(args.pageId)}/performance`);
      return { ...(compact(res) as Row), link: links(ctx).hub(args.pageId) };
    },
  },
  {
    name: "list_campaigns",
    title: "List email campaigns",
    description: "Email campaigns with sent, opens, clicks, unsubscribes and bounces.",
    scope: SCOPE_READ,
    readOnly: true,
    input: { limit: z.number().int().min(1).max(50).optional() },
    run: async (ctx, args) => {
      const res = await call(ctx, "GET", "/sales/campaigns/performance");
      const rows = (Array.isArray(res) ? res : ((res as { campaigns?: Row[] })?.campaigns ?? [])) as Row[];
      return { campaigns: rows.slice(0, Number(args.limit ?? 10)).map((c) => compact(c)) };
    },
  },

  /* ── drafts ─────────────────────────────────────────────────────────── */

  {
    name: "generate_microsite",
    title: "Generate a microsite draft",
    description:
      "Start generating a DRAFT microsite for an account with LP Studio's own generator (templates, brand and quality rules). Takes 1-3 minutes; returns a jobId — call get_generation_status until it finishes. Nothing is published: the rep reviews and publishes in LP Studio.",
    scope: SCOPE_DRAFTS,
    readOnly: false,
    input: {
      accountId: z.number().int().positive(),
      prompt: z.string().max(4000).optional().describe("What the page should focus on, e.g. offer, pain points, call notes."),
      contactId: z.number().int().positive().optional().describe("Personalise for one contact at the account."),
      templateSlug: z.string().max(120).optional(),
      objective: z.string().max(200).optional(),
    },
    run: async (ctx, args) => {
      const body = pick(args as Row, ["prompt", "contactId", "templateSlug", "objective"]);
      const res = (await call(ctx, "POST", `/sales/accounts/${Number(args.accountId)}/generate-microsite/jobs`, body)) as { jobId?: string };
      return { jobId: res.jobId, status: "running", next: "Call get_generation_status with this jobId in about a minute." };
    },
  },
  {
    name: "get_generation_status",
    title: "Check a generation job",
    description: "Status of a microsite generation started with generate_microsite. When it has succeeded, returns the draft page and a link to review it.",
    scope: SCOPE_DRAFTS,
    readOnly: true,
    input: { jobId: z.string().min(1).max(100) },
    run: async (ctx, args) => {
      const job = (await call(ctx, "GET", `/lp/generation-jobs/${encodeURIComponent(String(args.jobId))}`)) as Row;
      const result = (job.result ?? {}) as Row;
      const page = (result.page ?? {}) as Row;
      return {
        status: job.status,
        stage: job.stage,
        error: job.error ?? undefined,
        ...(page.id ? { page: { id: page.id, title: page.title, status: page.status, reviewLink: links(ctx).page(page.id) } } : {}),
        ...(job.status === "succeeded" ? { note: "The page is a draft. Review and publish it in LP Studio." } : {}),
      };
    },
  },
  {
    name: "create_partner_hub",
    title: "Create a Partner Hub",
    description:
      "Create a DRAFT Partner Hub for an account (same as New hub in the Sales Console: team, practices, standard files). If the account already has a hub, returns that one instead. The rep reviews, sets up and publishes it in LP Studio.",
    scope: SCOPE_DRAFTS,
    readOnly: false,
    input: { accountId: z.number().int().positive() },
    run: async (ctx, args) => {
      const res = (await call(ctx, "POST", "/lp/partner-rooms", { accountId: Number(args.accountId) })) as Row;
      return {
        pageId: res.pageId,
        alreadyExisted: !!res.existed,
        link: links(ctx).hub(res.pageId),
        ...(res.checklist ? { setupChecklist: compact(res.checklist) } : {}),
        note: res.existed ? "This account already had a hub." : "Created as a draft. Finish setup and publish it in LP Studio.",
      };
    },
  },
  {
    name: "draft_email",
    title: "Draft a sales email",
    description:
      "Draft a personalised outreach email for a contact (or an account) using LP Studio's research and the account's microsite if one exists. Returns subject and body text only. Nothing is sent or saved.",
    scope: SCOPE_DRAFTS,
    readOnly: true,
    input: { contactId: z.number().int().positive().optional(), accountId: z.number().int().positive().optional() },
    run: async (ctx, args) => {
      if (!args.contactId && !args.accountId) throw new ToolError("Give a contactId or an accountId.");
      const res = (await call(ctx, "POST", "/sales/draft-email", pick(args as Row, ["contactId", "accountId"]), 120_000)) as Row;
      return {
        ...pick(res, ["subject", "body", "contactEmail", "micrositeUrl", "factWarnings", "sources"]),
        note: "Draft only. Nothing was sent.",
      };
    },
  },
];

/** Run one tool for the MCP server: scope check, error → isError result. */
export async function runTool(tool: ToolDef, ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  if (!scopeHas(ctx.scope, tool.scope)) {
    return {
      isError: true,
      content: [{ type: "text", text: "This connection is read-only. To let Claude create drafts, disconnect LP Studio in Claude and reconnect it with drafts allowed." }],
    };
  }
  try {
    const data = await tool.run(ctx, args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  } catch (err) {
    const msg = err instanceof ToolError ? err.message : "LP Studio hit an error running that. Try again, or check the app.";
    if (!(err instanceof ToolError)) console.error(`[mcp] tool ${tool.name} failed:`, err);
    return { isError: true, content: [{ type: "text", text: msg }] };
  }
}
