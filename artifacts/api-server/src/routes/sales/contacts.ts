import { Router } from "express";
import { eq, desc, and, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";

const router = Router();

// List all contacts (optionally filter by accountId) — joins accounts for segment/stage/owner
router.get("/contacts", async (req, res): Promise<void> => {
  try {
    const { accountId } = req.query;
    const baseQuery = db
      .select({
        id: salesContactsTable.id,
        salesforceId: salesContactsTable.salesforceId,
        accountId: salesContactsTable.accountId,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        email: salesContactsTable.email,
        title: salesContactsTable.title,
        role: salesContactsTable.role,
        phone: salesContactsTable.phone,
        tier: salesContactsTable.tier,
        titleLevel: salesContactsTable.titleLevel,
        contactRole: salesContactsTable.contactRole,
        department: salesContactsTable.department,
        linkedinUrl: salesContactsTable.linkedinUrl,
        status: salesContactsTable.status,
        createdAt: salesContactsTable.createdAt,
        // From accounts join
        accountName: salesAccountsTable.name,
        abmTier: salesAccountsTable.abmTier,
        abmStage: salesAccountsTable.abmStage,
        practiceSegment: salesAccountsTable.practiceSegment,
        accountOwner: salesAccountsTable.owner,
        dsoSize: salesAccountsTable.dsoSize,
      })
      .from(salesContactsTable)
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id));

    const contacts = accountId
      ? await baseQuery.where(eq(salesContactsTable.accountId, Number(accountId))).orderBy(desc(salesContactsTable.createdAt))
      : await baseQuery.orderBy(desc(salesContactsTable.createdAt));

    res.json(contacts);
  } catch (err) {
    console.error("GET /sales/contacts error:", err);
    res.status(500).json({ error: "Failed to load contacts" });
  }
});

// Get contacts for a specific account (nested route)
router.get("/accounts/:accountId/contacts", async (req, res): Promise<void> => {
  try {
    const contacts = await db
      .select()
      .from(salesContactsTable)
      .where(eq(salesContactsTable.accountId, Number(req.params.accountId)))
      .orderBy(desc(salesContactsTable.createdAt));
    res.json(contacts);
  } catch (err) {
    console.error("GET /sales/accounts/:id/contacts error:", err);
    res.status(500).json({ error: "Failed to load contacts" });
  }
});

// Get single contact by id
router.get("/contacts/:id", async (req, res): Promise<void> => {
  try {
    const [contact] = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.id, Number(req.params.id)));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json(contact);
  } catch (err) {
    console.error("GET /sales/contacts/:id error:", err);
    res.status(500).json({ error: "Failed to load contact" });
  }
});

// Create contact
router.post("/contacts", async (req, res): Promise<void> => {
  const { accountId, sfdcId, firstName, lastName, email, title, role, phone, status, metadata } = req.body;
  if (!accountId || !firstName || !lastName) {
    res.status(400).json({ error: "accountId, firstName, and lastName are required" });
    return;
  }
  try {
    const [contact] = await db
      .insert(salesContactsTable)
      .values({
        sfdcId: sfdcId ?? null,
        accountId: Number(accountId),
        firstName,
        lastName,
        email: email ?? null,
        title: title ?? null,
        role: role ?? null,
        phone: phone ?? null,
        status: status ?? "active",
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(contact);
  } catch (err) {
    console.error("POST /sales/contacts error:", err);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

// Update contact
router.patch("/contacts/:id", async (req, res): Promise<void> => {
  try {
    const updates: Record<string, unknown> = {};
    const fields = ["sfdcId", "firstName", "lastName", "email", "title", "role", "phone", "status", "metadata"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const [updated] = await db
      .update(salesContactsTable)
      .set(updates)
      .where(eq(salesContactsTable.id, Number(req.params.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /sales/contacts/:id error:", err);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// Delete contact
router.delete("/contacts/:id", async (req, res): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(salesContactsTable)
      .where(eq(salesContactsTable.id, Number(req.params.id)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/contacts/:id error:", err);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// Delete ALL contacts
router.delete("/contacts", async (_req, res): Promise<void> => {
  try {
    const deleted = await db.delete(salesContactsTable).returning({ id: salesContactsTable.id });
    res.json({ ok: true, deleted: deleted.length });
  } catch (err) {
    console.error("DELETE /sales/contacts error:", err);
    res.status(500).json({ error: "Failed to delete contacts" });
  }
});

// ─── Bulk CSV Import ─────────────────────────────────────────
// Accepts an array of mapped rows; finds-or-creates accounts by name,
// deduplicates contacts by email+accountId, returns result counts.
interface ImportRow {
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  role?: string;
  phone?: string;
  tier?: string;
  titleLevel?: string;
  contactRole?: string;
  department?: string;
  linkedinUrl?: string;
  status?: string;
  sfdcAccountId?: string;  // Salesforce Account ID — preferred join key
  accountName?: string;    // Account name — fallback join key
  accountId?: number;
  accountDomain?: string;
  accountSegment?: string;
  accountIndustry?: string;
}

router.post("/contacts/import", async (req, res): Promise<void> => {
  const { rows } = req.body as { rows: ImportRow[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required and must not be empty" });
    return;
  }

  let created = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  // Cache account lookups within the request to avoid redundant queries
  const accountCache = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.firstName?.trim() || !row.lastName?.trim()) {
        errors.push({ row: i + 1, message: "Missing first or last name" });
        continue;
      }

      let accountId = row.accountId ? Number(row.accountId) : null;

      // Find or create account by name if no accountId provided
      if (!accountId && row.accountName?.trim()) {
        const normalizedName = row.accountName.trim().toLowerCase();
        if (accountCache.has(normalizedName)) {
          accountId = accountCache.get(normalizedName)!;
        } else {
          const [existing] = await db
            .select({ id: salesAccountsTable.id })
            .from(salesAccountsTable)
            .where(ilike(salesAccountsTable.name, row.accountName.trim()))
            .limit(1);

          if (existing) {
            accountId = existing.id;
          } else {
            const [newAccount] = await db
              .insert(salesAccountsTable)
              .values({
                name: row.accountName.trim(),
                domain: row.accountDomain?.trim() || null,
                segment: row.accountSegment?.trim() || null,
                industry: row.accountIndustry?.trim() || null,
                status: "prospect",
              })
              .returning({ id: salesAccountsTable.id });
            accountId = newAccount.id;
          }
          accountCache.set(normalizedName, accountId);
        }
      }

      if (!accountId) {
        errors.push({ row: i + 1, message: "No account name or accountId provided" });
        continue;
      }

      // Deduplicate by email + accountId
      if (row.email?.trim()) {
        const [dupCheck] = await db
          .select({ id: salesContactsTable.id })
          .from(salesContactsTable)
          .where(and(
            eq(salesContactsTable.accountId, accountId),
            ilike(salesContactsTable.email, row.email.trim()),
          ))
          .limit(1);

        if (dupCheck) {
          skipped++;
          continue;
        }
      }

      await db.insert(salesContactsTable).values({
        accountId,
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        email: row.email?.trim() || null,
        title: row.title?.trim() || null,
        role: row.role?.trim() || null,
        phone: row.phone?.trim() || null,
        status: "active",
      });
      created++;
    } catch (err) {
      errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  res.status(201).json({ created, skipped, errors, total: rows.length });
});

export default router;
