import { pool } from "@workspace/db";
import { logger } from "./logger";
import { parseWorkflowDefinition, type WorkflowDefinition } from "./workflowTypes";

/**
 * DB access layer for the email workflow composer. Owns all reads
 * and writes against email_workflow_triggers / email_workflows /
 * email_workflow_enrollments. The engine (workflowEngine.ts) and the superadmin
 * routes both go through here so the SQL lives in one place.
 *
 * Platform scope only in v1 — every query is implicitly scope='platform'.
 */

export interface TriggerRow {
  key: string;
  name: string;
  description: string;
  trigger_type: "event" | "scheduled" | "audience";
  event_key: string | null;
  config: Record<string, unknown>;
  is_system: boolean;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface WorkflowRow {
  id: number;
  key: string;
  name: string;
  description: string;
  trigger_key: string;
  enabled: boolean;
  definition: unknown;
  is_system: boolean;
  locked: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface Workflow extends Omit<WorkflowRow, "definition"> {
  definition: WorkflowDefinition;
}

export interface EnrollmentRow {
  id: number;
  workflow_id: number;
  tenant_id: number | null;
  app_user_id: number | null;
  recipient_email: string | null;
  recipient_name: string | null;
  context: Record<string, string>;
  current_step_id: string | null;
  status: "active" | "completed" | "cancelled" | "failed";
  next_run_at: string;
  dedupe_key: string;
  step_count: number;
  last_error: string | null;
}

function toWorkflow(row: WorkflowRow): Workflow {
  return { ...row, definition: parseWorkflowDefinition(row.definition) };
}

const WORKFLOW_COLS = `id, key, name, description, trigger_key, enabled,
  definition, is_system, locked, updated_at, updated_by`;

// ─── Triggers ────────────────────────────────────────────────────────────────

export async function listTriggers(): Promise<TriggerRow[]> {
  const r = await pool.query<TriggerRow>(
    `SELECT key, name, description, trigger_type, event_key, config,
            is_system, enabled, updated_at, updated_by
       FROM email_workflow_triggers
      ORDER BY is_system DESC, name ASC`,
  );
  return r.rows;
}

export async function upsertTrigger(input: {
  key: string;
  name: string;
  description?: string;
  triggerType: "event" | "scheduled" | "audience";
  eventKey?: string | null;
  config?: Record<string, unknown>;
  enabled?: boolean;
  updatedBy?: string | null;
}): Promise<TriggerRow> {
  const r = await pool.query<TriggerRow>(
    `INSERT INTO email_workflow_triggers
       (key, name, description, trigger_type, event_key, config, enabled, is_system, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8, now())
     ON CONFLICT (key) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       trigger_type = EXCLUDED.trigger_type,
       event_key = EXCLUDED.event_key,
       config = EXCLUDED.config,
       enabled = EXCLUDED.enabled,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING key, name, description, trigger_type, event_key, config,
               is_system, enabled, updated_at, updated_by`,
    [
      input.key,
      input.name,
      input.description ?? "",
      input.triggerType,
      input.eventKey ?? null,
      JSON.stringify(input.config ?? {}),
      input.enabled ?? true,
      input.updatedBy ?? null,
    ],
  );
  return r.rows[0];
}

/** Delete a non-system trigger. Returns false if it was system (protected) or missing. */
export async function deleteTrigger(key: string): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM email_workflow_triggers WHERE key = $1 AND is_system = false`,
    [key],
  );
  return (r.rowCount ?? 0) > 0;
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export async function listWorkflows(): Promise<Workflow[]> {
  const r = await pool.query<WorkflowRow>(
    `SELECT ${WORKFLOW_COLS} FROM email_workflows
      WHERE scope = 'platform' ORDER BY is_system DESC, name ASC`,
  );
  return r.rows.map(toWorkflow);
}

export async function getWorkflow(id: number): Promise<Workflow | null> {
  const r = await pool.query<WorkflowRow>(
    `SELECT ${WORKFLOW_COLS} FROM email_workflows WHERE id = $1 AND scope = 'platform'`,
    [id],
  );
  return r.rows[0] ? toWorkflow(r.rows[0]) : null;
}

/**
 * The enqueue hot path: enabled, NON-locked workflows whose trigger fires on
 * `eventKey`. Locked workflows (auth-critical) are intentionally excluded — the
 * callsite sends those directly. Resilient: ANY DB error returns [] so the
 * caller falls back to its direct send.
 */
export async function getEnabledWorkflowsForEvent(eventKey: string): Promise<Workflow[]> {
  try {
    const r = await pool.query<WorkflowRow>(
      `SELECT ${WORKFLOW_COLS}
         FROM email_workflows w
        WHERE w.scope = 'platform'
          AND w.enabled = true
          AND w.locked = false
          AND w.trigger_key IN (
            SELECT t.key FROM email_workflow_triggers t
             WHERE t.enabled = true AND t.event_key = $1
          )`,
      [eventKey],
    );
    return r.rows.map(toWorkflow);
  } catch (err) {
    logger.error({ err, eventKey }, "[workflowStore] getEnabledWorkflowsForEvent failed");
    return [];
  }
}

export interface WorkflowWithTriggerConfig {
  workflow: Workflow;
  triggerConfig: Record<string, unknown>;
}

/**
 * Enabled, NON-locked platform workflows whose trigger is of `triggerType`
 * (scheduled / audience) AND whose trigger is itself enabled. Returns each
 * workflow alongside its trigger's raw config jsonb (interpreted by the
 * producers). Resilient: any DB error returns [] so a producer tick degrades to
 * a no-op rather than throwing inside the shared sweep loop.
 */
export async function listEnabledWorkflowsByTriggerType(
  triggerType: "scheduled" | "audience",
): Promise<WorkflowWithTriggerConfig[]> {
  try {
    const r = await pool.query<WorkflowRow & { trigger_config: Record<string, unknown> }>(
      `SELECT ${WORKFLOW_COLS.split(",").map((c) => `w.${c.trim()}`).join(", ")},
              t.config AS trigger_config
         FROM email_workflows w
         JOIN email_workflow_triggers t ON t.key = w.trigger_key
        WHERE w.scope = 'platform'
          AND w.enabled = true
          AND w.locked = false
          AND t.enabled = true
          AND t.trigger_type = $1
        ORDER BY w.id`,
      [triggerType],
    );
    return r.rows.map((row) => {
      const { trigger_config, ...wfRow } = row;
      return {
        workflow: toWorkflow(wfRow),
        triggerConfig: trigger_config ?? {},
      };
    });
  } catch (err) {
    logger.error({ err, triggerType }, "[workflowStore] listEnabledWorkflowsByTriggerType failed");
    return [];
  }
}

export async function createWorkflow(input: {
  key: string;
  name: string;
  description?: string;
  triggerKey: string;
  enabled?: boolean;
  definition: WorkflowDefinition;
  updatedBy?: string | null;
}): Promise<Workflow> {
  const r = await pool.query<WorkflowRow>(
    `INSERT INTO email_workflows
       (key, name, description, trigger_key, scope, enabled, definition, is_system, locked, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,'platform',$5,$6,false,false,$7, now())
     RETURNING ${WORKFLOW_COLS}`,
    [
      input.key,
      input.name,
      input.description ?? "",
      input.triggerKey,
      input.enabled ?? true,
      JSON.stringify(input.definition),
      input.updatedBy ?? null,
    ],
  );
  return toWorkflow(r.rows[0]);
}

export async function updateWorkflow(
  id: number,
  patch: {
    name?: string;
    description?: string;
    triggerKey?: string;
    enabled?: boolean;
    definition?: WorkflowDefinition;
    updatedBy?: string | null;
  },
): Promise<Workflow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.name !== undefined) { sets.push(`name = $${i++}`); vals.push(patch.name); }
  if (patch.description !== undefined) { sets.push(`description = $${i++}`); vals.push(patch.description); }
  if (patch.triggerKey !== undefined) { sets.push(`trigger_key = $${i++}`); vals.push(patch.triggerKey); }
  if (patch.enabled !== undefined) { sets.push(`enabled = $${i++}`); vals.push(patch.enabled); }
  if (patch.definition !== undefined) { sets.push(`definition = $${i++}`); vals.push(JSON.stringify(patch.definition)); }
  sets.push(`updated_by = $${i++}`); vals.push(patch.updatedBy ?? null);
  sets.push(`updated_at = now()`);
  vals.push(id);
  // locked workflows are immutable; the WHERE guard makes the update a no-op.
  const r = await pool.query<WorkflowRow>(
    `UPDATE email_workflows SET ${sets.join(", ")}
      WHERE id = $${i} AND scope = 'platform' AND locked = false
      RETURNING ${WORKFLOW_COLS}`,
    vals,
  );
  return r.rows[0] ? toWorkflow(r.rows[0]) : null;
}

/** Delete a non-system, non-locked workflow. Returns false otherwise. */
export async function deleteWorkflow(id: number): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM email_workflows WHERE id = $1 AND scope = 'platform' AND is_system = false AND locked = false`,
    [id],
  );
  return (r.rowCount ?? 0) > 0;
}

