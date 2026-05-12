import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export interface ObjectAclPolicy {
  /**
   * Owner identifier. For tenant-scoped objects this is `tenant:<id>`,
   * matching the convention used by `tenantOwnerKey`. Legacy/admin uploads
   * may use other shapes (or omit ACL entirely).
   */
  owner: string;
  visibility: "public" | "private";
}

/** Stable owner key for a tenant-scoped object. */
export function tenantOwnerKey(tenantId: number): string {
  return `tenant:${tenantId}`;
}

/**
 * Parse the tenant id out of an ACL owner string. Returns null when the
 * owner doesn't carry a `tenant:<n>` prefix (legacy/shared uploads).
 */
export function tenantIdFromAclOwner(owner: string | undefined | null): number | null {
  if (!owner || typeof owner !== "string") return null;
  const m = owner.match(/^tenant:(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getObjectAclPolicy(file: File): Promise<ObjectAclPolicy | null> {
  const [metadata] = await file.getMetadata();
  const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  try {
    return JSON.parse(raw as string) as ObjectAclPolicy;
  } catch {
    return null;
  }
}

/**
 * Returns true when the requesting tenant is allowed to read the object
 * described by `policy`. Public objects are always readable. Tenant-owned
 * objects only match the owning tenant. Legacy objects without an ACL
 * policy are returned as `null` and the caller decides the default.
 */
export function tenantCanReadAcl(
  policy: ObjectAclPolicy | null,
  requesterTenantId: number | null,
): boolean | null {
  if (!policy) return null;
  if (policy.visibility === "public") return true;
  const ownerTenant = tenantIdFromAclOwner(policy.owner);
  if (ownerTenant != null) {
    return requesterTenantId != null && requesterTenantId === ownerTenant;
  }
  // Unknown owner shape — treat as private and refuse by default.
  return false;
}

export const ACL_METADATA_KEY = ACL_POLICY_METADATA_KEY;
