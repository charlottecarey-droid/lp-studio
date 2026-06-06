import { db, lpMediaTable, tenantsTable } from "@workspace/db";
import { eq, or, inArray, type SQL } from "drizzle-orm";

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
