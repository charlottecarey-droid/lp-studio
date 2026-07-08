/**
 * POST /lp/chat-capture — the published-page lead-capture bot (June 2026
 * chatbot spec, Bot 2). PUBLIC (allow-listed in LP_PUBLIC like /lp/leads):
 * anonymous visitors on published landing pages chat here; the block then
 * submits captured contact details through the normal POST /lp/leads pipeline.
 *
 * Fail-closed config chain — the model only ever runs when:
 *   1. the pageId resolves to a page whose status is "published" (tenant is
 *      taken from the PAGE row, mirroring /lp/leads' trust model), and
 *   2. that page's persisted blocks actually contain a `chat-capture` block —
 *      the block's props are the server-trusted bot config; a request against
 *      a page without the block is a 404, so the endpoint can't be used as a
 *      free general-purpose LLM proxy.
 *
 * Abuse guards (public + costs tokens, so stricter than /lp/leads):
 *   - per-IP rate limit (RATE_LIMIT_CHAT_CAPTURE_PER_MIN, default 12/min)
 *   - per-conversation turn cap (MAX_CONVERSATION_MESSAGES) + message length cap
 *   - history clipped to the most recent turns; grounding is page-content only
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { lpPagesTable, lpFormsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { fetchBrand } from "../../lib/ai-prompts/brand-and-brief";
import { createSseChatEmitter } from "../../lib/conversation/chatEmitter";
import { runConversationTurn, type ConversationTurn } from "../../lib/conversation/engine";
import {
  leadCaptureMode,
  findChatCaptureBlock,
  extractLinkedFormFields,
  type LeadCaptureContext,
  type ChatCaptureConfig,
  type LinkedFormField,
  type RawPageBlock,
} from "../../lib/conversation/modes/leadCapture";
import type { CopilotPageBlock } from "../../lib/conversation/modes/builderCopilot";
import {
  resumeOrCreateConversation,
  loadConversationHistory,
  countConversationMessages,
  persistUserTurn,
  persistAssistantTurn,
} from "../../lib/conversation/store";
import { logger } from "../../lib/logger";

const router = Router();

const MAX_MESSAGE_CHARS = 1000;
const MAX_CONVERSATION_MESSAGES = 40;
const HISTORY_TURNS = 20;

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

const chatCaptureLimiter = rateLimit({
  name: "chat-capture",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_CHAT_CAPTURE_PER_MIN", 12),
});

function toChatCaptureConfig(props: unknown): ChatCaptureConfig {
  const p = (props && typeof props === "object" ? props : {}) as Record<string, unknown>;
  return {
    botName: typeof p.botName === "string" ? p.botName : undefined,
    welcomeMessage: typeof p.welcomeMessage === "string" ? p.welcomeMessage : undefined,
    collectName: typeof p.collectName === "boolean" ? p.collectName : undefined,
    collectCompany: typeof p.collectCompany === "boolean" ? p.collectCompany : undefined,
    collectPhone: typeof p.collectPhone === "boolean" ? p.collectPhone : undefined,
    qualifyingQuestions: Array.isArray(p.qualifyingQuestions)
      ? p.qualifyingQuestions.filter((q): q is string => typeof q === "string")
      : undefined,
  };
}

function toCopilotBlocks(raw: unknown): Array<CopilotPageBlock & { children?: unknown }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<CopilotPageBlock & { children?: unknown }> = [];
  for (const b of raw as RawPageBlock[]) {
    if (b && typeof b === "object" && typeof b.id === "string") {
      out.push({
        id: b.id,
        type: typeof b.type === "string" ? b.type : "unknown",
        props:
          b.props && typeof b.props === "object"
            ? (b.props as Record<string, unknown>)
            : undefined,
        children: b.children,
      });
    }
  }
  return out;
}

router.post("/lp/chat-capture", chatCaptureLimiter, async (req, res): Promise<void> => {
  const body = req.body as {
    pageId?: number;
    conversationId?: number;
    sessionId?: string;
    userMessage?: string;
  };

  const pageId =
    typeof body.pageId === "number" && Number.isFinite(body.pageId) && body.pageId > 0
      ? body.pageId
      : null;
  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (pageId == null || !userMessage) {
    res.status(400).json({ error: "pageId and userMessage are required" });
    return;
  }
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    res.status(400).json({ error: "Message too long" });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  // ── Fail-closed page + block-config resolution ────────────────────────────
  const [page] = await db
    .select({
      id: lpPagesTable.id,
      tenantId: lpPagesTable.tenantId,
      title: lpPagesTable.title,
      status: lpPagesTable.status,
      blocks: lpPagesTable.blocks,
    })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, pageId))
    .limit(1);
  if (!page || page.status !== "published") {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  const chatBlock = findChatCaptureBlock(page.blocks);
  if (!chatBlock) {
    res.status(404).json({ error: "Chat is not enabled on this page" });
    return;
  }
  const tenantId = page.tenantId;
  const config = toChatCaptureConfig(chatBlock.props);

  // Linked global form: its REQUIRED fields become part of the bot's capture
  // checklist (grounding) so a chat lead satisfies the same contract as a
  // form submission. Tenant-scoped read; a missing/foreign form just means
  // no extra fields. Best-effort — a load failure never blocks the chat.
  let formFields: LinkedFormField[] = [];
  const rawFormId = (chatBlock.props as Record<string, unknown> | undefined)?.["formId"];
  const formId = typeof rawFormId === "number" && Number.isFinite(rawFormId) ? rawFormId : null;
  if (formId != null) {
    try {
      const [form] = await db
        .select({ steps: lpFormsTable.steps })
        .from(lpFormsTable)
        .where(and(eq(lpFormsTable.id, formId), eq(lpFormsTable.tenantId, tenantId)))
        .limit(1);
      if (form) formFields = extractLinkedFormFields(form.steps);
    } catch (err) {
      logger.warn({ err: String(err), tenantId, formId }, "[chat-capture] linked form load failed — continuing without form fields");
    }
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 100) : undefined;
  const conversationId = await resumeOrCreateConversation({
    tenantId,
    mode: leadCaptureMode.id,
    requestedId: body.conversationId,
    pageId,
    metadata: { surface: "chat-capture", ...(sessionId ? { sessionId } : {}) },
  });
  if (conversationId == null) {
    res.status(500).json({ error: "Could not start the conversation" });
    return;
  }

  // Turn cap: a public conversation can't grow unbounded (token cost + prompt
  // size). The client shows a "leave your email" nudge when it hits this.
  const messageCount = await countConversationMessages(conversationId);
  if (messageCount >= MAX_CONVERSATION_MESSAGES) {
    res.status(429).json({ error: "This conversation has reached its limit" });
    return;
  }

  const brand = await fetchBrand(tenantId);
  const history: ConversationTurn[] = await loadConversationHistory(conversationId, HISTORY_TURNS);
  history.push({ role: "user", content: userMessage });
  await persistUserTurn(conversationId, userMessage);

  const emitter = createSseChatEmitter(req, res);
  const context: LeadCaptureContext = {
    tenantId,
    pageId,
    brand,
    pageTitle: page.title,
    pageBlocks: toCopilotBlocks(page.blocks),
    config,
    formFields,
  };

  try {
    const result = await runConversationTurn({
      client: openai,
      mode: leadCaptureMode,
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
    logger.error(
      { err: String(err), tenantId, pageId, conversationId },
      "[chat-capture] turn failed",
    );
    emitter.error(err instanceof Error ? err.message : "The assistant hit an error");
  }
});

export default router;
