# Phase 3 cutover prerequisites — partners.meetdandy.com + lp.meetdandy.com

Task #364 follow-up. Capture before the user gives the go-ahead on DNS flip.

## DNS rollback snapshot (captured 2026-05-25)

Phase 3 is an **edge swap, not an origin move.** Both Dandy microsite
hostnames currently CNAME into our Replit deployment hosted on GCP
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

**Rollback plan**: revert partners + lp.meetdandy.com A records to
`34.111.179.208`. This restores the pre-cutover direct-to-Replit/GCP
path — same origin as today, just skipping the new Cloudflare edge. No
data-plane handoff needed since the origin never moved; safe to roll
back at any time without coordination.

## Prerequisite checklist (BLOCK cutover until all ✅)

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

- [ ] **Dandy on standby**
  - User to confirm directly with Dandy (we can't verify from here).
  - Suggest doing the DNS flip during a known-quiet window for partners
    microsite traffic.

## Day-of cutover sequence

1. Confirm all checkboxes above are ✅.
2. Verify CF worker still serves stale-host content correctly from R2:
   `curl -sIL https://dandy.lpstudio.ai/smilist-pilot` → `x-lp-source: r2`.
3. Tell Dandy "flipping in N minutes."
4. Flip A records: partners + lp.meetdandy.com → CF (point at the same
   `104.21.53.47, 172.67.209.1` that other CF-routed hostnames use, OR
   use a CNAME to a CF-managed alias — coordinate with the operator who
   has zone access).
5. Within 60s, verify both hosts return `cf-ray:` headers and `x-lp-source: r2`.
6. Spot-check at least one page per Dandy tenant on each host.
7. If anything looks wrong, revert A records to `34.111.179.208`
   immediately — no waiting period needed, GCP origin is still live.
