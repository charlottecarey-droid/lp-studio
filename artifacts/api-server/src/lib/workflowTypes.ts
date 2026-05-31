import type { NotificationChannel } from "./notificationTemplates";

/**
 * Shared types + sanitizers for the email workflow composer (Task #589).
 *
 * A workflow is a trigger bound to an ordered list of steps
 * (`WorkflowDefinition.steps`). The engine (workflowEngine.ts) walks an
 * enrollment through these steps; each SEND step delegates to the existing
 * `dispatchNotification` primitive, so single-fire emails stay byte-identical.
 *
 * Two kinds of step:
 *   - SEND step: `templateKey` is non-empty. Dispatches that template
 *     (optionally gated by `condition`). A gated step whose condition is false
 *     is skipped (no send) and routes on as normal.
 *   - BRANCH (control) step: `templateKey` is "". Must carry a `condition` +
 *     `branch`; sends nothing, just routes to `branch.onTrue` / `branch.onFalse`.
 *
 * Routing after a step:
 *   - If `branch` is present, route by the condition result (null target = end).
 *   - Else if `next` is a non-empty step id, go there.
 *   - Else fall through to the next step in array order (end if last).
 */

export type WorkflowConditionType = "plan" | "read" | "not_read";

export interface WorkflowCondition {
  type: WorkflowConditionType;
  /** For type "plan": the plan the recipient's tenant must currently be on. */
  plan?: string;
  /** For type "read"/"not_read": the id of an earlier step whose send is checked. */
  stepId?: string;
}

export interface WorkflowBranch {
  onTrue: string | null;
  onFalse: string | null;
}

export interface WorkflowStep {
  id: string;
  /** Template to dispatch. "" = branch-only control node (no send). */
  templateKey: string;
  /** null = use the template's own channel set. */
  channels: NotificationChannel[] | null;
  /** Wait this long before executing this step (ms). */
  delayMs: number;
  condition: WorkflowCondition | null;
  branch: WorkflowBranch | null;
  /** Explicit next step id; null/"" = sequential array order. */
  next: string | null;
}

export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

// ─── Scheduled / audience trigger config (Task #626) ─────────────────────────
//
// Stored in email_workflow_triggers.config and interpreted by the producers in
// workflowProducers.ts. Platform scope, UTC v1.

/**
 * Audience role buckets. These partition the active app_users population:
 *   - superadmin — app_users.role = 'superadmin' (the canonical Dandy-operator
 *     flag; NOT the legacy `tenant_id IS NULL` heuristic, which is far broader).
 *   - admin      — not a superadmin, AND a member of some tenant with an
 *     is_admin role (tenant_members → tenant_roles.is_admin).
 *   - member     — everyone else (regular members + users with no membership).
 */
export type AudienceRole = "superadmin" | "admin" | "member";

const VALID_AUDIENCE_ROLES: AudienceRole[] = ["superadmin", "admin", "member"];

export interface AudienceFilter {
  role: AudienceRole;
  /**
   * Future-only additive: target specific tenant_roles by name. Accepted and
   * round-tripped today but NOT yet applied by the v1 resolver — present so the
   * stored config shape is forward-compatible.
   */
  role_names?: string[];
}

export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";

const VALID_FREQUENCIES: ScheduleFrequency[] = ["once", "daily", "weekly", "monthly"];

export interface ScheduledTriggerConfig extends AudienceFilter {
  frequency: ScheduleFrequency;
  /** Wall-clock time-of-day, "HH:MM" (24h), interpreted in `timezone`. */
  time: string;
  /**
   * IANA timezone (e.g. "America/New_York") the schedule's wall-clock time and
   * calendar boundaries resolve in. Omitted/default = "UTC" (backward compatible
   * with rows created before timezone support). DST is handled automatically.
   */
  timezone?: string;
  /** weekly only: 0 (Sun) – 6 (Sat). */
  dayOfWeek?: number;
  /** monthly only: 1 – 31 (clamped to the month length at fire time). */
  dayOfMonth?: number;
  /** once only: the calendar date "YYYY-MM-DD" (local to `timezone`) the single fire lands on. */
  date?: string;
}

