/**
 * COPY_FIELDS maps each block type to the text fields that the AI "refresh copy"
 * button on the canvas overlay will rewrite in one click.
 *
 * Rules:
 *  - Only include plain string fields (no arrays, no nested objects).
 *  - The order matters: richer context fields first so the AI can see the full
 *    block intent before generating secondary fields.
 *  - Blocks whose copy is exclusively inside nested arrays (e.g. steps, tiles,
 *    rows, chapters) should still list top-level heading fields so the button
 *    appears — the nested content is left to per-item controls in the panel.
 */
export const COPY_FIELDS: Partial<Record<string, string[]>> = {
  // ── Standard LP blocks ──────────────────────────────────────────────────
  "hero":               ["headline", "subheadline", "ctaText"],
  "full-bleed-hero":    ["headline", "subheadline", "ctaText"],
  "video-section":      ["headline", "subheadline", "ctaText"],
  "benefits-grid":      ["headline", "subheadline"],
  "how-it-works":       ["headline", "subheadline"],
  "zigzag-features":    ["headline", "body"],
  "pas-section":        ["headline", "body", "ctaText"],
  "bottom-cta":         ["headline", "subheadline", "ctaText"],
  "testimonial":        ["quote"],
  "case-studies":       ["headline"],
  "product-grid":       ["headline", "subheadline"],
  "stat-callout":       ["headline"],
  "comparison":         ["headline"],
  "product-showcase":   ["headline", "subheadline"],
  "sticky-bar":         ["headline", "ctaText"],
  "cta-button":         ["ctaText"],

  // ── DSO enterprise blocks (dso-heartland-*) ──────────────────────────────
  "dso-heartland-hero":   ["eyebrow", "headline", "subheadline", "primaryCtaText", "secondaryCtaText"],
  "dso-scroll-story-hero":["eyebrow", "ctaText"],
  "dso-problem":          ["eyebrow", "headline", "body", "ctaText"],
  "dso-ai-feature":       ["eyebrow", "headline", "body", "ctaText"],
  "dso-stat-showcase":    ["eyebrow", "headline"],
  "dso-scroll-story":     ["eyebrow"],
  "dso-network-map":      ["eyebrow", "headline", "body", "ctaText"],
  "dso-case-flow":        ["eyebrow", "headline", "subheadline"],
  "dso-live-feed":        ["eyebrow", "headline", "body", "footerNote"],
  "dso-particle-mesh":    ["eyebrow", "headline", "body"],
  "dso-flow-canvas":      ["eyebrow", "stat", "statLabel", "quote", "attribution"],
  "dso-bento-outcomes":   ["eyebrow", "headline"],
  "dso-challenges":       ["eyebrow", "headline"],
  "dso-comparison":       ["eyebrow", "headline", "subheadline"],
  "dso-success-stories":  ["eyebrow", "headline", "ctaText"],
  "dso-pilot-steps":      ["eyebrow", "headline", "subheadline", "ctaText"],
  "dso-cta-capture":      ["eyebrow", "headline", "body", "inputLabel", "ctaLabel", "trust1", "trust2", "trust3"],
  "dso-final-cta":        ["eyebrow", "headline", "subheadline", "primaryCtaText", "secondaryCtaText"],
  "dso-stat-bar":         ["eyebrow", "headline"],

  // ── DSO Practices blocks ──────────────────────────────────────────────────
  "dso-practice-nav":       ["ctaText"],
  "dso-practice-hero":      ["eyebrow", "headline", "subheadline", "primaryCtaText", "secondaryCtaText", "trustLine"],
  "dso-stat-row":           ["eyebrow", "headline"],
  "dso-faq":                ["eyebrow", "headline", "subheadline"],
  "dso-split-feature":      ["eyebrow", "headline", "body", "ctaText"],
  "dso-meet-team":          ["eyebrow", "headline", "subheadline", "ctaText"],
  "dso-paradigm-shift":     ["eyebrow", "headline", "subheadline"],
  "dso-partnership-perks":  ["eyebrow", "headline", "subheadline"],
  "dso-products-grid":      ["eyebrow", "headline", "subheadline"],
  "dso-promo-cards":        ["eyebrow", "headline", "subheadline"],
  "dso-activation-steps":   ["eyebrow", "headline", "subheadline", "ctaText"],
  "dso-promises":           ["eyebrow", "headline", "subheadline"],
  "dso-testimonials":       ["eyebrow", "headline", "subheadline"],
  "dso-lab-tour":           ["title", "subtitle", "description", "quote", "quoteAttribution", "ctaLabel"],
};
