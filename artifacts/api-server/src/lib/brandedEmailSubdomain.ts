/**
 * Shared persistence + lifecycle helpers for the Tier 2 branded email
 * subdomain (`mail.<slug>.lpstudio.ai`, Task #784).
 *
 * All state lives in `lp_brand_settings.config.salesConsole`:
 *   - brandedEmailSubdomain              — the subdomain name (informational)
 *   - brandedEmailSubdomainId            — the Resend domain id
 *   - brandedEmailSubdomainDnsRecordIds  — the Cloudflare DNS record ids we own
 *   - brandedEmailSubdomainProvisionedAt — ISO timestamp set at provision time
 *                                          (the staleness clock for the sweep)
 *   - brandedSubdomainActive             — last observed verified state (bool)
 *
 * These helpers are deliberately extracted from the route handler so BOTH the
 * self-serve wizard (routes/lp/branded-email-subdomain.ts) and the background
 * retirement sweep (brandedEmailSubdomainPoller.ts) provision/teardown through
 * one code path — there is exactly one "deprovision" implementation.
 */
import { eq, and } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";
import { logger } from "./logger";
import {
  deleteResendDomain,
  type ResendDnsRecord,
} from "./resendDomainStatus";
import {
  createDnsRecord,
  findDnsRecords,
  deleteDnsRecord,
} from "./cloudflare";

type SalesConsoleSlice = {
  brandedEmailSubdomain?: unknown;
  brandedEmailSubdomainId?: unknown;
  brandedEmailSubdomainDnsRecordIds?: unknown;
  brandedEmailSubdomainProvisionedAt?: unknown;
  brandedSubdomainActive?: unknown;
  [k: string]: unknown;
};

export interface BrandedSubdomainConfig {
  rowId: number | null;
  config: Record<string, unknown>;
  subdomain: string;
  domainId: string;
  dnsRecordIds: string[];
  provisionedAt: string | null;
  active: boolean | null;
}

/** Read the tenant's brand config + the branded-subdomain fields off salesConsole. */
export async function readBrandedSubdomainConfig(tenantId: number): Promise<BrandedSubdomainConfig> {
  const rows = await db
    .select()
    .from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    return { rowId: null, config: {}, subdomain: "", domainId: "", dnsRecordIds: [], provisionedAt: null, active: null };
  }
  const config = (rows[0].config as Record<string, unknown>) ?? {};
  const sc = (config.salesConsole as SalesConsoleSlice) ?? {};
  const ids = Array.isArray(sc.brandedEmailSubdomainDnsRecordIds)
    ? sc.brandedEmailSubdomainDnsRecordIds.filter((x): x is string => typeof x === "string")
    : [];
  return {
    rowId: rows[0].id,
    config,
    subdomain: typeof sc.brandedEmailSubdomain === "string" ? sc.brandedEmailSubdomain : "",
    domainId: typeof sc.brandedEmailSubdomainId === "string" ? sc.brandedEmailSubdomainId : "",
    dnsRecordIds: ids,
    provisionedAt: typeof sc.brandedEmailSubdomainProvisionedAt === "string" ? sc.brandedEmailSubdomainProvisionedAt : null,
    active: typeof sc.brandedSubdomainActive === "boolean" ? sc.brandedSubdomainActive : null,
  };
}

export interface PersistBrandedSubdomainFields {
  subdomain: string | null;
  domainId: string | null;
  dnsRecordIds: string[] | null;
  /** ISO string to stamp; omit to leave untouched, pass null to clear. */
  provisionedAt?: string | null;
  /** Last observed verified state; omit to leave untouched, pass null to clear. */
  active?: boolean | null;
}

/**
 * Read-merge-write the branded-subdomain fields into config.salesConsole,
 * leaving every other brand/salesConsole field untouched. Fields that are
 * `undefined` are left as-is; `null` clears them.
 */
