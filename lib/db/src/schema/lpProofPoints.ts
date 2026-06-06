import { pgTable, serial, integer, text, boolean, timestamp, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

// Task #256 — first-class, tenant-scoped proof-point library. Separate from
// per-segment stats so a single approval (and source URL / date) can flow
// through every page and segment that needs the same number.
export const lpProofPointsTable = pgTable(
  "lp_proof_points",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    value: text("value").notNull().default(""),
    label: text("label").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    asOfDate: date("as_of_date"),
    approvedForAi: boolean("approved_for_ai").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    // Task #1138 — proof points can now be a reusable STAT or a reusable QUOTE
    // (with attribution), so the Swap dropdown in the fact-review modal can be
    // filtered by the kind of fact being swapped.
    factKind: text("fact_kind").notNull().default("stat"),
    attributionName: text("attribution_name").notNull().default(""),
    attributionTitle: text("attribution_title").notNull().default(""),
    attributionCompany: text("attribution_company").notNull().default(""),
    attributionPhotoUrl: text("attribution_photo_url").notNull().default(""),
    consentNote: text("consent_note").notNull().default(""),
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
