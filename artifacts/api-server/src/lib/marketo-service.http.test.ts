/**
 * HTTP-layer integration tests for marketo-service.ts `importLeads`.
 *
 * The sibling file marketo-service.integration.test.ts runs in
 * MARKETO_FAKE_MODE and drives the import by overriding the private
 * `getLeadsByListPage` method — that proves the create/update/skip accounting
 * but bypasses the real request/response wiring entirely.
 *
 * This file does the opposite: FAKE_MODE is left OFF and `global.fetch` is
 * intercepted, so the REAL HTTP layer runs against canned Marketo REST
 * responses — `request()` (retry/refresh/rate-limit), token acquisition via
 * `refreshAccessToken`/`fetchToken`, `getLeadsByListPage`, and the
 * `nextPageToken` pagination loop are all exercised, with no private-method
 * override and no real network.
 *
 * Covered:
 *   1. nextPageToken-driven multi-page walk + first-time access-token
 *      acquisition (token fetched once via /oauth/token, cached for page 2).
 *   2. A mid-request 401 forces a single token re-acquisition + retry.
 *   3. A non-2xx (500) leads page and a malformed (success:false) page each
 *      surface as a failed sync-log row.
 *
 * The DB layer is the real Postgres pool (same as the sibling integration
 * test); only the network is mocked.
 */
delete process.env.MARKETO_FAKE_MODE; // ensure FAKE_MODE resolves to false on import

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

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

// ─── fast timers (keep wall-clock fast through the backoff) ────────
// request()'s rate-limit backoff sleeps via setTimeout. We swap in a stub
// that records the requested delay and fires the SHORT backoff sleeps
// (< PG_MIN_TIMER_MS) immediately so the exponential backoff math is exercised
// without the real multi-second waits. Larger timers — the pg pool's 5s
// connection-timeout and 30s idle-timeout — are passed through UNCHANGED, since
// firing those early tears the pool's connections down mid-query ("Connection
// terminated due to connection timeout"). The whole backoff schedule under test
// stays below 5s (cap-doubling only reaches 4000ms across 5 attempts), so the
// threshold cleanly separates our sleeps from pg's timers.
// Installed INSIDE each test body (after vitest already scheduled its own
// test-timeout via the real setTimeout), so the runner's timeout is unaffected.
const realSetTimeout = global.setTimeout;
const PG_MIN_TIMER_MS = 5000; // matches the db pool's connectionTimeoutMillis
let recordedDelays: number[] = [];

function installFastTimers() {
  recordedDelays = [];
  global.setTimeout = ((fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const delay = typeof ms === "number" ? ms : 0;
    recordedDelays.push(delay);
    return realSetTimeout(fn, delay < PG_MIN_TIMER_MS ? 0 : delay, ...args);
  }) as unknown as typeof setTimeout;
}

function restoreTimers() {
  global.setTimeout = realSetTimeout;
}

/**
 * True when `needle` appears in order (not necessarily contiguously) within
 * `haystack`. Lets us assert the backoff schedule survives incidental timers
 * (e.g. pg pool idle timers) interleaved into the recorded delays.
 */
function isSubsequence(needle: number[], haystack: number[]): boolean {
  let i = 0;
  for (const v of haystack) {
    if (i < needle.length && v === needle[i]) i++;
  }
  return i === needle.length;
}

// ─── fixtures ─────────────────────────────────────────────────────
const createdTenantIds: number[] = [];

