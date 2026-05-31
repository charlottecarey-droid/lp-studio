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
