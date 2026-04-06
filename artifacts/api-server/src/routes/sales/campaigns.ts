import { getTenantId, requirePermission } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import {
  salesEmailCampaignsTable,
  salesEmailSendsTable,
  salesEmailTemplatesTable,
  salesContactsTable,
  salesAccountsTable,
  salesSignalsTable,
  salesHotlinksTable,
} from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { broadcastSignal } from "./signals";
import { sfdcService } from "../../lib/sfdc-service";
import { logger } from "../../lib/logger";

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN ?? "ent.meetdandy.com";
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? "sales@meetdandy.com";

// 1x1 transparent GIF pixel for open tracking
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// ─── Unsubscribe token helpers ─────────────────────────────
const UNSUB_SECRET = process.env.UNSUB_SECRET ?? process.env.RESEND_API_KEY ?? "dandy-unsub-secret";
const UNSUB_TOKEN_EXPIRY_DAYS = 30;

function makeUnsubToken(contactId: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + (UNSUB_TOKEN_EXPIRY_DAYS * 24 * 60 * 60);
  const mac = createHmac("sha256", UNSUB_SECRET).update(`${contactId}.${expiresAt}`).digest("hex");
  return Buffer.from(`${contactId}.${expiresAt}.${mac}`).toString("base64url");
}

function verifyUnsubToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;

    const [idStr, expiryStr, mac] = parts;
    const contactId = parseInt(idStr, 10);
    const expiresAt = parseInt(expiryStr, 10);

    if (isNaN(contactId) || isNaN(expiresAt)) return null;

    // Check if token has expired
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) return null;

    const expected = createHmac("sha256", UNSUB_SECRET).update(`${contactId}.${expiresAt}`).digest("hex");
    return mac === expected ? contactId : null;
  } catch {
    return null;
  }
}

// ─── GET /sales/unsubscribe?token=... ─────────────────────
router.get("/unsubscribe", async (req, res): Promise<void> => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).send("<h2>Invalid unsubscribe link.</h2>");
    return;
  }
  const contactId = verifyUnsubToken(token);
  if (!contactId) {
    res.status(400).send("<h2>Invalid or expired unsubscribe link.</h2>");
    return;
  }
  try {
    await db.update(salesContactsTable)
      .set({ status: "unsubscribed" })
      .where(eq(salesContactsTable.id, contactId));
    res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafb}
.box{text-align:center;padding:48px;max-width:400px}h1{color:#003A30;margin-bottom:12px}p{color:#555;line-height:1.6}</style></head>
<body><div class="box"><h1>You've been unsubscribed</h1>
<p>You won't receive any more emails from this sender. If this was a mistake, please reply to any previous email to re-subscribe.</p></div></body></html>`);
  } catch {
    res.status(500).send("<h2>Something went wrong. Please try again.</h2>");
  }
});

// ─── Utility functions ─────────────────────────────────────

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [k, v] of Object.entries(vars)) result = result.split(k).join(v);
  return result;
}

function appendUtms(html: string, utmParams: string): string {
  if (!utmParams) return html;
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url: string) => {
    const sep = url.includes("?") ? "&" : "?";
    return `href="${url}${sep}${utmParams}"`;
  });
}

