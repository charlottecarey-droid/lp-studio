---
name: fillEmptyImages explicit-branch fill vs collectImageSlots
description: Why a new image-bearing array prop can be "collected" yet never filled on generated pages
---

`fillEmptyImages` (api-server generate-page.ts) does NOT fill via `collectImageSlots`.

- Its **first pass** calls `collectImageSlots` only to record already-used image identities (dedupe guard).
- Its **second pass** fills empty URLs through **explicit per-block branches** (hero, rows, photo-strip, items, products, the dso-* blocks, …).
- `collectImageSlots` slots are otherwise consumed by `validateAndDedupeAIImages` (duplicate re-pick) and `restoreTemplateImages` — NOT by the fill.

**Why:** a prop array can have a `collectImageSlots` entry (so it's tracked/deduped) and still render empty, because nothing in the second pass writes its URL. This is exactly how `dso-products-grid`/storefront `products[].imageUrl` shipped broken — present in collect, absent in fill, so cards always fell back to the lucide icon.

**How to apply:** a new image-bearing array prop needs THREE coordinated edits in generate-page.ts, not two:
1. `collectImageSlots` `pushArrField` entry — dedupe / used-slot accounting.
2. an explicit branch in `fillEmptyImages`' second pass — actually populates empty URLs (keep its scoring context in sync with #1).
3. a clean pass in `sanitizeAIImageUrls` — runs the field through `cleanUrl()` so a hallucinated/Unsplash/external host the model invents is stripped instead of shipping to render.

Miss #2 → renders empty (the `products[]` bug). Miss #3 → a non-library URL leaks straight to the page (caught in review when the dandy-* `items[].imageUrl`/`tabs[].imageUrl` fields were added — `items[].image` was sanitized but the distinct `imageUrl` key was not). Gate fills on `!x.imageUrl` (truthiness), never `"imageUrl" in x`, so an omitted key still backfills.

Extra gotchas for `products`:
- The AI schema emits products as `{name, detail, price, icon, imageKey}` with **no `imageUrl` key** — gate the fill on `!product.imageUrl`, never on `"imageUrl" in product` (the latter skips every card).
- `imageKey` (e.g. "aligners", "posterior-crowns") is the strongest subject signal; hyphens→spaces and lead the scoring context with it. There is no `category` field on products despite older code referencing one.
- Only assign when `pick()` returns a non-empty URL, so a no-match slot keeps its icon fallback.
