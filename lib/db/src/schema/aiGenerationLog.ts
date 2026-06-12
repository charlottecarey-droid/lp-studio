import { pgTable, serial, integer, text, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_generation_log — observability + training-data substrate for the
 * AI page-generation pipeline (Workstreams A/B/C of the May 2026 output-
 * quality plan).
 *
 * One row per call to /api/lp/generate-page (and friends). Powers:
 *   - measuring reference-URL adoption per tenant (Workstream A),
 *   - prompt-section pruning instrumentation (Workstream B — track which
 *     sections were included so we can later correlate with output quality),
 *   - critique-pass measurement (Workstream C — log whether the critique
 *     ran and which blocks it rewrote).
 *
 * Append-only. Nullable foreign-style columns so we never block a generation
 * on logging.
 */
export const aiGenerationLogTable = pgTable("ai_generation_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  pageId: integer("page_id"),
  endpoint: text("endpoint").notNull(),       // e.g. "/lp/generate-page"
  promptPath: text("prompt_path"),            // GENERAL | DSO_ENTERPRISE | DSO_PRACTICES | TEMPLATE | FREEFORM
  promptHash: text("prompt_hash").notNull(),  // sha256 of the user prompt for de-dup grouping
  promptPreview: text("prompt_preview"),      // first ~200 chars for human review
  referenceUrls: jsonb("reference_urls").notNull().default([]),       // string[] — the URLs actually scraped (per-request + persisted merged, deduped)
  inspirationUrls: jsonb("inspiration_urls").notNull().default([]),   // string[] — the persisted brand-inspiration set at time of generation
  sectionsIncluded: jsonb("sections_included").notNull().default([]), // string[] — which prompt sections were emitted (brand, segment, proofPoints, caseStudies, reference, vision, etc.)
  templateId: integer("template_id"),
  composerDurationMs: integer("composer_duration_ms"),
  critiqueRan: boolean("critique_ran").notNull().default(false),
  critiqueRewroteBlockIds: jsonb("critique_rewrote_block_ids").notNull().default([]),
  bannedPhraseHits: jsonb("banned_phrase_hits").notNull().default([]),       // BannedPhraseHit[] — clichés/brand-forbidden phrases the post-validator found in the output (Workstream B)
  outputBlockTypes: jsonb("output_block_types").notNull().default([]), // string[] — block.type for each block returned
  // June 2026 — page-variety workstream. sequence_hash: sha1 of the page's
  // non-structural block-type sequence (block-sequence repeat guard reads the
  // tenant's recent hashes and re-prompts once on a collision). recipe_id: the
  // page recipe injected into the prompt for this generation (least-recently-
  // used rotation reads recent values). Both nullable — template-path rows and
  // failed generations leave them null.
  sequenceHash: text("sequence_hash"),
  recipeId: text("recipe_id"),
  usedScreenshot: boolean("used_screenshot").notNull().default(false),
  errorMessage: text("error_message"),
  wasPublishedAfter: boolean("was_published_after").notNull().default(false), // backfilled when a page from this generation is later published
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ai_generation_log_tenant_id_idx").on(t.tenantId),
  index("ai_generation_log_created_at_idx").on(t.createdAt),
  index("ai_generation_log_page_id_idx").on(t.pageId),
]);

export const insertAiGenerationLogSchema = createInsertSchema(aiGenerationLogTable).omit({ id: true, createdAt: true });
export type InsertAiGenerationLog = z.infer<typeof insertAiGenerationLogSchema>;
export type AiGenerationLog = typeof aiGenerationLogTable.$inferSelect;
