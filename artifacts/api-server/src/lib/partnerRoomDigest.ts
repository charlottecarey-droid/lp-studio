/**
 * Partner rooms — the weekly digest. Pure functions: turn a room's page
 * blocks + saved state into "what got done, what is waiting on you, what is
 * coming up", then render it as an email for the customer and a Slack post
 * for the team's account channel. No database access (see the routes and the
 * poller for loading and sending).
 *
 * The customer email only ever says things the customer can already see in
 * the room. The Slack version adds what the team needs to act on: blocking
 * items and decisions still open.
 */
import { planTaskKey, ROOM_PROGRAM_DEFAULT_OPTIONS } from "./partnerRoom";

export interface DigestState {
  /** Task keys the customer completed, with when and by whom. */
  tasks: { key: string; at: Date; by: string }[];
  requests: { subject: string; status: string; updatedAt: Date; createdAt: Date }[];
  choices: { key: string; value: string }[];
  wins: { body: string; headline: string | null; by: string; likes: number; createdAt: Date }[];
  practices: {
    total: number;
    byStage: Record<string, number>;
    /** One row per practice: what the rollout and order numbers are worked out from. Absent = counts only. */
    rows?: DigestPracticeRow[];
    /** Daily history of the counts (oldest first), for "this week" changes. */
    trend?: { day: string; total: number; byStage: Record<string, number> }[];
    byRegion?: { region: string; total: number; live: number; trained: number }[];
    byWave?: { wave: string; total: number; live: number }[];
    scanners?: { total: number; practices: number };
    doctors?: { total: number; matched: number };
  };
}

export interface DigestPracticeRow {
  name: string;
  region: string | null;
  stage: string;
  trainingDate: string | null;
  liveDate: string | null;
  lastOrderDay: string | null;
  tenthOrderDay: string | null;
  ordersAllTime: number | null;
  ordersLastMonth: number | null;
  ordersThisMonth: number | null;
  /** When the practice was added to the welcome kit list. */
  kitSentAt?: Date | null;
}

/**
 * What the digest is about changes as the partnership does:
 *   setup      nothing trained yet: the big setup milestones (practice list in, kickoff held, welcome kits sent)
 *   rollout    practices are being trained and going live: the numbers, and what moved this week
 *   expansion  past the rollout: the numbers, and (for the team) orders
 */
export type DigestPhase = "setup" | "rollout" | "expansion";

/** One of the few steps worth naming in a digest, said as a thing that happened. */
export interface DigestMilestone {
  key: string;
  label: string;
  done: boolean;
  at: Date | null;
  thisWeek: boolean;
}

/** The plan steps that matter enough to name, in order, each as it reads once done. Everything else is counted, not listed. */
export const DIGEST_MILESTONES: [string, string][] = [
  ["practice-roster", "Practice list uploaded"],
  ["doctor-roster", "Doctor roster uploaded"],
  ["exec-kickoff", "Executive kickoff held"],
  ["internal-announcement", "Partnership announced to your practices"],
  ["regional-kickoff", "Regional managers introduced"],
  ["first-wave-scheduled", "First practices and training dates confirmed"],
  ["hub-walkthrough", "Enterprise Hub walkthrough held"],
  ["roi-review", "Results reviewed together"],
  ["first-ebr", "First Executive Business Review held"],
];

/** Where the rollout stands and what moved this week. Safe for the customer: it is their own practice list. */
export interface DigestRollout {
  total: number;
  live: number;
  /** Trained or live. */
  trained: number;
  booked: number;
  scheduling: number;
  notStarted: number;
  /** Change over the last 7 days, from the daily history. Null when there is no history that far back. */
  liveChange: number | null;
  trainedChange: number | null;
  addedChange: number | null;
  wentLive: string[];
  trainedThisWeek: string[];
  /** Training in the next 14 days, soonest first. */
  upcoming: { name: string; day: string }[];
  regions: { region: string; total: number; live: number; trained: number }[];
  waves: { wave: string; total: number; live: number }[];
  scanners?: { total: number; practices: number };
  doctors?: { total: number; matched: number };
}

/** Order numbers. TEAM ONLY: the hub shows these to our own team, never to the customer, so they go in Slack and not in the email. */
export interface DigestOrders {
  /** Practices with any order on record. */
  ordering: number;
  thisMonth: number;
  lastMonth: number;
  /** Live, and known to have placed no order yet. */
  liveNoOrders: string[];
  /** Has ordered, but not in the last 30 days. */
  lapsed: string[];
  /** Placed their tenth order this week. */
  tenth: string[];
  top: { name: string; orders: number }[];
}

