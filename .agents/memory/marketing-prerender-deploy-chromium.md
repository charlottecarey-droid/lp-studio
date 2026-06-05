---
name: Marketing prerender needs nix chromium at deploy build
description: Why the deploy build (not dev) crashes the Playwright marketing prerender, and the self-contained-chromium fix.
---

The lp-studio production build is `vite build && node scripts/prerender-marketing.mjs && node scripts/upload-assets-to-r2.mjs`. The prerender step launches headless Chromium (via `@playwright/test`) to bake SEO/OG meta into static marketing HTML — it cannot simply be dropped.

**Rule:** the deploy build requires a *self-contained* system chromium (nix `pkgs.chromium`, declared in `replit.nix`). `prerender-marketing.mjs` and `playwright.config.ts` both `detectSystemChromium()` via env `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` then `command -v chromium`; if none is found they fall back to Playwright's BUNDLED `chrome-headless-shell`, which is NOT self-contained.

**Why:** the bundled chrome-headless-shell has no RPATH for its graphics libs (`libglib-2.0.so.0`, `libnss3`, `libgbm`, `libasound`, X11, …). It runs in the **dev/e2e workflow shell** only because that shell puts those nix libs on `LD_LIBRARY_PATH`. The **deploy build env strips that path**, so the bundled binary dies with `error while loading shared libraries: libglib-2.0.so.0` → `browserType.launch: Target page, context or browser has been closed` → build exits 1. So "e2e passes in dev" does NOT prove the deploy prerender will work.

**How to apply:** keep `pkgs.chromium` in `replit.nix` (installed via `installSystemDependencies(["chromium"])`). nix chromium is patchelf'd with a full RPATH, so it runs in both dev and the deploy build regardless of `LD_LIBRARY_PATH`, and `command -v chromium` auto-detects it. If the prerender ever crashes at publish with a missing-shared-library error, the system chromium is missing/unresolvable — do NOT just delete the prerender step (loses baked SEO meta). Verify with `ldd $(readlink -f $(command -v chromium)) | grep "not found"` returning nothing.
