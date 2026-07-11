/**
 * Chat analytics — the tenant-facing read side of the lead-capture page bot
 * (the "visitor-question analytics" the June 2026 chatbot spec called the
 * most undervalued asset of the transcript substrate).
 *
 * Three endpoints, all auth'd + tenant-scoped via getTenantId:
 *   GET  /lp/analytics/chat            — conversation volume/trend, capture
 *                                        rate, chat-attributed leads +
 *                                        bookings, by-page, daily series.
 *   GET  /lp/analytics/chat/questions  — recent raw visitor messages (the
 *                                        demand/objection feed), linked to
 *                                        their conversation transcripts.
 *   POST /lp/analytics/chat/insights   — on-demand LLM clustering of those
 *                                        questions into themes ("12 visitors
 *                                        asked about pricing you don't
 *                                        show"). Never persisted; costs
 *                                        tokens, so rate-limited.
 *
 * Attribution contracts (all established elsewhere, read-only here):
 *   - conversations.mode = "lead_capture" marks page-bot threads.
 *   - chat-captured leads carry fields.Source = "Page chat" (BlockChatCapture).
 *   - chat-flow bookings carry fields._bookingOrigin = "chat" (booking hook).
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { conversationsTable, conversationMessagesTable, lpPagesTable, lpLeadsTable } from "@workspace/db";
import { sql, eq, and, desc, inArray } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { logger } from "../../lib/logger";

const router = Router();

const LEAD_CAPTURE_MODE = "lead_capture";

function clampDays(raw: unknown): number {
  return Math.max(1, Math.min(365, parseInt((raw as string) || "30", 10) || 30));
}

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/chat — volume, capture rate, attribution         */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/chat", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    const days = clampDays(req.query.days);
    const dateFilter = sql`now() - make_interval(days => ${days})`;
    const prevDateFilter = sql`now() - make_interval(days => ${days * 2})`;

    // Conversations across both windows in one read (overview idiom: bucket
    // against the same DB now() the filter uses).
    const convRows = await db
      .select({
        pageId: conversationsTable.pageId,
        createdAt: conversationsTable.createdAt,
        isCurrent: sql<boolean>`(${conversationsTable.createdAt} > ${dateFilter})`,
      })
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.tenantId, tenantId),
        eq(conversationsTable.mode, LEAD_CAPTURE_MODE),
        sql`${conversationsTable.createdAt} > ${prevDateFilter}`,
      ));

    let conversations = 0;
    let prevConversations = 0;
    const byPageCount = new Map<number, number>();
    const byDay = new Map<string, number>();
    for (const r of convRows) {
      if (!r.isCurrent) { prevConversations++; continue; }
      conversations++;
      if (r.pageId != null) byPageCount.set(r.pageId, (byPageCount.get(r.pageId) ?? 0) + 1);
      if (r.createdAt) {
        const day = new Date(r.createdAt).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
    }

    // Visitor (user-role) message volume for the current window — the
    // question count behind avg turns.
    const [msgAgg] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(conversationMessagesTable)
      .innerJoin(conversationsTable, eq(conversationsTable.id, conversationMessagesTable.conversationId))
      .where(and(
        eq(conversationsTable.tenantId, tenantId),
        eq(conversationsTable.mode, LEAD_CAPTURE_MODE),
        eq(conversationMessagesTable.role, "user"),
        sql`${conversationsTable.createdAt} > ${dateFilter}`,
      ));
    const visitorMessages = msgAgg?.total ?? 0;

    // Chat-attributed leads + bookings (both windows for the lead trend).
    const [chatLeadsAgg] = await db
      .select({
        cur: sql<number>`count(*) filter (where ${lpLeadsTable.createdAt} > ${dateFilter})::int`,
        prev: sql<number>`count(*) filter (where ${lpLeadsTable.createdAt} <= ${dateFilter})::int`,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        sql`${lpLeadsTable.fields} ->> 'Source' = 'Page chat'`,
        sql`${lpLeadsTable.createdAt} > ${prevDateFilter}`,
      ));

    const [chatBookingsAgg] = await db
      .select({ cur: sql<number>`count(*)::int` })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        sql`${lpLeadsTable.fields} ->> '_bookingOrigin' = 'chat'`,
        sql`${lpLeadsTable.createdAt} > ${dateFilter}`,
      ));

    // Zero-filled daily series so sparse chats still chart correctly.
    const series: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      series.push({ date: day, count: byDay.get(day) ?? 0 });
    }

    const pageIds = [...byPageCount.keys()];
    const pageRows = pageIds.length > 0
      ? await db
          .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug })
          .from(lpPagesTable)
          .where(and(eq(lpPagesTable.tenantId, tenantId), inArray(lpPagesTable.id, pageIds)))
      : [];
    const byPage = pageRows
      .map(p => ({ pageId: p.id, title: p.title, slug: p.slug, count: byPageCount.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const chatLeads = chatLeadsAgg?.cur ?? 0;
    const conversationsTrend = prevConversations > 0
      ? ((conversations - prevConversations) / prevConversations) * 100
      : (conversations > 0 ? 100 : 0);

    res.json({
      conversations,
      conversationsTrend,
      visitorMessages,
      avgTurns: conversations > 0 ? Math.round((visitorMessages / conversations) * 10) / 10 : 0,
      chatLeads,
      chatLeadsPrev: chatLeadsAgg?.prev ?? 0,
      captureRate: conversations > 0 ? Math.round((chatLeads / conversations) * 1000) / 10 : 0,
      chatBookings: chatBookingsAgg?.cur ?? 0,
      byPage,
      series,
      period: `${days}d`,
    });
  } catch (err) {
    logger.error({ err: String(err), tenantId }, "[chat-analytics] metrics failed");
    res.status(500).json({ error: "Failed to load chat analytics" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/chat/questions — raw visitor-question feed       */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/chat/questions", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    const days = clampDays(req.query.days);
    const limit = Math.max(1, Math.min(300, parseInt((req.query.limit as string) || "100", 10) || 100));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    const rows = await db
      .select({
        conversationId: conversationMessagesTable.conversationId,
        content: conversationMessagesTable.content,
        createdAt: conversationMessagesTable.createdAt,
        pageId: conversationsTable.pageId,
      })
      .from(conversationMessagesTable)
      .innerJoin(conversationsTable, eq(conversationsTable.id, conversationMessagesTable.conversationId))
      .where(and(
        eq(conversationsTable.tenantId, tenantId),
        eq(conversationsTable.mode, LEAD_CAPTURE_MODE),
        eq(conversationMessagesTable.role, "user"),
        sql`${conversationMessagesTable.createdAt} > ${dateFilter}`,
        sql`length(${conversationMessagesTable.content}) > 1`,
      ))
      .orderBy(desc(conversationMessagesTable.createdAt))
      .limit(limit);

    const pageIds = [...new Set(rows.map(r => r.pageId).filter((v): v is number => v != null))];
    const pageRows = pageIds.length > 0
      ? await db
          .select({ id: lpPagesTable.id, title: lpPagesTable.title })
          .from(lpPagesTable)
          .where(and(eq(lpPagesTable.tenantId, tenantId), inArray(lpPagesTable.id, pageIds)))
      : [];
    const titleById = new Map(pageRows.map(p => [p.id, p.title]));

    res.json(rows.map(r => ({
      conversationId: r.conversationId,
      content: r.content,
      createdAt: r.createdAt,
      pageId: r.pageId,
      pageTitle: r.pageId != null ? (titleById.get(r.pageId) ?? null) : null,
    })));
  } catch (err) {
    logger.error({ err: String(err), tenantId }, "[chat-analytics] questions failed");
    res.status(500).json({ error: "Failed to load visitor questions" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /lp/analytics/chat/insights — LLM question clustering         */
/* ------------------------------------------------------------------ */

const insightsLimiter = rateLimit({
  name: "chat-insights",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_CHAT_INSIGHTS_PER_MIN", 4),
});

const INSIGHTS_MODEL = process.env["CONVERSATION_MODEL"] ?? "gpt-4o";
const MAX_INSIGHT_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 300;

export interface ChatInsightTheme {
  theme: string;
  count: number;
  examples: string[];
  suggestion: string;
}

/** Parse + harden the model's JSON into the response contract. PURE +
 *  exported for tests: bad shapes degrade to an empty theme list rather
 *  than a 500. */
export function parseChatInsights(raw: string): { summary: string; themes: ChatInsightTheme[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { summary: "", themes: [] };
  }
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  const themesRaw = Array.isArray(obj.themes) ? obj.themes : [];
  const themes: ChatInsightTheme[] = [];
  for (const t of themesRaw) {
    const item = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
    const theme = typeof item.theme === "string" ? item.theme.trim() : "";
    if (!theme) continue;
    themes.push({
      theme,
      count: typeof item.count === "number" && Number.isFinite(item.count) ? Math.max(0, Math.round(item.count)) : 0,
      examples: Array.isArray(item.examples)
        ? item.examples.filter((e): e is string => typeof e === "string").slice(0, 3)
        : [],
      suggestion: typeof item.suggestion === "string" ? item.suggestion : "",
    });
  }
  return { summary, themes: themes.slice(0, 10) };
}

router.post("/lp/analytics/chat/insights", insightsLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    res.status(503).json({ error: "AI integration not configured." });
    return;
  }

  try {
    const days = clampDays((req.body as { days?: unknown } | undefined)?.days);
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    const rows = await db
      .select({ content: conversationMessagesTable.content })
      .from(conversationMessagesTable)
      .innerJoin(conversationsTable, eq(conversationsTable.id, conversationMessagesTable.conversationId))
      .where(and(
        eq(conversationsTable.tenantId, tenantId),
        eq(conversationsTable.mode, LEAD_CAPTURE_MODE),
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

    const questions = rows.map(r => r.content.slice(0, MAX_MESSAGE_CHARS));
    const openai = new OpenAI({ baseURL, apiKey });
    const completion = await openai.chat.completions.create({
      model: INSIGHTS_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You analyze visitor messages sent to an AI chat assistant on marketing landing pages. " +
            "Cluster the messages into the questions/objections visitors actually have. Respond with " +
            'JSON: {"summary": string, "themes": [{"theme": string, "count": number, "examples": string[], "suggestion": string}]}. ' +
            "Rules: `summary` is 1-2 sentences on the overall pattern. Each theme names ONE recurring " +
            "question/objection (not a category like 'other'); `count` is how many messages fit it; " +
            "`examples` are up to 2 short VERBATIM quotes; `suggestion` is one actionable sentence for " +
            "the page owner (e.g. 'Add a pricing section — visitors keep asking and the page doesn't " +
            "answer it.'). Order themes by count, max 8. Ignore greetings, contact details, and " +
            "yes/no replies to the bot's own questions.",
        },
        {
          role: "user",
          content: `Visitor messages (newest first):\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
        },
      ],
    });

    const parsed = parseChatInsights(completion.choices[0]?.message?.content ?? "");
    res.json({ analyzedCount: rows.length, ...parsed });
  } catch (err) {
    logger.error({ err: String(err), tenantId }, "[chat-analytics] insights failed");
    res.status(502).json({ error: "Analysis failed — please try again." });
  }
});

export default router;
