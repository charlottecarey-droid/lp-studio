/**
 * Superadmin support desk — the read/triage side of support_tickets (the
 * rows the support chat bot files on escalate_to_support) plus platform-wide
 * support analytics over the support_guide transcript substrate.
 *
 * All routes are /admin/support-* with requireSuperadmin per route. Like
 * blockCatalogRouter, this router MUST mount before adminRouter so these
 * paths match before adminRouter's blanket requireAuth wildcard.
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  supportTicketsTable,
  tenantsTable,
  conversationsTable,
  conversationMessagesTable,
} from "@workspace/db";
import { sql, eq, and, desc, asc } from "drizzle-orm";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import { rateLimit, envLimit } from "../lib/rateLimit";
import { parseChatInsights } from "./lp/chat-analytics";
import { logger } from "../lib/logger";

const router = Router();

/* ------------------------------------------------------------------ */
/*  GET /admin/support-tickets — triage list + counts                  */
/* ------------------------------------------------------------------ */

router.get("/admin/support-tickets", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const status = req.query.status === "resolved" ? "resolved" : req.query.status === "all" ? null : "open";
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "90", 10) || 90));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    const rows = await db
      .select({
        id: supportTicketsTable.id,
        tenantId: supportTicketsTable.tenantId,
        tenantName: tenantsTable.name,
        conversationId: supportTicketsTable.conversationId,
        userEmail: supportTicketsTable.userEmail,
        userName: supportTicketsTable.userName,
        summary: supportTicketsTable.summary,
        currentPath: supportTicketsTable.currentPath,
        status: supportTicketsTable.status,
        adminNotes: supportTicketsTable.adminNotes,
        createdAt: supportTicketsTable.createdAt,
        resolvedAt: supportTicketsTable.resolvedAt,
      })
      .from(supportTicketsTable)
      .leftJoin(tenantsTable, eq(tenantsTable.id, supportTicketsTable.tenantId))
      .where(and(
        sql`${supportTicketsTable.createdAt} > ${dateFilter}`,
        ...(status ? [eq(supportTicketsTable.status, status)] : []),
      ))
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(200);

    // Header counts are window-independent for "open" (an old open ticket
    // still needs triage) and windowed for volume.
    const [counts] = await db
      .select({
        open: sql<number>`count(*) filter (where ${supportTicketsTable.status} = 'open')::int`,
        windowTotal: sql<number>`count(*) filter (where ${supportTicketsTable.createdAt} > ${dateFilter})::int`,
      })
      .from(supportTicketsTable);

    const [convCount] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.mode, "support_guide"),
        sql`${conversationsTable.createdAt} > ${dateFilter}`,
      ));

    res.json({
      tickets: rows,
      openCount: counts?.open ?? 0,
      windowCount: counts?.windowTotal ?? 0,
      conversationCount: convCount?.total ?? 0,
      period: `${days}d`,
    });
  } catch (err) {
    logger.error({ err: String(err) }, "[support-tickets] list failed");
    res.status(500).json({ error: "Failed to load support tickets" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /admin/support-tickets/:id/transcript — cross-tenant read      */
/* ------------------------------------------------------------------ */

router.get("/admin/support-tickets/:id/transcript", requireSuperadmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }
  try {
    const [ticket] = await db
      .select({ conversationId: supportTicketsTable.conversationId })
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id));
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (ticket.conversationId == null) {
      res.json({ conversationId: null, messages: [] });
      return;
    }
    const messages = await db
      .select({
        role: conversationMessagesTable.role,
        content: conversationMessagesTable.content,
        createdAt: conversationMessagesTable.createdAt,
      })
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, ticket.conversationId))
      .orderBy(asc(conversationMessagesTable.createdAt), asc(conversationMessagesTable.id));
    res.json({ conversationId: ticket.conversationId, messages });
  } catch (err) {
    logger.error({ err: String(err), ticketId: id }, "[support-tickets] transcript failed");
    res.status(500).json({ error: "Failed to load transcript" });
  }
});

/* ------------------------------------------------------------------ */
/*  PATCH /admin/support-tickets/:id — resolve / reopen / notes        */
/* ------------------------------------------------------------------ */

