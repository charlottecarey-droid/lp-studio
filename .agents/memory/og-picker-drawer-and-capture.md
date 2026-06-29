---
name: OG picker drawer + capture
description: Why the OG image picker's "images in use" drawer renders garbled and why client-side "Capture Page" produces no imagery / freezes — and the fix shape for both.
---

# OG image picker — drawer garbling + capture failures

The builder's OG (social share image) picker has two independent failure modes that look like UI bugs but are data/CORS/decoder issues.

## Drawer: "Images in use across pages" renders as scrambled/striped tiles
`GET /api/lp/in-use-images` walks page blocks and returns image URLs; the builder renders them all as a `<img>` grid.

**Root cause (two compounding):**
1. The query was **unscoped** — `db.select().from(lpPagesTable)` with no `tenant_id` filter. On the shared prod DB that returns *every tenant's* images (a cross-tenant privacy leak too), so the grid is a huge pile of foreign + broken external URLs.
2. The frontend rendered **every** URL at once as a **full-resolution** `<img>`. On mobile Safari, decoding hundreds of full-res images simultaneously exhausts the image-decode memory budget → tiles render as venetian-blind / scrambled garbage (not the broken-image icon — actual corrupted decode output).

**Fix shape:**
- Tenant-scope the query with `getTenantId(req,res)` (fails closed → 401; route is already behind the blanket `/lp/*` guard), `eq(lpPagesTable.tenantId, tenantId)`.
- Bound it: `orderBy(desc(updatedAt))` + `.limit(~40 pages)`, dedupe URLs into a Set, cap at ~40 returned. Page-level cap avoids serializing the whole DB; URL-level cap prevents the decoder blowup.
- Thumbnails: `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`, and a per-item local `broken` state (return null on `onError`) — never mutate `parentElement.style` from `onError` (React-hostile).

## Capture: "Capture Page" freezes / produces a headline on a blank background with no imagery
`captureOgScreenshot` uses `html-to-image` `toBlob()` on the builder canvas.

**Root causes:**
- **Freeze** = html-to-image inlines every `@font-face`, including cross-origin Google Fonts stylesheets, on a large DOM → hangs. Fix: `skipFonts: true` (OG text falls back to a system font — acceptable).
- **No imagery** = html-to-image fetches each in-page image and inlines its bytes; a cross-origin image with no `Access-Control-Allow-Origin` is an opaque fetch → silently dropped, leaving the section's background color + text only. The storage serve route set `Cross-Origin-Resource-Policy: cross-origin` but **CORP is not CORS** — add `Access-Control-Allow-Origin: *` on the public `/storage/objects/*` success path (next to the CORP header, after the ACL checks) so first-party assets inline.
- `cacheBust: true` appends `?t=…` to every resource, forcing fresh cross-origin re-fetches that fail CORS → set `cacheBust: false`. Add `imagePlaceholder` (1×1 transparent gif) so one un-inlinable external asset can't abort the whole capture.

**Why client-side (not server Playwright):** the existing Playwright prerender infra (`prerenderLpPage.ts`, semaphore 2, 60–90s timeouts) is for async publish snapshots and has freeze/OOM history; a synchronous capture button on top of it would be worse UX + operational risk. Hardened client-side is the lower-risk fix. Remaining limitation: truly external (non-storage) images without CORS are still dropped — accepted, not worth full proxying.
