---
name: thum.io output cap
description: thum.io anonymous gateway caps screenshot output width (~1280px); how to get the largest clean 3:2 capture for template thumbnails.
---

# thum.io anonymous gateway output cap

The public/anonymous `image.thum.io/get/...` gateway (no auth key in our env)
caps the delivered output width around **1280px**. Asking for more does NOT give
more pixels and can break the aspect ratio:

- `width/2400/crop/1600` → returns a broken **1200×1200 square** (no res gain, ratio lost).
- `width/2000/...` → clamps back to ~1200.
- `width/1600/crop/800` → reliably returns a clean **1280×853** (3:2). This is the practical max for a correct 3:2.

**Why this matters:** the template-gallery thumbnail capture
(`captureTemplateThumbnail.ts`) and the OG share-card flow both rely on thum.io.
Any plan to "capture at 2× / 2400px for retina sharpness" is impossible through
this gateway — it silently caps. A task assuming 2400 will instead regress the
ratio to a square.

**How to apply:** for the sharpest correct-ratio capture, request
`viewport/1600x1067/width/1600/crop/800` — the viewport forces a real desktop
render at 1600px which thum.io then *downscales* to its ~1280px cap (crisp,
never upscaled). Going higher needs a thum.io auth key (lifts the cap) or
self-hosted headless screenshots (Playwright with deviceScaleFactor=2) — both
out of scope for the anonymous flow.

OG share cards are deliberately fixed at 1200×630 (`resolvePageOG.ts`
OG_IMAGE_WIDTH/HEIGHT; the `/lp/og-image/resize` endpoint center-crops uploads to
it) — that's the product-wide social standard emitted as og:image:width/height,
NOT a thumbnail to enlarge.
