/**
 * Page recipes — server-side structure rotation for AI page generation
 * (June 2026, page-variety workstream).
 *
 * PROBLEM: prompt-only variety guidance ("VARY THE STRUCTURE PER BRAND", the
 * BLOCK SELECTION rule) fails in practice because each prompt path ships ONE
 * worked example ("a loose flow that works is hero → problem → …") that
 * anchors the model — generated pages converge on that same block sequence
 * every run.
 *
 * FIX: instead of showing the model every option plus one anchoring example,
 * the server picks ONE recipe per generation (least-recently-used per tenant,
 * random fallback) and injects ONLY that recipe into the prompt. The recipe is
 * explicitly framed as a SUGGESTION to adapt — copy stays model-driven, the
 * nav/footer rules stay in force, and explicit user requests (the "REQUESTED
 * SECTIONS ARE MANDATORY" rule) always outrank the recipe.
 *
 * Every skeleton entry names block types that exist in the corresponding
 * prompt path's advertised vocabulary ("a OR b" offers alternatives). A
 * dedicated test (generate-page.recipe-vocab.test.ts) cross-checks every
 * skeleton type against the assembled system prompts so the recipes can never
 * drift out of sync with the block libraries.
 *
 * This module also hosts the pure logic for the BLOCK-SEQUENCE REPEAT GUARD:
 * a sha1 hash over the page's non-structural block-type sequence, persisted
 * per generation (ai_generation_log.sequence_hash), and a collision check that
 * triggers ONE corrective re-prompt when a new page's sequence matches one of
 * the tenant's last few generations.
 */

import { createHash } from "node:crypto";

export interface PageRecipe {
  /** Stable identifier, persisted in ai_generation_log.recipe_id and echoed
   *  in the generation response (`recipeId`). */
  id: string;
  /** Short human label, shown to the model. */
  label: string;
  /** One-line description of the page archetype. */
  description: string;
  /** Ordered block-type suggestions. Each entry is one section slot; "a OR b"
   *  offers alternatives the model may pick between. Nav/footer blocks are
   *  deliberately omitted — the prompt's navigation rules govern those. */
  skeleton: string[];
  /** Art-direction notes for the model (pacing, density, tone of layout). */
  styleNotes: string;
}

export type RecipePromptPath = "freeform" | "dso" | "dso-practices";

// ── FREEFORM (GENERAL) path ─────────────────────────────────────────────────

