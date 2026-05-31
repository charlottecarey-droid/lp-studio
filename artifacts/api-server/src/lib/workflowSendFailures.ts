import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Recipient-failure safety-net (Task #625).
 *
 * The single-template dispatcher (notificationDispatcher.ts) releases a step's
 * idempotency claim and logs when a send fails transiently BEFORE any delivery —
 * the recipient is otherwise silently skipped with no durable trace. This module
 * owns the `workflow_send_failures` ledger that records those drops, the
 * superadmin read of them, and the resolve write a retry uses to clear one.
 *
 * Retry idempotency lives elsewhere (workflowEngine.retryWorkflowSendFailure):
 * a row stores the dispatcher `dedupeBase` for the step, so a retry re-derives
 * the SAME per-recipient dedupe_key and the existing UNIQUE(dedupe_key, channel)
 * on notification_sends prevents a double-send.
 *
 * This module imports nothing from the dispatcher/engine so it can be a leaf
 * dependency of both (the dispatcher records failures; the engine reads/retries
 * them) without an import cycle.
 */

export type SendFailureChannel = "email" | "in_app";

export interface RecordSendFailureInput {
  workflowId: number;
  enrollmentId: number | null;
  stepId: string;
  tenantId: number | null;
  appUserId: number | null;
  recipientEmail: string | null;
  recipientName: string | null;
  channel: SendFailureChannel;
  templateKey: string;
  /** Dispatcher dedupeBase for the step (per-recipient key is built from it). */
  dedupeBase: string;
  /** Full per-recipient idempotency key (dedupeBase + recipient key). */
  dedupeKey: string;
  context: Record<string, string>;
  error: string;
}

export interface SendFailureRow {
  id: number;
  workflow_id: number;
  enrollment_id: number | null;
  step_id: string;
  tenant_id: number | null;
  app_user_id: number | null;
  recipient_email: string | null;
  recipient_name: string | null;
  channel: SendFailureChannel;
  template_key: string;
  dedupe_base: string;
  dedupe_key: string;
  context: Record<string, string>;
  error: string | null;
  attempt_count: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const FAILURE_COLS = `id, workflow_id, enrollment_id, step_id, tenant_id, app_user_id,
  recipient_email, recipient_name, channel, template_key, dedupe_base, dedupe_key,
  context, error, attempt_count, resolved_at, created_at, updated_at`;

/**
 * Record a transient per-recipient send failure. UPSERT on (dedupe_key, channel)
 * so a send that keeps failing bumps attempt_count instead of piling up rows;
 * re-failing also clears any prior resolved_at so the row resurfaces.
 *
 * BEST-EFFORT BY CONTRACT: this runs inside the dispatcher's catch blocks, which
 * must never throw out of the sweep (a thrown error here would skip the rest of
 * the recipients in the run). All errors — including a missing ledger table on a
 * drifted DB — are logged and swallowed; the safety-net failing must not break
 * the send loop it is trying to protect.
 */
export async function recordWorkflowSendFailure(input: RecordSendFailureInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO workflow_send_failures
         (workflow_id, enrollment_id, step_id, tenant_id, app_user_id,
          recipient_email, recipient_name, channel, template_key,
          dedupe_base, dedupe_key, context, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (dedupe_key, channel) DO UPDATE SET
         enrollment_id = EXCLUDED.enrollment_id,
         step_id       = EXCLUDED.step_id,
         template_key  = EXCLUDED.template_key,
         dedupe_base   = EXCLUDED.dedupe_base,
         context       = EXCLUDED.context,
         error         = EXCLUDED.error,
         attempt_count = workflow_send_failures.attempt_count + 1,
         resolved_at   = NULL,
         updated_at    = now()`,
      [
        input.workflowId,
        input.enrollmentId,
        input.stepId,
        input.tenantId,
        input.appUserId,
        input.recipientEmail,
        input.recipientName,
        input.channel,
        input.templateKey,
        input.dedupeBase,
        input.dedupeKey,
        JSON.stringify(input.context),
        input.error,
      ],
    );
  } catch (err) {
    logger.error(
      { err, dedupeKey: input.dedupeKey, channel: input.channel },
      "[workflowSendFailures] failed to record send failure (safety-net swallowed)",
    );
  }
}

/** Superadmin list. Defaults to unresolved failures, newest first. */
export async function listWorkflowSendFailures(opts?: {
  resolved?: boolean;
  limit?: number;
}): Promise<SendFailureRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000);
  const where =
    opts?.resolved === undefined
      ? "WHERE resolved_at IS NULL"
      : opts.resolved
        ? "WHERE resolved_at IS NOT NULL"
        : "WHERE resolved_at IS NULL";
  const r = await pool.query<SendFailureRow>(
    `SELECT ${FAILURE_COLS} FROM workflow_send_failures
      ${where}
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows;
}

export async function getWorkflowSendFailure(id: number): Promise<SendFailureRow | null> {
  const r = await pool.query<SendFailureRow>(
    `SELECT ${FAILURE_COLS} FROM workflow_send_failures WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

/** Clear a failure once a retry has delivered (or confirmed an existing delivery). */
export async function markWorkflowSendFailureResolved(id: number): Promise<void> {
  await pool.query(
    `UPDATE workflow_send_failures SET resolved_at = now(), updated_at = now() WHERE id = $1`,
    [id],
  );
}
