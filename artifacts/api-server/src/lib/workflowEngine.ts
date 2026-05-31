import { pool } from "@workspace/db";
import { logger } from "./logger";
import { dispatchNotification, isStructuralDbError } from "./notificationDispatcher";
import { getNotificationTemplate, type NotificationChannel } from "./notificationTemplates";
import { getTenantPlan } from "./planFeatures";
import {
  advanceEnrollment,
  claimEnrollment,
  enroll,
  getEnabledWorkflowsForEvent,
  getWorkflow,
  isSendRead,
  type EnrollmentRow,
  type Workflow,
} from "./workflowStore";
import type { WorkflowStep } from "./workflowTypes";

/**
 * The workflow engine. Sits ABOVE the single-template dispatcher:
 * every SEND step calls `dispatchNotification` with a template key, so a
 * single-fire email routed through a one-step workflow is byte-identical to the
 * direct call it replaced.
 *
 *   enqueueWorkflowTrigger  — callsite entry point. If an enabled workflow
 *     matches the event, enroll the recipients and process the immediate
 *     (delay 0) first step inline. If NOTHING matches (or the lookup fails),
 *     run the caller's `fallback` — the existing direct dispatch. That fallback
 *     is the hard guarantee that disabling/breaking the workflow layer can never
 *     drop a transactional email.
 *
 *   runWorkflowSweep        — advances delayed / branching steps. Off the
 *     app.listen path (scheduled with a boot defer + interval). A short txn
 *     holds a pg_advisory_xact_lock (xact-scoped — auto-released on commit, no
 *     leak), leases a batch of due enrollments via FOR UPDATE SKIP LOCKED, then
 *     processes them OUTSIDE the txn.
 *
 * Idempotency: each step's send derives its dedupe from the enrollment
 * dedupe_key, so re-processing (crash recovery, lease expiry, double fire)
 * reuses the existing UNIQUE(dedupe_key, channel) idempotency on
 * notification_sends and never double-sends.
 */

/** Lease window: a claimed enrollment is pushed this far out so a second worker
 * won't grab it mid-process. A crashed worker's row simply becomes due again. */
const LEASE_MS = 5 * 60 * 1000;
/** Loop guard: an enrollment may execute at most this many steps. */
const MAX_STEPS = 50;
/** Max enrollments leased per sweep tick. */
const SWEEP_BATCH = 50;
/** Cross-instance advisory lock id; serializes concurrent sweeps. */
const SWEEP_LOCK_KEY = 478_921_589;
/** Boot defer + interval for the scheduler (mirrors the trial sweep cadence). */
const SWEEP_BOOT_DELAY_MS = 30_000;
const SWEEP_INTERVAL_MS = 60_000;

export interface WorkflowRecipient {
  appUserId: number | null;
  email: string | null;
  name?: string | null;
}

export interface EnqueueWorkflowTriggerInput {
  eventKey: string;
  tenantId: number | null;
  recipients: WorkflowRecipient[];
  context: Record<string, string | number | null | undefined>;
  /** Stable per-event prefix, e.g. `welcome:tenant:42`. */
  dedupeBase: string;
  /** Existing direct dispatch — run when no workflow matches or the lookup fails. */
  fallback: () => Promise<unknown> | unknown;
}

/** Mirror of the dispatcher's recipient → key mapping, for read-state lookups. */
function recipientKey(r: { appUserId: number | null; email: string | null }): string | null {
  if (r.appUserId != null) return `u${r.appUserId}`;
  if (r.email) return `e:${r.email.trim().toLowerCase()}`;
  return null;
}

/**
 * Per-step idempotency base for `notification_sends (dedupe_key, channel)`.
 *
 * Includes the workflow id. Enrollments are namespaced per workflow by the
 * UNIQUE(workflow_id, dedupe_key) constraint, so two workflows that fire on the
 * SAME event share an identical dedupe_key *value* (distinguished only by
 * workflow_id at the row level). Without the workflow id here, two such
 * workflows that each contain a step with the same id would derive the same
 * step dedupe base and collide on the notification_sends idempotency slot —
 * silently suppressing one workflow's send. The id keeps each workflow's step
 * sends (and the read-state lookups derived from them) independent.
 */
function stepDedupeBase(workflowId: number, enrollmentDedupeKey: string, stepId: string): string {
  return `${enrollmentDedupeKey}:w${workflowId}:s:${stepId}`;
}

