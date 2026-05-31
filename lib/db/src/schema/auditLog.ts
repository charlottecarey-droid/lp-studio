import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * General-purpose, system-wide audit trail for sensitive superadmin actions
 * (Task #672).
 *
 * Before this table, sensitive superadmin actions were recorded in scattered,
 * per-feature ways: a few had dedicated tables (trial_phone_release_log,
 * email_template_edit_log) but most (tenant plan changes, plan-config edits,
 * tenant-slug-redirect releases, custom-domain attach/detach) only emitted
 * `[admin][audit]` console lines that can't be reviewed in the UI and rotate
 * out of log retention. There was no single, queryable place to answer "what
 * did superadmins do, across the whole system, and when".
 *
 * This append-only table consolidates those actions into one durable record:
 *   - `action`      — dotted action key, e.g. "tenant.plan.changed".
 *   - `targetType`  — coarse object kind the action targeted, e.g. "tenant".
 *   - `targetKey`   — stable identifier of the target (id/slug/tier/hash), as
 *                     text so heterogeneous targets share one column.
 *   - `metadata`    — jsonb snapshot of the action-specific details (before/
 *                     after values, etc.) so each action keeps its own shape.
 *   - `actorUserId` / `actorEmail` — who performed it (from the session).
 *
 * Deliberately append-only — never updated or deleted by the app.
 *
 * INTENTIONALLY SEPARATE per-feature logs (NOT migrated onto this table):
 *   - `trial_phone_release_log` — keeps a privacy-scoped, append-only record
 *     that stores ONLY the SHA-256 phone hash plus a snapshot of the prior
 *     tenant name/slug + original-created-at, with its own retention/privacy
 *     contract. The shared audit_log ALSO receives a "trial-phone.released"
 *     row (so the unified view is complete), but the detailed privacy-scoped
 *     record stays in its dedicated table.
 *   - `email_template_edit_log` — keeps a structured before/after `diff` per
 *     email-authoring edit/reset/test-send with target-specific semantics; it
 *     predates this table and is left as its own specialized record.
 */
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    // Superadmin who performed the action (from the authenticated session).
    // Null only if unknown.
    actorUserId: integer("actor_user_id"),
    actorEmail: text("actor_email"),
    // Dotted action key, e.g. "tenant.plan.changed", "plan-config.changed".
    action: text("action").notNull(),
    // Coarse object kind the action targeted, e.g. "tenant", "plan_config".
    targetType: text("target_type"),
    // Stable identifier of the target (tenant id, tier, slug, phone hash, ...),
    // stored as text so heterogeneous targets share one column.
    targetKey: text("target_key"),
    // Action-specific details (before/after values, etc.).
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_action_idx").on(t.action, t.createdAt),
    index("audit_log_target_idx").on(t.targetType, t.targetKey, t.createdAt),
  ],
);

export type AuditLog = typeof auditLogTable.$inferSelect;
export type InsertAuditLog = typeof auditLogTable.$inferInsert;
