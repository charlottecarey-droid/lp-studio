/**
 * Integration tests for `importListMembers` — the targeted "import the members
 * of ONE static list" path, as opposed to importLeads' scan of every list.
 *
 * What's worth pinning here is the matching, because every case below produced
 * a wrong row at some point in this integration's history:
 *   1. Salesforce ids are compared on the 15-character form. Marketo returns
 *      18; we store 15; an exact comparison matched nothing at all.
 *   2. An existing contact is matched by EMAIL when it carries no Salesforce
 *      id — otherwise anyone already here from a CSV gets a second row, since
 *      the insert only dedupes on marketo_lead_id.
 *   3. Two members sharing an address become one contact, not two.
 *   4. `importUnlinked` is a per-call argument. With it off, a list of people
 *      with no Salesforce link imports nobody — which is the "0 created, 100%
 *      skipped" outcome that made the connection-level toggle useless here.
 *   5. The returned contactIds cover everyone on the list, including members
 *      imported by an earlier run, so a re-import still builds a whole audience.
 *
 * MARKETO_FAKE_MODE=1 keeps the network out; the private page-fetcher is
 * overridden to feed deterministic members, so the real DB matching runs.
 */
process.env.MARKETO_FAKE_MODE = "1";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { dbAvailable } from "../test-utils/dbAvailable";
const {
  pool,
  db,
  marketoConnectionsTable,
  marketoListsTable,
  marketoSyncLogTable,
  salesAccountsTable,
  salesContactsTable,
} = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { marketoService } = await import("./marketo-service");

const LIST_ID = "9001";
const createdTenantIds: number[] = [];

