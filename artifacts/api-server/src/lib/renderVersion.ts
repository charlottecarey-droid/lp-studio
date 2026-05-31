/**
 * Render-schema version for prerendered published landing-page snapshots
 * (task #708).
 *
 * WHAT THIS IS
 * Published pages are served from a baked static HTML snapshot in R2 (see
 * triggerPublishedRender.ts / r2Storage.ts). A snapshot is frozen at
 * publish time and is NOT automatically refreshed when the lp-studio
 * rendering code changes — so a rendering fix (e.g. the one-pager
 * logo/brand-font fix that landed 2026-05-30/31) stays invisible to
 * visitors on every page published before the fix.
 *
 * To make rendering fixes self-heal, every snapshot is stamped with this
 * version in its R2 object metadata (`render-version`) at write time. A
 * post-deploy reconcile (snapshotReconcile.ts) compares each published
 * page's stored snapshot version against CURRENT_RENDER_VERSION and
 * re-bakes any that are behind (or unstamped — i.e. baked before this
 * mechanism existed).
 *
 * HOW TO USE
 * Bump CURRENT_RENDER_VERSION whenever a change to how published pages
 * render (block markup, brand-config resolution, meta injection, the
 * prerender capture itself, etc.) should reach already-published
 * snapshots. On the next production deploy the reconcile re-bakes every
 * stale snapshot automatically — no manual backfill required.
 *
 * Use a string that sorts/reads sensibly over time (date + same-day
 * counter). The exact value is opaque to the reconcile, which only checks
 * equality against the current value; sortability is purely for humans
 * reading `wrangler r2 object info`.
 *
 * Keep this a single, deliberate, manually-bumped constant rather than a
 * build hash: an auto-changing hash would re-bake the ENTIRE fleet on
 * every unrelated lp-studio deploy (expensive Playwright fan-out) even
 * when nothing about rendering changed.
 */
export const CURRENT_RENDER_VERSION = "2026-05-31.1";

/** R2 object metadata key under which CURRENT_RENDER_VERSION is stored. */
export const RENDER_VERSION_META_KEY = "render-version";
