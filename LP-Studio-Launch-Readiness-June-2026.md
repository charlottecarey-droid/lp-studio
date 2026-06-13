# LP Studio — Launch Readiness Audit (June 12, 2026)

Pre-Product-Hunt audit across four lenses: new-user funnel, scale/resilience, billing/security,
and operations. Conflicting agent findings were spot-checked against code; statuses below are
verified, not assumed.

## Verdict

The funnel, billing, and security foundations are launch-ready. The real launch-day risk is
**load**: a handful of public endpoints have no rate limiting and the expensive pipelines
(Playwright prerender, Firecrawl, image generation) have no concurrency caps. All of the P0
fixes are small (semaphores + express-rate-limit), roughly a half-day of work total.

---

## P0 — Do before launch day (load + cost protection)

1. **Rate-limit the public tracking/heatmap/leads endpoints** — `routes/lp/tracking.ts`,
   `routes/lp/heatmap.ts`, form/lead submission. Zero rate limiting today; a single bot can
   flood the events tables. Per-IP limits (e.g. tracking 500/min, heatmap 100/min, forms
   10/min) via express-rate-limit.
2. **Cap Playwright prerender concurrency** — `lib/prerenderLpPage.ts` spawns a Chromium per
   publish with no pool. At ~8 concurrent publishes the container OOMs. Add a semaphore
   (PRERENDER_CONCURRENCY=1–2) + queue; publishes are already background jobs so latency is fine.
3. **Cap Firecrawl fan-out globally** — per-request URLs are capped at 5, but there's no
   process-wide semaphore. 30 simultaneous generations with reference URLs = ~150 scrape calls
   at once (429 cascades + cost spike). Mirror the openai-semaphore pattern (FIRECRAWL_CONCURRENCY=2).
4. **Gate + limit AI image generation** — `/api/lp/image-generate` is missing
   `requirePlanFeature("aiImageGen")` (free users can exceed quota via direct API calls) and
   has no per-tenant rate limit. Add the middleware in `routes/lp/index.ts` + 10/min/tenant cap.
5. **Page-generation concurrency** — brand-import OpenAI calls are capped at 3; page
   generation is uncapped. Add a per-process semaphore (e.g. 6–8) so a generation rush queues
   instead of timing out everything at once.

## P1 — Strongly recommended before or during launch week

6. **Marketing footer dead links** — "About"/"Careers" are bare mailto:s; looks unfinished on
   PH day. Link to real pages or remove.
7. **OAuth error retry affordance** — failed OAuth lands on an error state with no "try again";
   one-line fix, protects the most precious moment in the funnel. Same for the misleading
   Turnstile failure message.
8. **Legal pages** — verify Terms + Privacy pages exist and are linked from the consent banner,
   signup, and footer (required given the GDPR banner + OAuth scopes).
9. **OpenAI structured output** — generation parses free-text JSON (no `response_format`).
   Parse+retry works, but `json_schema` response format would cut silent retries and wasted
   tokens. Not a blocker; high-value reliability improvement.
10. **Sentry on swallowed errors** — the global handler (`app.ts:314`,
    `Sentry.setupExpressErrorHandler`) catches uncaught route errors, but hot paths that
    try/catch + `logger.warn` (generation image pipeline, brand import partials) never reach
    Sentry. Promote the new structured events (image floor, repeat guard, intent decisions,
    render failures) to Sentry breadcrumbs/messages so launch-morning anomalies are visible.
11. **Status/support surface** — no status page or in-app support link. Minimum: a support
    email in the app footer + a #launch Slack channel watching Sentry.
12. **CSP enforce mode** — currently report-only; flip to enforce after a week of clean reports.

## P2 / corrected claims (no action needed now)

- ~~"Missing lp_pages tenant index"~~ — composite unique `(tenant_id, slug)` exists; leading
  column serves tenant scans.
- ~~"SSRF unguarded"~~ — direct fetches go through the guarded `fetchAsset`; Firecrawl calls
  route through their SaaS, not the app's network.
- ~~"Sentry black hole on routes"~~ — global Express handler exists (see #10 nuance).
- Tenant isolation, Stripe wiring (checkout/webhooks/downgrade/trial), session security,
  XSS fixes, superadmin gating, plan-matrix single-source: all verified solid.
- Free tier (5 pages / 10 generations / 1 seat) is enforced via a unified 402 plan-gate and
  matches the pricing page.

## What's genuinely strong (don't touch)

Signup (4 auth methods, rate-limited, CSRF-protected), brand-import wizard honesty about
partial failures, plan-config single source of truth, prerender→R2 delivery with 3-tier
fallback, this week's generation-quality + block overhaul.

---

## Activation checklist (this week's work that needs ops steps)

1. Push `staging` (3 commits ahead) → pull in Replit → deploy
2. Confirm migrations 0092 + 0093 applied on deploy (migrate-on-deploy handles it; verify logs)
3. Run `pnpm run retag-media-library --dry-run` then live (fixes image relevance for existing tenants)
4. `wrangler deploy` tenant-host-router (robots/sitemap passthrough)
5. One full host-side `pnpm typecheck` + test run (sandbox could only run focused checks)
6. Smoke test: signup fresh account → brand import → generate 3 pages → publish → visit
   published URL + /robots.txt + /sitemap.xml → submit a form → check the lead arrives

## Launch-morning watch list

- Sentry: error rate, `render_failed` events, brand-import failures
- OpenAI + Firecrawl dashboards: spend rate, 429s
- DB: connection saturation (pool is 10 — watch it; bump if >70% sustained)
- A canary published page on an uptime monitor (1-min interval)
- The PH comment thread — fastest bug reports you'll ever get
