import { pool } from "@workspace/db";

/**
 * Re-associate records that point at Salesforce IDs but lost their local
 * foreign key — orphaned hotlinks and pages whose account_id went stale after
 * a delete-and-re-import.
 *
 * The Salesforce ID is the durable identity here: local row ids churn every
 * time contacts are wiped and re-synced, but `sfdc_contact_id` on a hotlink
 * survives, so a personalized link that's already out in someone's inbox can
 * be reconnected to the re-imported contact instead of tracking nothing.
 *
 * Extracted from POST /sales/relink so the import paths can call it directly —
 * leaving it as a manual endpoint meant orphans accumulated silently until
 * somebody knew to go press it.
 *
 * TENANT SCOPING IS LOAD-BEARING. Until migration 0133, `salesforce_id` was
 * globally unique, so matching on it alone happened to stay within one tenant.
 * That's no longer true — the same Salesforce record can now legitimately exist
 * in two workspaces — so every join here must constrain BOTH sides to the same
 * tenant. Without that, one workspace's orphaned hotlink could be re-pointed at
 * another workspace's contact.
 */
export async function relinkOrphans(tenantId: number): Promise<{
  hotlinksRelinked: number;
  pagesRelinked: number;
}> {
  // Orphaned hotlinks → the re-imported contact carrying the same SFDC id.
  const { rowCount: hotlinksRelinked } = await pool.query(
    `UPDATE sales_hotlinks hl
        SET contact_id = c.id
       FROM sales_contacts c
      WHERE hl.contact_id IS NULL
        AND hl.sfdc_contact_id IS NOT NULL
        AND hl.tenant_id = $1
        AND c.salesforce_id = hl.sfdc_contact_id
        AND c.tenant_id = $1`,
    [tenantId],
  );

  // Stale lp_pages.account_id → the account carrying the same SFDC id.
  //
  // This previously joined `sales_accounts.sfdc_id`, a column that is empty on
  // every row in the database — the value lives in `salesforce_id`. So this
  // half of the repair silently matched nothing for its entire life. Verified
  // against production: 0 matches via sfdc_id, 15 via salesforce_id.
  const { rowCount: pagesRelinked } = await pool.query(
    `UPDATE lp_pages lp
        SET account_id = sa.id
       FROM sales_accounts sa
      WHERE lp.sfdc_account_id IS NOT NULL
        AND lp.tenant_id = $1
        AND sa.tenant_id = $1
        AND sa.salesforce_id = lp.sfdc_account_id
        AND (lp.account_id IS NULL OR lp.account_id <> sa.id)`,
    [tenantId],
  );

  return { hotlinksRelinked: hotlinksRelinked ?? 0, pagesRelinked: pagesRelinked ?? 0 };
}
