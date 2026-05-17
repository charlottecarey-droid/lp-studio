import { Router } from "express";
import { getTenantId, requireAuth } from "../../middleware/requireAuth";
import { getSalesBrandContext, summarizeSalesBrandSetup } from "../../lib/salesBrandContext";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * GET /api/sales/brand-context
 * Returns the calling tenant's Sales Console config + a setup checklist
 * so the wizard UI can pre-fill sender fields and show "what's missing"
 * before a campaign can be sent.
 */
router.get("/brand-context", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const ctx = await getSalesBrandContext(tenantId);
    const checklist = summarizeSalesBrandSetup(ctx);
    res.json({
      brandName:             ctx.brandName,
      senderName:            ctx.senderName,
      senderLocalPart:       ctx.senderLocalPart,
      sendingDomain:         ctx.sendingDomain,
      replyTo:               ctx.replyTo,
      notificationsLocalPart: ctx.notificationsLocalPart,
      emailSignature:        ctx.emailSignature,
      emailFooter:           ctx.emailFooter,
      salesIntroLine:        ctx.salesIntroLine,
      briefBlurb:            ctx.briefBlurb,
      useBuiltInExemplars:   ctx.useBuiltInExemplars,
      customerNameRules:     ctx.customerNameRules,
      valuePropPairs:        ctx.valuePropPairs,
      checklist,
    });
  } catch (err) {
    logger.error({ err, tenantId }, "GET /sales/brand-context failed");
    res.status(500).json({ error: "Failed to load sales brand context" });
  }
});

export default router;
