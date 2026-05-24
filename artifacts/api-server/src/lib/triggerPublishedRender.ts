/**
 * Orchestrate the prerender + meta-injection + storage upload pipeline for
 * a single published landing page. Fire-and-forget from publish/approve
 * handlers — the user's PATCH/POST returns immediately and the rendered
 * file is written in the background. A failure here logs a warning but
 * never bubbles up to the request: the DB row is the source of truth,
 * the rendered file is a cache that will get refreshed on the next
 * publish/edit.
 *
 * Visitors hitting `/api/lp/rendered/:slug` before the first render
 * lands receive a 404, which the edge falls back to the SPA for — so the
 * worst case for a brand-new publish is "page still served by SPA for a
 * few seconds" instead of "page is broken".
 *
 * Task #364.
 */
import { db, lpPagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { findTenantByHost } from "./tenantHosts";
import { prerenderLpPage } from "./prerenderLpPage";
import { injectPageMeta } from "./injectPageMeta";
import { uploadPublishedHtml, deletePublishedHtml } from "./publishedHtmlStorage";

export interface TriggerPublishedRenderOpts {
  pageId: number;
  /**
   * Host that triggered the publish, used to resolve the tenant name and
   * to build the canonical URL inside the per-page meta. Falls back to the
   * page's tenant lookup if the host doesn't resolve (e.g. publish was
   * triggered by an admin tool against an internal hostname).
   */
  requestHost?: string | null;
}

/**
 * Background trigger — never throws to the caller. Logs failures so we can
 * surface them via Sentry/log aggregation, but doesn't propagate.
 */
export function triggerPublishedRender(opts: TriggerPublishedRenderOpts): void {
  // Detach explicitly so an awaited caller can't accidentally serialize on
  // the render. We rely on the runtime keeping the event loop alive for
  // the duration of the publish handler's outer request.
  void renderAndStore(opts).catch((err) => {
    console.warn("[triggerPublishedRender] failed", { pageId: opts.pageId, err });
  });
}

async function renderAndStore(opts: TriggerPublishedRenderOpts): Promise<void> {
  const [page] = await db
    .select()
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, opts.pageId));
  if (!page) {
    console.warn("[triggerPublishedRender] page vanished before render", { pageId: opts.pageId });
    return;
  }
  if (page.status !== "published") {
    // Page was unpublished between the trigger and the render. Skip
    // (the unpublish hook handles deletion separately).
    return;
  }

  // Resolve tenant name + canonical host. Prefer the request host (what
  // the visitor sees) over anything else — that's also what the SPA's
  // own canonical link logic would use.
  let canonicalHost = (opts.requestHost ?? "").trim().toLowerCase();
  let tenantName = "";
  if (canonicalHost) {
    const match = await findTenantByHost(canonicalHost);
    if (match && match.tenantId === page.tenantId) {
      tenantName = match.tenantName;
    } else {
      // Host doesn't map to this page's tenant — don't trust it for the
      // canonical URL or the tenantName fallback. Clear and re-resolve.
      canonicalHost = "";
    }
  }
  if (!canonicalHost) {
    // Fall back to any known host the tenant owns. We don't have a direct
    // lookup, so we just leave the canonical host blank and the meta
    // injector falls back to a relative-ish form. Better than wrong.
    canonicalHost = (process.env.LP_STUDIO_PUBLIC_HOST || "").trim().toLowerCase();
    if (!canonicalHost && process.env.REPLIT_DEV_DOMAIN) {
      canonicalHost = process.env.REPLIT_DEV_DOMAIN;
    }
  }
  if (!tenantName) tenantName = page.title; // last-ditch

  // Capture the page's `updatedAt` BEFORE the render so we can detect
  // concurrent edits and refuse to overwrite a fresher render that may
  // already be on disk (race guard — without this, a slow render of an
  // older DB state can clobber a fast render of a newer state on retry/
  // re-publish).
  const renderStartUpdatedAt = page.updatedAt;

  let html: string;
  try {
    html = await prerenderLpPage({ pageId: page.id, slug: page.slug });
  } catch (err) {
    console.warn("[triggerPublishedRender] prerender failed", { pageId: opts.pageId, err });
    return;
  }

  // Re-read the page row AFTER the render. If it changed (edit landed
  // while we were rendering, or status flipped, or slug renamed), skip the
  // upload — whichever trigger handled the change will do its own render.
  const [post] = await db
    .select()
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, opts.pageId));
  if (!post) return;
  if (post.status !== "published") return;
  if (post.slug !== page.slug) return;
  if (renderStartUpdatedAt && post.updatedAt && post.updatedAt.getTime() !== renderStartUpdatedAt.getTime()) {
    // Newer edit superseded us; that edit's own render will refresh the file.
    return;
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

  try {
    await uploadPublishedHtml(page.tenantId, page.slug, withMeta);
  } catch (err) {
    console.warn("[triggerPublishedRender] upload failed", { pageId: opts.pageId, err });
    return;
  }
}

/**
 * Mirror of the above for the unpublish / delete flow. Best-effort.
 */
export function triggerPublishedDelete(tenantId: number, slug: string): void {
  void deletePublishedHtml(tenantId, slug).catch((err) => {
    console.warn("[triggerPublishedDelete] failed", { tenantId, slug, err });
  });
}

/**
 * Synchronous wrapper for callers that want to await the result (admin
 * tools, manual re-render endpoint). Same error-swallowing contract as
 * the fire-and-forget version; returns `true` on success.
 */
export async function renderAndStoreNow(opts: TriggerPublishedRenderOpts): Promise<boolean> {
  try {
    await renderAndStore(opts);
    return true;
  } catch (err) {
    console.warn("[renderAndStoreNow] failed", { pageId: opts.pageId, err });
    return false;
  }
}
