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

export type RecipePromptPath = "freeform" | "dso" | "dso-practices" | "microsite";

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
    description:
      "a structured growth page modeled on a flagship DSO partner growth page: a stat-backed hero, an ROI proof grid, the core challenges, an old-way vs new-way contrast, one capability spotlight, then stacked customer proof",
    skeleton: [
      "dso-heartland-hero",
      "dso-stat-showcase",
      "dso-challenges",
      "dso-comparison",
      "dso-ai-feature",
      "dso-success-stories",
      "dso-final-cta OR dso-cta-capture",
    ],
    styleNotes:
      "A confident, executive growth story told through outcomes, not a feature list. Open on a dark, full-bleed hero whose headline names the growth outcome, with a 3–4 metric stat bar underneath. Follow with an ROI stat grid that quantifies the result, then 3–4 sharply-named operational challenges. The old-way vs new-way comparison is the centerpiece — make both columns substantive and specific. Spotlight ONE capability with its own supporting metrics and an image, then stack 3 customer success stories using approved case studies only (each with a real logo, stat, and quote). Close on a single, unmissable CTA. Dark, premium backgrounds; every section earns its scroll.",
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

// ── MICROSITE (neutral-freeform sales) path ─────────────────────────────────
// The recipe pool for the non-Dandy / neutral-freeform MICROSITE generator
// (sales account microsites with no curated/segment-pool/outline block list).
// Without it every such microsite converged on the same fixed lineup. Each
// skeleton draws ONLY from the shared neutral microsite vocabulary
// (FREEFORM_MICROSITE_DISPLAY_TYPES in lib/ai-prompts/microsite-block-vocab.ts),
// opens with an immersive "full-bleed-hero OR hero", weaves in the premium
// dso-stat-row / dso-ai-feature / dso-final-cta options, and closes with
// "dso-final-cta OR bottom-cta" — while still satisfying the freeform rules
// (≥1 proof/metrics + ≥1 features/benefits + a closing CTA). Nav/footer are
// deliberately omitted — the generator's chrome rules govern those. The
// recipe ↔ vocab drift test guards every type against the advertised set.
export const MICROSITE_RECIPES: PageRecipe[] = [
  {
    id: "microsite-proof-led",
    label: "Proof-led",
    description: "a credibility-first page that leads with metrics, comparison, and customer proof",
    skeleton: [
      "full-bleed-hero OR hero",
      "dso-stat-row OR trust-bar",
      "stat-callout OR stats",
      "comparison",
      "benefits-grid",
      "testimonial",
      "dso-final-cta OR bottom-cta",
    ],
    styleNotes:
      "Open with the account's situation, then stack evidence early: a quick credibility/metrics bar, one big highlighted number, a head-to-head old-way vs new-way comparison, the core benefits, and a real-sounding customer quote before the close. Analytical, confident tone; only ever use REAL numbers from the brief.",
  },
  {
    id: "microsite-story-led",
    label: "Story-led",
    description: "a narrative page that walks the account from problem to transformation",
    skeleton: [
      "full-bleed-hero OR hero",
      "pas-section",
      "how-it-works",
      "testimonial",
      "stat-callout OR trust-bar",
      "dso-final-cta OR bottom-cta",
    ],
    styleNotes:
      "Tell one continuous story: name the problem and what it costs, agitate it briefly, then resolve with a clear numbered path to the outcome. Land on a human proof moment (the quote) and one supporting number before the single closing CTA. Favor depth over breadth — fewer, richer sections.",
  },
  {
    id: "microsite-benefits-led",
    label: "Benefits-led",
    description: "a value-forward page that leads with what the account gains and how it works",
    skeleton: [
      "full-bleed-hero OR hero",
      "benefits-grid",
      "dso-ai-feature OR how-it-works",
      "dso-stat-row OR trust-bar OR stats",
      "testimonial",
      "dso-final-cta OR bottom-cta",
    ],
    styleNotes:
      "Lead with the payoff: benefit/value cards up top, then a richer feature showcase or a simple how-it-works path, then credibility (a metrics bar or a stats row) and a peer quote. Keep copy benefit-dense and concrete; every section answers \"what's in it for them\".",
  },
  {
    id: "microsite-comparison-led",
    label: "Switch / comparison",
    description: "a displacement page that converts by contrasting the status quo with the new way",
    skeleton: [
      "full-bleed-hero OR hero",
      "pas-section OR rich-text",
      "comparison",
      "benefits-grid",
      "dso-stat-row OR stat-callout OR trust-bar",
      "testimonial",
      "dso-final-cta OR bottom-cta",
    ],
    styleNotes:
      "Built to dislodge an incumbent: frame the cost of the status quo, then make the old-way vs new-way comparison the centerpiece — both columns specific and substantive. Reinforce with the core benefits and one strong real number, then a peer quote and a clear switch CTA.",
  },
  {
    id: "microsite-media-led",
    label: "Media-led",
    description: "a visual-first page where a demo or video carries the persuasion",
    skeleton: [
      "full-bleed-hero",
      "video-section",
      "dso-ai-feature OR benefits-grid",
      "trust-bar OR testimonial",
      "how-it-works",
      "dso-final-cta OR bottom-cta",
    ],
    styleNotes:
      "Let the media do the work: open with an immersive full-screen hero, bring the video/demo in early, then a premium feature showcase or short benefit cards, quick credibility, and a simple how-it-works path. Keep text blocks tight and punchy with one clear closing CTA. Only include the video section when a real demo/video is available — otherwise swap it for another proof or benefits section.",
  },
];

