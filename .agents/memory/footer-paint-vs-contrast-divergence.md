---
name: Surface paint-vs-contrast divergence (white-on-white)
description: Why on-brand surfaces (footers, inline-form heroes) rendered white-on-white and the rule to prevent it.
---

# Surface white-on-white: paint the SAME color you contrast against

A footer (or any block) must paint its background from the EXACT resolved hex it
runs its contrast math against. The generic footer used to paint
`backgroundColor: var(--brand-primary)` (a CSS var) while computing text / logo
tone / title / muted / border colors from a separately-resolved real hex
(`bgHex`). When the var was out of scope on the painted element — prerender, or
`injectPageMeta` HTML which does NOT inject CSS vars — the surface painted
transparent/white while the math still assumed a dark surface → white text +
`onDark` white logo on a white surface.

**Rule:** resolve the brand var to a real hex BEFORE the contrast math, then
paint that same hex. Never paint a raw `var(--brand-*)` whose value the contrast
math doesn't actually see.

**Why:** `getBrandStyleVars` only sets `--brand-primary` on `[data-lp-page]` via
React inline style; baked/prerendered/injected HTML paths may not carry it, so a
bare `var()` with no fallback collapses to transparent (white).

**How to apply:**
- Generic footer (`BlockFooter.tsx`): paints `bgHex` (already the contrast-math
  source); logo tone derives from `isDarkBg` (from `bgHex`) + `autoContrast`.
- Dandy footer (`BlockDandySiteFooter.tsx`): fixed light `#FDFCFA` bg → logo needs
  `autoContrast` so a white/single-color raster mark darkens to read (Dandy's own
  mark is in `KNOWN_MULTICOLOR_LOGOS` so it stays native green, unaffected). Its
  brand-var headings/links/icon fills carry a literal `var(--brand-primary, #0f172a)`
  fallback so they never vanish when the var is out of scope.
- Any new on-brand block surface: give every `var(--brand-*)` a hex fallback and
  paint the resolved hex, not the bare var.
- On-brand hero w/ inline email form (`BlockDandyHeroV7S3.tsx`): two failure modes
  beyond the bare-var paint — (1) hard-coded `text-white` headline/sub/trust/
  disclaimer vanish on a pale brand primary; (2) the white email input had a
  `border-transparent` so the box itself disappeared on white. Fix = derive all
  text from `resolveSectionInk({}, { base: bgHex })` and give the input
  `border-slate-300` when the surface is light (luminance >= 0.4), keeping
  `border-transparent` only on dark surfaces.