export interface DigestData {
  partnerName: string;
  day: number | null;
  totalDays: number;
  phase: string | null;
  planDone: number;
  planTotal: number;
  doneThisWeek: string[];
  waitingOnCustomer: string[];
  blocking: string[];
  undecided: string[];
  reviewRequests: string[];
  newRequests: number;
  topWin: { text: string; by: string } | null;
  practicesLive: number;
  practicesTotal: number;
  nextMilestone: string | null;
  /** Which kind of update this is. It moves on by itself as practices are trained and the hub leaves its rollout. */
  kind: DigestPhase;
  /** The named milestones this hub's plan has, in order, done or not. */
  milestones: DigestMilestone[];
  /** Welcome kits sent to practices. Null when the hub has no practices. */
  kits: { sent: number; total: number; thisWeek: number } | null;
  /** Smaller steps finished this week that are counted rather than listed. */
  otherDone: number;
  /** Null when the hub has no practices loaded. */
  rollout: DigestRollout | null;
  /** Null when the practice list carries no order data. Team only. */
  orders: DigestOrders | null;
}

const pad2 = (n: string | number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dayBack = (now: Date, n: number) => isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n)));

/** A date as a source wrote it ("2026-11-12", "11/12/2026", "Nov 12, 2026") as YYYY-MM-DD, or null. */
export function digestDay(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  const t = Date.parse(`${s} UTC`);
  return Number.isFinite(t) ? isoDay(new Date(t)) : null;
}

