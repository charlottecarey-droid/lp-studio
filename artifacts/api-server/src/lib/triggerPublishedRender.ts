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
 *
 *   3. Write order on publish: R2 (awaited) → OS (fire-and-forget).
 *      Delete order on unpublish: R2 → OS, both best-effort.
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
import { findTenantByHost } from "./tenantHosts";
import { prerenderLpPage } from "./prerenderLpPage";
import { injectPageMeta } from "./injectPageMeta";
import { uploadPublishedHtml, deletePublishedHtml } from "./publishedHtmlStorage";
import {
  isR2Configured,
  uploadPublishedHtmlToR2,
  deletePublishedHtmlFromR2,
} from "./r2Storage";

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
    | "r2_write_failed";
  /** Captured error message if any step threw. */
  error?: string;
  durationMs: number;
}

/** Background trigger — never throws to the caller. */
export function triggerPublishedRender(opts: TriggerPublishedRenderOpts): void {
  void renderAndStore(opts).catch((err) => {
    console.warn("[triggerPublishedRender] uncaught", { pageId: opts.pageId, err });
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

  // Resolve canonical host + tenant name.
  let canonicalHost = (opts.requestHost ?? "").trim().toLowerCase();
  let tenantName = "";
  if (canonicalHost) {
    const match = await findTenantByHost(canonicalHost);
    if (match && match.tenantId === page.tenantId) {
      tenantName = match.tenantName;
    } else {
      canonicalHost = "";
    }
  }
  if (!canonicalHost) {
    canonicalHost = (process.env.LP_STUDIO_PUBLIC_HOST || "").trim().toLowerCase();
    if (!canonicalHost && process.env.REPLIT_DEV_DOMAIN) {
      canonicalHost = process.env.REPLIT_DEV_DOMAIN;
    }
  }
  if (!tenantName) tenantName = page.title;

  // Race guard: snapshot updatedAt before render so we can detect a
  // concurrent edit superseding us after the render finishes.
  const renderStartUpdatedAt = page.updatedAt;

  let html: string;
  try {
    html = await prerenderLpPage({ pageId: page.id, slug: page.slug });
  } catch (err) {
    outcome.skipped = "render_failed";
    outcome.error = err instanceof Error ? err.message : String(err);
    outcome.durationMs = Date.now() - t0;
    console.warn("[triggerPublishedRender] prerender failed", { pageId: opts.pageId, err });
    return outcome;
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

  const withMeta = injectPageMeta(html, {
    title: page.title,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    ogImage: page.ogImage,
    slug: page.slug,
    canonicalHost,
    tenantName,
  });

  // ── R2 write (awaited, visitor-facing) ────────────────────────────────
  if (isR2Configured()) {
    try {
      await uploadPublishedHtmlToR2(page.tenantId, page.slug, withMeta);
      outcome.r2Ok = true;
      outcome.renderedVersionUpdatedAt = post.updatedAt ?? null;
    } catch (err) {
      // R2 failed. Stop. Do NOT write OS. Both caches stay at prior version.
      outcome.skipped = "r2_write_failed";
      outcome.error = err instanceof Error ? err.message : String(err);
      outcome.durationMs = Date.now() - t0;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[triggerPublishedRender][RECONCILE_NEEDED] R2 write failed", {
        pageId: page.id,
        tenantId: page.tenantId,
        slug: page.slug,
        err: errMsg,
      });
      Sentry.captureMessage("prerender_r2_write_failed", {
        level: "error",
        tags: {
          subsystem: "lp-prerender",
          outcome: "r2_write_failed",
        },
        extra: {
          pageId: page.id,
          tenantId: page.tenantId,
          slug: page.slug,
          error: errMsg,
        },
      });
      return outcome;
    }
  } else {
    // No R2 configured (dev/CI). Treat OS as the visitor source for
    // backwards compat and don't enforce the R2-first invariant.
    // This branch will go away once R2 credentials are in every env.
    outcome.r2Ok = true;
  }

  // ── OS write (fire-and-forget, debug-only, ordered AFTER R2) ─────────
  // We DO still await here for telemetry purposes but failures don't
  // affect the outcome the visitor sees.
  try {
    await uploadPublishedHtml(page.tenantId, page.slug, withMeta);
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
      try {
        await deletePublishedHtmlFromR2(tenantId, slug);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("[triggerPublishedDelete][RECONCILE_NEEDED] R2 delete failed", {
          tenantId,
          slug,
          err: errMsg,
        });
        Sentry.captureMessage("prerender_r2_delete_failed", {
          level: "error",
          tags: { subsystem: "lp-prerender", outcome: "r2_delete_failed" },
          extra: { tenantId, slug, error: errMsg },
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
    console.warn("[triggerPublishedDelete] uncaught", { tenantId, slug, err });
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
