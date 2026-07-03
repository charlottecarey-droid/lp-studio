/**
 * Banned-phrase post-validator (Workstream B of the May 2026 AI output-quality
 * plan).
 *
 * The generation prompts already *instruct* the model to avoid clichés (the
 * density doctrine in SYSTEM_PROMPT) and the brand's own `avoidPhrases`
 * (injected as "BANNED PHRASES" into the prompt). But instructions are not
 * enforcement: gpt-4o still leaks "industry-leading", "seamless", "unlock", and
 * the brand's explicitly-forbidden phrases into generated copy.
 *
 * This module scans the *output* blocks after generation and reports every hit.
 * It is non-destructive — it only flags. The hits are:
 *   - logged (event "ai_banned_phrase_hits") for measurement,
 *   - persisted to ai_generation_log.banned_phrase_hits for correlation,
 *   - returned in the API response so the editor (and Workstream C's critique
 *     pass) can target the worst blocks for a rewrite.
 *
 * Source of truth for the global cliché list is GLOBAL_CLICHES below; the same
 * list is referenced in the system-prompt density doctrine, so keep them
 * conceptually in sync.
 */

/**
 * Generic AI/marketing clichés that read as filler regardless of brand. Kept
 * deliberately conservative — only phrases that are almost never the right
 * choice in shipped landing-page copy — to keep false positives low. Per-brand
 * `avoidPhrases` layer on top of this at call time.
 *
 * Multi-word entries are matched as a contiguous phrase; single words are
 * matched on word boundaries (so "unlock" does not match "unlocked"… actually
 * it will via the boundary on each side — see matchesPhrase for the exact
 * semantics).
 */
export const GLOBAL_CLICHES: readonly string[] = [
  "industry-leading",
  "industry leading",
  "best-in-class",
  "best in class",
  "world-class",
  "world class",
  "cutting-edge",
  "cutting edge",
  "bleeding-edge",
  "state-of-the-art",
  "next-generation",
  "next generation",
  "game-changer",
  "game changer",
  "game-changing",
  "paradigm shift",
  "synergy",
  "synergies",
  "streamline workflows",
  "unlock value",
  "unlock the power",
  "harness the power",
  "take it to the next level",
  "move the needle",
  "low-hanging fruit",
  "thought leader",
  "thought leadership",
  "in today's fast-paced world",
  "in today's fast paced world",
  "revolutionize",
  "revolutionary",
  "supercharge",
  "turnkey solution",
  "holistic approach",
  "seamlessly integrate",
  "elevate your",
  "empower your",
  // June 2026 copy-quality audit — the four generic openers that regressed
  // page + microsite copy. Listed here so the output validator catches them
  // even when a caller passes a brand-only avoidPhrases list.
  "transform your business",
  "unlock your potential",
  "revolutionize your workflow",
  "take things to the next level",
];

export interface BannedPhraseHit {
  /** The matched phrase (lowercased, as listed in the banned set). */
  phrase: string;
  /** Whether it came from the brand's own avoidPhrases or the global list. */
  source: "brand" | "global";
  /** id of the block the hit was found in (empty string if the block had none). */
  blockId: string;
  /** type of the block the hit was found in. */
  blockType: string;
  /** Dotted prop path where the hit was found, e.g. "props.headline". */
  field: string;
  /** ~80-char window around the match for human review. */
  snippet: string;
}

// Recursion / output caps so a pathological page can never blow up the request.
const MAX_DEPTH = 5;
const MAX_HITS = 50;
const SNIPPET_RADIUS = 40;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive matcher for a phrase. We anchor on non-word
 * boundaries so "synergy" matches in "great synergy here" but a phrase like
 * "elevate your" matches the literal sequence. Hyphens and apostrophes inside
 * the phrase are matched literally.
 */
function buildMatcher(phrase: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(phrase)})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

interface CompiledPhrase {
  phrase: string;
  source: "brand" | "global";
  re: RegExp;
}

