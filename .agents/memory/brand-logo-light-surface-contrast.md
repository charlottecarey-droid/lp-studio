---
name: BrandLogo light-surface contrast (autoContrast)
description: Why a white/light raster logo vanishes on light footers and how the contrast guard is gated.
---

A tenant's single logo lives in `BrandConfig.logoUrl`; `logoUrlDark` is the optional dark-surface variant. Some tenants upload a WHITE logo into `logoUrl` and leave `logoUrlDark` empty (e.g. Televerde/Rasta). `BrandLogo` already force-whitens non-recolorable logos on DARK surfaces (`whitenForDark`) so they read, but the symmetric LIGHT case was missing — the white logo rendered "white-on-white" and disappeared on the light footer.

The guard: an opt-in `autoContrast` prop on `BrandLogo`. On a light surface it paints the plain-`<img>` (non-recolorable) logo to a dark silhouette (`brightness(0)`) ONLY when no `logoUrlDark` was uploaded, excluding known multi-color marks and explicit `url` overrides. The auto-recolor SVG path is untouched.

**Why:** We deliberately did NOT pixel-sample the logo to detect its luminance — cross-origin rasters (logos are often hosted off-site, e.g. televerde.com) taint the canvas and fail. The presence/absence of `logoUrlDark` is the tenant's own signal: if they bothered to upload a dark-surface variant, `logoUrl` is trustworthy as the light-surface mark; if not, the single logo is ambiguous and silhouetting guarantees contrast (consistent with the existing dark-side whitening philosophy).

**How to apply:** Surfaces that can be either light or dark (footers) should pass `autoContrast` AND drive `tone` from the surface's ACTUAL darkness (`onDark`/`onLight`), never from brand-primary luminance (`onPrimary`). Tradeoff: a tenant with a colored single logo and no `logoUrlDark` gets silhouetted black on light footers — fix by uploading a proper `logoUrlDark`. Do NOT enable `autoContrast` globally (admin previews/nav would silhouette colored logos).
