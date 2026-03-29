import { Router } from "express";
import { eq, desc, and, gte, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesSignalsTable,
  salesAccountsTable,
  salesContactsTable,
  salesEmailSendsTable,
} from "@workspace/db";

const router = Router();

// ─── GET /sales/stats — dashboard summary counts ────────────

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [[{ signalsToday }], [{ emailsSent }]] = await Promise.all([
      db.select({ signalsToday: count() })
        .from(salesSignalsTable)
        .where(gte(salesSignalsTable.createdAt, todayStart)),
      db.select({ emailsSent: count() })
        .from(salesEmailSendsTable)
        .where(eq(salesEmailSendsTable.status, "sent")),
    ]);

    res.json({ signalsToday, emailsSent });
  } catch (err) {
    console.error("GET /sales/stats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── GET /sales/signals — list signals with names ───────────

router.get("/signals", async (req, res): Promise<void> => {
  try {
    const { type, accountId, limit: limitStr } = req.query;
    const limit = Math.min(Number(limitStr) || 50, 200);

    const conditions: ReturnType<typeof eq>[] = [];
    if (type && typeof type === "string") {
      conditions.push(eq(salesSignalsTable.type, type));
    }
    if (accountId) {
      conditions.push(eq(salesSignalsTable.accountId, Number(accountId)));
    }

    const rows = await db
      .select({
        id: salesSignalsTable.id,
        accountId: salesSignalsTable.accountId,
        contactId: salesSignalsTable.contactId,
        hotlinkId: salesSignalsTable.hotlinkId,
        type: salesSignalsTable.type,
        source: salesSignalsTable.source,
        metadata: salesSignalsTable.metadata,
        createdAt: salesSignalsTable.createdAt,
        accountName: salesAccountsTable.name,
        contactFirstName: salesContactsTable.firstName,
        contactLastName: salesContactsTable.lastName,
        contactEmail: salesContactsTable.email,
      })
      .from(salesSignalsTable)
      .leftJoin(salesAccountsTable, eq(salesSignalsTable.accountId, salesAccountsTable.id))
      .leftJoin(salesContactsTable, eq(salesSignalsTable.contactId, salesContactsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(salesSignalsTable.createdAt))
      .limit(limit);

    const signals = rows.map((s) => ({
      ...s,
      accountName: s.accountName ?? null,
      contactName: [s.contactFirstName, s.contactLastName].filter(Boolean).join(" ") || null,
    }));

    res.json(signals);
  } catch (err) {
    console.error("GET /sales/signals error:", err);
    res.status(500).json({ error: "Failed to load signals" });
  }
});

// ─── POST /sales/signals — create a signal ──────────────────

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
