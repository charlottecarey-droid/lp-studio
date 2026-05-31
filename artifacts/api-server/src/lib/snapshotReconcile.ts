/**
 * Post-deploy snapshot reconcile (task #708).
 *
 * THE PROBLEM
 * Published landing pages are served from a frozen static HTML snapshot in
 * R2 (see triggerPublishedRender.ts). A snapshot is baked at publish time
 * and only re-baked on the next publish/edit of that page — never
 * automatically when the lp-studio rendering code changes. So a rendering
 * fix (e.g. the one-pager logo / brand-font fix) silently fails to reach
 * visitors on every page published before the fix.
 *
 * THE FIX
 * Each snapshot is stamped with CURRENT_RENDER_VERSION in its R2 metadata
 * at write time (renderVersion.ts + r2Storage.ts). This reconcile walks
 * every published page, reads each snapshot's stored render-version
 * cheaply via HEAD, and re-bakes any whose stored version is missing or
 * behind the current one. After a deploy that bumps CURRENT_RENDER_VERSION
 * the stale snapshots self-heal — no manual backfill required.
 *
 * SAFETY MODEL (mirrors backfill-published-html.ts + assetHealthCheck.ts):
 *   - Cross-instance advisory lock: only one app server runs the reconcile
 *     at a time, so a multi-instance deploy doesn't fan out N concurrent
 *     Chromium re-bakes of the same pages (Playwright is memory-heavy —
 *     concurrent fleets OOM the container).
 *   - In-process single-flight guard so overlapping interval ticks within
 *     one process don't double-run.
 *   - Detection (cheap R2 HEADs) is bounded with a small worker pool.
 *   - Re-baking (expensive Playwright render) is SERIAL — one page at a
 *     time — to keep memory flat, exactly like the default backfill.
 *   - Re-bake goes through renderAndStoreNow, inheriting its retry-once,
 *     asset-presence guard, concurrent-edit race guard, and per-host R2
 *     write consistency. We never re-render in this module directly.
 *   - Structured logs + Sentry so the reconcile's actions are observable.
 *
 * NOT a substitute for publish-time rendering — only a backstop that
 * converges stale snapshots to the current render version.
 */
import * as Sentry from "@sentry/node";
import { db, lpPagesTable, pool } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";
import { getActiveHostsForTenant } from "./tenantHosts";
import { getPublishedHtmlMetaFromR2, isR2Configured } from "./r2Storage";
import { renderAndStoreNow } from "./triggerPublishedRender";
import { CURRENT_RENDER_VERSION } from "./renderVersion";

// Stable advisory-lock pair-key. Class id is the task number; obj id leaves
// room for sibling locks in this family. Distinct from the custom-domain
// poller (415,1) and the workflow sweep so the three never collide.
const ADVISORY_LOCK_CLASSID = 708;
const ADVISORY_LOCK_OBJID = 1;

// Bound the cheap HEAD detection fan-out; same value the asset-health
// sweep uses. Re-baking itself is serial regardless of this (see below).
const DETECT_CONCURRENCY = 8;

