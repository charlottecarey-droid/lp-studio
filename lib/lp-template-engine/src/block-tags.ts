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
  "dandy-site-footer": ["footer"],

  // ── Social Proof ────────────────────────────────────────────────────────────
  "trust-bar": ["social-proof", "stats"],
  "stat-callout": ["stats", "social-proof"],
  testimonial: ["social-proof"],
  "case-studies": ["social-proof"],
  "dandy-video-testimonials": ["social-proof", "media"],
  "story-hub": ["social-proof", "content"],

  // ── Content ─────────────────────────────────────────────────────────────────
  "pas-section": ["content"],
  comparison: ["comparison"],
  "how-it-works": ["content", "features"],
  "video-section": ["media", "content"],
  resources: ["content"],
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

  // ── Showcase ────────────────────────────────────────────────────────────────
  "sticky-stack": ["features", "media"],
  "magazine-hero": ["hero"],
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
  "speaker-grid": ["content"],
};

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
