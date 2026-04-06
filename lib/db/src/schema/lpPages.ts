import { pgTable, text, serial, timestamp, jsonb, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpPagesTable = pgTable("lp_pages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  blocks: jsonb("blocks").notNull().default([]),
  status: text("status").notNull().default("draft"),
  customCss: text("custom_css").notNull().default(""),
  metaTitle: text("meta_title").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),
  ogImage: text("og_image").notNull().default(""),
  animationsEnabled: boolean("animations_enabled").notNull().default(true),
  pageVariables: jsonb("page_variables").default({}),
  accountId: integer("account_id"),           // internal FK (may be null after re-sync)
  sfdcAccountId: text("sfdc_account_id"),     // stable SFDC Account ID (e.g. 001xxx)
  mode: text("mode").notNull().default("marketing"),  // "marketing" | "sales"
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  isTemplate: boolean("is_template").notNull().default(false),
  templateLabel: text("template_label"),
  templateDescription: text("template_description"),
  audienceType: text("audience_type"),  // "dso-corporate" | "dso-practice" | "independent"
  segmentId: text("segment_id"),        // brand segment ID applied to this page
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("lp_pages_tenant_slug_idx").on(table.tenantId, table.slug),
]);

export const insertLpPageSchema = createInsertSchema(lpPagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLpPage = z.infer<typeof insertLpPageSchema>;
export type LpPage = typeof lpPagesTable.$inferSelect;
