/**
 * PURE scorers for golden-brief generation evals.
 *
 * Every scorer is a total, side-effect-free function over a generation result
 * (the JSON body /lp/generate-page returns) — no DB, no network, no env. That
 * keeps scorers.test.ts hermetic and lets the runner (run.ts) and any future
 * offline analysis share one scoring surface.
 *
 * Fidelity note: the stat / placeholder detection here intentionally MIRRORS
 * the production machinery in routes/lp/generate-page.ts (STAT_LIKE_RX,
 * scanForUnapprovedStats, PLACEHOLDER_TESTIMONIAL_TEXT_RE). Those are not
 * exported from the route module and we must not modify it to add exports, so
 * standalone equivalents live here; the shared PURE libs that ARE exported
 * (banned-phrase-validator, factFlags idiom detection, block-tags roles) are
 * imported directly so the eval can't drift from production on those.
 */
import { resolveBlockTags } from "@workspace/lp-template-engine";
import { findBannedPhrases } from "../lib/ai-prompts/banned-phrase-validator";
import { isNonStatIdiom, siblingLabelText } from "../lib/factFlags/detect";
import type {
  BriefExpectations,
  EvalBlock,
  EvalDegradation,
  EvalReport,
  EvalViolation,
  GenerationResultLike,
  ScorerName,
  ScorerResult,
} from "./types";

// ── Scoring convention ───────────────────────────────────────────────────────

/** Each violation costs a fixed slice of the score; 4+ violations floor at 0.
 *  Linear + deterministic so baseline diffs are monotone in violation count. */
const PENALTY_PER_VIOLATION = 0.25;

function penaltyScore(violations: EvalViolation[]): number {
  const raw = 1 - violations.length * PENALTY_PER_VIOLATION;
  return Math.max(0, Number(raw.toFixed(4)));
}

/** Minimum acceptable per-scorer scores when a brief doesn't override them.
 *  Fabrication / placeholder / subject leaks are hard failures (any hit
 *  fails); style and structure tolerate one finding. */
export const DEFAULT_THRESHOLDS: Record<ScorerName, number> = {
  fabricatedStat: 1,
  placeholderLeak: 1,
  emptyImageSlot: 0.75,
  bannedPhrase: 0.75,
  structural: 0.75,
  subjectLeak: 1,
  degradation: 0.5,
};

// ── Shared block walking ─────────────────────────────────────────────────────

interface StringLeaf {
  /** e.g. `blocks[2].props.stats[0].value` */
  path: string;
  key: string;
  value: string;
  /** The leaf's enclosing object — lets stat detection read sibling labels. */
  siblings: Record<string, unknown>;
  blockType: string;
}

const MAX_WALK_DEPTH = 8;

function* walkStringLeaves(blocks: EvalBlock[] | undefined): Generator<StringLeaf> {
  if (!Array.isArray(blocks)) return;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || typeof block !== "object") continue;
    const blockType = typeof block.type === "string" ? block.type : "";
    const stack: Array<{ node: unknown; path: string; depth: number }> = [
      { node: (block as EvalBlock).props, path: `blocks[${i}].props`, depth: 0 },
    ];
    while (stack.length > 0) {
      const { node, path, depth } = stack.pop() as { node: unknown; path: string; depth: number };
      if (!node || typeof node !== "object" || depth > MAX_WALK_DEPTH) continue;
      if (Array.isArray(node)) {
        node.forEach((child, idx) => stack.push({ node: child, path: `${path}[${idx}]`, depth: depth + 1 }));
        continue;
      }
      const rec = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(rec)) {
        const childPath = `${path}.${k}`;
        if (typeof v === "string") {
          yield { path: childPath, key: k, value: v, siblings: rec, blockType };
        } else if (v && typeof v === "object") {
          stack.push({ node: v, path: childPath, depth: depth + 1 });
        }
      }
    }
  }
}

// ── 1. Fabricated stats ──────────────────────────────────────────────────────

/** Mirror of generate-page's STAT_FIELD_KEYS (fields that always carry a stat). */
const STAT_FIELD_KEYS = new Set([
  "value", "stat", "metric", "stat1Value", "stat2Value", "stat3Value",
  "metricValue", "statValue", "number",
]);

