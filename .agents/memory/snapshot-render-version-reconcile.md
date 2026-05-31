---
name: Published-snapshot render-version reconcile
description: How published-page R2 snapshots self-heal after a rendering fix, and why you must NOT run the reconcile/backfill from the dev env.
---

# Published-snapshot render-version + reconcile

Published landing pages (and one-pagers) are served from a frozen static
HTML snapshot baked into R2 at publish time. A snapshot is only re-baked on
the next publish/edit of that page — it is NOT refreshed when the lp-studio
*rendering code* changes. So a rendering fix (logo, brand font, block
markup, meta) silently fails to reach visitors on every page published
before the fix.

**Mechanism (the self-heal):**
- `lib/renderVersion.ts` exports `CURRENT_RENDER_VERSION`, a deliberately
  *manually-bumped* string. Bump it whenever a rendering change should
  reach already-published snapshots.
- Every R2 write stamps it as object metadata `render-version`
  (`uploadPublishedHtmlToR2` meta param; passed from
  `triggerPublishedRender`). Read it back cheaply via
  `getPublishedHtmlMetaFromR2` (HEAD; R2 lowercases metadata keys).
- `lib/snapshotReconcile.ts` runs post-deploy + daily: HEADs each published
  page's snapshot, and re-bakes any whose stored version != current (or is
  unstamped). Cross-instance `pg_try_advisory_lock(708,1)` on a dedicated
  session client (NOT xact — run takes minutes); detection is a bounded
  HEAD fan-out, re-baking is SERIAL via `renderAndStoreNow` (Playwright is
  memory-heavy — concurrent fleets OOM). Boot run deferred ~180s off the
  cold-start path so it doesn't starve the startup probe.

**Why a manual constant, not a build hash:** an auto-changing hash would
re-bake the ENTIRE fleet on every unrelated lp-studio deploy (expensive
Playwright fan-out) even when nothing about rendering changed.

**No manual backfill needed:** bumping the version makes every existing
(unstamped or older) snapshot stale, so the first prod deploy's reconcile
re-bakes the whole fleet automatically.

## Landmine: dev and prod share ONE R2 bucket

There is a single R2 bucket. The dev env's R2_* creds point at the SAME
bucket prod serves from. **Never run the snapshot reconcile or the
`backfill-published-html.ts` script from the dev environment** — it would
render pages with dev's lp-studio build (different asset hashes / possibly
stale code) and overwrite live prod snapshots. Rely on the deploy-time
reconcile to do the real re-bake in prod. For local verification, test the
pure decision logic (`isSnapshotStale`) or read metadata, never write.
