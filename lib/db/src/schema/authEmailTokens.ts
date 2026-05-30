import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { appUsersTable } from "./appUsers";

/**
 * Auth Email Tokens — single-use, short-lived tokens delivered by email for
 * the passwordless / password-recovery / email-verification flows.
 *
 * Only the SHA-256 HASH of the opaque token is stored (`tokenHash`), never the
 * raw token. The raw token travels only inside the emailed link; an attacker
 * with read access to this table therefore cannot redeem any token.
 *
 * `purpose` partitions the three flows so a token minted for one cannot be
 * replayed against another:
 *   - "magic_link"     — passwordless login (also verifies the address)
 *   - "password_reset" — forgot-password → set a new password
 *   - "email_verify"   — confirm ownership after email+password registration
 *
 * `usedAt` enforces single use (set on redemption). `targetHost` binds the
 * token to the host that requested it so a link cannot be redeemed on a
 * different (attacker-controlled) host that also points at this API. `nextPath`
 * carries an optional same-origin post-login destination.
 */
export const authEmailTokensTable = pgTable(
  "auth_email_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsersTable.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    targetHost: text("target_host"),
    nextPath: text("next_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPurposeIdx: index("idx_auth_email_tokens_user_purpose").on(t.userId, t.purpose),
    expiresIdx: index("idx_auth_email_tokens_expires").on(t.expiresAt),
  })
);

export type AuthEmailToken = typeof authEmailTokensTable.$inferSelect;
