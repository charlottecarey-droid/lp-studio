/**
 * MICROSITE-only block extras — PURE DATA, no imports.
 *
 * Microsites now offer the SAME freeform vocabulary as a landing page: the
 * GENERAL landing-page system prompt's block set UNION the microsite-only extras
 * listed below. This list enumerates the curated microsite members; the entries
 * that the general prompt does NOT already advertise (currently `stats`,
 * `rich-text`, `footer`) are layered on as the microsite-only extras, while the
 * rest are already covered by the general set. The union (general ∪ extras) is
 * assembled in recipe-block-vocab.ts (`micrositeFreeformVocab`) and consumed by
 * both the generator and the recipe builder.
 *
 * This means microsites DO get the premium dso- blocks the general prompt
 * advertises (e.g. dso-heartland-hero) — that is intentional. This list itself
 * carries no dso- or business-case- compound entries; those reach microsites only
 * via the general prompt, exactly as they reach landing pages.
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
  "dso-paradigm-shift",
  "dso-stat-row",
  "dso-software-showcase",
  "dso-ai-feature",
  "dso-final-cta",
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
  "dso-paradigm-shift": "comparison — premium old-way vs new-way paired bullets",
  "dso-stat-row": "stats — premium headlined metrics row",
  "dso-software-showcase": "features — premium product/feature showcase with a visual",
  "dso-ai-feature": "features — premium feature showcase with bullets, stats, and a visual",
  "dso-final-cta": "cta — premium closing call to action",
  "bottom-cta": "cta — closing call to action",
  "footer": "footer — closes the page; always last",
};
