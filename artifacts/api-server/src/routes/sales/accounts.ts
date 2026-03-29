import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesAccountsTable,
  salesContactsTable,
  salesHotlinksTable,
  lpPagesTable,
} from "@workspace/db";

const router = Router();

// List all accounts
router.get("/accounts", async (_req, res): Promise<void> => {
  try {
    const accounts = await db
      .select()
      .from(salesAccountsTable)
      .orderBy(desc(salesAccountsTable.updatedAt));
    res.json(accounts);
  } catch (err) {
    console.error("GET /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// Get single account
router.get("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const [account] = await db
      .select()
      .from(salesAccountsTable)
      .where(eq(salesAccountsTable.id, Number(req.params.id)));
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(account);
  } catch (err) {
    console.error("GET /sales/accounts/:id error:", err);
    res.status(500).json({ error: "Failed to load account" });
  }
});

// Create account
router.post("/accounts", async (req, res): Promise<void> => {
  const { name, sfdcId, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [account] = await db
      .insert(salesAccountsTable)
      .values({
        sfdcId: sfdcId ?? null,
        name,
        domain: domain ?? null,
        industry: industry ?? null,
        segment: segment ?? null,
        parentAccountId: parentAccountId ?? null,
        status: status ?? "prospect",
        owner: owner ?? null,
        notes: notes ?? null,
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(account);
  } catch (err) {
    console.error("POST /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Update account
router.patch("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const { name, sfdcId, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (sfdcId !== undefined) updates.sfdcId = sfdcId;
    if (domain !== undefined) updates.domain = domain;
    if (industry !== undefined) updates.industry = industry;
    if (segment !== undefined) updates.segment = segment;
    if (parentAccountId !== undefined) updates.parentAccountId = parentAccountId;
    if (status !== undefined) updates.status = status;
    if (owner !== undefined) updates.owner = owner;
    if (notes !== undefined) updates.notes = notes;
    if (metadata !== undefined) updates.metadata = metadata;

    const [updated] = await db
      .update(salesAccountsTable)
      .set(updates)
      .where(eq(salesAccountsTable.id, Number(req.params.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /sales/accounts/:id error:", err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Delete account
router.delete("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(salesAccountsTable)
      .where(eq(salesAccountsTable.id, Number(req.params.id)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/accounts/:id error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// ─── Token generation helper ────────────────────────────────
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

// GET /accounts/:id/microsites — list distinct pages with hotlinks for this account
router.get("/accounts/:id/microsites", async (req, res): Promise<void> => {
  try {
    const accountId = Number(req.params.id);

    // Get all contacts for this account
    const contacts = await db.select({ id: salesContactsTable.id })
      .from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, accountId));

    if (contacts.length === 0) {
      res.json([]);
      return;
    }

    // Collect all hotlinks for all contacts
    const allHotlinks: Array<typeof salesHotlinksTable.$inferSelect> = [];
    for (const contact of contacts) {
      const hl = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, contact.id));
      allHotlinks.push(...hl);
    }

    // Get distinct page IDs
    const pageIdSet = new Set(allHotlinks.map(h => h.pageId));
    const pageIds = Array.from(pageIdSet);

    if (pageIds.length === 0) {
      res.json([]);
      return;
    }

    // Fetch page details and aggregate hotlink counts
    const results = [];
    for (const pageId of pageIds) {
      const [page] = await db.select().from(lpPagesTable)
        .where(eq(lpPagesTable.id, pageId));
      if (!page) continue;

      const pageHotlinks = allHotlinks.filter(h => h.pageId === pageId);
      const firstHotlink = pageHotlinks[0];

      results.push({
        pageId: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        updatedAt: page.updatedAt,
        hotlinkCount: pageHotlinks.length,
        firstToken: firstHotlink?.token ?? null,
      });
    }

    // Sort by most recently updated page
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(results);
  } catch (err) {
    console.error("GET /sales/accounts/:id/microsites error:", err);
    res.status(500).json({ error: "Failed to load microsites" });
  }
});

// POST /accounts/:id/microsites — bulk-create hotlinks for contacts with email on this account
router.post("/accounts/:id/microsites", async (req, res): Promise<void> => {
  const { pageId } = req.body;
  if (!pageId) {
    res.status(400).json({ error: "pageId is required" });
    return;
  }

  try {
    const accountId = Number(req.params.id);

    // Get all contacts for this account that have an email
    const contacts = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, accountId));

    const contactsWithEmail = contacts.filter(c => c.email && c.email.trim() !== "");

    const hotlinks: Array<typeof salesHotlinksTable.$inferSelect> = [];
    let createdCount = 0;

    for (const contact of contactsWithEmail) {
      // Skip if hotlink already exists for this contact+page
      const existing = await db.select().from(salesHotlinksTable)
        .where(and(
          eq(salesHotlinksTable.contactId, contact.id),
          eq(salesHotlinksTable.pageId, Number(pageId)),
        ))
        .limit(1);

      if (existing.length > 0) {
        hotlinks.push(existing[0]);
        continue;
      }

      const token = await generateUniqueToken();
      const [hotlink] = await db.insert(salesHotlinksTable).values({
        token,
        contactId: contact.id,
        pageId: Number(pageId),
      }).returning();
      hotlinks.push(hotlink);
      createdCount++;
    }

    res.status(201).json({
      createdCount,
      totalCount: hotlinks.length,
      hotlinks,
    });
  } catch (err) {
    console.error("POST /sales/accounts/:id/microsites error:", err);
    res.status(500).json({ error: "Failed to create microsites" });
  }
});

export default router;