function normalizeContext(
  ctx: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

/**
 * Callsite entry point. Routes an event through the workflow layer, falling back
 * to the caller's direct dispatch when the layer is absent or unavailable.
 *
 * Fallback contract (prevents double-sends):
 *   - getEnabledWorkflowsForEvent never throws (returns [] on any DB error), so
 *     a broken workflow layer looks like "no match" → fallback runs.
 *   - If at least one workflow matches, the engine OWNS the send. Per-workflow
 *     processing errors are logged but do NOT trigger fallback (the inline send
 *     is idempotent and the sweep retries) — running fallback here would
 *     double-send under a different dedupe key.
 */
export async function enqueueWorkflowTrigger(input: EnqueueWorkflowTriggerInput): Promise<void> {
  const recipients = input.recipients.filter((r) => r.appUserId != null || r.email);
  if (recipients.length === 0) return;

  const workflows = await getEnabledWorkflowsForEvent(input.eventKey);
  // Fail-safe: a workflow that matches the event but cannot actually send (zero
  // steps, only branch-control nodes, or every send step points at a template
  // that no longer exists) must NOT swallow the trigger. Treat such workflows
  // as "no match" so the caller's code-default hard-fallback still fires.
  const executable: Workflow[] = [];
  for (const wf of workflows) {
    if (await isWorkflowExecutable(wf)) executable.push(wf);
  }
  if (executable.length === 0) {
    await runFallback(input);
    return;
  }

  const context = normalizeContext(input.context);
  for (const workflow of executable) {
    const firstDelay = workflow.definition.steps[0]!.delayMs;
    for (const r of recipients) {
      const rk = recipientKey(r);
      if (!rk) continue;
      const dedupeKey = `${input.dedupeBase}:${rk}`;
      try {
        const enrollmentId = await enroll({
          workflowId: workflow.id,
          tenantId: input.tenantId,
          appUserId: r.appUserId,
          recipientEmail: r.email,
          recipientName: r.name ?? null,
          context,
          dedupeKey,
          firstStepDelayMs: firstDelay,
        });
        // null = duplicate trigger fire (already enrolled) — nothing to do.
        if (enrollmentId == null) continue;
        // Process the immediate first step inline; delayed first steps wait for the sweep.
        if (firstDelay === 0) {
          const claimed = await claimEnrollment(enrollmentId, LEASE_MS);
          if (claimed) await processClaimedEnrollment(claimed, workflow);
        }
      } catch (err) {
        // A structural DB error (missing notification_sends table/column) is a
        // broken deployment, not a transient blip — propagate it so awaited
        // callers (e.g. the trial sweep) abort loudly instead of silently
        // dropping every send. See isStructuralDbError.
        if (isStructuralDbError(err)) throw err;
        // Otherwise do NOT fall back: a matching workflow exists and may have
        // partially sent. The send is idempotent and the sweep will retry this
        // enrollment.
        logger.error(
          { err, eventKey: input.eventKey, workflowId: workflow.id },
          "[workflowEngine] enroll/process failed (will be retried by sweep)",
        );
      }
    }
  }
}

/**
 * A workflow can send only if it has at least one send step (non-empty
 * templateKey) whose template still resolves (code-owned or DB blank-slate).
 * An empty definition, a branch-only definition, or one whose every send step
 * references a deleted template would advance to "completed" without ever
 * dispatching — so we treat it as non-executable and let the caller's
 * code-default hard-fallback fire instead.
 */
async function isWorkflowExecutable(workflow: Workflow): Promise<boolean> {
  for (const step of workflow.definition.steps) {
    if (step.templateKey && (await getNotificationTemplate(step.templateKey))) return true;
  }
  return false;
}

async function runFallback(input: EnqueueWorkflowTriggerInput): Promise<void> {
  try {
    await input.fallback();
  } catch (err) {
    logger.error({ err, eventKey: input.eventKey }, "[workflowEngine] fallback dispatch failed");
    throw err;
  }
}

async function evaluateCondition(
  condition: NonNullable<WorkflowStep["condition"]>,
  snap: EnrollmentRow,
): Promise<boolean> {
  if (condition.type === "plan") {
    const plan = await getTenantPlan(snap.tenant_id);
    return plan === condition.plan;
  }
  // read / not_read: inspect the referenced step's in-app send.
  const rk = recipientKey({ appUserId: snap.app_user_id, email: snap.recipient_email });
  if (!rk || !condition.stepId) {
    // Can't resolve read state → treat as "not read".
    return condition.type === "not_read";
  }
  const refKey = `${stepDedupeBase(snap.workflow_id, snap.dedupe_key, condition.stepId)}:${rk}`;
  const read = await isSendRead(refKey);
  return condition.type === "read" ? read : !read;
}

function findStep(workflow: Workflow, stepId: string | null): WorkflowStep | null {
  const steps = workflow.definition.steps;
  if (stepId == null) return steps[0] ?? null;
  return steps.find((s) => s.id === stepId) ?? null;
}

/** Resolve the next step id after `step`, given the condition result. */
function nextStepId(workflow: Workflow, step: WorkflowStep, condResult: boolean): string | null {
  if (step.branch) return condResult ? step.branch.onTrue : step.branch.onFalse;
  if (step.next) return step.next;
  const steps = workflow.definition.steps;
  const idx = steps.findIndex((s) => s.id === step.id);
  return steps[idx + 1]?.id ?? null;
}

/**
 * Execute exactly one step of an ALREADY-CLAIMED enrollment, then schedule the
 * next. The caller (inline enqueue path or the sweep) is responsible for having
 * leased the row first. Sends are idempotent, so a redundant call is safe.
 */
async function processClaimedEnrollment(snap: EnrollmentRow, preloaded?: Workflow): Promise<void> {
  const workflow = preloaded ?? (await getWorkflow(snap.workflow_id));
  if (!workflow || !workflow.enabled || workflow.definition.steps.length === 0) {
    await advanceEnrollment(snap.id, {
      currentStepId: snap.current_step_id,
      status: "completed",
      nextRunDelayMs: 0,
      stepCount: snap.step_count,
    });
    return;
  }

  if (snap.step_count >= MAX_STEPS) {
    await advanceEnrollment(snap.id, {
      currentStepId: snap.current_step_id,
      status: "failed",
      nextRunDelayMs: 0,
      stepCount: snap.step_count,
      lastError: `exceeded max steps (${MAX_STEPS})`,
    });
    return;
  }

  const step = findStep(workflow, snap.current_step_id);
  if (!step) {
    await advanceEnrollment(snap.id, {
      currentStepId: snap.current_step_id,
      status: "completed",
      nextRunDelayMs: 0,
      stepCount: snap.step_count,
    });
    return;
  }

  let condResult = true;
  if (step.condition) condResult = await evaluateCondition(step.condition, snap);

  // SEND only when the step has a template and its gate (if any) passes.
  if (step.templateKey && condResult) {
    const channels: NotificationChannel[] | undefined = step.channels ?? undefined;
    await dispatchNotification({
      templateKey: step.templateKey,
      tenantId: snap.tenant_id,
      recipients: [
        { appUserId: snap.app_user_id, email: snap.recipient_email, name: snap.recipient_name },
      ],
      context: snap.context,
      dedupeBase: stepDedupeBase(snap.workflow_id, snap.dedupe_key, step.id),
      ...(channels ? { channels } : {}),
    });
  }

  const nextId = nextStepId(workflow, step, condResult);
  const nextStep = nextId ? findStep(workflow, nextId) : null;
  if (!nextStep) {
    await advanceEnrollment(snap.id, {
      currentStepId: step.id,
      status: "completed",
      nextRunDelayMs: 0,
      stepCount: snap.step_count + 1,
    });
    return;
  }

  await advanceEnrollment(snap.id, {
    currentStepId: nextStep.id,
    status: "active",
    nextRunDelayMs: nextStep.delayMs,
    stepCount: snap.step_count + 1,
  });
}

/**
 * Lease a batch of due enrollments inside a short advisory-locked txn, then
 * process them outside the txn. Returns counts for logging/tests.
 */
export async function runWorkflowSweep(): Promise<{ claimed: number; processed: number }> {
  const client = await pool.connect();
  let leased: EnrollmentRow[] = [];
  try {
    await client.query("BEGIN");
    // xact-scoped advisory lock: auto-released on COMMIT/ROLLBACK (no session
    // leak). try-variant so a second instance bails instead of piling up.
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1) AS locked",
      [SWEEP_LOCK_KEY],
    );
    if (!lock.rows[0]?.locked) {
      await client.query("ROLLBACK");
      return { claimed: 0, processed: 0 };
    }
    const r = await client.query<EnrollmentRow>(
      `UPDATE email_workflow_enrollments
          SET next_run_at = now() + ($2 || ' milliseconds')::interval, updated_at = now()
        WHERE id IN (
          SELECT id FROM email_workflow_enrollments
           WHERE status = 'active' AND next_run_at <= now()
           ORDER BY next_run_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT $1
        )
        RETURNING id, workflow_id, tenant_id, app_user_id, recipient_email, recipient_name,
                  context, current_step_id, status, next_run_at, dedupe_key, step_count, last_error`,
      [SWEEP_BATCH, String(LEASE_MS)],
    );
    leased = r.rows;
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    logger.error({ err }, "[workflowEngine] sweep lease txn failed");
    return { claimed: 0, processed: 0 };
  } finally {
    client.release();
  }

  let processed = 0;
  for (const snap of leased) {
    try {
      await processClaimedEnrollment(snap);
      processed += 1;
    } catch (err) {
      logger.error(
        { err, enrollmentId: snap.id },
        "[workflowEngine] processing enrollment failed (will retry after lease)",
      );
    }
  }
  return { claimed: leased.length, processed };
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Schedule the sweep OFF the app.listen path: a boot defer (so startup isn't
 * blocked) then a recurring interval. Both timers .unref() so they never keep
 * the process alive. Idempotent — a second call is a no-op.
 */
export function scheduleWorkflowSweep(): void {
  if (sweepTimer) return;
  const boot = setTimeout(() => {
    void runWorkflowSweep().catch((err) =>
      logger.error({ err }, "[workflowEngine] initial sweep failed"),
    );
    sweepTimer = setInterval(() => {
      void runWorkflowSweep().catch((err) =>
        logger.error({ err }, "[workflowEngine] scheduled sweep failed"),
      );
    }, SWEEP_INTERVAL_MS);
    sweepTimer.unref?.();
  }, SWEEP_BOOT_DELAY_MS);
  boot.unref?.();
}

/** Exported for tests. */
export const __test = { processClaimedEnrollment, evaluateCondition, nextStepId, LEASE_MS };