export function recipesForPath(path: RecipePromptPath): PageRecipe[] {
  switch (path) {
    case "dso":
      return DSO_RECIPES;
    case "dso-practices":
      return DSO_PRACTICES_RECIPES;
    case "microsite":
      return MICROSITE_RECIPES;
    default:
      return FREEFORM_RECIPES;
  }
}

/**
 * A superadmin's override of one recipe (June 2026, recipe BUILDER).
 *
 *   • For a BUILT-IN recipe (isCustom=false): each text field is `null` =
 *     "inherit the code default for this field"; `skeleton=null` = inherit the
 *     code section order, a non-null array REPLACES it.
 *   • For a CUSTOM recipe (isCustom=true): the row IS the recipe — label,
 *     description, styleNotes and skeleton are all populated (no code fallback);
 *     sortOrder positions it among the path's custom recipes.
 *   • `enabled=false` drops the recipe from the AI rotation pool.
 *
 * Persisted in page_recipe_overrides; merged onto the code recipes by
 * mergeRecipeOverrides (PURE) at generation time.
 */
export interface RecipeOverride {
  recipeId: string;
  label: string | null;
  description: string | null;
  styleNotes: string | null;
  /** Ordered section slots, or null to inherit the code skeleton (built-ins). */
  skeleton: string[] | null;
  enabled: boolean;
  /** true = from-scratch recipe (no code base); false = override of a built-in. */
  isCustom: boolean;
  /** Position among a path's custom recipes (built-ins always come first). */
  sortOrder: number;
}

