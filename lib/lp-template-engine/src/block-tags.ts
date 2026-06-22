/**
 * Semantic block role tags — the ONE shared vocabulary that describes what
 * structural role a landing-page block fills (hero, footer, cta, …).
 *
 * Single source of truth, reused everywhere:
 *   - lp-studio's BLOCK_REGISTRY tags every block as a code default.
 *   - api-server's block-catalog CRUD validates/persists per-industry overrides.
 *   - api-server's AI page generator feeds resolved tags into the prompt so
 *     generated pages reliably include hero / footer / CTA / social-proof /
 *     stats sections.
 *   - the superadmin Block Catalog UI edits per-block, per-industry tags.
 *
 * Tags are advisory metadata only. They do NOT introduce new block types and
 * do NOT change rendering — they guide composition and AI selection.
 */

/**
 * The controlled vocabulary of structural roles. This is the closed set —
 * adding a role is a code change here (and only here). `header` covers
 * header/nav blocks; `form` covers form/lead-capture blocks.
 */
export const BLOCK_ROLE_TAGS = [
  "hero",
  "header",
  "footer",
  "stats",
  "social-proof",
  "cta",
  "features",
  "comparison",
  "pricing",
  "faq",
  "form",
  "content",
  "media",
  "layout",
] as const;

export type BlockRoleTag = (typeof BLOCK_ROLE_TAGS)[number];

const ROLE_TAG_SET: ReadonlySet<string> = new Set(BLOCK_ROLE_TAGS);

/**
 * Short human descriptions for each role — surfaced in the superadmin UI and
 * injected into the AI prompt so the model understands what each tag means.
 */
export const BLOCK_ROLE_TAG_DESCRIPTIONS: Record<BlockRoleTag, string> = {
  hero: "Top-of-page headline section that frames the offer",
  header: "Site header / navigation bar",
  footer: "Page footer with links, legal, and secondary nav",
  stats: "Hard numbers and metrics that quantify value",
  "social-proof": "Testimonials, logos, case studies, trust signals",
  cta: "Call-to-action that drives the primary conversion",
  features: "Product features, benefits, capabilities, how-it-works",
  comparison: "Old-way vs new-way or us-vs-them comparison",
  pricing: "Pricing tiers, plans, and packages",
  faq: "Frequently asked questions",
  form: "Lead-capture or contact form",
  content: "Editorial / narrative / informational content",
  media: "Image, video, gallery, or other media-led section",
  layout: "Structural / container / spacing primitive",
};

export function isBlockRoleTag(value: unknown): value is BlockRoleTag {
  return typeof value === "string" && ROLE_TAG_SET.has(value);
}

/**
 * Normalize arbitrary input into a clean, deduped list of valid role tags.
 * Invalid/unknown entries are dropped (fail-closed); order follows the
 * controlled vocabulary so output is stable regardless of input order.
 */
export function sanitizeRoleTags(input: unknown): BlockRoleTag[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<BlockRoleTag>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (isBlockRoleTag(v)) seen.add(v);
  }
  return BLOCK_ROLE_TAGS.filter((t) => seen.has(t));
}

/**
 * Code-default role tags for every block in the in-code BLOCK_REGISTRY.
 * Keyed by block `type`. This is the fallback when no per-industry catalog
 * override exists. Every registered block type appears here with ≥1 tag.
 */
