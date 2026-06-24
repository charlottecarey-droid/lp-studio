---
name: Builder block-palette tab routing
description: How the lp-studio builder decides whether a block CATEGORY shows in the Blocks tab vs the Segments tab.
---

The block palette in `artifacts/lp-studio/src/pages/builder/BuilderEditor.tsx` routes a block to a tab purely by its `category` string (from the catalog, registry as fallback) against a small set of hardcoded category lists — NOT by any per-block flag.

**Rule:** to move a CATEGORY between the Blocks tab and the Segments tab, edit these constants together (all in BuilderEditor.tsx):
- Blocks tab (`BlockLibrary`): `defaultCoreOrder` (ordered list shown + their order) and `knownNonCore` (categories excluded from the "tenant extras" spillover).
- Segments tab (`SegmentLibrary`): `CORE_CATEGORIES` (any category here is EXCLUDED from Segments) and `preferredOrder` (segment display order).
- Insert-block dialog (`InsertBlockDialog`): flat `defaultCategories` (one combined list, not tab-split).

**Why:** the two tabs derive membership from independent lists, so changing only one side creates a footgun — a category absent from `CORE_CATEGORIES` but also a tenantExtra shows up in BOTH tabs (this was "Hero"'s pre-fix state); a category in `knownNonCore` but not `CORE_CATEGORIES` shows only in Segments (pre-fix "Showcase"). Keep Blocks-tab membership and Segments-tab exclusion in lockstep.

**How to apply:** `CustomizeBlockLibraryDialog` needs no edit — it derives its category list dynamically from the live catalog. A category name that is not in the `BlockCategory` union (`common.ts`) is fine in these routing lists because they are plain string arrays/Sets (e.g. "Hero" is cast `as BlockCategory` in the registry). Tenant saved prefs (`applyCategoryOrder`) can still re-order categories per tenant, so the default order is only what a tenant sees before customizing.
