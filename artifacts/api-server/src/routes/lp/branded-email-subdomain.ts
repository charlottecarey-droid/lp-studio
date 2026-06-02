/**
 * Self-serve branded email-subdomain provisioning (Tier 2, Task #784).
 *
 * Lets a Growth/Scale tenant (gated by the `brandedEmailSubdomain` plan
 * feature) auto-provision a branded sending subdomain under the platform apex
 * — e.g. `mail.<slug>.lpstudio.ai` — with ZERO operator involvement and zero
 * DNS work for the tenant. Because the subdomain lives under OUR Cloudflare
 * zone, we publish the SPF/DKIM/MX records Resend requires directly into the
 * zone ourselves. The flow:
 *
 *   GET    /lp/branded-email-subdomain          derived subdomain + LIVE state
 *                                               (status re-fetched from Resend
 *                                               by id when provisioned).
 *   POST   /lp/branded-email-subdomain          provision: register in Resend,
 *                                               publish its DNS records into our
 *                                               Cloudflare zone, persist
 *                                               {brandedEmailSubdomain, id,
 *                                               dnsRecordIds}.
 *   POST   /lp/branded-email-subdomain/verify   re-fetch status by id (polled
 *                                               while DNS/Resend verify).
 *   DELETE /lp/branded-email-subdomain          delete the Resend domain + the
 *                                               DNS records we created + clear
 *                                               config → revert to shared default.
 *
 * FAIL CLOSED — same safety model as the Tier 3 custom-domain wizard:
 * provisioning only PERSISTS the subdomain. Whether mail actually sends from it
 * is decided independently by `resolveTenantSender`, which makes a live
 * `getResendDomainStatus` check and falls back to the Tier 1 shared default
 * until Resend reports "verified". A half-provisioned subdomain never sends.
 *
 * Provisioning is transactional best-effort: if publishing DNS fails, we roll
 * back any records we created AND delete the Resend domain before returning an
 * error, so we never leak resources or strand the tenant on a broken subdomain.
 *
 * All routes are gated by `requirePlanFeature("brandedEmailSubdomain")` (402
 * for ineligible tiers; superadmin bypasses, matching the rest of the gate).
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";
import { deriveBrandedSubdomain, getTenantSlug } from "../../lib/tenantSender";
import {
  createResendDomain,
  getResendDomainById,
  deleteResendDomain,
  type ResendDnsRecord,
  type ResendDomainVerificationState,
} from "../../lib/resendDomainStatus";
import {
  createDnsRecord,
  findDnsRecords,
  deleteDnsRecord,
  CloudflareError,
} from "../../lib/cloudflare";

const router = Router();

/**
 * State the Settings card renders. `subdomain` is always present (derived from
 * the slug) so the card can show "your branded subdomain will be …" before
 * provisioning. `active` is true iff a subdomain is provisioned AND Resend
 * reports it verified — i.e. mail is (or will be on the next cache cycle)
 * sending from it.
 */
interface BrandedSubdomainState {
  subdomain: string;
  domainId: string | null;
  status: ResendDomainVerificationState;
  active: boolean;
  provisioned: boolean;
}

type SalesConsoleSlice = {
  brandedEmailSubdomain?: unknown;
  brandedEmailSubdomainId?: unknown;
  brandedEmailSubdomainDnsRecordIds?: unknown;
  [k: string]: unknown;
};

interface PersistedConfig {
  rowId: number | null;
  config: Record<string, unknown>;
  subdomain: string;
  domainId: string;
  dnsRecordIds: string[];
}

/** Read the tenant's brand config + the branded-subdomain fields off salesConsole. */
async function readConfig(tenantId: number): Promise<PersistedConfig> {
  const rows = await db
    .select()
    .from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) {
    return { rowId: null, config: {}, subdomain: "", domainId: "", dnsRecordIds: [] };
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
  };
}

/**
 * Read-merge-write the branded-subdomain fields into config.salesConsole,
 * leaving every other brand/salesConsole field untouched.
 */
async function persist(
  tenantId: number,
  fields: { subdomain: string | null; domainId: string | null; dnsRecordIds: string[] | null },
): Promise<void> {
  const { rowId, config } = await readConfig(tenantId);
  const sc: Record<string, unknown> = { ...((config.salesConsole as Record<string, unknown>) ?? {}) };

  if (!fields.subdomain) delete sc.brandedEmailSubdomain;
  else sc.brandedEmailSubdomain = fields.subdomain;

  if (!fields.domainId) delete sc.brandedEmailSubdomainId;
  else sc.brandedEmailSubdomainId = fields.domainId;

  if (!fields.dnsRecordIds || fields.dnsRecordIds.length === 0) delete sc.brandedEmailSubdomainDnsRecordIds;
  else sc.brandedEmailSubdomainDnsRecordIds = fields.dnsRecordIds;

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
async function publishRecords(records: ResendDnsRecord[]): Promise<string[]> {
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
async function unpublishRecords(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await deleteDnsRecord(id);
    } catch (err) {
      console.warn(`[lp/branded-email-subdomain] DNS record delete failed (${id}):`, err);
    }
  }
}

