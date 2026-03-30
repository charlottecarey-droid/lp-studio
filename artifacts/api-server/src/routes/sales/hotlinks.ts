import { Router } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
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
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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
        .orderBy(desc(salesHotlinksTable.createdAt));
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

router.get("/resolve/:token", async (req, res): Promise<void> => {
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