/** Mirror of generate-page's STAT_LIKE_RX (digit + stat-shaped suffix). */
const STAT_LIKE_RX =
  /\b\d+(?:[.,]\d+)?\s*(?:%(?![A-Za-z0-9])|\+(?![A-Za-z0-9])|[×★](?![A-Za-z0-9])|(?:x|k|m|b|hrs?|mins?)\b|(?:million|billion|customers?|patients?|practices?|locations?|users?|members?|reviews?|stars?|days?|hours?|minutes?|years?|months?|weeks?)\b)/i;

/** Mirror of generate-page's prompt-token extraction: stat-shaped tokens in
 *  the user's own prompt are approved by definition. */
const PROMPT_STAT_TOKEN_RX = /[$€£]?\d[\d.,/]*(?:[-\s]?(?:%|\+|×|★|[a-z]+))?/gi;

function normalizeStat(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Mirror of generate-page's isApprovedStat: substring match either way. */
export function isApprovedStat(value: string, pool: ReadonlySet<string>): boolean {
  const v = normalizeStat(value);
  if (!v) return true;
  if (!/\d/.test(v)) return true; // not a numeric stat — leave alone
  if (pool.has(v)) return true;
  for (const approved of pool) {
    if (!approved) continue;
    if (v.includes(approved) || approved.includes(v)) return true;
  }
  return false;
}

/**
 * Build the approved-stat pool for a brief from its brand config + prompt +
 * explicit extras — the pure analogue of the route's buildApprovedStatSet.
 * Covers the config-borne sources a seeded eval tenant can carry (prompt
 * tokens, product-line claims, segment stats, scraped stats); DB-backed
 * sources (proof-point library, case studies) are out of scope for briefs.
 */
export function approvedStatPool(
  brandConfig: Record<string, unknown>,
  prompt: string,
  extraAllowed: Iterable<string> = [],
): Set<string> {
  const pool = new Set<string>();
  const add = (raw: unknown): void => {
    const v = normalizeStat(raw);
    if (v) pool.add(v);
  };
  if (typeof prompt === "string" && prompt.trim()) {
    for (const m of prompt.matchAll(PROMPT_STAT_TOKEN_RX)) add(m[0]);
  }
  const productLines = Array.isArray(brandConfig["productLines"]) ? (brandConfig["productLines"] as unknown[]) : [];
  for (const p of productLines) {
    if (!p || typeof p !== "object") continue;
    const claims = (p as Record<string, unknown>)["claims"];
    if (!Array.isArray(claims)) continue;
    for (const c of claims) {
      if (typeof c === "string") add(c);
      else if (c && typeof c === "object") {
        const rec = c as Record<string, unknown>;
        if (rec["approvedForAi"] !== false) add(rec["text"]);
      }
    }
  }
  const segments = Array.isArray(brandConfig["segments"]) ? (brandConfig["segments"] as unknown[]) : [];
  for (const seg of segments) {
    if (!seg || typeof seg !== "object") continue;
    const stats = (seg as Record<string, unknown>)["stats"];
    if (!Array.isArray(stats)) continue;
    for (const s of stats) {
      if (!s || typeof s !== "object") continue;
      const rec = s as Record<string, unknown>;
      if (rec["approvedForAi"] !== false) add(rec["value"]);
    }
  }
  const scrapedStats = Array.isArray(brandConfig["scrapedStats"]) ? (brandConfig["scrapedStats"] as unknown[]) : [];
  for (const s of scrapedStats) {
    if (!s || typeof s !== "object") continue;
    const rec = s as Record<string, unknown>;
    if (rec["approvedForAi"] !== false) add(rec["value"]);
  }
  for (const v of extraAllowed) add(v);
  return pool;
}

/**
 * Flags stat-like strings in block props that don't (substring-)match the
 * allowed set — the eval-side twin of the route's scanForUnapprovedStats.
 * Numeric idioms (time/ratio shorthand, imperative UI copy, ranges) are
 * excluded via the shared factFlags idiom detector so the eval agrees with
 * production telemetry.
 */
export function fabricatedStatScore(
  blocks: EvalBlock[] | undefined,
  allowedStats: Iterable<string>,
): ScorerResult {
  const pool = new Set<string>();
  for (const s of allowedStats) {
    const v = normalizeStat(s);
    if (v) pool.add(v);
  }
  const violations: EvalViolation[] = [];
  for (const leaf of walkStringLeaves(blocks)) {
    if (!/\d/.test(leaf.value)) continue;
    if (isNonStatIdiom(leaf.value, siblingLabelText(leaf.siblings))) continue;
    const isStatField = STAT_FIELD_KEYS.has(leaf.key);
    const looksLikeStat = STAT_LIKE_RX.test(leaf.value);
    if ((isStatField || looksLikeStat) && !isApprovedStat(leaf.value, pool)) {
      violations.push({
        scorer: "fabricatedStat",
        path: leaf.path,
        value: leaf.value,
        detail: `stat-like value not in the approved pool (block type "${leaf.blockType}")`,
      });
    }
  }
  return { score: penaltyScore(violations), violations };
}

// ── 2. Placeholder leaks ─────────────────────────────────────────────────────

/** Mirror of PLACEHOLDER_TESTIMONIAL_TEXT_RE, widened with the generic
 *  bracket/mustache placeholder shapes briefs have surfaced. */
const PLACEHOLDER_TEXT_RE =
  /\badd (?:a|an|your) (?:quote|role|name|title|company|author|testimonial|case stud\w*)\b|\bbrand settings\b|\breplace (?:this|with)\b|\bcustomer name\b|\bplaceholder\b|\blorem ipsum\b|\[(?:insert|add|your|company|placeholder)[^\]]*\]|\{\{[^}]*\}\}/i;

