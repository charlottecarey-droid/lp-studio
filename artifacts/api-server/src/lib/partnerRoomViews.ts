/**
 * Partner Hub performance — pure helpers (no database).
 *
 * A hub is one page whose sections switch without a page load, so page-view
 * tracking alone cannot say who looked at what. The hub reports each section
 * opening itself (POST /lp/room/view); these helpers validate that report and
 * turn the stored rows into what a rep reads: visits, people, sections.
 */

/** The longest a single section opening can count for (a tab left open is not attention). */
export const VIEW_MAX_SECONDS = 30 * 60;
/** Two section openings further apart than this are separate visits. */
export const VISIT_GAP_MS = 30 * 60 * 1000;
/** A Slack note about the same person is not repeated within this window. */
export const VISIT_ALERT_QUIET_MS = 6 * 60 * 60 * 1000;

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MODULE_RE = /^[a-z][a-z0-9-]{1,31}$/;

export interface RoomViewInput {
  pageId: number;
  viewId: string;
  sessionId: string;
  module: string;
  seconds: number;
}

/** A section-view report from the browser, or null when it is not one. */
export function parseRoomView(body: unknown): RoomViewInput | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const pageId = typeof b.pageId === "number" && Number.isInteger(b.pageId) && b.pageId > 0 ? b.pageId : 0;
  const viewId = typeof b.viewId === "string" && ID_RE.test(b.viewId) ? b.viewId : "";
  const sessionId = typeof b.sessionId === "string" && ID_RE.test(b.sessionId) ? b.sessionId : "";
  const module = typeof b.module === "string" && MODULE_RE.test(b.module) ? b.module : "";
  if (!pageId || !viewId || !sessionId || !module) return null;
  const raw = typeof b.seconds === "number" && Number.isFinite(b.seconds) ? Math.floor(b.seconds) : 0;
  return { pageId, viewId, sessionId, module, seconds: Math.max(0, Math.min(VIEW_MAX_SECONDS, raw)) };
}

export interface RoomViewRow {
  sessionId: string;
  module: string;
  seconds: number;
  viewerEmail: string | null;
  viewerName: string | null;
  createdAt: Date;
}

export interface RoomVisit {
  /** Null = nobody we could name. */
  email: string | null;
  name: string | null;
  startedAt: string;
  seconds: number;
  /** Sections in the order they were first opened. */
  modules: string[];
}

export interface RoomPersonStat {
  email: string;
  name: string | null;
  visits: number;
  seconds: number;
  lastAt: string;
  /** Sections this person opened, most time first. */
  modules: { module: string; opens: number; seconds: number }[];
}

export interface RoomPerformance {
  visits: number;
  /** Named people plus sessions nobody could name. */
  visitors: number;
  named: number;
  anonymous: number;
  seconds: number;
  lastAt: string | null;
  /** One entry per day in the window, oldest first. */
  days: { date: string; visits: number; visitors: number }[];
  people: RoomPersonStat[];
  modules: { module: string; opens: number; people: number; seconds: number }[];
  recent: RoomVisit[];
}

const who = (r: RoomViewRow) => (r.viewerEmail ? `e:${r.viewerEmail}` : `s:${r.sessionId}`);
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Group section openings into visits: one person (or one unnamed session)
 * with no gap longer than VISIT_GAP_MS. Rows may arrive in any order.
 */