/**
 * Build state for a provisioned subdomain by re-fetching its live status from
 * Resend by id. Fails open on a Resend outage to `api_unavailable` so the card
 * still renders the persisted subdomain rather than erroring.
 */
async function buildStateFromId(subdomain: string, domainId: string): Promise<BrandedSubdomainState> {
  const result = await getResendDomainById(domainId);
  if (!result.available || !result.domain) {
    return { subdomain, domainId, status: "api_unavailable", active: false, provisioned: true };
  }
  const status = result.domain.status;
  return {
    subdomain: result.domain.name || subdomain,
    domainId,
    status,
    active: status === "verified",
    provisioned: true,
  };
}

// All routes gated on the Tier 2 plan feature.
router.use("/lp/branded-email-subdomain", requirePlanFeature("brandedEmailSubdomain"));

router.get("/lp/branded-email-subdomain", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const slug = await getTenantSlug(tenantId);
    const derived = deriveBrandedSubdomain(slug, tenantId);
    const { subdomain, domainId } = await readConfig(tenantId);
    if (!domainId) {
      res.json({
        subdomain: subdomain || derived,
        domainId: null,
        status: "not_configured",
        active: false,
        provisioned: false,
      } satisfies BrandedSubdomainState);
      return;
    }
    res.json(await buildStateFromId(subdomain || derived, domainId));
  } catch (err) {
    console.error("[lp/branded-email-subdomain] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/lp/branded-email-subdomain", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const slug = await getTenantSlug(tenantId);
    const subdomain = deriveBrandedSubdomain(slug, tenantId);

    const existing = await readConfig(tenantId);
    // Idempotent re-provision: already registered → return live state.
    if (existing.domainId && existing.subdomain.toLowerCase() === subdomain) {
      res.json(await buildStateFromId(subdomain, existing.domainId));
      return;
    }

    // Register the subdomain in Resend (returns the DNS records to publish).
    const created = await createResendDomain(subdomain);
    if (!created.available || !created.domain) {
      // Nothing persisted → tenant stays on the shared default (fail closed).
      res.status(502).json({ error: created.error || "Could not register the subdomain with Resend" });
      return;
    }

    // Publish those records into OUR Cloudflare zone. On any failure, roll back
    // the records we created AND the Resend domain so nothing leaks.
    let dnsRecordIds: string[] = [];
    try {
      dnsRecordIds = await publishRecords(created.domain.records ?? []);
    } catch (dnsErr) {
      await unpublishRecords(dnsRecordIds);
      const del = await deleteResendDomain(created.domain.id);
      if (!del.available) {
        console.warn(`[lp/branded-email-subdomain] rollback: Resend delete failed: ${del.error}`);
      }
      const msg = dnsErr instanceof CloudflareError
        ? `Could not publish DNS records: ${dnsErr.message}`
        : "Could not publish DNS records for the subdomain";
      res.status(502).json({ error: msg });
      return;
    }

    await persist(tenantId, {
      subdomain: created.domain.name,
      domainId: created.domain.id,
      dnsRecordIds,
    });

    res.status(201).json({
      subdomain: created.domain.name,
      domainId: created.domain.id,
      status: created.domain.status,
      active: created.domain.status === "verified",
      provisioned: true,
    } satisfies BrandedSubdomainState);
  } catch (err) {
    console.error("[lp/branded-email-subdomain] POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/lp/branded-email-subdomain/verify", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const { subdomain, domainId } = await readConfig(tenantId);
    if (!domainId) {
      res.status(400).json({ error: "No branded subdomain is provisioned" });
      return;
    }
    res.json(await buildStateFromId(subdomain, domainId));
  } catch (err) {
    console.error("[lp/branded-email-subdomain] POST /verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/lp/branded-email-subdomain", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const { domainId, dnsRecordIds } = await readConfig(tenantId);
    // Best-effort teardown — clearing config is the safety-critical step, so
    // we always reach it even if the Resend/Cloudflare deletes fail.
    await unpublishRecords(dnsRecordIds);
    if (domainId) {
      const del = await deleteResendDomain(domainId);
      if (!del.available) {
        console.warn(`[lp/branded-email-subdomain] Resend delete failed for tenant ${tenantId}: ${del.error}`);
      }
    }
    await persist(tenantId, { subdomain: null, domainId: null, dnsRecordIds: null });

    const slug = await getTenantSlug(tenantId);
    res.json({
      subdomain: deriveBrandedSubdomain(slug, tenantId),
      domainId: null,
      status: "not_configured",
      active: false,
      provisioned: false,
    } satisfies BrandedSubdomainState);
  } catch (err) {
    console.error("[lp/branded-email-subdomain] DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
