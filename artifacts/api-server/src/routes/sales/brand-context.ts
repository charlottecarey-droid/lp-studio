import { Router } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { getSalesBrandContext, summarizeSalesBrandSetup } from "../../lib/salesBrandContext";

const router = Router();

// ─── GET /sales/brand-context ────────────────────────────────
// Returns the per-tenant Sales Console context (sender identity,
// AI prompt strings, value-prop pairs) plus a setup summary the UI
// uses to render the "Setup status" checklist on Brand Settings →
// Sales Console and the warning in QuickCampaignWizard.
//
// Tenant-scoped via getTenantId — never returns another tenant's
// config. Safe defaults are returned when nothing is configured yet.
router.get("/brand-context", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const ctx = await getSalesBrandContext(tenantId);
    const setup = summarizeSalesBrandSetup(ctx);
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
    });
  } catch (err) {
    console.error("GET /sales/brand-context error:", err);
    res.status(500).json({ error: "Failed to load brand context" });
  }
});

export default router;
