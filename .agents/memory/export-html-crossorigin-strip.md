---
name: Exported/portable HTML must strip crossorigin
description: Any feature that rehosts snapshot HTML on a foreign origin must remove crossorigin/integrity from <link> tags or CSS silently blocks
---

**Rule:** When producing portable/exported HTML from a Vite-built page snapshot (Export HTML, email embeds, any rehosting), strip `crossorigin` and `integrity` attributes from surviving `<link>` tags after absolutizing hrefs.

**Why:** Vite emits `crossorigin` (often `crossorigin=""`) on stylesheet links. That attribute forces a CORS-mode fetch, and the app's `/assets/*` path serves NO `Access-Control-Allow-Origin` header (only `/api/storage/serve/*` sets ACAO:*). On a foreign host the browser blocks the stylesheet entirely → the export renders as unstyled raw HTML. A plain (non-CORS) stylesheet link loads fine cross-origin. The failure is invisible in same-origin testing — it only appears when the file is actually hosted elsewhere.

**How to apply:** In `makePortableHtml` (routes/lp/export-html.ts) this is step 2b. Any new rehosting surface needs the same strip. Residual limit: fonts referenced *inside* the CSS are always CORS-fetched per spec, so tenant-hosted fonts still fall back to system fonts on foreign hosts unless /assets gains ACAO at the edge; Google-hosted fonts are unaffected.
