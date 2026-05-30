---
name: One-pager brand asset URLs
description: How Dandy one-pager images are hosted/seeded and the base-path gotcha for consuming them.
---

One-pager generator images (audience headers, product screenshot, header logo) for Dandy live in `SalesConsoleConfig.onePagerHeaderImages{executive,clinical,practiceManager}` / `onePagerProductScreenshot` / `onePagerLogoUrl` (brand-config.ts). Empty/unset MUST render a neutral generated header — never a Dandy bitmap fallback.

**Hosting decision:** static public files (`artifacts/lp-studio/public/one-pager/*` + existing `/dandy-logo-white.svg`), NOT object storage.
**Why:** object storage uses per-environment buckets + random UUIDs, so an isolated task env can't mint stable prod URLs. Committed public files deploy with the app and have identical dev/prod paths. Precedent: Dandy `logoUrl = /dandy-logo.svg`.

**Seeding:** seed scripts for these fields must iterate `PROTECTED_ENTERPRISE_SLUGS` (@workspace/plan-config) so seeding agrees with downstream gating (single source of truth for "is Dandy"), set-if-empty (never clobber tenant overrides), and be dry-run-default + apply-gated + idempotent — matching the existing Dandy seed-script convention.

**Base-path gotcha (for consumers, e.g. one-pager PDF/web render):** seeded URLs are root-relative (`/one-pager/...`). Under a non-root `BASE_PATH`, root-relative URLs resolve outside the app mount.
**How to apply:** before fetching/rendering a brand asset URL that starts with `/`, normalize against the app base (`${import.meta.env.BASE_URL}foo` for `/foo`) or origin. Same latent risk exists for the legacy `/dandy-logo.svg`. The shared reader/normalizer is `resolveOnePagerAssets(brand)` in brand-config.ts (returns null per asset when unset → neutral); built-in PDF generators must resolve through it, never via hardcoded `@/assets` imports.

**Client-side Dandy asset gating must use the server-computed `isDandy` flag, never the editable `brandName`.**
**Why:** `brandName` is admin-editable, so gating a Dandy-asset fallback on `brandName === "dandy"` lets any tenant leak Dandy assets by renaming. `/lp/brand` resolves `isDandy` from the immutable protected tenant slug (`isDandyTenant` → `PROTECTED_ENTERPRISE_SLUGS`) and returns it on `BrandConfig.isDandy` (read-only; stripped client+server before persist, recomputed every GET).
**How to apply:** `resolveOnePagerAssets` restores the bundled Dandy default for EVERY one-pager asset (logo, product screenshot/agreement scanner, and all three audience header images) only when `brand.isDandy === true` AND the matching `salesConsole.onePager*` field is empty; any tenant overrides via that field. Reuse `brand.isDandy` for any future Dandy-only client asset decision — do not reintroduce a `brandName` check.

**Existing Dandy tenants were never seeded, so the isDandy fallback — not the seed script — is the reliable restore path.**
**Why:** the de-branding seed script only ran for some slugs/envs; when a previously-hardcoded Dandy bitmap goes neutral after de-branding, the symptom (missing scanner/header image) is the unseeded brand row, not a code bug in the generator.
**How to apply:** when a one-pager asset that used to be a hardcoded Dandy default regresses to neutral for Dandy, add an `isDandy`-gated `dandyFallback(explicit, defaultPath)` entry in `resolveOnePagerAssets` (paths mirror `scripts/src/seed-dandy-one-pager-assets.ts`) rather than relying on re-running the seed. The Agreement Summary editor also exposes a per-template `headerImage` upload (data URL) that the LP-studio wrapper prefers over the brand-config product screenshot; the wrapper strips it before the shared generator so `scrubBrandDeep` never walks the data URL.

**Dandy-bitmap leak sites are spread across the page, editor, AND templates files — not just the generator.**
**Why:** a wrapper-only audit misses callers that inject their own bitmap (uploaded/forced header, or a logo arg) before the shared generator runs, so the leak survives even after the generator itself is clean.
**How to apply:** when de-branding, grep `@/assets` across ALL one-pager files (page + editor + templates), not only the generator file. Note the custom-template generator is a separate code path from the built-in templates and may still carry a Dandy logo independently.
