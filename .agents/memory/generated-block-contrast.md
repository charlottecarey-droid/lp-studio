---
name: AI page block contrast safety
description: Why generated LP blocks must derive text/badge/button colors from their actual background, not pair two brand colors blindly.
---

# Generated landing-page block contrast

The AI page generator (api-server `generate-page.ts` SYSTEM_PROMPT) emits a fixed
block catalog: hero, trust-bar, pas-section, comparison, stat-callout,
benefits-grid, testimonial, how-it-works, product-grid, bottom-cta, form,
video-section, zigzag-features, photo-strip — plus an injected footer. Only these
blocks appear on generic generated pages (the DSO/Dandy template blocks do NOT).

## Rule
A block must NEVER assume two brand colors contrast with each other. Two failure
patterns recur and produce "blue on blue / dark on dark" illegible output:
- `backgroundColor: accent, color: primary` (badges, pills, submit buttons) →
  invisible when a brand's accent ≈ primary (e.g. Zoom blue).
- `bg-[var(--brand-primary)]` + hardcoded `text-white` / accent-colored
  eyebrows/icons → breaks for light-primary brands and hides accent-on-primary.

## How to apply
Derive foreground from the *actual* background using the helpers in
`lib/brand-config.ts`:
- Body/heading on a brand-color section: `contrastTextColor(bgHex)` then use
  `opacity-*` utilities (which inherit `currentColor`) instead of `text-white/NN`.
- Accent eyebrows/icons over a brand bg: `pickContrastingColor(accent, bgHex, [onBg], 3.0)`.
- Buttons: `pickCtaButtonColors(brand, sectionBg)` → `{bg, text}`.
- Badges whose bg is the accent: `contrastTextColor(accentHex)` for the label.
Always resolve a real hex first (`isValidHex(x) ? x : DEFAULT_BRAND.<color>`) since
some values are CSS `var(--brand-*)` strings the math can't read.

**Why:** fixing at the render-block layer fixes all existing + future pages at
once; regenerating content does not. This is the correct layer for contrast bugs.

## Known limitation
Footer/hero logos are often raster PNGs. `BrandLogo` auto-recolor only works on
SVGs, so a blue raster wordmark on a blue footer cannot be recolored here — that
is a separate logo-asset problem, not a text-contrast problem.
