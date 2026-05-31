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
import { produceScheduledEnrollments, produceAudienceEnrollments } from "./workflowProducers";
import {
  getWorkflowSendFailure,
  markWorkflowSendFailureResolved,
} from "./workflowSendFailures";

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
      // Safety-net (Task #625): a transient per-recipient send drop here is
      // recorded to workflow_send_failures for the superadmin retry queue.
      failureLedger: { workflowId: snap.workflow_id, stepId: step.id, enrollmentId: snap.id },
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

/**
 * Manually retry a recorded per-recipient send failure (Task #625).
 *
 * Re-runs the original step's dispatch with the SAME stored dedupeBase, so the
 * rebuilt per-recipient dedupe_key matches the original send exactly. The
 * existing UNIQUE(dedupe_key, channel) on notification_sends is the guard
 * against a double-send:
 *   - "sent"    — the claim was free and the send succeeded → resolve.
 *   - "deduped" — a delivery already exists for this dedupe_key (the recipient
 *                 DID receive it; the claim hit the conflict) → resolve, no
 *                 second copy.
 *   - "failed"  — still couldn't deliver; the ledger row's attempt_count was
 *                 bumped by the dispatcher's capture path and it stays unresolved.
 *
 * CRITICAL: a dispatch "deduped" outcome is NOT proof of delivery. The original
 * failure path releases its claim with a best-effort DELETE that is swallowed on
 * error — so a prior attempt can leave a STALE 'pending' row occupying the
 * dedupe slot with no email ever sent. A naive resolve-on-deduped would then
 * silently clear an undelivered failure, defeating the whole safety-net. We
 * therefore inspect the conflicting notification_sends row: only a row that is
 * actually 'sent' counts as a delivery; a stale 'pending' claim is released and
 * the send is retried once. (in_app rows are only ever written 'sent', so they
 * naturally satisfy the 'sent' check.)
 */
export async function retryWorkflowSendFailure(
  id: number,
): Promise<{ ok: boolean; outcome: "sent" | "deduped" | "failed" | "not_found" }> {
  // Serialize all retries of THIS failure row so two concurrent retry clicks can
  // never both run the stale-claim repair and double-send. A transaction-scoped
  // advisory lock keyed by the ledger id is held for the whole retry: it is
  // auto-released on COMMIT/ROLLBACK (no leak risk even on the -pooler endpoint,
  // unlike a session lock) and — being an advisory lock, not a row lock — it does
  // NOT block the dispatcher's own writes to notification_sends /
  // workflow_send_failures on other pooled connections, so there is no deadlock.
  // By the time a waiting caller acquires the lock the prior holder's tx has
  // committed, so its resolved_at write is already visible.
  const lockClient = await pool.connect();
  try {
    await lockClient.query("BEGIN");
    await lockClient.query(
      `SELECT pg_advisory_xact_lock(hashtext('workflow_send_failure_retry'), $1::int)`,
      [id],
    );
    const outcome = await runWorkflowSendFailureRetry(id);
    await lockClient.query("COMMIT");
    return outcome;
  } catch (err) {
    await lockClient.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    lockClient.release();
  }
}

/**
 * Core retry logic, run while the caller holds the per-row advisory lock so it
 * executes serially for a given failure id. See `retryWorkflowSendFailure`.
 */
