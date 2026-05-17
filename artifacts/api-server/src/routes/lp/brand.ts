import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpBrandSettingsTable, lpPagesTable } from "@workspace/db";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";

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
  if (slug) {
    const rows = await db
      .select({ tenantId: lpPagesTable.tenantId })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.slug, slug))
      .limit(1);
    if (rows.length > 0) return rows[0].tenantId;
  }
  return null;
}

router.get("/lp/brand", async (req, res): Promise<void> => {
  const slugParam = typeof req.query.slug === "string" ? req.query.slug : null;
  const tenantId = await resolveBrandTenantId(req, slugParam);
  if (tenantId == null) {
    // Public request from a host we don't recognize (and no session). Return
    // bare server defaults; client will fill in its own neutral DEFAULT_BRAND.
    res.json(DEFAULT_CONFIG);
    return;
  }
  const rows = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    res.json(DEFAULT_CONFIG);
    return;
  }
  res.json({ ...DEFAULT_CONFIG, ...(rows[0].config as object) });
});

router.put("/lp/brand", async (req, res): Promise<void> => {
  // Writes still require an authenticated session — public viewers cannot
  // mutate brand settings.
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const config = req.body;
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "Invalid config" });
    return;
  }
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
