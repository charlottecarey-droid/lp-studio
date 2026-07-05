---
name: Firecrawl is not a single choke point
description: Any cross-cutting Firecrawl policy (cost cap, retry, SSRF, robots) must be applied to THREE independent clients, not just routes/lp/firecrawl.ts.
---

# Firecrawl scraping has three independent clients

`routes/lp/firecrawl.ts` looks like "the" scrape module — landing-page and
microsite reference/inspiration scrapes all funnel through it
(`maybeScrapeRef`, `maybeMultiPageScrapeRef`, `scrapeInspirationUrl`, and the
shared `cachedFirecrawlScrape`). It is NOT the only Firecrawl client.

Two other paths construct their own Firecrawl calls and bypass that module
entirely:
- `lib/brand-import/evidence.ts` — brand-import evidence collection.
- `routes/sales/draft-email.ts` — sales AI draft-email research.

**Why this matters:** any policy meant to be "for all scraping" — the
per-tenant/day cost cap, transient-failure retry, SSRF host-guarding, robots
handling — only covers whatever flows through `routes/lp/firecrawl.ts`. Applying
it there does NOT govern brand-import or draft-email spend/behavior.

**How to apply:** before claiming a Firecrawl-wide change, grep the codebase for
Firecrawl API usage and confirm all three clients are covered (or state the
scope precisely). The per-tenant daily scrape cap + retry added for launch
hardening covers page-gen + microsite reference/inspiration scrapes ONLY;
extending it to the brand-import and draft-email clients is separate work.
