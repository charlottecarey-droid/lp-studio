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
import { eq, and } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";
import { Router } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";
import { deriveBrandedSubdomain, getTenantSlug } from "../../lib/tenantSender";
import {
  createResendDomain,
  getResendDomainById,
  deleteResendDomain,
  type ResendDomainVerificationState,
  type ResendDnsRecord,
} from "../../lib/resendDomainStatus";
import { CloudflareError, createDnsRecord, updateDnsRecord, findDnsRecords, deleteDnsRecord } from "../../lib/cloudflare";
import {
  readBrandedSubdomainConfig,
  persistBrandedSubdomain,
  publishBrandedSubdomainRecords,
  unpublishBrandedSubdomainRecords,
  deprovisionBrandedEmailSubdomain,
} from "../../lib/brandedEmailSubdomain";

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

/** Parse a Resend TTL string ("Auto" / "86400") into a Cloudflare TTL (1 = auto). */
function parseTtl(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

interface SyncOutcome {
  /** Cloudflare record ids that now back the subdomain (reused + created/updated). */
  ids: string[];
  /** Human-readable "<TYPE> <name>" of records we had to create or correct. */
  repaired: string[];
}

/**
 * Reconcile a set of Resend-required DNS records against what's live in our
 * Cloudflare zone, repairing any drift. Ownership-first and idempotent per
 * record — we only ever reuse or modify a record we already OWN (its id is in
 * `ownedIds`):
 *
 *   - we own a record of this name+type with the SAME content → reuse it, no-op;
 *   - we own a record of this name+type with a CHANGED value (edited
 *     out-of-band) → UPDATE it in place (Cloudflare PUT) to the correct value;
 *   - we own no record of this name+type → CREATE our own.
 *
 * The last two cases are recorded as repairs. A record we don't own that merely
 * shares the name+type (a stray/unrelated collision) is never touched — not
 * mutated, and not even adopted by id (adopting it would let a later deprovision
 * delete a record we didn't create). This keeps the guarantee that reconcile
 * never touches records outside the tenant's required set. Throws on the first
 * hard Cloudflare failure so the provision path can roll back.
 */
async function syncRecords(
  records: ResendDnsRecord[],
  ownedIds: string[] = [],
): Promise<SyncOutcome> {
  const owned = new Set(ownedIds);
  const ids: string[] = [];
  const repaired: string[] = [];
  for (const rec of records) {
    const type = (rec.type ?? "").toUpperCase();
    const name = (rec.name ?? "").trim();
    const content = (rec.value ?? "").trim();
    if (!type || !name || !content) continue;

    const recordInput = {
      type,
      name,
      content,
      ttl: parseTtl(rec.ttl),
      ...(typeof rec.priority === "number" ? { priority: rec.priority } : {}),
      comment: "LP Studio branded email subdomain (auto-provisioned)",
    };

    // Only ever consider a record we own. An unowned same-name+type record is
    // left entirely alone, even when its content is already correct.
    const existing = await findDnsRecords({ name, type });
    const ownedMatch = existing.find((e) => owned.has(e.id));
    if (ownedMatch) {
      if (ownedMatch.content === content) {
        ids.push(ownedMatch.id);
        continue;
      }
      // Value drift on our own record → correct it in place (no duplicate).
      const updated = await updateDnsRecord(ownedMatch.id, recordInput);
      ids.push(updated.id);
      repaired.push(`${type} ${name}`);
      continue;
    }

    // We own no record of this name+type → create our own correct record.
    const rec2 = await createDnsRecord(recordInput);
    ids.push(rec2.id);
    repaired.push(`${type} ${name}`);
  }
  return { ids, repaired };
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
  const { subdomain, domainId, dnsRecordIds } = await readBrandedSubdomainConfig(tenantId);
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
  const { ids, repaired } = await syncRecords(required, dnsRecordIds);

  if (repaired.length > 0) {
    console.warn(
      `[lp/branded-email-subdomain] DNS drift detected for tenant ${tenantId} ` +
        `(${subdomain || live.domain.name}): repaired ${repaired.length} ` +
        `missing/changed record(s): ${repaired.join(", ")}`,
    );
  }

  // Persist the reconciled id set only when it actually changed, so the remove
  // flow can still delete exactly what we own after a repair — and we avoid a
  // needless write on every clean (no-drift) pass.
  const changed =
    ids.length !== dnsRecordIds.length || ids.some((id, i) => id !== dnsRecordIds[i]);
  if (changed) {
    await persistBrandedSubdomain(tenantId, {
      subdomain: subdomain || live.domain.name,
      domainId,
      dnsRecordIds: ids,
    });
  }

  return {
    tenantId,
    provisioned: true,
    checked: ids.length,
    repaired: repaired.length,
    repairedRecords: repaired,
  };
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
    const { subdomain, domainId } = await readBrandedSubdomainConfig(tenantId);
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

    const existing = await readBrandedSubdomainConfig(tenantId);
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
      dnsRecordIds = await publishBrandedSubdomainRecords(created.domain.records ?? []);
    } catch (dnsErr) {
      await unpublishBrandedSubdomainRecords(dnsRecordIds);
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

    // Stamp the provision time (the background sweep's staleness clock) and the
    // last-observed verified state so the retirement poller has a baseline.
    await persistBrandedSubdomain(tenantId, {
      subdomain: created.domain.name,
      domainId: created.domain.id,
      dnsRecordIds,
      provisionedAt: new Date().toISOString(),
      active: created.domain.status === "verified",
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
    const { subdomain, domainId } = await readBrandedSubdomainConfig(tenantId);
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
    // Best-effort teardown via the single shared deprovision path (also used by
    // the background retirement sweep) — clearing config is the safety-critical
    // step, so we always reach it even if the Resend/Cloudflare deletes fail.
    await deprovisionBrandedEmailSubdomain(tenantId);

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