/** Flags placeholder copy that should never ship on a generated page. */
export function placeholderLeakScore(blocks: EvalBlock[] | undefined): ScorerResult {
  const violations: EvalViolation[] = [];
  for (const leaf of walkStringLeaves(blocks)) {
    if (PLACEHOLDER_TEXT_RE.test(leaf.value)) {
      violations.push({
        scorer: "placeholderLeak",
        path: leaf.path,
        value: leaf.value.slice(0, 120),
        detail: `placeholder text leaked into block type "${leaf.blockType}"`,
      });
    }
  }
  return { score: penaltyScore(violations), violations };
}

// ── 3. Empty image slots ─────────────────────────────────────────────────────

/** Prop keys that carry a single image URL (subset of the route's
 *  GOVERNANCE_IMAGE_FIELD_KEYS — only keys where "" means a visibly broken
 *  slot; icon/logo keys are excluded, they have text/SVG fallbacks). */
const IMAGE_URL_FIELD_KEYS = new Set([
  "image", "imageUrl", "imageSrc", "src",
  "backgroundImage", "bgImage",
  "photo", "photoUrl",
  "media", "mediaUrl",
  "poster", "thumbnail", "thumbnailUrl",
]);

/**
 * Flags empty image props on image-led blocks. A block is image-led when its
 * role tags (block-tags taxonomy) include "hero" or "media", or its type is
 * in the caller's extra set. Non-image-led blocks are ignored: many card
 * schemas define an optional image with an icon fallback and "" is legal.
 */
export function emptyImageSlotScore(
  blocks: EvalBlock[] | undefined,
  extraImageLedTypes: ReadonlySet<string> = new Set(),
): ScorerResult {
  const violations: EvalViolation[] = [];
  if (!Array.isArray(blocks)) return { score: 1, violations };
  const imageLed = (type: string): boolean => {
    if (extraImageLedTypes.has(type)) return true;
    const tags = resolveBlockTags(type);
    return tags.includes("hero") || tags.includes("media");
  };
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || typeof block !== "object") continue;
    const type = typeof block.type === "string" ? block.type : "";
    if (!type || !imageLed(type)) continue;
    for (const leaf of walkStringLeaves([block])) {
      if (!IMAGE_URL_FIELD_KEYS.has(leaf.key)) continue;
      if (leaf.value.trim() !== "") continue;
      violations.push({
        scorer: "emptyImageSlot",
        // Re-anchor the path at the block's real index (walk saw a 1-list).
        path: leaf.path.replace(/^blocks\[0\]/, `blocks[${i}]`),
        value: "",
        detail: `empty image prop "${leaf.key}" on image-led block type "${type}"`,
      });
    }
  }
  return { score: penaltyScore(violations), violations };
}

// ── 4. Banned phrases ────────────────────────────────────────────────────────

/** Delegates to the production banned-phrase validator (GLOBAL_CLICHES +
 *  per-brand avoidPhrases) so the eval can never drift from what the route
 *  itself flags. */
