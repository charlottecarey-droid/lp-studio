/**
 * POST /sales/assistant/chat — the sales console assistant (July 2026).
 *
 * Auth-required and mounted INSIDE the salesConsole plan gate (see
 * routes/sales/index.ts — registering above the gate would open it to starter
 * tenants). SSE contract identical to the other conversation routes
 * (token/action/done/error via the shared ConversationEngine).
 *
 * Entity resolution happens HERE, not in the model: the user's message is
 * tokenized (modes/salesAssistant.extractEntityTokens) and matched against
 * the tenant's sales_accounts / sales_contacts with ILIKE; only those rows
 * enter the grounding, so the bot can only propose ids that really belong to
 * this tenant. Contacts of matched accounts are included so "email someone
 * at Aspen Dental" can offer real people.
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { salesAccountsTable, salesContactsTable } from "@workspace/db";
import { and, eq, ilike, inArray, or, sql, desc } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { createSseChatEmitter } from "../../lib/conversation/chatEmitter";
import { runConversationTurn, type ConversationTurn } from "../../lib/conversation/engine";
import {
  salesAssistantMode,
  extractEntityTokens,
  type SalesAssistantContext,
  type AssistantAccount,
  type AssistantContact,
  type AssistantEvent,
} from "../../lib/conversation/modes/salesAssistant";
import {
  resumeOrCreateConversation,
  loadConversationHistory,
  persistUserTurn,
  persistAssistantTurn,
} from "../../lib/conversation/store";
import { logger } from "../../lib/logger";

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

const assistantChatLimiter = rateLimit({
  name: "sales-assistant-chat",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_SALES_ASSISTANT_PER_MIN", 20),
  keyFn: (req) => {
    const tid = req.authUser?.tenantId;
    return tid != null ? `tenant:${tid}` : `ip:${req.ip ?? "unknown"}`;
  },
});

/** Escape ILIKE wildcards in a user-derived token. */
function likePattern(token: string): string {
  return `%${token.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

async function matchEntities(
  tenantId: number,
  message: string,
): Promise<{ accounts: AssistantAccount[]; contacts: AssistantContact[]; accountsTotal: number }> {
  const tokens = extractEntityTokens(message);

  const [{ count: accountsTotal }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salesAccountsTable)
    .where(eq(salesAccountsTable.tenantId, tenantId));

  let accounts: AssistantAccount[] = [];
  if (tokens.length > 0) {
    const nameMatch = or(
      ...tokens.flatMap((t) => [
        ilike(salesAccountsTable.name, likePattern(t)),
        ilike(salesAccountsTable.displayName, likePattern(t)),
      ]),
    );
    const rows = await db
      .select({
        id: salesAccountsTable.id,
        name: salesAccountsTable.name,
        displayName: salesAccountsTable.displayName,
      })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), nameMatch))
      .limit(20);
    accounts = rows.map((r) => ({ id: r.id, name: r.displayName ?? r.name }));
  }
  // Nothing matched (or no usable tokens): a small recent set so "what should
  // I work on" style questions still have real accounts to reference.
  if (accounts.length === 0) {
    const rows = await db
      .select({
        id: salesAccountsTable.id,
        name: salesAccountsTable.name,
        displayName: salesAccountsTable.displayName,
      })
      .from(salesAccountsTable)
      .where(eq(salesAccountsTable.tenantId, tenantId))
      .orderBy(desc(salesAccountsTable.id))
      .limit(10);
    accounts = rows.map((r) => ({ id: r.id, name: r.displayName ?? r.name }));
  }

  let contacts: AssistantContact[] = [];
  const contactNameMatch =
    tokens.length > 0
      ? or(
          ...tokens.flatMap((t) => [
            ilike(salesContactsTable.firstName, likePattern(t)),
            ilike(salesContactsTable.lastName, likePattern(t)),
            ilike(salesContactsTable.email, likePattern(t)),
          ]),
        )
      : undefined;
  const matchedAccountIds = accounts.map((a) => a.id);
  const contactWhere =
    contactNameMatch && matchedAccountIds.length > 0
      ? or(contactNameMatch, inArray(salesContactsTable.accountId, matchedAccountIds))
      : contactNameMatch ?? (matchedAccountIds.length > 0 ? inArray(salesContactsTable.accountId, matchedAccountIds) : undefined);
  if (contactWhere) {
    const rows = await db
      .select({
        id: salesContactsTable.id,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        accountId: salesContactsTable.accountId,
        accountName: salesAccountsTable.name,
        accountDisplayName: salesAccountsTable.displayName,
      })
      .from(salesContactsTable)
      .innerJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(and(eq(salesContactsTable.tenantId, tenantId), contactWhere))
      .limit(15);
    contacts = rows.map((r) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`.trim(),
      accountId: r.accountId,
      accountName: r.accountDisplayName ?? r.accountName,
    }));
  }

  return { accounts, contacts, accountsTotal };
}

