---
name: contrastTextColor mispicks on mid-tone fills
description: Why CTA label colors must use pickContrastingColor, not contrastTextColor, for legibility on brand-colored buttons
---

`contrastTextColor(hex)` in `lib/brand-config.ts` chooses black/white from a
*simple* luminance (`0.2126r+0.7152g+0.0722b` on raw 0–1 channels) with a fixed
`L > 0.55` threshold. This is NOT gamma-correct and disagrees with the real WCAG
contrast ratio (which `pickContrastingColor`/`relativeLuminance` use). On a
mid-tone fill — e.g. a blue accent like `#2d8cff` — it returns white even though
black is far more legible (white ≈ 3.2:1, black ≈ 6.6:1), silently producing a
sub-4.5 CTA label.

**Rule:** for a CTA label sitting on a brand/accent fill, derive the text with
`pickContrastingColor(preferred, fill, [contrastTextColor(fill)], 4.5)` (guard the
fill with `isValidHex` first), not bare `contrastTextColor(fill)`.

**Why:** the gamma-correct picker falls back to the higher-contrast of black/white
by true ratio, so it self-corrects the mid-tone mispick; `contrastTextColor` alone
can't reach 4.5 on a mid blue because it picked the wrong end.

**How to apply:** any hero/header block whose CTA fill is a tenant/AI color
(parallax pill, dandy CTAs, etc.). Render-based contrast tests live next to the
blocks as `*.contrast.test.ts` (SSR via `renderToStaticMarkup`, parse inline
`style=` on `<a>`/`<button>`; note the parallax pill uses shorthand
`background:#hex`, not `background-color`). Surface for a block is the section's
own bg color even when applied via a CSS class (e.g. BlockHero dark =
`brand.primaryColor`); `BlockDandyProductHero` takes `{block:{props}}` and reads
colors from props, unlike sibling blocks that take flat `{props, brand}`.
