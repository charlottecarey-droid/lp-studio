---
name: Tenant-facing placeholder branding
description: Input placeholders in LP Studio app UI must be brand-neutral, never Dandy
---

LP Studio is multi-tenant; the app UI (brand settings, builder property panels,
sales one-pager editor, forms, etc.) is shared by all tenants. Any hardcoded
"Dandy"/"meetdandy.com" in a JSX `placeholder` attribute leaks Dandy branding to
every tenant.

**Rule:** input-field `placeholder` text must use brand-neutral examples:
- company/brand name -> `Acme` (`DANDY` -> `ACME`)
- Chili Piper URL -> `https://yourcompany.chilipiper.com/...`
- websites/emails -> `example.com` / `name@example.com`
- "Dandy logo" -> "your logo"

**Why:** placeholders render for all tenants; Dandy is the sole white-label
exception and only its *own* microsite/login may show Dandy branding. A bulk
cleanup removed 79 such leaks across 31 files in `artifacts/lp-studio/src`.

**How to apply:** when adding/editing a panel or settings input, keep the
placeholder generic. Scope any future de-brand to `placeholder=` attribute
values only — do NOT touch value bindings, defaults, or logic constants (real
Dandy URLs/defaults legitimately exist in code). A guard test
`artifacts/lp-studio/tests/sales-console-no-dandy-leak.spec.ts` checks rendered
sales-console output for Dandy leaks; a CI grep for
`placeholder=.*(dandy|meetdandy)` would catch regressions earlier.
