/**
 * The customer's action plan once a Partner Hub moves past its rollout.
 *
 * The rollout plan is a 90-day launch checklist ("Days 0–5 · Get set up").
 * After it, the plan is about the practices not live yet and the product
 * lines the customer could add. Moving a hub on:
 *
 * - keeps every finished rollout step where it is (its phase then folds
 *   away as "Rollout, completed" on the hub);
 * - carries the open steps a rep keeps into "Still to finish", without their
 *   old due dates (so nothing reads as months overdue);
 * - retires the rest: hidden from the customer, marked `retired` so the
 *   team can still see what was never done;
 * - adds a group per wave still to come (or "Your remaining practices"),
 *   "Product lines" and "Ongoing".
 *
 * The rollout plan as it was is kept on the block (`rolloutPlanGroups`), so
 * moving back to Rollout restores it exactly. Keys never change, so saved
 * ticks stay with their steps. The stage names are INTERNAL: nothing the
 * customer reads says "expansion". Pure.
 */
import { planTaskKey, PRODUCT_LINES } from "./partnerRoom";
import type { RoomWave } from "./partnerRoomStage";

/** As `waveKey` in partnerRoomStage ("Wave 1" = "1"); repeated here so the two files don't import each other. */
const waveKey = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/^wave\s*/, "").replace(/\s+/g, " ");

export type ExpansionDecision = "keep" | "retire";

export interface PlanRow {
  key?: string;
  task?: string;
  target?: string;
  note?: string;
  ourOwner?: string;
  partnerOwner?: string;
  status?: string;
  customerAction?: "check" | "upload";
  uploadLabel?: string;
  hidden?: boolean;
  /** Not done when the rollout ended and set aside then: hidden from the customer, listed for the team. */
  retired?: boolean;
}
export interface PlanGroup {
  title: string;
  checkpoint?: string;
  hidden?: boolean;
  rows: PlanRow[];
}

/** One open rollout step, for the review the rep sees before moving a hub on. */
export interface ExpansionReviewRow {
  key: string;
  task: string;
  phase: string;
  /** What the rules suggest. */
  suggested: ExpansionDecision;
  /** Why, in a few words (shown under the step). */
  why: string;
}

/** Launch moments: if they haven't happened by the end of the rollout, they won't as written. */
const RETIRE_KEYS = new Set(["exec-kickoff", "internal-announcement", "welcome-event", "first-live", "hub-walkthrough", "roi-review", "first-ebr"]);
/** Happen again for every wave, so the wave groups carry them from here. */
const PER_WAVE_KEYS = new Set(["regional-kickoff", "regional-1-1s", "first-wave-scheduled", "lunch-and-learns", "education-events", "next-wave"]);

const isDone = (r: PlanRow, ticked: Set<string>) => r.status === "done" || ticked.has(planTaskKey(r));

function suggestion(key: string): { suggested: ExpansionDecision; why: string } {
  if (RETIRE_KEYS.has(key)) return { suggested: "retire", why: "A launch step" };
  if (PER_WAVE_KEYS.has(key)) return { suggested: "retire", why: "Now part of each wave" };
  return { suggested: "keep", why: "Still needed" };
}

/** The open steps of the rollout plan, with what to do with each. `ticked` = keys the customer has marked done. */
export function expansionReview(groups: unknown, ticked: Iterable<string> = []): ExpansionReviewRow[] {
  const done = new Set(ticked);
  const out: ExpansionReviewRow[] = [];
  for (const g of asGroups(groups)) {
    if (g.hidden) continue;
    for (const r of g.rows) {
      if (r.hidden || isDone(r, done)) continue;
      const key = planTaskKey(r);
      if (!key) continue;
      out.push({ key, task: String(r.task ?? key), phase: g.title.replace(/^Days?\s+[\d–-]+\s*·\s*/i, ""), ...suggestion(key) });
    }
  }
  return out;
}

const D = (key: string, task: string, partnerOwner: string, extra: Partial<PlanRow> = {}): PlanRow => ({ key, task, ourOwner: "", partnerOwner, status: "not-started", customerAction: "check", ...extra });
/** A standing commitment: the team keeps its status, the customer doesn't tick it off. */
const S = (key: string, task: string, partnerOwner: string, extra: Partial<PlanRow> = {}): PlanRow => ({ key, task, ourOwner: "", partnerOwner, status: "on-track", ...extra });

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The steps every wave repeats. Keys carry the wave, so each wave's ticks are its own. */
export function waveGroup(w: RoomWave | null): PlanGroup {
  const id = w ? `wave-${waveKey(w.key).replace(/[^a-z0-9]+/g, "-") || "x"}` : "remaining";
  const start = w?.start || "";
  const target = w?.target || "";
  const title = w ? `${w.name}${target ? ` · target ${fmt(target)}` : ""}` : "Your remaining practices";
  return {
    title,
    checkpoint: "Practices confirmed · regional managers introduced · training booked",
    rows: [
      D(`${id}-practices`, w ? `Confirm the practices in ${w.name}` : "Confirm which practices come on next", "Operations Lead", { target: start }),
      D(`${id}-regionals`, "Introduce their regional managers to your Dandy team", "Operations Lead", { target: start }),
      D(`${id}-training`, "Book a training date for every practice", "Regional Managers", { target: start ? addDays(start, 14) : "" }),
      D(`${id}-lunch`, "Approve Lunch & Learn dates for these practices", "Regional Managers", { target: target }),
    ],
  };
}

/** Lines worth suggesting: real product lines, never the everyday ones every practice starts with. */
const CROSS_SELL = new Set(["Full denture", "Partial denture", "Implant", "Aligner", "Surgical guide", "Removable", "Complex restorative"]);

