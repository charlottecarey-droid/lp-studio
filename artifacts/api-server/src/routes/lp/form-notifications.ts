import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpFormNotificationsTable, lpPagesTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

// Validate webhook URL: must be HTTPS, not resolve to private/internal IPs, under 2048 chars
function validateWebhookUrl(url: string | null): { valid: boolean; error?: string } {
  if (!url) return { valid: true };

  if (url.length > 2048) {
    return { valid: false, error: "Webhook URL must be under 2048 characters" };
  }

  if (!url.startsWith("https://")) {
    return { valid: false, error: "Webhook URL must use HTTPS" };
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check for private/internal IPs
    if (/^localhost$|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(hostname)) {
      return { valid: false, error: "Webhook URL cannot resolve to private or internal IPs" };
    }
  } catch {
    return { valid: false, error: "Invalid webhook URL" };
  }

  return { valid: true };
}

// Confirms the page belongs to the caller's tenant. Returns true if OK,
// otherwise writes a 404 and returns false so the caller can bail.
async function assertPageInTenant(pageId: number, tenantId: number, res: import("express").Response): Promise<boolean> {
  const [page] = await db
    .select({ id: lpPagesTable.id })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId)));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return false;
  }
  return true;
}

router.get("/lp/pages/:id/notifications", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  if (!(await assertPageInTenant(id, tenantId, res))) return;

  const [notif] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, id));
  if (!notif) {
    res.json({
      pageId: id,
      emailRecipients: [],
      webhookUrl: null,
      marketoConfig: null,
      salesforceConfig: null,
      sendFollowUpToSubmitter: false,
      followUpTemplateId: null,
    });
    return;
  }
  res.json(notif);
});

router.put("/lp/pages/:id/notifications", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  if (!(await assertPageInTenant(id, tenantId, res))) return;

  const { emailRecipients, webhookUrl, marketoConfig, salesforceConfig, sendFollowUpToSubmitter, followUpTemplateId } = req.body as {
    emailRecipients?: string[];
    webhookUrl?: string | null;
    marketoConfig?: unknown | null;
    salesforceConfig?: unknown | null;
    sendFollowUpToSubmitter?: boolean;
    followUpTemplateId?: number | null;
  };

  // Validate webhook URL if provided
  if (webhookUrl !== undefined) {
    const validation = validateWebhookUrl(webhookUrl);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
  }

  const [existing] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, id));

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (emailRecipients !== undefined) updates.emailRecipients = emailRecipients;
    if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
    if (marketoConfig !== undefined) updates.marketoConfig = marketoConfig;
    if (salesforceConfig !== undefined) updates.salesforceConfig = salesforceConfig;
    if (sendFollowUpToSubmitter !== undefined) updates.sendFollowUpToSubmitter = sendFollowUpToSubmitter;
    if (followUpTemplateId !== undefined) updates.followUpTemplateId = followUpTemplateId;

    const [updated] = await db
      .update(lpFormNotificationsTable)
      .set(updates)
      .where(eq(lpFormNotificationsTable.pageId, id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(lpFormNotificationsTable)
      .values({
        pageId: id,
        emailRecipients: emailRecipients ?? [],
        webhookUrl: webhookUrl ?? null,
        marketoConfig: marketoConfig ?? null,
        salesforceConfig: salesforceConfig ?? null,
        sendFollowUpToSubmitter: sendFollowUpToSubmitter ?? false,
        followUpTemplateId: followUpTemplateId ?? null,
      })
      .returning();
    res.json(created);
  }
});

export default router;
