/**
 * Per-block capability map for the shared "Style" / Block-Settings panel
 * (task #266). The shared panel is rendered for every block, but most of
 * its controls only matter for blocks whose default styling actually
 * exposes the underlying style hook. This file is the single source of
 * truth for which controls each block should advertise.
 *
 * Rules of thumb:
 *   - Anchor ID is universal (every section can be linked to from a nav).
 *   - Chrome blocks (nav-header, footers, popups, sticky bars, headers)
 *     only need anchor + maybe spacing; they self-style and ignore the
 *     wrapper colors / bg image / scale.
 *   - Spacer is purely structural — only spacing makes sense.
 *   - Custom HTML escapes the wrapper styling — only anchor/spacing.
 *   - "Inside Dandy" cinematic blocks own their own backgrounds and text
 *     palettes; the wrapper styling fights them, so we hide the
 *     non-anchor controls.
 *   - Everything else gets the full set.
 *
 * Adding a new block type? It defaults to "everything supported" — if
 * any of the controls don't apply, add an explicit override below.
 */

export interface BlockSettingsCapabilities {
  /** Anchor ID — always true; declared explicitly for completeness. */
  anchorId: boolean;
  /** Vertical spacing above / below the block. */
  spacing: boolean;
  /** Section background color. */
  bgColor: boolean;
  /** Headline / body / global text colors. */
  textColors: boolean;
  /** Card background color (only blocks that render cards). */
  cardBgColor: boolean;
  /** Text scale (zoom). */
  textScale: boolean;
  /** Side padding. */
  paddingX: boolean;
  /** Min-height (vh) wrapper. */
  minHeight: boolean;
  /** Background image + opacity + parallax group. */
  bgImage: boolean;
  /** Entrance animation style. */
  animation: boolean;
  /**
   * "Modal theme" toggle for blocks whose CTA buttons open the shared
   * site modal. When `true`, the Style panel renders a Light / Dark
   * picker bound to `props.modalTheme` (string-typed in the block's
   * own props) so the modal shell matches the surrounding section
   * without per-block inspector code.
   *
   * Opt-in: only enable for blocks whose component reads
   * `props.modalTheme` and forwards it into the modal renderer. Blocks
   * that don't read it should leave this `false` to avoid a control
   * that has no effect.
   */
  modalTheme: boolean;
}

const ALL: BlockSettingsCapabilities = {
  anchorId: true,
  spacing: true,
  bgColor: true,
  textColors: true,
  cardBgColor: true,
  textScale: true,
  paddingX: true,
  minHeight: true,
  bgImage: true,
  animation: true,
  modalTheme: false,
};

const ANCHOR_ONLY: BlockSettingsCapabilities = {
  anchorId: true,
  spacing: false,
  bgColor: false,
  textColors: false,
  cardBgColor: false,
  textScale: false,
  paddingX: false,
  minHeight: false,
  bgImage: false,
  animation: false,
  modalTheme: false,
};

const SPACER_CAPS: BlockSettingsCapabilities = {
  ...ANCHOR_ONLY,
  spacing: true,
};

/** Cinematic / self-styled blocks that own their full visual surface. */
const SELF_STYLED: BlockSettingsCapabilities = {
  anchorId: true,
  spacing: true,
  bgColor: false,
  textColors: false,
  cardBgColor: false,
  textScale: false,
  paddingX: false,
  minHeight: false,
  bgImage: false,
  animation: false,
  modalTheme: false,
};

/** Hero-ish blocks: keep colors + bg image (the wrapper layer is below the
 *  hero's own paint), but drop card-bg and min-height since they collide. */
const HERO_LIKE: BlockSettingsCapabilities = {
  anchorId: true,
  spacing: true,
  bgColor: true,
  textColors: true,
  cardBgColor: false,
  textScale: true,
  paddingX: true,
  minHeight: false,
  bgImage: true,
  animation: false, // hero blocks own their entrance animation
  modalTheme: false,
};