router.patch("/admin/support-tickets/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }
  const body = req.body as { status?: unknown; adminNotes?: unknown };
  const updates: Partial<{ status: string; resolvedAt: Date | null; adminNotes: string | null }> = {};
  if (body.status !== undefined) {
    if (body.status !== "open" && body.status !== "resolved") {
      res.status(400).json({ error: "status must be 'open' or 'resolved'" });
      return;
    }
    updates.status = body.status;
    updates.resolvedAt = body.status === "resolved" ? new Date() : null;
  }
  if (body.adminNotes !== undefined) {
    if (body.adminNotes !== null && typeof body.adminNotes !== "string") {
      res.status(400).json({ error: "adminNotes must be a string or null" });
      return;
    }
    updates.adminNotes = body.adminNotes === null ? null : (body.adminNotes as string).slice(0, 4000);
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  try {
    const [updated] = await db
      .update(supportTicketsTable)
      .set(updates)
      .where(eq(supportTicketsTable.id, id))
      .returning({ id: supportTicketsTable.id, status: supportTicketsTable.status });
    if (!updated) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error({ err: String(err), ticketId: id }, "[support-tickets] update failed");
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /admin/support-insights — cross-tenant question clustering    */
/* ------------------------------------------------------------------ */

const supportInsightsLimiter = rateLimit({
  name: "support-insights",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_CHAT_INSIGHTS_PER_MIN", 4),
});

const INSIGHTS_MODEL = process.env["CONVERSATION_MODEL"] ?? "gpt-4o";
const MAX_INSIGHT_MESSAGES = 200;

router.post("/admin/support-insights", requireSuperadmin, supportInsightsLimiter, async (req, res): Promise<void> => {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    res.status(503).json({ error: "AI integration not configured." });
    return;
  }
  try {
    const days = Math.max(1, Math.min(365, parseInt(String((req.body as { days?: unknown } | undefined)?.days ?? ""), 10) || 30));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    // Cross-tenant by design: this is the platform product-gap radar —
    // which is exactly why it's superadmin-gated.
    const rows = await db
      .select({ content: conversationMessagesTable.content })
      .from(conversationMessagesTable)
      .innerJoin(conversationsTable, eq(conversationsTable.id, conversationMessagesTable.conversationId))
      .where(and(
        eq(conversationsTable.mode, "support_guide"),
        eq(conversationMessagesTable.role, "user"),
        sql`${conversationMessagesTable.createdAt} > ${dateFilter}`,
        sql`length(${conversationMessagesTable.content}) > 1`,
      ))
      .orderBy(desc(conversationMessagesTable.createdAt))
      .limit(MAX_INSIGHT_MESSAGES);

    if (rows.length < 3) {
      res.json({ analyzedCount: rows.length, summary: "", themes: [], tooFewQuestions: true });
      return;
    }

    const questions = rows.map(r => r.content.slice(0, 300));
    const openai = new OpenAI({ baseURL, apiKey });
    const completion = await openai.chat.completions.create({
      model: INSIGHTS_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You analyze questions that LP Studio tenants asked the in-app support assistant. " +
            "Cluster them into recurring support topics — this is the product team's radar for " +
            "what confuses users. Respond with JSON: " +
            '{"summary": string, "themes": [{"theme": string, "count": number, "examples": string[], "suggestion": string}]}. ' +
            "Rules: `summary` is 1-2 sentences on the overall pattern. Each theme names ONE " +
            "recurring question/confusion; `count` is how many messages fit it; `examples` are " +
            "up to 2 short VERBATIM quotes; `suggestion` is one actionable sentence for the " +
            "product team (a docs gap, a UX fix, or a missing feature). Order by count, max 8. " +
            "Ignore greetings and one-word replies.",
        },
        {
          role: "user",
          content: `Support questions (newest first):\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
        },
      ],
    });

    const parsed = parseChatInsights(completion.choices[0]?.message?.content ?? "");
    res.json({ analyzedCount: rows.length, ...parsed });
  } catch (err) {
    logger.error({ err: String(err) }, "[support-insights] failed");
    res.status(502).json({ error: "Analysis failed — please try again." });
  }
});

export default router;
