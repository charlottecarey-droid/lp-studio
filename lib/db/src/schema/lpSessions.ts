import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lpTestsTable } from "./lpTests";
import { lpVariantsTable } from "./lpVariants";

export const lpSessionsTable = pgTable("lp_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  testId: integer("test_id").notNull().references(() => lpTestsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => lpVariantsTable.id, { onDelete: "cascade" }),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  countryCode: text("country_code"),
  features: jsonb("features").notNull().default({}),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLpSessionSchema = createInsertSchema(lpSessionsTable).omit({ id: true, createdAt: true });
export type InsertLpSession = z.infer<typeof insertLpSessionSchema>;
export type LpSession = typeof lpSessionsTable.$inferSelect;