function injectTrackingPixel(html: string, trackUrl: string): string {
  const pixel = `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
  return html.includes("</body>") ? html.replace("</body>", pixel + "</body>") : html + pixel;
}

async function sendViaResend(payload: {
  from: string;
  reply_to: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "No RESEND_API_KEY" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: body };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Campaign CRUD ──────────────────────────────────────────

router.get("/campaigns", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const campaigns = await db
      .select()
      .from(salesEmailCampaignsTable)
      .where(eq(salesEmailCampaignsTable.tenantId, tenantId))
      .orderBy(desc(salesEmailCampaignsTable.updatedAt));
    res.json(campaigns);
  } catch (err) {
    logger.error({ err }, "GET /sales/campaigns error");
    res.status(500).json({ error: "Failed to load campaigns" });
  }
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [campaign] = await db
      .select()
      .from(salesEmailCampaignsTable)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))));
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Enrich with template, sends, and account
    const [template] = campaign.templateId
      ? await db.select().from(salesEmailTemplatesTable).where(eq(salesEmailTemplatesTable.id, campaign.templateId))
      : [null];
    const sends = await db.select({
      id: salesEmailSendsTable.id,
      contactId: salesEmailSendsTable.contactId,
      email: salesEmailSendsTable.email,
      status: salesEmailSendsTable.status,
      sentAt: salesEmailSendsTable.sentAt,
      openedAt: salesEmailSendsTable.openedAt,
      clickedAt: salesEmailSendsTable.clickedAt,
      bouncedAt: salesEmailSendsTable.bouncedAt,
      contactFirst: salesContactsTable.firstName,
      contactLast: salesContactsTable.lastName,
      accountName: salesAccountsTable.name,
    })
      .from(salesEmailSendsTable)
      .leftJoin(salesContactsTable, eq(salesEmailSendsTable.contactId, salesContactsTable.id))
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(eq(salesEmailSendsTable.campaignId, campaign.id))
      .orderBy(desc(salesEmailSendsTable.createdAt));
    const account = campaign.accountId
      ? (await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, campaign.accountId)))[0] ?? null
      : null;

    res.json({ ...campaign, template, sends, account });
  } catch (err) {
    logger.error({ err }, "GET /sales/campaigns/:id error");
    res.status(500).json({ error: "Failed to load campaign" });
  }
});

router.post("/campaigns", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, templateId, accountId, status, scheduledAt, metadata } = req.body;
  if (!name || !templateId) {
    res.status(400).json({ error: "name and templateId are required" });
    return;
  }
  if (typeof name !== "string" || name.length > 255) {
    res.status(400).json({ error: "name must be a string under 255 characters" });
    return;
  }
  if (isNaN(Number(templateId))) {
    res.status(400).json({ error: "templateId must be a number" });
    return;
  }
  const allowedStatuses = ["draft", "scheduled", "sending", "sent", "paused"];
  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(", ")}` });
    return;
  }
  // Reject oversized metadata (prevent payload bombs)
  if (metadata && JSON.stringify(metadata).length > 10000) {
    res.status(400).json({ error: "metadata exceeds maximum size" });
    return;
  }
  try {
    const [campaign] = await db
      .insert(salesEmailCampaignsTable)
      .values({
        tenantId,
        name: name.slice(0, 255),
        templateId: Number(templateId),
        accountId: accountId ? Number(accountId) : null,
        status: status ?? "draft",
        scheduledAt: scheduledAt ?? null,
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(campaign);
  } catch (err) {
    logger.error({ err }, "POST /sales/campaigns error");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─── Clone campaign ────────────────────────────────────────
router.post("/campaigns/:id/clone", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [original] = await db.select().from(salesEmailCampaignsTable)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))));
    if (!original) { res.status(404).json({ error: "Campaign not found" }); return; }
    const [clone] = await db.insert(salesEmailCampaignsTable).values({
      tenantId,
      name: `${original.name} (copy)`,
      templateId: original.templateId,
      accountId: original.accountId,
      status: "draft",
      metadata: original.metadata ?? {},
    }).returning();
    res.status(201).json(clone);
  } catch (err) {
    logger.error({ err }, "POST /sales/campaigns/:id/clone error");
    res.status(500).json({ error: "Failed to clone campaign" });
  }
});

router.patch("/campaigns/:id", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const updates: Record<string, unknown> = {};
    const fields = ["name", "templateId", "accountId", "status", "scheduledAt", "recipientCount", "metadata"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [updated] = await db
      .update(salesEmailCampaignsTable)
      .set(updates)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))))
      .returning();
    if (!updated) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /sales/campaigns/:id error");
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

