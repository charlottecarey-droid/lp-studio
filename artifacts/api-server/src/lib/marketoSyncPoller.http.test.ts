/**
 * HTTP-layer integration tests for the SCHEDULED Marketo lead-sync poller
 * (marketoSyncPoller.ts → marketo-service `importLeads({syncType:"scheduled",
 * resume:true})`).
 *
 * The sibling marketo-service.http.test.ts proves the on-demand (manual)
 * importLeads HTTP wiring. This file proves the part the poller adds on top:
 * the CROSS-RUN resume cursor and the per-tenant advisory lock.
 *
 * As in the manual HTTP test, FAKE_MODE is left OFF and `global.fetch` is
 * intercepted, so the real request/pagination/token wiring runs against canned
 * Marketo REST responses with no network. The DB layer is the real Postgres
 * pool. The poller is driven through its real per-connection entry point
 * (runMarketoSyncForConnection) — NOT runMarketoSyncPoll, which sweeps EVERY
 * eligible tenant on the shared Neon DB and would steal other tenants' work.
 *
 * Covered:
 *   1. Resume across two runs — run 1 pages once, persists the in-flight list's
 *      nextPageToken into marketo_connections.metadata.scheduledSync, then fails
 *      on the next page (cursor deliberately LEFT in place). Run 2 resumes: its
 *      first leads request carries that exact nextPageToken (not a from-the-top
 *      re-scan), drains the list, completes, and CLEARS the cursor.
 *   2. Per-tenant advisory lock — while another "instance" holds
 *      pg_advisory_xact_lock(950, tenantId), a concurrent tick skips the tenant
 *      entirely (no import, no sync-log row). Once the lock frees, the tick runs.
 */
delete process.env.MARKETO_FAKE_MODE; // ensure FAKE_MODE resolves to false on import

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const {
  pool,
  db,
  marketoConnectionsTable,
  marketoListsTable,
  marketoSyncLogTable,
  salesContactsTable,
} = await import("@workspace/db");
const { eq, desc } = await import("drizzle-orm");
const { runMarketoSyncForConnection } = await import("./marketoSyncPoller");

// Mirror of marketoSyncPoller.ts ADVISORY_LOCK_CLASSID (not exported). The
// object id is the tenant id, so the lock is per-tenant.
const ADVISORY_LOCK_CLASSID = 950;

// ─── fetch interception ───────────────────────────────────────────
type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let fetchHandler: FetchHandler = () => {
  throw new Error("fetchHandler not set for this test");
};
const originalFetch = global.fetch;

function fakeResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Map(Object.entries(init.headers ?? {}));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers.get(k) ?? null },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

// ─── fixtures ─────────────────────────────────────────────────────
const createdTenantIds: number[] = [];