async function runWorkflowSendFailureRetry(
  id: number,
): Promise<{ ok: boolean; outcome: "sent" | "deduped" | "failed" | "not_found" }> {
  const row = await getWorkflowSendFailure(id);
  if (!row) return { ok: false, outcome: "not_found" };
  if (row.resolved_at) return { ok: true, outcome: "deduped" };

  const dispatch = () =>
    dispatchNotification({
      templateKey: row.template_key,
      tenantId: row.tenant_id,
      recipients: [
        { appUserId: row.app_user_id, email: row.recipient_email, name: row.recipient_name },
      ],
      context: row.context,
      dedupeBase: row.dedupe_base,
      channels: [row.channel],
      failureLedger: {
        workflowId: row.workflow_id,
        stepId: row.step_id,
        enrollmentId: row.enrollment_id,
      },
    });

  const result = await dispatch();

  const delivered = row.channel === "email" ? result.emailsSent : result.inAppCreated;
  if (delivered > 0) {
    await markWorkflowSendFailureResolved(id);
    return { ok: true, outcome: "sent" };
  }

  // A conflict on the dedupe slot does NOT by itself mean the recipient received
  // the send — inspect the occupying row before resolving.
  if (result.deduped > 0) {
    const existing = await pool.query<{ status: string }>(
      `SELECT status FROM notification_sends WHERE dedupe_key=$1 AND channel=$2 LIMIT 1`,
      [row.dedupe_key, row.channel],
    );
    const status = existing.rows[0]?.status;
    // Genuine delivery already on record — resolve without a second copy.
    if (status === "sent") {
      await markWorkflowSendFailureResolved(id);
      return { ok: true, outcome: "deduped" };
    }
    // Stale 'pending' claim from a prior failed attempt whose claim-release
    // DELETE also failed. Release it and retry the send exactly once — this is
    // the only path that can recover such an orphaned claim, since the dispatcher
    // sweep is itself blocked by the lingering row. Re-send ONLY if our DELETE
    // actually removed the stale row; if it removed nothing the slot changed out
    // from under us, so re-check rather than blindly sending again.
    if (status === "pending") {
      const del = await pool.query(
        `DELETE FROM notification_sends WHERE dedupe_key=$1 AND channel=$2 AND status='pending'`,
        [row.dedupe_key, row.channel],
      );
      if ((del.rowCount ?? 0) > 0) {
        const retry = await dispatch();
        const reDelivered = row.channel === "email" ? retry.emailsSent : retry.inAppCreated;
        if (reDelivered > 0) {
          await markWorkflowSendFailureResolved(id);
          return { ok: true, outcome: "sent" };
        }
        return { ok: false, outcome: "failed" };
      }
      // The stale row was already cleared/replaced — if a real delivery now
      // occupies the slot, resolve; otherwise leave it for another attempt.
      const recheck = await pool.query<{ status: string }>(
        `SELECT status FROM notification_sends WHERE dedupe_key=$1 AND channel=$2 LIMIT 1`,
        [row.dedupe_key, row.channel],
      );
      if (recheck.rows[0]?.status === "sent") {
        await markWorkflowSendFailureResolved(id);
        return { ok: true, outcome: "deduped" };
      }
      return { ok: false, outcome: "failed" };
    }
    // Row vanished between dispatch and lookup (concurrent retry/cleanup) — treat
    // as not delivered; the ledger row stays unresolved for another attempt.
    return { ok: false, outcome: "failed" };
  }
  return { ok: false, outcome: "failed" };
}

/**
 * One full scheduler tick: run the scheduled + audience producers (Task #626) to
 * mint any due enrollments, THEN run the engine sweep that drives every active
 * enrollment's next step. Order matters — producing first means an
 * immediate-first-step (delay 0) enrollment minted this tick is also processed
 * this tick. Each producer is isolated in its own try/catch so one failing never
 * starves the others or the engine. Returns counts for logging/tests.
 */
export async function runWorkflowTick(now: Date = new Date()): Promise<{
  scheduled: number;
  audience: number;
  sweep: { claimed: number; processed: number };
}> {
  let scheduled = 0;
  let audience = 0;
  try {
    scheduled = (await produceScheduledEnrollments(now)).enrolled;
  } catch (err) {
    logger.error({ err }, "[workflowEngine] scheduled producer failed");
  }
  try {
    audience = (await produceAudienceEnrollments()).enrolled;
  } catch (err) {
    logger.error({ err }, "[workflowEngine] audience producer failed");
  }
  const sweep = await runWorkflowSweep();
  return { scheduled, audience, sweep };
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Schedule the tick OFF the app.listen path: a boot defer (so startup isn't
 * blocked) then a recurring interval. Both timers .unref() so they never keep
 * the process alive. Idempotent — a second call is a no-op.
 */
export function scheduleWorkflowSweep(): void {
  if (sweepTimer) return;
  const boot = setTimeout(() => {
    void runWorkflowTick().catch((err) =>
      logger.error({ err }, "[workflowEngine] initial tick failed"),
    );
    sweepTimer = setInterval(() => {
      void runWorkflowTick().catch((err) =>
        logger.error({ err }, "[workflowEngine] scheduled tick failed"),
      );
    }, SWEEP_INTERVAL_MS);
    sweepTimer.unref?.();
  }, SWEEP_BOOT_DELAY_MS);
  boot.unref?.();
}

/** Exported for tests. */
export const __test = { processClaimedEnrollment, evaluateCondition, nextStepId, LEASE_MS };