export function visitsFromViews(rows: RoomViewRow[]): (RoomVisit & { key: string; at: Date })[] {
  const byWho = new Map<string, RoomViewRow[]>();
  for (const r of rows) {
    const k = who(r);
    const list = byWho.get(k);
    if (list) list.push(r);
    else byWho.set(k, [r]);
  }
  const out: (RoomVisit & { key: string; at: Date })[] = [];
  for (const [key, list] of byWho) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let cur: (RoomVisit & { key: string; at: Date }) | null = null;
    let last = 0;
    for (const r of list) {
      const t = r.createdAt.getTime();
      if (!cur || t - last > VISIT_GAP_MS) {
        cur = { key, at: r.createdAt, email: r.viewerEmail, name: r.viewerName, startedAt: r.createdAt.toISOString(), seconds: 0, modules: [] };
        out.push(cur);
      }
      cur.seconds += r.seconds;
      if (!cur.modules.includes(r.module)) cur.modules.push(r.module);
      if (!cur.name && r.viewerName) cur.name = r.viewerName;
      last = t + r.seconds * 1000;
    }
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Everything the Performance tab shows, from the stored rows of one hub. `days` = how far back the daily series goes. */
export function summarizeRoomViews(rows: RoomViewRow[], opts: { days?: number; now?: Date } = {}): RoomPerformance {
  const now = opts.now ?? new Date();
  const span = Math.max(1, Math.min(90, opts.days ?? 30));
  const visits = visitsFromViews(rows);

  const series = new Map<string, { visits: number; who: Set<string> }>();
  for (let i = span - 1; i >= 0; i--) series.set(dayOf(new Date(now.getTime() - i * 86_400_000)), { visits: 0, who: new Set() });
  for (const v of visits) {
    const d = series.get(dayOf(v.at));
    if (d) {
      d.visits += 1;
      d.who.add(v.key);
    }
  }

  const people = new Map<string, RoomPersonStat & { mods: Map<string, { opens: number; seconds: number }> }>();
  const modules = new Map<string, { opens: number; seconds: number; who: Set<string> }>();
  for (const r of rows) {
    const m = modules.get(r.module) ?? { opens: 0, seconds: 0, who: new Set<string>() };
    m.opens += 1;
    m.seconds += r.seconds;
    m.who.add(who(r));
    modules.set(r.module, m);
    if (!r.viewerEmail) continue;
    const p = people.get(r.viewerEmail) ?? { email: r.viewerEmail, name: r.viewerName, visits: 0, seconds: 0, lastAt: r.createdAt.toISOString(), modules: [], mods: new Map() };
    p.seconds += r.seconds;
    if (!p.name && r.viewerName) p.name = r.viewerName;
    if (r.createdAt.toISOString() > p.lastAt) p.lastAt = r.createdAt.toISOString();
    const pm = p.mods.get(r.module) ?? { opens: 0, seconds: 0 };
    pm.opens += 1;
    pm.seconds += r.seconds;
    p.mods.set(r.module, pm);
    people.set(r.viewerEmail, p);
  }
  for (const v of visits) if (v.email) people.get(v.email)!.visits += 1;

  const anonymous = new Set(rows.filter((r) => !r.viewerEmail).map((r) => r.sessionId)).size;
  return {
    visits: visits.length,
    visitors: people.size + anonymous,
    named: people.size,
    anonymous,
    seconds: rows.reduce((n, r) => n + r.seconds, 0),
    lastAt: visits[0]?.startedAt ?? null,
    days: [...series].map(([date, d]) => ({ date, visits: d.visits, visitors: d.who.size })),
    people: [...people.values()]
      .map(({ mods, ...p }) => ({ ...p, modules: [...mods].map(([module, s]) => ({ module, ...s })).sort((a, b) => b.seconds - a.seconds || b.opens - a.opens) }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)),
    modules: [...modules].map(([module, m]) => ({ module, opens: m.opens, people: m.who.size, seconds: m.seconds })).sort((a, b) => b.opens - a.opens),
    recent: visits.slice(0, 50).map(({ key: _k, at: _a, ...v }) => v),
  };
}

/* ── The hub list ─────────────────────────────────────────────────────────── */

const idKey = (v: string | null | undefined) => (v ?? "").trim().slice(0, 15);

/** Two Salesforce ids for the same record (15 or 18 characters). */
export const sameSfdcId = (a: string | null | undefined, b: string | null | undefined): boolean => idKey(a).length === 15 && idKey(a) === idKey(b);

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Is this hub the signed-in rep's? Yes when they own the account, made the
 * hub, or are listed with their address on the hub's team.
 */
export function hubIsMine(user: { email?: string | null; name?: string | null }, hub: { accountOwner?: string | null; createdBy?: string | null; updatedBy?: string | null; teamEmails?: string[] }): boolean {
  const email = norm(user.email);
  const name = norm(user.name);
  if (name && norm(hub.accountOwner) === name) return true;
  if (!email) return false;
  if (norm(hub.createdBy) === email || norm(hub.updatedBy) === email) return true;
  return (hub.teamEmails ?? []).some((e) => norm(e) === email);
}

/* ── Setup checklist ──────────────────────────────────────────────────────── */

export interface HubSetupItem {
  key: "logo" | "team" | "kit" | "publish" | "invite";
  title: string;
  done: boolean;
  /** Where the rep does it: the builder, or a tab of the hub's settings pop-up. */
  where: "builder" | "kit" | "settings";
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/**
 * What still has to happen before a customer can use the hub, read from the
 * hub as it is now (not from when it was made), so the list is right whoever
 * did the work and wherever.
 */
export function hubSetupItems(props: Record<string, unknown> | null, facts: { published: boolean; invited: number }): HubSetupItem[] {
  const p = props ?? {};
  // The customer's people sit in every team group after the first (ours). Placeholders like "[Name]" do not count.
  const customers = list(p.team)
    .slice(1)
    .flatMap((g) => list(g.members))
    .filter((m) => m.hidden !== true && str(m.name) && !/^\[.*\]$/.test(str(m.name)));
  const files = list(p.assets).filter((a) => a.hidden !== true && (str(a.fileUrl) || str(a.videoUrl)));
  return [
    { key: "logo", title: "Add the customer's logo", done: !!str(p.partnerLogoUrl), where: "builder" },
    { key: "team", title: customers.length ? `Check the customer's team (${customers.length} listed)` : "Add the customer's team", done: customers.length > 0, where: "builder" },
    { key: "kit", title: str(p.stage) === "expansion" ? "Create the marketing assets" : "Create the launch kit", done: files.length >= 2, where: "kit" },
    { key: "publish", title: "Publish the hub", done: facts.published, where: "builder" },
    { key: "invite", title: facts.invited ? `Invite the customer (${facts.invited} invited)` : "Invite the customer", done: facts.invited > 0, where: "settings" },
  ];
}
