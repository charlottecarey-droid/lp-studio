import { db, lpMediaTable, tenantsTable, lpPagesTable } from "@workspace/db";
import { and, eq, isNull, or, inArray, sql, type SQL } from "drizzle-orm";

/**
 * Resolve the set of tenant ids whose media library a given tenant may read
 * (the tenant's own id + any sibling it explicitly, RECIPROCALLY shares a
 * library with).
 *
 * Sibling sharing is RECIPROCAL: A is treated as sharing with B only if both
 * `tenants[A].shares_library_with_tenant_id = B` AND
 * `tenants[B].shares_library_with_tenant_id = A`. A one-sided value is ignored,
 * so a misconfiguration on a single row cannot grant cross-tenant access.
 *
 * Single source of truth for the shared-drawer ACL. The media drawer
 * (routes/storage.ts) and the AI page/microsite generator
 * (routes/lp/generate-page.ts `fetchMediaCatalog`) MUST resolve the same scope,
 * otherwise the drawer shows a sibling's images but the generator can't use
 * them (the two drifted apart and caused the generator to repeat one image
 * because its candidate pool collapsed to a single tenant).
 */
export async function resolveOwnedTenantIds(tenantId: number): Promise<number[]> {
  const ownRows = await db
    .select({ sibling: tenantsTable.sharesLibraryWithTenantId })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  const sibling = ownRows[0]?.sibling ?? null;
  if (sibling == null || sibling === tenantId) return [tenantId];
  const reciprocal = await db
    .select({ pointsBack: tenantsTable.sharesLibraryWithTenantId })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, sibling))
    .limit(1);
  if (reciprocal[0]?.pointsBack === tenantId) return [tenantId, sibling];
  return [tenantId];
}

/** WHERE clause for "this tenant may READ this media row" — own tenant, a
 *  reciprocal sibling tenant, or any explicitly shared row. */
export function libraryReadablePredicate(ownedTenantIds: number[]): SQL<unknown> {
  return or(
    inArray(lpMediaTable.tenantId, ownedTenantIds),
    eq(lpMediaTable.isShared, true),
  )!;
}

/**
 * Returns true when the storage object identified by `wildcardPath`
 * (e.g. "uploads/<uuid>") is an INTENTIONALLY-shared asset that every
 * authenticated tenant is allowed to read, despite the object carrying a
 * tenant-private ACL. Two cases qualify:
 *
 *   1. It is registered as a shared library row in lp_media
 *      (tenant_id IS NULL or is_shared = true) — the "starter" library.
 *   2. It is referenced by a GLOBAL template (lp_pages.is_global = true). Global
 *      templates live under the system tenant and are meant to be cloneable —
 *      and previewable — by everyone, so their imagery must be readable
 *      cross-tenant.
 *
 * This is deliberately NARROW so the cross-tenant leak protection stays intact:
 * a private tenant upload referenced only by that tenant's own (non-global)
 * pages does NOT match. Call this ONLY in the rare cross-tenant 403 branch of
 * the storage serve route — it runs two extra DB reads.
 */
export async function isSharedOrGlobalAsset(wildcardPath: string): Promise<boolean> {
  // The url stored in lp_media for an internally-served object.
  const serveUrl = `/api/storage/objects/${wildcardPath}`;
  const sharedRows = await db
    .select({ id: lpMediaTable.id })
    .from(lpMediaTable)
    .where(
      and(
        eq(lpMediaTable.url, serveUrl),
        or(isNull(lpMediaTable.tenantId), eq(lpMediaTable.isShared, true)),
      ),
    )
    .limit(1);
  if (sharedRows.length > 0) return true;

  // Referenced by a global template. The URL can be stored host-prefixed,
  // as the "/api/storage/objects/..." serve path, or as the bare object path
  // inside the blocks JSONB / og_image, so match on the unique
  // "uploads/<uuid>" tail (no LIKE metacharacters appear in that tail).
  const pattern = `%${wildcardPath}%`;
  const globalRows = await db
    .select({ id: lpPagesTable.id })
    .from(lpPagesTable)
    .where(
      and(
        eq(lpPagesTable.isGlobal, true),
        or(
          sql`${lpPagesTable.blocks}::text LIKE ${pattern}`,
          sql`${lpPagesTable.ogImage} LIKE ${pattern}`,
        ),
      ),
    )
    .limit(1);
  return globalRows.length > 0;
}
