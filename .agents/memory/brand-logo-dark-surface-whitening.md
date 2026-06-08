---
name: Brand logo dark-surface whitening + blend-mode tone
description: How BrandLogo stays legible on dark heroes/navs, and the tone rule for mix-blend-difference navs.
---

# Brand logo on dark surfaces

`BrandLogo`'s non-recolor branch (raster files, or `KNOWN_MULTICOLOR_LOGOS` SVGs
that opt out of the mask) renders a plain `<img>` in native colors. On a dark
surface that is usually a dark mark → invisible "dark-on-dark".

**Rule:** in the plain-`<img>` branch, when the surface is dark (`onDark`, or
`onPrimary`/`onAccent` whose color is dark) AND we did not pick a dedicated dark
asset (`brand.logoUrlDark`, with no per-block `url` override), force a white
silhouette via `filter: brightness(0) invert(1)` (same convention the partner
logos already use in `StickyHeroNav`).

**Why:** legibility must win over color fidelity. A tenant who wants their
colored logo preserved on dark must supply `logoUrlDark` (then we use it as-is,
no filter). The recolor/mask branch is unaffected — it already paints `#fff`
for `onDark`.

# mix-blend-difference navs must pass tone="onDark"

Navs wrapped in `mix-blend-difference` (e.g. `BlockEditorialSplitHero`) are built
for a WHITE wordmark that inverts against whatever sits behind it. Passing
`tone="onLight"` recolors a monochrome SVG to `var(--brand-primary)` (pink for
Dandy) which reads wrong under the blend. Always use `tone="onDark"` there so the
logo renders white in both the recolor and non-recolor paths.

**How to apply:** any newer hero/nav block that renders `BrandLogo` over a dark
or blend-mode surface should use `tone="onDark"`; reserve `tone="onLight"` /
`brandLogoToneForText` for genuinely light, non-blended surfaces.
