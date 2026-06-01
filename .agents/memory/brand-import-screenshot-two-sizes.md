---
name: Brand-import screenshot two size regimes
description: The homepage screenshot has a full-res copy for vision and a separate downsampled copy for persistence/cache; keep them distinct.
---

# Brand-import homepage screenshot: two size regimes

`Evidence.screenshotDataUrl` is captured up to `MAX_SCREENSHOT_BYTES` (8MB) in
`evidence.ts` **on purpose** — the vision extractors (colors/buttons/typography/
photography) read it at full detail.

The copy that gets persisted as a Brand-Settings preview (`homepageScreenshotUrl`)
and cached in the brand-import cache jsonb is a **different, downsampled** copy:
`OrchestratorPayload.screenshotDataUrl`, produced by
`buildScreenshotPreviewDataUrl` (width-capped JPEG q80).

**Why:** the asset-mirror path (`fetchAsset`/`decodeDataUrl` in
`assets-uploader.ts`) rejects any asset >5MB (`MAX_BYTES`). If you mirror the
raw 8MB-capable evidence screenshot directly, anything in the 5–8MB band is
captured but silently never persisted (no error, just no preview). Caching the
raw bytes also bloats the cache jsonb rows.

**How to apply:** never set `OrchestratorPayload.screenshotDataUrl =
evidence.screenshotDataUrl` directly. Always route through the downsample helper.
Vision keeps using `evidence.screenshotDataUrl`; only the payload/cache/mirror
copy is shrunk. If you change the mirror's `MAX_BYTES` or the evidence
`MAX_SCREENSHOT_BYTES`, re-check this relationship.
