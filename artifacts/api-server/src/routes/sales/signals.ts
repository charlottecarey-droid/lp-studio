import { getTenantId } from "../../middleware/requireAuth";
import { Router, type Response } from "express";
import { eq, desc, and, gte, count, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesSignalsTable,
  salesAccountsTable,
  salesContactsTable,
  salesEmailSendsTable,
} from "@workspace/db";
import { sfdcService } from "../../lib/sfdc-service";
import { marketoService } from "../../lib/marketo-service";
import { restoreRows } from "../../lib/restoreRows";
import { resolveSignalLinkage } from "../../lib/signalAttribution";

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
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [[{ signalsToday }], [{ emailsSent }]] = await Promise.all([
      db.select({ signalsToday: count() })
        .from(salesSignalsTable)
        .where(and(eq(salesSignalsTable.tenantId, tenantId), gte(salesSignalsTable.createdAt, todayStart))),
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
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { type, accountId, contactId, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(Number(limitStr) || 50, 500);
    const offset = Math.max(Number(offsetStr) || 0, 0);

    const conditions: ReturnType<typeof eq>[] = [
      eq(salesSignalsTable.tenantId, tenantId),
    ];
    if (type && typeof type === "string") {
      conditions.push(eq(salesSignalsTable.type, type));
    }
    if (accountId) {
      conditions.push(eq(salesSignalsTable.accountId, Number(accountId)));
    }
    if (contactId) {
      conditions.push(eq(salesSignalsTable.contactId, Number(contactId)));
    }

    const whereClause = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: salesSignalsTable.id,
          accountId: salesSignalsTable.accountId,
          contactId: salesSignalsTable.contactId,
          hotlinkId: salesSignalsTable.hotlinkId,
          type: salesSignalsTable.type,
          source: salesSignalsTable.source,
          metadata: salesSignalsTable.metadata,
          createdAt: salesSignalsTable.createdAt,
          // Clean display form for the feed (falls back to raw name).
          accountName: sql<string>`COALESCE(${salesAccountsTable.displayName}, ${salesAccountsTable.name})`,
          contactFirstName: salesContactsTable.firstName,
          contactLastName: salesContactsTable.lastName,
          contactEmail: salesContactsTable.email,
        })
        .from(salesSignalsTable)
        .leftJoin(salesAccountsTable, eq(salesSignalsTable.accountId, salesAccountsTable.id))
        .leftJoin(salesContactsTable, eq(salesSignalsTable.contactId, salesContactsTable.id))
        .where(whereClause)
        .orderBy(desc(salesSignalsTable.createdAt))
        .offset(offset)
        .limit(limit),
      db.select({ total: count() }).from(salesSignalsTable).where(whereClause),
    ]);

    // Resilience: some signals (e.g. integration-pushed or legacy "outreach"
    // rows) arrive without a contactId. Rather than render a blank/anonymous
    // row, resolve a display name from any email left in metadata via a
    // tenant-scoped match. Batch one query for all such emails. This NEVER
    // falls back to a global lookup — the match is strictly scoped to this
    // tenant so attribution can't leak across tenants.
    const unresolvedEmails = Array.from(new Set(
      rows
        .filter((s) => !s.contactFirstName && !s.contactLastName)
        .map((s) => {
          const meta = (s.metadata ?? {}) as Record<string, unknown>;
          const email = typeof meta.email === "string" ? meta.email.trim().toLowerCase() : "";
          return email;
        })
        .filter((e): e is string => e.length > 0),
    ));

    const emailToName = new Map<string, string>();
    if (unresolvedEmails.length > 0) {
      const matched = await db
        .select({
          email: salesContactsTable.email,
          firstName: salesContactsTable.firstName,
          lastName: salesContactsTable.lastName,
        })
        .from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.tenantId, tenantId),
          inArray(salesContactsTable.email, unresolvedEmails),
        ));
      for (const c of matched) {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
        if (c.email && name) emailToName.set(c.email.trim().toLowerCase(), name);
      }
    }

    const signals = rows.map((s) => {
      const joinedName = [s.contactFirstName, s.contactLastName].filter(Boolean).join(" ") || null;
      let contactName = joinedName;
      if (!contactName) {
        const meta = (s.metadata ?? {}) as Record<string, unknown>;
        const email = typeof meta.email === "string" ? meta.email.trim().toLowerCase() : "";
        if (email && emailToName.has(email)) contactName = emailToName.get(email)!;
      }
      return {
        ...s,
        accountName: s.accountName ?? null,
        contactName,
      };
    });

    res.json({ data: signals, totalCount: total });
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
  res.setHeader("X-Accel-Buffering", "no");

  res.write("data: {\"type\":\"connected\"}\n\n");
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); sseClients.delete(res); }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ─── DELETE /sales/signals — clear all signals for tenant ──────────────────
router.delete("/signals", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const deleted = await db.delete(salesSignalsTable)
      .where(eq(salesSignalsTable.tenantId, tenantId))
      .returning();
    res.json({ ok: true, deleted: deleted.length, restore: { signals: deleted } });
  } catch (err) {
    console.error("DELETE /sales/signals error:", err);
    res.status(500).json({ error: "Failed to clear signals" });
  }
});

