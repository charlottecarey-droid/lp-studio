/**
 * Gifting wizard: turn a recipient row into a Sales Console contact + account,
 * so the page's hotlink is tied to a real person (known-viewer names, hot-visit
 * alerts, Activity) and the page files under the account in Sales → Pages.
 *
 * Deliberately local-only: the new rows carry no Salesforce / Marketo / HubSpot
 * ids, so none of the outbound write-backs (all keyed on those ids) fire, and
 * the inbound syncs only ever import. Existing accounts and contacts are
 * reused, never modified.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { db, salesAccountsTable, salesContactsTable } from "@workspace/db";

export interface RecipientInput { first_name?: string; last_name?: string; email?: string; company?: string }
export interface RecipientContact { contactId: number; accountId: number; salesforceId: string | null }

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Trimmed, bounded identity for a row; null when there's no first name and no company to anchor it. */
export function recipientIdentity(v: RecipientInput): { first: string; last: string; email: string; company: string } | null {
  const first = t(v.first_name).slice(0, 80);
  const company = t(v.company).slice(0, 160);
  if (!first || !company) return null;
  return { first, last: t(v.last_name).slice(0, 80), email: t(v.email).toLowerCase().slice(0, 200), company };
}

export async function findOrCreateRecipientContact(tenantId: number, v: RecipientInput, owner: string | null): Promise<RecipientContact | null> {
  const id = recipientIdentity(v);
  if (!id) return null;

  // Account: reuse by name (a Salesforce-synced one first), else create a local prospect.
  const lower = id.company.toLowerCase();
  const [found] = await db
    .select({ id: salesAccountsTable.id })
    .from(salesAccountsTable)
    .where(and(
      eq(salesAccountsTable.tenantId, tenantId),
      sql`(lower(${salesAccountsTable.name}) = ${lower} OR lower(coalesce(${salesAccountsTable.displayName}, '')) = ${lower})`,
    ))
    .orderBy(sql`${salesAccountsTable.salesforceId} IS NULL`, asc(salesAccountsTable.id))
    .limit(1);
  let accountId = found?.id;
  if (!accountId) {
    const [created] = await db
      .insert(salesAccountsTable)
      .values({ tenantId, name: id.company, status: "prospect", owner, metadata: { source: "gifting-wizard" } })
      .returning({ id: salesAccountsTable.id });
    accountId = created.id;
  }

  // Contact: reuse by email (workspace-wide), else by name within the account.
  const where = id.email
    ? and(eq(salesContactsTable.tenantId, tenantId), sql`lower(${salesContactsTable.email}) = ${id.email}`)
    : and(
        eq(salesContactsTable.tenantId, tenantId),
        eq(salesContactsTable.accountId, accountId),
        sql`lower(${salesContactsTable.firstName}) = ${id.first.toLowerCase()}`,
        sql`lower(${salesContactsTable.lastName}) = ${id.last.toLowerCase()}`,
      );
  const [existing] = await db
    .select({ id: salesContactsTable.id, accountId: salesContactsTable.accountId, salesforceId: salesContactsTable.salesforceId })
    .from(salesContactsTable)
    .where(where)
    .orderBy(asc(salesContactsTable.id))
    .limit(1);
  if (existing) return { contactId: existing.id, accountId: existing.accountId, salesforceId: existing.salesforceId };

  const [contact] = await db
    .insert(salesContactsTable)
    .values({ tenantId, accountId, firstName: id.first, lastName: id.last, email: id.email || null, status: "active", metadata: { source: "gifting-wizard" } })
    .returning({ id: salesContactsTable.id, accountId: salesContactsTable.accountId, salesforceId: salesContactsTable.salesforceId });
  return { contactId: contact.id, accountId: contact.accountId, salesforceId: contact.salesforceId };
}
