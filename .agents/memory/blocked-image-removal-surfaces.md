---
name: Removing a hardcoded image from every surface
description: The full set of places a single Unsplash/starter photo id can hide, so "delete this image everywhere" is actually complete.
---

When a user asks to permanently remove a specific image (e.g. an unwanted starter
photo that "won't delete" because it's a shared library row), the same Unsplash
photo id can live in SIX independent places. Removing it from one or two is not
enough — it resurfaces from the others.

The six surfaces:
1. `artifacts/api-server/src/seeds/starterImages.ts` — STARTER_IMAGE_SEEDS (often several size variants of one photo id).
2. Shared `lp_media` rows in **prod Neon** (`tenant_id IS NULL`, `is_shared=true`). These are why a tenant can't delete it from their picker. Delete via a tsx script importing `@workspace/db` (DATABASE_URL in shell points at prod Neon; `executeSql`/code_execution hits the STALE Helium DB — do not use it).
3. `artifacts/api-server/src/seeds/industryTemplates.ts` — built-in industry template seed source.
4. Live `lp_pages` rows in prod (the `ind-*` global template pages under the system tenant) — the photo is baked into `blocks` jsonb (hero `imageUrl`, feature `image`/`src`). String-REPLACE the id in `blocks::text`.
5. `artifacts/lp-studio/src/lib/block-types/block-registry.tsx` — frontend block DEFAULT props. Easy to miss; users adding that block get the image again.
6. (only if a live tenant page already baked it) published R2 snapshots — but a `lp_pages.blocks` grep returning only template rows means no tenant page has it.

**Why:** seeds, DB rows, and frontend defaults are unrelated code paths; backend grep being clean does NOT mean the frontend is.

**How to apply:** decide on ONE approved replacement photo id (a comparable
in-pool starter) and use it consistently across 3,4,5; delete outright from 1,2.
Before declaring done, grep the BARE photo id (e.g. `1606811971618`) repo-wide
excluding `**/dist/**` and require zero matches. A code review caught surface #5
after backend grep was already clean.
