import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, salesBriefingsTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { aiErrorMessage } from "../../lib/ai-utils";
import { slackService } from "../../lib/slack-service";
import {
  generateAndPersistAccountBriefing,
  AccountNotFoundError,
} from "../../lib/briefing-service";

const router = Router();

// ─── Routes ─────────────────────────────────────────────────

// Get briefing for an account
router.get("/accounts/:accountId/briefing", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.accountId, Number(req.params.accountId)),
      ))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);
    if (!briefing) {
      res.json(null);
      return;
    }
    res.json(briefing);
  } catch (err) {
    console.error("GET briefing error:", err);
    res.status(500).json({ error: "Failed to load briefing" });
  }
});

// Generate or refresh briefing for an account
router.post("/accounts/:accountId/briefing", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const accountId = Number(req.params.accountId);
  if (isNaN(accountId) || accountId <= 0) {
    res.status(400).json({ error: "Invalid accountId" });
    return;
  }
  try {
    const { briefing, account } = await generateAndPersistAccountBriefing({ tenantId, accountId });

    // Slack notifier (outbound-only): post a Block Kit "AI Briefing ready"
    // message to the tenant's configured channel (fire-and-forget, gated on the
    // per-event toggle). Never blocks the response. Fired route-only so the
    // inline microsite generation path never double-notifies.
    const briefingData = (briefing.briefingData as Record<string, unknown> | undefined) ?? {};
    slackService.getActiveConnection(tenantId).then(slackConn => {
      if (slackConn && slackConn.eventToggles.ai_briefing !== false) {
        const summary = typeof briefingData.summary === "string" ? briefingData.summary : null;
        const msg = slackService.buildBriefingBlocks({
          accountName: account.name,
          summary,
          generatedAt: new Date().toISOString(),
        });
        slackService.postMessage(tenantId, msg).catch(() => {/* non-blocking */});
      }
    }).catch(() => {/* non-blocking */});

    res.json(briefing);
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      res.status(404).json({ error: "Account not found for this tenant" });
      return;
    }
    // AI synthesis is the only step that *must* succeed — surface a precise
    // error to the client instead of a generic 500.
    const { status, message } = aiErrorMessage(err, "Failed to generate briefing");
    console.error("[briefings] generation failed:", err);
    res.status(status).json({ error: message });
  }
});

export default router;
