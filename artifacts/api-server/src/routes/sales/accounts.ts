import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { randomBytes } from "crypto";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesAccountsTable,
  salesContactsTable,
  salesHotlinksTable,
  lpPagesTable,
} from "@workspace/db";

const router = Router();

// snake_case → camelCase helper for raw SQL rows
function rowToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

// List all accounts — derives abmTier from contacts when the account column is empty
router.get("/accounts", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const rows = await db.execute(sql`
      SELECT
        sa.*,
        COALESCE(
          NULLIF(sa.abm_tier, ''),
          (
            SELECT sc.tier
            FROM sales_contacts sc
            WHERE sc.account_id = sa.id
              AND sc.tier IS NOT NULL
              AND sc.tier <> ''
            GROUP BY sc.tier
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) AS abm_tier,
        (
          SELECT COUNT(*)::int
          FROM sales_contacts sc2
          WHERE sc2.account_id = sa.id
        ) AS contact_count
      FROM sales_accounts sa
      WHERE sa.tenant_id = ${tenantId}
      ORDER BY sa.updated_at DESC
    `);
    res.json(rows.rows.map(r => rowToCamel(r as Record<string, unknown>)));
  } catch (err) {
    console.error("GET /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// Get single account
router.get("/accounts/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [account] = await db
      .select()
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, Number(req.params.id))));
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
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, salesforceId, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [account] = await db
      .insert(salesAccountsTable)
      .values({
        tenantId,
        salesforceId: salesforceId ?? null,
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
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { name, displayName, salesforceId, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (displayName !== undefined) updates.displayName = displayName === "" ? null : displayName;
    if (salesforceId !== undefined) updates.salesforceId = salesforceId;
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
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, Number(req.params.id))))
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
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [deleted] = await db
      .delete(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, Number(req.params.id))))
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

// Delete ALL accounts for tenant (cascades to contacts, signals, briefings)
router.delete("/accounts", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;

    // Null out RESTRICT FK references before deleting accounts
    // (sfdc tables have no tenant_id so we scope by account membership)
    await db.execute(sql`
      UPDATE sales_email_campaigns
      SET account_id = NULL
      WHERE tenant_id = ${tenantId} AND account_id IS NOT NULL
    `);
    await db.execute(sql`
      UPDATE sfdc_opportunities
      SET account_id = NULL
      WHERE account_id IN (
        SELECT id FROM sales_accounts WHERE tenant_id = ${tenantId}
      )
    `);
    await db.execute(sql`
      UPDATE sfdc_leads
      SET account_id = NULL,
          converted_contact_id = NULL
      WHERE account_id IN (
        SELECT id FROM sales_accounts WHERE tenant_id = ${tenantId}
      )
         OR converted_contact_id IN (
        SELECT id FROM sales_contacts WHERE account_id IN (
          SELECT id FROM sales_accounts WHERE tenant_id = ${tenantId}
        )
      )
    `);

    await db.delete(salesAccountsTable).where(eq(salesAccountsTable.tenantId, tenantId));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/accounts error:", err);
    res.status(500).json({ error: "Failed to clear accounts" });
  }
});

// ─── Token generation helper ────────────────────────────────
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

// GET /accounts/:id/microsites — list distinct pages for this account
router.get("/accounts/:id/microsites", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const accountId = Number(req.params.id);

    // Verify account belongs to this tenant
    const [account] = await db.select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, accountId)));
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Path A: pages found through hotlinks on this account's contacts
    const contacts = await db.select({ id: salesContactsTable.id })
      .from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, accountId));

    const allHotlinks: Array<typeof salesHotlinksTable.$inferSelect> = [];
    for (const contact of contacts) {
      const hl = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, contact.id));
      allHotlinks.push(...hl);
    }

    const hotlinkPageIds = new Set(allHotlinks.map(h => h.pageId));

    // Path B: pages tagged with salesAccountId in pageVariables (scoped to tenant)
    const taggedPages = await db.select().from(lpPagesTable)
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        sql`${lpPagesTable.pageVariables}->>'salesAccountId' = ${String(accountId)}`
      ));

    const taggedPageIds = new Set(taggedPages.map(p => p.id));

    // Merge all distinct page IDs
    const allPageIds = new Set([...hotlinkPageIds, ...taggedPageIds]);

    if (allPageIds.size === 0) {
      res.json([]);
      return;
    }

    // Fetch page details and aggregate hotlink counts
    const results = [];
    for (const pageId of allPageIds) {
      const page = taggedPages.find(p => p.id === pageId) ??
        (await db.select().from(lpPagesTable).where(
          and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId))
        ))[0];
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
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const accountId = Number(req.params.id);

    // Verify account belongs to this tenant
    const [account] = await db.select({ id: salesAccountsTable.id })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, accountId)));
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

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
        sfdcContactId: contact.salesforceId ?? null,
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
