---
name: Brand font inside Custom HTML block
description: How to get the self-hosted brand display font (Bagoss Standard) to render inside a sandboxed Custom HTML block iframe.
---

# Brand font inside a Custom HTML block

The Custom HTML block (`BlockCustomHtml.tsx`) renders inside a sandboxed,
auto-resizing iframe. Brand CSS vars and the app's `@font-face` rules do NOT
cascade in, and relative URLs don't resolve (doc is written via doc.write →
base URL is about:blank).

**Rule:** to use a self-hosted brand font (e.g. Bagoss Standard, served by the app
at `src/fonts/BagossStandard-Regular.woff2`) inside a Custom HTML block, embed the
woff2 directly as a base64 data-URI `@font-face` in the block's own `<style>`.
Body fonts that exist on Google Fonts (Inter) can just use a `<link>`.

**Why:** referencing the app's served font path is unreliable — Vite emits a
hash-named `/assets/BagossStandard-Regular-<hash>.woff2` that changes every build,
and the iframe can't resolve relative paths anyway. Base64 embedding is
self-contained and works in dev, prod, and R2 snapshots.

**How to apply:** `base64 -w0 the.woff2` (≈40KB woff2 → ≈54KB base64, fine inline),
then `src:url(data:font/woff2;base64,XXXX) format('woff2')` with `font-weight:100 900`
(Bagoss is a variable face — one file covers all weights). Verify the data-URI
starts with `d09GMg` (the base64 of the `wOF2` signature).

**Verifying render:** the page hero is full-viewport-height so you can't scroll a
single screenshot down to a lower block; copy the standalone HTML into
`artifacts/lp-studio/public/_tmp.html` and screenshot `/_tmp.html` directly, then
delete it.
