/**
 * Where a Partner Hub is in the partnership, for the team: "rollout" (the
 * first 90 days) or "expansion" (after it). The names are INTERNAL: the
 * customer's hub only ever says "Partnership".
 *
 * A team member moves a hub on; nothing switches by itself. At the end of the
 * rollout the hub asks them to ("prompt"), and they can put that off
 * ("extend"). Also here: the hub's waves (a larger customer rolls out in
 * waves, each with its own dates) and which timeline the Overview leads with.
 *
 * All of it lives in the hub block's props, so it travels with the page. Pure.
 */

import { addWaveGroups, buildExpansionPlan, type ExpansionDecision } from "./partnerRoomExpansionPlan";

export const ROOM_STAGES = ["rollout", "expansion"] as const;
export type RoomStage = (typeof ROOM_STAGES)[number];
export const ROOM_TIMELINE_VIEWS = ["waves", "practices"] as const;
export type RoomTimelineView = (typeof ROOM_TIMELINE_VIEWS)[number];

export interface RoomWave {
  /** What the practice list calls this wave ("1", "Wave 1", "North"): practices are matched on it. */
  key: string;
  name: string;
  /** YYYY-MM-DD or "". */
  start: string;
  target: string;
}

export interface RoomStageInput {
  stage: RoomStage;
  timelineView: RoomTimelineView;
  waves: RoomWave[];
}

export interface RoomStageInfo extends RoomStageInput {
  /** When the hub moved to its current stage (YYYY-MM-DD); null while it is still in rollout. */
  stageSince: string | null;
  /** The team put off the move until this day (YYYY-MM-DD). */
  extendUntil: string | null;
  /** Day of the rollout, and its length. */
  day: number | null;
  /** What the day counts from: the hub's kickoff date, else the day the contract was signed (from the signed-accounts sheet). */
  dayFrom: "kickoff" | "contract" | null;
  rolloutDays: number;
  /** The rollout has run its length and the team hasn't moved the hub on or put it off: ask them. */
  prompt: boolean;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const day = (v: unknown) => (typeof v === "string" && DAY_RE.test(v.trim()) ? v.trim() : "");
const today = (now: Date) => now.toISOString().slice(0, 10);

/** The wave name a practice list uses, made comparable: "Wave 1", "wave 1" and "1" are the same wave. */
export function waveKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/^wave\s*/, "").replace(/\s+/g, " ");
}

function waves(raw: unknown): RoomWave[] {
  if (!Array.isArray(raw)) return [];
  const out: RoomWave[] = [];
  const seen = new Set<string>();
  for (const w of raw.slice(0, 24)) {
    if (!w || typeof w !== "object") continue;
    const r = w as Record<string, unknown>;
    const name = text(r.name, 60);
    const key = text(r.key, 60) || name;
    if (!key || seen.has(waveKey(key))) continue;
    seen.add(waveKey(key));
    out.push({ key, name: name || key, start: day(r.start), target: day(r.target) });
  }
  return out;
}

export function parseRoomStage(raw: unknown): { ok: true; value: RoomStageInput } | { ok: false; error: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.stage !== undefined && !(ROOM_STAGES as readonly unknown[]).includes(r.stage)) return { ok: false, error: "Unknown stage." };
  if (Array.isArray(r.waves) && r.waves.length > 24) return { ok: false, error: "A hub can have up to 24 waves." };
  const list = waves(r.waves);
  for (const w of list) if (w.start && w.target && w.target < w.start) return { ok: false, error: `${w.name} ends before it starts.` };
  return { ok: true, value: { stage: r.stage === "expansion" ? "expansion" : "rollout", timelineView: r.timelineView === "waves" ? "waves" : "practices", waves: list } };
}

function rolloutDay(kickoff: unknown, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof kickoff === "string" ? kickoff.trim() : "");
  if (!m) return null;
  const d = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86_400_000) + 1;
  return d >= 1 ? d : null;
}

/**
 * A signed date as the sheet writes it ("5/14/2026", "2026-05-14") as YYYY-MM-DD; "" when it isn't one.
 * Month first, as Salesforce exports it.
 */
