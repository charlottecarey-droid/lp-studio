// Phase 4 — pure logic for the LP Studio blog content program (autonomous
// publishing). Dependency-free + heavily unit-tested: backlog-gap computation,
// cadence scheduling/spacing (respecting publish days + max-per-week + backlog
// target), the autonomous-vs-review decision + guardrail enforcement, and the
// topic status machine. The poller (blogProgramPoller.ts) and the routes
// (routes/lp/blog-program.ts) call into these; keeping the math here means it
// can be tested without a DB or an OpenAI client.
//
// OVERSIGHT IS PRESERVED BY CONSTRUCTION here:
//   - the autonomous pipeline only ever acts on PRE-APPROVED topics,
//   - it never exceeds max_autonomous_per_week,
//   - it never lets a post auto-publish unless autopublish_enabled is true,
//   - a draft that fails the quality gate is LEFT as a draft + flagged.

// ── Program settings (mirrors blog_program_settings) ─────────────────────────

export type ProgramMode = "review" | "autonomous";

export interface ProgramSettings {
  mode: ProgramMode;
  postsPerWeek: number;
  targetBacklogDays: number;
  /** Allowed weekdays for scheduling: 0=Sun … 6=Sat. */
  publishDays: number[];
  /** Local hour (0–23) scheduled posts go out at. */
  publishHour: number;
  /** Hard cap on autonomous output per rolling 7-day window. */
  maxAutonomousPerWeek: number;
  /** THE strongest gate — when false the pipeline never auto-publishes. */
  autopublishEnabled: boolean;
}

// Backlog window is intentionally bounded to 30–90 days (the program's stated
// operating range). Cadence + the per-week cap are also bounded so a bad value
// can never make the pipeline run away.
export const BACKLOG_DAYS_MIN = 30;
export const BACKLOG_DAYS_MAX = 90;
export const POSTS_PER_WEEK_MIN = 1;
export const POSTS_PER_WEEK_MAX = 14;
export const MAX_AUTONOMOUS_PER_WEEK_MIN = 0;
export const MAX_AUTONOMOUS_PER_WEEK_MAX = 14;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizePublishDays(v: unknown): number[] {
  if (!Array.isArray(v)) return [2, 4];
  const seen = new Set<number>();
  for (const x of v) {
    const n = typeof x === "number" ? x : Number(x);
    if (Number.isInteger(n) && n >= 0 && n <= 6) seen.add(n);
  }
  const out = [...seen].sort((a, b) => a - b);
  // Never leave the window empty — that would strand the scheduler. Default to
  // Tue/Thu, the program's default cadence days.
  return out.length ? out : [2, 4];
}

/** Coerce a raw DB/settings object into a safe, clamped ProgramSettings. */
export function normalizeProgramSettings(raw: Partial<Record<keyof ProgramSettings, unknown>>): ProgramSettings {
  const mode: ProgramMode = raw.mode === "autonomous" ? "autonomous" : "review";
  return {
    mode,
    postsPerWeek: clampInt(raw.postsPerWeek, POSTS_PER_WEEK_MIN, POSTS_PER_WEEK_MAX, 2),
    targetBacklogDays: clampInt(raw.targetBacklogDays, BACKLOG_DAYS_MIN, BACKLOG_DAYS_MAX, 45),
    publishDays: normalizePublishDays(raw.publishDays),
    publishHour: clampInt(raw.publishHour, 0, 23, 9),
    maxAutonomousPerWeek: clampInt(
      raw.maxAutonomousPerWeek,
      MAX_AUTONOMOUS_PER_WEEK_MIN,
      MAX_AUTONOMOUS_PER_WEEK_MAX,
      3,
    ),
    autopublishEnabled: raw.autopublishEnabled === true,
  };
}

// ── Topic status machine ─────────────────────────────────────────────────────

export type TopicStatus =
  | "suggested"
  | "approved"
  | "rejected"
  | "drafting"
  | "drafted"
  | "scheduled"
  | "published";

export const TOPIC_STATUSES: TopicStatus[] = [
  "suggested",
  "approved",
  "rejected",
  "drafting",
  "drafted",
  "scheduled",
  "published",
];

export function isTopicStatus(v: unknown): v is TopicStatus {
  return typeof v === "string" && (TOPIC_STATUSES as string[]).includes(v);
}