/**
 * "Product lines": what the customer's practices could send Dandy next. With
 * order data, the two lines the fewest ordering practices use get their own
 * training step; without it, one general step.
 */
export function productLineGroup(summary: { ordering: number; lines: { line: string; practices: number }[] } | null): PlanGroup {
  const known = PRODUCT_LINES.map(([, label]) => label);
  const lines = summary && summary.ordering > 0 ? summary.lines.filter((l) => CROSS_SELL.has(l.line) && known.includes(l.line) && l.practices / summary.ordering < 0.5) : [];
  const picks = [...lines].sort((a, b) => a.practices - b.practices || known.indexOf(a.line) - known.indexOf(b.line)).slice(0, 2);
  const share = (l: { practices: number }) => Math.round((l.practices / summary!.ordering) * 100);
  const today = picks.length ? `Today: ${picks.map((l) => `${share(l)}% order ${l.line.toLowerCase()}`).join(" · ")}` : "Dentures, implants, aligners and surgical guides";
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    title: "Product lines",
    checkpoint: "Next product lines chosen · training booked for live practices",
    rows: [
      D("xs-choose", "Choose the next product lines to bring to your practices", "Clinical Champion", { note: today }),
      ...(picks.length
        ? picks.map((l) => D(`xs-train-${slug(l.line)}`, `Book ${l.line.toLowerCase()} training for your live practices`, "Education Lead", { note: `${l.practices} of ${summary!.ordering} ordering practices send ${l.line.toLowerCase()} cases today` }))
        : [D("xs-train", "Book product-line training for your live practices", "Education Lead")]),
      D("xs-lunch", "Add a product Lunch & Learn to your next regional call", "Regional Managers"),
    ],
  };
}

export function ongoingGroup(today: string): PlanGroup {
  return {
    title: "Ongoing",
    checkpoint: "Quarterly reviews held · practice list kept current",
    rows: [
      S("qbr", "Join your quarterly business review", "Executive Sponsor", { target: addDays(today, 90), note: "Results, adoption and the plan for the next quarter" }),
      S("ops-call", "Join the monthly operations call", "Operations Lead"),
      D("practice-list-update", "Send your updated practice list each quarter", "Operations Lead", { customerAction: "upload", uploadLabel: "Upload practice list", note: "New offices, closures and changes of manager" }),
      S("new-offices", "Tell us when you open or acquire an office", "Operations Lead", { note: "We onboard it the same way as the rest" }),
      S("referrals", "Introduce us to practices that are ready to start", "Regional Managers"),
    ],
  };
}

function asGroups(raw: unknown): PlanGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
    .map((g) => ({ ...(g as object), title: String(g.title ?? ""), rows: Array.isArray(g.rows) ? (g.rows.filter((r) => !!r && typeof r === "object") as PlanRow[]) : [] }) as PlanGroup);
}

/** Waves added after the move: a group for each wave still to come that the plan doesn't have yet, appended before "Product lines". */
export function addWaveGroups(groups: unknown, waves: RoomWave[], today: string): PlanGroup[] {
  const list = asGroups(groups);
  const have = new Set(list.flatMap((g) => g.rows.map((r) => planTaskKey(r))));
  const extra = waves.filter((w) => !w.target || w.target >= today).map((w) => waveGroup(w)).filter((g) => g.rows.every((r) => !have.has(planTaskKey(r))));
  if (!extra.length) return list;
  const at = list.findIndex((g) => g.rows.some((r) => planTaskKey(r) === "xs-choose"));
  return at < 0 ? [...list, ...extra] : [...list.slice(0, at), ...extra, ...list.slice(at)];
}

export interface ExpansionPlanInput {
  /** Per open step: keep or retire. A step not named follows the suggestion. */
  decisions?: Record<string, ExpansionDecision>;
  waves: RoomWave[];
  productSummary: { ordering: number; lines: { line: string; practices: number }[] } | null;
  /** Keys the customer has ticked. */
  ticked?: Iterable<string>;
  today: string;
}

/** The plan after the rollout. `groups` = the rollout plan as it stands. */
export function buildExpansionPlan(groups: unknown, input: ExpansionPlanInput): PlanGroup[] {
  const ticked = new Set(input.ticked ?? []);
  const decide = (key: string): ExpansionDecision => input.decisions?.[key] ?? suggestion(key).suggested;
  const carried: PlanRow[] = [];
  const rollout = asGroups(groups).map((g) => ({
    ...g,
    rows: g.rows.flatMap((r): PlanRow[] => {
      if (r.hidden || isDone(r, ticked)) return [r];
      const key = planTaskKey(r);
      if (decide(key) === "keep") {
        // Its old due date is from the launch: it would only read as late.
        const { target: _old, ...rest } = r;
        carried.push(rest);
        return [];
      }
      return [{ ...r, hidden: true, retired: true }];
    }),
  }));
  // Waves still to come: not past their target. None set up = one group for the rest of the practices.
  const ahead = input.waves.filter((w) => !w.target || w.target >= input.today);
  const waveGroups = input.waves.length ? ahead.map((w) => waveGroup(w)) : [waveGroup(null)];
  // A key already in the plan (a wave group the rep set up by hand) is not added twice.
  const have = new Set(rollout.flatMap((g) => g.rows.map((r) => planTaskKey(r))));
  const fresh = (g: PlanGroup): PlanGroup => ({ ...g, rows: g.rows.filter((r) => !have.has(planTaskKey(r))) });
  return [
    ...rollout.filter((g) => g.rows.length > 0),
    ...(carried.length ? [{ title: "Still to finish", checkpoint: "Everything from the launch closed out", rows: carried }] : []),
    ...[...waveGroups, productLineGroup(input.productSummary), ongoingGroup(input.today)].map(fresh).filter((g) => g.rows.length > 0),
  ];
}
