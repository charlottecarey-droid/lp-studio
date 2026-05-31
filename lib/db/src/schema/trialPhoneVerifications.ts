import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { appUsersTable } from "./appUsers";
import { tenantsTable } from "./tenants";

/**
 * Trial phone gating — limits self-serve Growth trials to ONE per verified
 * phone number (Task #637). Two small tables back the SMS-verified-phone gate:
 *
 *  1. `trial_phone_numbers` — the source of truth for "has this phone already
 *     consumed a free trial". One row per phone that has ever been granted a
 *     trial window at signup. Only the SHA-256 HASH of the normalized E.164
 *     number is stored (`phoneHash`), never the raw number, so a DB export
 *     can't be turned into a list of customer phone numbers.
 *
 *  2. `trial_phone_tokens` — short-lived, single-use "phone verified" tokens.
 *     Minted after a successful Twilio Verify check and redeemed once during
 *     workspace creation to prove the signing-up user controls the phone. Like
 *     `auth_email_tokens`, only the token's SHA-256 hash is persisted; the raw
 *     token lives only in the client between verify and signup. Each token is
 *     bound to the user that verified AND carries the verified number's hash so
 *     the signup path can record/check the trial against that exact number.
 */

export const trialPhoneNumbersTable = pgTable("trial_phone_numbers", {
  // SHA-256 hex of the normalized E.164 number. Primary key so a number can
  // only ever consume one trial.
  phoneHash: text("phone_hash").primaryKey(),
  // The tenant this phone unlocked its trial for. SET NULL if that tenant is
  // later deleted — the "already trialed" fact must survive tenant cleanup so
  // the number can't reclaim a second trial.
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trialPhoneTokensTable = pgTable(
  "trial_phone_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsersTable.id, { onDelete: "cascade" }),
    // SHA-256 hex of the verified E.164 number (same hashing as
    // trial_phone_numbers) so signup can check/record the trial.
    phoneHash: text("phone_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_trial_phone_tokens_user").on(t.userId),
    expiresIdx: index("idx_trial_phone_tokens_expires").on(t.expiresAt),
  }),
);

export type TrialPhoneNumber = typeof trialPhoneNumbersTable.$inferSelect;
export type TrialPhoneToken = typeof trialPhoneTokensTable.$inferSelect;
