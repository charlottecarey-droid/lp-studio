/**
 * Service-level integration tests for marketo-service.ts against the REAL
 * Postgres pool.
 *
 * Covers:
 *   1. Idempotent outbound push-back — logEmailActivity / logMicrositeView /
 *      pushEngagementScore are keyed on (connectionId, localEventId): the first
 *      call pushes (and writes ONE marketo_activities_pushed ledger row); an
 *      identical retry returns {pushed:false} and writes nothing more. Distinct
 *      local events produce distinct ledger rows of the right eventType.
 *   2. A missing connection fails closed (pushed:false, no ledger row).
 *   3. getActiveConnection is tenant-scoped (right tenant → row, wrong tenant →
 *      null).
 *   4. Paginated bulk import — importLeads walks every page of every cached
 *      static list (driving applyImportedLead's SF-key matching: enrich existing
 *      contact / create under matched account / skip unlinked), tallies
 *      processed/created/updated/skipped, and finalizes the sync-log row.
 *
 * MARKETO_FAKE_MODE=1 is set before the service loads so the activity writers
 * skip the "activity type id not configured" guard and createCustomActivity
 * returns a canned id without a network call. The pagination test overrides the
 * private page-fetcher to feed deterministic multi-page lead batches (FAKE_MODE
 * otherwise returns an empty page), so the real DB matching/tally logic runs.
 */
process.env.MARKETO_FAKE_MODE = "1";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { dbAvailable } from "../test-utils/dbAvailable";
const {
  pool,
  db,
  marketoConnectionsTable,
  marketoActivitiesPushedTable,
  marketoListsTable,
  marketoSyncLogTable,
  salesAccountsTable,
  salesContactsTable,
} = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { marketoService } = await import("./marketo-service");

const createdTenantIds: number[] = [];

