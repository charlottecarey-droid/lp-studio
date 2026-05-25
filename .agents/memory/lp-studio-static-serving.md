---
name: lp-studio static serving
description: lp-studio is served as static files by Replit's deployment layer, not by an Express server, so SPA fallback can't be overridden in our code.
---

`artifacts/lp-studio/artifact.toml` declares `serve = "static"` with
`publicDir = "artifacts/lp-studio/dist/public"` and a rewrite
`from = "/*", to = "/index.html"`. There is NO Express/Node server
handling requests to lp-studio assets in production — Replit's static
edge serves files and falls back to `/index.html` for anything that
doesn't match a physical file.

**Why this matters:** any request to `/assets/index-OLDHASH.js` where
that hash no longer exists on disk returns `index.html` (text/html),
which the browser refuses to execute as JS. The classic SPA-asset
hash-drift bug. We cannot fix this at the lp-studio origin because we
don't run the server.

**How to apply:** when a fix needs to intercept `/assets/*` requests
for tenant traffic, do it in the CF Worker
(`cloudflare/tenant-host-router/worker.js`) — that's the only layer
we control on the path between the visitor and Replit's static edge.
The Worker can serve from R2 first and provide a content-type-correct
reload shim on miss.