export async function persistBrandedSubdomain(
  tenantId: number,
  fields: PersistBrandedSubdomainFields,
): Promise<void> {
  const { rowId, config } = await readBrandedSubdomainConfig(tenantId);
  const sc: Record<string, unknown> = { ...((config.salesConsole as Record<string, unknown>) ?? {}) };

  if (!fields.subdomain) delete sc.brandedEmailSubdomain;
  else sc.brandedEmailSubdomain = fields.subdomain;

  if (!fields.domainId) delete sc.brandedEmailSubdomainId;
  else sc.brandedEmailSubdomainId = fields.domainId;

  if (!fields.dnsRecordIds || fields.dnsRecordIds.length === 0) delete sc.brandedEmailSubdomainDnsRecordIds;
  else sc.brandedEmailSubdomainDnsRecordIds = fields.dnsRecordIds;

  if (fields.provisionedAt !== undefined) {
    if (!fields.provisionedAt) delete sc.brandedEmailSubdomainProvisionedAt;
    else sc.brandedEmailSubdomainProvisionedAt = fields.provisionedAt;
  }

  if (fields.active !== undefined) {
    if (fields.active === null) delete sc.brandedSubdomainActive;
    else sc.brandedSubdomainActive = fields.active;
  }

  const nextConfig = { ...config, salesConsole: sc };
  if (rowId === null) {
    await db.insert(lpBrandSettingsTable).values({ tenantId, config: nextConfig });
  } else {
    await db
      .update(lpBrandSettingsTable)
      .set({ config: nextConfig, updatedAt: new Date() })
      .where(and(eq(lpBrandSettingsTable.tenantId, tenantId), eq(lpBrandSettingsTable.id, rowId)));
  }
}

/** Parse a Resend TTL string ("Auto" / "86400") into a Cloudflare TTL (1 = auto). */
function parseTtl(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Publish the DNS records Resend returned for the subdomain into our
 * Cloudflare zone. Idempotent per record: if a matching (name+type) record
 * already exists with the same content we reuse it instead of duplicating.
 * Returns the ids of all records that now exist for the subdomain (created or
 * reused) so the remove flow can delete exactly what we own. Throws on the
 * first hard failure — the caller rolls back.
 */
export async function publishBrandedSubdomainRecords(records: ResendDnsRecord[]): Promise<string[]> {
  const ids: string[] = [];
  for (const rec of records) {
    const type = (rec.type ?? "").toUpperCase();
    const name = (rec.name ?? "").trim();
    const content = (rec.value ?? "").trim();
    if (!type || !name || !content) continue;

    const existing = await findDnsRecords({ name, type });
    const match = existing.find((e) => e.content === content);
    if (match) {
      ids.push(match.id);
      continue;
    }
    const created = await createDnsRecord({
      type,
      name,
      content,
      ttl: parseTtl(rec.ttl),
      ...(typeof rec.priority === "number" ? { priority: rec.priority } : {}),
      comment: "LP Studio branded email subdomain (auto-provisioned)",
    });
    ids.push(created.id);
  }
  return ids;
}

/** Best-effort delete of every DNS record we created for the subdomain. */
export async function unpublishBrandedSubdomainRecords(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await deleteDnsRecord(id);
    } catch (err) {
      logger.warn({ err, recordId: id }, "brandedEmailSubdomain: DNS record delete failed");
    }
  }
}

/**
 * The single deprovision path, shared by the wizard's DELETE handler and the
 * background retirement sweep. Best-effort teardown — clearing config is the
 * safety-critical step, so we always reach it even if the Resend/Cloudflare
 * deletes fail. Returns false when nothing was provisioned (no-op).
 */
export async function deprovisionBrandedEmailSubdomain(tenantId: number): Promise<boolean> {
  const { domainId, dnsRecordIds } = await readBrandedSubdomainConfig(tenantId);
  if (!domainId && dnsRecordIds.length === 0) return false;

  await unpublishBrandedSubdomainRecords(dnsRecordIds);
  if (domainId) {
    const del = await deleteResendDomain(domainId);
    if (!del.available) {
      logger.warn({ tenantId, domainId, error: del.error }, "brandedEmailSubdomain: Resend domain delete failed");
    }
  }
  await persistBrandedSubdomain(tenantId, {
    subdomain: null,
    domainId: null,
    dnsRecordIds: null,
    provisionedAt: null,
    active: null,
  });
  return true;
}