export function bannedPhraseScore(
  blocks: EvalBlock[] | undefined,
  brandAvoidPhrases: string[] = [],
): ScorerResult {
  const hits = findBannedPhrases(Array.isArray(blocks) ? blocks : [], brandAvoidPhrases);
  const violations: EvalViolation[] = hits.map((h) => ({
    scorer: "bannedPhrase",
    path: `${h.blockId ? `block "${h.blockId}" ` : ""}${h.field}`,
    value: h.phrase,
    detail: `${h.source} banned phrase in "${h.blockType}": …${h.snippet}…`,
  }));
  return { score: penaltyScore(violations), violations };
}

// ── 5. Structure ─────────────────────────────────────────────────────────────

const DEFAULT_REQUIRED_ROLES = ["hero", "cta", "footer"] as const;

/**
 * Structural sanity: required roles covered (per the block-tags taxonomy),
 * block ids present and unique, every block a typed object with an object
 * `props` bag, and no null values anywhere in props (undefined can't survive
 * JSON; null renders as a hole).
 */
export function structuralScore(
  blocks: EvalBlock[] | undefined,
  requiredRoles: readonly string[] = DEFAULT_REQUIRED_ROLES,
): ScorerResult {
  const violations: EvalViolation[] = [];
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return {
      score: 0,
      violations: [{ scorer: "structural", path: "blocks", value: "", detail: "no blocks in result" }],
    };
  }
  const covered = new Set<string>();
  const seenIds = new Map<string, number>();
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const path = `blocks[${i}]`;
    if (!block || typeof block !== "object") {
      violations.push({ scorer: "structural", path, value: String(block), detail: "block is not an object" });
      continue;
    }
    const type = typeof block.type === "string" ? block.type : "";
    if (!type) {
      violations.push({ scorer: "structural", path: `${path}.type`, value: String(block.type), detail: "missing block type" });
    } else {
      for (const tag of resolveBlockTags(type)) covered.add(tag);
    }
    const id = typeof block.id === "string" ? block.id.trim() : "";
    if (!id) {
      violations.push({ scorer: "structural", path: `${path}.id`, value: String(block.id), detail: "missing block id" });
    } else if (seenIds.has(id)) {
      violations.push({
        scorer: "structural",
        path: `${path}.id`,
        value: id,
        detail: `duplicate block id (first seen at blocks[${seenIds.get(id)}])`,
      });
    } else {
      seenIds.set(id, i);
    }
    const props = (block as EvalBlock).props;
    if (!props || typeof props !== "object" || Array.isArray(props)) {
      violations.push({ scorer: "structural", path: `${path}.props`, value: String(props), detail: "props is not an object" });
      continue;
    }
    // Deep null scan (bounded like the string walk).
    const stack: Array<{ node: unknown; p: string; depth: number }> = [{ node: props, p: `${path}.props`, depth: 0 }];
    while (stack.length > 0) {
      const { node, p, depth } = stack.pop() as { node: unknown; p: string; depth: number };
      if (!node || typeof node !== "object" || depth > MAX_WALK_DEPTH) continue;
      const entries: Array<[string, unknown]> = Array.isArray(node)
        ? node.map((v, idx): [string, unknown] => [`[${idx}]`, v])
        : Object.entries(node as Record<string, unknown>);
      for (const [k, v] of entries) {
        const childPath = k.startsWith("[") ? `${p}${k}` : `${p}.${k}`;
        if (v === null || v === undefined) {
          violations.push({ scorer: "structural", path: childPath, value: String(v), detail: "null/undefined prop value" });
        } else if (typeof v === "object") {
          stack.push({ node: v, p: childPath, depth: depth + 1 });
        }
      }
    }
  }
  for (const role of requiredRoles) {
    if (!covered.has(role)) {
      violations.push({ scorer: "structural", path: "blocks", value: role, detail: `no block covers required role "${role}"` });
    }
  }
  return { score: penaltyScore(violations), violations };
}

// ── 6. Subject leaks ─────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Flags configurable marker terms (other tenants' brand names, e.g. "Dandy"
 * on a non-Dandy brief) anywhere in the title or block copy — the smoking gun
 * for prompt-context bleeding across subjects. Case-insensitive, word-bounded.
 */
