import { pgTable, text, serial, timestamp, jsonb, boolean, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpPagesTable = pgTable("lp_pages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  title: text("title").notNull(),
  // Slug is unique *per tenant*, not globally — see uniqueIndex below.
  // Two tenants can each have a page named "pricing" or "envisage-dandy-partnership".
  slug: text("slug").notNull(),
  blocks: jsonb("blocks").notNull().default([]),
  status: text("status").notNull().default("draft"),
  customCss: text("custom_css").notNull().default(""),
  metaTitle: text("meta_title").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),
  ogImage: text("og_image").notNull().default(""),
  // Per-page robots overrides (task #494). TRI-STATE — intentionally NULLABLE
  // with no DB default: NULL = inherit the tenant default
  // (tenants.settings.seo.*), true = force allow, false = force deny. The
  // resolved <meta name="robots"> is computed in application code
  // (resolveRobotsMeta in @workspace/lp-template-engine), never at the DB
  // layer, so the "inherit" state is preserved.
  allowIndexing: boolean("allow_indexing"),
  allowFollowing: boolean("allow_following"),
  animationsEnabled: boolean("animations_enabled").notNull().default(true),
  smoothScroll: boolean("smooth_scroll").notNull().default(true),
  pageVariables: jsonb("page_variables").default({}),
  accountId: integer("account_id"),           // internal FK (may be null after re-sync)
  sfdcAccountId: text("sfdc_account_id"),     // stable SFDC Account ID (e.g. 001xxx)
  mode: text("mode").notNull().default("marketing"),  // "marketing" | "sales"
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  isTemplate: boolean("is_template").notNull().default(false),
  templateLabel: text("template_label"),
  templateDescription: text("template_description"),
  // Create-microsite dropdown gating (task #1219). Tri-state:
  //   NULL  = auto — fall back to the computed compatibility default
  //           (getMicrositeTemplateCompatibility(blocks).compatible).
  //   true  = admin force-enabled in the create-microsite dropdown.
  //   false = admin force-disabled.
  // Effective visibility = micrositeEnabled ?? computed compatibility.
  micrositeEnabled: boolean("microsite_enabled"),
  // Template-gallery preview thumbnail (task #736). A thum.io screenshot URL
  // captured from this page's /preview/:slug render, distinct from `ogImage`
  // (which is the social/share card). NULL = never captured → the gallery
  // falls back to ogImage, then to a gradient placeholder. `thumbnailCapturedAt`
  // drives both cache-busting (the captured thum.io target carries ?v=<ts>) and
  // the "Capturing preview…" shimmer for freshly-created templates.
  thumbnailUrl: text("thumbnail_url"),
  thumbnailCapturedAt: timestamp("thumbnail_captured_at", { withTimezone: true }),
  // Cross-tenant template visibility. When isGlobal=true, this template is
  // visible to every tenant whose settings.industry matches `industry` (or any
  // tenant if `industry` is null). Tenant-owned templates (isGlobal=false) are
  // visible only to their owning tenant. See routes/lp/templates.ts.
  isGlobal: boolean("is_global").notNull().default(false),
  industry: text("industry"),
  audienceType: text("audience_type"),  // "dso-corporate" | "dso-practice" | "independent"
  segmentId: text("segment_id"),        // brand segment ID applied to this page
  // Page-review workflow (task #108). status may be "draft" | "pending_review" | "published".
  // The review-related columns are nullable and only populated while a review is in flight
  // or after a decision has been made. asanaTaskId stores the GID of the open Asana review
  // task so approve/reject can comment+complete it; nulled out after the task closes.
  submittedForReviewAt: timestamp("submitted_for_review_at", { withTimezone: true }),
  submittedByUserId: integer("submitted_by_user_id"),
  // Stored as the reviewer's email (text) so it can be displayed without an extra
  // join. Matches the convention already used by `createdBy` / `updatedBy` above.
  lastReviewDecisionBy: text("last_review_decision_by"),
  lastReviewDecisionAt: timestamp("last_review_decision_at", { withTimezone: true }),
  lastReviewNote: text("last_review_note"),
  asanaTaskId: text("asana_task_id"),
  // Task #379 — per-page asset-health record written by the scheduled
  // canary in `assetHealthCheck.ts`. NULL = never checked. Shape:
  //   { checked: number, brokenAssets: string[], host: string, hadHtml: boolean }
  // "healthy" is derived (hadHtml && checked > 0 && brokenAssets.length === 0).
  assetHealthCheckedAt: timestamp("asset_health_checked_at", { withTimezone: true }),
  assetHealthResult: jsonb("asset_health_result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  // Per-tenant uniqueness: each tenant can have its own page named "pricing".
  uniqueIndex("lp_pages_tenant_slug_unique").on(table.tenantId, table.slug),
]);

export const insertLpPageSchema = createInsertSchema(lpPagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLpPage = z.infer<typeof insertLpPageSchema>;
export type LpPage = typeof lpPagesTable.$inferSelect;
