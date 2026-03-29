import { Router, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesSignalsTable } from "@workspace/db";

const router = Router();

// ─── SSE connection pool ────────────────────────────────────
const sseClients = new Set<Response>();

function broadcastSignal(signal: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(signal)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}

// List signals with optional filters
router.get("/signals", async (req, res): Promise<void> => {
  try {
    const { type, accountId, contactId, limit: limitStr } = req.query;
    const limit = Math.min(Number(limitStr) || 50, 200);

    let query = db.select().from(salesSignalsTable);

    if (type && typeof type === "string") {
      query = query.where(eq(salesSignalsTable.type, type)) as typeof query;
    }
    if (accountId) {
      query = query.where(eq(salesSignalsTable.accountId, Number(accountId))) as typeof query;
    }
    if (contactId) {
      query = query.where(eq(salesSignalsTable.contactId, Number(contactId))) as typeof query;
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

// SSE stream for real-time signal updates
router.get("/signals/stream", (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx pass-through

  res.write("data: {\"type\":\"connected\"}\n\n");
  sseClients.add(res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); sseClients.delete(res); }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
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

    // Broadcast to all connected SSE clients
    broadcastSignal(signal);

    res.status(201).json(signal);
  } catch (err) {
    console.error("POST /sales/signals error:", err);
    res.status(500).json({ error: "Failed to create signal" });
  }
});

export { broadcastSignal };
export default router;