export const DEFAULT_BLOCK_TAGS: Record<string, readonly BlockRoleTag[]> = {
  // ── Layout ────────────────────────────────────────────────────────────────
  hero: ["hero"],
  "photo-strip": ["media"],
  spacer: ["layout"],
  "nav-header": ["header"],
  footer: ["footer"],
  "full-bleed-hero": ["hero"],
  "parallax-image-hero": ["hero"],
  "sticky-header": ["header"],
  "dandy-site-header": ["header"],
  "centered-logo-nav": ["header"],
  "mega-menu-nav": ["header"],
  "minimal-nav": ["header"],
  "transparent-overlay-nav": ["header"],
  "split-media-row": ["content"],
  "full-bleed-split": ["content", "media"],
  "icon-row": ["features"],
  "media-cards-row": ["features", "media"],
  "stat-row": ["stats"],
  "pas-icon-grid": ["content", "features"],
  "pas-split-image": ["content"],
  "pas-stat-agitate": ["content", "stats"],
  "pas-before-after": ["content", "comparison"],
  "full-bleed-final-cta": ["cta"],
  "split-form-final-cta": ["cta", "form"],
  "stat-backed-final-cta": ["cta", "stats"],
  "social-urgency-final-cta": ["cta", "social-proof"],
  "gradient-glow-final-cta": ["cta"],
  "video-background-final-cta": ["cta", "media"],
  "dandy-site-footer": ["footer"],

  // ── Social Proof ────────────────────────────────────────────────────────────
  "trust-bar": ["social-proof", "stats"],
  "stat-callout": ["stats", "social-proof"],
  "logo-wall": ["social-proof"],
  "logo-marquee": ["social-proof"],
  "rating-badges": ["social-proof", "stats"],
  "avatar-social-proof": ["social-proof"],
  testimonial: ["social-proof"],
  "case-studies": ["social-proof"],
  "dandy-video-testimonials": ["social-proof", "media"],
  "story-hub": ["social-proof", "content"],
  "quote-carousel": ["social-proof"],
  "quote-library": ["social-proof"],
  "quote-with-image": ["social-proof", "media"],
  "single-quote": ["social-proof"],
  "testimonial-grid": ["social-proof"],
  "case-study-card-grid": ["social-proof", "stats"],
  "case-study-logo-results-row": ["social-proof", "stats"],
  "case-study-metric-triptych": ["social-proof", "stats"],
  "case-study-spotlight-feature": ["social-proof"],
  "testimonial-wall": ["social-proof"],
  "stat-counter-band": ["stats", "social-proof"],

  // ── Content ─────────────────────────────────────────────────────────────────
  "pas-section": ["content"],
  comparison: ["comparison"],
  "how-it-works": ["content", "features"],
  "video-section": ["media", "content"],
  resources: ["content"],
  "resource-link-list": ["content"],
  "rich-text": ["content"],
  "custom-html": ["content"],
  "zigzag-features": ["features", "media"],
  "product-showcase": ["features", "content"],
  "dandy-versus": ["comparison"],
  "dandy-columns-v2": ["features", "content"],
  "dandy-columns-v3": ["features", "content"],
  "dandy-vertical-tabs": ["features", "content"],
  "dandy-switchback": ["features", "media"],
  "dandy-side-image-v6": ["features", "media"],
  "bold-statement": ["content"],
  "menu-section": ["content"],
  "hours-location": ["content"],

  // ── Grid Pieces ─────────────────────────────────────────────────────────────
  "benefits-grid": ["features"],
  "product-grid": ["features", "media"],
  section: ["layout"],
  columns: ["layout"],
  grid: ["layout"],
  stack: ["layout"],
  "grid-image": ["media", "layout"],
  "grid-headline-sub": ["content", "layout"],
  "grid-paragraph-bullets": ["content", "layout"],
  "grid-headline-paragraph": ["content", "layout"],
  "grid-icon-feature": ["features", "layout"],
  "grid-stat": ["stats", "layout"],
  "grid-quote": ["social-proof", "layout"],
  "grid-cta-tile": ["cta", "layout"],
  "grid-logo": ["social-proof", "layout"],
  "grid-video": ["media", "layout"],
  "custom-schema": ["content", "layout"],

  // ── CTA ─────────────────────────────────────────────────────────────────────
  "bottom-cta": ["cta"],
  "cta-button": ["cta"],
  "cta-centered-minimal": ["cta"],
  "cta-split-image": ["cta"],
  "cta-stat-backed": ["cta", "stats"],
  "cta-gradient-banner": ["cta"],
  "dandy-conversion-panel-1": ["cta", "form"],
  "dandy-cta-block": ["cta"],

  // ── Lead Capture ────────────────────────────────────────────────────────────
  form: ["form"],
  "dandy-form-right-alt": ["form"],

  // ── Engagement ──────────────────────────────────────────────────────────────
  popup: ["form", "cta"],
  "sticky-bar": ["cta"],

  // ── Interactive ─────────────────────────────────────────────────────────────
  "roi-calculator": ["content", "cta"],

  // ── DSO ─────────────────────────────────────────────────────────────────────
  "dso-insights-dashboard": ["features", "stats"],
  "dso-lab-tour": ["media", "features"],
  "dso-stat-bar": ["stats", "social-proof"],
  "dso-success-stories": ["social-proof"],
  "dso-challenges": ["content"],
  "dso-pilot-steps": ["content", "features"],
  "dso-final-cta": ["cta"],
  "dso-comparison": ["comparison"],
  "dso-heartland-hero": ["hero"],
  "dso-ai-feature": ["features"],
  "dso-problem": ["content"],
  "dso-stat-showcase": ["stats", "social-proof"],
  "dso-scroll-story": ["content", "media"],
  "dso-scroll-story-hero": ["hero"],
  "dso-network-map": ["features", "media"],
  "dso-case-flow": ["features", "content"],
  "dso-live-feed": ["social-proof", "content"],
  "dso-particle-mesh": ["stats", "features"],
  "dso-flow-canvas": ["social-proof", "stats"],
  "dso-bento-outcomes": ["features", "stats"],
  "dso-insights-video": ["media"],
  "dso-cta-capture": ["cta", "form"],
  "dso-case-study": ["social-proof"],
  "one-pager-hero": ["hero"],

  // ── Hero ────────────────────────────────────────────────────────────────────
  "dandy-product-hero": ["hero"],
  "dandy-hero-v7-s3": ["hero"],
  "horizontal-showcase": ["features", "media"],
  "scroll-assembly": ["features", "media"],

  // ── DSO Practices ───────────────────────────────────────────────────────────
  "dso-meet-team": ["content"],
  "dso-paradigm-shift": ["comparison"],
  "dso-partnership-perks": ["features"],
  "dso-products-grid": ["features", "media"],
  "dso-promo-cards": ["cta"],
  "dso-activation-steps": ["content", "features"],
  "dso-promises": ["features"],
  "dso-testimonials": ["social-proof"],
  "dso-practice-nav": ["header"],
  "dso-practice-hero": ["hero"],
  "dso-stat-row": ["stats", "social-proof"],
  "dso-faq": ["faq"],
  "dso-split-feature": ["features", "media"],
  "dso-software-showcase": ["features", "media"],

  // ── Events ──────────────────────────────────────────────────────────────────
  "event-page": ["content"],
  "event-landing-hero": ["hero"],
  "product-launch": ["hero", "content"],
  "spatial-tour": ["media", "features"],
  "content-series": ["content", "media"],
  "webinar-hub": ["hero", "content", "media", "cta"],
  "blog-series": ["content", "media"],
  storefront: ["features", "media"],

  // ── Full-page templates (Events + Case Studies) ─────────────────────────────
  "event-noir": ["hero", "content", "media"],
  "event-luminous": ["hero", "content", "media"],
  "event-split": ["hero", "content", "media"],
  "case-metrics": ["hero", "content", "media"],
  "case-editorial": ["hero", "content", "media"],
  "case-modular": ["hero", "content", "media"],

  // ── DSO Microsites ──────────────────────────────────────────────────────────
  "business-case-split": ["content"],
  "business-case-centered": ["content"],
  "business-case-premium": ["content"],
  // Full-page sales-narrative templates (StoryBrand / MEDDIC / Challenger).
  // Like business-case-*, each renders an entire standalone page and carries
  // the broad "content" role only.
  "storybrand-journey": ["content"],
  "exec-decision-brief": ["content"],
  "challenger-insight": ["content"],
  "deal-room": ["content"],
  "account-microsite": ["content"],
  "onboarding-hub": ["content"],
  "value-renewal-review": ["content"],

  // ── Showcase ────────────────────────────────────────────────────────────────
  "sticky-stack": ["features", "media"],
  "magazine-hero": ["hero"],
  "cinematic-video-hero": ["hero"],
  "aurora-gradient-hero": ["hero"],
  "editorial-split-hero": ["hero"],
  "parallax-layers-hero": ["hero"],
  "spotlight-glow-hero": ["hero"],
  "launch-spotlight-hero": ["hero"],
  "bento-mosaic-hero": ["hero"],
  "kinetic-type-hero": ["hero"],
  "glass-bento-features": ["features"],
  "feature-tabs-showcase": ["features", "media"],
  "glass-pricing-tiers": ["pricing"],
  "aurora-cta-finale": ["cta"],
  "id-hero": ["hero"],
  "id-marquee": ["media"],
  "id-intro": ["content"],
  "id-cinema-pillars": ["features", "media"],
  "id-parallax-showcase": ["media", "features"],
  "id-system-flow": ["features"],
  "id-form": ["form"],
  "id-stats": ["stats"],
  "id-invitation": ["cta", "content"],
  "id-grid": ["features", "layout"],
  "id-spotlight": ["features", "media"],
  "id-reservation-pass": ["cta", "form"],
  "bento-showcase": ["features", "media"],
  "gradient-pricing": ["pricing"],
  "editorial-carousel": ["media", "social-proof"],
  "before-after-gallery": ["media"],
  "gallery-carousel-spotlight": ["media", "content"],
  "gallery-filmstrip": ["media", "content"],
  "gallery-masonry": ["media", "content"],
  "gallery-split-feature": ["media", "features"],
  "media-feature-reel": ["media", "features"],
  "media-looping-showcase": ["media"],
  "media-thumbnail-grid": ["media", "content"],
  "media-video-split": ["media", "features"],
  "speaker-grid": ["content"],
  "benefits-alternating-rows": ["features"],
  "how-it-works-alternating": ["features"],
  "how-it-works-numbered-bento": ["features"],
  "how-it-works-vertical-timeline": ["features"],
  "how-it-works-horizontal-stepper": ["features"],
  "benefits-bento": ["features"],
  "features-bento-showcase": ["features"],
  "features-spotlight-cards": ["features"],
  "features-tabbed-categories": ["features"],
  "features-comparison-checklist": ["features", "comparison"],
  "benefits-icon-grid": ["features"],
  "benefits-stat-led": ["features"],
};

