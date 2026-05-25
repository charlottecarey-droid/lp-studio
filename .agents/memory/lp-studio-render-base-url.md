---
name: LP Studio publish render base URL
description: Required env to capture *production* Vite bundle hashes when prerendering / backfilling published HTML.
---

# LP Studio publish render base URL

The prerender pipeline (`artifacts/api-server/src/lib/prerenderLpPage.ts`, called from
`triggerPublishedRender.ts` and `scripts/backfill-published-html.ts`) builds the
published HTML by loading a page in headless Chromium against
`LP_STUDIO_RENDER_BASE_URL`. The HTML returned to R2 contains absolute references to
whatever `index-<hash>.js`/`index-<hash>.css` that URL is currently serving.

## The rule
Any prerender / backfill / republish run that should produce *production* HTML must
have `LP_STUDIO_RENDER_BASE_URL=https://render.lpstudio.ai` set before invoking node.
Otherwise the script falls back to `REPLIT_DEV_DOMAIN`, captures the dev workspace's
bundle hashes, and writes them into prod R2 — where they 404 against the prod CDN.

## How to apply
- When invoking any backfill or one-shot republish from the agent shell:
  `LP_STUDIO_RENDER_BASE_URL=https://render.lpstudio.ai node --import tsx scripts/backfill-published-html.ts ...`
- `@workspace/db` (`lib/db/src/index.ts`) auto-prefers `NEON_DATABASE_URL` over
  `DATABASE_URL`, so the dev container DOES hit prod DB by default. Combined with prod
  R2 creds already in the agent env, the only thing that defaults wrong is the render
  base URL. Always pass it explicitly.
- The deployed `api-server` workflow sets this in its own env; the issue only bites
  one-shot scripts invoked from the agent shell.

## Why
The published-page edge serving model (CF Worker → R2) stores fully rendered HTML, not
a template. Bundle hash drift between what's stored and what the CDN serves results in
broken sites until republish. Forgetting this env on a backfill literally *creates* the
problem the backfill was supposed to fix.
