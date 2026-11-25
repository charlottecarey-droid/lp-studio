import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

/**
 * Holiday gifting exchange (Nov 2026). Reps move gift allocation between each
 * other on the Sales Console gifting page ("Up for grabs & requests").
 *
 * The allocation itself lives in the gifting sheet's Allocations tab; these
 * tables hold what reps post and what moved. A rep's balance per tier is
 *   allocated (sheet) − claimed by recipients (sheet) + received − given (here).
 * Every transfer is also appended to the sheet's Transfers tab so the sheet's
 * own "left" columns agree.
 */
export const lpGiftPostsTable = pgTable(
  "lp_gift_posts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    /** "offer" = gifts up for grabs; "request" = a rep asking for gifts. */
    kind: text("kind").notNull(),
    repEmail: text("rep_email").notNull(),
    repName: text("rep_name").notNull().default(""),
    /** "premium" | "mid" | "swag" */
    tier: text("tier").notNull(),
    qty: integer("qty").notNull(),
    /** Counts down one per Claim / Give; the post closes at 0. */
    remaining: integer("remaining").notNull(),
    note: text("note").notNull().default(""),
    /** "open" | "done" | "cancelled" */
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_gift_posts_tenant_status_idx").on(t.tenantId, t.status)],
);
export type LpGiftPost = typeof lpGiftPostsTable.$inferSelect;

export const lpGiftTransfersTable = pgTable(
  "lp_gift_transfers",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    postId: integer("post_id"),
    fromEmail: text("from_email").notNull(),
    toEmail: text("to_email").notNull(),
    tier: text("tier").notNull(),
    qty: integer("qty").notNull().default(1),
    note: text("note").notNull().default(""),
    /** The receiver's thank-you note to the giver (Nov 2026); null until sent. */
    thanks: text("thanks"),
    thankedAt: timestamp("thanked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lp_gift_transfers_tenant_idx").on(t.tenantId)],
);
export type LpGiftTransfer = typeof lpGiftTransfersTable.$inferSelect;