/**
 * A NEUTRAL, tenant-agnostic default block for each structural role. Used to
 * satisfy a REQUIRED page-outline CATEGORY step when the segment's approved
 * pool has no block of that role — e.g. a generic tenant that has not curated
 * an approved pool (the common case): its pool is empty, so without these
 * fallbacks an authored category outline silently collapses to only the roles
 * that happened to have a default (hero/cta/footer). With these, a category
 * outline always renders the structure the tenant authored.
 *
 * Every value here is a GENERIC block (never a Dandy-/DSO-/industry-specific
 * type) so it is safe to drop into any tenant's page. `layout`, `pricing`, and
 * `faq` are intentionally omitted: `layout` is a structural primitive (not a
 * sensible standalone section), and there is no neutral pricing/faq block in
 * the shared vocabulary — a required step for one of those still falls through
 * gracefully rather than emitting an industry-specific block.
 *
 * These only fill steps the pool could NOT satisfy, so curated tenants (whose
 * pool covers their roles) are unaffected.
 */
export const NEUTRAL_ROLE_DEFAULT_BLOCKS: Partial<Record<BlockRoleTag, string>> = {
  hero: "hero",
  header: "nav-header",
  footer: "footer",
  stats: "stat-row",
  "social-proof": "testimonial",
  cta: "bottom-cta",
  features: "benefits-grid",
  comparison: "comparison",
  content: "rich-text",
  media: "video-section",
  form: "form",
};

