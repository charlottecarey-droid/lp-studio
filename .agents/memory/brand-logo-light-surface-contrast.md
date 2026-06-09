---
name: BrandLogo light-surface contrast (autoContrast)
description: Why a white/light raster logo vanishes on light footers and how the contrast guard is gated.
---

A tenant's single logo lives in `BrandConfig.logoUrl`; `logoUrlDark` is the optional dark-surface variant. Some tenants upload a WHITE logo into `logoUrl` and leave `logoUrlDark` empty (e.g. Televerde/Rasta). `BrandLogo` already force-whitens non-recolorable logos on DARK surfaces (`whitenForDark`) so they read, but the symmetric LIGHT case was missing — the white logo rendered "white-on-white" and disappeared on the light footer.

The guard: an opt-in `autoContrast` prop on `BrandLogo`. On a light surface it paints the plain-`<img>` (non-recolorable) logo to a dark silhouette (`brightness(0)`) — but ONLY when the mark is actually predominantly LIGHT, decided by **pixel sampling**, not by `logoUrlDark` presence. The auto-recolor SVG path is untouched.

**Why the heuristic changed:** The original gate darkened ANY single logo lacking a `logoUrlDark` variant. That destroyed common colored/dark raster marks — a tenant's colorful logo rendered as a solid black blob on the light footer (the "black logos" bug). The `logoUrlDark`-absence signal is too blunt: most tenants never upload a dark variant yet have a perfectly readable colored/dark logo.

**Current approach (pixel sampling):** In a `useEffect`, draw the logo to a 32px canvas, average the luminance of opaque pixels (alpha ≥ 16), and only set `darkenForLight` when mean luminance > 0.7 (predominantly light/white wordmark). `markIsLight` starts `null` → default is NO darken, so a colored mark never flashes black before the sample resolves. Canvas taint (cross-origin) / load failure → no darken (safe for the common colored logo). Logos are same-origin `/api/storage` assets, so the old "can't pixel-sample, it taints" assumption was wrong for our case. All hooks (`useState`/`useEffect`) must run BEFORE the `if (!src) return null` early return (rules of hooks).

**How to apply:** Surfaces that can be either light or dark (footers) should pass `autoContrast` AND drive `tone` from the surface's ACTUAL darkness (`onDark`/`onLight`), never from brand-primary luminance (`onPrimary`). Do NOT enable `autoContrast` globally (admin previews/nav). Tradeoff: a genuinely WHITE single logo hosted off-site (CORS-tainted) won't be sampled and stays native (invisible on light) — fixed by uploading a proper `logoUrlDark`. Do NOT revert to the `logoUrlDark`-only darken gate.
