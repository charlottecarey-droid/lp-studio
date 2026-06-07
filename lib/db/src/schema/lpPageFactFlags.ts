import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { lpPagesTable } from "./lpPages";
import { lpProofPointsTable } from "./lpProofPoints";

// Task #1138 — persistent, per-page record of every fact the AI generated that
// needs human review before publish. Separate from `lp_proof_points` (the
// reusable, global approved-facts library): a flag is scoped to ONE page, can
// be approved for that page alone without polluting the library, and carries a
// small triage state machine so the builder review modal can resume across
// reloads (the old flow used an ephemeral sessionStorage handoff).
//
// triageState: pending | approved_for_page | edited | swapped | removed
//   pending           — needs review; blocks publish
//   approved_for_page — kept as-is for this page only
//   edited            — kept with `replacementText`
//   swapped           — replaced with an approved proof point (`swappedWithProofPointId`)
//   removed           — taken off the page (quotes keep an empty scaffold)
//
// factKind: stat | claim | quote
//
// source: ai | template — template-authored facts are pre-tagged so vetted
//   templates produce zero review flags.
export const lpPageFactFlagsTable = pgTable(
  "lp_page_fact_flags",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    pageId: integer("page_id")
      .notNull()
      .references(() => lpPagesTable.id, { onDelete: "cascade" }),
    factKind: text("fact_kind").notNull().default("stat"),
    // Normalized form used for fuzzy matching against approved facts and for
    // regen memory (re-applying a prior decision on the same fact).
    normalizedForm: text("normalized_form").notNull().default(""),
    blockId: text("block_id"),
    blockType: text("block_type"),
    fieldPath: text("field_path").notNull().default(""),
    originalText: text("original_text").notNull().default(""),
    triageState: text("triage_state").notNull().default("pending"),
    // Replacement copy for `edited` (or the sentence-aware fragment for a
    // swap/remove on a longer string).
    replacementText: text("replacement_text"),
    swappedWithProofPointId: integer("swapped_with_proof_point_id").references(
      () => lpProofPointsTable.id,
      { onDelete: "set null" },
    ),
    // True once this fact was also promoted into the global proof-point library.
    librarySaved: boolean("library_saved").notNull().default(false),
    source: text("source").notNull().default("ai"),
    // Quote attribution captured at review time (mirrors lp_proof_points cols).
    attributionName: text("attribution_name"),
    attributionTitle: text("attribution_title"),
    attributionCompany: text("attribution_company"),
    // Task #1197 — human-readable context for this fact (e.g. the sibling label
    // or block heading it appeared next to), surfaced in the review modal and
    // used as the default library label when promoting the fact.
    contextLabel: text("context_label"),
    // Undo window support: when a row is resolved we stamp resolvedAt so the
    // client can offer a 10s Undo and the server can authorize it.
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("lp_page_fact_flags_tenant_idx").on(t.tenantId),
    pageIdx: index("lp_page_fact_flags_page_idx").on(t.pageId),
    pageStateIdx: index("lp_page_fact_flags_page_state_idx").on(t.pageId, t.triageState),
    pageNormIdx: index("lp_page_fact_flags_page_norm_idx").on(t.pageId, t.normalizedForm),
  }),
);

export type LpPageFactFlag = typeof lpPageFactFlagsTable.$inferSelect;