// Hard ceiling on how many pages a single reconcile run will re-bake.
// A normal version bump makes the whole fleet (~85 pages today) stale at
// once; re-baking serially at ~3-10s each that is a few minutes of work,
// which is fine. The cap is a runaway guard: if something is mis-stamping
// versions so pages never converge, we re-bake at most this many per run
// and let the next tick continue, rather than spinning forever. Override
// via LP_SNAPSHOT_RECONCILE_MAX_REBAKES for a one-off large backfill.
function maxRebakesPerRun(): number {
  const raw = Number(process.env.LP_SNAPSHOT_RECONCILE_MAX_REBAKES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 500;
}

interface PageRow {
  id: number;
  tenantId: number;
  slug: string;
}

/**
 * Pure staleness decision (exported for unit tests). Given the
 * render-version observed for each active host snapshot — where `null`
 * means the snapshot is absent OR was baked before render-version
 * stamping existed — a page is STALE if it has at least one active host
 * and ANY of those hosts is not exactly at `current`. A page with no
 * active hosts is not stale (nothing visitor-facing to reconcile).
 *
 * Inconclusive probes (transient HEAD failures) are handled by the
 * caller, which omits the host rather than passing a misleading value
 * here — we never re-bake on a probe we couldn't read.
 */
export function isSnapshotStale(
  hostVersions: Record<string, string | null>,
  current: string,
): boolean {
  const hosts = Object.keys(hostVersions);
  if (hosts.length === 0) return false;
  return hosts.some((h) => hostVersions[h] !== current);
}

/**
 * Decide whether a page's stored snapshot(s) are stale relative to the
 * current render version. A page is stale if ANY active host's snapshot is
 * missing or carries a render-version other than CURRENT_RENDER_VERSION.
 * Pages with no active hosts have nothing visitor-facing to reconcile and
 * are reported as "no_hosts" (skipped).
 */
async function classifyPage(
  page: PageRow,
): Promise<{ stale: boolean; reason: "current" | "stale" | "no_hosts"; hostVersions: Record<string, string | null> }> {
  const hosts = await getActiveHostsForTenant(page.tenantId);
  if (hosts.length === 0) {
    return { stale: false, reason: "no_hosts", hostVersions: {} };
  }
  const hostVersions: Record<string, string | null> = {};
  for (const host of hosts) {
    const meta = await getPublishedHtmlMetaFromR2(host, page.slug);
    // Missing object (meta === null) → version null → stale.
    hostVersions[host] = meta ? meta.renderVersion : null;
  }
  const stale = isSnapshotStale(hostVersions, CURRENT_RENDER_VERSION);
  return { stale, reason: stale ? "stale" : "current", hostVersions };
}

// In-process single-flight guard.
let inflight: Promise<void> | null = null;

export function runSnapshotReconcile(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!isR2Configured()) {
      logger.debug("snapshotReconcile: R2 not configured, skipping");
      return;
    }
    // Cross-instance lock on a dedicated session connection. Session-scoped
    // (not xact) because the run can take minutes — we must NOT hold a
    // transaction open across the serial Playwright re-bakes. We unlock
    // explicitly and the lock auto-releases on disconnect as a backstop.
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, $2) AS locked`,
        [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID],
      );
      if (!lockResult.rows[0]?.locked) {
        logger.debug("snapshotReconcile: another instance holds the lock — skipping");
        return;
      }
      try {
        await runReconcileLocked();
      } finally {
        await client
          .query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) =>
            logger.warn({ err }, "snapshotReconcile: advisory unlock failed (will auto-release on disconnect)"),
          );
      }
    } finally {
      client.release();
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runReconcileLocked(): Promise<void> {
  const t0 = Date.now();
  let pages: PageRow[];
  try {
    pages = await db
      .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.status, "published"))
      .orderBy(desc(lpPagesTable.updatedAt));
  } catch (err) {
    logger.error({ err }, "snapshotReconcile: published-pages query failed");
    Sentry.captureMessage("snapshot_reconcile_query_failed", {
      level: "warning",
      tags: { subsystem: "lp-prerender", outcome: "reconcile_query_failed" },
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
    return;
  }

  // ── Detection phase: cheap HEADs, bounded worker pool ────────────────
  const stalePages: PageRow[] = [];
  let noHostPages = 0;
  let detectFailures = 0;
  let cursor = 0;
  async function detector() {
    while (cursor < pages.length) {
      const page = pages[cursor++];
      try {
        const c = await classifyPage(page);
        if (c.reason === "no_hosts") {
          noHostPages++;
        } else if (c.stale) {
          stalePages.push(page);
        }
      } catch (err) {
        // A transient HEAD failure shouldn't abort the sweep; treat as
        // "couldn't tell" and skip this page this tick (the next tick
        // retries). Do NOT re-bake on an inconclusive probe.
        detectFailures++;
        logger.warn({ err, pageId: page.id, slug: page.slug }, "snapshotReconcile: detection probe failed");
      }
    }
  }
  await Promise.all(Array.from({ length: DETECT_CONCURRENCY }, () => detector()));

  if (stalePages.length === 0) {
    logger.info(
      {
        currentRenderVersion: CURRENT_RENDER_VERSION,
        totalPublished: pages.length,
        stale: 0,
        noHostPages,
        detectFailures,
        durationMs: Date.now() - t0,
      },
      "snapshotReconcile: all snapshots current",
    );
    return;
  }

  // ── Re-bake phase: SERIAL, bounded by maxRebakesPerRun ───────────────
  const cap = maxRebakesPerRun();
  const toRebake = stalePages.slice(0, cap);
  let rebaked = 0;
  let rebakeFailed = 0;
  const failedSample: { pageId: number; slug: string; reason?: string; error?: string }[] = [];

  logger.info(
    {
      currentRenderVersion: CURRENT_RENDER_VERSION,
      totalPublished: pages.length,
      staleDetected: stalePages.length,
      rebakeAttempting: toRebake.length,
      capped: stalePages.length > cap,
      noHostPages,
      detectFailures,
    },
    "snapshotReconcile: stale snapshots detected — re-baking",
  );

  for (const page of toRebake) {
    try {
      const result = await renderAndStoreNow({ pageId: page.id, requestHost: null });
      if (result.r2Ok && !result.skipped) {
        rebaked++;
      } else {
        rebakeFailed++;
        if (failedSample.length < 15) {
          failedSample.push({ pageId: page.id, slug: page.slug, reason: result.skipped, error: result.error });
        }
        logger.warn(
          { pageId: page.id, slug: page.slug, reason: result.skipped, error: result.error },
          "snapshotReconcile: re-bake did not complete",
        );
      }
    } catch (err) {
      rebakeFailed++;
      if (failedSample.length < 15) {
        failedSample.push({ pageId: page.id, slug: page.slug, error: err instanceof Error ? err.message : String(err) });
      }
      logger.warn({ err, pageId: page.id, slug: page.slug }, "snapshotReconcile: re-bake threw");
    }
  }

  const summary = {
    currentRenderVersion: CURRENT_RENDER_VERSION,
    totalPublished: pages.length,
    staleDetected: stalePages.length,
    rebaked,
    rebakeFailed,
    capped: stalePages.length > cap,
    noHostPages,
    detectFailures,
    durationMs: Date.now() - t0,
  };
  logger.info(summary, "snapshotReconcile: complete");

  if (rebakeFailed > 0) {
    Sentry.captureMessage("snapshot_reconcile_rebake_failed", {
      level: "warning",
      tags: { subsystem: "lp-prerender", outcome: "reconcile_rebake_failed" },
      extra: { ...summary, failedSample },
    });
  }
}
