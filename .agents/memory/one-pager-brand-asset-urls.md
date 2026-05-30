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

**Dandy-bitmap leak sites are spread across the page, editor, AND templates files — not just the generator.**
**Why:** a wrapper-only audit misses callers that inject their own bitmap (uploaded/forced header, or a logo arg) before the shared generator runs, so the leak survives even after the generator itself is clean.
**How to apply:** when de-branding, grep `@/assets` across ALL one-pager files (page + editor + templates), not only the generator file. Note the custom-template generator is a separate code path from the built-in templates and may still carry a Dandy logo independently.