export const FREEFORM_RECIPES: PageRecipe[] = [
  {
    id: "freeform-editorial",
    label: "Editorial",
    description: "a premium magazine-style page that persuades with story and typography",
    skeleton: [
      "kinetic-type-hero OR magazine-hero",
      "bold-statement",
      "editorial-carousel",
      "split-media-row OR zigzag-features",
      "quote-with-image OR single-quote",
      "case-study-spotlight-feature",
      "cta-split-image OR bottom-cta",
    ],
    styleNotes:
      "Premium, unhurried pacing: generous whitespace, long-form copy moments, one strong image per section. Let the typographic hero / bold-statement carry a single load-bearing claim. Avoid dense grids.",
  },
  {
    id: "freeform-showcase-heavy",
    label: "Showcase-heavy",
    description: "a visual-first page where imagery and motion do the persuading",
    skeleton: [
      "launch-spotlight-hero OR bento-mosaic-hero",
      "sticky-stack OR horizontal-showcase",
      "feature-tabs-showcase OR gallery-masonry",
      "media-feature-reel OR media-looping-showcase",
      "quote-carousel OR testimonial-grid",
      "aurora-cta-finale OR full-bleed-final-cta",
    ],
    styleNotes:
      "Image-led and kinetic: big full-bleed visuals, short punchy copy, minimal bullet lists. Every section should have a strong visual anchor; keep text blocks tight.",
  },
  {
    id: "freeform-data-led",
    label: "Data-led",
    description: "a proof-first page that leads with numbers, comparisons, and case results",
    skeleton: [
      "hero OR spotlight-glow-hero",
      "stat-counter-band OR trust-bar",
      "comparison OR features-comparison-checklist",
      "glass-bento-features OR benefits-stat-led",
      "case-study-card-grid",
      "stat-backed-final-cta OR cta-stat-backed",
    ],
    styleNotes:
      "Lead with evidence: real metrics from the brief up top (the count-up band only with REAL numbers), a head-to-head comparison mid-page, named customer results before the close. Crisp, analytical tone; icons over photos.",
  },
  {
    id: "freeform-story-led",
    label: "Story-led",
    description: "a cinematic narrative page that walks the visitor through a transformation",
    skeleton: [
      "parallax-image-hero OR cinematic-video-hero",
      "scroll-assembly OR bold-statement",
      "feature-tabs-showcase OR zigzag-features",
      "case-study-spotlight-feature OR quote-with-image",
      "testimonial-wall OR media-video-split",
      "bottom-cta",
    ],
    styleNotes:
      "Cinematic arc: open atmospheric, build the problem→transformation narrative section by section, land on one human proof moment (the testimonial wall reads as many voices) before the close. Favor depth over breadth — fewer, richer sections.",
  },
  {
    id: "freeform-conversion-tight",
    label: "Conversion-tight",
    description: "a focused direct-response page built to convert in one scroll",
    skeleton: [
      "hero OR dandy-hero-v7-s3",
      "benefits-grid OR benefits-icon-grid",
      "testimonial-wall OR testimonial-grid",
      "how-it-works-horizontal-stepper OR how-it-works-numbered-bento",
      "glass-pricing-tiers OR comparison",
      "aurora-cta-finale OR split-form-final-cta",
    ],
    styleNotes:
      "Every section earns its scroll: benefit-dense copy, social proof early, a clear 3-step path, then the pricing/objection answer (use glass-pricing-tiers ONLY when the brief provides real prices — otherwise the comparison) and one unmissable closing CTA. No decorative detours; CTAs repeat the same single action.",
  },
];

// ── DSO (enterprise) path ───────────────────────────────────────────────────

export const DSO_RECIPES: PageRecipe[] = [
  {
    id: "dso-data-room",
    label: "Data room",
    description: "a metrics-first page for a numbers-driven executive audience",
    skeleton: [
      "dso-heartland-hero",
      "dso-stat-showcase",
      "dso-comparison",
      "dso-network-map OR dso-particle-mesh",
      "dso-bento-outcomes",
      "dso-final-cta OR dso-cta-capture",
    ],
    styleNotes:
      "Boardroom tone: every section anchored by a real network-level metric. The comparison is the centerpiece — make its rows substantive. Dark, confident backgrounds.",
  },
  {
    id: "dso-narrative",
    label: "Customer narrative",
    description: "a story-driven page built around one flagship customer journey",
    skeleton: [
      "dso-scroll-story-hero",
      "dso-problem",
      "dso-scroll-story OR dso-flow-canvas",
      "dso-case-study OR dso-success-stories",
      "dso-case-flow",
      "dso-cta-capture",
    ],
    styleNotes:
      "Narrative arc over feature list: open on the operational pain, walk one customer's transformation chapter by chapter, close on the workflow that made it repeatable. Use approved case studies only.",
  },
  {
    id: "dso-pilot-push",
    label: "Pilot push",
    description: "an action-oriented page that drives a pilot-program commitment",
    skeleton: [
      "dso-heartland-hero",
      "dso-challenges",
      "dso-ai-feature",
      "dso-pilot-steps",
      "dso-success-stories OR dso-bento-outcomes",
      "dso-final-cta",
    ],
    styleNotes:
      "Momentum toward one ask: name the challenges fast, show the capability that removes them, then make the pilot timeline feel concrete and low-risk. CTAs all point at booking the pilot.",
  },
];

// ── DSO PRACTICES path ──────────────────────────────────────────────────────

