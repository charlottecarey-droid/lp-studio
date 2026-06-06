---
name: Template thumbnail capture
description: How LP Studio template gallery thumbnails are captured (thum.io) and the coordinated edits that keep them consistent.
---

Template cards in the Templates gallery render a real screenshot stored on `lp_pages.thumbnail_url` (captured via thum.io pointed at `/preview/:slug`). Render order is `thumbnailUrl ?? ogImage ?? gradient`; failures leave `thumbnail_url` NULL so the gradient shows and the next capture retries.

**Placeholder filter is duplicated — keep in sync.** `isPlaceholderTemplateLabel` exists in BOTH `artifacts/api-server/src/routes/lp/templates.ts` (filters junk out of the enriched gallery endpoint) AND `artifacts/api-server/scripts/backfill-template-thumbnails.ts` (skips capturing junk). Same regex (`/_{3,}/`, `/^_+\s/`, empty). If you change the rule in one place, change the other or the gallery and backfill disagree.

**Why:** scaffold templates (e.g. "_____ One Pager") must never get a captured thumbnail or be shown.

**In practice ogImage IS the real preview source — thumbnail_url is empty for ALL global templates.** The thum.io backfill has never successfully populated `thumbnail_url` (every global template row is NULL), so the gallery effectively renders `ogImage ?? gradient`. Therefore any seeded template with `ogImage: ""` shows the gradient placeholder. When adding global templates to the seeds, always set a real `ogImage` (existing ones use `images.unsplash.com` or Dandy `/api/storage` assets) — empty string = gradient card. Both the seed AND the existing DB row must be set (a seed-only change won't reflect without a seed-marker bump + reseed).

**Capture host resolution:** `captureTemplateThumbnail` prefers `requestHost` (passed from routes) then falls back to the configured render base URL. The backfill script has no request, so thum.io must reach `/preview/:slug` via the env-configured base URL — set it before running the backfill.

**Refresh route is tenant-owned only:** `POST /lp/templates/:id/refresh-thumbnail` returns 403 for global templates (platform-managed). The UI hides the refresh button on global cards. Both marketplaces (`template-marketplace.tsx`, `sales/sales-marketplace.tsx`) carry identical card + refresh logic — edit both.

**Edit-path deviation:** the PATCH `/lp/pages/:id` auto-capture hook does NOT null `thumbnail_captured_at` when content changes — it keeps the old thumbnail visible until the new one is ready (avoids a flicker to gradient mid-edit). This differs from the original task spec.

**Backfill is a deliberate PROD job:** `pnpm --filter @workspace/api-server run backfill-template-thumbnails` writes to prod Neon and calls thum.io. Never auto-run; missing-only by default, `--all` re-captures, re-runnable (exit 0 on transient failures).

**Captures are validated, not trusted on HTTP 200.** `/preview/:slug` is a client-rendered SPA, so thum.io often snapshots the blank/grey shell before hydration. Defenses: (1) thum.io `wait/<sec>` — thum.io has NO wait-for-selector, only time-based wait; the readiness selector on the render is `[data-lp-page]` (success-state only) but thum.io can't target it. (2) Download the PNG and run `sharp(bytes).stats()` — reject near-uniform captures (max per-channel stdev below MIN_CONTENT_STDEV) so a blank/grey render never overwrites a good OG image. A bigger `wait` is not a substitute for the stdev guard; it just makes blanks rarer.

**Capture outcome contract.** `captureTemplateThumbnail` returns a `CaptureOutcome`: `"captured"` (real screenshot stored), `"fell_back"` (blank/timeout/error — card should show OG), `"skipped"` (not a capturable template). The `clearOnFailure` option NULLs `thumbnail_url` on failure so a previously-stored broken capture reverts to OG — the **manual-refresh route sets it**, the fire-and-forget autosave path does NOT (keeps the existing thumbnail to avoid mid-edit flicker on a transient fail).

**Refresh route + UI are honest.** `POST /lp/templates/:id/refresh-thumbnail` returns `200 {captured:true|false}` (NOT 502 on fallback); `captured:false` carries `thumbnailUrl:null`. Both marketplaces patch the row and toast "Thumbnail refreshed" only when `captured`, else "Showing the social image". Card media (`TemplateCardMedia`, duplicated in both marketplaces) uses a staged `onError` fallback: thumbnail → OG → gradient.
