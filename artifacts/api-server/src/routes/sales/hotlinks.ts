import { Router } from "express";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesHotlinksTable,
  salesContactsTable,
  salesAccountsTable,
  salesSignalsTable,
  lpPagesTable,
} from "@workspace/db";
import { broadcastSignal } from "./signals";
import { sfdcService } from "../../lib/sfdc-service";

const router = Router();

// ─── Visit alert email ──────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendVisitAlert(
  recipients: string[],
  opts: { contactName: string; company?: string | null; pageTitle: string; pageSlug: string; visitedAt: string },
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || recipients.length === 0) return;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
  <div style="background:#003A30;padding:24px 32px">
    <h1 style="margin:0;color:#C7E738;font-size:20px">Personalized Link Visited</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:14px">${escapeHtml(opts.pageTitle)}</p>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tbody>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#003A30;white-space:nowrap">Contact</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(opts.contactName)}</td>
        </tr>
        ${opts.company ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#003A30;white-space:nowrap">Company</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(opts.company)}</td></tr>` : ""}
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#003A30;white-space:nowrap">Page</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(opts.pageSlug)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#003A30;white-space:nowrap">Visited At</td>
          <td style="padding:8px 12px;color:#333">${new Date(opts.visitedAt).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <notifications@ent.meetdandy.com>",
        to: recipients,
        subject: `${opts.contactName} just viewed your page`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`Resend rejected visit alert: HTTP ${res.status}`, body, { recipients });
    } else {
      console.log(`Visit alert sent to ${recipients.join(", ")} for ${opts.contactName}`);
    }
  } catch (err) {
    console.error("Failed to send visit alert email (network error):", err);
  }
}

// ─── GET /microsites/overview — account-grouped microsites + hotlinks ──────
router.get("/microsites/overview", async (_req, res): Promise<void> => {
  try {
    // Single JOIN query: hotlinks → contacts → accounts + pages
    const rows = await db
      .select({
        hotlinkId: salesHotlinksTable.id,
        token: salesHotlinksTable.token,
        isActive: salesHotlinksTable.isActive,
        contactId: salesContactsTable.id,
        contactFirst: salesContactsTable.firstName,
        contactLast: salesContactsTable.lastName,
        accountId: salesAccountsTable.id,
        accountName: salesAccountsTable.name,
        pageId: lpPagesTable.id,
        pageTitle: lpPagesTable.title,
        pageSlug: lpPagesTable.slug,
        pageStatus: lpPagesTable.status,
        pageUpdatedAt: lpPagesTable.updatedAt,
      })
      .from(salesHotlinksTable)
      .innerJoin(salesContactsTable, eq(salesHotlinksTable.contactId, salesContactsTable.id))
      .innerJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .innerJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
      .where(eq(salesHotlinksTable.isActive, true))
      .orderBy(salesAccountsTable.name, lpPagesTable.updatedAt, salesContactsTable.lastName);

    // Group into: accountId → pageId → hotlinks[]
    type HotlinkEntry = { hotlinkId: number; token: string; contactId: number; contactName: string };
    type PageEntry = { pageId: number; pageTitle: string; pageSlug: string; pageStatus: string; pageUpdatedAt: Date; hotlinks: HotlinkEntry[] };
    type AccountEntry = { accountId: number; accountName: string; pages: Map<number, PageEntry> };

    const accountMap = new Map<number, AccountEntry>();
    for (const row of rows) {
      if (!accountMap.has(row.accountId)) {
        accountMap.set(row.accountId, { accountId: row.accountId, accountName: row.accountName, pages: new Map() });
      }
      const acct = accountMap.get(row.accountId)!;
      if (!acct.pages.has(row.pageId)) {
        acct.pages.set(row.pageId, {
          pageId: row.pageId,
          pageTitle: row.pageTitle,
          pageSlug: row.pageSlug,
          pageStatus: row.pageStatus,
          pageUpdatedAt: row.pageUpdatedAt,
          hotlinks: [],
        });
      }
      acct.pages.get(row.pageId)!.hotlinks.push({
        hotlinkId: row.hotlinkId,
        token: row.token,
        contactId: row.contactId,
        contactName: `${row.contactFirst} ${row.contactLast}`.trim(),
      });
    }

    const result = Array.from(accountMap.values()).map(acct => ({
      accountId: acct.accountId,
      accountName: acct.accountName,
      pages: Array.from(acct.pages.values()).map(p => ({
        ...p,
        pageUpdatedAt: p.pageUpdatedAt,
      })),
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /sales/microsites/overview error:", err);
    res.status(500).json({ error: "Failed to load microsites overview" });
  }
});

// ─── Token generation (matches existing LP Studio pattern) ──

function generateToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function generateUniqueToken(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = generateToken();
    const existing = await db.select({ id: salesHotlinksTable.id })
      .from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token))
      .limit(1);
    if (existing.length === 0) return token;
  }
  throw new Error("Failed to generate unique token after multiple attempts");
}

// ─── CRUD ───────────────────────────────────────────────────

// List hotlinks (optionally filter by contactId, pageId, or accountId)
router.get("/hotlinks", async (req, res): Promise<void> => {
  try {
    const { contactId, pageId, accountId } = req.query;
    let hotlinks;
    if (accountId) {
      // All hotlinks for an account — join through contacts
      const contacts = await db
        .select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(eq(salesContactsTable.accountId, Number(accountId)));
      if (contacts.length === 0) {
        res.json([]);
        return;
      }
      hotlinks = await db
        .select()
        .from(salesHotlinksTable)
        .where(inArray(salesHotlinksTable.contactId, contacts.map(c => c.id)))
        .orderBy(desc(salesHotlinksTable.createdAt));
    } else if (contactId) {
      hotlinks = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, Number(contactId)))
        .orderBy(desc(salesHotlinksTable.createdAt));
    } else if (pageId) {
      hotlinks = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.pageId, Number(pageId)))
        .orderBy(desc(salesHotlinksTable.createdAt));
    } else {
      hotlinks = await db.select().from(salesHotlinksTable)
        .orderBy(desc(salesHotlinksTable.createdAt))
        .limit(1000);
    }
    res.json(hotlinks);
  } catch (err) {
    console.error("GET /sales/hotlinks error:", err);
    res.status(500).json({ error: "Failed to load hotlinks" });
  }
});

