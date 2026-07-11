import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { conversationsTable } from "./conversations";

/**
 * support_tickets — escalations filed by the in-app support chat bot
 * (July 2026). When the support_guide mode emits `escalate_to_support`,
 * the route persists a ticket here (previously the widget only rendered a
 * mailto: button and nothing was captured). Triaged in the superadmin
 * console's Support tab.
 *
 *   conversationId — the originating support_guide conversation. SET NULL
 *                    on delete so tickets outlive pruned transcripts.
 *   userEmail/Name — the escalating account user, denormalized at file time.
 *   currentPath    — the in-app route the user was on when they escalated.
 *   status         — "open" | "resolved".
 */
export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").references(() => conversationsTable.id, {
      onDelete: "set null",
    }),
    userEmail: text("user_email"),
    userName: text("user_name"),
    summary: text("summary").notNull(),
    currentPath: text("current_path"),
    status: text("status").notNull().default("open"),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => ({
    statusCreatedIdx: index("support_tickets_status_created_idx").on(t.status, t.createdAt),
    tenantIdx: index("support_tickets_tenant_idx").on(t.tenantId),
  }),
);

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
