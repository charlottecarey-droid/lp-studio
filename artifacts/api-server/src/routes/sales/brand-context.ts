import { Router } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { getSalesBrandContext, summarizeSalesBrandSetup } from "../../lib/salesBrandContext";
import { getResendDomainStatus } from "../../lib/resendDomainStatus";

const router = Router();

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