// Restore signals deleted via Undo (single delete or clear-all).
router.post("/signals/restore", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const { signals } = req.body as { signals?: unknown[] };
    const restored = await restoreRows(salesSignalsTable, signals, { tenantId });
    res.json({ ok: true, restored });
  } catch (err) {
    console.error("POST /sales/signals/restore error:", err);
    res.status(500).json({ error: "Failed to restore signals" });
  }
});

// ─── DELETE /sales/signals/:id — delete a single signal ────────────────────
router.delete("/signals/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid signal id" });
      return;
    }
    const [deleted] = await db.delete(salesSignalsTable)
      .where(and(
        eq(salesSignalsTable.tenantId, tenantId),
        eq(salesSignalsTable.id, id),
      ))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }
    res.json({ ok: true, restore: { signals: [deleted] } });
  } catch (err) {
    console.error("DELETE /sales/signals/:id error:", err);
    res.status(500).json({ error: "Failed to delete signal" });
  }
});

// ─── POST /sales/signals — create a signal ──────────────────

router.post("/signals", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { accountId, contactId, hotlinkId, type, source, metadata } = req.body;
  if (!type) {
    res.status(400).json({ error: "type is required" });
    return;
  }
  try {
    // Attribute the signal to a contact + account whenever possible so the
    // activity feed never shows a blank/anonymous row and accounts roll up
    // engagement. If the caller (e.g. an integration) didn't supply ids, resolve
    // them from the identity left in metadata (email / LinkedIn / company domain
    // / company name) via the shared, strictly tenant-scoped matcher — never a
    // global lookup, which would leak attribution across tenants.
    const meta = (metadata ?? {}) as Record<string, unknown>;
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
    let resolvedContactId: number | null = contactId ?? null;
    let resolvedAccountId: number | null = accountId ?? null;
    if (resolvedContactId == null || resolvedAccountId == null) {
      const match = await resolveSignalLinkage(tenantId, {
        email: str(meta.email),
        linkedinUrl: str(meta.linkedinUrl),
        companyDomain: str(meta.companyDomain),
        companyName: str(meta.companyName),
      });
      if (resolvedContactId == null) resolvedContactId = match.contactId;
      if (resolvedAccountId == null) resolvedAccountId = match.accountId;
    }

    const [signal] = await db
      .insert(salesSignalsTable)
      .values({
        tenantId,
        accountId: resolvedAccountId,
        contactId: resolvedContactId,
        hotlinkId: hotlinkId ?? null,
        type,
        source: source ?? null,
        metadata: metadata ?? {},
      })
      .returning();

    broadcastSignal(signal);

    if (signal.contactId) {
      pushEngagementScoreToSfdc(tenantId, signal.contactId).catch(() => {/* non-blocking */});
      pushEngagementScoreToMarketo(signal.contactId, tenantId, signal.id).catch(() => {/* non-blocking */});
    }

    res.status(201).json(signal);
  } catch (err) {
    console.error("POST /sales/signals error:", err);
    res.status(500).json({ error: "Failed to create signal" });
  }
});

