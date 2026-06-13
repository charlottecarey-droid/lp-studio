import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { getSalesBrandContext, summarizeSalesBrandSetup } from "../../lib/salesBrandContext";
import { getResendDomainStatus } from "../../lib/resendDomainStatus";

const router = Router();

// ─── GET /sales/brand/segments ───────────────────────────────
// P0-A — loads the tenant's audience segments + their personas so the New
// Microsite picker can render the segment → persona hierarchy. Returns the
// shape the FE picker consumes:
//   [{ id, name, description, messagingAngle, personas: [{ id, name, role, painPoints, caresAbout }] }]
// Reads brand config directly (same lpBrandSettings.config the microsite
// generator reads). Tenant-scoped; fail-open with an empty list so the picker
// degrades to "no segment" rather than erroring.
interface BrandPersonaShape {
  id?: string;
  name?: string;
  role?: string;
  painPoints?: string[];
  caresAbout?: string[];
}
interface BrandSegmentShape {
  id?: string;
  name?: string;
  description?: string;
  messagingAngle?: string;
  personas?: BrandPersonaShape[];
}
router.get("/brand/segments", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const rows = await db
      .select({ config: lpBrandSettingsTable.config })
      .from(lpBrandSettingsTable)
      .where(eq(lpBrandSettingsTable.tenantId, tenantId))
      .limit(1);
    const config = (rows.length > 0 ? rows[0].config : {}) as { segments?: BrandSegmentShape[] };
    const segments = Array.isArray(config.segments) ? config.segments : [];
    const out = segments
      .filter((s) => (s?.id ?? "").trim() || (s?.name ?? "").trim())
      .map((s) => ({
        id: (s.id ?? "").trim() || (s.name ?? "").trim(),
        name: (s.name ?? "").trim() || (s.id ?? "").trim(),
        description: (s.description ?? "").trim(),
        messagingAngle: (s.messagingAngle ?? "").trim(),
        personas: (Array.isArray(s.personas) ? s.personas : [])
          .filter((p) => (p?.role ?? "").trim() || (p?.name ?? "").trim() || (p?.id ?? "").trim())
          .map((p) => ({
            id: (p.id ?? "").trim() || (p.role ?? "").trim() || (p.name ?? "").trim(),
            name: (p.name ?? "").trim() || (p.role ?? "").trim(),
            role: (p.role ?? "").trim(),
            painPoints: Array.isArray(p.painPoints) ? p.painPoints.filter((x) => typeof x === "string" && x.trim()) : [],
            caresAbout: Array.isArray(p.caresAbout) ? p.caresAbout.filter((x) => typeof x === "string" && x.trim()) : [],
          })),
      }));
    res.json({ segments: out });
  } catch (err) {
    console.error("GET /sales/brand/segments error:", err);
    // Fail-open: empty list keeps the picker usable (no segment selected).
    res.json({ segments: [] });
  }
});

// ─── GET /sales/brand-context ────────────────────────────────
// Returns the per-tenant Sales Console context (sender identity,
// AI prompt strings, value-prop pairs) plus a setup summary the UI
// uses to render the "Setup status" checklist on Brand Settings →
// Sales Console and the warning in QuickCampaignWizard.
//
// Also includes `domainVerification` — the live Resend DNS status for
// the tenant's sending domain (cached ~5min per tenant). The setup
// summary's `hasSendingDomain` requires both a configured domain AND
// a "verified" status, so the checklist treats pending DNS as not-done.
//
// Tenant-scoped via getTenantId — never returns another tenant's
// config. Safe defaults are returned when nothing is configured yet.
router.get("/brand-context", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const ctx = await getSalesBrandContext(tenantId);
    const baseSetup = summarizeSalesBrandSetup(ctx);
    const domainVerification = await getResendDomainStatus(tenantId, ctx.sendingDomain);
    // An unverified domain blocks real sends, so the checklist (and the
    // wizard guard) shouldn't count the row as "done" just because the
    // field is filled. Field-only state stays available as
    // `hasSendingDomainConfigured` for the UI to render the pill.
    const hasSendingDomainConfigured = baseSetup.hasSendingDomain;
    const hasSendingDomainVerified = domainVerification.status === "verified";
    const setup = {
      ...baseSetup,
      hasSendingDomain: hasSendingDomainConfigured && hasSendingDomainVerified,
      hasSendingDomainConfigured,
      hasSendingDomainVerified,
      isReadyToSend: baseSetup.isReadyToSend && hasSendingDomainVerified,
    };
    res.json({
      tenantId: ctx.tenantId,
      brandName: ctx.brandName,
      senderName: ctx.senderName,
      senderLocalPart: ctx.senderLocalPart,
      sendingDomain: ctx.sendingDomain,
      replyTo: ctx.replyTo,
      notificationsLocalPart: ctx.notificationsLocalPart,
      valuePropPairsCount: ctx.valuePropPairs.length,
      setup,
      domainVerification,
    });
  } catch (err) {
    console.error("GET /sales/brand-context error:", err);
    res.status(500).json({ error: "Failed to load brand context" });
  }
});

export default router;
