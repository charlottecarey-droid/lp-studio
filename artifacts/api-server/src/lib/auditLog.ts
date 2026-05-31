import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Shared, system-wide audit-log writer for sensitive superadmin actions
 * (Task #672). Appends one durable row to `audit_log` so support/compliance can
 * review what superadmins did across the whole system, instead of grepping the
 * scattered `[admin][audit]` console lines that rotate out of retention.
 *
 * BEST-EFFORT BY CONTRACT: an audit-logging failure must NEVER turn a
 * successful admin action into a 500 for the operator. Errors are swallowed and
 * logged here; callers keep their existing structured `[admin][audit]` console
 * line as a backstop. The `audit_log` table is guaranteed to exist by the
 * 0058 migration + its self-heal in migrate.ts.
 */
export interface AuditLogEntry {
  /** Superadmin who performed the action (from the session). Null if unknown. */
  actorUserId?: number | null;
  actorEmail?: string | null;
  /** Dotted action key, e.g. "tenant.plan.changed". */
  action: string;
  /** Coarse object kind, e.g. "tenant", "plan_config". */
  targetType?: string | null;
  /** Stable id/slug/tier/hash of the target, coerced to text. */
  targetKey?: string | number | null;
  /** Action-specific details (before/after values, etc.). */
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (actor_user_id, actor_email, action, target_type, target_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.actorUserId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.targetType ?? null,
        entry.targetKey == null ? null : String(entry.targetKey),
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  } catch (err) {
    logger.error({ err, action: entry.action }, "audit_log insert failed (non-fatal)");
  }
}
