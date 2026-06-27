/**
 * Neutral-freeform MICROSITE block vocabulary — PURE DATA, no imports.
 *
 * When neither the selected segment nor the brand defines a curated
 * micrositeBlockList, the neutral-freeform microsite path lets the model pick a
 * VARIED layout from this neutral, industry-agnostic block set (instead of the
 * old flat 7-block NEUTRAL list, which made every non-Dandy microsite look the
 * same). It is deliberately restricted to general blocks: NEVER the Dandy-curated
 * dso-* or business-case-* compound blocks, which carry dental/DSO vocabulary and
 * are reserved for Dandy's curated path.
 *
 * This module holds ONLY the two pure-data constants so they can be shared by
 * BOTH the generator (generate-microsite.ts) AND the recipe-builder vocabulary
 * (recipe-block-vocab.ts) without dragging the huge generator route into the
 * vocab module or creating an import cycle. Canonicalization, schemas and the
 * allow-set live next to where they are used (generate-microsite.ts).
 *
 * NOTE: every entry here MUST have a renderer in lp-studio's BlockRenderer.
 * `features` was removed (it has NO renderer — it produced an "Unknown block
 * type" placeholder; `benefits-grid`/`zigzag-features` cover the "features"
 * role). `stats` is kept as a distinct semantic label but is canonicalized to
 * the renderable `trust-bar` at normalize time.
 */
export const FREEFORM_MICROSITE_DISPLAY_TYPES = [
  "hero",
  "trust-bar",
  "benefits-grid",
  "testimonial",
  "how-it-works",
  "comparison",
  "stats",
  "pas-section",
  "stat-callout",
  "rich-text",
  "video-section",
  "bottom-cta",
  "footer",
] as const;

/**
 * Short role hint per displayed block so the model understands each section's
 * job (mirrors the shared block-role-tag vocabulary used by enforceRequiredRoles).
 */
export const FREEFORM_ROLE_HINTS: Record<string, string> = {
  "hero": "hero — opens the page; exactly ONE, always first",
  "trust-bar": "social proof + stats — quick credibility/metrics bar",
  "benefits-grid": "features — benefit/value cards",
  "testimonial": "social proof — a real-sounding customer quote",
  "how-it-works": "features — numbered process steps",
  "comparison": "comparison — old-way vs new-way",
  "stats": "stats — hard metrics row",
  "pas-section": "content — problem / agitate / solve narrative",
  "stat-callout": "stats — one big highlighted metric",
  "rich-text": "content — short narrative prose section",
  "video-section": "media — embedded video",
  "bottom-cta": "cta — closing call to action",
  "footer": "footer — closes the page; always last",
};