async function seedTenant(): Promise<number> {
  const slug = `it-mktopoll-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Marketo Poller Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

async function seedConnection(tenantId: number): Promise<number> {
  const [conn] = await db
    .insert(marketoConnectionsTable)
    .values({
      tenantId,
      munchkinId: `mk-${Math.floor(Math.random() * 1e9)}`,
      restEndpoint: "https://fake.mktorest.com/rest",
      identityEndpoint: "https://fake.mktorest.com/identity",
      clientId: "client-id",
      clientSecret: "client-secret",
      status: "connected",
      syncEnabled: true,
      importUnlinkedLeads: true, // leads with no SF keys become contacts
      // A currently-valid token so no upfront /oauth/token round-trip is needed.
      accessToken: "valid-token", // plaintext round-trips through decryptCredential
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: marketoConnectionsTable.id });
  return conn.id;
}

async function seedStaticList(tenantId: number, connectionId: number, marketoId: string) {
  await db.insert(marketoListsTable).values({
    tenantId,
    connectionId,
    marketoId,
    listType: "static_list",
    name: `List ${marketoId}`,
    fetchedAt: new Date(),
  });
}

async function readScheduledSync(connectionId: number): Promise<unknown> {
  const [conn] = await db
    .select({ metadata: marketoConnectionsTable.metadata })
    .from(marketoConnectionsTable)
    .where(eq(marketoConnectionsTable.id, connectionId));
  return ((conn?.metadata ?? {}) as Record<string, unknown>).scheduledSync ?? null;
}

async function latestLog(connectionId: number) {
  const [log] = await db
    .select()
    .from(marketoSyncLogTable)
    .where(eq(marketoSyncLogTable.connectionId, connectionId))
    .orderBy(desc(marketoSyncLogTable.id))
    .limit(1);
  return log;
}

beforeAll(() => {
  global.fetch = ((input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return Promise.resolve(fetchHandler(url, init));
  }) as typeof fetch;
}, 60_000);

beforeEach(() => {
  fetchHandler = () => {
    throw new Error("fetchHandler not set for this test");
  };
});

afterAll(async () => {
  global.fetch = originalFetch;
  if (createdTenantIds.length) {
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    // marketo_* rows CASCADE on tenant delete.
    await pool.query(`DELETE FROM tenants WHERE id = ANY($1)`, [createdTenantIds]);
  }
  await pool.end().catch(() => undefined);
});

describe("scheduled Marketo sync poller — resume + advisory lock (mocked fetch)", () => {
  it("resumes the second run from the persisted nextPageToken instead of restarting", async () => {
    const tenantId = await seedTenant();
    const connId = await seedConnection(tenantId);
    const listId = "8001";
    await seedStaticList(tenantId, connId, listId);

    // Per-run-unique lead ids: marketo_lead_id is GLOBALLY unique on the shared
    // Neon DB (see memory marketo-test-isolation), so derive from tenantId.
    const idPage1 = tenantId * 1000 + 11;
    const idPage2 = tenantId * 1000 + 22;
    const cursor = `NPT-${tenantId}-2`;

    // ── Run 1: page 1 succeeds (saving the cursor), page 2 fails (500). ──
    // The interrupted run must LEAVE the resume cursor in metadata so the next
    // run can pick it up.
    const run1TokensSeen: Array<string | null> = [];
    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        const npt = new URL(url).searchParams.get("nextPageToken");
        run1TokensSeen.push(npt);
        if (!npt) {
          return fakeResponse({
            success: true,
            result: [{ id: idPage1, firstName: "Page1", lastName: "Lead", email: "p1@nowhere.test" }],
            moreResult: true,
            nextPageToken: cursor,
          });
        }
        if (npt === cursor) {
          // The next page blows up — run is interrupted mid-list.
          return fakeResponse("Internal Server Error", { status: 500 });
        }
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const run1 = await runMarketoSyncForConnection({ connectionId: connId, tenantId });
    // The lock was acquired and the import was attempted (importLeads swallows
    // the page error into a failed sync-log row, so the poller reports "ran").
    expect(run1).toBe("ran");

    // Run 1 walked page 1 (no token) then attempted page 2 (the saved cursor).
    expect(run1TokensSeen).toEqual([null, cursor]);

    // The interrupted run left the resume cursor in place, scoped to the list.
    expect(await readScheduledSync(connId)).toEqual({ listId, cursor });

    const log1 = await latestLog(connId);
    expect(log1.syncType).toBe("scheduled");
    expect(log1.status).toBe("failed");

    // Page 1's lead was applied before the failure.
    const afterRun1 = await db
      .select()
      .from(salesContactsTable)
      .where(eq(salesContactsTable.tenantId, tenantId));
    expect(afterRun1.map((c) => c.marketoLeadId).sort()).toEqual([String(idPage1)]);

    // ── Run 2: must RESUME from the saved cursor, not restart from null. ──
    const run2TokensSeen: Array<string | null> = [];
    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        const npt = new URL(url).searchParams.get("nextPageToken");
        run2TokensSeen.push(npt);
        if (npt === cursor) {
          // Resumed page drains the list cleanly.
          return fakeResponse({
            success: true,
            result: [{ id: idPage2, firstName: "Page2", lastName: "Lead", email: "p2@nowhere.test" }],
            moreResult: false,
          });
        }
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const run2 = await runMarketoSyncForConnection({ connectionId: connId, tenantId });
    expect(run2).toBe("ran");

    // The crux: the very first request of run 2 carried the persisted cursor —
    // it did NOT restart the list from the top (which would have been [null]).
    expect(run2TokensSeen).toEqual([cursor]);

    // Completed cleanly → cursor cleared so the NEXT scheduled run starts fresh.
    expect(await readScheduledSync(connId)).toBeNull();

    const log2 = await latestLog(connId);
    expect(log2.id).not.toBe(log1.id);
    expect(log2.status).toBe("completed");
    expect(log2.lastCursor).toBeNull();
    expect(log2.recordsProcessed).toBe(1); // only the resumed page

    // Both pages' leads now exist; the resume neither dropped page 1 nor
    // re-fetched it (page 1 was never re-requested in run 2).
    const afterRun2 = await db
      .select()
      .from(salesContactsTable)
      .where(eq(salesContactsTable.tenantId, tenantId));
    expect(afterRun2.map((c) => c.marketoLeadId).sort()).toEqual(
      [String(idPage1), String(idPage2)].sort(),
    );
  }, 30_000);

  it("skips the tick while another instance holds the per-tenant advisory lock", async () => {
    const tenantId = await seedTenant();
    const connId = await seedConnection(tenantId);
    const listId = "8101";
    await seedStaticList(tenantId, connId, listId);

    // Simulate a second app instance already importing this tenant: hold the
    // per-tenant xact-scoped advisory lock on a dedicated connection.
    const holder = await pool.connect();
    await holder.query("BEGIN");
    const held = await holder.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1, $2) AS locked",
      [ADVISORY_LOCK_CLASSID, tenantId],
    );
    expect(held.rows[0].locked).toBe(true);

    try {
      // fetchHandler stays the throwing default: if the import ran, the test
      // would fail loudly on the first leads request.
      const blocked = await runMarketoSyncForConnection({ connectionId: connId, tenantId });
      expect(blocked).toBe("skipped");

      // The import never started → no sync-log row was written for this tenant.
      const logsWhileLocked = await db
        .select({ id: marketoSyncLogTable.id })
        .from(marketoSyncLogTable)
        .where(eq(marketoSyncLogTable.connectionId, connId));
      expect(logsWhileLocked.length).toBe(0);
    } finally {
      // Release the lock (xact-scoped → released on ROLLBACK).
      await holder.query("ROLLBACK").catch(() => undefined);
      holder.release();
    }

    // With the lock free, the tick now runs and records its sync-log row.
    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        return fakeResponse({
          success: true,
          result: [{ id: tenantId * 1000 + 33, firstName: "After", lastName: "Unlock", email: "after@nowhere.test" }],
          moreResult: false,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const afterUnlock = await runMarketoSyncForConnection({ connectionId: connId, tenantId });
    expect(afterUnlock).toBe("ran");

    const log = await latestLog(connId);
    expect(log.status).toBe("completed");
    expect(log.recordsProcessed).toBe(1);
  }, 30_000);
});
