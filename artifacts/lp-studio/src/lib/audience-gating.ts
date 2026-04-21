/**
 * Audience-based content gating for dental tenants.
 *
 * Dental tenants can create pages for two very different audiences inside
 * the same workspace:
 *   - DSO corporate / leadership (C-suite, clinical ops, PE-backed groups)
 *   - DSO practices / individual offices (practice owners, dentists, staff)
 *
 * Leadership-only content — Dandy Insights dashboards, network maps, scroll
 * stories, particle/flow canvases, case-flow timelines, etc. — should NEVER
 * surface on pages created for practice audiences. Leadership-only blocks
 * live under the "DSO" category; practice-safe blocks live under the
 * "DSO Practices" category. All other categories (Content, Hero, CTA, etc.)
 * are audience-neutral.
 *
 * These helpers centralize that rule so the template picker, block palette
 * and insert dialogs all honor it consistently.
 */

export type AudienceBucket = "practice" | "leadership" | "neutral";

/** Normalize the tenant-saved audienceType string to a coarse bucket. */
export function audienceBucket(audienceType: string | null | undefined): AudienceBucket {
  const t = (audienceType ?? "").toLowerCase().trim();
  if (!t) return "neutral";
  if (t === "dso-practice" || t === "practice" || t === "independent") return "practice";
  if (t === "dso-corporate" || t === "dso-leadership" || t === "leadership") return "leadership";
  return "neutral";
}

/**
 * Block-category bucket. "DSO" = leadership-only; "DSO Practices" =
 * practice-only; anything else is audience-neutral and visible to both.
 */
export function categoryBucket(category: string | null | undefined): AudienceBucket {
  if (category === "DSO") return "leadership";
  if (category === "DSO Practices") return "practice";
  return "neutral";
}

/**
 * Predicate used by the block palette and template filter. Returns true
 * when a block with the given category should be visible to a page whose
 * audience has been resolved to `audienceType`.
 */
export function isBlockVisibleForAudience(
  category: string | null | undefined,
  audienceType: string | null | undefined,
): boolean {
  const aud = audienceBucket(audienceType);
  const cat = categoryBucket(category);
  if (aud === "neutral") return true; // no audience selected → don't hide anything
  if (cat === "neutral") return true; // universal block → always visible
  return aud === cat; // leadership↔leadership, practice↔practice
}

/**
 * Leadership-only block types — blocks whose presence in a template marks
 * the whole template as leadership-oriented. Pulled from the "DSO" category
 * in BLOCK_REGISTRY. Kept as a hardcoded list (rather than reading category
 * at runtime) so we can reason about template contents on both the client
 * and the server, where BLOCK_REGISTRY is not importable.
 *
 * Keep this in sync with `category: "DSO"` entries in block-registry.tsx.
 */
export const LEADERSHIP_ONLY_BLOCK_TYPES: readonly string[] = [
  "dso-insights-dashboard",
  "dso-lab-tour",
  "dso-stat-bar",
  "dso-success-stories",
  "dso-challenges",
  "dso-pilot-steps",
  "dso-final-cta",
  "dso-comparison",
  "dso-heartland-hero",
  "dandy-product-hero",
  "dso-ai-feature",
  "dso-problem",
  "dso-stat-showcase",
  "dso-scroll-story",
  "dso-scroll-story-hero",
  "dso-network-map",
  "dso-case-flow",
  "dso-live-feed",
  "dso-particle-mesh",
  "dso-flow-canvas",
  "dso-bento-outcomes",
  "dso-insights-video",
  "dso-cta-capture",
  "dso-case-study",
  "one-pager-hero",
];

/**
 * Practice-only block types — the "DSO Practices" category in BLOCK_REGISTRY.
 * Mirror of LEADERSHIP_ONLY_BLOCK_TYPES so we can gate in both directions
 * (and so custom blocks that wrap one of these types can be identified).
 */
export const PRACTICE_ONLY_BLOCK_TYPES: readonly string[] = [
  "dso-meet-team",
  "dso-paradigm-shift",
  "dso-partnership-perks",
  "dso-products-grid",
  "dso-promo-cards",
  "dso-activation-steps",
  "dso-promises",
  "dso-testimonials",
  "dso-practice-nav",
  "dso-practice-hero",
  "dso-stat-row",
  "dso-faq",
  "dso-split-feature",
  "dso-software-showcase",
];

const LEADERSHIP_SET = new Set(LEADERSHIP_ONLY_BLOCK_TYPES);
const PRACTICE_SET = new Set(PRACTICE_ONLY_BLOCK_TYPES);

/**
 * Determine the audience bucket of a raw block type by name, independent of
 * any catalog row. Useful for gating custom blocks (which wrap a base type)
 * and for server-side template validation where BLOCK_REGISTRY is not
 * importable.
 */
export function blockTypeBucket(blockType: string | null | undefined): AudienceBucket {
  if (!blockType) return "neutral";
  if (LEADERSHIP_SET.has(blockType)) return "leadership";
  if (PRACTICE_SET.has(blockType)) return "practice";
  return "neutral";
}

/** True when a block type may be inserted on a page of the given audience. */
export function isBlockTypeAllowedForAudience(
  blockType: string | null | undefined,
  audienceType: string | null | undefined,
): boolean {
  const aud = audienceBucket(audienceType);
  if (aud === "neutral") return true;
  const bt = blockTypeBucket(blockType);
  if (bt === "neutral") return true;
  return aud === bt;
}

/** True if a template's block list contains any leadership-only block. */
export function templateContainsLeadershipContent(blockTypes: readonly string[] | null | undefined): boolean {
  if (!blockTypes?.length) return false;
  return blockTypes.some(t => LEADERSHIP_SET.has(t));
}
