import { pgTable, text, integer, timestamp, jsonb, boolean, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * block_catalog — per-industry block library configuration.
 *
 * One row per (block_type, industry) pair. Drives what blocks appear in the
 * builder library for a tenant of a given industry, what label/category they
 * show under, and what default props new instances get.
 *
 * The in-code BLOCK_REGISTRY remains the seed + fallback. The catalog is the
 * runtime source of truth that superadmins can edit from /admin/block-catalog.
 */
export const blockCatalogTable = pgTable("block_catalog", {
  blockType: text("block_type").notNull(),
  industry: text("industry").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  /**
   * Per-industry semantic role tags (controlled vocabulary from
   * @workspace/lp-template-engine). When non-empty, overrides the in-code
   * DEFAULT_BLOCK_TAGS for this (block_type, industry). NULL/empty = no
   * override → fall back to code defaults.
   */
  tags: text("tags").array(),
  defaultProps: jsonb("default_props").notNull().default({}),
  isEnabled: boolean("is_enabled").notNull().default(true),
  /**
   * Whether the AI page generator may advertise this block to the model.
   * Independent of `isEnabled` (which controls builder-library visibility):
   * a block can stay available in the builder while being excluded from AI
   * generation. Defaults to true — fail-open so existing generation never
   * silently loses blocks when no catalog row exists.
   */
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.blockType, t.industry] }),
}));

export const insertBlockCatalogSchema = createInsertSchema(blockCatalogTable).omit({ createdAt: true, updatedAt: true });
export type InsertBlockCatalog = z.infer<typeof insertBlockCatalogSchema>;
export type BlockCatalogRow = typeof blockCatalogTable.$inferSelect;
