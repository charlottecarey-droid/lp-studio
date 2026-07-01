---
name: Full-page block classification — two coordinated surfaces
description: Making a block type read as "full page" in the builder Templates tab requires BOTH the shared registry set AND a block_catalog category re-shelf migration.
---

Whether a block/template shows up under the builder's **Full Page Templates**
grouping is decided by two independent sources that must stay in sync:

1. **Registry set** `FULL_PAGE_BLOCK_TYPES` in `lib/lp-template-engine/src/block-tags.ts`
   — drives `isFullPageTemplate(blocks)`, used to bucket hardcoded LP_TEMPLATES
   and DB/global templates by their first block type. After editing it you must
   rebuild the composite lib dist (`tsc -b lib/lp-template-engine --force`) or
   consumers read the stale dist.
2. **`block_catalog.category`** column (superadmin catalog full-page blocks) —
   the builder's catalog full-page section reads this DB value, not the registry
   set. A migration re-shelves rows to `category = 'Full Page Templates'`.

**Why this is a trap:** the re-shelf migration is **marker-guarded and additive**.
There is a v1 step (with its own `_schema_migration_markers` key) that already
ran and stamped its marker. If you add a NEW full-page type and just edit the v1
step's type array, **nothing happens** — the v1 marker already exists so the step
is skipped forever. You must add a **fresh step with a NEW marker key** (e.g.
`block_catalog_full_page_category_v2`) that re-shelves only the newly-added types.
Keep it idempotent (`category IS DISTINCT FROM ...`) and non-fatal (grouping is
cosmetic; never crash boot over it).

**How to apply:** to promote a block type to full-page in the builder:
- add it to `FULL_PAGE_BLOCK_TYPES` + rebuild the engine dist;
- add a new marker-guarded re-shelf step in `artifacts/api-server/src/migrate.ts`
  for just that type (never reuse an already-stamped marker).
