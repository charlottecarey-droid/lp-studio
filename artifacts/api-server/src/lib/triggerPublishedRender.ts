/**
 * Orchestrate the prerender + meta-injection + storage upload pipeline for
 * a single published landing page. Fire-and-forget from publish/approve
 * handlers — the user's PATCH/POST returns immediately and the rendered
 * file is written in the background.
 *
 * WRITE CONSISTENCY MODEL (task #364) — read this before touching the
 * order of operations below:
 *
 *   1. `lp_pages.status` is the absolute source of truth. R2 and Replit OS
 *      are caches converging to it. Mismatches are recoverable by
 *      re-running render.
 *
 *   2. R2 is the visitor-facing read source (CF worker → R2 binding).
 *      Replit OS is the debug-only read source (`GET /api/lp/rendered/:slug`).
 *      R2 objects are keyed by `<host>/<slug>.html` — one object per
 *      host the tenant owns. Per-host keying eliminates the worker's
 *      tenant-resolution step, so the worker's read path makes ZERO
 *      api-server calls (the whole point of R2 mirroring is to survive
 *      api-server outages — an api-server-dependent tenant lookup
 *      would defeat that). OS is keyed by `<tenantId>/<slug>.html` —
 *      debug endpoint always knows tenant from the auth context.
 *
 *   3. Write order on publish: R2 (awaited, looped per host) → OS
 *      (fire-and-forget). Delete order on unpublish: R2 (per host) → OS,
 *      both best-effort.
 *
 *   4. **Invariant: OS never holds a version newer than R2.** If R2 write
 *      fails, OS is not written either; both stay at the prior version.
 *      This means the debug endpoint can be trusted: "if /api/lp/rendered
 *      shows version N, visitors are seeing at least version N."
 *
 *   5. R2 failures fire a structured Sentry message tagged
 *      `prerender_r2_write_failed` plus a warn-level console log. No
 *      automatic retry — runaway loops on a systemic R2 outage are worse
 *      than visible degraded state. Healing happens via the next
 *      publish/edit on the page or via `scripts/backfill-published-html.ts`.
 *
 *   6. OS failures (after a successful R2 write) fire a separate Sentry
 *      message tagged `prerender_os_write_failed_benign` and a warn log.
 *      The visitor path is healthy; only the debug endpoint lags until
 *      the next publish.
 */
import * as Sentry from "@sentry/node";
import { db, lpPagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findTenantByHost, getActiveHostsForTenant } from "./tenantHosts";
import { prerenderLpPage } from "./prerenderLpPage";
import { injectPageMeta } from "./injectPageMeta";
import { uploadPublishedHtml, deletePublishedHtml } from "./publishedHtmlStorage";
import {
  isR2Configured,
  uploadPublishedHtmlToR2,
  deletePublishedHtmlFromR2,
} from "./r2Storage";
import { verifyAssetsForHtml } from "./assetPresenceCheck";

export interface TriggerPublishedRenderOpts {
  pageId: number;
  /**
   * Host that triggered the publish, used to resolve the tenant name and
   * to build the canonical URL inside the per-page meta. Falls back to the
   * page's tenant lookup if the host doesn't resolve.
   */
  requestHost?: string | null;
}

export interface RenderOutcome {
  /** True if the visitor-facing cache (R2) ended at the expected version. */
  r2Ok: boolean;
  /** True if the debug-only cache (OS) ended at the expected version. */
  osOk: boolean;
  /** "Expected version" for both caches, or null if render itself failed. */
  renderedVersionUpdatedAt: Date | null;
  /** Reason the render didn't complete, if applicable. */
  skipped?:
    | "page_not_found"
    | "not_published"
    | "superseded_by_concurrent_edit"
    | "render_failed"
    | "render_failed_assets_missing"
    | "r2_write_failed";
  /** Captured error message if any step threw. */
  error?: string;
  durationMs: number;
}

