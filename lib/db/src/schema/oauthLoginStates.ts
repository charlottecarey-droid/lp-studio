import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * OAuth Login States — server-stored, single-use CSRF nonces for the Google and
 * GitHub OAuth login flows.
 *
 * Both providers' callbacks used to decode the origin host / redirect URI / next
 * path from a base64url `state` blob that was never bound to anything we
 * generated. An attacker could therefore forge a `state` (or replay a captured
 * one) and drive a victim's browser into an attacker-owned authenticated
 * session (login CSRF). We now mint a cryptographically random nonce on
 * initiation, persist the flow context here keyed by that nonce, and redeem it
 * single-use (DELETE ... RETURNING) in the callback BEFORE any token exchange or
 * session creation. A missing / forged / replayed / expired nonce fails closed.
 *
 * `provider` binds a nonce to the flow it was minted for (a Google nonce can't
 * be redeemed by the GitHub callback and vice-versa). Rows are short-lived;
 * `expires_at` is enforced on redeem and stale rows are swept on each mint.
 */
export const oauthLoginStatesTable = pgTable(
  "oauth_login_states",
  {
    state: text("state").primaryKey(),
    provider: text("provider").notNull(),
    host: text("host").notNull().default(""),
    redirectUri: text("redirect_uri").notNull().default(""),
    nextPath: text("next_path"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    expiresIdx: index("idx_oauth_login_states_expires").on(t.expiresAt),
  })
);

export type OAuthLoginState = typeof oauthLoginStatesTable.$inferSelect;
