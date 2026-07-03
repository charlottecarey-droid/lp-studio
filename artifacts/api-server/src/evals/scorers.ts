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
  // Diversity-probe briefs only: at least half of the probe's generations
  // must have distinct skeletons. Single-generation briefs always score 1
  // (the scorer is a constant 1 when there is nothing to compare), so this
  // threshold is inert for them.
  lineupDiversity: 0.5,
  // Brand design-direction adherence (CTA hex, intensity background rhythm,
  // no text-bearing backgrounds). One finding tolerated — rhythm reads on a
  // heavily-shuffled lineup can be legitimately borderline.
  brandFidelity: 0.75,
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

/** Mirror of generate-page's canonicalizeStatForm: trivial reformattings of
 *  the SAME number ("12,000" == "12k", "45-minute" == "45 min") match. */
function canonicalizeStatForm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/(\d[\d,.]*)\s*([kmb])\b/g, (_, num: string, suf: string) => {
      const n = parseFloat(num.replace(/,/g, ""));
      if (!isFinite(n)) return num;
      const mult = suf === "k" ? 1e3 : suf === "m" ? 1e6 : 1e9;
      return String(Math.round(n * mult));
    })
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    // a trailing "+" glued to a number adds no factual specificity
    .replace(/(\d)\+/g, "$1")
    .replace(/\bminutes?\b/g, "min")
    .replace(/\bhours?\b/g, "hr")
    .replace(/\bseconds?\b/g, "sec")
    .replace(/\s+/g, " ");
}

/** Mirror of generate-page's isApprovedStat: substring match either way,
 *  with canonicalized-form fallback. */
