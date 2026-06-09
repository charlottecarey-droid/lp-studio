---
name: Bulk actions on paginated multi-select
description: A bulk action over a paginated selection must use the full selected-id set, not the current page's loaded rows.
---

In a paginated media/list screen where a `selected` Set persists across page changes (page nav does NOT clear it), a bulk action must operate on the **whole** `selected` set, not on `items.filter(i => selected.has(i.id))` (only the current page's loaded rows).

**Why:** filtering the loaded `items` silently under-applies the action to selected rows on other pages while still looking successful after a refresh. Bulk *delete* gets this right (sends `[...selected]` ids directly); a bulk *tag edit* is the trap because it also needs each row's current tag array, which the client only has for the loaded page.

**How to apply:** when the action needs per-row data the client doesn't have for off-page rows, do it server-side — POST `{ ids, ...}` to a tenant-scoped bulk endpoint that reads + rewrites each row itself (e.g. `POST /lp/media/remove-tag`). The visible menu of choices can still be derived from the current page; the *mutation* must cover all selected ids.