/**
 * Full-page template block types — blocks that render an ENTIRE standalone page
 * (their own hero, body, and chrome) rather than composing into a larger page.
 * A page whose first block is one of these is a "full-page template": users
 * pick it as-is, not as a section to combine with other blocks.
 *
 * This is the BROAD, user-facing classification used to badge/filter templates
 * in the marketplace and superadmin tools. It is intentionally wider than the
 * AI's narrow "self-contained" set (api-server generate-page.ts), which only
 * lists blocks that render their own nav AND footer so the generator skips ALL
 * chrome injection. business-case-* are full-page templates here, but render
 * their own nav with no footer, so they are NOT in the AI self-contained set.
 */
export const FULL_PAGE_BLOCK_TYPES: ReadonlySet<string> = new Set([
  "content-series",
  "webinar-hub",
  "blog-series",
  "storefront",
  "event-noir",
  "event-luminous",
  "event-split",
  "case-metrics",
  "case-editorial",
  "case-modular",
  "business-case-split",
  "business-case-centered",
  "business-case-premium",
  "storybrand-journey",
  "exec-decision-brief",
  "challenger-insight",
  "deal-room",
  "account-microsite",
  "onboarding-hub",
  "value-renewal-review",
]);

/** True when a block type renders an entire standalone full-page template. */
export function isFullPageBlockType(type: unknown): boolean {
  return typeof type === "string" && FULL_PAGE_BLOCK_TYPES.has(type);
}