// ─── Enrollments ─────────────────────────────────────────────────────────────

export interface EnrollInput {
  workflowId: number;
  tenantId: number | null;
  appUserId: number | null;
  recipientEmail: string | null;
  recipientName: string | null;
  context: Record<string, string>;
  dedupeKey: string;
  firstStepDelayMs: number;
}

/**
 * Insert an enrollment, idempotent on (workflow_id, dedupe_key). Returns the new
 * enrollment id, or null if one already existed (duplicate trigger fire).
 */
export async function enroll(input: EnrollInput): Promise<number | null> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO email_workflow_enrollments
       (workflow_id, tenant_id, app_user_id, recipient_email, recipient_name,
        context, current_step_id, status, next_run_at, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6, NULL, 'active', now() + ($7 || ' milliseconds')::interval, $8)
     ON CONFLICT (workflow_id, dedupe_key) DO NOTHING
     RETURNING id`,
    [
      input.workflowId,
      input.tenantId,
      input.appUserId,
      input.recipientEmail,
      input.recipientName,
      JSON.stringify(input.context),
      String(input.firstStepDelayMs),
      input.dedupeKey,
    ],
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Atomically claim a due, active enrollment by bumping its next_run_at lease
 * into the future. Returns the claimed snapshot, or null if it wasn't due /
 * active / was claimed by another worker. Reusing next_run_at as the lease means
 * a crashed worker's row simply becomes due again after the lease elapses, and
 * the idempotent per-step send makes re-processing safe.
 */
export async function claimEnrollment(id: number, leaseMs: number): Promise<EnrollmentRow | null> {
  const r = await pool.query<EnrollmentRow>(
    `UPDATE email_workflow_enrollments
        SET next_run_at = now() + ($2 || ' milliseconds')::interval, updated_at = now()
      WHERE id = $1 AND status = 'active' AND next_run_at <= now()
      RETURNING id, workflow_id, tenant_id, app_user_id, recipient_email, recipient_name,
                context, current_step_id, status, next_run_at, dedupe_key, step_count, last_error`,
    [id, String(leaseMs)],
  );
  return r.rows[0] ?? null;
}

export async function advanceEnrollment(
  id: number,
  patch: {
    currentStepId: string | null;
    status: EnrollmentRow["status"];
    nextRunDelayMs: number;
    stepCount: number;
    lastError?: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE email_workflow_enrollments
        SET current_step_id = $2,
            status = $3,
            next_run_at = now() + ($4 || ' milliseconds')::interval,
            step_count = $5,
            last_error = $6,
            updated_at = now()
      WHERE id = $1`,
    [id, patch.currentStepId, patch.status, String(patch.nextRunDelayMs), patch.stepCount, patch.lastError ?? null],
  );
}

/** Has the notification_sends row for a given dedupe_key been read? (in_app read state) */
export async function isSendRead(stepDedupeKey: string): Promise<boolean> {
  const r = await pool.query<{ read: boolean }>(
    `SELECT bool_or(read_at IS NOT NULL) AS read
       FROM notification_sends
      WHERE dedupe_key = $1`,
    [stepDedupeKey],
  );
  return Boolean(r.rows[0]?.read);
}