function compilePhrases(brandAvoidPhrases: string[]): CompiledPhrase[] {
  const seen = new Set<string>();
  const out: CompiledPhrase[] = [];
  // Brand phrases first so a phrase appearing in both is attributed to the brand.
  for (const raw of Array.isArray(brandAvoidPhrases) ? brandAvoidPhrases : []) {
    if (typeof raw !== "string") continue;
    const p = raw.trim().toLowerCase();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push({ phrase: p, source: "brand", re: buildMatcher(p) });
  }
  for (const raw of GLOBAL_CLICHES) {
    const p = raw.trim().toLowerCase();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push({ phrase: p, source: "global", re: buildMatcher(p) });
  }
  return out;
}

function snippetAround(text: string, index: number, matchLen: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + matchLen + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function scanString(
  text: string,
  field: string,
  blockId: string,
  blockType: string,
  phrases: CompiledPhrase[],
  hits: BannedPhraseHit[],
): void {
  if (hits.length >= MAX_HITS) return;
  if (!text || text.length > 4000) return; // skip pathologically long blobs
  for (const { phrase, source, re } of phrases) {
    const m = re.exec(text);
    if (!m) continue;
    // m.index points at the optional leading boundary char; offset to the phrase.
    const phraseIndex = m.index + (m[1] ? m[1].length : 0);
    hits.push({
      phrase,
      source,
      blockId,
      blockType,
      field,
      snippet: snippetAround(text, phraseIndex, m[2].length),
    });
    if (hits.length >= MAX_HITS) return;
  }
}

function walk(
  value: unknown,
  path: string,
  blockId: string,
  blockType: string,
  phrases: CompiledPhrase[],
  hits: BannedPhraseHit[],
  depth: number,
): void {
  if (depth > MAX_DEPTH || hits.length >= MAX_HITS) return;
  if (typeof value === "string") {
    scanString(value, path, blockId, blockType, phrases, hits);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walk(value[i], `${path}[${i}]`, blockId, blockType, phrases, hits, depth + 1);
      if (hits.length >= MAX_HITS) return;
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, blockId, blockType, phrases, hits, depth + 1);
      if (hits.length >= MAX_HITS) return;
    }
  }
}

/**
 * Scan generated blocks for banned phrases. `blocks` is the raw AI output
 * (array of `{ id?, type?, props? }`). Returns every hit (capped at MAX_HITS),
 * brand phrases attributed ahead of global clichés.
 */
export function findBannedPhrases(
  blocks: unknown[],
  brandAvoidPhrases: string[] = [],
): BannedPhraseHit[] {
  const phrases = compilePhrases(brandAvoidPhrases);
  if (phrases.length === 0 || !Array.isArray(blocks)) return [];
  const hits: BannedPhraseHit[] = [];
  for (const block of blocks) {
    if (hits.length >= MAX_HITS) break;
    const b = (block ?? {}) as { id?: unknown; type?: unknown; props?: unknown };
    const blockId = typeof b.id === "string" ? b.id : "";
    const blockType = typeof b.type === "string" ? b.type : "";
    // Only the props carry copy; id/type are structural.
    walk(b.props, "props", blockId, blockType, phrases, hits, 0);
  }
  return hits;
}

/**
 * Roll hits up by block so Workstream C's critique pass can target the worst
 * 1–2 blocks. Returns block ids sorted by hit count, descending.
 */

// ── Deterministic safe swaps (July 2026) ─────────────────────────────────────
// The eval harness showed bannedPhrase is the weakest quality dimension: the
// critique pass rewrites only the worst blocks, so single-word cliché hits in
// every other block shipped untouched. For offenders with a meaning-preserving
// drop-in replacement we don't need a model call at all — swap them
// deterministically, then let the (widened) critique handle anything
// contextual. Every replacement is chosen to NOT itself be a banned phrase
// (pinned by test).
const SAFE_PHRASE_SWAPS: ReadonlyArray<[string, string]> = [
  // adjectives
  ["seamless", "smooth"],
  ["seamlessly", "smoothly"],
  ["effortlessly", "easily"],
  ["with ease", "easily"],
  ["cutting-edge", "modern"],
  ["cutting edge", "modern"],
  ["state-of-the-art", "advanced"],
  ["next-generation", "modern"],
  ["next generation", "modern"],
  ["world-class", "exceptional"],
  ["world class", "exceptional"],
  ["best-in-class", "top-tier"],
  ["best in class", "top-tier"],
  ["industry-leading", "proven"],
  ["industry leading", "proven"],
  ["game-changing", "decisive"],
  ["game-changer", "breakthrough"],
  ["game changer", "breakthrough"],
  ["revolutionary", "bold"],
  ["comprehensive", "complete"],
  ["robust", "reliable"],
  ["transformative", "lasting"],
  ["trusted partner", "proven partner"],
  ["actionable insights", "clear next steps"],
  // verbs (common inflections listed explicitly — matching is exact-phrase)
  ["revolutionize", "transform"],
  ["streamlines", "simplifies"],
  ["streamlined", "simplified"],
  ["streamline", "simplify"],
  ["optimizes", "improves"],
  ["optimized", "improved"],
  ["optimize", "improve"],
  ["maximizes", "increases"],
  ["maximize", "increase"],
  ["empowers", "equips"],
  ["empower", "equip"],
  ["supercharge", "boost"],
  ["discover", "see"],
];

