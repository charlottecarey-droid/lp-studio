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
  /** Template's own industry tag (lp_pages.industry). Used alongside
   *  `category` to detect ecommerce/DTC (storefront) templates that must be
   *  gated behind a commerce signal. Optional / nullable. */
  industry?: string | null;
  /** Only isAllInOne === true rows are considered. */
  isAllInOne?: boolean | null;
}

export interface TemplateIntentMatch {
  slug: string;
  /** Weighted hit count: single-word keyword = 1, multi-word phrase = 2. */
  score: number;
}

/**
 * Optional brand/business-model signal derived from the BrandConfig at the
 * call site (generate-page.ts). Used to keep ecommerce/DTC (storefront)
 * templates from being selected for a brand that shows no commerce signal —
 * e.g. a B2B dental lab asking for a "product page for dentures" must NOT be
 * routed to the Shopify-style DTC storefront (June 2026 generation-quality
 * fix). Every field is optional; when the whole object is undefined the
 * matcher behaves exactly as before EXCEPT for the always-on guard that a
 * bare "product page" prompt (no real commerce word) can never reach
 * storefront on its own (see STOREFRONT_REQUIRES_COMMERCE_WORD).
 */
export interface BrandIntentContext {
  /** Tenant industry (e.g. "dental", "generic", "ecommerce", "media"). */
  industry?: string | null;
  /** Coarse business model when known. */
  businessModel?: "b2b" | "dtc" | "saas" | "services" | "media" | string | null;
  /** Brand audience segment names (B2B segment names are a strong non-DTC signal). */
  segments?: string[];
  /** Explicit override: true = brand sells DTC/online; false = definitely not. */
  isEcommerce?: boolean;
}

/** Categories / industries that denote a DTC / online-retail (storefront)
 *  template. A template tagged with any of these is gated behind a real
 *  commerce signal (from the brand or the prompt). */
const ECOMMERCE_CATEGORIES = new Set(["storefront"]);
const ECOMMERCE_INDUSTRIES = new Set(["ecommerce", "e-commerce", "retail", "dtc"]);

/** True commerce signals in a generation prompt. These are the only keywords
 *  that, on their own, justify routing to a DTC storefront. A bare "product
 *  page" / "products" / "catalog" prompt has NO commerce word here, so it can
 *  never reach storefront unless the brand itself is clearly ecommerce. */
const PROMPT_COMMERCE_TOKENS = [
  "shop", "store", "storefront", "ecommerce", "e commerce", "online store",
  "online shop", "dtc", "direct to consumer", "buy now", "checkout",
  "cart", "add to cart", "merchandise",
];

/** Brand-config text tokens that mark a brand as DTC / online-retail. */
const BRAND_COMMERCE_TOKENS = [
  "ecommerce", "e commerce", "dtc", "direct to consumer", "online store",
  "online shop", "storefront", "retail", "shopify", "checkout", "shopping cart",
];

/** Does the prompt contain a genuine commerce signal? Operates on the same
 *  space-padded normalized haystack the keyword matcher uses. */
function promptHasCommerceSignal(haystack: string): boolean {
  return PROMPT_COMMERCE_TOKENS.some((t) => haystack.includes(` ${t} `));
}

/** Decide whether the brand is plausibly DTC/ecommerce from the call-site
 *  signal. Conservative & fail-open in BOTH directions:
 *   • explicit `isEcommerce` always wins;
 *   • industry / businessModel that names ecommerce/retail/dtc → DTC;
 *   • industry / businessModel that names a clearly-NON-DTC model
 *     (dental, b2b, saas, services, media) → NOT DTC;
 *   • any commerce token in the segment names → DTC;
 *   • otherwise unknown (returns null → "ambiguous"). */
function brandIsEcommerce(ctx: BrandIntentContext | undefined): boolean | null {
  if (!ctx) return null;
  if (typeof ctx.isEcommerce === "boolean") return ctx.isEcommerce;
  const industry = (ctx.industry ?? "").trim().toLowerCase();
  const model = (ctx.businessModel ?? "").trim().toLowerCase();
  if (ECOMMERCE_INDUSTRIES.has(industry) || ECOMMERCE_INDUSTRIES.has(model)) return true;
  // Clearly non-DTC business models / industries.
  const NON_DTC = new Set(["dental", "b2b", "saas", "services", "media", "generic"]);
  const segText = (ctx.segments ?? []).join(" ").toLowerCase();
  const segHasCommerce = BRAND_COMMERCE_TOKENS.some((t) => segText.includes(t));
  if (segHasCommerce) return true;
  if (NON_DTC.has(industry) || NON_DTC.has(model)) return false;
  return null;
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
  brandContext?: BrandIntentContext,
): TemplateIntentMatch | null {
  if (typeof prompt !== "string" || !Array.isArray(templates)) return null;
  const normalizedPrompt = normalizeForIntentMatch(prompt);
  if (!normalizedPrompt) return null;
  // Pad with spaces so ` keyword ` containment == whole-word/phrase match.
  const haystack = ` ${normalizedPrompt} `;

  // Brand-aware storefront gating (June 2026). Decide ONCE whether an
  // ecommerce/DTC (storefront) template is even allowed for this request:
  //   • allowed when the brand is clearly ecommerce (isEcommerce / industry /
  //     segment commerce signal), OR
  //   • allowed when the PROMPT itself carries a real commerce word
  //     (shop / cart / checkout / buy / store …).
  // Otherwise storefront-style templates are EXCLUDED from candidacy — so a
  // B2B/dental/SaaS brand asking for a bare "product page" falls through to
  // the freeform path instead of the Shopify-style DTC storefront. Fail-open:
  // when the brand signal is unknown/ambiguous we still require a real
  // commerce word in the prompt before storefront can match.
  const brandEcom = brandIsEcommerce(brandContext);
  const promptCommerce = promptHasCommerceSignal(haystack);
  const allowEcommerceTemplates = brandEcom === true || promptCommerce;
  const isEcommerceTemplate = (tpl: TemplateIntentCandidate): boolean => {
    const cat = (tpl.category ?? "").trim().toLowerCase();
    const ind = (tpl.industry ?? "").trim().toLowerCase();
    return ECOMMERCE_CATEGORIES.has(cat) || ECOMMERCE_INDUSTRIES.has(ind);
  };

  const scored: ScoredCandidate[] = [];
  templates.forEach((tpl, order) => {
    if (!tpl || tpl.isAllInOne !== true || typeof tpl.slug !== "string" || !tpl.slug) return;
    // Storefront/ecommerce templates are gated behind a commerce signal.
    if (isEcommerceTemplate(tpl) && !allowEcommerceTemplates) return;
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