export const DSO_PRACTICES_RECIPES: PageRecipe[] = [
  {
    id: "dso-practices-onboarding",
    label: "Onboarding story",
    description: "a warm page that makes getting started feel effortless for a practice",
    skeleton: [
      "dso-practice-hero",
      "dso-activation-steps",
      "dso-split-feature",
      "dso-stat-row",
      "dso-promises",
      "dso-meet-team",
    ],
    styleNotes:
      "Reassuring and concrete: lead with how fast onboarding is, show the dedicated support behind it, and put real people (the team) at the close. Practice-level numbers (chair time, fit rate), not network KPIs.",
  },
  {
    id: "dso-practices-product-push",
    label: "Product push",
    description: "a catalog-forward page that showcases products and exclusive offers",
    skeleton: [
      "dso-practice-hero",
      "dso-products-grid",
      "dso-promo-cards",
      "dso-testimonials OR dso-stat-row",
      "dso-partnership-perks",
      "dso-meet-team",
    ],
    styleNotes:
      "Merchandised and specific: real product names with turnaround/pricing detail, offers framed as network-exclusive perks, peer testimonials for credibility. Keep copy warm, not enterprise.",
  },
  {
    id: "dso-practices-objections",
    label: "Objection handling",
    description: "a trust-building page that converts skeptical practices by answering doubts head-on",
    skeleton: [
      "dso-practice-hero",
      "dso-paradigm-shift",
      "dso-faq",
      "dso-testimonials",
      "dso-stat-row OR dso-partnership-perks",
      "dso-promises",
    ],
    styleNotes:
      "Meet skepticism directly: contrast the old way vs the new way with paired, specific bullets, answer the real objections in the FAQ, and back every promise with a peer quote or number.",
  },
];

export function recipesForPath(path: RecipePromptPath): PageRecipe[] {
  switch (path) {
    case "dso":
      return DSO_RECIPES;
    case "dso-practices":
      return DSO_PRACTICES_RECIPES;
    default:
      return FREEFORM_RECIPES;
  }
}

