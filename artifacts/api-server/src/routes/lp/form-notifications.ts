import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpFormNotificationsTable } from "@workspace/db";

const router = Router();

router.get("/lp/pages/:id/notifications", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const [notif] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, id));
  if (!notif) {
    res.json({
      pageId: id,
      emailRecipients: [],
      webhookUrl: null,
      marketoConfig: null,
      salesforceConfig: null,
    });
    return;
  }
  res.json(notif);
});

router.put("/lp/pages/:id/notifications", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const { emailRecipients, webhookUrl, marketoConfig, salesforceConfig } = req.body as {
    emailRecipients?: string[];
    webhookUrl?: string | null;
    marketoConfig?: unknown | null;
    salesforceConfig?: unknown | null;
  };

  const [existing] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, id));

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (emailRecipients !== undefined) updates.emailRecipients = emailRecipients;
    if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
    if (marketoConfig !== undefined) updates.marketoConfig = marketoConfig;
    if (salesforceConfig !== undefined) updates.salesforceConfig = salesforceConfig;

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
      })
      .returning();
    res.json(created);
  }
});

export default router;