const OVERRIDES: Record<string, BlockSettingsCapabilities> = {
  // Chrome / page-level singletons -----------------------------------------
  "nav-header": ANCHOR_ONLY,
  "sticky-header": { ...ANCHOR_ONLY, modalTheme: true },
  "sticky-bar": ANCHOR_ONLY,
  "popup": ANCHOR_ONLY,
  "footer": ANCHOR_ONLY,
  "dandy-site-header": ANCHOR_ONLY,
  "dandy-site-footer": ANCHOR_ONLY,
  "dso-practice-nav": ANCHOR_ONLY,

  // Pure structural --------------------------------------------------------
  "spacer": SPACER_CAPS,
  "custom-html": { ...ANCHOR_ONLY, spacing: true, paddingX: true, bgColor: true },

  // Hero-ish ---------------------------------------------------------------
  "hero": HERO_LIKE,
  "full-bleed-hero": HERO_LIKE,
  "parallax-image-hero": HERO_LIKE,
  "magazine-hero": HERO_LIKE,
  "cinematic-video-hero": HERO_LIKE,
  "aurora-gradient-hero": HERO_LIKE,
  "editorial-split-hero": HERO_LIKE,
  "parallax-layers-hero": HERO_LIKE,
  "spotlight-glow-hero": HERO_LIKE,
  "dandy-hero-v7-s3": HERO_LIKE,
  "dandy-product-hero": HERO_LIKE,
  "dso-heartland-hero": HERO_LIKE,
  "dso-practice-hero": HERO_LIKE,
  "one-pager-hero": HERO_LIKE,
  "event-page": HERO_LIKE,
  "event-landing-hero": HERO_LIKE,
  "dso-scroll-story-hero": SELF_STYLED,
  "about-team": SELF_STYLED,
  "launch-spotlight-hero": HERO_LIKE,
  "bento-mosaic-hero": HERO_LIKE,
  "kinetic-type-hero": HERO_LIKE,

  // Self-styled "Inside Dandy" cinematic surfaces --------------------------
  "id-hero": { ...SELF_STYLED, modalTheme: true },
  "id-marquee": SELF_STYLED,
  "id-intro": SELF_STYLED,
  "id-cinema-pillars": SELF_STYLED,
  "id-spotlight": SELF_STYLED,
  "id-parallax-showcase": SELF_STYLED,
  "id-system-flow": SELF_STYLED,
  "id-stats": SELF_STYLED,
  "id-invitation": SELF_STYLED,
  "id-grid": SELF_STYLED,

  // Pinned scroll surfaces (own their sticky internals) --------------------
  "scroll-assembly": SELF_STYLED,
  "horizontal-showcase": SELF_STYLED,
  "sticky-stack": SELF_STYLED,
  "spatial-tour": SELF_STYLED,
  "dso-scroll-story": SELF_STYLED,
  "dandy-switchback": SELF_STYLED,
  "dso-paradigm-shift": SELF_STYLED,

  // Containers don't render text or cards themselves -----------------------
  "section": { ...ALL, textColors: false, cardBgColor: false, bgImage: true },
  "columns": { ...ALL, textColors: false, cardBgColor: false, bgImage: false, minHeight: false },
  "grid":    { ...ALL, textColors: false, cardBgColor: false, bgImage: false, minHeight: false },
  "stack":   { ...ALL, textColors: false, cardBgColor: false, bgImage: false, minHeight: false },

  // Self-styled social-proof bands (own their bg / surface) ----------------
  "logo-wall": SELF_STYLED,
  "logo-marquee": SELF_STYLED,
  "rating-badges": SELF_STYLED,
  "avatar-social-proof": SELF_STYLED,
  "testimonial-wall": SELF_STYLED,
  "stat-counter-band": SELF_STYLED,

  // June-2026 modern wave: glass/dark surfaces with their own bg/accent props
  "glass-bento-features": SELF_STYLED,
  "feature-tabs-showcase": SELF_STYLED,
  "glass-pricing-tiers": SELF_STYLED,
  "aurora-cta-finale": SELF_STYLED,

  // Full-page template monoliths: own their entire surface, palette, and motion
  "storybrand-journey": SELF_STYLED,
  "exec-decision-brief": SELF_STYLED,
  "challenger-insight": SELF_STYLED,
  "deal-room": SELF_STYLED,
  "account-microsite": SELF_STYLED,
  "onboarding-hub": SELF_STYLED,
  "value-renewal-review": SELF_STYLED,

  // Self-styled content directory (owns its bg / surface) ------------------
  "resource-link-list": SELF_STYLED,
  "webinar-hub": SELF_STYLED,

  // Card-less content blocks -----------------------------------------------
  "rich-text":      { ...ALL, cardBgColor: false, bgImage: false, minHeight: false },
  "trust-bar":      { ...ALL, cardBgColor: false, bgImage: false, minHeight: false },
  "stat-callout":   { ...ALL, cardBgColor: false, minHeight: false },
  "bold-statement": { ...ALL, cardBgColor: false, bgImage: true, minHeight: true },
};

export function getBlockSettingsCapabilities(blockType: string): BlockSettingsCapabilities {
  if (blockType.startsWith("custom:") || blockType === "schema" || blockType === "custom-schema") return ALL;
  return OVERRIDES[blockType] ?? ALL;
}

export const ALL_CAPS: BlockSettingsCapabilities = ALL;
