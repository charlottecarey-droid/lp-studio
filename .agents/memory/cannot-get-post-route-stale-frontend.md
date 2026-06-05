---
name: "Cannot GET" on a POST-only API route = stale deployed frontend
description: How to tell a browser-issued-GET (stale bundle) apart from a real server redirect/missing route
---

When a user reports `Cannot GET /api/...` (Express finalhandler 404) on an
endpoint the codebase defines as `router.post(...)`, do NOT assume a server
redirect is downgrading POST→GET. Verify against production first:

`curl -sS -X POST -d '{}' -w "%{http_code} %{redirect_url} %{num_redirects}\n" https://HOST/api/...`

- `http_code=401`/`400`/`200` with `num_redirects=0` → the route EXISTS and
  ACCEPTS POST; there is NO redirect. The browser itself issued a GET.
- `Cannot POST` → route genuinely missing in the deployed api-server.

**Why:** browser-issued GET on a POST-only route almost always means the
**deployed frontend bundle is stale** — the live JS predates the current
POST-based code. The usual root cause is that the publish/deploy BUILD has been
FAILING, so neither the lp-studio SPA nor the api-server (one failed build fails
the whole multi-artifact deploy) ever shipped the fix.

**How to apply:** confirm the current committed client code uses
`method:"POST"` at every callsite (grep the endpoint name across the frontend —
there can be more than one trigger), confirm curl shows the prod route works,
then the fix is to make the build pass and REPUBLISH — not to edit code. Then
re-verify against production.
