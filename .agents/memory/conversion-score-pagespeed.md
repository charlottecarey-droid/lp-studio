---
name: Conversion-score Page Speed measurement
description: How the conversion scorer's "Page Speed Impact" gets a real measured score vs the structural proxy
---

The conversion scorer's "Page Speed Impact" category prefers a real measured
Lighthouse performance score (Google PageSpeed Insights v5) and falls back to the
structural block/image-count proxy when no measurement exists.

**Design (deliberate, low-risk):**
- Measurement lives in `artifacts/api-server/src/lib/pageSpeedInsights.ts` as an
  in-process TTL cache (24h) + non-blocking background refresh. NO schema change,
  NO scheduled job. A fresh process returns null → proxy until the first
  background measurement lands. This was chosen over DB persistence because dev
  shares prod's Neon DB (migrations are higher-risk here).
- `getMeasuredSpeedScore(page)` never blocks the scoring request; it returns
  cached value (or null) and schedules a background PSI fetch when stale/missing.
- Only `status === "published"` pages are measured (need a publicly crawlable URL,
  built from `getActiveHostsForTenant` — prefer a wildcard subdomain at `/lp/<slug>`).

**Why:** a genuinely slow page and a fast page with the same layout scored
identically under the pure block-count proxy.

**How to apply / gotchas:**
- PSI works anonymously; set `PAGESPEED_API_KEY` to raise quota (optional).
- Background fetch is disabled when `NODE_ENV==="test"`, `VITEST==="true"`, or
  `DISABLE_PAGESPEED_INSIGHTS==="true"` — so unit tests never hit the network and
  `getMeasuredSpeedScore` returns null in test (→ proxy path).
- `computeConversionScore` takes optional `measuredSpeedScore`; a negative value
  is treated as "no measurement". It returns `speedMeasured`; the route surfaces
  `metrics.speedSource: "measured" | "estimated"` and the UI shows a badge.
