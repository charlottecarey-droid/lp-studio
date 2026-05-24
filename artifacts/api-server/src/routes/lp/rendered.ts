/**
 * GET /api/lp/rendered/:slug — stream the prerendered HTML for a published
 * page. Tenant resolved from the request host (slugs are unique only per
 * tenant). Replaces the CF og-bot-router worker as the source of truth for
 * per-page meta + DOM.
 *
 * 404s when:
 *   - request host doesn't resolve to a tenant
 *   - no published HTML file exists for that (tenant, slug) — e.g. the
 *     page was unpublished, has never been published, or hasn't been
 *     re-rendered since this storage was introduced. Callers (the SPA
 *     edge or a CF rule) are expected to fall back to the live SPA in
 *     that case so drafts/preview/legacy pages keep working.
 *
 * Task #364.
 */
import { Router } from "express";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { readPublishedHtml, deletePublishedHtml } from "../../lib/publishedHtmlStorage";
import { db, lpPagesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

router.get("/lp/rendered/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    res.status(400).json({ error: "Missing slug" });
    return;
  }
  const host = getRequestHost(req);
  if (!host) {
    res.status(404).send("Not found");
    return;
  }
  const tenantMatch = await findTenantByHost(host);
  if (!tenantMatch) {
    res.status(404).send("Not found");
    return;
  }

  try {
    // Re-check the DB row's publication status before serving. The stored
    // file is a cache and unpublish/delete deletes are best-effort; if a
    // delete ever failed silently, we'd otherwise serve a stale unpublished
    // page indefinitely. Fail-closed here makes the DB row the source of
    // truth on every read.
    const [row] = await db
      .select({ status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantMatch.tenantId), eq(lpPagesTable.slug, slug)));
    if (!row || row.status !== "published") {
      // Heal the cache so subsequent reads don't pay the DB hit just to 404.
      // Fire-and-forget; no need to await.
      if (row && row.status !== "published") {
        void deletePublishedHtml(tenantMatch.tenantId, slug).catch(() => {});
      }
      res.status(404).send("Not found");
      return;
    }
    const file = await readPublishedHtml(tenantMatch.tenantId, slug);
    if (!file) {
      res.status(404).send("Not found");
      return;
    }
    // Browsers cache 60s, CDNs 5min, serve-stale-while-revalidate for 24h
    // so a transient API outage doesn't take down published pages. Same
    // SWR strategy as /lp/page/:slug — see tracking.ts cache rationale.
    res.set(
      "Cache-Control",
      "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400",
    );
    res.set("Content-Type", "text/html; charset=utf-8");
    // Marker header so curl debug + edge logs make it obvious the response
    // came from the prerendered store (vs SPA fallback).
    res.set("X-LP-Source", "prerendered");
    if (file.updatedAt) res.set("Last-Modified", file.updatedAt.toUTCString());
    res.send(file.html);
  } catch (err) {
    console.error("[rendered] read failed", { slug, host, err });
    res.status(500).send("Internal server error");
  }
});

export default router;
