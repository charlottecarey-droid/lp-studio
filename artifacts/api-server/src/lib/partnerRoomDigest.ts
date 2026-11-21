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
    // The practice list is in once we hold their practices, however it reached us (their upload, Salesforce, a sheet).
    const held = key === "practice-roster" && state.practices.total > 0;
    return { key, label, done: !!t || held || rowByKey.get(key)?.status === "done", at: t?.at ?? null, thisWeek: !!t && t.at.getTime() >= weekAgo };
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

/** A hex colour mixed toward white: `amount` 0 = the colour, 1 = white. For tints that sit behind text in the email. */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/**
 * The customer email. Built like a marketing email, not a report: one big
 * number up top, a row of figures, short sections with room to breathe, and a
 * single button. Tables and inline styles throughout, so it holds up in
 * Outlook and Gmail. `brandColor` is a hex for the header and the button;
 * `senderName` is who it is from ("Dandy").
 */
export function renderDigestEmail(d: DigestData, opts: { roomUrl: string; senderName: string; brandColor?: string; now?: Date }): { subject: string; html: string } {
  const color = /^#[0-9a-f]{6}$/i.test(opts.brandColor ?? "") ? (opts.brandColor as string) : "#0E1A16";
  const ink = "#0E1A16";
  const soft = "#5C6B61";
  const line = "#E7E7E0";
  const good = "#1AA35A";
  const wash = tint(color, 0.94);
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const r = d.rollout;
  const url = esc(opts.roomUrl);
  const week = digestDayLabel(isoDay(opts.now ?? new Date()));

  // Work we finished and are holding for their review comes first: it is the one thing only they can unblock.
  // The practice list is not "waiting" once we hold their practices, however it reached us.
  const waiting = [...d.reviewRequests.map((x) => `Review: ${x}`), ...d.waitingOnCustomer.filter((x) => !(r && /^upload your practice list$/i.test(x.trim()))), ...d.undecided.map((u) => `Decide: ${u}`)];
  const otherLine = d.otherDone > 0 ? [`${d.otherDone} other step${d.otherDone === 1 ? "" : "s"} completed`] : [];
  const doneLines = [...d.doneThisWeek, ...otherLine];

  const row = (inner: string, pad = "0 32px") => `<tr><td style="padding:${pad}">${inner}</td></tr>`;
  const heading = (title: string, sub = "") =>
    row(`<div style="font-size:19px;line-height:1.3;font-weight:700;letter-spacing:-.01em;color:${ink}">${esc(title)}</div>${sub ? `<div style="font-size:14px;line-height:1.5;color:${soft};margin-top:4px">${sub}</div>` : ""}`, "36px 32px 0");
  const rule = row(`<div style="height:1px;line-height:1px;font-size:0;background:${line}">&nbsp;</div>`, "32px 32px 0");
  const pill = (text: string, bg: string, fg: string) => `<span style="display:inline-block;padding:4px 10px;border-radius:99px;background:${bg};color:${fg};font-size:12px;font-weight:600;line-height:1.3">${esc(text)}</span>`;
  const bar = (percent: number, height = 10) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td style="background:${line};border-radius:99px;height:${height}px;line-height:${height}px;font-size:0"><table role="presentation" cellpadding="0" cellspacing="0" width="${Math.max(percent > 0 ? 3 : 0, Math.min(100, percent))}%" style="border-collapse:separate"><tr><td style="background:${good};border-radius:99px;height:${height}px;line-height:${height}px;font-size:0">&nbsp;</td></tr></table></td></tr></table>`;
  const tile = (n: number, label: string, change: number | null, last = false) =>
    `<td width="25%" valign="top" style="padding:0 ${last ? 0 : 8}px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};border-radius:12px"><tr><td align="center" style="padding:16px 6px 14px"><div style="font-size:28px;line-height:1;font-weight:700;letter-spacing:-.02em;color:${ink}">${n}</div><div style="font-size:11px;line-height:1.3;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${soft};margin-top:8px">${esc(label)}</div><div style="font-size:12px;line-height:1.3;font-weight:600;color:${change && change < 0 ? "#B4541A" : good};margin-top:6px">${change ? `${signed(change)} this week` : "&nbsp;"}</div></td></tr></table></td>`;
  const fact = (label: string, value: string) =>
    `<tr><td valign="top" style="padding:12px 0;border-bottom:1px solid ${line};font-size:13px;line-height:1.5;font-weight:600;color:${soft};width:38%">${esc(label)}</td><td valign="top" style="padding:12px 0;border-bottom:1px solid ${line};font-size:15px;line-height:1.5;color:${ink}">${value}</td></tr>`;
  const check = (label: string, done: boolean, note = "") =>
    `<tr><td valign="top" width="34" style="padding:9px 0"><div style="width:22px;height:22px;line-height:22px;border-radius:99px;text-align:center;font-size:13px;font-weight:700;${done ? `background:${good};color:#ffffff` : `border:1.5px solid #C9CEC5;color:#C9CEC5;line-height:19px`}">${done ? "&#10003;" : "&nbsp;"}</div></td><td valign="top" style="padding:10px 0;font-size:15px;line-height:1.45;color:${done ? ink : soft}">${esc(label)}${note}</td></tr>`;

  // ── The opening: one number that says where things stand. ──
  const reached = d.milestones.filter((x) => x.done).length;
  const showRollout = d.kind !== "setup" && !!r;
  const hero = showRollout
    ? `<div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${soft}">Rollout</div>
<div style="margin-top:10px;font-size:64px;line-height:1;font-weight:700;letter-spacing:-.03em;color:${ink}">${r!.live}<span style="font-size:24px;font-weight:600;letter-spacing:-.01em;color:${soft}"> of ${r!.total}</span></div>
<div style="margin-top:10px;font-size:17px;line-height:1.4;color:${ink}">practices live <span style="color:${soft}">· ${pct(r!.live, r!.total)}% of the way</span></div>
${r!.liveChange && r!.liveChange > 0 ? `<div style="margin-top:12px">${pill(`${signed(r!.liveChange)} this week`, tint(good, 0.86), "#0F7A42")}</div>` : ""}
<div style="margin-top:20px">${bar(pct(r!.live, r!.total))}</div>`
    : d.milestones.length
      ? `<div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${soft}">Getting set up</div>
<div style="margin-top:10px;font-size:64px;line-height:1;font-weight:700;letter-spacing:-.03em;color:${ink}">${reached}<span style="font-size:24px;font-weight:600;letter-spacing:-.01em;color:${soft}"> of ${d.milestones.length}</span></div>
<div style="margin-top:10px;font-size:17px;line-height:1.4;color:${ink}">setup milestones done</div>
<div style="margin-top:20px">${bar(pct(reached, d.milestones.length))}</div>`
      : `<div style="font-size:22px;line-height:1.3;font-weight:700;color:${ink}">Here is where things stand this week.</div>`;

  // ── Setup: the big milestones, done and next. Not every tick. ──
  const openMilestones = d.milestones.filter((x) => !x.done);
  const when = (at: Date | null) => (at ? ` <span style="color:${soft}">· ${esc(digestDayLabel(isoDay(at)))}</span>` : "");
  const setupRows = [
    ...d.milestones.filter((x) => x.done).map((x) => check(x.label, true, when(x.at))),
    ...(d.kits && d.kits.sent > 0 ? [check(`Welcome kits sent to ${d.kits.sent} of ${d.kits.total} practices`, true)] : []),
    ...openMilestones.slice(0, 2).map((x, i) => check(`${x.label}${i === 0 ? " · next" : ""}`, false)),
  ];
  const setupHtml =
    (setupRows.length ? heading("Milestones") + row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">${setupRows.join("")}</table>${otherLine.length ? `<div style="margin-top:8px;font-size:13px;color:${soft}">${esc(otherLine[0])} this week</div>` : ""}`) : "") +
    (r
      ? heading("Your practices") +
        row(
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:${wash};border-radius:12px"><tr><td style="padding:18px 20px;font-size:15px;line-height:1.6;color:${ink}"><b>${r.total}</b> on the list${r.regions.length > 1 ? ` across ${r.regions.length} regions` : ""}${r.booked + r.scheduling > 0 ? ` · ${r.booked + r.scheduling} being scheduled for training` : ""}${r.upcoming.length ? `<br>First training: ${esc(r.upcoming[0].name)} <span style="color:${soft}">· ${esc(digestDayLabel(r.upcoming[0].day))}</span>` : ""}</td></tr></table>`,
        )
      : "");

  // ── Rollout: the figures, what moved this week, what is next, and where. ──
  const facts = !r
    ? []
    : [
        r.wentLive.length ? fact("Went live this week", esc(someNames(r.wentLive, 6))) : "",
        r.trainedThisWeek.length ? fact("Trained this week", esc(someNames(r.trainedThisWeek, 6))) : "",
        r.upcoming.length ? fact("Training next", r.upcoming.slice(0, 5).map((u) => `${esc(u.name)} <span style="color:${soft}">· ${esc(digestDayLabel(u.day))}</span>`).join("<br>") + (r.upcoming.length > 5 ? `<br><span style="color:${soft}">and ${r.upcoming.length - 5} more</span>` : "")) : "",
        r.addedChange ? fact("Practices on the list", `${r.total} <span style="color:${soft}">(${signed(r.addedChange)} this week)</span>`) : "",
        r.scanners ? fact("Scanners", `${r.scanners.total} across ${r.scanners.practices} practice${r.scanners.practices === 1 ? "" : "s"}`) : "",
        r.doctors ? fact("Doctors on your roster", String(r.doctors.total)) : "",
      ].filter(Boolean);
  const groups = !r ? [] : r.regions.length > 1 ? r.regions.slice(0, 6).map((g) => ({ name: g.region, live: g.live, total: g.total })) : r.waves.length > 1 ? r.waves.slice(0, 6).map((w) => ({ name: /^\d+$/.test(w.wave) ? `Wave ${w.wave}` : w.wave, live: w.live, total: w.total })) : [];
  const groupTitle = r && r.regions.length > 1 ? "By region" : "By wave";
  const rolloutHtml = !r
    ? ""
    : row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tile(r.live, "Live", r.liveChange)}${tile(r.trained, "Trained", r.trainedChange)}${tile(r.booked + r.scheduling, "Scheduling", null)}${tile(r.notStarted, "Not started", null, true)}</tr></table>`, "24px 32px 0") +
      (facts.length ? heading("This week") + row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">${facts.join("")}</table>`) : "") +
      (groups.length
        ? heading(groupTitle, "Practices live in each") +
          row(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${groups
              .map((g) => `<tr><td valign="middle" width="30%" style="padding:9px 12px 9px 0;font-size:15px;color:${ink}">${esc(g.name)}</td><td valign="middle" style="padding:9px 0">${bar(pct(g.live, g.total), 8)}</td><td valign="middle" width="84" align="right" style="padding:9px 0 9px 12px;font-size:14px;color:${soft};white-space:nowrap"><b style="color:${ink}">${g.live}</b> of ${g.total}</td></tr>`)
              .join("")}</table>`,
          )
        : "");

  const alsoHtml = showRollout && doneLines.length ? heading("Also this week") + row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${doneLines.slice(0, 4).map((x) => check(x, true)).join("")}</table>`) : "";

  // ── What we need from them: the first three, then one link for the rest. Never a wall of chores. ──
  const shown = waiting.slice(0, 3);
  const waitingHtml = waiting.length
    ? rule +
      heading("Waiting on you", waiting.length > shown.length ? `The next ${shown.length} of ${waiting.length}` : "") +
      row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${shown
          .map((x) => `<tr><td style="padding:0 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};border-radius:10px"><tr><td style="padding:13px 16px;font-size:15px;line-height:1.4;color:${ink}">${esc(x)}</td><td width="34" align="right" style="padding:13px 16px 13px 0;font-size:16px;color:${soft}">&rarr;</td></tr></table></td></tr>`)
          .join("")}</table>${waiting.length > shown.length ? `<div style="margin-top:6px;font-size:14px"><a href="${url}" style="color:${color};font-weight:600;text-decoration:underline">See all ${waiting.length} in your hub</a></div>` : ""}`,
      )
    : "";

  const winHtml = d.topWin
    ? heading("Win of the week") + row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:${wash};border-radius:12px"><tr><td style="padding:20px 22px;font-size:17px;line-height:1.5;color:${ink}">&ldquo;${esc(d.topWin.text)}&rdquo;<div style="margin-top:8px;font-size:13px;color:${soft}">${esc(d.topWin.by)}</div></td></tr></table>`)
    : "";
  const nextHtml = d.nextMilestone ? heading("Coming up") + row(`<div style="margin-top:8px;font-size:15px;line-height:1.5;color:${ink}">${esc(d.nextMilestone)}</div>`) : "";

  const headline = showRollout
    ? `${r!.live} of ${r!.total} practices live${r!.liveChange && r!.liveChange > 0 ? ` (${signed(r!.liveChange)} this week)` : ""}`
    : d.milestones.length
      ? `${reached} of ${d.milestones.length} setup milestones done`
      : waiting.length
        ? `${waiting.length} waiting on you`
        : "";
  const preheader = [headline, waiting.length ? `${waiting.length} thing${waiting.length === 1 ? "" : "s"} waiting on you` : "Nothing is waiting on you"].filter(Boolean).join(" · ");
  const meta = [d.day !== null ? `Day ${d.day} of ${d.totalDays}` : null, d.phase, d.planTotal ? `${d.planDone} of ${d.planTotal} plan items complete` : null].filter(Boolean) as string[];

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Your weekly update</title></head><body style="margin:0;padding:0;background:#F3F4EF;font-family:${font};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4EF"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:${font}">
<tr><td style="background:${color};padding:30px 32px 28px;color:#ffffff">
<div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.7">Weekly update · ${esc(week)}</div>
<div style="font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-.02em;margin-top:10px">${esc(d.partnerName)} × ${esc(opts.senderName)}</div>
${meta.length ? `<div style="font-size:14px;line-height:1.5;opacity:.82;margin-top:8px">${meta.map(esc).join(" &nbsp;·&nbsp; ")}</div>` : ""}
</td></tr>
<tr><td align="center" style="padding:36px 32px 0">${hero}</td></tr>
${showRollout ? rolloutHtml : setupHtml}
${alsoHtml}
${winHtml}
${nextHtml}
${waitingHtml}
<tr><td align="center" style="padding:36px 32px 40px"><a href="${url}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1;padding:17px 34px;border-radius:12px">Open your Partner Hub</a></td></tr>
<tr><td style="padding:22px 32px 26px;background:#FAFAF7;border-top:1px solid ${line};font-size:12px;line-height:1.6;color:${soft}">You're getting this weekly update as part of the ${esc(d.partnerName)} and ${esc(opts.senderName)} partnership. Reply to this email to change who receives it.</td></tr>
</table></td></tr></table></body></html>`;
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