router.delete("/campaigns/:id", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [deleted] = await db
      .delete(salesEmailCampaignsTable)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /sales/campaigns/:id error");
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// ─── Campaign Send ──────────────────────────────────────────

router.post("/campaigns/:id/send", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const campaignId = Number(req.params.id);
  try {
    // Load campaign
    const [campaign] = await db.select().from(salesEmailCampaignsTable)
      .where(eq(salesEmailCampaignsTable.id, campaignId));
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Load template
    const [template] = await db.select().from(salesEmailTemplatesTable)
      .where(eq(salesEmailTemplatesTable.id, campaign.templateId));
    if (!template) { res.status(400).json({ error: "Template not found" }); return; }

    // Load contacts — batch query instead of N+1 loop
    const contactIds: number[] = (campaign.metadata as any)?.contactIds ?? [];
    let contacts;
    if (contactIds.length > 0) {
      contacts = await db.select().from(salesContactsTable)
        .where(inArray(salesContactsTable.id, contactIds));
    } else if (campaign.accountId) {
      contacts = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.accountId, campaign.accountId));
    } else {
      res.status(400).json({ error: "No contacts specified for campaign" });
      return;
    }

    // Filter to contacts with emails and active status
    const withEmail = contacts.filter(c => c.email && c.status === "active");
    if (withEmail.length === 0) {
      res.status(400).json({ error: "No contacts with email addresses to send to" });
      return;
    }

    // Idempotency guard: skip contacts already sent to in this campaign
    const existingSends = await db.select({ contactId: salesEmailSendsTable.contactId })
      .from(salesEmailSendsTable)
      .where(and(
        eq(salesEmailSendsTable.campaignId, campaignId),
        eq(salesEmailSendsTable.status, "sent"),
      ));
    const alreadySentIds = new Set(existingSends.map(s => s.contactId));
    const sendable = withEmail.filter(c => !alreadySentIds.has(c.id));
    const skippedCount = withEmail.length - sendable.length;
    if (sendable.length === 0) {
      res.status(400).json({ error: `All ${withEmail.length} contacts have already been sent to in this campaign` });
      return;
    }

    // Batch-load all hotlinks for sendable contacts (eliminates N+1 in send loop)
    const sendableIds = sendable.map(c => c.id);
    const allHotlinks = await db.select().from(salesHotlinksTable)
      .where(inArray(salesHotlinksTable.contactId, sendableIds));
    const hotlinkByContactId = new Map(allHotlinks.map(h => [h.contactId, h]));

    // Batch-load accounts for {{company}} variable
    const accountIds = [...new Set(sendable.map(c => c.accountId).filter((id): id is number => id != null))];
    const allAccounts = accountIds.length > 0
      ? await db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name })
          .from(salesAccountsTable)
          .where(inArray(salesAccountsTable.id, accountIds))
      : [];
    const accountNameById = new Map(allAccounts.map(a => [a.id, a.name]));

    // Mark campaign as sending
    await db.update(salesEmailCampaignsTable)
      .set({ status: "sending", recipientCount: sendable.length })
      .where(eq(salesEmailCampaignsTable.id, campaignId));

    const host = `${req.protocol}://${req.get("host")}`;
    const senderName = (campaign.metadata as any)?.senderName ?? "Dandy";
    const senderLocal = (campaign.metadata as any)?.senderEmail ?? "partnerships";

    let sent = 0, failed = 0;
    const sendRecords: Array<{
      campaignId: number; contactId: number; hotlinkId: number | null;
      email: string; status: string; sentAt: Date | null; metadata: Record<string, unknown>;
    }> = [];

    for (const contact of sendable) {
      const unsubUrl = `${host}/api/sales/unsubscribe?token=${makeUnsubToken(contact.id)}`;
      const companyName = contact.accountId ? (accountNameById.get(contact.accountId) ?? "") : "";
      const vars: Record<string, string> = {
        "{{first_name}}": contact.firstName ?? "",
        "{{last_name}}": contact.lastName ?? "",
        "{{company}}": companyName,
        "{{sender_name}}": senderName,
        "{{email}}": contact.email!,
        "{{unsubscribe_url}}": unsubUrl,
        "{{microsite_url}}": "", // fallback: replaced below if hotlink exists
      };

      // Build microsite URL if hotlink exists (pre-loaded batch)
      const hotlink = hotlinkByContactId.get(contact.id);
      if (hotlink) {
        vars["{{microsite_url}}"] = `${host}/p/${hotlink.token}`;
      }

      const subject = replaceVars(template.subject, vars);

      // Build email body — plain templates use bodyText, styled use bodyHtml
      let emailHtml: string;
      if (template.format === "plain") {
        const plainText = replaceVars(template.bodyText ?? "", vars);
        // Convert plain text to HTML preserving line breaks (escape HTML entities first)
        const escaped = plainText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        emailHtml = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap;padding:20px;">${escaped}</div>`;
      } else {
        emailHtml = replaceVars(template.bodyHtml, vars);
      }

      const payload = {
        from: `${senderName} <${senderLocal}@${SENDER_DOMAIN}>`,
        reply_to: DEFAULT_REPLY_TO,
        to: [contact.email!],
        subject,
        html: emailHtml,
      };

      const result = await sendViaResend(payload);

      sendRecords.push({
        campaignId,
        contactId: contact.id,
        hotlinkId: hotlink?.id ?? null,
        email: contact.email!,
        status: result.ok ? "sent" : "failed",
        sentAt: result.ok ? new Date() : null,
        metadata: result.ok ? {} : { error: result.error },
      });

      if (result.ok) {
        sent++;
        // Create signal for email sent
        const [sig1] = await db.insert(salesSignalsTable).values({
          tenantId,
          accountId: contact.accountId,
          contactId: contact.id,
          hotlinkId: hotlink?.id ?? null,
          type: "email_sent",
          source: `Campaign: ${campaign.name}`,
          metadata: { campaignId, templateId: template.id },
        }).returning();
        broadcastSignal(sig1);

        // SFDC write-back: log email as Activity (fire-and-forget)
        if (contact.salesforceId) {
          sfdcService.getActiveConnection().then(conn => {
            if (conn) {
              sfdcService.logEmailActivity(conn.id, {
                contactSalesforceId: contact.salesforceId!,
                subject,
                campaignName: campaign.name,
              }).catch(() => {/* non-blocking */});
            }
          }).catch(() => {/* non-blocking */});
        }
      } else {
        failed++;
      }

      // Rate limit: 200ms delay between sends for larger campaigns
      if (sendable.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Batch insert send records
    if (sendRecords.length > 0) {
      await db.insert(salesEmailSendsTable).values(sendRecords);
    }

    // Mark campaign as sent
    await db.update(salesEmailCampaignsTable)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(salesEmailCampaignsTable.id, campaignId));

    res.json({ sent, failed, skipped: skippedCount, total: sendable.length + skippedCount });
  } catch (err) {
    logger.error({ err }, "POST /sales/campaigns/:id/send error");
    res.status(500).json({ error: "Failed to send campaign" });
  }
});

