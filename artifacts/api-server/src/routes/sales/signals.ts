import { Router, type Response } from "express";
import { eq, desc, and, gte, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesSignalsTable,
  salesAccountsTable,
  salesContactsTable,
  salesEmailSendsTable,
} from "@workspace/db";
import { sfdcService } from "../../lib/sfdc-service";

const router = Router();

// ─── SSE connection pool ────────────────────────────────────
const sseClients = new Set<Response>();

function broadcastSignal(signal: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(signal)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}

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
    const { type, accountId, contactId, limit: limitStr } = req.query;
    const limit = Math.min(Number(limitStr) || 50, 200);

    const conditions: ReturnType<typeof eq>[] = [];
    if (type && typeof type === "string") {
      conditions.push(eq(salesSignalsTable.type, type));
    }
    if (accountId) {
      conditions.push(eq(salesSignalsTable.accountId, Number(accountId)));
    }
    if (contactId) {
      conditions.push(eq(salesSignalsTable.contactId, Number(contactId)));
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

    // Broadcast to all connected SSE clients
    broadcastSignal(signal);

    // SFDC write-back: recalculate engagement score and push to SFDC (fire-and-forget)
    if (signal.contactId) {
      pushEngagementScoreToSfdc(signal.contactId).catch(() => {/* non-blocking */});
    }

    res.status(201).json(signal);
  } catch (err) {
    console.error("POST /sales/signals error:", err);
    res.status(500).json({ error: "Failed to create signal" });
  }
});

/**
 * Recalculate a contact's engagement score from their signals and push to SFDC.
 * Score weights: form_submit=5, email_click/link_click=3, email_open=2, page_view=1
 * Recency boost: 1.5x for signals within 7 days
 */
async function pushEngagementScoreToSfdc(contactId: number): Promise<void> {
  try {
    // Get the contact to check for salesforceId
    const [contact] = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.id, contactId));
    if (!contact?.salesforceId) return;

    const conn = await sfdcService.getActiveConnection();
    if (!conn) return;

    // Get all signals for this contact
    const signals = await db.select().from(salesSignalsTable)
      .where(eq(salesSignalsTable.contactId, contactId));

    const weights: Record<string, number> = {
      form_submit: 5,
      email_click: 3,
      link_click: 3,
      email_open: 2,
      page_view: 1,
      email_sent: 0, // outbound action, doesn't count for engagement
    };

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let score = 0;

    for (const sig of signals) {
      const weight = weights[sig.type] ?? 1;
      const isRecent = sig.createdAt && new Date(sig.createdAt).getTime() > sevenDaysAgo;
      score += weight * (isRecent ? 1.5 : 1);
    }

    // Determine label
    let label: string;
    if (score >= 15) label = "Hot";
    else if (score >= 8) label = "Warm";
    else if (score >= 3) label = "Cool";
    else label = "Cold";

    await sfdcService.pushEngagementScore(conn.id, contact.salesforceId, {
      label,
      numericScore: Math.round(score),
    });
  } catch {
    // Non-blocking — don't let SFDC errors affect signal creation
  }
}

export { broadcastSignal };
export default router;
