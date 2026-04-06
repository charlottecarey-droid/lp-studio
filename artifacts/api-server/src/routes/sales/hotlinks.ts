import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { eq, and, or, desc, inArray, isNotNull, sql } from "drizzle-orm";
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
import { logger } from "../../lib/logger";

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
      logger.error({ status: res.status, body, recipients }, "Resend rejected visit alert");
    } else {
      logger.info({ recipients, contactName: opts.contactName }, "Visit alert sent");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send visit alert email (network error)");
  }
}

// ─── GET /microsites/overview — page-centric, hotlinks optional ─────────────
router.get("/microsites/overview", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const currentUser = req.authUser!;
  // Non-admin reps only see pages linked to accounts they own (matched by name, case-insensitive).
  // Admins see everything.
  const repOwnerFilter = currentUser.isAdmin
    ? undefined
    : sql`lower(${salesAccountsTable.owner}) = lower(${currentUser.name})`;
  try {
    // 1. All tenant LP pages (non-template), left-join account
    // Join priority: account_id (integer FK) first, then sfdc_account_id (stable SFDC ID).
    // This means pages survive account delete+re-sync as long as sfdc_account_id is stored.
    const pages = await db
      .select({
        pageId: lpPagesTable.id,
        pageTitle: lpPagesTable.title,
        pageSlug: lpPagesTable.slug,
        pageStatus: lpPagesTable.status,
        pageUpdatedAt: lpPagesTable.updatedAt,
        sfdcAccountId: lpPagesTable.sfdcAccountId,
        accountId: salesAccountsTable.id,
        accountName: salesAccountsTable.name,
      })
      .from(lpPagesTable)
      .leftJoin(salesAccountsTable, and(
        eq(salesAccountsTable.tenantId, tenantId),
        or(
          eq(lpPagesTable.accountId, salesAccountsTable.id),
          and(
            isNotNull(lpPagesTable.sfdcAccountId),
            eq(lpPagesTable.sfdcAccountId, salesAccountsTable.salesforceId),
          ),
        ),
      ))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        eq(lpPagesTable.isTemplate, false),
        repOwnerFilter,
      ))
      .orderBy(salesAccountsTable.name, desc(lpPagesTable.updatedAt));

    if (pages.length === 0) { res.json([]); return; }

    // 2. Hotlinks for these pages — LEFT JOIN so orphaned hotlinks (null contactId after SFDC re-sync) still appear
    const pageIds = [...new Set(pages.map(p => p.pageId))];
    const hotlinks = await db
      .select({
        hotlinkId: salesHotlinksTable.id,
        token: salesHotlinksTable.token,
        pageId: salesHotlinksTable.pageId,
        contactId: salesContactsTable.id,
        contactFirst: salesContactsTable.firstName,
        contactLast: salesContactsTable.lastName,
        sfdcContactId: salesHotlinksTable.sfdcContactId,
      })
      .from(salesHotlinksTable)
      .leftJoin(salesContactsTable, and(
        eq(salesHotlinksTable.contactId, salesContactsTable.id),
        eq(salesContactsTable.tenantId, tenantId),
      ))
      .where(and(
        inArray(salesHotlinksTable.pageId, pageIds),
        eq(salesHotlinksTable.isActive, true),
      ));

    // For orphaned hotlinks (contactId null), try to resolve name via sfdcContactId
    const orphanSfdcIds = hotlinks
      .filter(hl => !hl.contactId && hl.sfdcContactId)
      .map(hl => hl.sfdcContactId!);
    const sfdcNameMap = new Map<string, string>();
    if (orphanSfdcIds.length > 0) {
      const sfdcContacts = await db
        .select({ sfdcId: salesContactsTable.salesforceId, first: salesContactsTable.firstName, last: salesContactsTable.lastName })
        .from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.tenantId, tenantId),
          inArray(salesContactsTable.salesforceId, orphanSfdcIds),
        ));
      for (const c of sfdcContacts) {
        if (c.sfdcId) sfdcNameMap.set(c.sfdcId, [c.first, c.last].filter(Boolean).join(" ").trim());
      }
    }

    // Index hotlinks by pageId, combining first+last into contactName
    type HotlinkMapped = { hotlinkId: number | null; token: string; pageId: number | null; contactId: number; contactName: string };
    const hotlinksByPage = new Map<number, HotlinkMapped[]>();
    for (const hl of hotlinks) {
      if (!hl.pageId) continue;
      if (!hotlinksByPage.has(hl.pageId)) hotlinksByPage.set(hl.pageId, []);
      hotlinksByPage.get(hl.pageId)!.push({
        hotlinkId: hl.hotlinkId,
        token: hl.token,
        pageId: hl.pageId,
        contactId: hl.contactId ?? 0,
        contactName: [hl.contactFirst, hl.contactLast].filter(Boolean).join(" ").trim()
          || (hl.sfdcContactId ? sfdcNameMap.get(hl.sfdcContactId) ?? "" : ""),
      });
    }

    // 3. Group pages by account (null accountId → "unattached" bucket with id=-1)
    type PageEntry = { pageId: number; pageTitle: string; pageSlug: string; pageStatus: string; pageUpdatedAt: Date; hotlinks: HotlinkMapped[] };
    type AccountEntry = { accountId: number; accountName: string; pages: Map<number, PageEntry> };
    const accountMap = new Map<number, AccountEntry>();

    for (const row of pages) {
      const acctId = row.accountId ?? -1;
      const acctName = row.accountName ?? "General";
      if (!accountMap.has(acctId)) {
        accountMap.set(acctId, { accountId: acctId, accountName: acctName, pages: new Map() });
      }
      const acct = accountMap.get(acctId)!;
      if (!acct.pages.has(row.pageId)) {
        acct.pages.set(row.pageId, {
          pageId: row.pageId,
          pageTitle: row.pageTitle,
          pageSlug: row.pageSlug,
          pageStatus: row.pageStatus,
          pageUpdatedAt: row.pageUpdatedAt,
          hotlinks: hotlinksByPage.get(row.pageId) ?? [],
        });
      }
    }

    const result = Array.from(accountMap.values()).map(acct => ({
      accountId: acct.accountId,
      accountName: acct.accountName,
      pages: Array.from(acct.pages.values()),
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /sales/microsites/overview error");
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
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { contactId, pageId, accountId } = req.query;
    let hotlinks;
    if (accountId) {
      // All hotlinks for an account — join through contacts, tenant-scoped
      const contacts = await db
        .select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(and(eq(salesContactsTable.accountId, Number(accountId)), eq(salesContactsTable.tenantId, tenantId)));
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
      // Unfiltered — scope through contacts to enforce tenant isolation
      const tenantContacts = await db.select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(eq(salesContactsTable.tenantId, tenantId))
        .limit(5000);
      if (tenantContacts.length === 0) {
        res.json([]);
        return;
      }
      hotlinks = await db.select().from(salesHotlinksTable)
        .where(inArray(salesHotlinksTable.contactId, tenantContacts.map(c => c.id)))
        .orderBy(desc(salesHotlinksTable.createdAt))
        .limit(1000);
    }
    res.json(hotlinks);
  } catch (err) {
    logger.error({ err }, "GET /sales/hotlinks error");
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

    // Fetch salesforce_id for stable re-linkage after re-sync
    const [contactRow] = await db
      .select({ salesforceId: salesContactsTable.salesforceId })
      .from(salesContactsTable)
      .where(eq(salesContactsTable.id, Number(contactId)))
      .limit(1);

    const token = await generateUniqueToken();
    const [hotlink] = await db.insert(salesHotlinksTable).values({
      token,
      contactId: Number(contactId),
      sfdcContactId: contactRow?.salesforceId ?? null,
      pageId: Number(pageId),
    }).returning();

    res.status(201).json(hotlink);
  } catch (err) {
    logger.error({ err }, "POST /sales/hotlinks error");
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

    if (contacts.length === 0) {
      res.status(201).json([]);
      return;
    }

    // Batch-load all existing hotlinks for this page + these contacts (eliminates N+1)
    const contactIds = contacts.map(c => c.id);
    const existingHotlinks = await db.select().from(salesHotlinksTable)
      .where(and(
        inArray(salesHotlinksTable.contactId, contactIds),
        eq(salesHotlinksTable.pageId, Number(pageId)),
      ));
    const existingByContactId = new Map(existingHotlinks.map(h => [h.contactId, h]));

    const created: Array<typeof salesHotlinksTable.$inferSelect> = [];

    for (const contact of contacts) {
      // Skip if hotlink already exists (checked from batch-loaded map)
      const existing = existingByContactId.get(contact.id);
      if (existing) {
        created.push(existing);
        continue;
      }

      const token = await generateUniqueToken();
      const [hotlink] = await db.insert(salesHotlinksTable).values({
        token,
        contactId: contact.id,
        sfdcContactId: contact.salesforceId ?? null,
        pageId: Number(pageId),
      }).returning();
      created.push(hotlink);
    }

    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /sales/hotlinks/bulk error");
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
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const [hotlink] = await db.select().from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token));

    if (!hotlink || !hotlink.isActive) {
      res.status(404).json({ error: "Link not found or inactive" });
      return;
    }

    // Get page info
    const [page] = await db.select({
      id: lpPagesTable.id,
      title: lpPagesTable.title,
      slug: lpPagesTable.slug,
      tenantId: lpPagesTable.tenantId,
    }).from(lpPagesTable)
      .where(eq(lpPagesTable.id, hotlink.pageId));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Get contact info
    let contact: typeof salesContactsTable.$inferSelect | undefined;
    if (hotlink.contactId) {
      const contactResult = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.id, hotlink.contactId));
      contact = contactResult[0];
    }

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
      tenantId: page.tenantId,
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
        logger.info({ pageId: hotlink.pageId, recipients }, "[visit-alert] processing visit");
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
        logger.error({ err }, "Failed to process visit alert for hotlink");
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
    logger.error({ err }, "GET /sales/resolve/:token error");
    res.status(500).json({ error: "Failed to resolve token" });
  }
});

export default router;