// ─── Email send records ─────────────────────────────────────

router.get("/campaigns/:id/sends", async (req, res): Promise<void> => {
  try {
    const sends = await db.select().from(salesEmailSendsTable)
      .where(eq(salesEmailSendsTable.campaignId, Number(req.params.id)))
      .orderBy(desc(salesEmailSendsTable.createdAt));
    res.json(sends);
  } catch (err) {
    logger.error({ err }, "GET /sales/campaigns/:id/sends error");
    res.status(500).json({ error: "Failed to load sends" });
  }
});

// ─── Email tracking endpoints ───────────────────────────────

router.get("/track/open", async (req, res): Promise<void> => {
  const id = req.query.id as string;
  if (id) {
    try {
      await db.update(salesEmailSendsTable)
        .set({ status: "opened", openedAt: new Date() })
        .where(eq(salesEmailSendsTable.id, Number(id)));

      // Get the send record and campaign to create a signal
      const sendWithCampaign = await db.select({
        send: salesEmailSendsTable,
        tenantId: salesEmailCampaignsTable.tenantId,
      }).from(salesEmailSendsTable)
        .leftJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
        .where(eq(salesEmailSendsTable.id, Number(id)));
      if (sendWithCampaign.length > 0) {
        const { send, tenantId } = sendWithCampaign[0];
        const [sig2] = await db.insert(salesSignalsTable).values({
          tenantId: tenantId ?? 0, // fallback to 0 if no campaign
          contactId: send.contactId,
          hotlinkId: send.hotlinkId,
          type: "email_open",
          source: `Send #${send.id}`,
          metadata: { campaignId: send.campaignId, email: send.email },
        }).returning();
        broadcastSignal(sig2);
      }
    } catch (err) {
      logger.error({ err }, "Tracking pixel error");
    }
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
  res.send(PIXEL);
});

router.get("/track/click", async (req, res): Promise<void> => {
  const { sendId, url: destination } = req.query as Record<string, string>;
  if (!destination) { res.status(400).send("Missing url"); return; }

  if (sendId) {
    try {
      await db.update(salesEmailSendsTable)
        .set({ status: "clicked", clickedAt: new Date() })
        .where(eq(salesEmailSendsTable.id, Number(sendId)));

      const sendWithCampaign = await db.select({
        send: salesEmailSendsTable,
        tenantId: salesEmailCampaignsTable.tenantId,
      }).from(salesEmailSendsTable)
        .leftJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
        .where(eq(salesEmailSendsTable.id, Number(sendId)));
      if (sendWithCampaign.length > 0) {
        const { send, tenantId } = sendWithCampaign[0];
        const [sig3] = await db.insert(salesSignalsTable).values({
          tenantId: tenantId ?? 0, // fallback to 0 if no campaign
          contactId: send.contactId,
          hotlinkId: send.hotlinkId,
          type: "email_click",
          source: destination,
          metadata: { campaignId: send.campaignId, email: send.email },
        }).returning();
        broadcastSignal(sig3);
      }
    } catch (err) {
      logger.error({ err }, "Click tracking error");
    }
  }
  res.redirect(302, destination);
});

// ─── Hotlink-based email open tracking (for Campaign Pages) ──────────────────

router.get("/track/open-hotlink", async (req, res): Promise<void> => {
  const hotlinkId = req.query.h as string;
  if (hotlinkId) {
    try {
      const hotlinkWithPage = await db.select({
        hotlink: salesHotlinksTable,
        tenantId: lpPagesTable.tenantId,
      }).from(salesHotlinksTable)
        .leftJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
        .where(eq(salesHotlinksTable.id, Number(hotlinkId)));
      if (hotlinkWithPage.length > 0) {
        const { hotlink, tenantId } = hotlinkWithPage[0];
        if (hotlink && hotlink.contactId) {
          const [contact] = await db.select({ accountId: salesContactsTable.accountId })
            .from(salesContactsTable)
            .where(eq(salesContactsTable.id, hotlink.contactId));
          const [page] = await db.select({ title: lpPagesTable.title })
            .from(lpPagesTable)
            .where(eq(lpPagesTable.id, hotlink.pageId));
          await db.insert(salesSignalsTable).values({
            tenantId: tenantId ?? 0,
            accountId: contact?.accountId ?? null,
            contactId: hotlink.contactId,
            hotlinkId: hotlink.id,
            type: "email_open",
            source: page?.title ?? "Campaign Page",
            metadata: { pageId: hotlink.pageId },
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "Hotlink open tracking error");
    }
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
  res.send(PIXEL);
});

// ─── All sends (with contact + campaign info joined) ─────────────────────────

router.get("/sends", async (req, res): Promise<void> => {
  const campaignIdFilter = req.query.campaignId ? Number(req.query.campaignId) : undefined;
  const limitNum = Math.min(Number(req.query.limit ?? 300), 500);

  try {
    const rows = await db
      .select({
        id: salesEmailSendsTable.id,
        campaignId: salesEmailSendsTable.campaignId,
        contactId: salesEmailSendsTable.contactId,
        email: salesEmailSendsTable.email,
        status: salesEmailSendsTable.status,
        sentAt: salesEmailSendsTable.sentAt,
        openedAt: salesEmailSendsTable.openedAt,
        clickedAt: salesEmailSendsTable.clickedAt,
        bouncedAt: salesEmailSendsTable.bouncedAt,
        createdAt: salesEmailSendsTable.createdAt,
        contactFirstName: salesContactsTable.firstName,
        contactLastName: salesContactsTable.lastName,
        accountId: salesAccountsTable.id,
        accountName: salesAccountsTable.name,
        campaignName: salesEmailCampaignsTable.name,
      })
      .from(salesEmailSendsTable)
      .leftJoin(salesContactsTable, eq(salesEmailSendsTable.contactId, salesContactsTable.id))
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .leftJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
      .orderBy(desc(salesEmailSendsTable.createdAt))
      .limit(limitNum);

    const filtered = campaignIdFilter
      ? rows.filter(r => r.campaignId === campaignIdFilter)
      : rows;

    res.json(filtered);
  } catch (err) {
    logger.error({ err }, "GET /sales/sends error");
    res.status(500).json({ error: "Failed to load sends" });
  }
});

// ─── Hotlink-based email click tracking (for Campaign Pages) ─────────────────

router.get("/track/click-hotlink", async (req, res): Promise<void> => {
  const { h: hotlinkId, url: destination } = req.query as Record<string, string>;
  if (!destination) { res.status(400).send("Missing url"); return; }

  if (hotlinkId) {
    try {
      const hotlinkWithPage = await db.select({
        hotlink: salesHotlinksTable,
        tenantId: lpPagesTable.tenantId,
      }).from(salesHotlinksTable)
        .leftJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
        .where(eq(salesHotlinksTable.id, Number(hotlinkId)));
      if (hotlinkWithPage.length > 0) {
        const { hotlink, tenantId } = hotlinkWithPage[0];
        if (hotlink && hotlink.contactId) {
          const [contact] = await db.select({ accountId: salesContactsTable.accountId })
            .from(salesContactsTable)
            .where(eq(salesContactsTable.id, hotlink.contactId));
          const [page] = await db.select({ title: lpPagesTable.title })
            .from(lpPagesTable)
            .where(eq(lpPagesTable.id, hotlink.pageId));
          await db.insert(salesSignalsTable).values({
            tenantId: tenantId ?? 0,
            accountId: contact?.accountId ?? null,
            contactId: hotlink.contactId,
            hotlinkId: hotlink.id,
            type: "email_click",
            source: page?.title ?? "Campaign Page",
            metadata: { pageId: hotlink.pageId, destination },
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "Hotlink click tracking error");
    }
  }
  res.redirect(302, destination);
});

// ─── Single send (one-off email to a contact) ──────────────

router.post("/send-email", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { contactId, subject, bodyHtml, bodyText, senderName, senderEmail, replyTo } = req.body;
  if (!contactId || !subject || (!bodyHtml && !bodyText)) {
    res.status(400).json({ error: "contactId, subject, and either bodyHtml or bodyText are required" });
    return;
  }

  try {
    const [contact] = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.id, Number(contactId)));
    if (!contact?.email) {
      res.status(400).json({ error: "Contact has no email address" });
      return;
    }

    const fromName = senderName ?? "Dandy";
    const fromLocal = senderEmail ?? "partnerships";
    const replyToAddress = replyTo ?? DEFAULT_REPLY_TO;

    // Fetch account name for {{company}}
    let companyName = "";
    if (contact.accountId) {
      const [account] = await db.select({ name: salesAccountsTable.name })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, contact.accountId));
      companyName = account?.name ?? "";
    }

    const host = `${req.protocol}://${req.get("host")}`;
    const vars: Record<string, string> = {
      "{{first_name}}": contact.firstName ?? "",
      "{{last_name}}": contact.lastName ?? "",
      "{{company}}": companyName,
      "{{sender_name}}": fromName,
      "{{email}}": contact.email,
      "{{unsubscribe_url}}": `${host}/api/sales/unsubscribe?token=${makeUnsubToken(contact.id)}`,
    };

    // Check for hotlink
    const [hotlink] = await db.select().from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.contactId, contact.id));
    if (hotlink) {
      vars["{{microsite_url}}"] = `${host}/p/${hotlink.token}`;
    }

    const renderedSubject = replaceVars(subject, vars);

    // Support both HTML and plain-text bodies
    const htmlBody = bodyHtml
      ? replaceVars(bodyHtml, vars)
      : `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap">${replaceVars(bodyText, vars)}</div>`;
    const textBody = bodyText ? replaceVars(bodyText, vars) : undefined;

    const result = await sendViaResend({
      from: `${fromName} <${fromLocal}@${SENDER_DOMAIN}>`,
      reply_to: replyToAddress,
      to: [contact.email],
      subject: renderedSubject,
      html: htmlBody,
      ...(textBody ? { text: textBody } : {}),
    });

    if (!result.ok) {
      // Parse Resend error for a cleaner message
      let userMessage = "Failed to send email";
      try {
        const parsed = JSON.parse(result.error ?? "");
        if (parsed.message) userMessage = parsed.message;
      } catch { /* leave default */ }
      res.status(500).json({ error: userMessage, detail: result.error });
      return;
    }

    // Log the send
    const [sendRecord] = await db.insert(salesEmailSendsTable).values({
      contactId: contact.id,
      hotlinkId: hotlink?.id ?? null,
      email: contact.email,
      status: "sent",
      sentAt: new Date(),
    }).returning();

    // Create signal
    const [sig4] = await db.insert(salesSignalsTable).values({
      tenantId,
      accountId: contact.accountId,
      contactId: contact.id,
      hotlinkId: hotlink?.id ?? null,
      type: "email_sent",
      source: renderedSubject,
      metadata: { single: true },
    }).returning();
    broadcastSignal(sig4);

    // SFDC write-back: log single email as Activity (fire-and-forget)
    if (contact.salesforceId) {
      sfdcService.getActiveConnection().then(conn => {
        if (conn) {
          sfdcService.logEmailActivity(conn.id, {
            contactSalesforceId: contact.salesforceId!,
            subject: renderedSubject,
          }).catch(() => {/* non-blocking */});
        }
      }).catch(() => {/* non-blocking */});
    }

    res.json({ ok: true, sendId: sendRecord.id });
  } catch (err) {
    logger.error({ err }, "POST /sales/send-email error");
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
