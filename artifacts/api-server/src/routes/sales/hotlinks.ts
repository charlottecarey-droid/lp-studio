import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesHotlinksTable,
  salesContactsTable,
  salesAccountsTable,
  salesSignalsTable,
  lpPagesTable,
} from "@workspace/db";

const router = Router();

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

// List hotlinks (optionally filter by contactId or pageId)
router.get("/hotlinks", async (req, res): Promise<void> => {
  try {
    const { contactId, pageId } = req.query;
    let hotlinks;
    if (contactId) {
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
    await db.insert(salesSignalsTable).values({
      accountId: contact?.accountId ?? null,
      contactId: hotlink.contactId,
      hotlinkId: hotlink.id,
      type: "page_view",
      source: page.title,
      metadata: {
        pageSlug: page.slug,
        ip: req.headers["x-forwarded-for"] ?? req.ip ?? "",
      },
    });

    res.json({
      pageSlug: page.slug,
      pageTitle: page.title,
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      company,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      token,
      hotlinkId: hotlink.id,
    });
  } catch (err) {
    console.error("GET /sales/resolve/:token error:", err);
    res.status(500).json({ error: "Failed to resolve token" });
  }
});

export default router;