/** "2026-11-24" → "Nov 24". */
export function digestDayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1]} ${+m[3]}` : day;
}

/** The rollout as numbers: where every practice stands, what changed in the last 7 days, and whose training is next. */
export function collectRollout(p: DigestState["practices"], now: Date): DigestRollout | null {
  if (!p.total) return null;
  const today = dayBack(now, 0);
  const weekAgo = dayBack(now, 7);
  const ahead = dayBack(now, -14);
  const rows = p.rows ?? [];
  const live = p.byStage.live ?? 0;
  const trained = live + (p.byStage.trained ?? 0);
  // The newest point in the history that is at least a week old.
  const before = [...(p.trend ?? [])].filter((t) => t.day <= weekAgo).sort((a, b) => a.day.localeCompare(b.day)).pop();
  const inWeek = (d: string | null) => !!d && d > weekAgo && d <= today;
  const byName = (a: string, b: string) => a.localeCompare(b);
  return {
    total: p.total,
    live,
    trained,
    booked: p.byStage.training_booked ?? 0,
    scheduling: p.byStage.scheduling ?? 0,
    notStarted: p.byStage.not_started ?? 0,
    liveChange: before ? live - (before.byStage.live ?? 0) : null,
    trainedChange: before ? trained - ((before.byStage.live ?? 0) + (before.byStage.trained ?? 0)) : null,
    addedChange: before ? p.total - before.total : null,
    wentLive: rows.filter((r) => r.stage === "live" && inWeek(digestDay(r.liveDate))).map((r) => r.name).sort(byName),
    trainedThisWeek: rows.filter((r) => (r.stage === "trained" || r.stage === "live") && inWeek(digestDay(r.trainingDate))).map((r) => r.name).sort(byName),
    upcoming: rows
      .map((r) => ({ name: r.name, day: digestDay(r.trainingDate), stage: r.stage }))
      .filter((r): r is { name: string; day: string; stage: string } => !!r.day && r.day > today && r.day <= ahead && r.stage !== "live" && r.stage !== "trained")
      .sort((a, b) => a.day.localeCompare(b.day) || byName(a.name, b.name))
      .map(({ name, day }) => ({ name, day })),
    regions: (p.byRegion ?? []).slice(0, 8),
    waves: (p.byWave ?? []).slice(0, 8),
    ...(p.scanners ? { scanners: p.scanners } : {}),
    ...(p.doctors ? { doctors: p.doctors } : {}),
  };
}

/** Order numbers for the team's Slack post. Null when no practice carries order data. */
export function collectOrders(rows: DigestPracticeRow[] | undefined, now: Date): DigestOrders | null {
  const known = (rows ?? []).filter((r) => r.ordersAllTime !== null || r.ordersThisMonth !== null || r.ordersLastMonth !== null || !!r.lastOrderDay);
  if (known.length === 0) return null;
  const today = dayBack(now, 0);
  const weekAgo = dayBack(now, 7);
  const monthAgo = dayBack(now, 30);
  const has = (r: DigestPracticeRow) => (r.ordersAllTime ?? 0) > 0 || !!r.lastOrderDay;
  const names = (list: DigestPracticeRow[]) => list.map((r) => r.name).sort((a, b) => a.localeCompare(b));
  return {
    ordering: known.filter(has).length,
    thisMonth: known.reduce((n, r) => n + (r.ordersThisMonth ?? 0), 0),
    lastMonth: known.reduce((n, r) => n + (r.ordersLastMonth ?? 0), 0),
    liveNoOrders: names(known.filter((r) => r.stage === "live" && r.ordersAllTime === 0 && !r.lastOrderDay)),
    lapsed: names(known.filter((r) => { const d = digestDay(r.lastOrderDay); return has(r) && !!d && d < monthAgo; })),
    tenth: names(known.filter((r) => { const d = digestDay(r.tenthOrderDay); return !!d && d > weekAgo && d <= today; })),
    top: known.filter((r) => (r.ordersThisMonth ?? 0) > 0).sort((a, b) => (b.ordersThisMonth ?? 0) - (a.ordersThisMonth ?? 0) || a.name.localeCompare(b.name)).slice(0, 3).map((r) => ({ name: r.name, orders: r.ordersThisMonth ?? 0 })),
  };
}

type Row = { key?: unknown; task?: unknown; status?: unknown; customerAction?: unknown; hidden?: unknown; note?: unknown; partnerOwner?: unknown };

function workspaceProps(blocks: unknown): Record<string, unknown> | null {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace") return ((b as { props?: Record<string, unknown> }).props ?? {}) as Record<string, unknown>;
  }
  return null;
}

/** Day of the rollout (kickoff = day 1), or null without a valid kickoff date or before it. */
export function digestRolloutDay(kickoffDate: unknown, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof kickoffDate === "string" ? kickoffDate.trim() : "");
  if (!m) return null;
  const d = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86_400_000) + 1;
  return d >= 1 ? d : null;
}

/** Null when the page has no workspace block. `now` and a 7-day window decide "this week". */
export function collectDigest(blocks: unknown, state: DigestState, now: Date): DigestData | null {
  const props = workspaceProps(blocks);
  if (!props) return null;
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const doneKeys = new Map(state.tasks.map((t) => [t.key, t]));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const rows: Row[] = [];
  for (const g of Array.isArray(props.planGroups) ? (props.planGroups as { hidden?: unknown; rows?: unknown }[]) : []) {
    if (!g || g.hidden || !Array.isArray(g.rows)) continue;
    for (const r of g.rows as Row[]) if (r && !r.hidden) rows.push(r);
  }
  const isDone = (r: Row) => doneKeys.has(planTaskKey(r)) || r.status === "done";
  const customerOpen = rows.filter((r) => (r.customerAction === "check" || r.customerAction === "upload") && !isDone(r));

  const onboarding = props.onboarding as { hidden?: unknown; steps?: unknown } | undefined;
  const steps = !onboarding || onboarding.hidden || !Array.isArray(onboarding.steps) ? [] : (onboarding.steps as { key?: unknown; title?: unknown; done?: unknown; hidden?: unknown }[]).filter((x) => x && !x.hidden);
  const stepsOpen = steps.filter((x) => !x.done && !doneKeys.has(planTaskKey({ key: x.key, task: x.title })));

  const chosen = new Set(state.choices.map((c) => c.key));
  const undecided: string[] = [];
  const marketing = props.marketing as { groups?: unknown } | undefined;
  for (const g of Array.isArray(marketing?.groups) ? (marketing!.groups as { hidden?: unknown; programs?: unknown }[]) : []) {
    if (!g || g.hidden || !Array.isArray(g.programs)) continue;
    for (const p of g.programs as { key?: unknown; title?: unknown; options?: unknown; hidden?: unknown }[]) {
      // The announcement and the welcome kits are the customer's to decide even on a hub saved before they carried choices.
      const options = Array.isArray(p.options) && p.options.length >= 2 ? p.options : (ROOM_PROGRAM_DEFAULT_OPTIONS[str(p.key)] ?? []);
      if (!p || p.hidden || options.length < 2) continue;
      if (!chosen.has(planTaskKey({ key: p.key, task: p.title }))) undecided.push(str(p.title));
    }
  }

  // Titles of everything the customer completed this week (plan rows and onboarding steps).
  const titleByKey = new Map<string, string>();
  for (const r of rows) titleByKey.set(planTaskKey(r), str(r.task));
  for (const x of steps) titleByKey.set(planTaskKey({ key: x.key, task: x.title }), str(x.title));
  // The few steps worth naming, when this hub's plan has them. A step counts as done when the customer completed it or the team marked it so.
  const rowByKey = new Map(rows.map((r) => [planTaskKey(r), r]));
  const milestones: DigestMilestone[] = DIGEST_MILESTONES.filter(([key]) => rowByKey.has(key)).map(([key, label]) => {
    const t = doneKeys.get(key);
    return { key, label, done: !!t || rowByKey.get(key)?.status === "done", at: t?.at ?? null, thisWeek: !!t && t.at.getTime() >= weekAgo };
  });
  const named = new Set(DIGEST_MILESTONES.map(([key]) => key));
  const kitRows = state.practices.rows ?? [];
  const kits = state.practices.total > 0 && kitRows.length > 0 ? { sent: kitRows.filter((r) => r.kitSentAt).length, total: state.practices.total, thisWeek: kitRows.filter((r) => r.kitSentAt && r.kitSentAt.getTime() >= weekAgo).length } : null;
  // "Done this week" names only what matters: milestones, welcome kits and finished requests. The rest is a count.
  const doneThisWeek = milestones.filter((x) => x.thisWeek).map((x) => x.label);
  if (kits && kits.thisWeek > 0) doneThisWeek.push(`Welcome kits sent to ${kits.thisWeek} practice${kits.thisWeek === 1 ? "" : "s"}${kits.sent > kits.thisWeek ? ` (${kits.sent} of ${kits.total} so far)` : ""}`);
  for (const q of state.requests) if (q.status === "done" && q.updatedAt.getTime() >= weekAgo) doneThisWeek.push(`Request completed: ${q.subject}`);
  const otherDone = state.tasks.filter((t) => t.at.getTime() >= weekAgo && titleByKey.has(t.key) && !named.has(t.key)).length;

  const totalDays = typeof props.rolloutDays === "number" && props.rolloutDays > 0 ? props.rolloutDays : 90;
  const day = digestRolloutDay(props.kickoffDate, now);
  let phase: string | null = null;
  if (day !== null) {
    for (const p of Array.isArray(props.phases) ? (props.phases as { title?: unknown; endDay?: unknown }[]) : []) {
      if (typeof p?.endDay !== "number" || day <= p.endDay) {
        phase = str(p?.title) || null;
        break;
      }
    }
  }

  const rollout = collectRollout(state.practices, now);
  const recentWins = state.wins.filter((w) => w.createdAt.getTime() >= weekAgo).sort((a, b) => b.likes - a.likes || b.createdAt.getTime() - a.createdAt.getTime());
  const top = recentWins[0];
  const nextLabel = str(props.nextMilestoneLabel);
  const nextDate = str(props.nextMilestoneDate);

  return {
    partnerName: str(props.partnerName) || "your team",
    day: day === null ? null : Math.min(day, totalDays),
    totalDays,
    phase,
    planDone: rows.filter(isDone).length,
    planTotal: rows.length,
    doneThisWeek,
    waitingOnCustomer: [...stepsOpen.map((x) => str(x.title)), ...customerOpen.map((r) => str(r.task))].filter(Boolean),
    blocking: rows.filter((r) => r.status === "blocking" && !isDone(r)).map((r) => [str(r.task), str(r.note)].filter(Boolean).join(" · ")),
    undecided: undecided.filter(Boolean),
    reviewRequests: state.requests.filter((q) => q.status === "review").map((q) => q.subject),
    newRequests: state.requests.filter((q) => q.createdAt.getTime() >= weekAgo).length,
    topWin: top ? { text: [top.headline, top.body].filter(Boolean).join(". "), by: top.by } : null,
    practicesLive: state.practices.byStage.live ?? 0,
    practicesTotal: state.practices.total,
    nextMilestone: nextLabel ? (nextDate ? `${nextLabel} · ${nextDate}` : nextLabel) : null,
    kind: props.stage === "expansion" ? "expansion" : rollout && rollout.trained > 0 ? "rollout" : "setup",
    milestones,
    kits,
    otherDone,
    rollout,
    orders: collectOrders(state.practices.rows, now),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** True when there is nothing worth emailing about (no progress, nothing waiting, no win). */
export function digestIsEmpty(d: DigestData): boolean {
  const r = d.rollout;
  const moved = !!r && (!!r.liveChange || !!r.trainedChange || r.wentLive.length > 0 || r.trainedThisWeek.length > 0 || r.upcoming.length > 0);
  return d.doneThisWeek.length === 0 && d.otherDone === 0 && d.waitingOnCustomer.length === 0 && d.undecided.length === 0 && d.reviewRequests.length === 0 && !d.topWin && !moved;
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
/** "Main St, Oak Ave and 3 more". */
const someNames = (names: string[], max = 4) => (names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`);

