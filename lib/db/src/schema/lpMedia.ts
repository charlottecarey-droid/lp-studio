import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const lpMediaTable = pgTable("lp_media", {
  id: serial("id").primaryKey(),
  // Nullable: shared / starter library rows (is_shared = true) have tenant_id = NULL.
  // All tenant-scoped uploads continue to carry their tenant id.
  tenantId: integer("tenant_id"),
  title: text("title").notNull(),
  url: text("url").notNull(),
  mediaType: text("media_type").notNull().default("video"),
  mimeType: text("mime_type").notNull().default(""),
  sizeBytes: integer("size_bytes"),
  tags: jsonb("tags").notNull().default([]),
  // Marks rows in the shared "starter" image library — visible to every tenant
  // regardless of tenant_id. Only an admin can create these (see admin upload route).
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LpMedia = typeof lpMediaTable.$inferSelect;
