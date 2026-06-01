---
name: Tenant custom-html calculator page edits
description: How to edit/verify a tenant landing page whose whole UI is a custom-html block (e.g. Dandy crown-calculator) — it's DB content, not repo code.
---

# Editing tenant custom-html "app" pages (calculators, etc.)

Some tenant LP pages are a single `custom-html` block whose `props.html` holds the
ENTIRE page: markup + inline `<style>` + inline `<script>`. Example: Dandy crown
calculator (lp_pages id=252, tenant 1, slug `crown-calculator`) — a dual
crown+denture ROI calculator, ~1.4k lines / ~56KB. This HTML is **DB content, not
repo source** — it exists only in `lp_pages.blocks`, nowhere in the codebase.

**Why:** `BlockCustomHtml` writes `props.html` into a sandboxed iframe via
`doc.write` with `allow-scripts`, so inline `<script>` executes (NOT sanitized;
`sanitizeHtml`/DOMPurify only applies to rich-text blocks, not custom-html).

## How to apply a change
1. DUMP the live block first — never trust an `attached_assets` paste; it is often
   STALE/partial (the crown paste was 727 lines vs the 1474-line live block, with
   different values and extra features like editable assumptions). Read
   `lp_pages.blocks` for the page via a `@workspace/db` script (dev-shell scripts
   hit **prod Neon**).
2. Edit the dumped HTML (exact string edits), gate it (e.g. assert the old constant
   is gone, new id present, length sane).
3. `db.update(lpPagesTable).set({ blocks })` then **republish** via
   `renderAndStoreNow({ pageId, requestHost: '<tenant host>' })` (awaitable form of
   `triggerPublishedRender`; backfill-published-html.ts is the template). Needs
   `LP_STUDIO_RENDER_BASE_URL` + `R2_*` env (present in the agent env).

## How to VERIFY live (the non-obvious part)
The R2 prerender snapshot is NOT what carries the content. Published LP pages
ALWAYS refetch blocks client-side from `GET /api/lp/page/:slug` (Host header →
tenant) — see `routes/lp/tracking.ts` + `useGetPageConfig` in
`landing-page-viewer.tsx`. So a DB `blocks` update reaches visitors regardless of
the prerender. The stored R2 HTML (~24KB) is only the SPA shell + SEO/OG meta; the
custom-html iframe is **empty** in the snapshot (populated at runtime by doc.write).
=> Verify a content change by `curl https://<tenant-host>/api/lp/page/<slug>` and
inspecting `blocks[].props.html`, NOT by grepping the prerendered page HTML.
