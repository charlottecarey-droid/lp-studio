/**
 * Shared block-type alias guard used by BOTH the sales-microsite generator and
 * the LP-from-prompt generator.
 *
 * The AI sometimes emits a "natural" block type name that has NO renderer in
 * lp-studio's BlockRenderer (which would surface an "Unknown block type"
 * placeholder on the published page). The most common offender is a bare
 * `features` block, but the same latent problem exists for the other synonym
 * names the block normalizers already treat as equivalents (`stats`,
 * `testimonials`, `cta`). Each of those maps to a real, renderable block that
 * carries the identical prop shape.
 *
 * Canonicalizing the emitted type to its renderable equivalent is pure
 * defense-in-depth: even if the prompt never advertises these synonyms, a
 * hallucinated one can never break the page.
 */

/**
 * Synonym block type → canonical renderable block type. Every value here MUST
 * have a matching `case` in lp-studio's BlockRenderer, and the block normalizer
 * must produce the same prop shape for the synonym as for its canonical type.
 */
export const BLOCK_TYPE_ALIASES: Readonly<Record<string, string>> = {
  features: "benefits-grid",
  stats: "trust-bar",
  testimonials: "testimonial",
  cta: "bottom-cta",
};

/**
 * Map an AI-emitted block type to its canonical renderable equivalent. Unknown
 * (non-alias) types pass through unchanged — callers that want to drop truly
 * unrenderable types validate against their own allow-list afterward.
 */
export function canonicalizeBlockType(type: string): string {
  return BLOCK_TYPE_ALIASES[type] ?? type;
}
