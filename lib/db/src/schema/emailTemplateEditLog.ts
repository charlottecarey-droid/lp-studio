import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Audit trail for SuperAdmin email-authoring actions. One row per edit / reset
 * / test-send so an operator change to a lifecycle email (or the shared shell)
 * is always attributable. Deliberately append-only — never updated or deleted
 * by the app.
 */
export const emailTemplateEditLogTable = pgTable("email_template_edit_log", {
  id: serial("id").primaryKey(),
  // 'template' | 'shell'
  targetType: text("target_type").notNull(),
  // template key (e.g. 'trial_day_7') or 'platform_default' for the shell.
  targetKey: text("target_key").notNull(),
  // Superadmin email (from the authenticated session). Null only if unknown.
  editorEmail: text("editor_email"),
  // 'update' | 'reset' | 'test_send'
  action: text("action").notNull(),
  // Snapshot of what changed (changed field names / before-after summary).
  diff: jsonb("diff").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("email_template_edit_log_target_idx").on(t.targetType, t.targetKey, t.createdAt),
]);

export type EmailTemplateEditLog = typeof emailTemplateEditLogTable.$inferSelect;
export type InsertEmailTemplateEditLog = typeof emailTemplateEditLogTable.$inferInsert;
