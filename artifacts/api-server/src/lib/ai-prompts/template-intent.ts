// All-in-one template intent selection (June 2026).
//
// Pure, deterministic keyword matcher that decides whether a freeform
// generation prompt is really asking for one of the all-in-one templates
// (storefront, podcast/content series, blog series, business case, event,
// restaurant, portfolio, agency/local services, SaaS launch). When it
// matches confidently, generate-page.ts routes the request through the
// existing template path — the curated structure is kept and the AI only
// rewrites copy — instead of letting the generic block assembler run.
//
// Design constraints:
//   • NO model call — this runs synchronously before prompt assembly.
//   • Word-boundary aware: "store" must not match "restore"; "shop" must
//     not match "shopping". Prompts and keywords are normalized to
//     lowercase space-separated token strings and matched token-wise.
//   • Multi-word keywords are matched as exact phrases (consecutive
//     tokens) and weighted higher — a phrase like "online store" or
//     "business case" is a far stronger intent signal than "store".
//   • Minimum confidence: a template only qualifies with at least
//     MIN_DISTINCT_HITS distinct keyword hits, OR a single multi-word
//     phrase hit. A generic "landing page for my company" prompt hits
//     nothing and falls through to the freeform path (return null).
//   • Ties break toward the more specific match: higher weighted score
//     first, then the longest matched keyword, then total matched
//     characters, then earliest candidate (stable).

export interface TemplateIntentCandidate {
  slug: string;
  /** Coarse intent bucket (lp_pages.category). Informational — matching is
   *  driven purely by keywords; rows without keywords never match. */
  category?: string | null;
  /** Intent phrases (lp_pages.keywords jsonb). Tolerated as unknown — DB
   *  jsonb is untyped; non-string entries are ignored. */
  keywords?: unknown;
  /** Only isAllInOne === true rows are considered. */
  isAllInOne?: boolean | null;
}

export interface TemplateIntentMatch {
  slug: string;
  /** Weighted hit count: single-word keyword = 1, multi-word phrase = 2. */
  score: number;
}

/** Distinct keyword hits required when none of the hits is a multi-word
 *  phrase. One generic single-word hit ("show", "work", "event" …) is not
 *  enough signal on its own. */
const MIN_DISTINCT_HITS = 2;

const SINGLE_WORD_WEIGHT = 1;
const PHRASE_WEIGHT = 2;

/** Lowercase, strip punctuation to spaces, collapse whitespace. Produces a
 *  plain space-separated token string so phrase matching with explicit
 *  space delimiters is inherently word-boundary safe ("e-commerce" and
 *  "e commerce" normalize identically; "store" can never sit inside
 *  "restore"). Unicode letters (café) are preserved. */
export function normalizeForIntentMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface ScoredCandidate {
  slug: string;
  score: number;
  distinctHits: number;
  hadPhraseHit: boolean;
  longestKeywordLen: number;
  totalMatchedChars: number;
  order: number;
}

/**
 * Match a user generation prompt against the all-in-one template library.
 *
 * Returns the best-scoring confident match, or null when no template
 * clears the minimum-confidence bar (the caller then falls through to the
 * freeform block-assembly path). Never throws on malformed candidate data
 * — rows with missing/invalid keywords are simply skipped.
 */
export function matchTemplateIntent(
  prompt: string,
  templates: TemplateIntentCandidate[],
): TemplateIntentMatch | null {
  if (typeof prompt !== "string" || !Array.isArray(templates)) return null;
  const normalizedPrompt = normalizeForIntentMatch(prompt);
  if (!normalizedPrompt) return null;
  // Pad with spaces so ` keyword ` containment == whole-word/phrase match.
  const haystack = ` ${normalizedPrompt} `;

  const scored: ScoredCandidate[] = [];
  templates.forEach((tpl, order) => {
    if (!tpl || tpl.isAllInOne !== true || typeof tpl.slug !== "string" || !tpl.slug) return;
    const rawKeywords = Array.isArray(tpl.keywords) ? tpl.keywords : [];
    // Dedupe normalized keywords so seed lists with overlapping variants
    // ("café"/"cafe") can't double-count a single prompt mention.
    const keywords = new Set<string>();
    for (const kw of rawKeywords) {
      if (typeof kw !== "string") continue;
      const norm = normalizeForIntentMatch(kw);
      if (norm) keywords.add(norm);
    }
    if (keywords.size === 0) return;

    let score = 0;
    let distinctHits = 0;
    let hadPhraseHit = false;
    let longestKeywordLen = 0;
    let totalMatchedChars = 0;
    for (const kw of keywords) {
      if (!haystack.includes(` ${kw} `)) continue;
      const isPhrase = kw.includes(" ");
      score += isPhrase ? PHRASE_WEIGHT : SINGLE_WORD_WEIGHT;
      distinctHits += 1;
      if (isPhrase) hadPhraseHit = true;
      longestKeywordLen = Math.max(longestKeywordLen, kw.length);
      totalMatchedChars += kw.length;
    }
    if (distinctHits === 0) return;
    // Minimum confidence: ≥2 distinct hits, or 1 highly-specific phrase hit.
    if (distinctHits < MIN_DISTINCT_HITS && !hadPhraseHit) return;
    scored.push({
      slug: tpl.slug,
      score,
      distinctHits,
      hadPhraseHit,
      longestKeywordLen,
      totalMatchedChars,
      order,
    });
  });

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie → the more specific match wins: longest matched keyword, then
    // most matched characters overall, then stable candidate order.
    if (b.longestKeywordLen !== a.longestKeywordLen) return b.longestKeywordLen - a.longestKeywordLen;
    if (b.totalMatchedChars !== a.totalMatchedChars) return b.totalMatchedChars - a.totalMatchedChars;
    return a.order - b.order;
  });

  const best = scored[0];
  return { slug: best.slug, score: best.score };
}
