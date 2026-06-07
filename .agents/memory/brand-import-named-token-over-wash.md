---
name: Brand-import named token beats pixel wash
description: Why brand-color extraction must trust named --brand CSS tokens over the pixel-sampled palette, and how the CSS-var name matcher must work.
---

Brand-color extraction picks `primary` from two competing signals: a pixel-sampled
screenshot palette and named CSS custom properties. A large vivid hero/gradient
WASH (e.g. Stripe's orange `#FF6201`) floats to the FRONT of the sampled palette,
and the LLM happily echoes that front color — so pixels alone mis-pick a background
region as the brand primary.

**Rule:** when a named `--brand`/`--primary` custom property exists AND a pixel
palette is present, the named token wins the primary slot. A declared brand token is
the highest-confidence brand signal; a pixel-sampled wash must not outrank it.

**Why:** Task fixing the Stripe regression (imported orange instead of blurple
`#533AFD`) without regressing the photo-heavy royaldesign brown-rejection fix.

**How to apply:**
- Gate the override on `palette.length > 0`. With NO pixel palette (pasted-text
  imports) there is no wash to guard against, so a valid LLM primary must stay —
  this is the exact discriminator the "prefers LLM over CSS-var fallback" test relies on.
- The named-brand candidate must exclude background-ish tokens (`--brand-bg`,
  `--primary-surface/card`) and weak (near-grey/brown) values, then rank remaining
  candidates by salience (saturation × chroma) to land the vivid MID-scale shade of a
  brand color ramp, not a pale tint (`brand-100`) or near-black extreme (`brand-975`).
- The CSS-var harvester (`extractCssVarPaletteHints` in evidence.ts) must match a
  role keyword as a dash-delimited SEGMENT anywhere in the token name, not just right
  after `--`. Design-system sites namespace tokens (`--hds-color-core-brand-600`),
  so the old anchored `--brand…` regex silently captured NOTHING and the extractor
  never saw the brand color. Use the `i` flag for camelCase (`brandDark`), drop the
  generic `color` keyword (floods noise), and prioritize+cap the output (brand/primary
  first, slice ~48) so hundreds of role tokens can't bury the brand entries.