export function contractDay(v: unknown): string {
  const t = typeof v === "string" ? v.trim() : "";
  if (DAY_RE.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 31) return "";
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export interface RoomStageContext {
  /** When the contract was signed (the sheet's date, any form contractDay reads). Counts the rollout when the hub has no kickoff date. */
  contractSigned?: string | null;
}

/** The hub's stage as stored, with whether to ask the team to move it on. */
export function roomStageFromProps(props: Record<string, unknown> | null | undefined, now: Date = new Date(), ctx: RoomStageContext = {}): RoomStageInfo {
  const p = props ?? {};
  const parsed = parseRoomStage(p);
  const base: RoomStageInput = parsed.ok ? parsed.value : { stage: "rollout", timelineView: "practices", waves: waves(p.waves) };
  const rolloutDays = typeof p.rolloutDays === "number" && p.rolloutDays > 0 ? Math.floor(p.rolloutDays) : 90;
  // From the kickoff when the team set one; else from the contract, so a hub made long after signing still asks.
  const fromKickoff = rolloutDay(p.kickoffDate, now);
  const fromContract = fromKickoff === null ? rolloutDay(contractDay(ctx.contractSigned), now) : null;
  const d = fromKickoff ?? fromContract;
  const dayFrom = fromKickoff !== null ? "kickoff" : fromContract !== null ? "contract" : null;
  const extendUntil = day(p.stageExtendUntil) || null;
  const prompt = base.stage === "rollout" && d !== null && d >= rolloutDays && !(extendUntil && extendUntil >= today(now));
  return { ...base, stageSince: base.stage === "rollout" ? null : day(p.stageSince) || null, extendUntil, day: d, dayFrom, rolloutDays, prompt };
}

type Block = { type?: unknown; props?: Record<string, unknown> };
const hub = (blocks: unknown): Block | null => (Array.isArray(blocks) ? ((blocks.find((b) => !!b && typeof b === "object" && (b as Block).type === "room-workspace") as Block | undefined) ?? null) : null);

export function roomStageInfo(blocks: unknown, now: Date = new Date(), ctx: RoomStageContext = {}): RoomStageInfo | null {
  const block = hub(blocks);
  return block ? roomStageFromProps(block.props, now, ctx) : null;
}

/** What the action plan needs when a hub moves past its rollout (see partnerRoomExpansionPlan). */
export interface RoomStagePlanContext {
  decisions?: Record<string, ExpansionDecision>;
  productSummary?: { ordering: number; lines: { line: string; practices: number }[] } | null;
  /** Plan keys the customer has ticked. */
  ticked?: Iterable<string>;
}

/**
 * Save the stage, the waves and the timeline choice. Moving to a new stage
 * records the day it happened and clears any "ask me later"; saving without
 * changing the stage keeps the day. Returns new blocks, or null when the page
 * has no hub.
 *
 * The action plan follows the stage: moving to expansion swaps the launch
 * checklist for the plan after it (the rollout plan is kept and comes back
 * on moving back); waves added while in expansion get their own group.
 */
export function setRoomStage(blocks: unknown, input: RoomStageInput, now: Date = new Date(), plan: RoomStagePlanContext = {}): unknown[] | null {
  const block = hub(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const was = roomStageFromProps(block.props, now);
  const props: Record<string, unknown> = { ...(block.props ?? {}), stage: input.stage, timelineView: input.timelineView, waves: input.waves };
  if (input.stage !== was.stage) {
    delete props.stageExtendUntil;
    if (input.stage === "rollout") delete props.stageSince;
    else props.stageSince = today(now);
  }
  if (input.stage === "expansion" && was.stage === "rollout") {
    // Keep the launch plan exactly as it was (only the first time, so a hub moved back and forth keeps the original).
    if (!Array.isArray(props.rolloutPlanGroups)) props.rolloutPlanGroups = props.planGroups ?? [];
    props.planGroups = buildExpansionPlan(props.rolloutPlanGroups, { decisions: plan.decisions, waves: input.waves, productSummary: plan.productSummary ?? null, ticked: plan.ticked, today: today(now) });
  } else if (input.stage === "rollout" && was.stage === "expansion" && Array.isArray(props.rolloutPlanGroups)) {
    props.planGroups = props.rolloutPlanGroups;
    delete props.rolloutPlanGroups;
  } else if (input.stage === "expansion") {
    props.planGroups = addWaveGroups(props.planGroups, input.waves, today(now));
  }
  return blocks.map((b) => (b === block ? { ...(b as object), props } : b));
}

/** "Not yet": keep the hub in rollout and ask again after `days` (30 by default, 7–180). */
export function extendRoomStage(blocks: unknown, days: unknown, now: Date = new Date()): unknown[] | null {
  const block = hub(blocks);
  if (!block || !Array.isArray(blocks)) return null;
  const n = Math.max(7, Math.min(180, Math.floor(Number(days)) || 30));
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n)).toISOString().slice(0, 10);
  return blocks.map((b) => (b === block ? { ...(b as object), props: { ...(block.props ?? {}), stageExtendUntil: until } } : b));
}
