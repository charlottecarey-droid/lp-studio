---
name: Product library types need a generate-page consumer
description: lp_library_items types product_showcase/product_grid had no page-gen consumer, so product blocks fell to the random image-fill pool
---

A Content Library type can exist in `lp_library_items` `VALID_TYPES` (and have full
frontend CRUD + a builder property-panel LibraryPicker) yet have **no consumer in
`generate-page.ts`**. When that happens the matching AI-generated block gets nothing
from the curated library and falls through to the generic media-fill pool — which is
why `product-grid` / `product-showcase` blocks showed random/irrelevant images.

**Rule:** every Content Library type that backs a page block needs a fetch + enforce
step in `generate-page.ts`, mirroring the case-study path
(`fetchApprovedCaseStudies` + `enforceDsoSuccessStoriesApproved`). For products:
`fetchProductLibraryItems` + `enforceProductLibraryBlocks`.

**Why:** the library is the tenant's source of truth for its own products (each row
carries the real product line + its curated image); the random fill pool is not.

**How to apply:**
- The enforce step must run **AFTER** the image-fill pipeline (`fillEmptyImages` /
  `aiFillEmptyImages`, called before the case-study enforce sites in BOTH the
  template path and the JSON path) so the library image is the FINAL value, not
  overwritten by a pool image.
- Field names map 1:1 onto the renderer props (verify against `generic-blocks.ts` /
  `common.ts`, never the prompt-schema string): `product_grid` content
  `{title,description,image}` → `items[]{image,title,description}`;
  `product_showcase` content `{name,description,badge,image}` → `cards[]`.
- Give each same-type block a FRESH mapped array (no shared mutable references).
- No-op by type when the tenant has no approved rows (block keeps AI/template
  content) — never blank a block just because the library is empty.
- Run it unconditionally (not gated on `urlSourcedFacts`): a tenant's own product
  catalog is authoritative even when a reference URL was scraped.
- `approved_for_ai` is NOT NULL / default-true; filter with `IS NOT FALSE`.
- Scope so far is `product-grid` + `product-showcase` only; `dso-products-grid` uses
  a different `imageKey`-enum mechanism and was intentionally left out.
