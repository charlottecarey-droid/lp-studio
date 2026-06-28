---
name: LP Studio default favicon assets
description: The default browser-tab/app icon spans 6 files (1 SVG + 5 rasters); update them together or the tab falls back to a stale light icon.
---

The default (non-Dandy) LP Studio tab/app icon is NOT one file. `index.html` declares an SVG icon plus a legacy `.ico`, an apple-touch PNG, and a webmanifest; browsers / bookmarks / PWA each pick a different one.

**The 6 default surfaces (all must show the same mark — the DARK/navy mark):**
- `public/brand/favicon-navy.svg` — modern tab SVG (`index.html` `type="image/svg+xml"`). `favicon-cream.svg` is the LIGHT/cream variant, intentionally NOT used for the tab/app icon — it's the cream mark for dark UI surfaces (the sign-in page's dark panel uses a cream lockup). Owner explicitly wants the tab favicon dark and the cream only on the dark sign-in background.
- `public/favicon.ico` — legacy raster fallback (16/32/48): old browsers, bookmarks, Windows pin.
- `public/apple-touch-icon.png` (180) — iOS home screen; needs an OPAQUE bg (iOS renders alpha as black).
- `public/icon-192.png`, `public/icon-512.png` — manifest `purpose:"any"`.
- `public/icon-maskable-512.png` — manifest `purpose:"maskable"`; solid bg + safe-zone padding (mark ~70% centered).

**Gotcha (the lesson):** updating only the SVG leaves the 5 rasters as a STALE light/cream version that the tab still falls back to — so the tab looks "wrong" even though the SVG is right. Regenerate ALL five from the source mark together (ImageMagick `magick`): `-define icon:auto-resize=48,32,16` for the `.ico`; flatten apple-touch + maskable onto the brand bg.

**Mark source of truth (default = NAVY):** the tab/app icon is the navy mark — navy #25214D rounded square (sheen/depth), cream #F6F2E9 "LP", coral #E26B4F dot. The 5 rasters are rendered from `favicon-navy.svg` (≈ `attached_assets/lp-icon-indigo-depth.svg`) via `magick -background none -density 512`; apple-touch + maskable flatten onto navy #25214D (square blends to a navy field, cream LP centered in the safe zone), ico/192/512 keep alpha. A cream variant exists (`favicon-cream.svg` + `attached_assets/lp-icon-cream-depth-1024…png`, cream square / navy LP / coral dot) for DARK surfaces — do NOT swap it into the tab icon; the owner reverted a cream-favicon change and wants navy in the tab.

**Dandy exception — never touch for a default change:** `src/main.tsx applyTenantFavicon()` runtime-swaps on Dandy hosts to `/dandy-favicon.ico`, `/dandy-apple-touch-icon.png`, `/dandy.webmanifest`, and SVG → root `/favicon.svg` (the Dandy "d"). Leave all `dandy-*` files and `public/favicon.svg` alone.

**Deploy:** `artifacts/lp-studio/dist/` is gitignored; `build` = `vite build` (copies `public/` verbatim, NO favicon-gen step) + prerender + upload-to-R2, so source rasters flow through. Browsers cache favicons hard — a hard refresh may be needed to see the change.
