/**
 * Service-level wiring test for the SFDC sync filters (Task #1356/#1358).
 *
 * The WHERE builders are unit-tested in sfdc-sync-filters.test.ts; this test
 * proves the four sync methods actually READ a connection's persisted
 * sync_filters and SPLICE the resulting WHERE clause into the SOQL they send.
 *
 * It runs against the REAL Postgres pool (to seed a connection + read its
 * filters back through the private getSyncFilters path) but stubs the network:
 * `querySalesforce` is spied so no Salesforce call happens — we just capture the
 * SOQL string each sync method builds and return an empty result set. The sync
 * methods still write a sfdc_sync_log row; those are torn down in afterAll.
 *
 * Asserted contract:
 *   - With filters set, each method's SOQL carries the expected WHERE clause.
 *   - With filters empty ({}), each method's SOQL has NO WHERE clause
 *     ("sync everything").
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { randomUUID } from "node:crypto";
import { pool, type SfdcSyncFilters } from "@workspace/db";
import { sfdcService } from "./sfdc-service";

const SLUG = `it-sfdcwire-${randomUUID().slice(0, 8)}`;
let tenantId = 0;
let connId = 0;

async function setFilters(filters: SfdcSyncFilters): Promise<void> {
  await pool.query(`UPDATE sfdc_connections SET sync_filters = $1 WHERE id = $2`, [
    JSON.stringify(filters),
    connId,
  ]);
}

/**
 * Spy querySalesforce, run a sync method, and return the SOQL it built. The
 * stub returns an empty record set so no DB upserts happen.
 */
async function captureSoql(run: () => Promise<unknown>): Promise<string> {
  const spy = vi
    .spyOn(sfdcService, "querySalesforce")
    .mockResolvedValue({ records: [], totalSize: 0, done: true });
  try {
    await run();
    expect(spy).toHaveBeenCalledTimes(1);
    return spy.mock.calls[0]![1] as string;
  } finally {
    spy.mockRestore();
  }
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $1, 'active', '{}'::jsonb) RETURNING id`,
    [SLUG],
  );
  tenantId = t.rows[0]!.id;

  const c = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_connections
       (tenant_id, instance_url, org_id, access_token, refresh_token, status, sync_filters)
     VALUES ($1, 'https://example.my.salesforce.com', $2, 'x', 'y', 'connected', '{}'::jsonb)
     RETURNING id`,
    [tenantId, `org-${randomUUID().slice(0, 8)}`],
  );
  connId = c.rows[0]!.id;
});

afterAll(async () => {
  // sfdc_sync_log + sfdc_connections cascade-delete with the tenant.
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
});

beforeEach(() => {
  vi.restoreAllMocks();
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("SFDC sync methods apply persisted filters to their SOQL", () => {
  it("syncAccounts splices the account WHERE clause", async () => {
    await setFilters({ accounts: { types: ["Enterprise", "SMB"], industries: ["Healthcare"] } });
    const soql = await captureSoql(() => sfdcService.syncAccounts(connId, tenantId));
    expect(soql).toContain(
      "WHERE Type IN ('Enterprise', 'SMB') AND Industry IN ('Healthcare')",
    );
    // WHERE is spliced BEFORE LIMIT.
    expect(soql).toMatch(/WHERE .* LIMIT 10000$/);
  });

  it("syncContacts scopes via the Account relationship", async () => {
    await setFilters({ accounts: { types: ["Enterprise"] }, contacts: { createdWithinYears: 2 } });
    const soql = await captureSoql(() => sfdcService.syncContacts(connId, tenantId));
    expect(soql).toMatch(
      /WHERE Account\.Type IN \('Enterprise'\) AND CreatedDate >= \d{4}-\d{2}-\d{2}T00:00:00Z LIMIT 10000$/,
    );
  });

  it("syncLeads applies the status filter", async () => {
    await setFilters({ leads: { statuses: ["Open", "Working"] } });
    const soql = await captureSoql(() => sfdcService.syncLeads(connId, tenantId));
    expect(soql).toContain("WHERE Status IN ('Open', 'Working')");
  });

  it("syncOpportunities applies stage + status toggles", async () => {
    await setFilters({ opportunities: { stages: ["Closed Won"], status: "won" } });
    const soql = await captureSoql(() => sfdcService.syncOpportunities(connId, tenantId));
    expect(soql).toContain("WHERE StageName IN ('Closed Won') AND IsWon = true");
  });

  it("emits NO WHERE clause when filters are empty (sync everything)", async () => {
    await setFilters({});
    for (const run of [
      () => sfdcService.syncAccounts(connId, tenantId),
      () => sfdcService.syncContacts(connId, tenantId),
      () => sfdcService.syncLeads(connId, tenantId),
      () => sfdcService.syncOpportunities(connId, tenantId),
    ]) {
      const soql = await captureSoql(run);
      expect(soql).not.toContain("WHERE");
      expect(soql).toMatch(/ LIMIT 10000$/);
    }
  });
});
