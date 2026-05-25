# Phase 3 cutover prerequisites — partners.meetdandy.com + lp.meetdandy.com

Task #364 follow-up. Capture before the user gives the go-ahead on DNS flip.

> **Two-stage cutover.** Partners and lp are cut independently with a
> 24–48 hour gap between them. Partners goes first (lower traffic);
> lp goes only after partners has been clean for 24+ hours. Either
> hostname can be rolled back without touching the other — see the
> per-hostname rollback snapshots below.

## DNS rollback snapshot (captured 2026-05-25)

> **Where the records live**: the `meetdandy.com` zone is hosted on
> **Google Cloud DNS** (NS records:
> `ns-cloud-{a1,a2,a3,a4}.googledomains.com`), not Name.com. Rollback
> happens in the Google Cloud Console for whichever GCP project owns
> the zone — confirm the right Cloud-DNS contact at Dandy before any
> cutover (see Task #373 for the exact Console click flow).
>
> Current TTL on both `partners` and `lp` A records is **300 seconds**
> (5 min), so a rollback propagates in under 5 minutes without any
> pre-cutover TTL reduction. Asking Dandy to drop the TTL to 60s
> before the cutover is a nice-to-have margin, not load-bearing.

Phase 3 is an **edge swap, not an origin move.** Both Dandy microsite
hostnames currently resolve to our Replit deployment hosted on GCP
(`34.111.179.208`) — confirmed by `server: Google Frontend` / `via: 1.1
google` in response headers. They do NOT currently route through the
Cloudflare worker (`tenant-host-router`), which is why
partners.meetdandy.com still serves the old shell even though our R2 has
fresh prerendered HTML.

After cutover, traffic flows: **Dandy DNS → Cloudflare edge (worker +
R2 prerendered HTML) → our Replit/GCP origin as fallback** for anything
not in R2. The Replit/GCP service stays put — it remains the source of
truth that renders pages and writes them into R2. Only the edge layer
in front of it changes.

| Host                       | Type | Value              |
|----------------------------|------|--------------------|
| partners.meetdandy.com     | A    | 34.111.179.208     |
| lp.meetdandy.com           | A    | 34.111.179.208     |
| meetdandy-lp.com           | A    | 34.111.179.208     |
| meetdandy-lp.com           | NS   | ns{1cny,2ckr,3jkl,4hny}.name.com |
| app.lpstudio.ai (CF)       | A    | 104.21.53.47, 172.67.209.1 |
| render.lpstudio.ai (CF)    | A    | 172.67.209.1, 104.21.53.47 |
| dandy.lpstudio.ai (CF)     | A    | 104.21.53.47, 172.67.209.1 |

### Per-hostname rollback

**Partners and lp roll back independently.** Touching one's DNS record
never touches the other's. Use only the section for the hostname that
needs reverting; leave the other alone.

#### Rollback: `partners.meetdandy.com` (Stage 1)

Revert just the `partners` record in the `meetdandy.com` zone (Google
Cloud DNS) back to its pre-Stage-1 value:

| Host | Type | Revert to |
|---|---|---|
| `partners` | A | `34.111.179.208` |

This restores the pre-cutover direct-to-Replit/GCP path for
`partners.meetdandy.com`. `lp.meetdandy.com` is unaffected. With the
current TTL of 300 seconds (or 60s if reduced before cutover),
propagation completes in under 5 minutes. No data-plane handoff
needed since the origin never moved; safe to roll back at any time
without coordination. Exact Console click flow lives in Task #373's
"Rollback (Stage 1)" section.

#### Rollback: `lp.meetdandy.com` (Stage 2)

Revert just the `lp` record in the `meetdandy.com` zone (Google Cloud
DNS) back to its pre-Stage-2 value:

| Host | Type | Revert to |
|---|---|---|
| `lp` | A | `34.111.179.208` |

This restores the pre-cutover direct-to-Replit/GCP path for
`lp.meetdandy.com`. `partners.meetdandy.com` is unaffected (and, if
Stage 1 has already passed, continues serving from the CF edge
throughout this rollback). With the current TTL of 300 seconds (or 60s
if reduced before cutover), propagation completes in under 5 minutes.
Exact Console click flow lives in Task #373's "Rollback (Stage 2)"
section.

## Prerequisite checklist (BLOCK cutover until all ✅)

These apply to both stages — Stage 1 cannot start until they're all green.

- [ ] **api-server redeployed** with the new prerenderLpPage.ts
  - atomic capture inside same evaluate (kills the trios5 snapshot race)
  - `context.setDefaultTimeout(timeoutMs)` override (kills the 30s default leak)
  - waitTimeoutMs ≥ 60s
  - **Current state**: code in repo at HEAD (after this turn), NOT yet
    deployed. Last prod deploy was checkpoint `80670b38` (only had the
    auth.ts reviewToken fix).
  - **Verify after deploy**: trigger a re-publish on a known page and
    confirm the served HTML has `data-prerendered="1"` + `[data-lp-page]`
    with real children.

- [ ] **api-server redeployed** with the new triggerPublishedRender.ts
  - retry-once on render failure with 1.5s settle
  - emits `prerender_render_recovered_on_retry` Sentry message on the
    self-heal path so we can track transient failure rate
  - **Verify after deploy**: search Sentry for the recovered tag over
    7 days — non-zero count means transients are being silently fixed.

- [ ] **tenant-host-router worker deployed** with routes in commit `ce515758`
  - routes include `partners.meetdandy.com/*` and `lp.meetdandy.com/*`
  - **How to verify**: `wrangler deployments list` for the
    `tenant-host-router` service, OR check
    `https://dash.cloudflare.com/.../workers/services/view/tenant-host-router`.
    Both hostnames must show up under "Routes".
  - **WITHOUT this**: a DNS flip would point at a CF worker that doesn't
    have the route, falling back to the zone's default Pages/origin
    behavior. Visitors see 404s or nothing.

- [ ] **Sentry alert behavior verified**
  - `prerender_render_failed` is captured at `level: "error"` (confirmed
    in `triggerPublishedRender.ts:186` and post-retry path).
  - The existing error-spike rule (`artifacts/api-server/src/lib/SENTRY_PROD_ALERT_VERIFICATION.md`
    §Part 2) fires on `> 20 events / 5 minutes`. **GAP**: a single page
    render failure will NOT page anyone — it creates a Sentry issue but
    doesn't trigger Slack/email. For a high-signal alert on the prerender
    pipeline specifically, add a Sentry rule:
      - Filter: `tags.subsystem:lp-prerender AND tags.outcome:render_failed`
      - Trigger: `>= 3 events / 30 minutes` (low enough to catch a real
        regression, high enough to ignore a single transient — paired
        with the retry-once self-heal this means a true regression
        manifests as 3 different pages failing both attempts within 30
        min, which is unambiguous).
  - **Recommended**: also add a daily digest of `recovered_on_retry`
    so we notice if the transient rate climbs.

- [ ] **Cloud-DNS contact at Dandy identified**
  - The zone is on Google Cloud DNS. Confirmed which person at Dandy has
    Console access to the GCP project that owns the `meetdandy.com`
    zone, and have their GCP project name/ID.
  - This may not be the same person who handles other DNS asks (e.g.,
    registrar work if Name.com is still the registrar). Get the right
    contact upfront to avoid a wrong-person round-trip.

- [ ] **Dandy on standby for Stage 1**
  - User to confirm directly with Dandy (we can't verify from here).
  - Stage 1 cutover window picked for a known-quiet hour for
    `partners.meetdandy.com`.
  - *Optional, not load-bearing*: Dandy reduced TTL on the `partners`
    A record from 300s to 60s at least 24 hours before the Stage 1
    window. Skip if it's friction — current 300s TTL still propagates
    rollback in under 5 minutes.

- [ ] **Dandy on standby for Stage 2** (24–48 hours after Stage 1 passes)
  - Stage 2 window coordinated with Dandy's marketing team — no paid
    campaign launch, email blast, or major partner announcement within
    ±24 hours.
  - *Optional, not load-bearing*: Dandy reduced TTL on the `lp` A
    record from 300s to 60s at least 24 hours before the Stage 2
    window.

## Day-of cutover sequence

Per-hostname execution lives in the project task (Task #373) — including
pre-flight checklists, exact Name.com clicks, monitoring queries, pass
criteria, and rollback steps. This doc is the prerequisite gate; the
task is the runbook.

High-level order:

1. Stage 0: Dandy adds 6 DNS records; we verify with
   `check-custom-hostname.sh` + a `--resolve` TLS smoke test.
2. Stage 1: flip `partners.meetdandy.com` only. Monitor 60 min,
   then watch for 24–48 hours.
3. Per-stage post-cutover validation (`x-lp-source: r2`, `cf-ray:`,
   Sentry filter `tags.subsystem:lp-prerender AND tags.outcome:render_failed`)
   runs immediately after the flip and again at the 24-hour mark.
4. Stage 2: flip `lp.meetdandy.com` only. Monitor 60 min, then watch
   for 24–48 hours. Same per-stage validation.
5. After both stages stable: ask Dandy to raise TTLs back to their
   previous values.
