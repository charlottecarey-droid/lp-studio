// Task #1138 — shared types for the Strict Facts review flow. These mirror the
// `lp_page_fact_flags` table columns and are surface-agnostic so every
// AI-generated prose surface (landing pages, microsites, one-pagers, AI email
// drafts) can run the same detection + flag-writing pipeline.

export type FactKind = "stat" | "claim" | "quote";

export type TriageState =
  | "pending"
  | "approved_for_page"
  | "edited"
  | "swapped"
  | "removed";

export type FactSource = "ai" | "template";

export interface QuoteAttribution {
  name?: string;
  title?: string;
  company?: string;
}

/** A candidate fact found in generated content, before any approval filtering. */
export interface DetectedFact {
  factKind: FactKind;
  blockId?: string;
  blockType?: string;
  /** Dot/bracket path inside the block, e.g. `props.stats[0].value`. */
  fieldPath: string;
  /** The exact substring/value detected. */
  originalText: string;
  /** Fuzzy-match + regen-memory key. */
  normalizedForm: string;
  attribution?: QuoteAttribution;
}

/** The tenant's approved-fact pools used to suppress flags for already-vetted
 *  facts. `statPool` reuses the existing lowercased approved-stat set; quote +
 *  claim pools carry the normalized kernels for fuzzy matching. */
export interface ApprovedFacts {
  /** Lowercased approved stat strings (reuses buildApprovedStatSet output). */
  statPool: Set<string>;
  /** Normalized numeric kernels of approved stats (digits + unit). */
  statKernels: Set<string>;
  /** Normalized approved claim strings. */
  claims: Set<string>;
  /** Approved quotes: first-N-words kernel + lowercased attribution name. */
  quotes: { kernel: string; name: string }[];
}
