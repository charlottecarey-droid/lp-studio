import { pgTable, text, serial, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpPagesTable = pgTable("lp_pages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
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
  accountId: integer("account_id"),       // links page to a sales account (nullable)
  mode: text("mode").notNull().default("marketing"),  // "marketing" | "sales"
  createdBy: text("created_by"),          // user/rep identifier
  // Template fields — marketing can mark any page as a microsite template
  isTemplate: boolean("is_template").notNull().default(false),
  templateLabel: text("template_label"),
  templateDescription: text("template_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLpPageSchema = createInsertSchema(lpPagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLpPage = z.infer<typeof insertLpPageSchema>;
export type LpPage = typeof lpPagesTable.$inferSelect;
