import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { lpPagesTable } from "./lpPages";

/**
 * conversations — the shared, mode-tagged transcript substrate for LP Studio's
 * conversational AI surfaces (June 2026 chatbot spec). ONE table powers every
 * bot the spec describes (Builder Copilot now; Lead-Capture + Support later) so
 * transcripts, analytics, and lead/ticket linkage stay uniform. v1 only writes
 * `mode = "builder_copilot"` rows.
 *
 *   mode       — which ConversationMode produced this thread (e.g.
 *                "builder_copilot"). The discriminator the engine + analytics
 *                key off; new modes add a value, never a new table.
 *   pageId     — the builder page this copilot thread is attached to (nullable:
 *                future modes — support/lead — aren't page-scoped).
 *   metadata   — open jsonb for per-mode context (e.g. the surface, the
 *                originating block, qualification score later).
 *
 * Tenant-scoped + cascade-deleted with the tenant/page so a deleted tenant or
 * page takes its transcripts with it. Append-only messages live in
 * conversation_messages.
 */
export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    pageId: integer("page_id").references(() => lpPagesTable.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("conversations_tenant_idx").on(t.tenantId),
    tenantModeIdx: index("conversations_tenant_mode_idx").on(t.tenantId, t.mode),
    pageIdx: index("conversations_page_idx").on(t.pageId),
  }),
);

/**
 * conversation_messages — append-only turns of a conversation.
 *
 *   role     — "user" | "assistant" | "system".
 *   content  — the rendered text of the turn (assistant content is the
 *              streamed token text; user content is the typed message).
 *   actions  — for assistant turns, the structured ACTIONS the bot proposed
 *              this turn (the engine's `CopilotAction[]` shape). Null for plain
 *              text turns. The bot only PROPOSES; nothing here is auto-applied.
 */
export const conversationMessagesTable = pgTable(
  "conversation_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    actions: jsonb("actions"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    conversationIdx: index("conversation_messages_conversation_idx").on(t.conversationId),
    conversationCreatedIdx: index("conversation_messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  }),
);

export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationMessage = typeof conversationMessagesTable.$inferSelect;
