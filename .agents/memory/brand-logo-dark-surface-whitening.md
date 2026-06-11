---
name: Brand logo dark-surface whitening + blend-mode tone
description: How BrandLogo stays legible on dark heroes/navs, and the tone rule for mix-blend-difference navs.
---

# Brand logo on dark surfaces

`BrandLogo`'s non-recolor branch (raster files, or `KNOWN_MULTICOLOR_LOGOS` SVGs
that opt out of the mask) renders a plain `<img>` in native colors. On a dark
surface that is usually a dark mark → invisible "dark-on-dark".

**Rule (sample-gated, do NOT blindly whiten):** white-silhouette
(`filter: brightness(0) invert(1)`) is the DEFAULT safety net on a dark surface
(no dedicated `logoUrlDark`, no per-block `url`), but it is SUPPRESSED once a
pixel-sample proves the mark isn't predominantly dark. The component samples the
mark's average luminance (32px canvas, alpha-weighted) and keeps whitening only
when `markLum === null || markLum < 0.35`; a multi-color or light mark
(`markLum >= 0.35`) renders in its native colors. This is symmetric with the
existing light-surface `darkenForLight` guard (which darkens only `markLum > 0.7`).

**`whitenCandidate` is NOT gated by `KNOWN_MULTICOLOR_LOGOS`.** That set opts a
mark out of the brand-primary MASK-RECOLOR only (so the single-color Dandy mark
stays its native green on light, not pink) — it must NOT also suppress dark-
surface whitening. Dandy's `/dandy-logo*.svg` are SINGLE-color (`#003A30` green,
samples ~0.18 < 0.35) so they correctly whiten to a clean silhouette on dark
again; a genuinely multi-color mark is still left native by the sample. If you
ever re-add `!isKnownMulticolor` to `whitenCandidate`, the Dandy logo goes
invisible (dark-on-dark) on dark heroes/navs.

**Why:** blindly whitening turned multi-color marks (e.g. a tenant's colorful
raster logo) into a flat white blob on dark footers/heroes. Keeping whiten as the
DEFAULT (not native) avoids a flash and avoids a regression for the common dark
monochrome wordmark with no dark variant. An UNSAMPLEABLE cross-origin mark
(tainted canvas) stays whitened — uploading a `logoUrlDark` is the way to show
such a mark in native colors. Same-origin (mirrored) logos sample fine, so the
multi-color fix applies automatically; cross-origin CDNs that send CORS headers
also sample and get the fix.

# mix-blend-difference navs must pass tone="onDark"

Navs wrapped in `mix-blend-difference` (e.g. `BlockEditorialSplitHero`) are built
for a WHITE wordmark that inverts against whatever sits behind it. Passing
`tone="onLight"` recolors a monochrome SVG to `var(--brand-primary)` (pink for
Dandy) which reads wrong under the blend. Always use `tone="onDark"` there so the
logo renders white in both the recolor and non-recolor paths.

**How to apply:** any newer hero/nav block that renders `BrandLogo` over a dark
or blend-mode surface should use `tone="onDark"`; reserve `tone="onLight"` /
`brandLogoToneForText` for genuinely light, non-blended surfaces.

# Logo tone must follow the surface the logo is PAINTED on

A block whose logo sits on a surface DIFFERENT from the block body must derive
the logo tone from that local surface, not the body. `BlockHero`'s logo is in
the top `<nav>` painted `brand.navBgColor` (default `#000000`), independent of
the hero-body `isDarkBg(backgroundStyle)`. Pin it to `brandLogoToneForSurface(
relativeLuminance(navBgColor) < 0.4)`, not a hardcoded `tone="onDark"`.

**Why:** once `BrandLogo` force-whitens raster/multicolor marks on `onDark`,
any hardcoded `onDark` over a light surface renders white-on-light (invisible).
A configurable or separate surface makes a hardcoded tone wrong half the time.

**How to apply:** guard the hex (`isValidHex` → fallback `#000000`) before
luminance, since `navBgColor` is a free string. Heroes that are inherently dark
(gradient/video/image, or a fixed dark scrim like DSO Heartland) keep `onDark`.
