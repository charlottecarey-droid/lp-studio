import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesEmailCampaignsTable,
  salesEmailSendsTable,
  salesEmailTemplatesTable,
  salesContactsTable,
  salesSignalsTable,
  salesHotlinksTable,
} from "@workspace/db";
import { broadcastSignal } from "./signals";
import { sfdcService } from "../../lib/sfdc-service";

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN ?? "meetdandy-lp.com";
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? "sales@meetdandy.com";

// 1x1 transparent GIF pixel for open tracking
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

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

router.get("/campaigns", async (_req, res): Promise<void> => {
  try {
    const campaigns = await db
      .select()
      .from(salesEmailCampaignsTable)
      .orderBy(desc(salesEmailCampaignsTable.updatedAt));
    res.json(campaigns);
  } catch (err) {
    console.error("GET /sales/campaigns error:", err);
    res.status(500).json({ error: "Failed to load campaigns" });
  }
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  try {
    const [campaign] = await db
      .select()
      .from(salesEmailCampaignsTable)
      .where(eq(salesEmailCampaignsTable.id, Number(req.params.id)));
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(campaign);
  } catch (err) {
    console.error("GET /sales/campaigns/:id error:", err);
    res.status(500).json({ error: "Failed to load campaign" });
  }
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const { name, templateId, accountId, status, scheduledAt, metadata } = req.body;
  if (!name || !templateId) {
    res.status(400).json({ error: "name and templateId are required" });
    return;
  }
  try {
    const [campaign] = await db
      .insert(salesEmailCampaignsTable)
      .values({
        name,
        templateId: Number(templateId),
        accountId: accountId ? Number(accountId) : null,
        status: status ?? "draft",
        scheduledAt: scheduledAt ?? null,
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(campaign);
  } catch (err) {
    console.error("POST /sales/campaigns error:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  try {
    const updates: Record<string, unknown> = {};
    const fields = ["name", "templateId", "accountId", "status", "scheduledAt", "recipientCount", "metadata"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [updated] = await db
      .update(salesEmailCampaignsTable)
      .set(updates)
      .where(eq(salesEmailCampaignsTable.id, Number(req.params.id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /sales/campaigns/:id error:", err);
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(salesEmailCampaignsTable)
      .where(eq(salesEmailCampaignsTable.id, Number(req.params.id)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/campaigns/:id error:", err);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// ─── Campaign Send ──────────────────────────────────────────

router.post("/campaigns/:id/send", async (req, res): Promise<void> => {
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

    // Load contacts — either all account contacts or specific from metadata
    const contactIds: number[] = (campaign.metadata as any)?.contactIds ?? [];
    let contacts;
    if (contactIds.length > 0) {
      contacts = [];
      for (const cid of contactIds) {
        const [c] = await db.select().from(salesContactsTable).where(eq(salesContactsTable.id, cid));
        if (c) contacts.push(c);
      }
    } else if (campaign.accountId) {
      contacts = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.accountId, campaign.accountId));
    } else {
      res.status(400).json({ error: "No contacts specified for campaign" });
      return;
    }

    // Filter to contacts with emails and active status
    const sendable = contacts.filter(c => c.email && c.status === "active");
    if (sendable.length === 0) {
      res.status(400).json({ error: "No contacts with email addresses to send to" });
      return;
    }

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
      const vars: Record<string, string> = {
        "{{first_name}}": contact.firstName ?? "",
        "{{last_name}}": contact.lastName ?? "",
        "{{company}}": "", // will be populated from account if available
        "{{sender_name}}": senderName,
        "{{email}}": contact.email!,
      };

      // Build microsite URL if hotlink exists
      const [hotlink] = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, contact.id));
      if (hotlink) {
        vars["{{microsite_url}}"] = `${host}/p/${hotlink.token}`;
      }

      const subject = replaceVars(template.subject, vars);
      let body = replaceVars(template.bodyHtml, vars);

      // Inject tracking pixel (will be set up after send record is created)
      const payload = {
        from: `${senderName} <${senderLocal}@${SENDER_DOMAIN}>`,
        reply_to: DEFAULT_REPLY_TO,
        to: [contact.email!],
        subject,
        html: body,
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

    res.json({ sent, failed, total: sendable.length });
  } catch (err) {
    console.error("POST /sales/campaigns/:id/send error:", err);
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
    console.error("GET /sales/campaigns/:id/sends error:", err);
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

      // Get the send record to create a signal
      const [send] = await db.select().from(salesEmailSendsTable)
        .where(eq(salesEmailSendsTable.id, Number(id)));
      if (send) {
        const [sig2] = await db.insert(salesSignalsTable).values({
          contactId: send.contactId,
          hotlinkId: send.hotlinkId,
          type: "email_open",
          source: `Send #${send.id}`,
          metadata: { campaignId: send.campaignId, email: send.email },
        }).returning();
        broadcastSignal(sig2);
      }
    } catch (err) {
      console.error("Tracking pixel error:", err);
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

      const [send] = await db.select().from(salesEmailSendsTable)
        .where(eq(salesEmailSendsTable.id, Number(sendId)));
      if (send) {
        const [sig3] = await db.insert(salesSignalsTable).values({
          contactId: send.contactId,
          hotlinkId: send.hotlinkId,
          type: "email_click",
          source: destination,
          metadata: { campaignId: send.campaignId, email: send.email },
        }).returning();
        broadcastSignal(sig3);
      }
    } catch (err) {
      console.error("Click tracking error:", err);
    }
  }
  res.redirect(302, destination);
});

// ─── Single send (one-off email to a contact) ──────────────

router.post("/send-email", async (req, res): Promise<void> => {
  const { contactId, subject, bodyHtml, senderName, senderEmail } = req.body;
  if (!contactId || !subject || !bodyHtml) {
    res.status(400).json({ error: "contactId, subject, and bodyHtml are required" });
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

    const vars: Record<string, string> = {
      "{{first_name}}": contact.firstName ?? "",
      "{{last_name}}": contact.lastName ?? "",
      "{{sender_name}}": fromName,
      "{{email}}": contact.email,
    };

    // Check for hotlink
    const [hotlink] = await db.select().from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.contactId, contact.id));
    if (hotlink) {
      const host = `${req.protocol}://${req.get("host")}`;
      vars["{{microsite_url}}"] = `${host}/p/${hotlink.token}`;
    }

    const renderedSubject = replaceVars(subject, vars);
    const renderedBody = replaceVars(bodyHtml, vars);

    const result = await sendViaResend({
      from: `${fromName} <${fromLocal}@${SENDER_DOMAIN}>`,
      reply_to: DEFAULT_REPLY_TO,
      to: [contact.email],
      subject: renderedSubject,
      html: renderedBody,
    });

    if (!result.ok) {
      res.status(500).json({ error: "Failed to send email", detail: result.error });
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
    console.error("POST /sales/send-email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
