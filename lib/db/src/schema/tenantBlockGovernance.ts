import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/**
 * tenant_block_governance — per-tenant, per-block governance (task #4).
 *
 * One row per (tenant_id, block_type). This is the NEW tenant layer in the
 * block-visibility precedence model (see
 * `@workspace/lp-template-engine/block-governance.ts` for the full order).
 * It carries three controls a tenant admin sets from the governance panel:
 *
 *   • `enabled`   — builder availability. NULL = inherit (available); FALSE =
 *                   tenant-disabled. A tenant can only remove blocks the
 *                   superadmin allows; the superadmin catalog kill-switch
 *                   (block_catalog.is_enabled=false) still wins above this.
 *   • `ai_mode`   — 'locked' (AI places it but makes no copy/image changes),
 *                   'copy' (AI may rewrite text but not images), or 'open'
 *                   (today's full behaviour). Default 'open' so an un-governed
 *                   block behaves exactly as it does today.
 *   • `segments`  — brand-segment ids this block is approved for. Drives the
 *                   segment tab / segment library / insert-blocks modal, and
 *                   expands the AI block vocabulary for that segment.
 *
 * Fail-open / backfill: the table starts EMPTY. Every resolver treats a
 * missing row as enabled + open + no segments, which is identical to current
 * behaviour — so no data backfill is required to preserve day-one behaviour.
 */
export const tenantBlockGovernanceTable = pgTable("tenant_block_governance", {
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull(),
  /** NULL = inherit (available); FALSE = tenant-disabled. */
  enabled: boolean("enabled"),
  /** 'locked' | 'copy' | 'open'. Stored as text (not a PG enum) so adding a
   *  mode later is a code-only change. Default 'open' = no behaviour change. */
  aiMode: text("ai_mode").notNull().default("open"),
  /** Brand-segment ids this block is approved for. Empty = none. */
  segments: text("segments").array().notNull().default(sql`'{}'::text[]`),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.blockType] }),
}));

export type TenantBlockGovernanceRow = typeof tenantBlockGovernanceTable.$inferSelect;
export type InsertTenantBlockGovernance = typeof tenantBlockGovernanceTable.$inferInsert;
