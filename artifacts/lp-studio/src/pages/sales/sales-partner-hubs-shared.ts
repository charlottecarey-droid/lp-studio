/** One row of the Sales Console's Partner Hubs table, as the server sends it. */
export interface HubRow {
  pageId: number;
  title: string;
  name: string;
  slug: string;
  status: "live" | "draft";
  /** In setup, ready to share, or shared (from the hub's setup checklist). */
  setup?: { state: "setup" | "ready" | "shared"; left: number; total: number };
  /** The customer's link. Blank until the hub is published. */
  url: string;
  account: { id: number; name: string; owner: string | null } | null;
  /** Day of the rollout, or null before kickoff / without a kickoff date. */
  day: number | null;
  /** INTERNAL stage: rollout, or expansion once a team member moved the hub past it. */
  stage?: "rollout" | "expansion";
  /** The rollout has run its length: someone should move the hub on (or extend). */
  stagePrompt?: boolean;
  /** Practices in the hub and how many are live. Null when the hub has none loaded. */
  practices?: { total: number; live: number } | null;
  waitingOnCustomer: number;
  /** Everything that needs the account team: the sum of `needs`. */
  waitingOnUs: number;
  /** What that is made of. Mirrors the server's HubNeeds. */
  needs?: HubNeeds;
  /** Retired by a rep: off the list, its page offline. */
  archived?: boolean;
  views30: number;
  people30: number;
  lastVisitAt: string | null;
  mine: boolean;
  test: boolean;
  updatedAt: string;
}

export interface HubNeeds {
  access: number;
  marketing: number;
  requests: number;
  minutes: number;
}

const some = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : "");
/** "2 asking for access · 3 programs to send to marketing · 1 new request". */
export function needsLine(n: HubNeeds | undefined): string {
  if (!n) return "";
  return [some(n.access, "person asking for access", "people asking for access"), some(n.marketing, "program to send to marketing", "programs to send to marketing"), some(n.requests, "new request", "new requests"), some(n.minutes, "set of minutes to review", "sets of minutes to review")].filter(Boolean).join(" · ");
}

/** Where a hub opens: on what needs the rep when something does, otherwise on how it is being used. */
export function hubLandingTab(h: Pick<HubRow, "needs">): "activity" | "calendar" | "performance" {
  const n = h.needs;
  if (n && n.access + n.marketing + n.requests > 0) return "activity";
  if (n && n.minutes > 0) return "calendar";
  return "performance";
}

const DAY_MS = 86_400_000;
/**
 * Signs a hub is going quiet, worked out from what the list already knows: a
 * live hub nobody has visited in two weeks (or ever), and a live hub with no
 * practices loaded. Test hubs and drafts are never flagged.
 */
export function hubFlags(h: Pick<HubRow, "status" | "lastVisitAt" | "practices" | "test" | "archived">, now: Date = new Date()): string[] {
  if (h.status !== "live" || h.test || h.archived) return [];
  const flags: string[] = [];
  const last = h.lastVisitAt ? new Date(h.lastVisitAt).getTime() : null;
  if (last === null) flags.push("Never visited");
  else if (now.getTime() - last > 14 * DAY_MS) flags.push(`No visit in ${Math.floor((now.getTime() - last) / DAY_MS)} days`);
  if (!h.practices || h.practices.total === 0) flags.push("No practices loaded");
  return flags;
}

/** The rep's own hubs first, then whichever was touched last. Test hubs sink to the bottom. */
export function sortHubs(hubs: HubRow[]): HubRow[] {
  const rank = (h: HubRow) => (h.test ? 2 : h.mine ? 0 : 1);
  return [...hubs].sort((a, b) => rank(a) - rank(b) || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export function filterHubs(hubs: HubRow[], opts: { scope: "mine" | "all"; q: string }): HubRow[] {
  const q = opts.q.trim().toLowerCase();
  return hubs.filter((h) => (opts.scope === "all" || h.mine) && (!q || [h.name, h.title, h.account?.name, h.account?.owner].some((v) => (v ?? "").toLowerCase().includes(q))));
}

/** The Stage cell: "Day 48" during the rollout, "28 of 60 live" after it. */
export function hubStageText(h: Pick<HubRow, "day" | "stage" | "practices">): string {
  if (h.stage === "expansion") return h.practices && h.practices.total > 0 ? `${h.practices.live} of ${h.practices.total} live` : "Expansion";
  return h.day === null ? "Not started" : `Day ${h.day}`;
}

export type HubSortKey = "name" | "stage" | "waitingOnCustomer" | "waitingOnUs" | "views30" | "lastVisitAt";

/** The list in the order a clicked column asks for. No column picked: the order it came in (yours first, newest first). */
export function sortHubRows(rows: HubRow[], sort: { key: HubSortKey; desc: boolean } | null): HubRow[] {
  if (!sort) return rows;
  const value = (h: HubRow): number | string => {
    switch (sort.key) {
      case "name":
        return h.name.toLowerCase();
      case "stage":
        // Rollout day; a hub past its rollout sorts after every day count, one not started before.
        return h.stage === "expansion" ? 100000 : (h.day ?? -1);
      case "lastVisitAt":
        return h.lastVisitAt ? new Date(h.lastVisitAt).getTime() : 0;
      case "waitingOnCustomer":
        return h.status === "live" ? h.waitingOnCustomer : -1;
      default:
        return h[sort.key] ?? 0;
    }
  };
  const dir = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}
