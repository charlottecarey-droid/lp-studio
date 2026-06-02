/**
 * Branded email subdomain self-serve (Tier 2 sending domain).
 *
 * Gated behind the `brandedEmailSubdomain` plan feature. Lets a paid tenant
 * auto-provision `{slug}.lpstudio.ai` as a verified sending domain without
 * ever touching DNS: we register it in Resend and publish the returned
 * SPF/DKIM/MX records into our own Cloudflare `lpstudio.ai` zone.
 *
 *   GET    /sales/branded-email  — live status (polled by the Settings pill)
 *   POST   /sales/branded-email  — provision the subdomain
 *   DELETE /sales/branded-email  — deprovision (Resend + CF cleanup)
 *
 * Until Resend reports the domain `verified`, the sender resolver keeps the
 * tenant on the Tier 1 shared default — so enabling this mid-campaign never
 * breaks sends. Once verified, getSalesBrandContext surfaces the subdomain as
 * the effective sending domain and the resolver routes through it.
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";
import { getTenantSlug } from "../../lib/tenantSender";
import { getZoneName, CloudflareError } from "../../lib/cloudflare";
import {
  buildBrandedSubdomainHost,
  provisionBrandedEmailDomain,
  deprovisionBrandedEmailDomain,
  BrandedEmailDomainError,
} from "../../lib/brandedEmailDomain";
import {
  getResendDomainById,
  type ResendDomainVerificationState,
} from "../../lib/resendDomainStatus";

const router = Router();

// Every branded-email endpoint requires the plan feature. The parent sales
// router already gates `salesConsole`; this adds the stricter Tier-2 gate.
router.use(requirePlanFeature("brandedEmailSubdomain"));

interface BrandedEmailConfig {
  brandedSubdomain: string;
  brandedSubdomainResendId: string;
  brandedSubdomainDnsRecordIds: string[];
  brandedSubdomainActive: boolean;
}

function readBrandedEmailConfig(config: Record<string, unknown>): BrandedEmailConfig {
  const sales = (config["salesConsole"] ?? {}) as Record<string, unknown>;
  const ids = sales["brandedSubdomainDnsRecordIds"];
  return {
    brandedSubdomain: typeof sales["brandedSubdomain"] === "string" ? sales["brandedSubdomain"] : "",
    brandedSubdomainResendId:
      typeof sales["brandedSubdomainResendId"] === "string" ? sales["brandedSubdomainResendId"] : "",
    brandedSubdomainDnsRecordIds: Array.isArray(ids)
      ? ids.filter((x): x is string => typeof x === "string")
      : [],
    brandedSubdomainActive: sales["brandedSubdomainActive"] === true,
  };
}

/**
 * Load the tenant's raw brand-settings row (config + row id for the update
 * WHERE clause). Returns null config when the tenant has no row yet.
 */
async function loadBrandRow(
  tenantId: number,
): Promise<{ id: number | null; config: Record<string, unknown> }> {
  const rows = await db
    .select({ id: lpBrandSettingsTable.id, config: lpBrandSettingsTable.config })
    .from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);
  if (rows.length === 0) return { id: null, config: {} };
  return { id: rows[0].id, config: (rows[0].config ?? {}) as Record<string, unknown> };
}

/** Merge `changes` into config.salesConsole and persist (insert or update). */
async function patchSalesConsole(
  tenantId: number,
  rowId: number | null,
  config: Record<string, unknown>,
  changes: Record<string, unknown>,
): Promise<void> {
  const sales = (config["salesConsole"] ?? {}) as Record<string, unknown>;
  const nextConfig = { ...config, salesConsole: { ...sales, ...changes } };
  if (rowId === null) {
    await db.insert(lpBrandSettingsTable).values({ tenantId, config: nextConfig });
  } else {
    await db
      .update(lpBrandSettingsTable)
      .set({ config: nextConfig })
      .where(and(eq(lpBrandSettingsTable.tenantId, tenantId), eq(lpBrandSettingsTable.id, rowId)));
  }
}

function statusPayload(args: {
  host: string;
  status: ResendDomainVerificationState;
  active: boolean;
}) {
  return {
    enabled: true,
    host: args.host,
    status: args.status,
    verified: args.status === "verified",
    active: args.active,
  };
}

