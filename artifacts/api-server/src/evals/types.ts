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
  "lineupDiversity",
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
  /** Block types that must NOT appear in the result (e.g. types a governance
   *  seed set to ai_mode "noai"). Any occurrence fails the brief. */
  forbiddenBlockTypes?: string[];
  /** Minimum acceptable score per scorer; overrides DEFAULT_THRESHOLDS. */
  thresholds?: Partial<Record<ScorerName, number>>;
}

/** Brand state the runner seeds for the brief's tenant. */
export interface BriefBrand {
  /** tenants.plan — defaults to "growth". */
  plan?: string;
  /** lp_brand_settings.config JSON, verbatim (BrandConfig shape). */
  config: Record<string, unknown>;
  /** Audience segments (BrandAudienceSegment[] shape from
   *  routes/sales/generate-microsite.ts). Convenience for microsite briefs:
   *  merged into `config.segments` at seed time (wins over config.segments).
   *  Page briefs may keep embedding segments directly in `config`. */
  segments?: Array<Record<string, unknown>>;
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

/** POST /sales/accounts/:accountId/generate-microsite body (subset the eval
 *  briefs exercise — see generateMicrositeHandler's body parsing). All fields
 *  optional: an empty body drives the freeform "microsite" recipe path. */
export interface MicrositeBriefRequest {
  prompt?: string;
  /** Resolved against the seeded brand's segments (id, falling back to name).
   *  An unknown id fails closed with a 400 in the route, so the runner
   *  validates it against the brief's segment seed before generating. */
  segmentId?: string;
  personaId?: string;
  objective?: string;
  templateId?: number;
  replaceImagery?: boolean;
  referenceUrl?: string;
  referenceUrls?: string[];
  [key: string]: unknown;
}

/** The sales_accounts row the runner seeds for a microsite brief. */
export interface BriefAccount {
  name: string;
  domain?: string;
  /** sales_accounts.segment, e.g. "DSO" | "DSO Practice" | "Independent". */
  segment?: string;
  numLocations?: number;
}

/** Lineup-diversity probe: seed N name-variant accounts, generate once per
 *  account, and score distinct skeleton signatures / N (lineupDiversity). */
export interface DiversityProbe {
  /** Number of accounts to seed + generate for (2..8). */
  accounts: number;
}

/** One tenant_block_governance row the runner seeds (tenant-scoped). */
export interface BriefGovernanceRule {
  blockType: string;
  /** 'open' | 'copy' | 'locked' | 'noai' — defaults to 'open'. */
  aiMode?: "open" | "copy" | "locked" | "noai";
  /** NULL = inherit (available); false = tenant-disabled. */
  enabled?: boolean;
  /** Brand-segment ids this block is approved for. */
  segments?: string[];
}

export interface GoldenBrief {
  id: string;
  description: string;
  /** "page" (default) → POST /lp/generate-page through the express stack;
   *  "microsite" → generateMicrositeHandler invoked directly. */
  kind?: "page" | "microsite";
  request: BriefRequest | MicrositeBriefRequest;
  brand: BriefBrand;
  /** Required when kind === "microsite": the sales account to pitch. */
  account?: BriefAccount;
  /** Optional (microsite only): generate for N account variants and score
   *  lineup diversity. */
  diversityProbe?: DiversityProbe;
  /** Optional tenant_block_governance seed rows. */
  governance?: BriefGovernanceRule[];
  expectations: BriefExpectations;
}
