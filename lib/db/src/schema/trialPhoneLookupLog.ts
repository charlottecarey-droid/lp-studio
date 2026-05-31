import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Durable audit trail for superadmin trial-phone lookups (Task #673).
 *
 * Support can look up a phone number (POST /superadmin/trial-phones/lookup) to
 * check whether it has already used a free trial and, when it has, release it.
 * The release is already audited (`trial_phone_release_log`), but the lookup
 * that precedes it was not recorded at all — so there was no durable trace of
 * WHO probed a number, only of who released it. This append-only table records
 * each lookup so a release is traceable back to the operator who looked it up,
 * and so probing itself stays reviewable (deters misuse).
 *
 * Deliberately append-only — never updated or deleted by the app. Like the
 * trial-phone tables themselves, only the SHA-256 HASH of the number is ever
 * stored (`phoneHash`), never the raw number.
 *
 * The matched-tenant name/slug are SNAPSHOTTED at lookup time (not a live FK)
 * so the history stays searchable/readable even after that tenant is deleted.
 */
export const trialPhoneLookupLogTable = pgTable(
  "trial_phone_lookup_log",
  {
    id: serial("id").primaryKey(),
    // SHA-256 hex of the looked-up number (matches trial_phone_numbers.phone_hash).
    phoneHash: text("phone_hash").notNull(),
    // Whether the lookup matched an existing trial record (i.e. the number had
    // already used a trial and could be released).
    found: boolean("found").notNull(),
    // The tenant the matched phone had unlocked its trial for, if found. Plain
    // integer (no FK) — the tenant may later be deleted; this is a historical
    // snapshot, not a live relation. Null when not found / tenant unknown.
    matchedTenantId: integer("matched_tenant_id"),
    // Snapshot of the matched tenant's name/slug at lookup time so the history
    // stays human-readable and searchable even after the tenant is deleted.
    matchedTenantName: text("matched_tenant_name"),
    matchedTenantSlug: text("matched_tenant_slug"),
    // Superadmin who performed the lookup (from the authenticated session).
    // Null only if unknown.
    actorUserId: integer("actor_user_id"),
    actorEmail: text("actor_email"),
    lookedUpAt: timestamp("looked_up_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trial_phone_lookup_log_looked_up_idx").on(t.lookedUpAt),
    index("trial_phone_lookup_log_hash_idx").on(t.phoneHash),
  ],
);

export type TrialPhoneLookupLog = typeof trialPhoneLookupLogTable.$inferSelect;
export type InsertTrialPhoneLookupLog = typeof trialPhoneLookupLogTable.$inferInsert;
