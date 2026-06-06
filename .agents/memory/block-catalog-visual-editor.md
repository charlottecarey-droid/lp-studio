---
name: Block Catalog visual editor (catalog mode)
description: How the superadmin "Edit visually" flow reuses BuilderEditor to edit global block defaults, and what must stay gated on catalogMode.
---

The superadmin Block Catalog ("Edit visually") reuses the existing page builder instead of a bespoke editor.

**Flow:** Catalog row → POST `/api/admin/block-catalog/scratch-page` (ensureSystemTenant; deterministic slug `__catalog-<industry>-<block_type>`; single block; carries `__catalog*` page_variables) → navigate `/builder/:pageId`. The builder detects "catalog mode" purely from `pageVariables.__catalog` + `__catalogBlockType`. Save branches to PUT `/api/admin/block-catalog/default-props` (writes `block_catalog.default_props` for (block_type, industry), preserving label/category/tags/is_enabled/ai_enabled/sort_order on conflict) — it does NOT save the scratch page.

**Why:** avoids duplicating the prop-editing UI; the scratch page is a throwaway owned by the reserved `__system-templates` system tenant.

**How to apply:** any new full-page builder chrome (sidebars, insertion bars, top-bar actions, deselection behavior) must gate on `catalogMode` at EVERY callsite, mirroring the lp-fullpage-block-wiring pattern — otherwise the catalog editor lets the superadmin add/remove blocks or publish, corrupting the single-block default. `catalogMode` is threaded into builder-top-bar via a `catalogMode` prop (+ optional `catalogSaveLabel`). Backend `updated_by` is INTEGER (`req.authUser.userId`), not email.
