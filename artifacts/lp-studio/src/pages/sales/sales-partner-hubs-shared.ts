/** One row of the Sales Console's Partner Hubs table, as the server sends it. */
export interface HubRow {
  pageId: number;
  title: string;
  name: string;
  slug: string;
  status: "live" | "draft";
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
  waitingOnUs: number;
  views30: number;
  people30: number;
  lastVisitAt: string | null;
  mine: boolean;
  test: boolean;
  updatedAt: string;
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
