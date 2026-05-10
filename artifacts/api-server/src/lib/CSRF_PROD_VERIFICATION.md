# CSRF protection — production verification (task #166)

This file is the durable evidence trail for verifying that the CSRF
middleware in `artifacts/api-server/src/lib/csrf.ts` is correctly
wired in the production deployment. Refresh this doc whenever the
CSRF wiring, the `CSRF_SECRET` env var, the protected routes, or the
token endpoint materially change.

Production target: `https://meetdandy-lp.com` (autoscale).

## 1. `CSRF_SECRET` is set in production

The api-server fails fast at startup if `CSRF_SECRET` is missing
(see `csrf.ts` lines 5–10). The secret is configured in Replit's
**shared** environment, which means it is injected into both
development and production runs:

```
viewEnvVars({ type: "all", keys: ["CSRF_SECRET"] })
=> envVars: { shared: { CSRF_SECRET: "<64-byte hex>" } }
   secrets: { CSRF_SECRET: true }
```

Corroborating signal: `getDeploymentInfo()` returns
`isDeployed=true`, `hasSuccessfulBuild=true`. The api-server boots
cleanly in prod, which is only possible when the secret is present.

## 2. End-to-end smoke test against the live deployment

Run on **2026-05-10** against `https://meetdandy-lp.com`. The full
shell session is reproducible from the script in §4 below; raw
output of the four steps is captured verbatim here.

### Step 1 — mint a CSRF token bound to a synthetic session id

```
GET /api/auth/csrf  (Cookie: lp_sid=csrf-prod-verify-...)
=> HTTP 200
   { "csrfToken": "8f47cadc...819935" }
   Set-Cookie: lp_csrf=<signed>; Path=/; HttpOnly; Secure; SameSite=Strict
```

The `Secure` and `HttpOnly` flags on `lp_csrf` confirm the
production cookie hardening (`secure: IS_PROD`, `httpOnly: true`)
in `csrf.ts` is active.

### Step 2 — positive path: POST with valid token + cookie pair

```
POST /api/auth/logout
  Cookie: lp_sid=csrf-prod-verify-...; lp_csrf=<signed>
  X-CSRF-Token: 8f47cadc...819935
=> HTTP 200  { "ok": true }
```

The state-changing POST sailed past the CSRF gate and reached the
logout handler, proving the prod `csrf-csrf` middleware accepts a
correctly-paired token + cookie. (Token binding via
`getSessionIdentifier` is exercised because we passed `lp_sid` on
both the GET and the POST.)

### Step 3 — negative path: header stripped

```
POST /api/auth/logout
  Cookie: lp_sid=...; lp_csrf=<signed>
  (no X-CSRF-Token header)
=> HTTP 403  { "error": "Invalid or missing CSRF token" }
```

### Step 4 — negative path: cookie stripped

```
POST /api/auth/logout
  Cookie: lp_sid=...     (no lp_csrf cookie)
  X-CSRF-Token: 8f47cadc...819935
=> HTTP 403  { "error": "Invalid or missing CSRF token" }
```

Both halves of the double-submit pair are required, and the prod
error handler maps the failure to a clean 403 (not a sanitized
500), confirming `csrfErrorHandler` is registered correctly in
`app.ts`.

## 3. CI regression coverage

`artifacts/lp-studio/tests/csrf.spec.ts` exercises the same three
cases against a locally-spawned api-server using a real database
session, so future regressions are caught by
`pnpm --filter @workspace/lp-studio exec playwright test` before
they ship.

## 4. How to re-verify

1. `await viewEnvVars({ type: "all", keys: ["CSRF_SECRET"] })` —
   confirm it's still in `shared`.
2. `await getDeploymentInfo()` — confirm `hasSuccessfulBuild`.
3. Run this script (no real account required — the synthetic
   `lp_sid` is enough to drive the CSRF middleware end-to-end):

   ```bash
   SID="csrf-prod-verify-$(date +%s)-$$"
   COOKIES=/tmp/csrf-cookies.txt; rm -f "$COOKIES"

   TOKEN=$(curl -sS -c "$COOKIES" -b "lp_sid=$SID" \
     https://meetdandy-lp.com/api/auth/csrf \
     | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

   # Positive: expect HTTP 200 {"ok":true}
   curl -sS -b "$COOKIES" -b "lp_sid=$SID" \
     -H "X-CSRF-Token: $TOKEN" -H "Content-Type: application/json" \
     -X POST https://meetdandy-lp.com/api/auth/logout -d '{}' \
     -w "\nHTTP %{http_code}\n"

   # Negative (no header): expect HTTP 403
   curl -sS -b "$COOKIES" -b "lp_sid=$SID" \
     -H "Content-Type: application/json" \
     -X POST https://meetdandy-lp.com/api/auth/logout -d '{}' \
     -w "\nHTTP %{http_code}\n"

   # Negative (no lp_csrf cookie): expect HTTP 403
   curl -sS -b "lp_sid=$SID" \
     -H "X-CSRF-Token: $TOKEN" -H "Content-Type: application/json" \
     -X POST https://meetdandy-lp.com/api/auth/logout -d '{}' \
     -w "\nHTTP %{http_code}\n"
   ```

4. Re-run the e2e: `pnpm --filter @workspace/lp-studio exec
   playwright test tests/csrf.spec.ts`.