/** A non-null, non-empty string array (a usable skeleton override). */
function usableSkeleton(skeleton: string[] | null): string[] | null {
  if (!Array.isArray(skeleton)) return null;
  const cleaned = skeleton
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Apply superadmin overrides onto the code-defined recipe list. PURE and DB-free
 * (the DB read lives in page-recipe-overrides.ts).
 *
 *   • BUILT-IN recipes: a matching override drops the recipe when
 *     `enabled === false`; otherwise each non-empty text field and a non-empty
 *     `skeleton` REPLACE the code values (blank/null inherits the code default).
 *     Built-in override entries whose recipeId is not in `base` are ignored
 *     (a recipe was removed/renamed in code → its stale row is a no-op).
 *   • CUSTOM recipes (`isCustom === true`): enabled ones are APPENDED after the
 *     built-ins, in the order given (the loader pre-sorts by sortOrder then
 *     createdAt). A custom row missing label/description/styleNotes/skeleton is
 *     skipped (defensive — never emit a malformed recipe).
 *   • Built-in ORDER follows `base`; customs follow in their given order.
 */
export function mergeRecipeOverrides(
  base: ReadonlyArray<PageRecipe>,
  overrides: ReadonlyArray<RecipeOverride>,
): PageRecipe[] {
  const builtinById = new Map(
    overrides.filter((o) => !o.isCustom).map((o) => [o.recipeId, o]),
  );
  const out: PageRecipe[] = [];
  const pick = (override: string | null, fallback: string): string =>
    typeof override === "string" && override.trim() ? override : fallback;
  for (const recipe of base) {
    const o = builtinById.get(recipe.id);
    if (o && o.enabled === false) continue;
    if (!o) {
      out.push(recipe);
      continue;
    }
    out.push({
      ...recipe,
      label: pick(o.label, recipe.label),
      description: pick(o.description, recipe.description),
      styleNotes: pick(o.styleNotes, recipe.styleNotes),
      skeleton: usableSkeleton(o.skeleton) ?? recipe.skeleton,
    });
  }
  for (const o of overrides) {
    if (!o.isCustom || o.enabled === false) continue;
    const skeleton = usableSkeleton(o.skeleton);
    if (
      !skeleton ||
      !o.label?.trim() ||
      !o.description?.trim() ||
      !o.styleNotes?.trim()
    ) {
      continue;
    }
    out.push({
      id: o.recipeId,
      label: o.label.trim(),
      description: o.description.trim(),
      styleNotes: o.styleNotes.trim(),
      skeleton,
    });
  }
  return out;
}

/** Every individual block type a list of skeleton slots references ("a OR b" → both). */
export function skeletonBlockTypes(skeleton: ReadonlyArray<string>): string[] {
  return skeleton
    .flatMap((entry) => entry.split(/\s+OR\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Every individual block type a recipe's skeleton references ("a OR b" → both). */
export function recipeSkeletonBlockTypes(recipe: PageRecipe): string[] {
  return skeletonBlockTypes(recipe.skeleton);
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
 *
 * `excludeRecipeIds` (June 2026, "Shuffle layout") removes recipes from the
 * candidate pool BEFORE the LRU selection — the caller passes the recipe id(s)
 * just used so a reshuffle is guaranteed a different recipe. Fail-open: ids
 * not in the pool are ignored; if exclusion would empty the pool we fall back
 * to the full pool minus the FIRST excluded id, and if even that is empty
 * (single-recipe pool) the full pool is used. Selection never fails because
 * of an exclusion.
 */
export function pickRecipe(
  recipes: ReadonlyArray<PageRecipe>,
  recentRecipeIds: ReadonlyArray<string>,
  rand: () => number = Math.random,
  excludeRecipeIds: ReadonlyArray<string> = [],
): PageRecipe | null {
  if (recipes.length === 0) return null;
  let pool: ReadonlyArray<PageRecipe> = recipes;
  if (excludeRecipeIds.length > 0) {
    const excluded = new Set(excludeRecipeIds);
    const filtered = recipes.filter((r) => !excluded.has(r.id));
    pool =
      filtered.length > 0
        ? filtered
        : recipes.filter((r) => r.id !== excludeRecipeIds[0]);
    if (pool.length === 0) pool = recipes;
  }
  // Recency = index of the recipe's most recent use (lower = more recent);
  // never used = +Infinity (the strongest candidate).
  const recency = pool.map((r) => {
    const idx = recentRecipeIds.indexOf(r.id);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
  });
  const stalest = Math.max(...recency);
  const candidates = pool.filter((_, i) => recency[i] === stalest);
  const pick = candidates[Math.floor(rand() * candidates.length)];
  return pick ?? candidates[0] ?? null;
}

/**
 * Appended to every recipe directive (and the microsite freeform flow). The
 * recipes are sales / marketing archetypes that are ROTATED, never matched to
 * the request, so only the generation model can judge whether the archetype
 * actually fits. Without this, an off-topic request (e.g. an "about us" page) or
 * a reference URL/screenshot that isn't a sales page gets dragged into an
 * irrelevant proof/conversion layout. This tells the model to discard the
 * recipe and freestyle in those cases.
 */
export const RECIPE_FREESTYLE_OVERRIDE_CLAUSE =
  "WHEN THE SUGGESTED RECIPE / FLOW DOES NOT FIT, FREESTYLE INSTEAD: the recipe and flow above describe a sales / marketing landing page. Before following them, judge whether they actually fit the USER REQUEST and any provided reference URL or screenshot. If the request is a different kind of page — e.g. about-us, team, company-story, careers, contact, FAQ, support, documentation, event, or policy/legal — or a provided URL/screenshot is clearly not a sales page, IGNORE the suggested recipe/flow completely and build the page from scratch: choose whichever sections from the available block types best fit the REAL subject and write the content for that subject. Do not force proof, metrics, ROI, comparison, case-study, or hard-sell CTA sections onto a page where they do not belong.";

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
    RECIPE_FREESTYLE_OVERRIDE_CLAUSE,
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
    `Adapt this recipe — it is a suggestion, NOT a mandatory template (each "OR" offers alternatives), and explicit user requests always override it. ` +
    RECIPE_FREESTYLE_OVERRIDE_CLAUSE;
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
