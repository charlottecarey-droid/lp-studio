import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesEmailSendsTable,
  salesEmailCampaignsTable,
  salesSignalsTable,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import { broadcastSignal } from "./signals";

const router = Router();

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

function verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
  if (!RESEND_WEBHOOK_SECRET || !signature) return !RESEND_WEBHOOK_SECRET;
  try {
    const expected = createHmac("sha256", RESEND_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");
    const sigHex = signature.replace(/^sha256=/, "");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sigHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { type?: string; message?: string };
    [k: string]: unknown;
  };
};

router.post("/resend", async (req, res): Promise<void> => {
  if (RESEND_WEBHOOK_SECRET) {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const signature = (req.headers["resend-signature"] as string | undefined)
      ?? (req.headers["x-resend-signature"] as string | undefined)
      ?? (req.headers["svix-signature"] as string | undefined);
    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn("Resend webhook: invalid signature rejected");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  const evt = (req.body ?? {}) as ResendEvent;
  const type = evt.type ?? "";
  const resendId = evt.data?.email_id ?? "";

  if (!type) {
    res.status(400).json({ error: "Missing event type" });
    return;
  }

  // Map the Resend email_id back to our send row via metadata.resendId.
  // Falls back to no-match (orphan event is just logged below).
  let send: typeof salesEmailSendsTable.$inferSelect | null = null;
  let tenantId: number | null = null;
  if (resendId) {
    const [row] = await db.select({
      send: salesEmailSendsTable,
      tenantId: salesEmailCampaignsTable.tenantId,
    })
      .from(salesEmailSendsTable)
      .leftJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
      .where(sql`${salesEmailSendsTable.metadata}->>'resendId' = ${resendId}`)
      .limit(1);
    if (row) {
      send = row.send;
      tenantId = row.tenantId;
    }
  }

  try {
    switch (type) {
      case "email.delivered": {
        if (send && send.status !== "opened" && send.status !== "clicked" && send.status !== "bounced") {
          await db.update(salesEmailSendsTable)
            .set({ status: "delivered" })
            .where(eq(salesEmailSendsTable.id, send.id));
        }
        break;
      }
      case "email.bounced": {
        if (send) {
          await db.update(salesEmailSendsTable)
            .set({
              status: "bounced",
              bouncedAt: new Date(),
              metadata: {
                ...(send.metadata as Record<string, unknown> | null ?? {}),
                bounce: evt.data?.bounce ?? null,
              },
            })
            .where(eq(salesEmailSendsTable.id, send.id));

          if (tenantId !== null) {
            const [sig] = await db.insert(salesSignalsTable).values({
              tenantId,
              contactId: send.contactId,
              hotlinkId: send.hotlinkId,
              type: "email_bounced",
              source: `Bounce: ${evt.data?.bounce?.type ?? "unknown"}`,
              metadata: {
                campaignId: send.campaignId,
                email: send.email,
                bounce: evt.data?.bounce ?? null,
              },
            }).returning();
            broadcastSignal(sig);
          }
        }
        break;
      }
      case "email.complained": {
        if (send) {
          await db.update(salesEmailSendsTable)
            .set({
              status: "complained",
              metadata: {
                ...(send.metadata as Record<string, unknown> | null ?? {}),
                complainedAt: new Date().toISOString(),
              },
            })
            .where(eq(salesEmailSendsTable.id, send.id));

          if (tenantId !== null) {
            const [sig] = await db.insert(salesSignalsTable).values({
              tenantId,
              contactId: send.contactId,
              hotlinkId: send.hotlinkId,
              type: "email_complained",
              source: "Spam complaint",
              metadata: { campaignId: send.campaignId, email: send.email },
            }).returning();
            broadcastSignal(sig);
          }
        }
        break;
      }
      case "email.delivery_delayed":
      case "email.sent":
        // No DB action — informational only.
        break;
      default:
        // Unknown event type — log and ack so Resend doesn't retry.
        logger.info({ type, resendId }, "Resend webhook: unhandled event type");
    }
  } catch (err) {
    logger.error({ err, type, resendId }, "Resend webhook handler error");
  }

  res.json({ ok: true });
});

export default router;