async function seedTenant(): Promise<number> {
  const slug = `it-mktosvc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Marketo Svc Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

async function seedConnection(
  tenantId: number,
  opts: { importUnlinkedLeads?: boolean; munchkin?: string } = {},
): Promise<number> {
  const [conn] = await db
    .insert(marketoConnectionsTable)
    .values({
      tenantId,
      munchkinId: opts.munchkin ?? `mk-${Math.floor(Math.random() * 1e9)}`,
      restEndpoint: "https://fake.mktorest.com/rest",
      identityEndpoint: "https://fake.mktorest.com/identity",
      clientId: "client-id",
      clientSecret: "client-secret",
      status: "connected",
      syncEnabled: true,
      importUnlinkedLeads: opts.importUnlinkedLeads ?? false,
    })
    .returning({ id: marketoConnectionsTable.id });
  return conn.id;
}

async function ledgerRows(connectionId: number, localEventId: string) {
  return db
    .select()
    .from(marketoActivitiesPushedTable)
    .where(
      and(
        eq(marketoActivitiesPushedTable.connectionId, connectionId),
        eq(marketoActivitiesPushedTable.localEventId, localEventId),
      ),
    );
}

let tenantId = 0;
let connectionId = 0;

beforeAll(async () => {
  tenantId = await seedTenant();
  connectionId = await seedConnection(tenantId);
}, 60_000);

afterAll(async () => {
  if (createdTenantIds.length) {
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    // marketo_* rows CASCADE on tenant delete.
    await pool.query(`DELETE FROM tenants WHERE id = ANY($1)`, [createdTenantIds]);
  }
  await pool.end().catch(() => undefined);
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("logEmailActivity — idempotent per local event", () => {
  it("pushes once then suppresses an identical retry", async () => {
    const localEventId = `email-${Math.random().toString(36).slice(2)}`;

    const first = await marketoService.logEmailActivity(connectionId, tenantId, {
      localEventId,
      marketoLeadId: 5001,
      subject: "Your demo recap",
      campaignName: "Q2 Outbound",
    });
    expect(first.pushed).toBe(true);
    expect(first.activityId).toBe("fake-activity-5001");

    const retry = await marketoService.logEmailActivity(connectionId, tenantId, {
      localEventId,
      marketoLeadId: 5001,
      subject: "Your demo recap",
    });
    expect(retry.pushed).toBe(false);
    expect(retry.activityId).toBeNull();

    const rows = await ledgerRows(connectionId, localEventId);
    expect(rows.length).toBe(1);
    expect(rows[0].eventType).toBe("email_sent");
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("logMicrositeView — idempotent per local event", () => {
  it("pushes once then suppresses an identical retry", async () => {
    const localEventId = `view-${Math.random().toString(36).slice(2)}`;

    const first = await marketoService.logMicrositeView(connectionId, tenantId, {
      localEventId,
      marketoLeadId: 6002,
      pageTitle: "Pricing microsite",
      pageUrl: "https://example.com/p/abc",
    });
    expect(first.pushed).toBe(true);
    expect(first.activityId).toBe("fake-activity-6002");

    const retry = await marketoService.logMicrositeView(connectionId, tenantId, {
      localEventId,
      marketoLeadId: 6002,
      pageTitle: "Pricing microsite",
    });
    expect(retry.pushed).toBe(false);

    const rows = await ledgerRows(connectionId, localEventId);
    expect(rows.length).toBe(1);
    expect(rows[0].eventType).toBe("microsite_view");
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("pushEngagementScore — idempotent per local event", () => {
  it("pushes once then suppresses an identical retry", async () => {
    const localEventId = `score-${Math.random().toString(36).slice(2)}`;

    const first = await marketoService.pushEngagementScore(connectionId, tenantId, {
      localEventId,
      marketoLeadId: 7003,
      label: "Hot",
      numericScore: 92,
    });
    expect(first.pushed).toBe(true);

    const retry = await marketoService.pushEngagementScore(connectionId, tenantId, {
      localEventId,
      marketoLeadId: 7003,
      label: "Hot",
      numericScore: 92,
    });
    expect(retry.pushed).toBe(false);

    const rows = await ledgerRows(connectionId, localEventId);
    expect(rows.length).toBe(1);
    expect(rows[0].eventType).toBe("engagement_score");
  });

  it("distinct local events each create their own ledger row", async () => {
    const idA = `score-a-${Math.random().toString(36).slice(2)}`;
    const idB = `score-b-${Math.random().toString(36).slice(2)}`;
    const a = await marketoService.pushEngagementScore(connectionId, tenantId, {
      localEventId: idA, marketoLeadId: 7100, label: "Warm", numericScore: 60,
    });
    const b = await marketoService.pushEngagementScore(connectionId, tenantId, {
      localEventId: idB, marketoLeadId: 7100, label: "Hot", numericScore: 90,
    });
    expect(a.pushed).toBe(true);
    expect(b.pushed).toBe(true);
    expect((await ledgerRows(connectionId, idA)).length).toBe(1);
    expect((await ledgerRows(connectionId, idB)).length).toBe(1);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("push-back fails closed on a missing connection", () => {
  it("returns pushed:false and writes no ledger row for a bogus connection id", async () => {
    const localEventId = `email-missing-${Math.random().toString(36).slice(2)}`;
    const res = await marketoService.logEmailActivity(999_000_001, tenantId, {
      localEventId,
      marketoLeadId: 1,
      subject: "nope",
    });
    expect(res.pushed).toBe(false);
    const rows = await ledgerRows(999_000_001, localEventId);
    expect(rows.length).toBe(0);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("getActiveConnection — tenant scoped", () => {
  it("returns the row for the owning tenant and null for any other", async () => {
    const mine = await marketoService.getActiveConnection(tenantId);
    expect(mine?.id).toBe(connectionId);

    const otherTenantId = await seedTenant();
    const theirs = await marketoService.getActiveConnection(otherTenantId);
    expect(theirs).toBeNull();
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("importLeads — paginated bulk import with SF-key matching", () => {
  it("walks every page, applies match rules, tallies counts, and completes the sync log", async () => {
    const importTenantId = await seedTenant();
    const importConnId = await seedConnection(importTenantId, { importUnlinkedLeads: false });

    // A cached static list is required for importLeads to iterate.
    await db.insert(marketoListsTable).values({
      tenantId: importTenantId,
      connectionId: importConnId,
      marketoId: "9001",
      listType: "static_list",
      name: "Imported List",
      fetchedAt: new Date(),
    });

    // (a) An existing SF-linked contact → "updated".
    const [acct] = await db
      .insert(salesAccountsTable)
      .values({ tenantId: importTenantId, name: "Acme Dental", status: "active", salesforceId: "SFA-1" })
      .returning({ id: salesAccountsTable.id });
    await db.insert(salesContactsTable).values({
      tenantId: importTenantId,
      accountId: acct.id,
      firstName: "Existing",
      lastName: "Contact",
      salesforceId: "SFC-1",
    });

    // The deterministic multi-page feed (FAKE_MODE would otherwise return one
    // empty page). Page 1 carries the "updated" + "created" leads, page 2 the
    // "skipped" unlinked lead — proving the nextPageToken loop runs > once.
    const pages: Array<{ records: Array<Record<string, unknown>>; nextPageToken?: string }> = [
      {
        records: [
          { id: 1111, firstName: "Existing", lastName: "Contact", sfdcContactId: "SFC-1", leadScore: 80 },
          { id: 2222, firstName: "New", lastName: "UnderAccount", email: "new@acme.test", sfdcAccountId: "SFA-1" },
        ],
        nextPageToken: "page-2",
      },
      {
        records: [
          { id: 3333, firstName: "Orphan", lastName: "Lead", email: "orphan@nowhere.test" },
        ],
        nextPageToken: undefined,
      },
    ];

    const svc = marketoService as unknown as {
      getLeadsByListPage: (
        connection: unknown,
        listId: string,
        token: string | undefined,
      ) => Promise<{ records: Array<Record<string, unknown>>; nextPageToken?: string }>;
    };
    const original = svc.getLeadsByListPage;
    svc.getLeadsByListPage = async (_connection, _listId, token) => {
      if (!token) return pages[0];
      const idx = pages.findIndex((p) => p.nextPageToken === token) + 1;
      return pages[idx] ?? { records: [], nextPageToken: undefined };
    };

    try {
      const result = await marketoService.importLeads(importConnId, importTenantId);
      expect(result.processed).toBe(3);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);

      const [log] = await db
        .select()
        .from(marketoSyncLogTable)
        .where(eq(marketoSyncLogTable.id, result.logId));
      expect(log.status).toBe("completed");
      expect(log.objectType).toBe("leads");
      expect(log.recordsProcessed).toBe(3);
      expect(log.lastCursor).toBeNull();

      // The SF-linked contact was enriched, not duplicated.
      const enriched = await db
        .select()
        .from(salesContactsTable)
        .where(
          and(
            eq(salesContactsTable.tenantId, importTenantId),
            eq(salesContactsTable.salesforceId, "SFC-1"),
          ),
        );
      expect(enriched.length).toBe(1);
      expect(enriched[0].marketoLeadId).toBe("1111");

      // The account-matched lead became a brand new contact under that account.
      const underAccount = await db
        .select()
        .from(salesContactsTable)
        .where(
          and(
            eq(salesContactsTable.tenantId, importTenantId),
            eq(salesContactsTable.marketoLeadId, "2222"),
          ),
        );
      expect(underAccount.length).toBe(1);
      expect(underAccount[0].accountId).toBe(acct.id);

      // The unlinked lead was skipped (importUnlinkedLeads is off).
      const orphan = await db
        .select()
        .from(salesContactsTable)
        .where(
          and(
            eq(salesContactsTable.tenantId, importTenantId),
            eq(salesContactsTable.marketoLeadId, "3333"),
          ),
        );
      expect(orphan.length).toBe(0);
    } finally {
      svc.getLeadsByListPage = original;
    }
  }, 30_000);
});