async function pushEngagementScoreToSfdc(tenantId: number, contactId: number): Promise<void> {
  try {
    // Tenant-scope the contact lookup so this tenant can never push an
    // engagement score for another tenant's contact, and resolve the SFDC
    // connection for this tenant only.
    const [contact] = await db.select().from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.id, contactId),
        eq(salesContactsTable.tenantId, tenantId),
      ));
    if (!contact?.salesforceId) return;

    const conn = await sfdcService.getActiveConnection(tenantId);
    if (!conn) return;

    const signals = await db.select().from(salesSignalsTable)
      .where(eq(salesSignalsTable.contactId, contactId));

    const weights: Record<string, number> = {
      form_submit: 5,
      email_click: 3,
      link_click:  3,
      email_open:  2,
      page_view:   1,
      email_sent:  0,
    };

    /** Source + activity-aware weight for visitor_identified signals. */
    function visitorWeight(sig: typeof signals[number]): number {
      const source = sig.source ?? "";
      const meta   = (sig.metadata ?? {}) as Record<string, string | undefined>;
      if (source === "rb2b")        return 3;  // specific person on LP page
      if (source === "apollo")      return 2;  // company-level on LP page
      if (source === "letterdrop") {
        const activity = meta.activityType ?? meta.lastActivity ?? "";
        if (activity.includes("comment"))              return 4;
        if (activity.includes("organization_follower")) return 2;
        if (activity.includes("profile_view"))          return 1;
        return 2;
      }
      return 2; // default for unknown sources
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let score = 0;

    for (const sig of signals) {
      const weight = sig.type === "visitor_identified"
        ? visitorWeight(sig)
        : (weights[sig.type] ?? 1);
      const isRecent = sig.createdAt && new Date(sig.createdAt).getTime() > sevenDaysAgo;
      score += weight * (isRecent ? 1.5 : 1);
    }

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
    // Non-blocking
  }
}

/**
 * Marketo write-back: push the recomputed engagement score (Phase 2). Mirrors
 * the SFDC twin but is tenant-scoped (Marketo getActiveConnection REQUIRES a
 * tenantId) and gated on the contact having a marketoLeadId AND the connection
 * having sync enabled. Idempotent per signal id. Salesforce stays
 * system-of-record for shared fields — this only writes engagement fields.
 */
async function pushEngagementScoreToMarketo(contactId: number, tenantId: number, signalId: number): Promise<void> {
  try {
    const [contact] = await db.select().from(salesContactsTable)
      .where(eq(salesContactsTable.id, contactId));
    if (!contact?.marketoLeadId) return;

    const conn = await marketoService.getActiveConnection(tenantId);
    if (!conn) return;

    const signals = await db.select().from(salesSignalsTable)
      .where(eq(salesSignalsTable.contactId, contactId));

    const weights: Record<string, number> = {
      form_submit: 5,
      email_click: 3,
      link_click:  3,
      email_open:  2,
      page_view:   1,
      email_sent:  0,
    };

    function visitorWeight(sig: typeof signals[number]): number {
      const source = sig.source ?? "";
      const meta   = (sig.metadata ?? {}) as Record<string, string | undefined>;
      if (source === "rb2b")        return 3;
      if (source === "apollo")      return 2;
      if (source === "letterdrop") {
        const activity = meta.activityType ?? meta.lastActivity ?? "";
        if (activity.includes("comment"))               return 4;
        if (activity.includes("organization_follower")) return 2;
        if (activity.includes("profile_view"))          return 1;
        return 2;
      }
      return 2;
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let score = 0;
    for (const sig of signals) {
      const weight = sig.type === "visitor_identified"
        ? visitorWeight(sig)
        : (weights[sig.type] ?? 1);
      const isRecent = sig.createdAt && new Date(sig.createdAt).getTime() > sevenDaysAgo;
      score += weight * (isRecent ? 1.5 : 1);
    }

    let label: string;
    if (score >= 15) label = "Hot";
    else if (score >= 8) label = "Warm";
    else if (score >= 3) label = "Cool";
    else label = "Cold";

    await marketoService.pushEngagementScore(conn.id, tenantId, {
      localEventId: `engagement_score:${signalId}`,
      marketoLeadId: Number(contact.marketoLeadId),
      label,
      numericScore: Math.round(score),
    });
  } catch {
    // Non-blocking
  }
}

export { broadcastSignal };
export default router;