/** Background trigger — never throws to the caller. */
export function triggerPublishedRender(opts: TriggerPublishedRenderOpts): void {
  void renderAndStore(opts).catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn("[triggerPublishedRender] uncaught", { pageId: opts.pageId, err });
    Sentry.captureMessage("prerender_uncaught", {
      level: "error",
      tags: { subsystem: "lp-prerender", outcome: "uncaught" },
      extra: { pageId: opts.pageId, error: errMsg },
    });
  });
}

async function renderAndStore(opts: TriggerPublishedRenderOpts): Promise<RenderOutcome> {
  const t0 = Date.now();
  const outcome: RenderOutcome = {
    r2Ok: false,
    osOk: false,
    renderedVersionUpdatedAt: null,
    durationMs: 0,
  };

  const [page] = await db
    .select()
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, opts.pageId));
  if (!page) {
    outcome.skipped = "page_not_found";
    outcome.durationMs = Date.now() - t0;
    console.warn("[triggerPublishedRender] page vanished before render", { pageId: opts.pageId });
    return outcome;
  }
  if (page.status !== "published") {
    outcome.skipped = "not_published";
    outcome.durationMs = Date.now() - t0;
    return outcome;
  }

  // Resolve tenant name + the full set of hosts the tenant publishes on.
  //
  // For per-host R2 keys we need to write one object per host. The
  // requestHost (if present) is only used to pick a tenantName when the
  // helper happens to know it; the canonical authoritative list comes
  // from getActiveHostsForTenant.
  let tenantName = "";
  const requestHost = (opts.requestHost ?? "").trim().toLowerCase();
  if (requestHost) {
    const match = await findTenantByHost(requestHost);
    if (match && match.tenantId === page.tenantId) {
      tenantName = match.tenantName;
    }
  }
  if (!tenantName) tenantName = page.title;

  const tenantHosts = await getActiveHostsForTenant(page.tenantId);
  // Fallback chain when the tenant has no hosts registered (edge case in
  // dev / partial-config tenants): use requestHost, then env defaults, so
  // we still produce one object the CF worker can find.
  const fallbackHost =
    requestHost ||
    (process.env.LP_STUDIO_PUBLIC_HOST || "").trim().toLowerCase() ||
    (process.env.REPLIT_DEV_DOMAIN || "").trim().toLowerCase();
  const hostsToWrite =
    tenantHosts.length > 0 ? tenantHosts : (fallbackHost ? [fallbackHost] : []);
  if (hostsToWrite.length === 0) {
    outcome.skipped = "render_failed";
    outcome.error = "no hosts to write — tenant has no domains/microsite/wildcards and no fallback host configured";
    outcome.durationMs = Date.now() - t0;
    console.warn("[triggerPublishedRender] no hosts to write", {
      pageId: page.id, tenantId: page.tenantId,
    });
    Sentry.captureMessage("prerender_no_hosts_to_write", {
      level: "error",
      tags: { subsystem: "lp-prerender", outcome: "no_hosts_to_write" },
      extra: {
        pageId: page.id,
        tenantId: page.tenantId,
        slug: page.slug,
      },
    });
    return outcome;
  }

  // Race guard: snapshot updatedAt before render so we can detect a
  // concurrent edit superseding us after the render finishes.
  const renderStartUpdatedAt = page.updatedAt;

  // Retry-once on render failure. The May 2026 backfill of ~82 pages
  // surfaced two intermittent failure modes (task #364 follow-up):
  //
  //   1. Hard waitForFunction timeout under memory pressure (one page in
  //      82 timed out on first try at 30s, succeeded in 15s on retry).
  //   2. Snapshot race where the SPA re-rendered between the wait
  //      condition passing and HTML capture, producing a stamped-but-
  //      empty document (closed in prerenderLpPage by atomic capture +
  //      mid-evaluate assertion that throws when the race happens).
  //
  // Root cause for (1) was never definitively isolated (no single signal
  // — concurrency, position-in-chunk, and chromium memory all
  // correlated). Documented as a known transient. Single retry with a
  // brief settle handles both modes without inviting runaway loops on a
  // genuine outage: caller still gets render_failed + Sentry alert if
  // both attempts fail. NEVER retry more than once — runaway prerender
  // loops are worse than a single missed publish (which the next edit
  // or `backfill-published-html.ts` self-heals).
  let html: string;
  let renderAttempts = 0;
  const renderAttempt = async (): Promise<string> => {
    renderAttempts += 1;
    return prerenderLpPage({ pageId: page.id, slug: page.slug });
  };
  try {
    html = await renderAttempt();
  } catch (firstErr) {
    const firstErrMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    console.warn("[triggerPublishedRender] prerender attempt 1 failed, retrying once", {
      pageId: opts.pageId, error: firstErrMsg,
    });
    // Brief settle to let any transient memory/cpu spike subside before
    // we hand Chromium another browser instance.
    await new Promise((r) => setTimeout(r, 1500));
    try {
      html = await renderAttempt();
      // Self-healing success — log it explicitly so we can track the
      // transient failure rate without it being invisible.
      console.warn("[triggerPublishedRender] prerender succeeded on retry", {
        pageId: opts.pageId, firstError: firstErrMsg,
      });
      Sentry.captureMessage("prerender_render_recovered_on_retry", {
        level: "warning",
        tags: { subsystem: "lp-prerender", outcome: "recovered_on_retry" },
        extra: {
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          firstError: firstErrMsg,
        },
      });
    } catch (secondErr) {
      outcome.skipped = "render_failed";
      outcome.error = secondErr instanceof Error ? secondErr.message : String(secondErr);
      outcome.durationMs = Date.now() - t0;
      console.warn("[triggerPublishedRender] prerender failed on both attempts", {
        pageId: opts.pageId, attempts: renderAttempts, err: secondErr,
      });
      // Render failures are how the May 2026 silent regression manifested
      // (LP_STUDIO_RENDER_BASE_URL unset on prod → Playwright loaded the
      // wrong base URL → SPA never rendered the page → blank HTML → R2
      // never updated). Alert loudly so the next regression of this shape
      // is caught the first time it happens, not the 100th.
      // Differentiate failure modes in Sentry tags so triage doesn't have
      // to grep `extra.error`. `snapshot_race` is the trios5-class case
      // (atomic-capture assertion threw — SPA re-rendered to shell mid-
      // evaluate); `nav_or_timeout` covers everything else (navigation
      // 4xx/5xx, waitForFunction timeout, browser launch failure, etc.).
      const reason = /snapshot race|lp-page-disappeared/i.test(outcome.error ?? "")
        ? "snapshot_race"
        : "nav_or_timeout";
      Sentry.captureMessage("prerender_render_failed", {
        level: "error",
        tags: { subsystem: "lp-prerender", outcome: "render_failed", reason },
        extra: {
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          attemptedHosts: hostsToWrite,
          attempts: renderAttempts,
          firstError: firstErrMsg,
          error: outcome.error,
        },
      });
      return outcome;
    }
  }

  // Re-check publication state after render. If it changed, skip both
  // caches; the trigger from the concurrent edit handles its own write.
  const [post] = await db
    .select()
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, opts.pageId));
  if (!post || post.status !== "published" || post.slug !== page.slug) {
    outcome.skipped = "not_published";
    outcome.durationMs = Date.now() - t0;
    return outcome;
  }
  if (
    renderStartUpdatedAt &&
    post.updatedAt &&
    post.updatedAt.getTime() !== renderStartUpdatedAt.getTime()
  ) {
    outcome.skipped = "superseded_by_concurrent_edit";
    outcome.durationMs = Date.now() - t0;
    return outcome;
  }

  // ── Task #374: asset presence check ─────────────────────────────────
  // The freshly rendered HTML references Vite-hashed `/assets/*` paths
  // from the *current* lp-studio build. Before we write this HTML to R2
  // (where it will be served for weeks via the CF Worker's R2 lookup),
  // confirm every referenced asset is already in R2 under
  // `_studio-assets/assets/<basename>`. If not, the lp-studio build
  // hook (`scripts/upload-assets-to-r2.mjs`) didn't run, R2 creds were
  // missing at build time, or the build container failed mid-upload —
  // writing this HTML would publish a guaranteed-broken page.
  //
  // We fail loud, leave R2 at the prior (working) version, and surface
  // a structured Sentry alert. Healing: redeploy lp-studio so the build
  // hook re-runs, then republish the page.
  if (isR2Configured()) {
    const presence = await verifyAssetsForHtml(html);
    if (presence.missing.length > 0) {
      outcome.skipped = "render_failed_assets_missing";
      outcome.error = `${presence.missing.length}/${presence.checked} referenced /assets/* are missing in R2; first=${presence.missing[0]}`;
      outcome.durationMs = Date.now() - t0;
      console.warn("[triggerPublishedRender][RECONCILE_NEEDED] referenced assets missing in R2 — refusing to write doomed prerender", {
        pageId: page.id, tenantId: page.tenantId, slug: page.slug,
        missingCount: presence.missing.length, missingSample: presence.missing.slice(0, 5),
      });
      Sentry.captureMessage("prerender_render_failed_assets_missing", {
        level: "error",
        tags: { subsystem: "lp-prerender", outcome: "render_failed_assets_missing" },
        extra: {
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          missingCount: presence.missing.length,
          checked: presence.checked,
          missing: presence.missing.slice(0, 20),
        },
      });
      return outcome;
    }
  }

  const buildHtmlForHost = (host: string): string =>
    injectPageMeta(html, {
      title: page.title,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      ogImage: page.ogImage,
      slug: page.slug,
      canonicalHost: host,
      tenantName,
    });

  // ── R2 write (awaited, visitor-facing, looped per host) ──────────────
  // We loop sequentially so that a transient R2 failure on host N stops
  // us from writing partial state to OS. Partial R2 writes (some hosts
  // ok, one failed) ARE possible — we treat that as r2_write_failed and
  // leave the other hosts' R2 objects updated (no point reverting
  // successful writes). Operator action: rerun render or backfill.
  if (isR2Configured()) {
    let failedHost: string | null = null;
    let firstError: unknown = null;
    for (const host of hostsToWrite) {
      try {
        await uploadPublishedHtmlToR2(host, page.slug, buildHtmlForHost(host), {
          tenantId: page.tenantId,
        });
      } catch (err) {
        failedHost = host;
        firstError = err;
        break;
      }
    }
    if (failedHost !== null) {
      outcome.skipped = "r2_write_failed";
      const errMsg = firstError instanceof Error ? firstError.message : String(firstError);
      outcome.error = `host=${failedHost}: ${errMsg}`;
      outcome.durationMs = Date.now() - t0;
      console.warn("[triggerPublishedRender][RECONCILE_NEEDED] R2 write failed", {
        pageId: page.id,
        tenantId: page.tenantId,
        slug: page.slug,
        failedHost,
        attemptedHosts: hostsToWrite,
        err: errMsg,
      });
      Sentry.captureMessage("prerender_r2_write_failed", {
        level: "error",
        tags: { subsystem: "lp-prerender", outcome: "r2_write_failed" },
        extra: {
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          failedHost,
          attemptedHosts: hostsToWrite,
          error: errMsg,
        },
      });
      return outcome;
    }
    outcome.r2Ok = true;
    outcome.renderedVersionUpdatedAt = post.updatedAt ?? null;
  } else {
    // No R2 configured (dev/CI). Treat OS as the visitor source for
    // backwards compat and don't enforce the R2-first invariant.
    outcome.r2Ok = true;
  }

  // ── OS write (debug-only, single object keyed by tenantId, AFTER R2) ─
  // OS sees one canonical version (built for the primary host — first in
  // the priority order). Debug endpoint resolves tenant from auth
  // context, so tenantId-keyed storage there is correct.
  const primaryHost = hostsToWrite[0];
  const osHtml = buildHtmlForHost(primaryHost);
  try {
    await uploadPublishedHtml(page.tenantId, page.slug, osHtml);
    outcome.osOk = true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn("[triggerPublishedRender][RECONCILE_NEEDED] OS write failed (benign — R2 is current)", {
      pageId: page.id,
      tenantId: page.tenantId,
      slug: page.slug,
      err: errMsg,
    });
    Sentry.captureMessage("prerender_os_write_failed_benign", {
      level: "warning",
      tags: {
        subsystem: "lp-prerender",
        outcome: "os_write_failed_benign",
      },
      extra: {
        pageId: page.id,
        tenantId: page.tenantId,
        slug: page.slug,
        error: errMsg,
      },
    });
  }

  outcome.durationMs = Date.now() - t0;
  return outcome;
}

