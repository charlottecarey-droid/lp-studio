/**
 * GET /lp/chat-transcripts/:conversationId — the full chat behind a
 * chat-capture lead (July 2026).
 *
 * The lead bot submits leads with a hidden `_chatConversationId` field; the
 * Leads UI uses this endpoint to show the team the ACTUAL conversation, not
 * just the bot's one-line summary. Auth-required and tenant-scoped, and
 * restricted to lead_capture conversations — builder-copilot / support
 * threads are not exposed here.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, conversationMessagesTable } from "@workspace/db";
import { and, eq, asc } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

router.get("/lp/chat-transcripts/:conversationId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const conversationId = Number(req.params.conversationId);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }

  const [conv] = await db
    .select({ id: conversationsTable.id, pageId: conversationsTable.pageId, createdAt: conversationsTable.createdAt })
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, conversationId),
        eq(conversationsTable.tenantId, tenantId),
        eq(conversationsTable.mode, "lead_capture"),
      ),
    )
    .limit(1);
  if (!conv) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }

  const rows = await db
    .select({
      role: conversationMessagesTable.role,
      content: conversationMessagesTable.content,
      createdAt: conversationMessagesTable.createdAt,
    })
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, conversationId))
    .orderBy(asc(conversationMessagesTable.createdAt), asc(conversationMessagesTable.id));

  res.json({
    conversationId: conv.id,
    pageId: conv.pageId,
    startedAt: conv.createdAt,
    // Action-only turns persist with empty content — noise in a transcript.
    messages: rows.filter((m) => m.content.trim() !== ""),
  });
});

export default router;