async function seedTenant(): Promise<number> {
  const slug = `it-mktolist-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Marketo List Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

/** Feed a fixed set of members for the list under test. */
function withMembers<T>(records: Record<string, unknown>[], run: () => Promise<T>): Promise<T> {
  const svc = marketoService as unknown as {
    getLeadsByListPage: (
      connection: unknown,
      listId: string,
      token: string | undefined,
    ) => Promise<{ records: Array<Record<string, unknown>>; nextPageToken?: string }>;
  };
  const original = svc.getLeadsByListPage;
  svc.getLeadsByListPage = async () => ({ records, nextPageToken: undefined });
  return run().finally(() => { svc.getLeadsByListPage = original; });
}

let tenantId = 0;
let connectionId = 0;
let accountId = 0;

beforeAll(async () => {
  tenantId = await seedTenant();

  const [conn] = await db.insert(marketoConnectionsTable).values({
    tenantId,
    munchkinId: `mk-${Math.floor(Math.random() * 1e9)}`,
    restEndpoint: "https://fake.mktorest.com/rest",
    identityEndpoint: "https://fake.mktorest.com/identity",
    clientId: "client-id",
    clientSecret: "client-secret",
    status: "connected",
    // Deliberately OFF: the list import must not depend on it.
    syncEnabled: false,
    importUnlinkedLeads: false,
  }).returning({ id: marketoConnectionsTable.id });
  connectionId = conn.id;

  await db.insert(marketoListsTable).values({
    tenantId, connectionId, marketoId: LIST_ID, listType: "static_list",
    name: "Webinar Attendees", fetchedAt: new Date(),
  });

  // An account carrying an 18-char Salesforce id, stored as the 15-char form.
  const [account] = await db.insert(salesAccountsTable).values({
    tenantId, name: "Bright Smiles DSO", status: "prospect", salesforceId: "0011234567ABCDE",
  }).returning({ id: salesAccountsTable.id });
  accountId = account.id;

  await db.insert(salesContactsTable).values([
    // Known via Salesforce.
    { tenantId, accountId, firstName: "Darby", lastName: "Tinker",
      email: "darby@brightsmiles.test", salesforceId: "0031234567ABCDE" },
    // Known only by email — the CSV-imported case.
    { tenantId, accountId, firstName: "Sam", lastName: "Vee", email: "sam@brightsmiles.test" },
  ]);
}, 60_000);

afterAll(async () => {
  if (createdTenantIds.length) {
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    await pool.query(`DELETE FROM tenants WHERE id = ANY($1)`, [createdTenantIds]);
  }
  await pool.end().catch(() => undefined);
});

describe.skipIf(!dbAvailable)("importListMembers", () => {
  it("matches on 15-char SF ids and on email, and dedupes within the batch", async () => {
    const result = await withMembers([
      // Marketo hands back the 18-character id for a contact we store as 15.
      { id: 1111, firstName: "Darby", lastName: "Tinker", email: "darby@brightsmiles.test",
        sfdcContactId: "0031234567ABCDEXYZ", leadScore: 42 },
      // No Salesforce id at all — must match the existing row by email.
      { id: 2222, firstName: "Sam", lastName: "Vee", email: "sam@brightsmiles.test" },
      // Account-linked newcomer.
      { id: 3333, firstName: "New", lastName: "Person", email: "new@brightsmiles.test",
        sfdcAccountId: "0011234567ABCDEXYZ" },
      // Unlinked newcomers sharing one address — one contact, not two.
      { id: 4444, firstName: "Twin", lastName: "One", email: "twin@nowhere.test" },
      { id: 5555, firstName: "Twin", lastName: "Two", email: "twin@nowhere.test" },
    ], () => marketoService.importListMembers(connectionId, tenantId, LIST_ID));

    expect(result.processed).toBe(5);
    expect(result.updated).toBe(2);   // SF-matched + email-matched
    expect(result.created).toBe(2);   // account-linked + one twin
    expect(result.skipped).toBe(1);   // the duplicate address

    // The Salesforce-linked contact was enriched, not duplicated.
    const darby = await db.select().from(salesContactsTable).where(and(
      eq(salesContactsTable.tenantId, tenantId),
      eq(salesContactsTable.salesforceId, "0031234567ABCDE"),
    ));
    expect(darby.length).toBe(1);
    expect(darby[0].marketoLeadId).toBe("1111");

    // The email-only contact was matched rather than duplicated.
    const sams = await db.select().from(salesContactsTable).where(and(
      eq(salesContactsTable.tenantId, tenantId),
      eq(salesContactsTable.email, "sam@brightsmiles.test"),
    ));
    expect(sams.length).toBe(1);
    expect(sams[0].marketoLeadId).toBe("2222");

    // The account-linked newcomer landed under the matched account.
    const newcomer = await db.select().from(salesContactsTable).where(and(
      eq(salesContactsTable.tenantId, tenantId),
      eq(salesContactsTable.marketoLeadId, "3333"),
    ));
    expect(newcomer.length).toBe(1);
    expect(newcomer[0].accountId).toBe(accountId);

    // One row for the shared address.
    const twins = await db.select().from(salesContactsTable).where(and(
      eq(salesContactsTable.tenantId, tenantId),
      eq(salesContactsTable.email, "twin@nowhere.test"),
    ));
    expect(twins.length).toBe(1);

    // Everyone the list resolves to locally — this is the audience.
    expect(result.contactIds.length).toBe(4);

    const [log] = await db.select().from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("completed");
    expect(log.objectType).toBe(`list:${LIST_ID}`);
    expect(log.recordsProcessed).toBe(5);
  }, 30_000);

  it("re-importing the same list creates nobody new and still returns the whole audience", async () => {
    const result = await withMembers([
      { id: 1111, firstName: "Darby", lastName: "Tinker", email: "darby@brightsmiles.test",
        sfdcContactId: "0031234567ABCDEXYZ" },
      { id: 3333, firstName: "New", lastName: "Person", email: "new@brightsmiles.test",
        sfdcAccountId: "0011234567ABCDEXYZ" },
    ], () => marketoService.importListMembers(connectionId, tenantId, LIST_ID));

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);
    expect(result.contactIds.length).toBe(2);
  }, 30_000);

  it("importUnlinked=false skips members with no Salesforce link", async () => {
    const result = await withMembers([
      { id: 7777, firstName: "Nobody", lastName: "Known", email: "nobody@nowhere.test" },
    ], () => marketoService.importListMembers(connectionId, tenantId, LIST_ID, { importUnlinked: false }));

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    const rows = await db.select().from(salesContactsTable).where(and(
      eq(salesContactsTable.tenantId, tenantId),
      eq(salesContactsTable.marketoLeadId, "7777"),
    ));
    expect(rows.length).toBe(0);
  }, 30_000);
});
