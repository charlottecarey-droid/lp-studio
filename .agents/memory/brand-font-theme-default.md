---
name: Brand font @theme default must stay neutral
description: Why the global --brand-font-display default in index.css must be the app font, not a tenant-specific face
---

The LP page heading font cascades as: `[data-lp-page] { --font-display: var(--brand-font-display, var(--app-font-display)) }`, and `getBrandStyleVars` writes `--brand-font-display` on the page wrapper ONLY when a tenant has a non-empty `displayFont`. When empty, the wrapper inherits the GLOBAL `@theme` default of `--brand-font-display` from index.css.

**Rule:** the `@theme` default of `--brand-font-display` (and `--brand-font-body`) MUST stay `var(--app-font-display)` / `var(--app-font-sans)`. Never hardcode a specific face (e.g. `'Bagoss Standard'`) there.

**Why:** a commit titled "Update Dandy's heading font to Bagoss Standard" hardcoded `--brand-font-display: 'Bagoss Standard', var(--app-font-display)` in `@theme`. Because the override is only written for tenants WITH an explicit font, every fontless tenant inherited the global Bagoss default → "same font for everyone" regression on all LP pages. Dandy did not even need the hack: Dandy's stored brand config already has `displayFont="Bagoss Standard"` (and `bodyFont="Inter"`), so it gets Bagoss through `getBrandStyleVars` like any other tenant.

**How to apply:** want a single tenant to have a specific brand font → set it in that tenant's brand config (`displayFont`), never in the shared `@theme`/`:root` defaults. The shared default is the white-label neutral and bleeds onto every tenant that hasn't chosen a font.
