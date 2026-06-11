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

**Two strategies, four block types (all in `enforceProductLibraryBlocks`):**
- REPLACE whole list (the two grid blocks): `product-grid` items[] from
  `product_grid`; `product-showcase` cards[] from `product_showcase`.
- MATCH-by-name (keep AI copy, swap only the image): `dandy-product-hero`
  (single `imageUrl`, matched against headline+eyebrow+subheadline) and
  `dso-products-grid` (per-product `imageUrl`, matched on `product.name`).
  `DsoProductItem.imageUrl` already exists and the renderer
  (`BlockDsoProductsGrid.tsx`) does `product.imageUrl || icon-fallback`.
- Match pool = `product_grid` ∪ `product_showcase` rows (a line stored under
  either section supplies its image). Candidate name = `ProductLibraryItem.name`
  (falls back to the row `name` column).
- Matching is **token-coverage**: every significant token of the library name
  must appear in the target's tokens (stopwords + `&`→and stripped), most
  specific (most tokens) wins. **Why:** "guaranteed correct" — "Posterior Crowns"
  must never grab the generic "Crowns & Bridges" image, and an unrelated hero
  headline must keep its existing image rather than get a wrong product photo.
- Match blocks only SET an image on a confident match; never blank an existing
  image when nothing matches.

**Pre-existing note:** these same library product images live in `lp_media` (the
shared pool), so the generic image-fill can ALSO place them on other blocks
(hero/feature) independent of this enforce step — that's by-design, not a bug.

**Brand Settings is the source of truth (layered ON TOP of the library).**
`ProductLine` (mirrored in lp-studio `brand-config.ts` AND api-server
`generate-page.ts`) carries optional `cardImage` / `heroImage` / `contentImages[]`.
`enforceProductLibraryBlocks(blocks, tenantId, brandProductLines?)` takes the brand
lines as a 3rd arg (both callsites pass `brand.productLines`).
- Brand pools are built first and the library is the FALLBACK. For
  `product-grid`/`product-showcase`, when ANY brand `cardImage` exists, KEEP the AI
  items and only swap the matched brand card image per item (no library
  wipe-replace); only when no brand card images exist does the legacy
  wipe-and-replace run. Hero + dso-products-grid prepend brand pools to the library
  pool.
- **Brand-wins-on-tie depends on `bestLibraryImageFor` using `>` (not `>=`)**: at
  equal token specificity the FIRST-seen candidate is kept, so putting the brand
  pool first makes brand win ties. Do not change that comparison without revisiting
  precedence.
- **No regression:** `brandProductLines` undefined/empty (or no image fields set)
  → identical to the legacy library-only path. Guarded by tests that call enforce
  with 2 args and with `[]`.
- Content-image rotation (`applyBrandProductContentImages`) rotates a product's
  `contentImages` across content sections CONFIDENTLY about that product
  (token-coverage on heading-like keys `CONTENT_IMAGE_COPY_KEYS`, per-product
  cursor) so repeats get different photos. Deliberately conservative: only a
  block's single root `imageUrl`/`image` slot, never product blocks or chrome
  (`CONTENT_IMAGE_SKIP_TYPES` = the 4 product types + nav/navbar/header/footer/
  cta/cta-button). It's a DENYLIST — a new content-block type with those props +
  product copy could be rotated; tighten to an allowlist if that bites.
