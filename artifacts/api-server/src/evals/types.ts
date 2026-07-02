/**
 * Shared types for the golden-brief generation eval harness.
 *
 * A "golden brief" is a frozen POST /lp/generate-page request plus the brand
 * state the seeded tenant needs and the expectations the scored result must
 * meet. Briefs live as JSON under src/evals/briefs/ so product/QA can add
 * cases without touching harness code.
 */

/** One generated page block as returned by /lp/generate-page. */
export interface EvalBlock {
  id?: unknown;
  type?: unknown;
  props?: unknown;
  [key: string]: unknown;
}

/** Quality-ledger entry echoed by the route (additive July 2026 field). */
export interface EvalDegradation {
  code: string;
  severity: "info" | "warn";
  detail: string;
}

/** Server-side strict-facts mismatch echo (subset of StrictStatMismatch). */
export interface EvalStrictMismatch {
  blockId?: string;
  blockType?: string;
  fieldPath: string;
  value: string;
}

/**
 * The subset of the /lp/generate-page response the scorers consume. All
 * fields optional so the scorers stay total over degraded/legacy payloads.
 */
export interface GenerationResultLike {
  title?: string;
  slug?: string;
  blocks?: EvalBlock[];
  strictMismatches?: EvalStrictMismatch[];
  degradations?: EvalDegradation[];
  bannedPhraseHits?: unknown[];
  detectedFacts?: unknown[];
  usedReference?: boolean;
  referenceFailureReason?: string | null;
  [key: string]: unknown;
}

/** A single scorer finding. `path` is `blocks[i].props.…` dotted/indexed. */
export interface EvalViolation {
  scorer: string;
  path: string;
  value: string;
  detail?: string;
}

/** One pure scorer's output: score in [0, 1] (1 = clean) + its findings. */
export interface ScorerResult {
  score: number;
  violations: EvalViolation[];
}

export const SCORER_NAMES = [
  "fabricatedStat",
  "placeholderLeak",
  "emptyImageSlot",
  "bannedPhrase",
  "structural",
  "subjectLeak",
  "degradation",
] as const;

export type ScorerName = (typeof SCORER_NAMES)[number];

/** Aggregate report for one brief run. */
export interface EvalReport {
  briefId: string;
  scores: Record<ScorerName, number>;
  violations: EvalViolation[];
  /** True when every scorer met its (default or per-brief) threshold AND all
   *  non-score expectations (block count, usedReference, …) held. */
  passed: boolean;
  /** Human-readable reasons for `passed === false`. */
  failures: string[];
}

/** Per-brief scoring knobs. Everything is optional — defaults are strict. */
export interface BriefExpectations {
  /** Extra stat values (beyond those derivable from the brand config and the
   *  prompt) that the fabricated-stat scorer must treat as approved. */
  allowedStats?: string[];
  /** Case-insensitive word-boundary markers that must NOT appear anywhere in
   *  the output (e.g. ["Dandy", "Heartland"] for non-Dandy briefs). */
  subjectLeakMarkers?: string[];
  /** Structural roles that must be covered (block-tags taxonomy). Defaults to
   *  ["hero", "cta", "footer"]. */
  requiredRoles?: string[];
  minBlocks?: number;
  maxBlocks?: number;
  /** When set, the response's `usedReference` must equal this. */
  expectUsedReference?: boolean;
  /** Degradation codes that MUST appear (e.g. reference_scrape_failed for the
   *  unreachable-host brief). Missing ones fail the brief. */
  expectDegradationCodes?: string[];
  /** Warn-severity degradation codes tolerated without a score penalty. */
  allowedDegradationCodes?: string[];
  /** Extra block types treated as image-led by emptyImageSlotScore, on top of
   *  the hero/media role-tag default. */
  imageLedTypes?: string[];
  /** Minimum acceptable score per scorer; overrides DEFAULT_THRESHOLDS. */
  thresholds?: Partial<Record<ScorerName, number>>;
}

/** Brand state the runner seeds for the brief's tenant. */
export interface BriefBrand {
  /** tenants.plan — defaults to "growth". */
  plan?: string;
  /** lp_brand_settings.config JSON, verbatim (BrandConfig shape). */
  config: Record<string, unknown>;
  /** Template page seeded when request.templateId === "$TEMPLATE". */
  template?: { title: string; blocks: EvalBlock[] };
}

/** POST /lp/generate-page body. `templateId: "$TEMPLATE"` is replaced by the
 *  id of the seeded `brand.template` page at run time. */
export interface BriefRequest {
  prompt: string;
  templateId?: number | "$TEMPLATE";
  sourcePageId?: number;
  replaceImagery?: boolean;
  referenceUrl?: string;
  referenceUrls?: string[];
  segmentContext?: Record<string, unknown>;
  excludeRecipeIds?: string[];
  [key: string]: unknown;
}

export interface GoldenBrief {
  id: string;
  description: string;
  request: BriefRequest;
  brand: BriefBrand;
  expectations: BriefExpectations;
}
