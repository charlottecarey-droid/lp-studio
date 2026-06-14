import { getTenantId, optionalAuth } from "../../middleware/requireAuth";
import type { AuthUser } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { lpBrandSettingsTable, lpPagesTable, tenantsTable, lpMediaTable, lpPageReviewsTable } from "@workspace/db";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { isDandyTenant } from "../../lib/planFeatures";
import { isRootSuperadminEmail } from "../../lib/rootSuperadmin";

const router = Router();

/**
 * App-superadmin check for the `?previewTenantId=` path below. Mirrors the
 * helper in `routes/lp/pages.ts`: honour the configured root operator by email
 * (their app_users row may be cased differently and lack the seeded role), then
 * fall back to the persisted app_users.role. Resolved per-request (not from the
 * session) so a freshly-promoted operator works immediately.
 */
async function isBrandPreviewSuperadmin(user: AuthUser | undefined): Promise<boolean> {
  if (!user) return false;
  if (isRootSuperadminEmail(user.email)) return true;
  if (!user.userId) return false;
  const r = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [user.userId]);
  return r.rows[0]?.role === "superadmin";
}

// Brand-agnostic server-side defaults. The client (`lp-studio` brand-config.ts
// `DEFAULT_BRAND`) carries its own neutral defaults and will merge any keys
// missing from the API response. This object intentionally does NOT include
// any Dandy-specific values (logoUrl, copyrightName, meetdandy CTA URLs,
// social links, etc.) so an unauthenticated public viewer for a non-Dandy
// tenant never inherits Dandy branding through a fallback path.
// Template-eligibility governance (June 2026). The tenant/program setting that
// controls how aggressively the microsite wizard AUTO-picks a template vs.
// defaulting to "AI builds from scratch". Stored as an additive key on the
// brand_settings JSONB (no migration). Surfaced here so the GET returns the
// owner's safe DEFAULT ("ai-from-scratch-only") when unset, and the existing
// PUT /lp/brand round-trips it (it spreads `...config`). The recommend flow in
// generate-microsite.ts reads it via normalizeTemplateAiBehavior().
const DEFAULT_CONFIG = {
  micrositeTemplateAiBehavior: "ai-from-scratch-only",
};

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
  reviewToken: string | null,
): Promise<number | null> {
  const authedTenantId = (req as { authUser?: { tenantId?: number | null } }).authUser?.tenantId ?? null;
  if (authedTenantId != null) return authedTenantId;
  const host = getRequestHost(req);
  if (host) {
    const match = await findTenantByHost(host);
    if (match?.tenantId != null) return match.tenantId;
  }
  // SLUG FALLBACK — review-token-only. The single legitimate caller is the
  // /preview/:slug?reviewToken=… share flow on app.lpstudio.ai, where neither
  // the auth cookie nor the host can identify the tenant. Authorization is the
  // review-share token itself (an lp_page_reviews row bound to that exact
  // page), mirroring the /lp/preview/:slug route. Without a valid token we
  // refuse: previously any authenticated (even tenant-less) caller could
  // enumerate guessable page slugs — business names, public URLs, exports — to
  // read another tenant's full brand config JSONB (palette, fonts, sales-
  // console strategy). Normal authed users never reach here (their own tenant
  // is returned above); anonymous/host viewers fall through to DEFAULT_CONFIG.
  if (slug && reviewToken) {
    const [review] = await db
      .select({ pageId: lpPageReviewsTable.pageId })
      .from(lpPageReviewsTable)
      .where(eq(lpPageReviewsTable.token, reviewToken))
      .limit(1);
    if (!review) return null;
    const rows = await db
      .select({ tenantId: lpPagesTable.tenantId })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.id, review.pageId), eq(lpPagesTable.slug, slug)))
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
  const reviewTokenParam = typeof req.query.reviewToken === "string" ? req.query.reviewToken : null;
  // PREVIEW-AS-BRAND (superadmin only). When a superadmin edits a GLOBAL
  // template or a block-catalog scratch page (both owned by the neutral
  // __system-templates tenant, which has no brand of its own), the builder can
  // request any tenant's brand by id so the canvas renders the way that tenant
  // would see it. This is display-only — it never changes what is saved. The
  // page-slug fallback below can't serve this case because the scratch/global
  // page belongs to the system tenant, not the tenant being previewed. Gated
  // strictly on app-superadmin; a non-superadmin (or anonymous) caller silently
  // falls through to the normal host/auth/slug resolution so the param can't be
  // used to enumerate other tenants' brand JSONB.
  const previewParam =
    typeof req.query.previewTenantId === "string" ? req.query.previewTenantId : null;
  let tenantId: number | null = null;
  if (previewParam) {
    const previewId = parseInt(previewParam, 10);
    if (!Number.isNaN(previewId) && (await isBrandPreviewSuperadmin(req.authUser))) {
      tenantId = previewId;
    }
  }
  if (tenantId == null) {
    tenantId = await resolveBrandTenantId(req, slugParam, reviewTokenParam);
  }
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
  // Tenant-level fallback share-card metadata (task #999). These live on the
  // tenants row (not in brand_settings JSONB) and are the SPA's title/OG
  // baseline on tenant/Dandy hosts — replacing the old hardcoded per-host
  // index.html overrides. Read-only here; stripped on PUT so a client echo
  // can't shadow the canonical columns. Empty string when unset.
  const [tenantRow] = await db
    .select({
      defaultOgTitle: tenantsTable.defaultOgTitle,
      defaultOgDescription: tenantsTable.defaultOgDescription,
      defaultOgImageUrl: tenantsTable.defaultOgImageUrl,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  const ogDefaults = {
    defaultOgTitle: (tenantRow?.defaultOgTitle ?? "").trim(),
    defaultOgDescription: (tenantRow?.defaultOgDescription ?? "").trim(),
    defaultOgImageUrl: (tenantRow?.defaultOgImageUrl ?? "").trim(),
  };
  const rows = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    res.json({ ...DEFAULT_CONFIG, ...ogDefaults, isDandy });
    return;
  }
  res.json({ ...DEFAULT_CONFIG, ...(rows[0].config as object), ...ogDefaults, isDandy });
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
  // Also strip the read-only tenant-level OG defaults (task #999) — they are
  // columns on the tenants row (managed elsewhere), surfaced on GET only.
  // Persisting a client echo into brand_settings JSONB would create a stale
  // shadow copy that GET re-overlays anyway.
  const {
    isDandy: _isDandy,
    defaultOgTitle: _dot,
    defaultOgDescription: _dod,
    defaultOgImageUrl: _doi,
    ...config
  } = body as Record<string, unknown>;
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

  // Task #1173 — make brand logos self-identify in the media library. When the
  // brand is saved with a logoUrl (and the dark variant), add a `logo` tag to
  // the matching media-library row so logo assets are findable and protectable.
  // Best-effort: never fail the brand save on a tagging hiccup, and do nothing
  // when no media row matches the stored logo path (e.g. an external URL).
  const logoUrls = [config["logoUrl"], config["logoUrlDark"]]
    .filter((u): u is string => typeof u === "string" && u.trim() !== "");
  for (const logoUrl of logoUrls) {
    try {
      await db.transaction(async (tx) => {
        const [media] = await tx
          .select({ id: lpMediaTable.id, tags: lpMediaTable.tags })
          .from(lpMediaTable)
          .where(and(eq(lpMediaTable.tenantId, tenantId), eq(lpMediaTable.url, logoUrl)))
          .limit(1);
        if (!media) return;
        const existingTags = Array.isArray(media.tags) ? (media.tags as string[]) : [];
        if (existingTags.includes("logo")) return;
        await tx
          .update(lpMediaTable)
          .set({ tags: [...new Set([...existingTags, "logo"])] })
          .where(eq(lpMediaTable.id, media.id));
      });
    } catch (err) {
      req.log?.warn?.({ err, tenantId }, "[brand] failed to tag brand logo media row");
    }
  }

  // A product's hero image is the ONLY product image meant to serve as a page
  // hero, so it self-identifies in the media library with the `lp-hero` purpose
  // tag. We strip any conflicting purpose/og tags first (a hero is never also a
  // feature / product-detail / og image). Best-effort + tenant-scoped + idempotent;
  // skips external URLs that don't match a stored media row.
  const STRIP_PURPOSE_TAGS = new Set(["lp-hero", "lp-feature", "product-detail", "og-image"]);
  const productLines = Array.isArray(config["productLines"]) ? (config["productLines"] as Record<string, unknown>[]) : [];
  const heroImageUrls = productLines
    .map((p) => (p && typeof p["heroImage"] === "string" ? (p["heroImage"] as string).trim() : ""))
    .filter((u) => u !== "");
  for (const heroUrl of [...new Set(heroImageUrls)]) {
    try {
      await db.transaction(async (tx) => {
        const [media] = await tx
          .select({ id: lpMediaTable.id, tags: lpMediaTable.tags })
          .from(lpMediaTable)
          .where(and(eq(lpMediaTable.tenantId, tenantId), eq(lpMediaTable.url, heroUrl)))
          .limit(1);
        if (!media) return;
        const existingTags = Array.isArray(media.tags) ? (media.tags as string[]) : [];
        const cleaned = existingTags.filter((t) => !STRIP_PURPOSE_TAGS.has(t));
        const desired = ["lp-hero", ...cleaned];
        // Idempotent: skip the write only when tags already match exactly. We
        // cannot short-circuit on `existingTags[0] === "lp-hero"` alone — a row
        // tagged ["lp-hero", "lp-feature"] still needs its conflicting purpose
        // tags stripped.
        if (existingTags.length === desired.length && existingTags.every((t, i) => t === desired[i])) {
          return;
        }
        await tx
          .update(lpMediaTable)
          .set({ tags: desired })
          .where(eq(lpMediaTable.id, media.id));
      });
    } catch (err) {
      req.log?.warn?.({ err, tenantId }, "[brand] failed to tag brand hero media row");
    }
  }
});

export default router;