// Allowed forward transitions. The machine is deliberately small:
//   suggested → approved | rejected   (human or, in autonomous mode, the
//                                       pipeline only ever READS approved ones)
//   approved  → drafting → drafted → scheduled → published
//   rejected  is terminal.
// A suggested topic can also be re-suggested edits in place (no transition).
const TOPIC_TRANSITIONS: Record<TopicStatus, TopicStatus[]> = {
  suggested: ["approved", "rejected"],
  approved: ["drafting", "rejected"],
  rejected: [],
  drafting: ["drafted", "approved"], // generation failure falls back to approved for retry
  drafted: ["scheduled", "approved"], // can re-queue/regenerate
  scheduled: ["published", "drafted"], // unschedule back to drafted
  published: [],
};

/** True iff `to` is a permitted next status from `from`. Same status is a no-op
 * (allowed) so idempotent writes don't error. */
export function canTransitionTopic(from: TopicStatus, to: TopicStatus): boolean {
  if (from === to) return true;
  return TOPIC_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Backlog gap ──────────────────────────────────────────────────────────────

export interface BacklogState {
  /** Posts already scheduled (status='scheduled') with a future scheduledAt. */
  upcomingScheduled: number;
  /** Approved topics not yet drafted (status in approved|drafting). */
  approvedQueue: number;
  /** Drafted-but-not-yet-scheduled posts ready to place on the calendar. */
  draftedReady: number;
}

export interface BacklogGap {
  /** How many scheduled posts the backlog window+cadence wants total. */
  targetScheduled: number;
  /** Shortfall of scheduled posts vs target (>=0). */
  scheduledShortfall: number;
  /** True if we should top up topic recommendations (approved queue thin). */
  needsMoreTopics: boolean;
  /** True if there is any backlog work to do at all. */
  hasGap: boolean;
}

/**
 * Compute the backlog gap from the current state + settings. The target number
 * of scheduled posts is (postsPerWeek * targetBacklogDays / 7), i.e. enough to
 * keep the whole backlog window full at the configured cadence. We want the
 * approved-topic queue to stay at least as deep as the shortfall so the
 * pipeline always has pre-approved work to draft.
 */
export function computeBacklogGap(state: BacklogState, settings: ProgramSettings): BacklogGap {
  const targetScheduled = Math.max(
    0,
    Math.ceil((settings.postsPerWeek * settings.targetBacklogDays) / 7),
  );
  const scheduledShortfall = Math.max(0, targetScheduled - state.upcomingScheduled);
  // We need more topics when the work we still have to draft+schedule
  // (shortfall) outstrips the supply we can draw on without new topics
  // (approved queue + already-drafted-but-unscheduled posts).
  const availableSupply = state.approvedQueue + state.draftedReady;
  const needsMoreTopics = scheduledShortfall > availableSupply;
  const hasGap = scheduledShortfall > 0;
  return { targetScheduled, scheduledShortfall, needsMoreTopics, hasGap };
}

// ── Cadence scheduling / spacing ─────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Snap a date forward to the next allowed publish slot: the next day whose
 * weekday is in `publishDays`, at `publishHour` (local). If `after` already
 * falls on an allowed day before the hour, that same day is used; otherwise we
 * roll forward. Pure: operates on the Date's local components.
 */
export function nextPublishSlot(after: Date, publishDays: number[], publishHour: number): Date {
  const days = publishDays.length ? publishDays : [2, 4];
  // Start from the day of `after` at publishHour.
  const candidate = new Date(after.getTime());
  candidate.setHours(publishHour, 0, 0, 0);
  // If that slot is not strictly after `after`, move to the next day.
  if (candidate.getTime() <= after.getTime()) {
    candidate.setTime(candidate.getTime() + DAY_MS);
    candidate.setHours(publishHour, 0, 0, 0);
  }
  // Walk forward (max 14 days — guaranteed to hit an allowed weekday) until the
  // weekday is allowed.
  for (let i = 0; i < 14; i++) {
    if (days.includes(candidate.getDay())) return candidate;
    candidate.setTime(candidate.getTime() + DAY_MS);
    candidate.setHours(publishHour, 0, 0, 0);
  }
  return candidate;
}

export interface ScheduleSlotPlan {
  /** Index into the input list. */
  index: number;
  scheduledAt: Date;
}

/**
 * Plan publish slots for `count` posts, spacing them per cadence and respecting
 * the publish-day window + the per-week cap. Slots start strictly after
 * `lastScheduledAt` (or `now` if none) and never place more than
 * `maxPerWeek` posts inside any rolling 7-day window. Posts are spaced roughly
 * evenly across the week per `postsPerWeek` (a gap of ceil(7/postsPerWeek)
 * days), then snapped to the next allowed publish slot.
 *
 * `maxPerWeek` is the hard guardrail: even if cadence would allow more, the
 * planner stops adding to a 7-day window once it holds maxPerWeek posts and
 * rolls into the next window. Returns at most `count` slots.
 */
export function planScheduleSlots(args: {
  count: number;
  now: Date;
  lastScheduledAt: Date | null;
  settings: ProgramSettings;
  /** Already-scheduled future times (to honour the per-week cap across runs). */
  existingScheduledAt?: Date[];
}): ScheduleSlotPlan[] {
  const { count, now, lastScheduledAt, settings } = args;
  if (count <= 0) return [];
  const { publishDays, publishHour, postsPerWeek, maxAutonomousPerWeek } = settings;
  const gapDays = Math.max(1, Math.ceil(7 / Math.max(1, postsPerWeek)));

  // Seed the cursor: start spacing AFTER the latest of (now, lastScheduledAt).
  const startBase =
    lastScheduledAt && lastScheduledAt.getTime() > now.getTime() ? lastScheduledAt : now;
  let cursor = new Date(startBase.getTime());

  // Track all placed/known times so the rolling-week cap counts existing
  // scheduled posts too (never exceed maxAutonomousPerWeek live at once).
  const placedTimes: number[] = (args.existingScheduledAt ?? []).map((d) => d.getTime());

  const windowCount = (t: number): number =>
    placedTimes.filter((p) => Math.abs(p - t) < 7 * DAY_MS).length;

  const out: ScheduleSlotPlan[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 60 + 60) {
    guard++;
    const slot = nextPublishSlot(cursor, publishDays, publishHour);
    // Per-week cap guardrail: if this slot would make a rolling 7-day window
    // exceed maxAutonomousPerWeek, push the cursor past the window and retry.
    if (maxAutonomousPerWeek > 0 && windowCount(slot.getTime()) >= maxAutonomousPerWeek) {
      cursor = new Date(slot.getTime() + 7 * DAY_MS);
      continue;
    }
    if (maxAutonomousPerWeek <= 0) break; // cap of 0 → schedule nothing autonomously
    out.push({ index: out.length, scheduledAt: slot });
    placedTimes.push(slot.getTime());
    // Advance the cursor by the cadence gap before the next slot.
    cursor = new Date(slot.getTime() + gapDays * DAY_MS);
  }
  return out;
}

// ── Autonomous-vs-review decision + guardrails ───────────────────────────────

export interface TickInputs {
  settings: ProgramSettings;
  backlog: BacklogState;
  /** How many posts the pipeline has already produced in the rolling week. */
  autonomousThisWeek: number;
}

export interface TickPlan {
  mode: ProgramMode;
  /** Recommend new topics for a human to approve (both modes may do this). */
  recommendTopics: boolean;
  /** REVIEW mode: the poller stops here — never generates/schedules. */
  generateDrafts: boolean;
  /** Schedule drafted posts onto the calendar (autonomous only). */
  scheduleDrafts: boolean;
  /** Remaining autonomous budget for this week after the cap. */
  remainingWeeklyBudget: number;
  /** How many drafts the tick may produce this pass (gap ∧ budget). */
  draftBudget: number;
  reason: string;
}

/**
 * The single decision function the poller consults each tick. Encodes the
 * review-vs-autonomous distinction + every guardrail:
 *
 *   REVIEW mode (default): the poller may ONLY top up topic recommendations for
 *   a human to approve. It NEVER generates drafts or schedules autonomously.
 *
 *   AUTONOMOUS mode: if there is a backlog gap, the poller may (a) top up topic
 *   recommendations when the approved queue is thin, (b) generate drafts from
 *   already-APPROVED topics, and (c) schedule them — but only within the
 *   remaining weekly budget (maxAutonomousPerWeek − autonomousThisWeek). It
 *   never invents-and-publishes: drafting requires a pre-approved topic, and
 *   auto-publish is gated separately by autopublishEnabled (enforced by the
 *   publish poller, surfaced here as part of the reason for the audit log).
 */
export function decideTick(inputs: TickInputs): TickPlan {
  const { settings, backlog, autonomousThisWeek } = inputs;
  const gap = computeBacklogGap(backlog, settings);
  const remainingWeeklyBudget = Math.max(0, settings.maxAutonomousPerWeek - autonomousThisWeek);

  if (settings.mode === "review") {
    return {
      mode: "review",
      recommendTopics: gap.needsMoreTopics,
      generateDrafts: false,
      scheduleDrafts: false,
      remainingWeeklyBudget,
      draftBudget: 0,
      reason: gap.needsMoreTopics
        ? "review mode: approved queue thin — topping up topic recommendations for human approval only"
        : "review mode: backlog healthy — no action",
    };
  }

  // Autonomous mode.
  if (!gap.hasGap) {
    return {
      mode: "autonomous",
      recommendTopics: false,
      generateDrafts: false,
      scheduleDrafts: false,
      remainingWeeklyBudget,
      draftBudget: 0,
      reason: "autonomous mode: backlog at/above target — no action",
    };
  }
  if (remainingWeeklyBudget <= 0) {
    return {
      mode: "autonomous",
      recommendTopics: gap.needsMoreTopics,
      generateDrafts: false,
      scheduleDrafts: false,
      remainingWeeklyBudget,
      draftBudget: 0,
      reason: `autonomous mode: weekly cap reached (${autonomousThisWeek}/${settings.maxAutonomousPerWeek}) — only topping up recommendations`,
    };
  }
  const draftBudget = Math.min(remainingWeeklyBudget, gap.scheduledShortfall);
  return {
    mode: "autonomous",
    recommendTopics: gap.needsMoreTopics,
    generateDrafts: draftBudget > 0,
    scheduleDrafts: true,
    remainingWeeklyBudget,
    draftBudget,
    reason: `autonomous mode: backlog gap ${gap.scheduledShortfall}, weekly budget ${remainingWeeklyBudget} → drafting up to ${draftBudget}${
      settings.autopublishEnabled ? " (autopublish ON)" : " (autopublish OFF — scheduled only, human flips to publish)"
    }`,
  };
}

// ── Quality gate ─────────────────────────────────────────────────────────────

export interface QualityGateInput {
  title: string;
  bodyHtml: string;
  /** Plain text of the body for phrase scanning (caller strips HTML). */
  bodyText: string;
  /** Whether the pre-publish checklist passed (computed by caller). */
  checklistOk: boolean;
  /** Lowercased banned phrases (from blogAi.getBlogBannedPhrases). */
  bannedPhrases: string[];
}

export interface QualityGateResult {
  pass: boolean;
  /** Human-readable failures for the audit log + the "exception" flag. */
  failures: string[];
  bannedHits: string[];
}

// Minimum body length (words) for an autonomously-generated draft to be
// considered publishable. A near-empty generation is an obvious failure.
export const QUALITY_MIN_WORDS = 250;

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * The quality gate the autonomous pipeline runs on a generated draft BEFORE
 * scheduling it. A draft that fails is LEFT as a draft + flagged for human
 * review (the "exception" path) — it is never scheduled or published. Checks:
 *   - the pre-publish checklist (title/excerpt/cover/og/seo/slug/date),
 *   - banned-phrase / brand-voice validator (no fabricated-fluff phrases),
 *   - a minimum body length (catches empty/truncated generations).
 */
export function runQualityGate(input: QualityGateInput): QualityGateResult {
  const failures: string[] = [];
  if (!input.title.trim()) failures.push("missing title");
  if (!input.checklistOk) failures.push("pre-publish checklist incomplete");
  const words = wordCount(input.bodyText);
  if (words < QUALITY_MIN_WORDS) {
    failures.push(`body too short (${words} words < ${QUALITY_MIN_WORDS})`);
  }
  const haystack = `${input.title}\n${input.bodyText}`.toLowerCase();
  const bannedHits: string[] = [];
  for (const phrase of input.bannedPhrases) {
    const p = phrase.trim().toLowerCase();
    if (p && haystack.includes(p)) bannedHits.push(p);
  }
  if (bannedHits.length) {
    failures.push(`banned phrases: ${bannedHits.join(", ")}`);
  }
  return { pass: failures.length === 0, failures, bannedHits };
}