// ─── GET /sales/branded-email ────────────────────────────────
// Live status for the Settings pill. Polls Resend by domain id and persists
// the verified flag so other reads don't need a Resend round-trip.
router.get("/branded-email", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const { id: rowId, config } = await loadBrandRow(tenantId);
    const cfg = readBrandedEmailConfig(config);
    if (!cfg.brandedSubdomain || !cfg.brandedSubdomainResendId) {
      res.json({ enabled: false });
      return;
    }
    const lookup = await getResendDomainById(cfg.brandedSubdomainResendId);
    if (!lookup.available || !lookup.domain) {
      // Couldn't reach Resend — report last-known active state without flipping.
      res.json(
        statusPayload({
          host: cfg.brandedSubdomain,
          status: "api_unavailable",
          active: cfg.brandedSubdomainActive,
        }),
      );
      return;
    }
    const status = lookup.domain.status;
    const active = status === "verified";
    if (active !== cfg.brandedSubdomainActive) {
      await patchSalesConsole(tenantId, rowId, config, { brandedSubdomainActive: active });
    }
    res.json(statusPayload({ host: cfg.brandedSubdomain, status, active }));
  } catch (err) {
    console.error("GET /sales/branded-email error:", err);
    res.status(500).json({ error: "Failed to load branded email status" });
  }
});

// ─── POST /sales/branded-email ───────────────────────────────
// Provision {slug}.lpstudio.ai in Resend + Cloudflare. Idempotent: if already
// provisioned, returns the current status instead of double-registering.
router.post("/branded-email", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const { id: rowId, config } = await loadBrandRow(tenantId);
    const existing = readBrandedEmailConfig(config);
    if (existing.brandedSubdomain && existing.brandedSubdomainResendId) {
      const lookup = await getResendDomainById(existing.brandedSubdomainResendId);
      const status = lookup.available && lookup.domain ? lookup.domain.status : "api_unavailable";
      res.json(statusPayload({
        host: existing.brandedSubdomain,
        status,
        active: status === "verified",
      }));
      return;
    }

    const slug = await getTenantSlug(tenantId);
    if (!slug) {
      res.status(409).json({ error: "Tenant has no slug; cannot build a branded subdomain." });
      return;
    }
    const zoneName = await getZoneName();
    const host = buildBrandedSubdomainHost(slug, zoneName);

    const result = await provisionBrandedEmailDomain(host);
    await patchSalesConsole(tenantId, rowId, config, {
      brandedSubdomain: result.host,
      brandedSubdomainResendId: result.resendId,
      brandedSubdomainDnsRecordIds: result.dnsRecordIds,
      brandedSubdomainActive: result.status === "verified",
    });
    res.json(statusPayload({
      host: result.host,
      status: result.status,
      active: result.status === "verified",
    }));
  } catch (err) {
    console.error("POST /sales/branded-email error:", err);
    if (err instanceof BrandedEmailDomainError) {
      res.status(502).json({ error: err.message });
      return;
    }
    if (err instanceof CloudflareError) {
      res.status(502).json({ error: `Cloudflare error: ${err.message}` });
      return;
    }
    res.status(500).json({ error: "Failed to provision branded email subdomain" });
  }
});

// ─── DELETE /sales/branded-email ─────────────────────────────
// Tear down the subdomain: remove the CF DNS records + the Resend domain, then
// clear the persisted config so the resolver reverts to the shared default.
router.delete("/branded-email", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const { id: rowId, config } = await loadBrandRow(tenantId);
    const cfg = readBrandedEmailConfig(config);
    if (!cfg.brandedSubdomain && !cfg.brandedSubdomainResendId) {
      res.json({ enabled: false });
      return;
    }
    await deprovisionBrandedEmailDomain({
      host: cfg.brandedSubdomain,
      resendId: cfg.brandedSubdomainResendId || null,
      dnsRecordIds: cfg.brandedSubdomainDnsRecordIds,
    });
    await patchSalesConsole(tenantId, rowId, config, {
      brandedSubdomain: "",
      brandedSubdomainResendId: "",
      brandedSubdomainDnsRecordIds: [],
      brandedSubdomainActive: false,
    });
    res.json({ enabled: false });
  } catch (err) {
    console.error("DELETE /sales/branded-email error:", err);
    if (err instanceof BrandedEmailDomainError || err instanceof CloudflareError) {
      res.status(502).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Failed to deprovision branded email subdomain" });
  }
});

export default router;
