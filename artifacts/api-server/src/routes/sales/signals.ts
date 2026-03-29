import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesSignalsTable } from "@workspace/db";

const router = Router();

// List signals with optional filters
router.get("/signals", async (req, res): Promise<void> => {
  try {
    const { type, accountId, limit: limitStr } = req.query;
    const limit = Math.min(Number(limitStr) || 50, 200);

    let query = db.select().from(salesSignalsTable);

    if (type && typeof type === "string") {
      query = query.where(eq(salesSignalsTable.type, type)) as typeof query;
    }
    if (accountId) {
      query = query.where(eq(salesSignalsTable.accountId, Number(accountId))) as typeof query;
    }

    const signals = await query
      .orderBy(desc(salesSignalsTable.createdAt))
      .limit(limit);

    res.json(signals);
  } catch (err) {
    console.error("GET /sales/signals error:", err);
    res.status(500).json({ error: "Failed to load signals" });
  }
});

// Create a signal (used internally by tracking endpoints)
router.post("/signals", async (req, res): Promise<void> => {
  const { accountId, contactId, hotlinkId, type, source, metadata } = req.body;
  if (!type) {
    res.status(400).json({ error: "type is required" });
    return;
  }
  try {
    const [signal] = await db
      .insert(salesSignalsTable)
      .values({
        accountId: accountId ?? null,
        contactId: contactId ?? null,
        hotlinkId: hotlinkId ?? null,
        type,
        source: source ?? null,
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(signal);
  } catch (err) {
    console.error("POST /sales/signals error:", err);
    res.status(500).json({ error: "Failed to create signal" });
  }
});

export default router;
