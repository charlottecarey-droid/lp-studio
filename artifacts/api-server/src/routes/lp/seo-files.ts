/**
 * Host-scoped robots.txt + sitemap.xml for published tenant landing pages.
 *
 * Public, unauthenticated. Tenant is resolved from the request host exactly
 * like /lp/rendered (getRequestHost → findTenantByHost), so the same handler
 * serves every tenant domain / microsite domain / wildcard subdomain.
 *
 * Routing note: these are mounted at /api/lp/robots.txt + /api/lp/sitemap.xml.
 * The public paths /robots.txt and /sitemap.xml on tenant hosts are proxied
 * here by the Cloudflare tenant-host-router worker (which fronts those
 * hosts); without that proxy the Replit static SPA service would serve the
 * lpstudio.ai marketing robots.txt (or index.html for sitemap.xml) on every
 * tenant host. See cloudflare/tenant-host-router/worker.js.
 *
 * Policy:
 *   - robots.txt: tenant host → allow all + advertise the sitemap;
 *     unresolved hosts and the app/admin/base hosts → Disallow: /.
 *   - sitemap.xml: lists only PUBLISHED pages whose resolved robots state is
 *     indexable, under the same default-noindex policy the prerender uses
 *     (task #547): tenant defaults fail CLOSED to noindex on lookup error,
 *     and an inherit page on a default-noindex tenant never appears.
 */
import { Router } from "express";
import { db, lpPagesTable, tenantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  resolveRobotsMeta,
  resolveTenantRobotsDefaults,
} from "@workspace/lp-template-engine";
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";
import { findTenantByHost, isWildcardBaseHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { buildSitemapXml, type SitemapPageEntry } from "../../lib/sitemapXml";

const router = Router();

// Modest shared-cache TTL: hosts gain/lose pages on publish, and crawlers
// poll these paths frequently — 5 minutes at the edge absorbs that without
// serving a stale sitemap for long.
const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

/**
 * Resolve the tenant's robots defaults (default-noindex policy, task #547).
 * Fail CLOSED to noindex on lookup error — same rationale as resolveRobots.ts:
 * a transient DB hiccup must never leak inherit pages into a sitemap.
 */
async function getTenantRobotsDefaults(tenantId: number): Promise<{
  tenantAllowIndexing: boolean;
  tenantAllowFollowing: boolean;
}> {
  try {
    const [tenantRow] = await db
      .select({ slug: tenantsTable.slug, settings: tenantsTable.settings })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    const seo = (
      tenantRow?.settings as
        | { seo?: { allowIndexing?: unknown; allowFollowing?: unknown } }
        | null
    )?.seo;
    return resolveTenantRobotsDefaults({
      isExcludedFromDefaultNoindex: isProtectedEnterpriseSlug(tenantRow?.slug),
      seoAllowIndexing: seo?.allowIndexing,
      seoAllowFollowing: seo?.allowFollowing,
    });
  } catch (err) {
    console.warn("[seo-files] tenant robots defaults lookup failed; failing CLOSED (noindex)", {
      tenantId,
      err,
    });
    return { tenantAllowIndexing: false, tenantAllowFollowing: true };
  }
}

router.get("/lp/robots.txt", async (req, res): Promise<void> => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", CACHE_CONTROL);
  const host = getRequestHost(req);
  try {
    // Base/app hosts (lpstudio.ai, app.lpstudio.ai) and any host that doesn't
    // resolve to an active tenant get a blanket Disallow — there's nothing
    // crawlable to advertise there from this surface.
    const tenant = host && !isWildcardBaseHost(host) ? await findTenantByHost(host) : null;
    if (!tenant) {
      res.send("User-agent: *\nDisallow: /\n");
      return;
    }
    res.send(`User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`);
  } catch (err) {
    console.warn("[seo-files] robots.txt tenant lookup failed; emitting Disallow", { host, err });
    res.send("User-agent: *\nDisallow: /\n");
  }
});

router.get("/lp/sitemap.xml", async (req, res): Promise<void> => {
  const host = getRequestHost(req);
  try {
    const tenant = host && !isWildcardBaseHost(host) ? await findTenantByHost(host) : null;
    if (!tenant) {
      res.status(404).send("Not found");
      return;
    }

    const { tenantAllowIndexing, tenantAllowFollowing } = await getTenantRobotsDefaults(
      tenant.tenantId,
    );

    const rows = await db
      .select({
        slug: lpPagesTable.slug,
        allowIndexing: lpPagesTable.allowIndexing,
        allowFollowing: lpPagesTable.allowFollowing,
        updatedAt: lpPagesTable.updatedAt,
      })
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.tenantId, tenant.tenantId),
          eq(lpPagesTable.status, "published"),
          eq(lpPagesTable.isTemplate, false),
        ),
      );

    const entries: SitemapPageEntry[] = rows.map((row) => ({
      slug: row.slug,
      indexable: resolveRobotsMeta({
        pageAllowIndexing: row.allowIndexing ?? null,
        pageAllowFollowing: row.allowFollowing ?? null,
        tenantAllowIndexing,
        tenantAllowFollowing,
      }).indexing,
      lastmod: row.updatedAt ?? null,
    }));

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", CACHE_CONTROL);
    res.send(buildSitemapXml(entries, host));
  } catch (err) {
    console.error("[seo-files] sitemap.xml failed", { host, err });
    res.status(500).send("Internal server error");
  }
});

export default router;