/** The customer email. `brandColor` is a hex for the header band; `senderName` is who it is from ("Dandy"). */
export function renderDigestEmail(d: DigestData, opts: { roomUrl: string; senderName: string; brandColor?: string }): { subject: string; html: string } {
  const color = /^#[0-9a-f]{6}$/i.test(opts.brandColor ?? "") ? (opts.brandColor as string) : "#0E1A16";
  const list = (items: string[], max = 6) =>
    `<ul style="margin:8px 0 0;padding:0 0 0 18px;color:#0E1A16;font-size:14px;line-height:1.6">${items.slice(0, max).map((i) => `<li>${esc(i)}</li>`).join("")}${items.length > max ? `<li style="color:#5C6B61">and ${items.length - max} more</li>` : ""}</ul>`;
  const section = (title: string, body: string) => `<tr><td style="padding:18px 28px 0"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1AA35A">${esc(title)}</div>${body}</td></tr>`;
  // Work we finished and are holding for their review comes first: it is the one thing only they can unblock.
  const waiting = [...d.reviewRequests.map((r) => `Review: ${r}`), ...d.waitingOnCustomer, ...d.undecided.map((u) => `Decide: ${u}`)];
  const stats = [d.day !== null ? `Day ${d.day} of ${d.totalDays}${d.phase ? ` · ${d.phase}` : ""}` : null, d.planTotal ? `${d.planDone} of ${d.planTotal} plan items complete` : null].filter(Boolean) as string[];
  const r = d.rollout;
  const muted = "color:#5C6B61";
  const line = (label: string, value: string) => `<tr><td style="padding:5px 0;font-size:14px;${muted};vertical-align:top;width:150px">${esc(label)}</td><td style="padding:5px 0;font-size:14px;color:#0E1A16;line-height:1.5">${value}</td></tr>`;
  const tile = (n: number, label: string, change: number | null) =>
    `<td style="padding:0 6px 0 0;vertical-align:top"><div style="border:1px solid #E7E7E0;border-radius:10px;padding:12px 14px"><div style="font-size:26px;font-weight:700;letter-spacing:-.02em;color:#0E1A16">${n}</div><div style="font-size:12px;${muted};margin-top:2px">${esc(label)}</div>${change ? `<div style="font-size:12px;font-weight:600;color:${change > 0 ? "#1AA35A" : "#B4541A"};margin-top:4px">${signed(change)} this week</div>` : ""}</div></td>`;
  const otherLine = d.otherDone > 0 ? [`${d.otherDone} other step${d.otherDone === 1 ? "" : "s"} completed`] : [];
  const doneLines = [...d.doneThisWeek, ...otherLine];
  const when = (at: Date | null) => (at ? ` <span style="${muted}">· ${esc(digestDayLabel(isoDay(at)))}</span>` : "");
  const mark = (done: boolean) => `<td style="padding:5px 10px 5px 0;vertical-align:top;font-size:14px;color:${done ? "#1AA35A" : "#B7BDB4"};width:16px">${done ? "&#10003;" : "&#9675;"}</td>`;
  // Before any practice is trained: the big setup milestones, done or still to come. Not every tick.
  const openMilestones = d.milestones.filter((x) => !x.done);
  const setupRows = [
    ...d.milestones.filter((x) => x.done).map((x) => `<tr>${mark(true)}<td style="padding:5px 0;font-size:14px;color:#0E1A16">${esc(x.label)}${when(x.at)}</td></tr>`),
    ...(d.kits && d.kits.sent > 0 ? [`<tr>${mark(true)}<td style="padding:5px 0;font-size:14px;color:#0E1A16">Welcome kits sent to ${d.kits.sent} of ${d.kits.total} practices</td></tr>`] : []),
    ...openMilestones.slice(0, 2).map((x, i) => `<tr>${mark(false)}<td style="padding:5px 0;font-size:14px;${muted}">${esc(x.label)}${i === 0 ? " · next" : ""}</td></tr>`),
  ];
  const setupHtml =
    (setupRows.length ? section("Getting set up", `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;width:100%">${setupRows.join("")}</table>${otherLine.length ? `<div style="margin-top:6px;font-size:13px;${muted}">${esc(otherLine[0])} this week</div>` : ""}`) : "") +
    (r ? section("Your practices", `<div style="margin-top:8px;font-size:14px;color:#0E1A16;line-height:1.6"><b>${r.total}</b> on the list${r.regions.length > 1 ? ` across ${r.regions.length} regions` : ""}${r.booked + r.scheduling > 0 ? ` · ${r.booked + r.scheduling} being scheduled for training` : ""}${r.upcoming.length ? `<br>First training: ${esc(r.upcoming[0].name)} <span style="${muted}">· ${esc(digestDayLabel(r.upcoming[0].day))}</span>` : ""}</div>`) : "");
  // Once practices are trained: the rollout as numbers. Where every practice stands, what moved this week, what is next.
  const rolloutHtml = !r
    ? ""
    : section(
        "Rollout",
        `<div style="margin-top:8px;font-size:15px;color:#0E1A16"><b>${r.live} of ${r.total}</b> practices live (${pct(r.live, r.total)}%)</div>
<div style="margin-top:8px;height:8px;border-radius:99px;background:#E7E7E0;overflow:hidden"><div style="height:8px;border-radius:99px;background:#1AA35A;width:${Math.max(r.live > 0 ? 2 : 0, pct(r.live, r.total))}%"></div></div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;width:100%"><tr>${tile(r.live, "Live", r.liveChange)}${tile(r.trained, "Trained", r.trainedChange)}${tile(r.booked + r.scheduling, "Being scheduled", null)}${tile(r.notStarted, "Not started", null)}</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;width:100%">${[
          r.wentLive.length ? line("Went live this week", esc(someNames(r.wentLive, 6))) : "",
          r.trainedThisWeek.length ? line("Trained this week", esc(someNames(r.trainedThisWeek, 6))) : "",
          r.upcoming.length ? line("Training next", r.upcoming.slice(0, 6).map((u) => `${esc(u.name)} <span style="${muted}">· ${esc(digestDayLabel(u.day))}</span>`).join("<br>") + (r.upcoming.length > 6 ? `<br><span style="${muted}">and ${r.upcoming.length - 6} more</span>` : "")) : "",
          r.addedChange ? line("Practices on the list", `${r.total} <span style="${muted}">(${signed(r.addedChange)} this week)</span>`) : "",
          r.scanners ? line("Scanners", `${r.scanners.total} across ${r.scanners.practices} practice${r.scanners.practices === 1 ? "" : "s"}`) : "",
          r.doctors ? line("Doctors on your roster", String(r.doctors.total)) : "",
        ].join("")}</table>
${
  r.regions.length > 1
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;width:100%;border-top:1px solid #E7E7E0"><tr><td style="padding:8px 0 4px;font-size:12px;font-weight:600;${muted}">By region</td><td style="padding:8px 0 4px;font-size:12px;font-weight:600;${muted};text-align:right">Live</td><td style="padding:8px 0 4px;font-size:12px;font-weight:600;${muted};text-align:right">Trained</td></tr>${r.regions.slice(0, 6).map((g) => `<tr><td style="padding:4px 0;font-size:14px;color:#0E1A16">${esc(g.region)}</td><td style="padding:4px 0;font-size:14px;color:#0E1A16;text-align:right">${g.live} of ${g.total}</td><td style="padding:4px 0;font-size:14px;color:#0E1A16;text-align:right">${g.trained}</td></tr>`).join("")}</table>`
    : r.waves.length > 1
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;width:100%;border-top:1px solid #E7E7E0"><tr><td style="padding:8px 0 4px;font-size:12px;font-weight:600;${muted}">By wave</td><td style="padding:8px 0 4px;font-size:12px;font-weight:600;${muted};text-align:right">Live</td></tr>${r.waves.slice(0, 6).map((w) => `<tr><td style="padding:4px 0;font-size:14px;color:#0E1A16">${esc(/^\d+$/.test(w.wave) ? `Wave ${w.wave}` : w.wave)}</td><td style="padding:4px 0;font-size:14px;color:#0E1A16;text-align:right">${w.live} of ${w.total}</td></tr>`).join("")}</table>`
      : ""
}`,
      );
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#F3F4EF;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4EF;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E7E7E0;border-radius:12px;overflow:hidden">
<tr><td style="background:${color};padding:24px 28px;color:#ffffff">
<div style="font-size:12px;opacity:.75">${esc(d.partnerName)} × ${esc(opts.senderName)}</div>
<div style="font-size:24px;font-weight:700;letter-spacing:-.02em;margin-top:4px">Your weekly update</div>
${stats.length ? `<div style="font-size:13px;opacity:.85;margin-top:8px">${stats.map(esc).join(" &nbsp;·&nbsp; ")}</div>` : ""}
</td></tr>
${d.kind === "setup" ? setupHtml : rolloutHtml}
${d.kind !== "setup" && doneLines.length ? section("Also this week", list(doneLines, 4)) : ""}
${waiting.length ? section("Waiting on you", list(waiting, 4)) : ""}
${d.nextMilestone ? section("Coming up", `<div style="margin-top:8px;font-size:14px;color:#0E1A16">${esc(d.nextMilestone)}</div>`) : ""}
${d.topWin ? section("Win of the week", `<div style="margin-top:8px;font-size:14px;line-height:1.6;color:#0E1A16">${esc(d.topWin.text)}<div style="color:#5C6B61;font-size:12.5px;margin-top:2px">${esc(d.topWin.by)}</div></div>`) : ""}
<tr><td style="padding:24px 28px 28px"><a href="${esc(opts.roomUrl)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px">Open the workspace</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E7E7E0;font-size:12px;color:#5C6B61">You're receiving this weekly update as part of the ${esc(d.partnerName)} and ${esc(opts.senderName)} partnership. Reply to this email to change who receives it.</td></tr>
</table></td></tr></table></body></html>`;
  // The subject leads with what matters at this point: setup milestones early on, practices live after that.
  const reached = d.milestones.filter((x) => x.done).length;
  const headline =
    d.kind !== "setup" && r
      ? `${r.live} of ${r.total} practices live${r.liveChange && r.liveChange > 0 ? ` (${signed(r.liveChange)} this week)` : ""}`
      : d.milestones.length
        ? `${reached} of ${d.milestones.length} setup milestones done`
        : waiting.length
          ? `${waiting.length} waiting on you`
          : "";
  const subject = `${d.partnerName} × ${opts.senderName}: weekly update${headline ? ` · ${headline}` : ""}`;
  return { subject, html };
}