/**
 * Delete flow — mirror of the publish flow's ordering rules:
 *   R2 delete (awaited, visitor-facing) → OS delete (best-effort).
 *
 * If R2 delete fails: log + Sentry + DO NOT delete OS. This keeps the
 * "OS never holds a version newer than R2" invariant: an undeleted R2 with
 * undeleted OS shows the same stale published page on both surfaces, which
 * is consistent (just stale). The opposite ordering could leave the debug
 * endpoint claiming the page is gone while visitors still see it — much
 * worse for debugging.
 */
export function triggerPublishedDelete(tenantId: number, slug: string): void {
  void (async () => {
    if (isR2Configured()) {
      // Delete from every host the tenant currently has. If a host was
      // removed from the tenant before this delete fires the orphan
      // object stays — but the host no longer routes to the worker so
      // visitors can't reach it. Cleanup of orphan host directories is
      // a periodic-script follow-up.
      const hosts = await getActiveHostsForTenant(tenantId);
      let failedHost: string | null = null;
      let firstError: unknown = null;
      for (const host of hosts) {
        try {
          await deletePublishedHtmlFromR2(host, slug);
        } catch (err) {
          failedHost = host;
          firstError = err;
          break;
        }
      }
      if (failedHost !== null) {
        const errMsg = firstError instanceof Error ? firstError.message : String(firstError);
        console.warn("[triggerPublishedDelete][RECONCILE_NEEDED] R2 delete failed", {
          tenantId,
          slug,
          failedHost,
          attemptedHosts: hosts,
          err: errMsg,
        });
        Sentry.captureMessage("prerender_r2_delete_failed", {
          level: "error",
          tags: { subsystem: "lp-prerender", outcome: "r2_delete_failed" },
          extra: { tenantId, slug, failedHost, attemptedHosts: hosts, error: errMsg },
        });
        return; // do NOT proceed to OS delete
      }
    }
    try {
      await deletePublishedHtml(tenantId, slug);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[triggerPublishedDelete][RECONCILE_NEEDED] OS delete failed (benign — R2 already deleted)", {
        tenantId,
        slug,
        err: errMsg,
      });
      Sentry.captureMessage("prerender_os_delete_failed_benign", {
        level: "warning",
        tags: { subsystem: "lp-prerender", outcome: "os_delete_failed_benign" },
        extra: { tenantId, slug, error: errMsg },
      });
    }
  })().catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn("[triggerPublishedDelete] uncaught", { tenantId, slug, err });
    Sentry.captureMessage("prerender_delete_uncaught", {
      level: "error",
      tags: { subsystem: "lp-prerender", outcome: "delete_uncaught" },
      extra: { tenantId, slug, error: errMsg },
    });
  });
}

/**
 * Synchronous wrapper for callers that want to await the result (admin
 * tools, backfill script, the manual re-render endpoint).
 */
export async function renderAndStoreNow(
  opts: TriggerPublishedRenderOpts,
): Promise<RenderOutcome> {
  try {
    return await renderAndStore(opts);
  } catch (err) {
    return {
      r2Ok: false,
      osOk: false,
      renderedVersionUpdatedAt: null,
      skipped: "render_failed",
      error: err instanceof Error ? err.message : String(err),
      durationMs: 0,
    };
  }
}
