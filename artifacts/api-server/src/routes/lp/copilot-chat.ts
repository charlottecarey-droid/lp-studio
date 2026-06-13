/**
 * POST /lp/copilot/chat — Builder Copilot streaming chat (June 2026 chatbot spec).
 *
 * Auth-required, tenant-scoped, per-tenant rate-limited. Always responds as a
 * Server-Sent-Events stream (token/action/done/error) — the builder panel is
 * SSE-only, so there's no non-streaming JSON variant the way generate-page has.
 *
 * Body: { conversationId?, pageId, userMessage, blocks?, title? }
 *   - conversationId  resume an existing thread (else a new one is created).
 *   - pageId          the builder page this thread is attached to.
 *   - userMessage     the new user turn.
 *   - blocks/title    OPTIONAL live (possibly-unsaved) page state from the
 *                     builder; when present they override the DB row so the
 *                     copilot reasons about exactly what the user sees. Falls
 *                     back to the persisted page otherwise.
 *
 * Flow: load brand (strict-facts grounding) + page → persist the user turn →
 * stream the assistant turn through the ConversationEngine → persist the
 * assistant turn (text + proposed actions) → emit `done`.
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  conversationsTable,
  conversationMessagesTable,
  lpPagesTable,
} from "@workspace/db";
import { and, eq, asc } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { fetchBrand } from "../../lib/ai-prompts/brand-and-brief";
import { createSseChatEmitter } from "../../lib/conversation/chatEmitter";
import { runConversationTurn, type ConversationTurn } from "../../lib/conversation/engine";
import {
  builderCopilotMode,
  type BuilderCopilotContext,
  type CopilotPageBlock,
} from "../../lib/conversation/modes/builderCopilot";
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

// Per-tenant rate limit (spec: ~30/min). Keyed by tenantId (falls back to IP
// when somehow unauthenticated — getTenantId rejects those first anyway).
const copilotChatLimiter = rateLimit({
  name: "copilot-chat",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_COPILOT_CHAT_PER_MIN", 30),
  keyFn: (req) => {
    const tid = req.authUser?.tenantId;
    return tid != null ? `tenant:${tid}` : `ip:${req.ip ?? "unknown"}`;
  },
});

/** Coerce arbitrary persisted/posted blocks into the compact copilot shape. */
function toCopilotBlocks(raw: unknown): CopilotPageBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: CopilotPageBlock[] = [];
  for (const b of raw) {
    if (b && typeof b === "object" && typeof (b as { id?: unknown }).id === "string") {
      const block = b as { id: string; type?: unknown; props?: unknown };
      out.push({
        id: block.id,
        type: typeof block.type === "string" ? block.type : "unknown",
        props:
          block.props && typeof block.props === "object"
            ? (block.props as Record<string, unknown>)
            : undefined,
      });
    }
  }
  return out;
}

router.post("/lp/copilot/chat", copilotChatLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = req.body as {
    conversationId?: number;
    pageId?: number;
    userMessage?: string;
    blocks?: unknown;
    title?: string;
  };

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) {
    res.status(400).json({ error: "userMessage is required" });
    return;
  }
  const pageId =
    typeof body.pageId === "number" && Number.isFinite(body.pageId) ? body.pageId : null;

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  // ── Load grounding: brand (strict-facts) + the page being edited ─────────
  const brand = await fetchBrand(tenantId);

  let pageTitle = typeof body.title === "string" ? body.title : "";
  let pageBlocks: CopilotPageBlock[] = toCopilotBlocks(body.blocks);

  // When the client didn't post live state, fall back to the persisted page —
  // scoped to this tenant so a page id from another tenant can't be probed.
  if (pageId != null && (pageBlocks.length === 0 || !body.title)) {
    try {
      const [page] = await db
        .select({ title: lpPagesTable.title, blocks: lpPagesTable.blocks })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId)))
        .limit(1);
      if (page) {
        if (!pageTitle) pageTitle = page.title;
        if (pageBlocks.length === 0) pageBlocks = toCopilotBlocks(page.blocks);
      }
    } catch (err) {
      logger.warn({ err: String(err), pageId, tenantId }, "[copilot] page load failed — continuing without page state");
    }
  }

  // ── Resume or create the conversation; load prior turns ──────────────────
  let conversationId: number | null = null;
  if (typeof body.conversationId === "number" && Number.isFinite(body.conversationId)) {
    const [conv] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, body.conversationId),
          eq(conversationsTable.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (conv) conversationId = conv.id;
  }
  if (conversationId == null) {
    const [created] = await db
      .insert(conversationsTable)
      .values({
        tenantId,
        mode: builderCopilotMode.id,
        pageId,
        metadata: { surface: "builder" },
      })
      .returning({ id: conversationsTable.id });
    conversationId = created?.id ?? null;
  }
  if (conversationId == null) {
    res.status(500).json({ error: "Could not start the conversation" });
    return;
  }

  // Prior turns (oldest-first). System turns are persisted by neither party in
  // v1, so we only fetch user/assistant content.
  const priorRows = await db
    .select({
      role: conversationMessagesTable.role,
      content: conversationMessagesTable.content,
    })
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, conversationId))
    .orderBy(asc(conversationMessagesTable.createdAt), asc(conversationMessagesTable.id));

  const history: ConversationTurn[] = priorRows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  history.push({ role: "user", content: userMessage });

  // Persist the user turn before streaming (so a mid-stream disconnect still
  // leaves a coherent transcript).
  await db.insert(conversationMessagesTable).values({
    conversationId,
    role: "user",
    content: userMessage,
  });

  // ── Stream the assistant turn ────────────────────────────────────────────
  const emitter = createSseChatEmitter(req, res);
  const context: BuilderCopilotContext = {
    tenantId,
    pageId,
    brand,
    pageTitle,
    pageBlocks,
  };

  try {
    const result = await runConversationTurn({
      client: openai,
      mode: builderCopilotMode,
      context,
      history,
      emitter,
    });

    // Persist the assistant turn (text + proposed actions). Skip if the client
    // already disconnected (the transcript without the assistant reply is fine
    // — they'll re-ask).
    let messageId: number | null = null;
    if (!emitter.aborted) {
      const [msg] = await db
        .insert(conversationMessagesTable)
        .values({
          conversationId,
          role: "assistant",
          content: result.text,
          actions: result.actions.length > 0 ? result.actions : null,
        })
        .returning({ id: conversationMessagesTable.id });
      messageId = msg?.id ?? null;
    }

    emitter.done({ conversationId, messageId });
  } catch (err) {
    if (emitter.aborted) {
      emitter.close();
      return;
    }
    logger.error({ err: String(err), tenantId, conversationId }, "[copilot] turn failed");
    emitter.error(err instanceof Error ? err.message : "The assistant hit an error");
  }
});

export default router;