/** The team's Slack post for the account channel. */
export function renderDigestSlack(d: DigestData, roomUrl: string, extraSections: string[] = []): { text: string; blocks: unknown[] } {
  const m = (s: string) => s.replace(/[<>&*_~`]/g, " ");
  const bullets = (items: string[], max = 4) => items.slice(0, max).map((i) => `• ${m(i)}`).join("\n") + (items.length > max ? `\n• and ${items.length - max} more` : "");
  const lines: string[] = [];
  lines.push([d.day !== null ? `Day ${d.day} of ${d.totalDays}${d.phase ? ` (${m(d.phase)})` : ""}` : null, `${d.planDone}/${d.planTotal} plan items done`].filter(Boolean).join(" · "));
  const r = d.rollout;
  // Early on: the setup milestones, done and next. Not every tick.
  if (d.kind === "setup") {
    const done = d.milestones.filter((x) => x.done);
    const open = d.milestones.filter((x) => !x.done);
    const setup = [
      `*Getting set up* (${done.length} of ${d.milestones.length} milestones)`,
      ...done.map((x) => `✅ ${m(x.label)}${x.at ? ` · ${digestDayLabel(isoDay(x.at))}` : ""}`),
      d.kits && d.kits.sent > 0 ? `✅ Welcome kits sent to ${d.kits.sent} of ${d.kits.total} practices` : "",
      open.length ? `Next: ${open.slice(0, 2).map((x) => m(x.label)).join(", then ")}` : "",
      r ? `${r.total} practices on the list${r.booked + r.scheduling > 0 ? ` · ${r.booked + r.scheduling} being scheduled` : ""}${r.upcoming.length ? ` · first training ${m(r.upcoming[0].name)} (${digestDayLabel(r.upcoming[0].day)})` : ""}` : "No practice list yet",
    ];
    if (d.milestones.length || r) lines.push(setup.filter(Boolean).join("\n"));
  }
  if (r && d.kind !== "setup") {
    const change = (n: number | null) => (n ? ` (${signed(n)} this week)` : "");
    const roll = [
      `*Rollout*`,
      `*${r.live} of ${r.total}* practices live (${pct(r.live, r.total)}%)${change(r.liveChange)} · ${r.trained} trained${change(r.trainedChange)} · ${r.booked + r.scheduling} being scheduled · ${r.notStarted} not started`,
      r.wentLive.length ? `Went live this week: ${m(someNames(r.wentLive, 6))}` : "",
      r.trainedThisWeek.length ? `Trained this week: ${m(someNames(r.trainedThisWeek, 6))}` : "",
      r.upcoming.length ? `Training next: ${r.upcoming.slice(0, 5).map((u) => `${m(u.name)} (${digestDayLabel(u.day)})`).join(", ")}${r.upcoming.length > 5 ? ` and ${r.upcoming.length - 5} more` : ""}` : "",
      r.addedChange ? `Practices on the list: ${r.total} (${signed(r.addedChange)} this week)` : "",
      r.regions.length > 1 ? `By region: ${r.regions.slice(0, 6).map((g) => `${m(g.region)} ${g.live}/${g.total}`).join(" · ")}` : r.waves.length > 1 ? `By wave: ${r.waves.slice(0, 6).map((w) => `${m(/^\d+$/.test(w.wave) ? `Wave ${w.wave}` : w.wave)} ${w.live}/${w.total}`).join(" · ")}` : "",
    ];
    lines.push(roll.filter(Boolean).join("\n"));
  }
  // Orders are ours to see, not the customer's: Slack only.
  const o = d.orders;
  if (o && d.kind !== "setup") {
    const trend = o.lastMonth > 0 ? ` (${o.lastMonth} last month)` : "";
    const ord = [
      `*Orders* (team only)`,
      `${o.thisMonth} order${o.thisMonth === 1 ? "" : "s"} so far this month${trend} · ${o.ordering} practice${o.ordering === 1 ? "" : "s"} ordering`,
      o.top.length ? `Most this month: ${o.top.map((t) => `${m(t.name)} (${t.orders})`).join(", ")}` : "",
      o.tenth.length ? `Reached their 10th order this week: ${m(someNames(o.tenth, 5))}` : "",
      o.liveNoOrders.length ? `Live but no order yet (${o.liveNoOrders.length}): ${m(someNames(o.liveNoOrders, 5))}` : "",
      o.lapsed.length ? `No order in 30+ days (${o.lapsed.length}): ${m(someNames(o.lapsed, 5))}` : "",
    ];
    lines.push(ord.filter(Boolean).join("\n"));
  }
  // Sections the caller composed (already Slack-formatted), e.g. the RevOps item.
  lines.push(...extraSections);
  if (d.blocking.length) lines.push(`*Blocking (${d.blocking.length})*\n${bullets(d.blocking)}`);
  if (d.waitingOnCustomer.length) lines.push(`*Waiting on ${m(d.partnerName)} (${d.waitingOnCustomer.length})*\n${bullets(d.waitingOnCustomer)}`);
  if (d.undecided.length) lines.push(`*Marketing decisions still open (${d.undecided.length})*\n${bullets(d.undecided)}`);
  if (d.reviewRequests.length) lines.push(`*Requests waiting on their review (${d.reviewRequests.length})*\n${bullets(d.reviewRequests)}`);
  const doneNow = [...(d.kind === "setup" ? d.doneThisWeek.filter((x) => !d.milestones.some((ms) => ms.label === x)) : d.doneThisWeek), ...(d.otherDone > 0 ? [`${d.otherDone} other step${d.otherDone === 1 ? "" : "s"} completed`] : [])];
  if (doneNow.length) lines.push(`*This week*\n${bullets(doneNow)}`);
  if (d.newRequests) lines.push(`${d.newRequests} new request${d.newRequests === 1 ? "" : "s"} this week.`);
  if (d.topWin) lines.push(`*Win of the week*\n${m(d.topWin.text)} — ${m(d.topWin.by)}`);
  const text = `Weekly digest: ${d.partnerName}`;
  return {
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `📬 Weekly digest · ${d.partnerName}`.slice(0, 150), emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n\n").slice(0, 2900) } },
      { type: "context", elements: [{ type: "mrkdwn", text: `<${roomUrl}|Open the Partner Hub>` }] },
    ],
  };
}

/** Monday between 14:00 and 20:00 UTC (morning across US time zones). */
export function isDigestWindow(now: Date): boolean {
  return now.getUTCDay() === 1 && now.getUTCHours() >= 14 && now.getUTCHours() < 20;
}