// Create hotlink for a contact + page
router.post("/hotlinks", async (req, res): Promise<void> => {
  const { contactId, pageId } = req.body;
  if (!contactId || !pageId) {
    res.status(400).json({ error: "contactId and pageId are required" });
    return;
  }

  try {
    // Check if hotlink already exists for this contact+page
    const existing = await db.select().from(salesHotlinksTable)
      .where(and(
        eq(salesHotlinksTable.contactId, Number(contactId)),
        eq(salesHotlinksTable.pageId, Number(pageId)),
      ))
      .limit(1);

    if (existing.length > 0) {
      res.json(existing[0]); // Return existing
      return;
    }

    const token = await generateUniqueToken();
    const [hotlink] = await db.insert(salesHotlinksTable).values({
      token,
      contactId: Number(contactId),
      pageId: Number(pageId),
    }).returning();

    res.status(201).json(hotlink);
  } catch (err) {
    console.error("POST /sales/hotlinks error:", err);
    res.status(500).json({ error: "Failed to create hotlink" });
  }
});

// Bulk-create hotlinks for all contacts of an account for a specific page
router.post("/hotlinks/bulk", async (req, res): Promise<void> => {
  const { accountId, pageId } = req.body;
  if (!accountId || !pageId) {
    res.status(400).json({ error: "accountId and pageId are required" });
    return;
  }

  try {
    const contacts = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, Number(accountId)));

    const created: Array<typeof salesHotlinksTable.$inferSelect> = [];

    for (const contact of contacts) {
      // Skip if hotlink already exists
      const existing = await db.select().from(salesHotlinksTable)
        .where(and(
          eq(salesHotlinksTable.contactId, contact.id),
          eq(salesHotlinksTable.pageId, Number(pageId)),
        ))
        .limit(1);

      if (existing.length > 0) {
        created.push(existing[0]);
        continue;
      }

      const token = await generateUniqueToken();
      const [hotlink] = await db.insert(salesHotlinksTable).values({
        token,
        contactId: contact.id,
        pageId: Number(pageId),
      }).returning();
      created.push(hotlink);
    }

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /sales/hotlinks/bulk error:", err);
    res.status(500).json({ error: "Failed to create hotlinks" });
  }
});

// ─── Token resolve (sales-specific) ────────────────────────

const resolveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

router.get("/resolve/:token", resolveLimiter, async (req, res): Promise<void> => {
  try {
    const { token } = req.params;
    const [hotlink] = await db.select().from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token));

    if (!hotlink || !hotlink.isActive) {
      res.status(404).json({ error: "Link not found or inactive" });
      return;
    }

    // Get page info
    const [page] = await db.select().from(lpPagesTable)
      .where(eq(lpPagesTable.id, hotlink.pageId));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Get contact info
    const [contact] = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.id, hotlink.contactId));

    // Get account info for company name
    let company = "";
    if (contact?.accountId) {
      const [account] = await db.select({ name: salesAccountsTable.name })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, contact.accountId));
      company = account?.name ?? "";
    }

    // Create page_view signal
    const [pvSignal] = await db.insert(salesSignalsTable).values({
      accountId: contact?.accountId ?? null,
      contactId: hotlink.contactId,
      hotlinkId: hotlink.id,
      type: "page_view",
      source: page.title,
      metadata: {
        pageSlug: page.slug,
        ip: req.headers["x-forwarded-for"] ?? req.ip ?? "",
      },
    }).returning();
    broadcastSignal(pvSignal);

    // Send visit alert email (fire-and-forget)
    setImmediate(async () => {
      try {
        const alertResult = await db.execute(sql`
          SELECT email FROM lp_page_alert_emails WHERE page_id = ${hotlink.pageId}
        `);
        const recipients = (alertResult.rows as { email: string }[]).map(r => r.email).filter(Boolean);
        console.log(`[visit-alert] pageId=${hotlink.pageId} recipients=${JSON.stringify(recipients)}`);
        if (recipients.length > 0) {
          const contactName = contact ? `${contact.firstName} ${contact.lastName}` : "Unknown";
          await sendVisitAlert(recipients, {
            contactName,
            company,
            pageTitle: page.title,
            pageSlug: page.slug,
            visitedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Failed to process visit alert for hotlink:", err);
      }
    });

    // SFDC write-back: log microsite view as Activity (fire-and-forget)
    if (contact?.salesforceId) {
      sfdcService.getActiveConnection().then(conn => {
        if (conn) {
          sfdcService.logMicrositeView(conn.id, {
            contactSalesforceId: contact.salesforceId!,
            pageTitle: page.title,
            pageUrl: `/lp/${page.slug}`,
          }).catch(() => {/* non-blocking */});
        }
      }).catch(() => {/* non-blocking */});
    }

    res.json({
      pageSlug: page.slug,
      pageTitle: page.title,
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      company,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      token,
      hotlinkId: hotlink.id,
      contactId: hotlink.contactId,
      accountId: contact?.accountId ?? null,
    });
  } catch (err) {
    console.error("GET /sales/resolve/:token error:", err);
    res.status(500).json({ error: "Failed to resolve token" });
  }
});

export default router;
