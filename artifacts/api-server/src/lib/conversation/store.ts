/**
 * Conversation persistence helpers shared by every chat route (builder
 * copilot, support guide, lead capture). One `conversations` +
 * `conversation_messages` pair powers all bots (the June 2026 spec's "one
 * conversations table" principle); routes differ only in mode id, auth, and
 * grounding, so the resume/create + history + persist plumbing lives here
 * instead of being copy-pasted per route.
 */
import { db } from "@workspace/db";
import { conversationsTable, conversationMessagesTable } from "@workspace/db";
import { and, eq, asc } from "drizzle-orm";
import type { CopilotAction } from "./actions";
import type { ConversationTurn } from "./engine";

export interface ResumeOrCreateOpts {
  tenantId: number;
  /** The mode id persisted on the conversation (e.g. "builder_copilot"). A
   *  resume only matches a conversation with the SAME mode — a conversation id
   *  from one bot can't be replayed into another bot's grounding. */
  mode: string;
  /** Client-requested conversation id to resume, if any. */
  requestedId?: unknown;
  pageId?: number | null;
  metadata?: Record<string, unknown>;
}

/** Resume the requested conversation (tenant- and mode-scoped) or create a
 *  fresh one. Returns null only when the insert fails. */
export async function resumeOrCreateConversation(
  opts: ResumeOrCreateOpts,
): Promise<number | null> {
  const { tenantId, mode, requestedId, pageId = null, metadata } = opts;
  if (typeof requestedId === "number" && Number.isFinite(requestedId)) {
    const [conv] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, requestedId),
          eq(conversationsTable.tenantId, tenantId),
          eq(conversationsTable.mode, mode),
        ),
      )
      .limit(1);
    if (conv) return conv.id;
  }
  const [created] = await db
    .insert(conversationsTable)
    .values({ tenantId, mode, pageId, metadata: metadata ?? {} })
    .returning({ id: conversationsTable.id });
  return created?.id ?? null;
}

/** Prior user/assistant turns, oldest-first (system turns are never
 *  persisted). Optionally capped to the most recent `maxTurns` so public
 *  bots can't grow an unbounded prompt. */
export async function loadConversationHistory(
  conversationId: number,
  maxTurns?: number,
): Promise<ConversationTurn[]> {
  const rows = await db
    .select({
      role: conversationMessagesTable.role,
      content: conversationMessagesTable.content,
    })
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, conversationId))
    .orderBy(asc(conversationMessagesTable.createdAt), asc(conversationMessagesTable.id));
  const turns: ConversationTurn[] = rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  return maxTurns != null && turns.length > maxTurns ? turns.slice(-maxTurns) : turns;
}

/** Count of messages in a conversation — the per-conversation turn cap for
 *  public bots reads this before running a turn. */
export async function countConversationMessages(conversationId: number): Promise<number> {
  const rows = await db
    .select({ id: conversationMessagesTable.id })
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, conversationId));
  return rows.length;
}

export async function persistUserTurn(conversationId: number, content: string): Promise<void> {
  await db.insert(conversationMessagesTable).values({ conversationId, role: "user", content });
}

/** Persist the assistant turn (text + proposed actions); returns the message
 *  id for the SSE `done` frame. */
export async function persistAssistantTurn(
  conversationId: number,
  content: string,
  actions: CopilotAction[],
): Promise<number | null> {
  const [msg] = await db
    .insert(conversationMessagesTable)
    .values({
      conversationId,
      role: "assistant",
      content,
      actions: actions.length > 0 ? actions : null,
    })
    .returning({ id: conversationMessagesTable.id });
  return msg?.id ?? null;
}
