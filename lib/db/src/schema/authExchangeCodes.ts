import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { appSessionsTable } from "./appSessions";

/**
 * Auth Exchange Codes — short-lived single-use codes for cross-domain
 * session handoff. When a user logs in on a tenant host (e.g.
 * lp.frambam.com) but the OAuth callback lives on the canonical app
 * domain (app.lpstudio.ai), the callback mints an exchange code, stores
 * it here, and redirects to the tenant host's /api/auth/accept endpoint
 * which redeems it for a session cookie.
 *
 * `target_host` binds the code to the tenant host that initiated the
 * flow so a phished/stolen code cannot be redeemed on a different host.
 */
export const authExchangeCodesTable = pgTable(
  "auth_exchange_codes",
  {
    code: text("code").primaryKey(),
    sid: text("sid")
      .notNull()
      .references(() => appSessionsTable.sid, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    targetHost: text("target_host"),
  },
  (t) => ({
    expiresIdx: index("idx_auth_exchange_codes_expires").on(t.expiresAt),
  })
);

export type AuthExchangeCode = typeof authExchangeCodesTable.$inferSelect;
