/**
 * POST /lp/support/chat — in-app support assistant (June 2026 chatbot spec,
 * Bot 3 platform-support instance).
 *
 * Auth-required, tenant-scoped, per-tenant rate-limited, SSE-only — the same
 * transport contract as the builder copilot (token/action/done/error), reusing
 * the shared ConversationEngine with the supportGuide mode. Grounding is the
 * curated user-guide corpus (keyword-retrieved per turn); transcripts persist
 * mode-tagged ("support_guide") so what tenants ask doubles as product-gap
 * signal.
 *
 * Body: { conversationId?, userMessage, currentPath? }
 *   - currentPath  the in-app route the user asked from (optional situational
 *                  grounding; validated to a same-app absolute path).
 */
import { Router } from "express";
import OpenAI from "openai";
import { getTenantId } from "../../middleware/requireAuth";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { createSseChatEmitter } from "../../lib/conversation/chatEmitter";
import { runConversationTurn, type ConversationTurn } from "../../lib/conversation/engine";
import {
  supportGuideMode,
  type SupportGuideContext,
} from "../../lib/conversation/modes/supportGuide";
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

const supportChatLimiter = rateLimit({
  name: "support-chat",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_SUPPORT_CHAT_PER_MIN", 20),
  keyFn: (req) => {
    const tid = req.authUser?.tenantId;
    return tid != null ? `tenant:${tid}` : `ip:${req.ip ?? "unknown"}`;
  },
});

router.post("/lp/support/chat", supportChatLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const body = req.body as {
    conversationId?: number;
    userMessage?: string;
    currentPath?: string;
  };

  const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!userMessage) {
    res.status(400).json({ error: "userMessage is required" });
    return;
  }
  // Situational grounding only — must look like an in-app absolute path.
  const currentPath =
    typeof body.currentPath === "string" && /^\/[a-zA-Z0-9\-_/]*$/.test(body.currentPath)
      ? body.currentPath
      : undefined;

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const conversationId = await resumeOrCreateConversation({
    tenantId,
    mode: supportGuideMode.id,
    requestedId: body.conversationId,
    metadata: { surface: "app-help" },
  });
  if (conversationId == null) {
    res.status(500).json({ error: "Could not start the conversation" });
    return;
  }

  const history: ConversationTurn[] = await loadConversationHistory(conversationId);
  history.push({ role: "user", content: userMessage });
  await persistUserTurn(conversationId, userMessage);

  const emitter = createSseChatEmitter(req, res);
  const context: SupportGuideContext = {
    tenantId,
    pageId: null,
    userMessage,
    currentPath,
  };

  try {
    const result = await runConversationTurn({
      client: openai,
      mode: supportGuideMode,
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
    logger.error({ err: String(err), tenantId, conversationId }, "[support-chat] turn failed");
    emitter.error(err instanceof Error ? err.message : "The assistant hit an error");
  }
});

export default router;
