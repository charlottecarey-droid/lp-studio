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

interface SyncOutcome {
  /** Cloudflare record ids that now back the subdomain (reused + created). */
  ids: string[];
  /** Human-readable "<TYPE> <name>" of records we had to (re-)create. */
  created: string[];
}

/**
 * Reconcile a set of Resend-required DNS records against what's live in our
 * Cloudflare zone, creating any that are missing. Idempotent per record: if a
 * matching (name+type) record already exists with the SAME content we reuse it
 * instead of duplicating; otherwise we create it and record the repair. A
 * content mismatch (a record edited out-of-band) is treated as "missing the
 * required record" — we re-publish the correct one rather than mutating or
 * deleting the unknown existing record (non-destructive; Resend only needs the
 * required record present to verify). Throws on the first hard Cloudflare
 * failure so the provision path can roll back.
 */
async function syncRecords(records: ResendDnsRecord[]): Promise<SyncOutcome> {
  const ids: string[] = [];
  const created: string[] = [];
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
    const rec2 = await createDnsRecord({
      type,
      name,
      content,
      ttl: parseTtl(rec.ttl),
      ...(typeof rec.priority === "number" ? { priority: rec.priority } : {}),
      comment: "LP Studio branded email subdomain (auto-provisioned)",
    });
    ids.push(rec2.id);
    created.push(`${type} ${name}`);
  }
  return { ids, created };
}

/**
 * Publish the DNS records Resend returned for the subdomain into our
 * Cloudflare zone. Returns the ids of all records that now exist for the
 * subdomain (created or reused) so the remove flow can delete exactly what we
 * own. Throws on the first hard failure — the caller rolls back.
 */
async function publishRecords(records: ResendDnsRecord[]): Promise<string[]> {
  return (await syncRecords(records)).ids;
}

/**
 * Result of a single tenant's branded-subdomain DNS reconcile.
 */
export interface BrandedSubdomainReconcileResult {
  tenantId: number;
  /** True when the tenant has a branded subdomain registered (else a no-op). */
  provisioned: boolean;
  /** Number of required DNS records examined (0 when skipped). */
  checked: number;
  /** Number of records (re-)created to repair drift. */
  repaired: number;
  /** "<TYPE> <name>" of each repaired record (for logging/inspection). */
  repairedRecords: string[];
  /** Set when reconcile was skipped without checking (e.g. Resend unavailable). */
  skipped?: string;
}

/**
 * Detect and repair drifted DNS for a tenant's branded email subdomain.
 *
 * Tier 2 publishes a tenant's Resend SPF/DKIM/MX records into OUR Cloudflare
 * zone at provision time. If those records are later edited or deleted
 * out-of-band (or a provision partially failed), sending silently breaks with
 * no self-healing. This routine re-derives the required records from Resend
 * (the source of truth — fetched live by the persisted domain id), compares
 * them against what's live in Cloudflare, and re-publishes any that are
 * missing/changed.
 *
 * Safe to run repeatedly: each required record is reused when already correct
 * and only created when absent, so it never duplicates a healthy record. Loud
 * when it repairs drift. Fails CLOSED on a Resend outage — if we can't
 * determine the required records we skip (touching nothing) rather than risk
 * tearing down good records.
 */
export async function reconcileBrandedSubdomainDns(
  tenantId: number,
): Promise<BrandedSubdomainReconcileResult> {
  const { subdomain, domainId, dnsRecordIds } = await readConfig(tenantId);
  if (!domainId) {
    return { tenantId, provisioned: false, checked: 0, repaired: 0, repairedRecords: [] };
  }

  // Resend is the source of truth for which records MUST exist. Fetch live so
  // a record-set change on Resend's side (e.g. key rotation) is picked up too.
  const live = await getResendDomainById(domainId);
  if (!live.available || !live.domain) {
    return {
      tenantId,
      provisioned: true,
      checked: 0,
      repaired: 0,
      repairedRecords: [],
      skipped: live.error || "Resend domain unavailable",
    };
  }

  const required = live.domain.records ?? [];
  const { ids, created } = await syncRecords(required);

  if (created.length > 0) {
    console.warn(
      `[lp/branded-email-subdomain] DNS drift detected for tenant ${tenantId} ` +
        `(${subdomain || live.domain.name}): re-published ${created.length} ` +
        `missing/changed record(s): ${created.join(", ")}`,
    );
  }

  // Persist the reconciled id set only when it actually changed, so the remove
  // flow can still delete exactly what we own after a repair — and we avoid a
  // needless write on every clean (no-drift) pass.
  const changed =
    ids.length !== dnsRecordIds.length || ids.some((id, i) => id !== dnsRecordIds[i]);
  if (changed) {
    await persist(tenantId, {
      subdomain: subdomain || live.domain.name,
      domainId,
      dnsRecordIds: ids,
    });
  }

  return {
    tenantId,
    provisioned: true,
    checked: ids.length,
    repaired: created.length,
    repairedRecords: created,
  };
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
