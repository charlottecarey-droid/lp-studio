# Tenant Host Router (Cloudflare Worker)

Enables wildcard `*.lpstudio.ai` tenant subdomains without manually registering
each one as a custom domain on the Replit deployment.

## Why this exists

Replit's deployment edge only honours the `Host` header for hostnames
explicitly registered as custom domains. For any unregistered subdomain it
silently rewrites the host to the deployment's canonical URL
(`image-to-video-ccarey.replit.app`), which breaks tenant resolution and
OAuth.

This worker sits in front of `*.lpstudio.ai`, forwards every request to the
canonical Replit URL (which Replit accepts), and passes the real visitor
hostname through in `X-Original-Host`. The api-server's `getRequestHost`
helper trusts that header only when paired with the `X-Worker-Secret`
shared secret.

`lpstudio.ai`, `www.lpstudio.ai`, and `app.lpstudio.ai` are passed through
unchanged because they are already registered Replit custom domains.

## One-time setup

### 1. Generate a shared secret

```bash
openssl rand -hex 32
```

### 2. Save the secret on Replit

Add a Replit secret named `WORKER_HOST_SECRET` with the value from step 1, then
republish the deployment so the api-server picks it up.

### 3. Deploy the worker

```bash
cd cloudflare/tenant-host-router
npx wrangler login
npx wrangler secret put WORKER_HOST_SECRET   # paste the SAME value
npx wrangler deploy
```

### 4. Add the wildcard DNS record

In Cloudflare → DNS → Records, add:

| Type  | Name             | Target                              | Proxy |
| ----- | ---------------- | ----------------------------------- | ----- |
| CNAME | `*` (lpstudio.ai)| `image-to-video-ccarey.replit.app`  | On    |

The DNS target is mostly cosmetic — the worker controls the actual
destination via `fetch()`. Keep it pointed at the Replit deployment as a
graceful fallback in case the worker is ever disabled.

### 5. Verify

```bash
curl -sS https://acme.lpstudio.ai/api/auth/domain-context
```

Should return tenant context for the `acme` slug (or `mode: open` if no tenant
is mapped to that slug — but it must NOT return `mode: open` for hosts that DO
have a tenant mapping).

## Rotating the secret

1. Generate a new value.
2. Set it as `WORKER_HOST_SECRET` in both Replit and the worker
   (`npx wrangler secret put WORKER_HOST_SECRET`).
3. Republish the Replit deployment.
4. Redeploy the worker.

The api-server falls through to `X-Forwarded-Host` / `Host` when
`WORKER_HOST_SECRET` is unset, so a brief mismatch only breaks wildcard
subdomain routing — the apex and registered custom domains keep working.