async function seedTenant(): Promise<number> {
  const slug = `it-mktohttp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Marketo HTTP Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

async function seedConnection(
  tenantId: number,
  opts: {
    importUnlinkedLeads?: boolean;
    accessToken?: string;
    tokenExpiresAt?: Date;
  } = {},
): Promise<number> {
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
      importUnlinkedLeads: opts.importUnlinkedLeads ?? false,
      // Stored plaintext round-trips through decryptCredential() unchanged.
      accessToken: opts.accessToken ?? null,
      tokenExpiresAt: opts.tokenExpiresAt ?? null,
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

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("importLeads — real HTTP layer (mocked fetch)", () => {
  it("walks every page via nextPageToken and acquires the token once", async () => {
    const tenantId = await seedTenant();
    const connId = await seedConnection(tenantId, { importUnlinkedLeads: false });
    const listId = "9001";
    await seedStaticList(tenantId, connId, listId);

    // sales_accounts.salesforce_id, sales_contacts.salesforce_id and
    // sales_contacts.marketo_lead_id are all GLOBALLY unique (not tenant-scoped),
    // so every id this test writes is derived from the unique tenantId to never
    // collide with the sibling integration test running against the same DB.
    const sfAccountId = `SFA-http-${tenantId}`;
    const sfContactId = `SFC-http-${tenantId}`;
    const idUpdated = tenantId * 1000 + 11;
    const idCreated = tenantId * 1000 + 22;
    const idSkipped = tenantId * 1000 + 33;

    // (a) An existing SF-linked contact → "updated".
    const [acct] = await db
      .insert(salesAccountsTable)
      .values({ tenantId, name: "Acme Dental", status: "active", salesforceId: sfAccountId })
      .returning({ id: salesAccountsTable.id });
    await db.insert(salesContactsTable).values({
      tenantId,
      accountId: acct.id,
      firstName: "Existing",
      lastName: "Contact",
      salesforceId: sfContactId,
    });

    let tokenFetches = 0;
    const leadsTokensSeen: Array<string | null> = [];
    const bearersSeen: string[] = [];

    fetchHandler = (url, init) => {
      if (url.includes("/oauth/token")) {
        tokenFetches++;
        return fakeResponse({ access_token: "acquired-token-1", expires_in: 3600 });
      }
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (auth) bearersSeen.push(auth);
        const npt = new URL(url).searchParams.get("nextPageToken");
        leadsTokensSeen.push(npt);
        if (!npt) {
          return fakeResponse({
            success: true,
            result: [
              { id: idUpdated, firstName: "Existing", lastName: "Contact", sfdcContactId: sfContactId, leadScore: 80 },
              { id: idCreated, firstName: "New", lastName: "UnderAccount", email: "new@acme.test", sfdcAccountId: sfAccountId },
            ],
            moreResult: true,
            nextPageToken: "NPT-2",
          });
        }
        if (npt === "NPT-2") {
          return fakeResponse({
            success: true,
            result: [{ id: idSkipped, firstName: "Orphan", lastName: "Lead", email: "orphan@nowhere.test" }],
            moreResult: false,
          });
        }
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const result = await marketoService.importLeads(connId, tenantId);

    // Tally from a genuine two-page walk.
    expect(result.processed).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);

    // The loop made two leads requests: page 1 (no token) then page 2 (NPT-2).
    expect(leadsTokensSeen).toEqual([null, "NPT-2"]);

    // The token was fetched once and reused for the second page.
    expect(tokenFetches).toBe(1);
    expect(bearersSeen).toEqual(["Bearer acquired-token-1", "Bearer acquired-token-1"]);

    // Sync log finalized clean.
    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("completed");
    expect(log.recordsProcessed).toBe(3);
    expect(log.lastCursor).toBeNull();

    // The token was persisted (encrypted) on the connection.
    const [conn] = await db
      .select({ accessToken: marketoConnectionsTable.accessToken })
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.id, connId));
    expect(conn.accessToken).toBeTruthy();
    expect(conn.accessToken).not.toBe("acquired-token-1"); // stored encrypted, not plaintext

    // The SF-linked contact was enriched, not duplicated.
    const enriched = await db
      .select()
      .from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.salesforceId, sfContactId)));
    expect(enriched.length).toBe(1);
    expect(enriched[0].marketoLeadId).toBe(String(idUpdated));

    // The account-matched lead became a new contact under that account.
    const underAccount = await db
      .select()
      .from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.marketoLeadId, String(idCreated))));
    expect(underAccount.length).toBe(1);
    expect(underAccount[0].accountId).toBe(acct.id);

    // The unlinked lead was skipped.
    const orphan = await db
      .select()
      .from(salesContactsTable)
      .where(and(eq(salesContactsTable.tenantId, tenantId), eq(salesContactsTable.marketoLeadId, String(idSkipped))));
    expect(orphan.length).toBe(0);
  }, 30_000);

  it("re-acquires the token and retries once on a mid-request 401", async () => {
    const tenantId = await seedTenant();
    // Seed a currently-valid token so the FIRST request uses it (no upfront
    // refresh); the 401 then forces exactly one re-acquisition + retry.
    const connId = await seedConnection(tenantId, {
      importUnlinkedLeads: false,
      accessToken: "stale-but-unexpired",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const listId = "9101";
    await seedStaticList(tenantId, connId, listId);

    let tokenFetches = 0;
    let leadsAttempts = 0;
    const bearersSeen: string[] = [];

    fetchHandler = (url, init) => {
      if (url.includes("/oauth/token")) {
        tokenFetches++;
        return fakeResponse({ access_token: "refreshed-token", expires_in: 3600 });
      }
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        leadsAttempts++;
        bearersSeen.push((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
        if (leadsAttempts === 1) {
          // First call carries the stale token → 401.
          return fakeResponse("Unauthorized", { status: 401 });
        }
        // Retry after the forced refresh → success.
        return fakeResponse({
          success: true,
          result: [{ id: tenantId * 1000 + 44, firstName: "Orphan", lastName: "Lead", email: "orphan@nowhere.test" }],
          moreResult: false,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const result = await marketoService.importLeads(connId, tenantId);

    expect(leadsAttempts).toBe(2); // 401 then a single retry
    expect(tokenFetches).toBe(1); // exactly one re-acquisition
    expect(bearersSeen).toEqual(["Bearer stale-but-unexpired", "Bearer refreshed-token"]);

    // Import completed despite the transient 401.
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1); // unlinked + importUnlinkedLeads off

    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("completed");
  }, 30_000);

  it("re-acquires the token and retries once on an in-body token error (601)", async () => {
    const tenantId = await seedTenant();
    // Seed a currently-valid token so the FIRST request uses it (no upfront
    // refresh). Marketo then signals the expired/invalid token as a 200-OK body
    // with error code 601 — NOT an HTTP 401 — forcing exactly one
    // re-acquisition + retry through the TOKEN_ERROR_CODES branch of request().
    const connId = await seedConnection(tenantId, {
      importUnlinkedLeads: false,
      accessToken: "stale-but-unexpired",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const listId = "9601";
    await seedStaticList(tenantId, connId, listId);

    let tokenFetches = 0;
    let leadsAttempts = 0;
    const bearersSeen: string[] = [];

    fetchHandler = (url, init) => {
      if (url.includes("/oauth/token")) {
        tokenFetches++;
        return fakeResponse({ access_token: "refreshed-token", expires_in: 3600 });
      }
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        leadsAttempts++;
        bearersSeen.push((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
        if (leadsAttempts === 1) {
          // 200 OK body, but Marketo encodes an expired/invalid token (601).
          return fakeResponse({
            success: false,
            errors: [{ code: "601", message: "Access token invalid" }],
          });
        }
        // Retry after the forced refresh → success.
        return fakeResponse({
          success: true,
          result: [{ id: tenantId * 1000 + 66, firstName: "Orphan", lastName: "Lead", email: "orphan@nowhere.test" }],
          moreResult: false,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const result = await marketoService.importLeads(connId, tenantId);

    expect(leadsAttempts).toBe(2); // in-body 601 then a single retry
    expect(tokenFetches).toBe(1); // exactly one re-acquisition
    expect(bearersSeen).toEqual(["Bearer stale-but-unexpired", "Bearer refreshed-token"]);

    // Import completed despite the soft token error.
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1); // unlinked + importUnlinkedLeads off

    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("completed");
  }, 30_000);

  it("marks the sync log failed on a non-2xx (500) leads response", async () => {
    const tenantId = await seedTenant();
    const connId = await seedConnection(tenantId, {
      accessToken: "valid-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const listId = "9201";
    await seedStaticList(tenantId, connId, listId);

    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        return fakeResponse("Internal Server Error", { status: 500 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const result = await marketoService.importLeads(connId, tenantId);
    expect(result.processed).toBe(0);
    expect(result.created).toBe(0);

    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("failed");
    expect(log.errorMessage ?? "").toContain("500");

    const [conn] = await db
      .select({ lastSyncError: marketoConnectionsTable.lastSyncError })
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.id, connId));
    expect(conn.lastSyncError ?? "").toContain("500");
  }, 30_000);

  it("marks the sync log failed on a malformed (success:false) leads response", async () => {
    const tenantId = await seedTenant();
    const connId = await seedConnection(tenantId, {
      accessToken: "valid-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const listId = "9301";
    await seedStaticList(tenantId, connId, listId);

    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        // 200 OK body but Marketo encodes a non-token, non-rate-limit error.
        return fakeResponse({
          success: false,
          errors: [{ code: "1003", message: "Value for required field not specified" }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const result = await marketoService.importLeads(connId, tenantId);
    expect(result.processed).toBe(0);

    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("failed");
    expect(log.errorMessage ?? "").toContain("1003");
  }, 30_000);

  it("backs off then recovers across a 429 (Retry-After) and a rate-limit error code", async () => {
    const tenantId = await seedTenant();
    // Valid token so request() never detours to /oauth/token — every fetch the
    // handler sees is a leads request, and the retries are purely rate-limit.
    const connId = await seedConnection(tenantId, {
      accessToken: "valid-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const listId = "9401";
    await seedStaticList(tenantId, connId, listId);

    let leadsAttempts = 0;
    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        leadsAttempts++;
        if (leadsAttempts === 1) {
          // HTTP 429 with Retry-After: 2 → wait 2000ms, then double backoff.
          return fakeResponse("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "2" },
          });
        }
        if (leadsAttempts === 2) {
          // 200 OK body but Marketo encodes a rate-limit error code (606) →
          // wait the current backoff (1000ms), then double again.
          return fakeResponse({
            success: false,
            errors: [{ code: "606", message: "Max rate limit exceeded" }],
          });
        }
        // Third attempt succeeds.
        return fakeResponse({
          success: true,
          result: [{ id: tenantId * 1000 + 55, firstName: "Orphan", lastName: "Lead", email: "orphan@nowhere.test" }],
          moreResult: false,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    installFastTimers();
    let result: Awaited<ReturnType<typeof marketoService.importLeads>>;
    try {
      result = await marketoService.importLeads(connId, tenantId);
    } finally {
      restoreTimers();
    }

    // Two throttles then a success → exactly three leads requests.
    expect(leadsAttempts).toBe(3);

    // The backoff schedule: Retry-After (2000ms) honored first, then the
    // exponential backoff (1000ms) for the 606. Asserted as a subsequence so
    // incidental pg pool timers interleaved into the recording don't break it.
    expect(isSubsequence([2000, 1000], recordedDelays)).toBe(true);

    // The import recovered: the orphan lead was processed (skipped — unlinked).
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);

    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("completed");
    expect(log.recordsProcessed).toBe(1);

    const [conn] = await db
      .select({ lastSyncError: marketoConnectionsTable.lastSyncError })
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.id, connId));
    expect(conn.lastSyncError).toBeNull();
  }, 30_000);

  it("exhausts max attempts on relentless 429 → MarketoRateLimitError, sync log failed", async () => {
    const tenantId = await seedTenant();
    const connId = await seedConnection(tenantId, {
      accessToken: "valid-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const listId = "9501";
    await seedStaticList(tenantId, connId, listId);

    let leadsAttempts = 0;
    fetchHandler = (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        leadsAttempts++;
        // No Retry-After → falls back to the exponential backoff each time.
        return fakeResponse("Too Many Requests", { status: 429 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    installFastTimers();
    let result: Awaited<ReturnType<typeof marketoService.importLeads>>;
    try {
      result = await marketoService.importLeads(connId, tenantId);
    } finally {
      restoreTimers();
    }

    // RATE_LIMIT_MAX_ATTEMPTS attempts (5): four backed-off retries then the
    // fifth throws MarketoRateLimitError instead of sleeping a sixth time.
    expect(leadsAttempts).toBe(5);

    // Doubling from 500ms, capped at 30s: 500 → 1000 → 2000 → 4000 (four sleeps).
    expect(isSubsequence([500, 1000, 2000, 4000], recordedDelays)).toBe(true);

    // Nothing imported; the rate-limit error surfaced and failed the run.
    expect(result.processed).toBe(0);

    const [log] = await db
      .select()
      .from(marketoSyncLogTable)
      .where(eq(marketoSyncLogTable.id, result.logId));
    expect(log.status).toBe("failed");
    expect(log.errorMessage ?? "").toContain("MarketoRateLimitError");

    const [conn] = await db
      .select({ lastSyncError: marketoConnectionsTable.lastSyncError })
      .from(marketoConnectionsTable)
      .where(eq(marketoConnectionsTable.id, connId));
    expect(conn.lastSyncError ?? "").toContain("MarketoRateLimitError");
  }, 30_000);
});