/**
 * The tenant's events with catalog sizes, so the assistant can aim an agenda
 * at a named one. Small and unfiltered — a workspace has a handful of events,
 * not thousands, and the bot needs to see them all to disambiguate.
 * Best-effort: a failure just means the bot omits eventId and the rep picks.
 */
async function loadAssistantEvents(tenantId: number): Promise<AssistantEvent[]> {
  try {
    const rows = await db.execute(sql`
      SELECT e.id, e.name, e.start_date, e.end_date,
        (SELECT COUNT(*)::int FROM sales_event_sessions s WHERE s.event_id = e.id) AS session_count
      FROM sales_events e
      WHERE e.tenant_id = ${tenantId} AND e.status <> 'archived'
      ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC
      LIMIT 20
    `);
    return (rows.rows as { id: number; name: string; start_date: string | null; end_date: string | null; session_count: number }[])
      .map((r) => ({
        id: r.id,
        name: r.name,
        dates: [r.start_date, r.end_date].filter(Boolean).join(" – "),
        sessionCount: r.session_count ?? 0,
      }));
  } catch {
    return [];
  }
}

router.post("/assistant/chat", assistantChatLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = req.body as { conversationId?: number; userMessage?: string };
  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) {
    res.status(400).json({ error: "userMessage is required" });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  let entities: Awaited<ReturnType<typeof matchEntities>>;
  try {
    entities = await matchEntities(tenantId, userMessage);
  } catch (err) {
    logger.warn({ err: String(err), tenantId }, "[sales-assistant] entity match failed — continuing with empty lists");
    entities = { accounts: [], contacts: [], accountsTotal: 0 };
  }

  const conversationId = await resumeOrCreateConversation({
    tenantId,
    mode: salesAssistantMode.id,
    requestedId: body.conversationId,
    metadata: { surface: "sales-console" },
  });
  if (conversationId == null) {
    res.status(500).json({ error: "Could not start the conversation" });
    return;
  }

  const history: ConversationTurn[] = await loadConversationHistory(conversationId);
  history.push({ role: "user", content: userMessage });
  await persistUserTurn(conversationId, userMessage);

  const emitter = createSseChatEmitter(req, res);
  const context: SalesAssistantContext = {
    tenantId,
    pageId: null,
    userMessage,
    ...entities,
    events: await loadAssistantEvents(tenantId),
  };

  try {
    const result = await runConversationTurn({
      client: openai,
      mode: salesAssistantMode,
      context,
      history,
      emitter,
    });

    let messageId: number | null = null;
    if (!emitter.aborted) {
      messageId = await persistAssistantTurn(conversationId, result.text, result.actions);
    }
    emitter.done({ conversationId, messageId });
  } catch (err) {
    if (emitter.aborted) {
      emitter.close();
      return;
    }
    logger.error({ err: String(err), tenantId, conversationId }, "[sales-assistant] turn failed");
    emitter.error(err instanceof Error ? err.message : "The assistant hit an error");
  }
});

export default router;
