---
name: New block-type graduation callsites
description: The full set of synced callsites required to graduate a mockup into a new lp-studio block type; the easy-to-miss ones.
---

Graduating a mockup into a brand-new lp-studio block type touches ~9 coordinated callsites. Missing any one fails silently at runtime or breaks tsc:

1. `block-types/generic-blocks.ts` — props interface (extend `HeroBrandStyleConfig` for brand/font discipline).
2. `block-types/index.ts` — export the props type.
3. `block-types/block-variant.ts` — **BOTH** add the type to the `import type {…} from "./generic-blocks"` block **AND** add the union member. Adding only the union member compiles nowhere — tsc errors "Cannot find name XBlockProps". This is the most-missed edit.
4. `block-types/block-registry.tsx` — type import + registry ENTRY (label/category/defaultProps/thumbnail) + `createBlock` switch case + `createBlock` typed overload signature (heroes/this all add overloads for parity).
5. `blocks/BlockRenderer.tsx` — component import + switch case.
6. `pages/builder/property-panels/PropertyPanel.tsx` — panel import + switch case.
7. `lib/seo-scoring.ts` — add to the right role Set (SOCIAL_PROOF_TYPES / AUTHORITY_TYPES / STRUCTURED_TYPES).
8. `lib/block-settings-capabilities.ts` — capability set (self-contained bands = `SELF_STYLED`).
9. `lib/lp-template-engine/src/block-tags.ts` — default semantic role tags.

**Why:** lp-studio tsc is >12min, so a missed callsite is expensive to discover. The registry ENTRY (palette) is separate from the `createBlock` case — adding only `createBlock` means the block compiles but never appears in the builder palette.

**How to apply:** when adding any new block type, run this list end-to-end before the first typecheck. Social-proof-style blocks (logos/avatars/ratings/testimonials) are deliberately kept OUT of STAT_BAR_BLOCK_TYPES and the api-server AI page-gen prompt to avoid fabricated proof; use field names like `logos[].imageUrl`/`avatars[].imageUrl` (not `items[].image`) so the AI photo pipeline ignores them.
