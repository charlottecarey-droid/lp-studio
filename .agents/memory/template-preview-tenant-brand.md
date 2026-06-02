---
name: Template-preview surfaces must use tenant brand
description: Every template/block preview must render with the tenant's real BrandConfig, never DEFAULT_BRAND, or Dandy previews show the neutral slate/blue default instead of the brand palette.
---

Any surface that previews template blocks via `BlockRenderer` must pass the
tenant's brand into BOTH `getBrandStyleVars(brand)` (sets the `var(--brand-*)`
custom props) AND `BlockRenderer brand={brand}`. Using `DEFAULT_BRAND` makes the
preview render in the neutral slate/blue default — the visible symptom is "wrong
colors in the template preview" for branded tenants like Dandy.

**Why:** blocks resolve colors from `var(--brand-*)`, which only carry the tenant
palette when the brand-style vars are seeded from the resolved BrandConfig.

**How to apply:**
- Inside the SaaS shell (sales pages, builder — anything under
  `BrandConfigProvider`): read `const { brand } = useBrandConfig()`.
- Standalone routes outside the provider (e.g. `template-preview.tsx`): fetch via
  `fetchBrandConfig()` into state, defaulting to `DEFAULT_BRAND` until it resolves.
- Reference-correct surfaces: `template-marketplace.tsx` (marketing gallery),
  `template-preview.tsx`, `sales-one-pager-templates.tsx`. The sales template
  library (`sales/sales-marketplace.tsx`) was the one that regressed to
  `DEFAULT_BRAND`.
