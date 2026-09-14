import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesEmailSendsTable,
  salesEmailCampaignsTable,
  salesSignalsTable,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import { isLikelyBot } from "../../lib/emailTrackingHeuristics";
import { broadcastSignal } from "./signals";

const router = Router();

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

function verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
  if (!RESEND_WEBHOOK_SECRET) {
    // Fail CLOSED. In production the boot guard refuses to start without the
    // secret, so reaching here in prod means the env dropped out — refuse the
    // request loudly. In dev/test (no secret on purpose) we still reject so an
    // unsigned/forged webhook can never mutate send/signal state.
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_WEBHOOK_SECRET is not set in production — refusing to verify webhook");
    }
    logger.warn("Resend webhook secret not configured — rejecting webhook (fail-closed)");
    return false;
  }
  if (!signature) return false;
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
  // ALWAYS verify — never process an unsigned/unverified webhook in any
  // environment. verifyWebhookSignature fails closed when the secret is
  // missing (throws in prod, returns false in dev/test).
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const signature = (req.headers["resend-signature"] as string | undefined)
    ?? (req.headers["x-resend-signature"] as string | undefined)
    ?? (req.headers["svix-signature"] as string | undefined);
  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("Resend webhook: invalid signature rejected");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
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
        // Providers do not guarantee ordering — a delivered event can arrive
        // after the open it preceded. Never walk the status backwards.
        if (send && !["opened", "clicked", "bounced", "complained"].includes(send.status)) {
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
      // Opens and clicks: a BACKSTOP behind our own pixel and /track/click
      // redirect, not a replacement. Resend only emits these when open/click
      // tracking is enabled on the sending domain, and its own link rewriting
      // can swallow a click before our redirect ever fires — so without these
      // cases, a tenant on Resend-side tracking records nothing at all.
      //
      // Both are scoped `WHERE ... IS NULL` so first-event-wins is decided by
      // Postgres, not by a read-then-write race: whichever of the two paths
      // arrives first stamps the row, the other updates zero rows, and the
      // signal is emitted exactly once. Status only ever moves forward —
      // bounced/complained are terminal and a click outranks an open.
      case "email.opened": {
        if (send && tenantId !== null && !isLikelyBot(send.sentAt)) {
          const [updated] = await db.update(salesEmailSendsTable)
            .set({
              status: sql`CASE WHEN ${salesEmailSendsTable.status} IN ('bounced','complained','clicked') THEN ${salesEmailSendsTable.status} ELSE 'opened' END`,
              openedAt: new Date(),
            })
            .where(and(
              eq(salesEmailSendsTable.id, send.id),
              isNull(salesEmailSendsTable.openedAt),
            ))
            .returning();

          if (updated) {
            const [sig] = await db.insert(salesSignalsTable).values({
              tenantId,
              contactId: send.contactId,
              hotlinkId: send.hotlinkId,
              type: "email_open",
              source: `Send #${send.id}`,
              metadata: { campaignId: send.campaignId, email: send.email, via: "resend" },
            }).returning();
            broadcastSignal(sig);
          }
        }
        break;
      }
      case "email.clicked": {
        if (send && tenantId !== null && !isLikelyBot(send.sentAt)) {
          const [updated] = await db.update(salesEmailSendsTable)
            .set({
              status: sql`CASE WHEN ${salesEmailSendsTable.status} IN ('bounced','complained') THEN ${salesEmailSendsTable.status} ELSE 'clicked' END`,
              clickedAt: new Date(),
              // A click implies an open, which Apple Mail Privacy can suppress
              // entirely — backfill it rather than report clicks without opens.
              openedAt: sql`COALESCE(${salesEmailSendsTable.openedAt}, now())`,
            })
            .where(and(
              eq(salesEmailSendsTable.id, send.id),
              isNull(salesEmailSendsTable.clickedAt),
            ))
            .returning();

          if (updated) {
            const clickedUrl = typeof evt.data?.click === "object" && evt.data?.click !== null
              ? String((evt.data.click as Record<string, unknown>).link ?? "")
              : "";
            const [sig] = await db.insert(salesSignalsTable).values({
              tenantId,
              contactId: send.contactId,
              hotlinkId: send.hotlinkId,
              type: "email_click",
              source: clickedUrl || `Send #${send.id}`,
              metadata: { campaignId: send.campaignId, email: send.email, via: "resend" },
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
