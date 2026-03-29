import { Router } from "express";
import { eq, desc, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable } from "@workspace/db";

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
  const { name, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [account] = await db
      .insert(salesAccountsTable)
      .values({
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
    const { name, domain, industry, segment, parentAccountId, status, owner, notes, metadata } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
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

export default router;