/** Every individual block type a recipe's skeleton references ("a OR b" → both). */
export function recipeSkeletonBlockTypes(recipe: PageRecipe): string[] {
  return recipe.skeleton
    .flatMap((entry) => entry.split(/\s+OR\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Pick the recipe for this generation: the LEAST-RECENTLY-USED recipe wins,
 * falling back to random among ties.
 *
 * `recentRecipeIds` is ordered MOST-RECENT-FIRST (the tenant's last N stored
 * recipe ids). A recipe absent from the list counts as never used and always
 * beats one that appears; among equally-stale candidates the (injectable)
 * `rand` breaks the tie so two tenants with empty history don't all start on
 * the same recipe.
 */
export function pickRecipe(
  recipes: ReadonlyArray<PageRecipe>,
  recentRecipeIds: ReadonlyArray<string>,
  rand: () => number = Math.random,
): PageRecipe | null {
  if (recipes.length === 0) return null;
  // Recency = index of the recipe's most recent use (lower = more recent);
  // never used = +Infinity (the strongest candidate).
  const recency = recipes.map((r) => {
    const idx = recentRecipeIds.indexOf(r.id);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
  });
  const stalest = Math.max(...recency);
  const candidates = recipes.filter((_, i) => recency[i] === stalest);
  const pick = candidates[Math.floor(rand() * candidates.length)];
  return pick ?? candidates[0] ?? null;
}

/**
 * Prompt text for the chosen recipe. Framed as a per-generation suggestion the
 * model adapts — never a mandatory template — and explicitly outranked by
 * explicit user requests (mirrors the "REQUESTED SECTIONS ARE MANDATORY" rule).
 */
export function buildRecipeDirective(recipe: PageRecipe): string {
  return [
    `RECIPE FOR THIS GENERATION — "${recipe.label}" (${recipe.description}).`,
    `Suggested flow: ${recipe.skeleton.join(" → ")}.`,
    `Style notes: ${recipe.styleNotes}`,
    "Adapt this recipe to the brief — it is a starting suggestion, NOT a mandatory template. Where an entry offers alternatives (\"a OR b\"), pick whichever fits the brand; swap any suggested block for a better-fitting one from the available block types, and keep the standard nav/footer and hero rules. EXPLICIT USER REQUESTS ALWAYS OVERRIDE THIS RECIPE: never drop or skip a block, section, feature, or topic the USER REQUEST explicitly asks for.",
  ].join("\n");
}

/**
 * The anchoring "loose flow that works" example sentence in the DSO /
 * DSO-Practices BLOCK SELECTION rule. Replaced per-generation by the chosen
 * recipe so the model sees ONE rotated suggestion instead of the same fixed
 * example every run.
 */
const LOOSE_FLOW_SENTENCE_RE =
  /A loose flow that works is [^\n]*? — but treat this as ONE option, never a fixed template you must follow\./;

/**
 * Replace the static "loose flow that works" example inside a DSO-path system
 * prompt with the chosen recipe. Returns `injected: false` (prompt unchanged)
 * when the marker sentence is absent — callers then fall back to appending the
 * recipe directive to the user prompt instead.
 */
export function injectRecipeIntoBlockSelection(
  systemPrompt: string,
  recipe: PageRecipe,
): { prompt: string; injected: boolean } {
  if (!LOOSE_FLOW_SENTENCE_RE.test(systemPrompt)) {
    return { prompt: systemPrompt, injected: false };
  }
  const replacement =
    `RECIPE FOR THIS GENERATION — "${recipe.label}" (${recipe.description}): ` +
    `${recipe.skeleton.join(" → ")}. ${recipe.styleNotes} ` +
    `Adapt this recipe — it is a suggestion, NOT a mandatory template (each "OR" offers alternatives), and explicit user requests always override it.`;
  return { prompt: systemPrompt.replace(LOOSE_FLOW_SENTENCE_RE, replacement), injected: true };
}

// ── Block-sequence repeat guard (pure logic) ────────────────────────────────

/**
 * Purely structural / chrome block types ignored when hashing a page's block
 * sequence: nav + footer variants are injected deterministically (or required
 * by the prompt rules) on nearly every page, so including them would mask real
 * structural repeats behind chrome differences — and vice versa.
 */
export const SEQUENCE_STRUCTURAL_TYPES = new Set([
  "spacer",
  "divider",
  "nav-header",
  "footer",
  "minimal-nav",
  "mega-menu-nav",
  "transparent-overlay-nav",
  "centered-logo-nav",
  "dso-practice-nav",
]);

/** Order-sensitive sha1 over the page's non-structural block-type sequence. */
export function blockSequenceHash(blockTypes: ReadonlyArray<string>): string {
  const meaningful = blockTypes.filter(
    (t) => typeof t === "string" && t.length > 0 && !SEQUENCE_STRUCTURAL_TYPES.has(t),
  );
  return createHash("sha1").update(meaningful.join("|")).digest("hex");
}

/** How many of the tenant's most recent stored hashes a new page is checked
 *  against (a collision inside this window triggers the one re-prompt). */
export const SEQUENCE_REPEAT_WINDOW = 3;

/**
 * True when the candidate page's sequence hash matches any of the tenant's
 * most recent `window` stored hashes (`recentHashes` ordered most-recent-first).
 */
export function shouldRetryForRepeatedSequence(
  candidateHash: string,
  recentHashes: ReadonlyArray<string>,
  window: number = SEQUENCE_REPEAT_WINDOW,
): boolean {
  if (!candidateHash) return false;
  return recentHashes.slice(0, window).includes(candidateHash);
}

/**
 * The single corrective follow-up message appended to the conversation when a
 * repeat is detected. The second result is accepted either way (one retry max).
 */
export function buildRepeatCorrectiveMessage(blockTypes: ReadonlyArray<string>): string {
  const seq = blockTypes
    .filter((t) => typeof t === "string" && t.length > 0 && !SEQUENCE_STRUCTURAL_TYPES.has(t))
    .join(" → ");
  return (
    `The block sequence ${seq} was just used for this tenant's most recent pages. ` +
    "Produce a meaningfully DIFFERENT structure for the same brief: change the hero block type and at least 2 other sections (use the recipe's OR-alternatives or other available block types), and reorder the middle of the page. " +
    "Keep every block, section, feature, or topic the USER REQUEST explicitly asks for — explicit user requests still override everything. " +
    'Return ONLY the corrected, complete JSON object { "title", "slug", "blocks" } in the same format as before.'
  );
}
