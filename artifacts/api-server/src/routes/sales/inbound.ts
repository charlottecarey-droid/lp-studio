import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, desc, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesInboundEmailsTable,
  salesContactsTable,
  salesSignalsTable,
} from "@workspace/db";

const router = Router();

// ─── Webhook signature verification ─────────────────────────
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

function verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
  if (!RESEND_WEBHOOK_SECRET || !signature) return !RESEND_WEBHOOK_SECRET; // skip if no secret configured
  try {
    const expected = createHmac("sha256", RESEND_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");
    const sigHex = signature.replace(/^sha256=/, "");
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sigHex, "hex"));
  } catch {
    return false;
  }
}

// ─── GET /sales/inbound — list received emails ───────────────

router.get("/", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: salesInboundEmailsTable.id,
        contactId: salesInboundEmailsTable.contactId,
        accountId: salesInboundEmailsTable.accountId,
        messageId: salesInboundEmailsTable.messageId,
        inReplyTo: salesInboundEmailsTable.inReplyTo,
        fromEmail: salesInboundEmailsTable.fromEmail,
        fromName: salesInboundEmailsTable.fromName,
        toEmail: salesInboundEmailsTable.toEmail,
        subject: salesInboundEmailsTable.subject,
        bodyText: salesInboundEmailsTable.bodyText,
        isRead: salesInboundEmailsTable.isRead,
        receivedAt: salesInboundEmailsTable.receivedAt,
        // Join contact name
        contactFirstName: salesContactsTable.firstName,
        contactLastName: salesContactsTable.lastName,
      })
      .from(salesInboundEmailsTable)
      .leftJoin(salesContactsTable, eq(salesInboundEmailsTable.contactId, salesContactsTable.id))
      .orderBy(desc(salesInboundEmailsTable.receivedAt))
      .limit(100);

    res.json(rows);
  } catch (err) {
    console.error("GET /sales/inbound error:", err);
    res.status(500).json({ error: "Failed to fetch inbound emails" });
  }
});

// ─── GET /sales/inbound/:id — get full email ────────────────

router.get("/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(salesInboundEmailsTable)
      .where(eq(salesInboundEmailsTable.id, Number(req.params.id)));

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Mark as read
    await db
      .update(salesInboundEmailsTable)
      .set({ isRead: true })
      .where(eq(salesInboundEmailsTable.id, row.id));

    res.json({ ...row, isRead: true });
  } catch (err) {
    console.error("GET /sales/inbound/:id error:", err);
    res.status(500).json({ error: "Failed to fetch email" });
  }
});

// ─── PATCH /sales/inbound/:id/read — mark as read ───────────

router.patch("/:id/read", async (req, res): Promise<void> => {
  try {
    await db
      .update(salesInboundEmailsTable)
      .set({ isRead: true })
      .where(eq(salesInboundEmailsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// ─── POST /sales/inbound — Resend inbound webhook ──────────
// Configure this URL in your Resend inbound settings.
// Resend sends: { from, to, subject, text, html, headers: { "message-id", "in-reply-to" } }

router.post("/", async (req, res): Promise<void> => {
  // Verify webhook signature if secret is configured
  if (RESEND_WEBHOOK_SECRET) {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const signature = req.headers["resend-signature"] as string | undefined
      ?? req.headers["x-resend-signature"] as string | undefined;
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("Inbound webhook: invalid signature rejected");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  try {
    const body = req.body ?? {};

    // Resend inbound payload fields
    const fromRaw: string = body.from ?? "";
    const toRaw: string = Array.isArray(body.to) ? body.to[0] : (body.to ?? "");
    const subject: string = body.subject ?? "(no subject)";
    const bodyText: string = body.text ?? body.plain ?? "";
    const bodyHtml: string = body.html ?? "";
    const headers: Record<string, string> = body.headers ?? {};

    const messageId: string = headers["message-id"] ?? headers["Message-Id"] ?? headers["Message-ID"] ?? "";
    const inReplyTo: string = headers["in-reply-to"] ?? headers["In-Reply-To"] ?? "";

    // Parse "Name <email>" format
    const fromEmailMatch = fromRaw.match(/<([^>]+)>/) ?? [];
    const fromEmail = fromEmailMatch[1] ?? fromRaw.trim();
    const fromName = fromEmailMatch[1]
      ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "")
      : undefined;

    const toEmail = toRaw.replace(/<[^>]+>/, "").trim() || toRaw;

    if (!fromEmail) {
      res.status(400).json({ error: "Missing from email" });
      return;
    }

    // Match to a contact by email address
    const [contact] = await db
      .select()
      .from(salesContactsTable)
      .where(ilike(salesContactsTable.email, fromEmail))
      .limit(1);

    // Store the inbound email
    const [record] = await db.insert(salesInboundEmailsTable).values({
      contactId: contact?.id ?? null,
      accountId: contact?.accountId ?? null,
      messageId: messageId || null,
      inReplyTo: inReplyTo || null,
      fromEmail,
      fromName: fromName || null,
      toEmail,
      subject,
      bodyText: bodyText || null,
      bodyHtml: bodyHtml || null,
      isRead: false,
    }).returning();

    // Create a signal if we matched a contact
    if (contact?.accountId) {
      await db.insert(salesSignalsTable).values({
        tenantId: contact.tenantId,
        accountId: contact.accountId,
        contactId: contact.id,
        type: "email_replied",
        source: subject,
        metadata: { inboundId: record.id, fromEmail },
      });
    }

    res.json({ ok: true, id: record.id, matched: !!contact });
  } catch (err) {
    console.error("POST /sales/inbound error:", err);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
});

export default router;