export type AudienceTriggerConfig = AudienceFilter;

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate an IANA timezone name. Missing/empty defaults to "UTC" (backward
 * compatible). A present-but-unknown zone returns null so a malformed row fails
 * closed (never silently fires at a guessed time) — consistent with the other
 * schedule sanitizers.
 */
function sanitizeTimezone(raw: unknown): string | null {
  if (raw == null || raw === "") return "UTC";
  if (typeof raw !== "string") return null;
  const tz = raw.trim();
  if (!tz) return "UTC";
  try {
    // Throws RangeError for an unknown/invalid IANA zone.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

function sanitizeRoleNames(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const names = raw
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.trim())
    .filter(Boolean);
  return names.length ? Array.from(new Set(names)) : undefined;
}

function sanitizeRole(raw: unknown): AudienceRole | null {
  return VALID_AUDIENCE_ROLES.includes(raw as AudienceRole) ? (raw as AudienceRole) : null;
}

/**
 * Parse a stored audience-trigger config. Returns null if the role is missing /
 * invalid — the producer treats that as "nothing to enroll" rather than guessing
 * an audience (fail-closed: never blast an unintended population).
 */
export function parseAudienceConfig(raw: unknown): AudienceTriggerConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const role = sanitizeRole(o.role);
  if (!role) return null;
  const roleNames = sanitizeRoleNames(o.role_names);
  return roleNames ? { role, role_names: roleNames } : { role };
}

/**
 * Parse a stored scheduled-trigger config. Returns null on any invalid/missing
 * required field (role, frequency, well-formed UTC time, and the per-frequency
 * day/date) so a malformed row never fires against a guessed audience or time.
 */
export function parseScheduledConfig(raw: unknown): ScheduledTriggerConfig | null {
  const audience = parseAudienceConfig(raw);
  if (!audience) return null;
  const o = raw as Record<string, unknown>;
  const frequency = VALID_FREQUENCIES.includes(o.frequency as ScheduleFrequency)
    ? (o.frequency as ScheduleFrequency)
    : null;
  if (!frequency) return null;
  const time = typeof o.time === "string" && HHMM_RE.test(o.time) ? o.time : null;
  if (!time) return null;
  const timezone = sanitizeTimezone(o.timezone);
  if (!timezone) return null; // present-but-invalid zone → fail closed
  const cfg: ScheduledTriggerConfig = { ...audience, frequency, time, timezone };
  if (frequency === "weekly") {
    const d = Number(o.dayOfWeek);
    if (!Number.isInteger(d) || d < 0 || d > 6) return null;
    cfg.dayOfWeek = d;
  }
  if (frequency === "monthly") {
    const d = Number(o.dayOfMonth);
    if (!Number.isInteger(d) || d < 1 || d > 31) return null;
    cfg.dayOfMonth = d;
  }
  if (frequency === "once") {
    const date = typeof o.date === "string" && YMD_RE.test(o.date) ? o.date : null;
    // Round-trip the components through UTC to reject impossible calendar dates
    // (e.g. 2026-02-31), which Date.parse() would silently normalise instead of
    // rejecting — that would let a malformed row fire on an unintended day.
    if (!date) return null;
    const [yy, mm, dd] = date.split("-").map((n) => Number(n));
    const utc = new Date(Date.UTC(yy!, mm! - 1, dd!));
    if (
      utc.getUTCFullYear() !== yy ||
      utc.getUTCMonth() !== mm! - 1 ||
      utc.getUTCDate() !== dd
    ) {
      return null;
    }
    cfg.date = date;
  }
  return cfg;
}

const VALID_CHANNELS: NotificationChannel[] = ["email", "in_app"];
const VALID_CONDITION_TYPES: WorkflowConditionType[] = ["plan", "read", "not_read"];

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function sanitizeChannels(raw: unknown): NotificationChannel[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const valid = raw.filter(
    (c): c is NotificationChannel => typeof c === "string" && VALID_CHANNELS.includes(c as NotificationChannel),
  );
  return valid.length ? Array.from(new Set(valid)) : null;
}

