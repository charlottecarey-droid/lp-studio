import { pgTable, serial, integer, text, boolean, timestamp, date, index } from "drizzle-orm/pg-core";

// Task #256 — first-class, tenant-scoped proof-point library. Separate from
// per-segment stats so a single approval (and source URL / date) can flow
// through every page and segment that needs the same number.
export const lpProofPointsTable = pgTable(
  "lp_proof_points",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    value: text("value").notNull().default(""),
    label: text("label").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    asOfDate: date("as_of_date"),
    approvedForAi: boolean("approved_for_ai").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    tenantIdx: index("lp_proof_points_tenant_idx").on(t.tenantId),
  }),
);

export type LpProofPoint = typeof lpProofPointsTable.$inferSelect;