export function subjectLeakScore(
  blocks: EvalBlock[] | undefined,
  markers: readonly string[],
  title = "",
): ScorerResult {
  const violations: EvalViolation[] = [];
  const compiled = markers
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .map((m) => ({
      marker: m,
      re: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(m)}(?=$|[^\\p{L}\\p{N}])`, "iu"),
    }));
  if (compiled.length === 0) return { score: 1, violations };
  const check = (text: string, path: string): void => {
    for (const { marker, re } of compiled) {
      if (re.test(text)) {
        violations.push({
          scorer: "subjectLeak",
          path,
          value: marker,
          detail: `marker "${marker}" leaked into: ${text.slice(0, 120)}`,
        });
      }
    }
  };
  if (title) check(title, "title");
  for (const leaf of walkStringLeaves(blocks)) check(leaf.value, leaf.path);
  return { score: penaltyScore(violations), violations };
}

// ── 7. Degradations ──────────────────────────────────────────────────────────

/**
 * Consumes the route's quality ledger: each warn-severity degradation not in
 * the brief's allow-list costs score; info entries are free. Codes the brief
 * REQUIRES (expectDegradationCodes) are checked in the aggregate, not here.
 */
export function degradationScore(
  degradations: EvalDegradation[] | undefined,
  allowedCodes: readonly string[] = [],
): ScorerResult {
  const allowed = new Set(allowedCodes);
  const violations: EvalViolation[] = [];
  for (const d of Array.isArray(degradations) ? degradations : []) {
    if (!d || typeof d !== "object") continue;
    if (d.severity !== "warn") continue;
    if (allowed.has(d.code)) continue;
    violations.push({
      scorer: "degradation",
      path: `degradations[${d.code}]`,
      value: d.code,
      detail: d.detail,
    });
  }
  return { score: penaltyScore(violations), violations };
}

// ── Aggregate ────────────────────────────────────────────────────────────────

export interface ScoreGenerationInput {
  briefId: string;
  result: GenerationResultLike;
  expectations?: BriefExpectations;
  /** The brand's avoidPhrases (layered over the global cliché list). */
  brandAvoidPhrases?: string[];
  /** Fully-resolved approved-stat pool (see approvedStatPool). */
  allowedStats?: Iterable<string>;
}

/** Runs every scorer over one generation result and folds in the brief's
 *  non-score expectations. Pure. */
export function scoreGeneration(input: ScoreGenerationInput): EvalReport {
  const { briefId, result } = input;
  const exp = input.expectations ?? {};
  const blocks = Array.isArray(result.blocks) ? result.blocks : [];

  const results: Record<ScorerName, ScorerResult> = {
    fabricatedStat: fabricatedStatScore(blocks, input.allowedStats ?? exp.allowedStats ?? []),
    placeholderLeak: placeholderLeakScore(blocks),
    emptyImageSlot: emptyImageSlotScore(blocks, new Set(exp.imageLedTypes ?? [])),
    bannedPhrase: bannedPhraseScore(blocks, input.brandAvoidPhrases ?? []),
    structural: structuralScore(blocks, exp.requiredRoles ?? DEFAULT_REQUIRED_ROLES),
    subjectLeak: subjectLeakScore(blocks, exp.subjectLeakMarkers ?? [], typeof result.title === "string" ? result.title : ""),
    degradation: degradationScore(result.degradations, exp.allowedDegradationCodes ?? []),
  };

  const scores = Object.fromEntries(
    (Object.entries(results) as Array<[ScorerName, ScorerResult]>).map(([name, r]) => [name, r.score]),
  ) as Record<ScorerName, number>;
  const violations = (Object.values(results) as ScorerResult[]).flatMap((r) => r.violations);

  const failures: string[] = [];
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(exp.thresholds ?? {}) };
  for (const [name, min] of Object.entries(thresholds) as Array<[ScorerName, number]>) {
    if (scores[name] < min) {
      failures.push(`${name} score ${scores[name]} below threshold ${min}`);
    }
  }
  if (typeof exp.minBlocks === "number" && blocks.length < exp.minBlocks) {
    failures.push(`page has ${blocks.length} blocks, expected at least ${exp.minBlocks}`);
  }
  if (typeof exp.maxBlocks === "number" && blocks.length > exp.maxBlocks) {
    failures.push(`page has ${blocks.length} blocks, expected at most ${exp.maxBlocks}`);
  }
  if (typeof exp.expectUsedReference === "boolean" && result.usedReference !== exp.expectUsedReference) {
    failures.push(`usedReference is ${String(result.usedReference)}, expected ${String(exp.expectUsedReference)}`);
  }
  for (const code of exp.expectDegradationCodes ?? []) {
    const present = (result.degradations ?? []).some((d) => d && d.code === code);
    if (!present) failures.push(`expected degradation code "${code}" is missing`);
  }

  return { briefId, scores, violations, passed: failures.length === 0, failures };
}