/**
 * True when a template/page is a full-page template — i.e. its FIRST block is a
 * full-page block type. (Most are a single block; content-series carries a
 * trailing block but still leads with its full-page block.)
 */
export function isFullPageTemplate(
  blocks: ReadonlyArray<{ type?: unknown }> | null | undefined,
): boolean {
  return (
    Array.isArray(blocks) &&
    blocks.length > 0 &&
    isFullPageBlockType(blocks[0]?.type)
  );
}

/**
 * Microsite-create compatibility (task #1219 / #1220).
 *
 * The create-microsite flow (NewMicrositeModal → /lp/generate-page or the sales
 * generate-microsite path) builds a page from a chosen template. Both
 * generators treat the authored template layout as authoritative: they re-emit
 * the COPY only and deep-merge it over the authored structure, forcing each
 * block's id/type from the template and never stripping the template's own
 * block types. As a result ANY template that has at least one recognizable
 * block can be used to create a microsite — full-page ("crowns") templates,
 * one-pagers, business-case monographs, and ordinary section-composed pages
 * alike. The authored structure survives; only the copy (and, on request, the
 * imagery) is personalized.
 *
 * The only templates that can't build a page are ones with no usable blocks at
 * all. Those are flagged incompatible so the create-microsite dropdown can hide
 * them by default (Template settings lets an admin override either way).
 */
export interface MicrositeTemplateCompatibility {
  compatible: boolean;
  /** Short human-readable reason; null when compatible. */
  reason: string | null;
}

/**
 * Classify a template's blocks for the create-microsite dropdown. `compatible`
 * is the computed default (used when an admin hasn't explicitly toggled the
 * template); `reason` explains an incompatibility for the Template settings UI.
 */
export function getMicrositeTemplateCompatibility(
  blocks: ReadonlyArray<{ type?: unknown }> | null | undefined,
): MicrositeTemplateCompatibility {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { compatible: false, reason: "Template has no blocks to build a page from." };
  }
  const hasRecognizableBlock = blocks.some(
    (b) => b && typeof b.type === "string" && b.type.trim().length > 0,
  );
  if (!hasRecognizableBlock) {
    return { compatible: false, reason: "Template has no recognizable blocks." };
  }
  return { compatible: true, reason: null };
}

/** Code-default tags for a block type. Returns a fresh array (never shared). */
export function getDefaultBlockTags(type: string): BlockRoleTag[] {
  const def = DEFAULT_BLOCK_TAGS[type];
  return def ? [...def] : [];
}

/**
 * Resolve the effective role tags for a block. A non-empty, valid set of
 * per-industry override tags (e.g. from the block_catalog DB row) wins;
 * otherwise the code default applies. Empty/absent overrides never blank out
 * a block's role.
 */
export function resolveBlockTags(type: string, overrideTags?: unknown): BlockRoleTag[] {
  const overrides = sanitizeRoleTags(overrideTags);
  if (overrides.length > 0) return overrides;
  return getDefaultBlockTags(type);
}