function sanitizeCondition(raw: unknown): WorkflowCondition | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = asString(o.type) as WorkflowConditionType;
  if (!VALID_CONDITION_TYPES.includes(type)) return null;
  if (type === "plan") {
    const plan = asString(o.plan);
    if (!plan) return null;
    return { type, plan };
  }
  const stepId = asString(o.stepId);
  if (!stepId) return null;
  return { type, stepId };
}

function sanitizeBranch(raw: unknown): WorkflowBranch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const onTrue = asString(o.onTrue) || null;
  const onFalse = asString(o.onFalse) || null;
  if (onTrue == null && onFalse == null) return null;
  return { onTrue, onFalse };
}

function sanitizeStep(raw: unknown, index: number): WorkflowStep | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.id) || `s${index + 1}`;
  const templateKey = asString(o.templateKey);
  const condition = sanitizeCondition(o.condition);
  const branch = sanitizeBranch(o.branch);
  const delayRaw = Number(o.delayMs);
  const delayMs = Number.isFinite(delayRaw) && delayRaw > 0 ? Math.floor(delayRaw) : 0;
  // A control node (no template) is only meaningful with a condition + branch.
  if (!templateKey && !(condition && branch)) return null;
  return {
    id,
    templateKey,
    channels: sanitizeChannels(o.channels),
    delayMs,
    condition,
    branch,
    next: asString(o.next) || null,
  };
}

/**
 * Parse + sanitize a stored `definition` jsonb into a safe WorkflowDefinition.
 * Drops malformed steps so a hand-edited / corrupt row can never crash the
 * engine. Duplicate step ids are de-duplicated (first wins).
 */
export function parseWorkflowDefinition(raw: unknown): WorkflowDefinition {
  const stepsRaw = (raw as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(stepsRaw)) return { steps: [] };
  const seen = new Set<string>();
  const steps: WorkflowStep[] = [];
  stepsRaw.forEach((s, i) => {
    const step = sanitizeStep(s, i);
    if (!step) return;
    if (seen.has(step.id)) return;
    seen.add(step.id);
    steps.push(step);
  });
  return { steps };
}

/**
 * Validate a definition for SAVE (stricter than parse): returns the cleaned
 * definition or an error message. Used by the composer save route so operators
 * get feedback instead of silently dropped steps.
 */
export function validateWorkflowDefinition(
  raw: unknown,
): { ok: true; definition: WorkflowDefinition } | { ok: false; error: string } {
  const stepsRaw = (raw as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(stepsRaw)) return { ok: false, error: "definition.steps must be an array" };
  if (stepsRaw.length > 50) return { ok: false, error: "a workflow may have at most 50 steps" };
  const ids = new Set<string>();
  const steps: WorkflowStep[] = [];
  for (let i = 0; i < stepsRaw.length; i++) {
    const step = sanitizeStep(stepsRaw[i], i);
    if (!step) {
      return { ok: false, error: `step ${i + 1} is invalid (needs a template, or a condition + branch)` };
    }
    if (ids.has(step.id)) return { ok: false, error: `duplicate step id "${step.id}"` };
    ids.add(step.id);
    steps.push(step);
  }
  // Fail-safe: a workflow must be able to send. A definition of zero steps, or
  // one made up purely of branch-control nodes (every templateKey blank), would
  // silently swallow the trigger with no email going out. Require at least one
  // step that actually sends (a non-empty templateKey).
  if (!steps.some((s) => s.templateKey)) {
    return { ok: false, error: "a workflow needs at least one step that sends a template" };
  }
  // Referential integrity: branch / next / condition.stepId must point at real steps.
  for (const step of steps) {
    if (step.branch) {
      for (const target of [step.branch.onTrue, step.branch.onFalse]) {
        if (target && !ids.has(target)) {
          return { ok: false, error: `step "${step.id}" branches to unknown step "${target}"` };
        }
      }
    }
    if (step.next && !ids.has(step.next)) {
      return { ok: false, error: `step "${step.id}" routes to unknown step "${step.next}"` };
    }
    if (step.condition && (step.condition.type === "read" || step.condition.type === "not_read")) {
      if (step.condition.stepId && !ids.has(step.condition.stepId)) {
        return { ok: false, error: `step "${step.id}" reads unknown step "${step.condition.stepId}"` };
      }
    }
  }
  return { ok: true, definition: { steps } };
}
