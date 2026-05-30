import { getTenantId, optionalAuth } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpBrandSettingsTable, lpPagesTable } from "@workspace/db";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { isDandyTenant } from "../../lib/planFeatures";

const router = Router();

// Brand-agnostic server-side defaults. The client (`lp-studio` brand-config.ts
// `DEFAULT_BRAND`) carries its own neutral defaults and will merge any keys
// missing from the API response. This object intentionally does NOT include
// any Dandy-specific values (logoUrl, copyrightName, meetdandy CTA URLs,
// social links, etc.) so an unauthenticated public viewer for a non-Dandy
// tenant never inherits Dandy branding through a fallback path.
const DEFAULT_CONFIG = {};

/**
 * Resolve tenant id for the brand request.
 *   1. Authenticated session → use the user's tenant (builder/admin views).
 *   2. Otherwise → resolve from the request host (published landing page on a
 *      tenant/microsite domain, no auth cookie present).
 *   3. Otherwise → if a `?slug=` query is provided, resolve from the page
 *      record. This covers `/preview/:slug` viewers on `app.lpstudio.ai`
 *      (review-token shares, cross-tenant previews) where neither the auth
 *      cookie nor the host can identify the tenant. Without this, the brand
 *      response is empty and the viewer falls back to DEFAULT_BRAND (blue),
 *      so a Dandy preview link would render in generic blue instead of
 *      Dandy's palette.
 * Returns null if no path can pin a tenant.
 */
async function resolveBrandTenantId(
  req: Parameters<typeof getRequestHost>[0],
  slug: string | null,
): Promise<number | null> {
  const authedTenantId = (req as { authUser?: { tenantId?: number | null } }).authUser?.tenantId ?? null;
  if (authedTenantId != null) return authedTenantId;
  const host = getRequestHost(req);
  if (host) {
    const match = await findTenantByHost(host);
    if (match?.tenantId != null) return match.tenantId;
  }
  // SLUG FALLBACK — auth-only. Previously this path was reachable
  // unauthenticated, which let anyone enumerate page slugs (they are
  // guessable: business names, public URLs, exports) to fetch any tenant's
  // full brand config JSONB. The legitimate users of this path are
  // /preview/:slug viewers on app.lpstudio.ai (review-token shares,
  // cross-tenant previews) — all of which arrive with a session cookie. An
  // anonymous caller falls through to DEFAULT_CONFIG instead of leaking the
  // tenant's brand strategy + sales-console settings.
  if (slug) {
    const isAuthenticated = (req as { authUser?: { userId?: number } }).authUser?.userId != null;
    if (!isAuthenticated) return null;
    const rows = await db
      .select({ tenantId: lpPagesTable.tenantId })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.slug, slug))
      .limit(1);
    if (rows.length > 0) return rows[0].tenantId;
  }
  return null;
}

// optionalAuth: this route is in LP_PUBLIC (anonymous viewers on published
// landing pages must be able to fetch brand colors/logos), so requireAuth
// is intentionally NOT applied. But the slug-fallback path inside
// resolveBrandTenantId needs to know whether the caller is authenticated
// to decide whether to honor a `?slug=` lookup (which otherwise lets
// anyone enumerate any tenant's brand JSONB). optionalAuth hydrates
// req.authUser when a valid session cookie exists and is a no-op
// otherwise, so anonymous requests keep working unchanged.
router.get("/lp/brand", optionalAuth, async (req, res): Promise<void> => {
  const slugParam = typeof req.query.slug === "string" ? req.query.slug : null;
  const tenantId = await resolveBrandTenantId(req, slugParam);
  if (tenantId == null) {
    // Public request from a host we don't recognize (and no session). Return
    // bare server defaults; client will fill in its own neutral DEFAULT_BRAND.
    res.json(DEFAULT_CONFIG);
    return;
  }
  // Server-authoritative Dandy identity (resolved from the immutable protected
  // tenant slug, NOT the editable brandName). The one-pager generator gates its
  // bundled Dandy logo fallback on this flag, so a non-Dandy tenant can never
  // resurface Dandy assets by renaming their brand to "Dandy". Always written
  // AFTER the stored config spread so a stale persisted value can't override it.
  const isDandy = await isDandyTenant(tenantId);
  const rows = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    res.json({ ...DEFAULT_CONFIG, isDandy });
    return;
  }
  res.json({ ...DEFAULT_CONFIG, ...(rows[0].config as object), isDandy });
});

router.put("/lp/brand", async (req, res): Promise<void> => {
  // Writes still require an authenticated session — public viewers cannot
  // mutate brand settings.
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid config" });
    return;
  }
  // `isDandy` is a read-only, server-computed identity flag (resolved from the
  // immutable tenant slug on GET). Strip it before persisting so a stale or
  // forged value from an old client / direct API caller can never be written
  // into brand_settings JSONB — GET always recomputes it authoritatively.
  const { isDandy: _isDandy, ...config } = body as Record<string, unknown>;
  const existing = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (existing.length === 0) {
    const [row] = await db.insert(lpBrandSettingsTable).values({ tenantId, config }).returning();
    res.json(row.config);
  } else {
    const [row] = await db
      .update(lpBrandSettingsTable)
      .set({ config, updatedAt: new Date() })
      .where(and(eq(lpBrandSettingsTable.tenantId, tenantId), eq(lpBrandSettingsTable.id, existing[0].id)))
      .returning();
    res.json(row.config);
  }
});

export default router;
