---
name: Template thumbnail capture
description: How LP Studio template gallery thumbnails are captured (thum.io) and the coordinated edits that keep them consistent.
---

Template cards in the Templates gallery render a real screenshot stored on `lp_pages.thumbnail_url` (captured via thum.io pointed at `/preview/:slug`). Render order is `thumbnailUrl ?? ogImage ?? gradient`; failures leave `thumbnail_url` NULL so the gradient shows and the next capture retries.

**Placeholder filter is duplicated — keep in sync.** `isPlaceholderTemplateLabel` exists in BOTH `artifacts/api-server/src/routes/lp/templates.ts` (filters junk out of the enriched gallery endpoint) AND `artifacts/api-server/scripts/backfill-template-thumbnails.ts` (skips capturing junk). Same regex (`/_{3,}/`, `/^_+\s/`, empty). If you change the rule in one place, change the other or the gallery and backfill disagree.

**Why:** scaffold templates (e.g. "_____ One Pager") must never get a captured thumbnail or be shown.

**Capture host resolution:** `captureTemplateThumbnail` prefers `requestHost` (passed from routes) then falls back to the configured render base URL. The backfill script has no request, so thum.io must reach `/preview/:slug` via the env-configured base URL — set it before running the backfill.

**Refresh route is tenant-owned only:** `POST /lp/templates/:id/refresh-thumbnail` returns 403 for global templates (platform-managed). The UI hides the refresh button on global cards. Both marketplaces (`template-marketplace.tsx`, `sales/sales-marketplace.tsx`) carry identical card + refresh logic — edit both.

**Edit-path deviation:** the PATCH `/lp/pages/:id` auto-capture hook does NOT null `thumbnail_captured_at` when content changes — it keeps the old thumbnail visible until the new one is ready (avoids a flicker to gradient mid-edit). This differs from the original task spec.

**Backfill is a deliberate PROD job:** `pnpm --filter @workspace/api-server run backfill-template-thumbnails` writes to prod Neon and calls thum.io. Never auto-run; missing-only by default, `--all` re-captures, re-runnable (exit 0 on transient failures).
