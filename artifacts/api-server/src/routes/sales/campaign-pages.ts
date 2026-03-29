import { Router } from "express";
import { eq, and, isNotNull, not } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesContactsTable,
  salesAccountsTable,
  salesHotlinksTable,
  salesSignalsTable,
  lpPagesTable,
} from "@workspace/db";

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN ?? "meetdandy-lp.com";
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? "sales@meetdandy.com";

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [k, v] of Object.entries(vars)) result = result.split(k).join(v);
  return result;
}

async function sendViaResend(payload: {
  from: string;
  reply_to: string;
  to: string[];
  subject: string;
  html: string;
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

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function getOrCreateHotlink(contactId: number, pageId: number): Promise<typeof salesHotlinksTable.$inferSelect> {
  const existing = await db.select().from(salesHotlinksTable)
    .where(and(
      eq(salesHotlinksTable.contactId, contactId),
      eq(salesHotlinksTable.pageId, pageId),
    ))
    .limit(1);
  if (existing.length > 0) return existing[0];

  let token: string;
  for (let i = 0; i < 5; i++) {
    token = generateToken();
    const dup = await db.select({ id: salesHotlinksTable.id }).from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token)).limit(1);
    if (dup.length === 0) break;
  }
  const [hotlink] = await db.insert(salesHotlinksTable).values({ token: token!, contactId, pageId }).returning();
  return hotlink;
}

// ─── Get stats for a campaign page (hotlink count, account reach) ────────────

router.get("/campaign-pages/stats/:pageId", async (req, res): Promise<void> => {
  try {
    const pageId = Number(req.params.pageId);
    const hotlinks = await db.select({ contactId: salesHotlinksTable.contactId })
      .from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.pageId, pageId));

    const contactIds = hotlinks.map(h => h.contactId);

    let accountCount = 0;
    if (contactIds.length > 0) {
      const contacts = await db.select({ accountId: salesContactsTable.accountId })
        .from(salesContactsTable)
        .where(eq(salesContactsTable.id, contactIds[0]));
      const uniqueAccounts = new Set(contacts.map(c => c.accountId).filter(Boolean));
      accountCount = uniqueAccounts.size;
    }

    // Count total active contacts with emails (potential reach)
    const eligible = await db.select({ id: salesContactsTable.id })
      .from(salesContactsTable)
      .where(and(
        isNotNull(salesContactsTable.email),
        not(eq(salesContactsTable.status, "unsubscribed")),
      ));

    res.json({ hotlinkCount: hotlinks.length, accountCount, eligibleContactCount: eligible.length });
  } catch (err) {
    console.error("GET /sales/campaign-pages/stats/:pageId error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ─── Preview contacts eligible for a campaign launch ────────────────────────

router.get("/campaign-pages/eligible-contacts", async (_req, res): Promise<void> => {
  try {
    const contacts = await db
      .select({
        id: salesContactsTable.id,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        email: salesContactsTable.email,
        accountId: salesContactsTable.accountId,
        accountName: salesAccountsTable.name,
      })
      .from(salesContactsTable)
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(and(
        isNotNull(salesContactsTable.email),
        not(eq(salesContactsTable.status, "unsubscribed")),
      ));

    res.json(contacts);
  } catch (err) {
    console.error("GET /sales/campaign-pages/eligible-contacts error:", err);
    res.status(500).json({ error: "Failed to get eligible contacts" });
  }
});

// ─── Launch a campaign page to all eligible contacts ────────────────────────

router.post("/campaign-pages/launch", async (req, res): Promise<void> => {
  const {
    pageId,
    emailSubject,
    emailBodyHtml,
    senderName = "Dandy",
    senderEmail = "partnerships",
    sendEmails = true,
  } = req.body;

  if (!pageId) {
    res.status(400).json({ error: "pageId is required" });
    return;
  }

  try {
    const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, Number(pageId)));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const host = `${req.protocol}://${req.get("host")}`;

    const contacts = await db
      .select({
        id: salesContactsTable.id,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        email: salesContactsTable.email,
        accountId: salesContactsTable.accountId,
        accountName: salesAccountsTable.name,
      })
      .from(salesContactsTable)
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(and(
        isNotNull(salesContactsTable.email),
        not(eq(salesContactsTable.status, "unsubscribed")),
      ));

    let sent = 0;
    let failed = 0;
    let hotlinksCreated = 0;

    for (const contact of contacts) {
      const existingCheck = await db.select({ id: salesHotlinksTable.id })
        .from(salesHotlinksTable)
        .where(and(eq(salesHotlinksTable.contactId, contact.id), eq(salesHotlinksTable.pageId, Number(pageId))))
        .limit(1);
      const isNew = existingCheck.length === 0;

      const hotlink = await getOrCreateHotlink(contact.id, Number(pageId));
      if (isNew) hotlinksCreated++;

      const micrositeUrl = `${host}/p/${hotlink.token}`;

      if (sendEmails && emailSubject && emailBodyHtml) {
        const vars: Record<string, string> = {
          "{{first_name}}": contact.firstName ?? "",
          "{{last_name}}": contact.lastName ?? "",
          "{{company}}": contact.accountName ?? "",
          "{{microsite_url}}": micrositeUrl,
          "{{sender_name}}": senderName,
          "{{email}}": contact.email!,
        };

        const subject = replaceVars(emailSubject, vars);
        const html = replaceVars(emailBodyHtml, vars);

        const result = await sendViaResend({
          from: `${senderName} <${senderEmail}@${SENDER_DOMAIN}>`,
          reply_to: DEFAULT_REPLY_TO,
          to: [contact.email!],
          subject,
          html,
        });

        if (result.ok) {
          sent++;
          await db.insert(salesSignalsTable).values({
            accountId: contact.accountId,
            contactId: contact.id,
            hotlinkId: hotlink.id,
            type: "email_sent",
            source: `Campaign Page: ${page.title}`,
            metadata: { pageId: Number(pageId), micrositeUrl },
          });
        } else {
          failed++;
          console.error(`Failed to send to ${contact.email}:`, result.error);
        }

        if (contacts.length > 10) {
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }

    if (!sendEmails) {
      res.json({
        hotlinksCreated: contacts.length,
        sent: 0,
        failed: 0,
        total: contacts.length,
        message: "Hotlinks created. No emails were sent.",
      });
    } else {
      res.json({ hotlinksCreated, sent, failed, total: contacts.length });
    }
  } catch (err) {
    console.error("POST /sales/campaign-pages/launch error:", err);
    res.status(500).json({ error: "Failed to launch campaign" });
  }
});

export default router;