/** Keys whose values are never human copy — mirror of the critique pass's
 *  non-copy protection so a URL path like "/discover" is never rewritten. */
const SWAP_SKIP_KEY_RE = /url|href|src|image|video|poster|logo|color|icon|anchor|mode|variant|layout|style|font|^id$|^type$/i;
const SWAP_SKIP_VALUE_RE = /^(https?:)?\/|^#|^mailto:|^tel:|^data:/i;

const compiledSwaps = SAFE_PHRASE_SWAPS.map(([from, to]) => ({
  to,
  re: new RegExp(`(^|[^A-Za-z0-9-])(${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![A-Za-z0-9-])`, "gi"),
}));

function swapString(text: string): { text: string; swapped: string[] } {
  let out = text;
  const swapped: string[] = [];
  for (const { to, re } of compiledSwaps) {
    re.lastIndex = 0;
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, (_m, lead: string, word: string) => {
      swapped.push(word.toLowerCase());
      // Preserve a leading capital ("Seamless onboarding" -> "Smooth onboarding").
      const cased = /^[A-Z]/.test(word) ? to.charAt(0).toUpperCase() + to.slice(1) : to;
      return `${lead}${cased}`;
    });
  }
  return { text: out, swapped };
}

/**
 * Mutate `blocks` in place, replacing safe-swap phrases in human-copy string
 * leaves. Returns how many individual swaps were applied and the distinct
 * phrases involved. Non-copy keys (urls, colors, enums) and URL-shaped values
 * are never touched. Deterministic and instant — run it BEFORE the critique
 * pass so the model only has to fix what has no safe drop-in.
 */
export function applySafePhraseSwaps(blocks: unknown[]): { swaps: number; phrases: string[] } {
  let swaps = 0;
  const phrases = new Set<string>();
  const visit = (node: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return node;
    if (typeof node === "string") return node; // handled by parent (needs key context)
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = node[i];
        if (typeof v === "string") {
          if (SWAP_SKIP_VALUE_RE.test(v)) continue;
          const r = swapString(v);
          if (r.swapped.length) {
            node[i] = r.text;
            swaps += r.swapped.length;
            r.swapped.forEach((p) => phrases.add(p));
          }
        } else {
          visit(v, depth + 1);
        }
      }
      return node;
    }
    if (node && typeof node === "object") {
      const rec = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(rec)) {
        if (typeof v === "string") {
          if (SWAP_SKIP_KEY_RE.test(k) || SWAP_SKIP_VALUE_RE.test(v)) continue;
          const r = swapString(v);
          if (r.swapped.length) {
            rec[k] = r.text;
            swaps += r.swapped.length;
            r.swapped.forEach((p) => phrases.add(p));
          }
        } else {
          visit(v, depth + 1);
        }
      }
    }
    return node;
  };
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const b = block as { props?: unknown };
    if (b && typeof b === "object" && b.props) visit(b.props, 0);
  }
  return { swaps, phrases: [...phrases] };
}

export function rankBlocksByHits(hits: BannedPhraseHit[]): { blockId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const h of hits) {
    if (!h.blockId) continue;
    counts.set(h.blockId, (counts.get(h.blockId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([blockId, count]) => ({ blockId, count }))
    .sort((a, b) => b.count - a.count);
}
