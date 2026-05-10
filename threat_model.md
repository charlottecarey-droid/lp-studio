# Threat Model

## Project Overview

Landing Page Studio is a multi-tenant marketing and sales platform built as a pnpm monorepo with a TypeScript/Node 24 Express 5 API (`artifacts/api-server`), React/Vite frontends (`artifacts/lp-studio`, `artifacts/dandy-dso`), PostgreSQL via Drizzle/shared SQL helpers, and a Cloudflare worker for wildcard tenant host routing. Production traffic reaches the Express API over TLS at the platform edge. The platform serves tenant-scoped landing pages, authenticated workspace/admin functionality, sales tooling, DSO microsites, and third-party webhook integrations.

This scan is production-scoped only. The mockup sandbox is assumed never to be deployed. `NODE_ENV=production` is assumed in production, so code paths explicitly gated to non-production are normally out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — `app_users`, `app_sessions`, tenant memberships, role assignments, and the `lp_sid` cookie. Compromise allows impersonation, tenant takeover, and cross-tenant access.
- **Tenant data and page content** — landing pages, tests, brand settings, review artifacts, form configs, analytics metadata, and sales records stored in PostgreSQL. Exposure or tampering affects customer data integrity and confidentiality.
- **DSO operational data** — DSO microsites, contact lists, email campaigns, storage assets, generated PDFs, and outreach activity. This data is business-sensitive and includes lead/contact information.
- **Third-party integration secrets and capabilities** — Google OAuth credentials, AI provider keys, Firecrawl/Perplexity keys, SMTP/email credentials, worker shared secret, and any environment-stored admin/shared secrets. Misuse can expand impact beyond the app.
- **Public brand/review surfaces** — published LP pages, personalized links, review links, and sales hotlinks. These are intentionally public but must not become a pivot into authenticated or tenant-internal data.

## Trust Boundaries

- **Browser / API boundary** — all frontend input is untrusted. The API must authenticate and authorize every non-public action server-side.
- **Public / authenticated / admin boundary** — the app mixes public landing-page features with authenticated tenant/admin operations. Route mounting and per-handler guards are a primary security boundary.
- **Tenant / tenant boundary** — tenant-scoped data must remain isolated even when multiple tenants share the same deployment and database.
- **API / database boundary** — the API has broad PostgreSQL access. Broken access control or injection in route handlers can directly expose or modify tenant data.
- **API / filesystem boundary** — DSO storage endpoints write and read from local disk paths. Path handling and route protection are required to avoid arbitrary file access or tampering.
- **API / external service boundary** — the server makes outbound calls to AI providers, RSS feeds, scraping providers, and webhook consumers. User-controlled destinations or unverified inbound senders can subvert trust.
- **Cloudflare worker / origin boundary** — tenant host identity depends on trusted forwarding headers plus `WORKER_HOST_SECRET`; direct callers must not be able to spoof tenant host context.

## Scan Anchors

- **Primary production entry point:** `artifacts/api-server/src/app.ts` → `artifacts/api-server/src/routes/index.ts`
- **Highest-risk server areas:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/dso/index.ts`, `artifacts/api-server/src/routes/lp/`, `artifacts/api-server/src/routes/webhooks.ts`, `artifacts/api-server/src/middleware/requireAuth.ts`
- **Boundary to re-check on every scan:** `routes/index.ts` only auto-applies `requireAuth` to `/lp/*` and `/sales/*`; routers mounted elsewhere, especially `/api/dso/*`, need their own explicit protection
- **Public surfaces:** `/api/lp/*` allowlist in `routes/index.ts`, `/api/webhooks/*`, `/api/sales/resolve/*`, public DSO microsite paths, and any route mounted outside `requireAuth`
- **Admin/superadmin boundary:** `requireAdminKey.ts`, `auth.ts` fallback password flows, tenant override logic in `requireAuth.ts`
- **Usually dev-only / lower-priority unless proven reachable in prod:** `artifacts/lpstudio-site`, explicit `NODE_ENV !== "production"` helpers such as `/api/_test/invalidate-host-cache`

## Threat Categories

### Spoofing

This project relies on session cookies, Google OAuth, tenant host resolution, and several public webhook endpoints. Attackers must not be able to impersonate a tenant user, a superadmin/operator, or a trusted third-party sender by calling public routes directly, guessing shared secrets online, or forging webhook requests.

Required guarantees:
- All non-public API routes MUST require a valid server-side session or equivalent authenticated service credential.
- Shared operator secrets, if they exist at all, MUST NOT be exposed through public verification or login oracles.
- Webhook endpoints MUST verify sender authenticity (for example via shared-secret signature or provider-specific verification) before accepting data.
- Tenant host resolution MUST only trust forwarded host headers when accompanied by the correct worker secret.

### Tampering

The platform exposes many write operations for pages, tests, storage, campaigns, and signals. Any public route that accepts writes can corrupt tenant content, sales telemetry, or DSO datasets. Client-side-only gates are insufficient because attackers can call the API directly.

Required guarantees:
- All data-changing endpoints MUST enforce authorization server-side based on session/service identity and tenant scope.
- Public callback endpoints MUST validate payload provenance before persisting or broadcasting state changes.
- Filesystem-backed storage operations MUST validate and confine paths to intended buckets/directories.
- Redirect and tracking parameters MUST be validated so they cannot be abused to tamper with navigation flows or trusted-domain reputation.

### Information Disclosure

The application stores lead/contact information, tenant content, generated assets, and operational metadata. Public endpoints that query shared datasets, read storage paths, or log raw webhook payloads can leak confidential business or personal data. Server-side fetch features also risk exposing internal network resources.

Required guarantees:
- API responses MUST be scoped to the caller’s authorized tenant or to intentionally public data only.
- Sensitive webhook/contact data MUST NOT be written to logs unnecessarily.
- Filesystem and database access paths MUST not allow unauthenticated enumeration or retrieval of private data.
- Server-side outbound fetches MUST restrict attacker-controlled destinations to prevent internal network access and unintended data exposure.

### Denial of Service

Several public endpoints perform expensive work: RSS fetching/parsing, AI-backed DSO functions, file uploads, and public password checks. Attackers could abuse these to consume outbound network, disk, database, or third-party API quotas.

Required guarantees:
- Public auth and secret-verification endpoints MUST be rate-limited and monitored.
- Public upload and outbound-fetch endpoints MUST enforce strict size, timeout, and destination constraints.
- Public AI/integration-triggering routes MUST require authentication or another strong authorization control.

### Elevation of Privilege

The most important project-specific risk is accidental exposure of authenticated/admin functionality through route mounting mistakes, fallback login mechanisms, or tenant-override logic. A single missed guard can turn a public endpoint into tenant takeover, data destruction, or cross-tenant admin access.

Required guarantees:
- Route-level auth decisions MUST default to deny and be revisited whenever new routers are mounted.
- Tenant membership and role checks MUST be enforced on every privileged operation, not only in the frontend.
- Superadmin-only features MUST require strong server-side authorization distinct from ordinary tenant-admin access.
- Generic CRUD/function proxy endpoints MUST never be exposed publicly without per-operation authorization and tenant scoping.
