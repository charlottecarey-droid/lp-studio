/**
 * Shared robots-meta resolution for the api-server request paths — task #547.
 *
 * Wraps the pure engine helpers with the tenant lookup + the default-noindex
 * policy so every server path (SPA config endpoint, og-preview HTML, the
 * debug rendered endpoint, and the R2 prerender) resolves the SAME robots
 * directive for a page.
 *
 * Policy (task #547): every tenant landing page is noindex by default EXCEPT
 * the Dandy tenant (gated server-side by slug via `isProtectedEnterpriseSlug`,
 * never by brand name). A per-page `allow_indexing === true` override is the
 * single opt-in path and always wins (handled by `resolveRobotsMeta`).
 *
 * Fail CLOSED (task #547): on any tenant-lookup failure we return "noindex"
 * rather than the pre-#494 fail-open. This is the safe default for an
 * anti-phishing control — a transient DB hiccup must never leak an indexable
 * page onto the shared apex domain. An explicitly opted-in page
 * (page.allowIndexing === true) still stays indexable on failure because the
 * page override beats the tenant default in `resolveRobotsMeta` — so only
 * inherit pages go noindex during an outage, which is exactly what we want.
 */
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  resolveRobotsMeta,
  robotsMetaContent,
  resolveTenantRobotsDefaults,
} from "@workspace/lp-template-engine";
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";

/**
 * Resolve the `<meta name="robots">` / `X-Robots-Tag` content for a page.
 * Returns null when the page is fully allowed (no tag, no header — never a
 * redundant index,follow), a directive string ("noindex", "nofollow",
 * "noindex,nofollow") otherwise.
 */
export async function resolveRobotsContentForPage(page: {
  allowIndexing: boolean | null;
  allowFollowing: boolean | null;
  tenantId: number;
}): Promise<string | null> {
  let tenantAllowIndexing = false;
  let tenantAllowFollowing = true;
  try {
    const [tenantRow] = await db
      .select({ slug: tenantsTable.slug, settings: tenantsTable.settings })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, page.tenantId));
    const seo = (
      tenantRow?.settings as
        | { seo?: { allowIndexing?: unknown; allowFollowing?: unknown } }
        | null
    )?.seo;
    const defaults = resolveTenantRobotsDefaults({
      isExcludedFromDefaultNoindex: isProtectedEnterpriseSlug(tenantRow?.slug),
      seoAllowIndexing: seo?.allowIndexing,
      seoAllowFollowing: seo?.allowFollowing,
    });
    tenantAllowIndexing = defaults.tenantAllowIndexing;
    tenantAllowFollowing = defaults.tenantAllowFollowing;
  } catch (err) {
    console.warn(
      "[resolveRobots] tenant lookup failed; failing CLOSED to noindex",
      { tenantId: page.tenantId, err },
    );
    return "noindex";
  }
  return robotsMetaContent(
    resolveRobotsMeta({
      pageAllowIndexing: page.allowIndexing ?? null,
      pageAllowFollowing: page.allowFollowing ?? null,
      tenantAllowIndexing,
      tenantAllowFollowing,
    }),
  );
}
