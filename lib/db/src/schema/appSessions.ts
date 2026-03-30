import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * App Sessions — server-side session store for auth.
 * Each logged-in user gets a cryptographically random `sid` stored
 * as an httpOnly cookie. The `sess` payload holds the user snapshot
 * (id, role, tenantId) so auth middleware doesn't need a DB hit per request.
 * Sessions auto-expire after 7 days.
 */
export const appSessionsTable = pgTable("app_sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
});

export type AppSession = typeof appSessionsTable.$inferSelect;
