import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";

const router = Router();

// List all contacts (optionally filter by accountId)
router.get("/contacts", async (req, res): Promise<void> => {
  try {
    const { accountId } = req.query;
    const query = db.select().from(salesContactsTable);

    let contacts;
    if (accountId) {
      contacts = await query
        .where(eq(salesContactsTable.accountId, Number(accountId)))
        .orderBy(desc(salesContactsTable.createdAt));
    } else {
      contacts = await query.orderBy(desc(salesContactsTable.createdAt));
    }
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
  const { accountId, firstName, lastName, email, title, role, phone, status, metadata } = req.body;
  if (!accountId || !firstName || !lastName) {
    res.status(400).json({ error: "accountId, firstName, and lastName are required" });
    return;
  }
  try {
    const [contact] = await db
      .insert(salesContactsTable)
      .values({
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
    const fields = ["firstName", "lastName", "email", "title", "role", "phone", "status", "metadata"];
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

export default router;
