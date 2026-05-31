import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Durable audit trail for superadmin trial-phone releases (Task #669).
 *
 * When a superadmin releases a gated trial phone (DELETE on
 * `trial_phone_numbers`), the released row is gone forever — the only prior
 * record was a structured server-log line, which can't be reviewed in the UI
 * and rotates out of retention. This append-only table preserves who released
 * what and when so support can review (and reverse-by-context) past releases.
 *
 * Deliberately append-only — never updated or deleted by the app. Like the
 * trial-phone tables themselves, only the SHA-256 HASH of the number is ever
 * stored (`phoneHash`), never the raw number.
 *
 * The prior-tenant name/slug are SNAPSHOTTED at release time (not a live FK)
 * so the history stays searchable/readable even after that tenant is deleted.
 */
export const trialPhoneReleaseLogTable = pgTable(
  "trial_phone_release_log",
  {
    id: serial("id").primaryKey(),
    // SHA-256 hex of the released number (matches trial_phone_numbers.phone_hash).
    phoneHash: text("phone_hash").notNull(),
    // The tenant the released phone had unlocked its trial for, if any. Plain
    // integer (no FK) — the source row is already deleted and the tenant may be
    // too; this is a historical snapshot, not a live relation.
    priorTenantId: integer("prior_tenant_id"),
    // Snapshot of the tenant's name/slug at release time so the history stays
    // human-readable and searchable even after the tenant is deleted.
    priorTenantName: text("prior_tenant_name"),
    priorTenantSlug: text("prior_tenant_slug"),
    // When the original trial-phone row was created (carried over from the
    // deleted row) so reviewers can see how long the gate had stood.
    originalCreatedAt: timestamp("original_created_at", { withTimezone: true }),
    // Superadmin who performed the release (from the authenticated session).
    // Null only if unknown.
    actorUserId: integer("actor_user_id"),
    actorEmail: text("actor_email"),
    releasedAt: timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trial_phone_release_log_released_idx").on(t.releasedAt),
    index("trial_phone_release_log_hash_idx").on(t.phoneHash),
  ],
);

export type TrialPhoneReleaseLog = typeof trialPhoneReleaseLogTable.$inferSelect;
export type InsertTrialPhoneReleaseLog = typeof trialPhoneReleaseLogTable.$inferInsert;