export function isApprovedStat(value: string, pool: ReadonlySet<string>): boolean {
  const v = normalizeStat(value);
  if (!v) return true;
  if (!/\d/.test(v)) return true; // not a numeric stat — leave alone
  if (pool.has(v)) return true;
  const vc = canonicalizeStatForm(v);
  for (const approved of pool) {
    if (!approved) continue;
    if (v.includes(approved) || approved.includes(v)) return true;
    const ac = canonicalizeStatForm(approved);
    if (ac && vc && (vc.includes(ac) || ac.includes(vc))) return true;
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
  flaggedValues: Iterable<string> = [],
): ScorerResult {
  const pool = new Set<string>();
  for (const s of allowedStats) {
    const v = normalizeStat(s);
    if (v) pool.add(v);
  }
  // Strict Facts is deliberately flag-and-review, NOT block: an unapproved
  // stat the server FLAGGED (strictMismatches) is the product working as
  // designed — the review UI surfaces it. Only an unapproved stat the
  // scanner MISSED counts as a fabrication escape here.
  const flagged = new Set<string>();
  for (const f of flaggedValues) {
    const v = normalizeStat(f);
    if (v) flagged.add(v);
  }
  const violations: EvalViolation[] = [];
  for (const leaf of walkStringLeaves(blocks)) {
    if (!/\d/.test(leaf.value)) continue;
    if (isNonStatIdiom(leaf.value, siblingLabelText(leaf.siblings))) continue;
    const isStatField = STAT_FIELD_KEYS.has(leaf.key);
    const looksLikeStat = STAT_LIKE_RX.test(leaf.value);
    // Mirror the production ordinal guard: bare 1-2 digit sequence numbers
    // (steps[].number "01") are not factual claims.
    if (isStatField && !looksLikeStat && /^0?\d{1,2}$/.test(leaf.value.trim())) continue;
    if (!(isStatField || looksLikeStat) || isApprovedStat(leaf.value, pool)) continue;
    if (isApprovedStat(leaf.value, flagged)) continue;
    violations.push({
      scorer: "fabricatedStat",
      path: leaf.path,
      value: leaf.value,
      detail: `stat-like value neither approved nor flagged for review (block type "${leaf.blockType}")`,
    });
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
/** Mirror of generate-page.ts SELF_CONTAINED_FULL_PAGE_TYPES (bake nav AND
 *  footer — a one-block page of these is complete) — flagged as a mirror, not
 *  imported, because the route module has side effects. */
const FULL_PAGE_ALL_ROLES_TYPES = new Set([
  "content-series", "webinar-hub", "blog-series", "storefront",
  "event-noir", "event-luminous", "event-split",
  "case-metrics", "case-editorial", "case-modular",
]);
/** Self-chrome blocks that bake their own hero + nav + CTA surfaces but NOT a
 *  footer (production still injects one): event-page, business-case-*. */
const SELF_HERO_CTA_TYPES = new Set(["event-page"]);

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
      if (FULL_PAGE_ALL_ROLES_TYPES.has(type)) {
        for (const r of requiredRoles) covered.add(r);
      } else if (SELF_HERO_CTA_TYPES.has(type) || type.startsWith("business-case")) {
        covered.add("hero");
        covered.add("cta");
      }
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
        if (v === null) {
          // null SURVIVES JSON serialization and reaches the renderer;
          // undefined is dropped by res.json / JSON.stringify, so the client
          // never sees it — flagging it was an eval-shim artifact (first full
          // matrix run: bento tiles[].primary, hero accentColor).
          violations.push({ scorer: "structural", path: childPath, value: String(v), detail: "null prop value" });
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
/** Ledger codes the degradation scorer always tolerates: copy-polish signals
 *  (critique skipped/unresolved) are already measured by the bannedPhrase
 *  scorer over the FINAL page — penalizing them here double-counted the same
 *  finding (the recurring one-warn 0.25 dips across early runs). */
const ALWAYS_ALLOWED_DEGRADATION_CODES = ["critique_skipped", "critique_unresolved"] as const;

export function degradationScore(
  degradations: EvalDegradation[] | undefined,
  allowedCodes: readonly string[] = [],
): ScorerResult {
  const allowed = new Set([...ALWAYS_ALLOWED_DEGRADATION_CODES, ...allowedCodes]);
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

// ── 8. Lineup diversity (microsite diversity probe) ─────────────────────────

/** Chrome block = header/nav or footer per the shared block-tags taxonomy —
 *  injected deterministically by the route (ensureMicrositeNavbar, required-
 *  role backfill), so it carries no signal about layout variety. */
function isChromeBlockType(type: string): boolean {
  const tags = resolveBlockTags(type);
  return tags.includes("header") || tags.includes("footer");
}

/**
 * A page's skeleton signature: its ordered block types, EXCLUDING nav/footer
 * chrome. Two microsites with the same signature are structurally identical
 * lineups — the "every account gets the same page" bug class this week's
 * diversity probe pins.
 */
export function lineupSignature(blocks: EvalBlock[] | undefined): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => (b && typeof b === "object" && typeof b.type === "string" ? b.type : ""))
    .filter((t) => t !== "" && !isChromeBlockType(t))
    .join(" > ");
}

/** One generation in a diversity probe: a label (the seeded account name) and
 *  the blocks it produced. */
export interface LineupPage {
  label: string;
  blocks: EvalBlock[] | undefined;
}

/**
 * Diversity across N generations: score = distinctSignatures / N (1.0 = every
 * page structurally different). Each signature shared by 2+ pages is one
 * violation listing the offending accounts. With 0 or 1 pages there is nothing
 * to compare, so the score is a constant 1 — the same value non-probe briefs
 * carry, keeping reports/baselines total across brief kinds.
 */
export function lineupDiversityScore(pages: readonly LineupPage[]): ScorerResult {
  if (pages.length <= 1) return { score: 1, violations: [] };
  const bySignature = new Map<string, string[]>();
  for (const page of pages) {
    const sig = lineupSignature(page.blocks);
    const labels = bySignature.get(sig);
    if (labels) labels.push(page.label);
    else bySignature.set(sig, [page.label]);
  }
  const score = Number((bySignature.size / pages.length).toFixed(4));
  const violations: EvalViolation[] = [];
  for (const [sig, labels] of bySignature) {
    if (labels.length < 2) continue;
    violations.push({
      scorer: "lineupDiversity",
      path: labels.join(", "),
      value: sig || "(empty skeleton)",
      detail: `${labels.length} of ${pages.length} generations share this skeleton signature`,
    });
  }
  return { score, violations };
}

// ── Aggregate ────────────────────────────────────────────────────────────────


// ── 9. Brand fidelity (July 2026) ────────────────────────────────────────────

/** Dark-leaning background presets (the design-intensity post-pass vocabulary). */
const DARKISH_BG = new Set(["dark", "black", "gradient", "dandy-green"]);
/** Accent-leaning presets the energetic post-pass injects. */
const ACCENT_BG = new Set(["dandy-green", "gradient"]);

export interface BrandFidelityInput {
  /** The brand's resolved design-intensity axis (inferDesignIntensity). */
  designIntensity?: string;
  /** The hex every ctaColor prop must carry (ctaBackground > accent > primary
   *  fallback chain — the same value the generators inject). */
  brandCtaColor?: string;
  /** Library URLs the auto-tagger marked text-bearing (promo-graphic /
   *  og-image). Backgrounds must never use one — the "two headlines" rule. */
  textBearingImageUrls?: readonly string[];
}

/**
 * brandFidelityScore — does the generated page LOOK like it followed the
 * brand's design direction? Verifies the outcomes the generation pipeline is
 * supposed to guarantee, so a silent regression in any of those passes
 * surfaces as an eval finding instead of an eyeball diff:
 *
 *  1. CTA COLOR — every non-empty `ctaColor` prop equals the brand's CTA hex
 *     (the injectBrandCtaColor post-pass contract).
 *  2. DESIGN-INTENSITY RHYTHM — the applyDesignIntensityBackgrounds contract,
 *     re-checked from the output: editorial-dense pages open with >= 2
 *     dark-leaning sections in the first 5 (non-chrome) blocks; airy-minimal
 *     pages have at most 1 there (one dark-required block is tolerated);
 *     energetic-visual pages carry >= 1 accent section in the first 3.
 *     "balanced" (or unknown) checks nothing.
 *  3. NO TEXT-BEARING BACKGROUNDS — no backgroundImage/backgroundImageUrl
 *     resolves to a library image the auto-tagger marked promo-graphic /
 *     og-image (the "two headlines" rule; see isTextBearingImage in
 *     generate-page.ts).
 */
export function brandFidelityScore(
  blocks: EvalBlock[] | undefined,
  input: BrandFidelityInput = {},
): ScorerResult {
  const violations: EvalViolation[] = [];
  const list = Array.isArray(blocks) ? blocks : [];

  // 1. CTA color coherence.
  const wantCta = (input.brandCtaColor ?? "").trim().toLowerCase();
  if (wantCta) {
    list.forEach((b, i) => {
      const props = (b && typeof b === "object" ? (b.props as Record<string, unknown>) : undefined) ?? {};
      const v = props["ctaColor"];
      if (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== wantCta) {
        violations.push({
          scorer: "brandFidelity",
          path: `blocks[${i}].props.ctaColor`,
          value: v,
          detail: `expected the brand CTA color ${input.brandCtaColor}`,
        });
      }
    });
  }

  // 2. Design-intensity background rhythm.
  const intensity = input.designIntensity ?? "";
  if (intensity === "editorial-dense" || intensity === "airy-minimal" || intensity === "energetic-visual") {
    const content = list.filter(
      (b) => b && typeof b === "object" && typeof b.type === "string" && !isChromeBlockType(b.type),
    );
    const bgOf = (b: EvalBlock): string => {
      const props = (b.props as Record<string, unknown>) ?? {};
      return typeof props["backgroundStyle"] === "string" ? (props["backgroundStyle"] as string) : "";
    };
    if (intensity === "editorial-dense") {
      const darks = content.slice(0, 5).filter((b) => DARKISH_BG.has(bgOf(b))).length;
      if (darks < 2) {
        violations.push({
          scorer: "brandFidelity",
          path: "blocks[0..4].props.backgroundStyle",
          value: String(darks),
          detail: "editorial-dense brand: expected >= 2 dark-leaning sections in the first 5 blocks",
        });
      }
    } else if (intensity === "airy-minimal") {
      const darks = content.slice(0, 5).filter((b) => DARKISH_BG.has(bgOf(b))).length;
      if (darks > 1) {
        violations.push({
          scorer: "brandFidelity",
          path: "blocks[0..4].props.backgroundStyle",
          value: String(darks),
          detail: "airy-minimal brand: expected at most 1 dark-leaning section in the first 5 blocks",
        });
      }
    } else {
      const accents = content.slice(0, 3).filter((b) => ACCENT_BG.has(bgOf(b))).length;
      if (accents < 1) {
        violations.push({
          scorer: "brandFidelity",
          path: "blocks[0..2].props.backgroundStyle",
          value: String(accents),
          detail: "energetic-visual brand: expected >= 1 accent section in the first 3 blocks",
        });
      }
    }
  }

  // 3. Text-bearing backgrounds.
  const banned = new Set((input.textBearingImageUrls ?? []).filter(Boolean));
  if (banned.size > 0) {
    list.forEach((b, i) => {
      const props = (b && typeof b === "object" ? (b.props as Record<string, unknown>) : undefined) ?? {};
      for (const key of ["backgroundImage", "backgroundImageUrl"]) {
        const v = props[key];
        if (typeof v === "string" && banned.has(v)) {
          violations.push({
            scorer: "brandFidelity",
            path: `blocks[${i}].props.${key}`,
            value: v,
            detail: "text-bearing image (promo-graphic/og) used as a background behind copy",
          });
        }
      }
    });
  }

  return { score: penaltyScore(violations), violations };
}

export interface ScoreGenerationInput {
  briefId: string;
  result: GenerationResultLike;
  expectations?: BriefExpectations;
  /** The brand's avoidPhrases (layered over the global cliché list). */
  brandAvoidPhrases?: string[];
  /** Fully-resolved approved-stat pool (see approvedStatPool). */
  allowedStats?: Iterable<string>;
  /** Precomputed lineup-diversity result (diversity-probe briefs: the runner
   *  computes it across all N generations via lineupDiversityScore). Absent →
   *  a constant clean 1, so single-generation briefs always pass. */
  lineupDiversity?: ScorerResult;
  /** Brand design-direction inputs for the brandFidelity scorer. Absent →
   *  every check it gates on is skipped (constant clean 1). */
  brandFidelity?: BrandFidelityInput;
}

/** Runs every scorer over one generation result and folds in the brief's
 *  non-score expectations. Pure. */
export function scoreGeneration(input: ScoreGenerationInput): EvalReport {
  const { briefId, result } = input;
  const exp = input.expectations ?? {};
  const blocks = Array.isArray(result.blocks) ? result.blocks : [];

  const results: Record<ScorerName, ScorerResult> = {
    fabricatedStat: fabricatedStatScore(
      blocks,
      input.allowedStats ?? exp.allowedStats ?? [],
      (result.strictMismatches ?? []).map((m) => m.value),
    ),
    placeholderLeak: placeholderLeakScore(blocks),
    emptyImageSlot: emptyImageSlotScore(blocks, new Set(exp.imageLedTypes ?? [])),
    bannedPhrase: bannedPhraseScore(blocks, input.brandAvoidPhrases ?? []),
    structural: structuralScore(blocks, exp.requiredRoles ?? DEFAULT_REQUIRED_ROLES),
    subjectLeak: subjectLeakScore(blocks, exp.subjectLeakMarkers ?? [], typeof result.title === "string" ? result.title : ""),
    degradation: degradationScore(result.degradations, exp.allowedDegradationCodes ?? []),
    lineupDiversity: input.lineupDiversity ?? { score: 1, violations: [] },
    brandFidelity: brandFidelityScore(blocks, input.brandFidelity ?? {}),
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
  for (const forbidden of exp.forbiddenBlockTypes ?? []) {
    const idx = blocks.findIndex((b) => b && typeof b === "object" && b.type === forbidden);
    if (idx >= 0) failures.push(`forbidden block type "${forbidden}" present at blocks[${idx}]`);
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
