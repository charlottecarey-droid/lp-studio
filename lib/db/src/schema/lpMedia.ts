import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const lpMediaTable = pgTable("lp_media", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  mediaType: text("media_type").notNull().default("video"),
  mimeType: text("mime_type").notNull().default(""),
  sizeBytes: integer("size_bytes"),
  tags: jsonb("tags").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LpMedia = typeof lpMediaTable.$inferSelect;
