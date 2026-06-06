/**
 * Hermetic regression guard for the SCHEDULED Marketo lead-sync poller's
 * tenant-eligibility filter and in-process overlap guard
 * (marketoSyncPoller.ts → listEligibleConnections / runMarketoSyncPoll).
 *
 * The sibling marketoSyncPoller.http.test.ts deliberately drives a SINGLE
 * connection through runMarketoSyncForConnection because the real sweep
 * (runMarketoSyncPoll) selects tenants GLOBALLY across the whole DB — on the
 * shared (production) Neon database that dev's NEON_DATABASE_URL points at, a
 * global sweep would touch every other tenant's connection and steal their
 * scheduled work. So the only safe way to exercise the real sweep entry point
 * is against a HERMETIC, throwaway Postgres (see
 * `.agents/memory/hermetic-ephemeral-pg-tests.md`): we stand up our own
 * ephemeral cluster and repoint the env BEFORE the first `@workspace/db`
 * import, then build the schema straight from the drizzle schema via
 * `drizzle-kit push` (the full migration set can't replay on a blank DB).
 *
 * MARKETO_FAKE_MODE is left OFF (deleted before import) and `global.fetch` is
 * intercepted, so the real import/pagination wiring runs against canned Marketo
 * REST responses with no network.
 *
 * Covered:
 *   1. Eligibility filter — a sweep over a mix of eligible and ineligible
 *      connections (disconnected, sync-disabled, and a connection under a
 *      non-active/suspended tenant) imports ONLY the eligible one. The
 *      ineligible connections are never fetched, never write a sync-log row,
 *      and never create a contact.
 *   2. In-process overlap guard — two overlapping runMarketoSyncPoll() calls
 *      coalesce into ONE sweep (same in-flight promise), so the eligible
 *      tenant is imported exactly once even though the sweep was kicked twice.
 */
delete process.env.MARKETO_FAKE_MODE; // ensure FAKE_MODE resolves to false on import

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { startEphemeralPg, type EphemeralPg } from "../test-utils/ephemeralPg";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// these modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest
// of the file stays type-checked.
type Pg = typeof import("@workspace/db");
type Poller = typeof import("./marketoSyncPoller");
let pgMod: Pg;
let poller: Poller;
let epg: EphemeralPg;

/** Walk up from cwd to find the repo's `lib/db` package dir. */
function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

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

beforeAll(async () => {
  // 1. Stand up the throwaway cluster and repoint the db env at it BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  // 2. Build the real schema straight from the drizzle schema definitions.
  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(
      `drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`,
    );
  }

  // 3. Intercept fetch and load the db layer + poller under test.
  global.fetch = ((input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return Promise.resolve(fetchHandler(url, init));
  }) as typeof fetch;

  pgMod = await import("@workspace/db");
  poller = await import("./marketoSyncPoller");
}, 120_000);

beforeEach(async () => {
  fetchHandler = () => {
    throw new Error("fetchHandler not set for this test");
  };
  // Strict isolation between cases: a global sweep selects tenants across the
  // WHOLE db, so any rows left by a prior test would leak into the next sweep
  // (e.g. the eligibility test's eligible connection getting re-swept by the
  // overlap test). Truncate the marketo + tenant tables before every case.
  await pgMod.pool.query(
    `TRUNCATE marketo_sync_log, marketo_lists, marketo_connections, sales_contacts, tenants RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  global.fetch = originalFetch;
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

// ─── fixtures ─────────────────────────────────────────────────────
let seq = 0;

async function seedTenant(status: "active" | "suspended" | "inactive"): Promise<number> {
  const uniq = `${Date.now()}-${seq++}`;
  const r = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('Marketo Poll Tenant', $1, $2, 'growth') RETURNING id`,
    [`mktopoll-elig-${uniq}`, status],
  );
  return r.rows[0].id;
}

async function seedConnection(
  tenantId: number,
  opts: { status?: string; syncEnabled?: boolean } = {},
): Promise<number> {
  const [conn] = await pgMod.db
    .insert(pgMod.marketoConnectionsTable)
    .values({
      tenantId,
      munchkinId: `mk-${tenantId}-${Math.floor(Math.random() * 1e9)}`,
      restEndpoint: "https://fake.mktorest.com/rest",
      identityEndpoint: "https://fake.mktorest.com/identity",
      clientId: "client-id",
      clientSecret: "client-secret", // plaintext round-trips through decryptCredential
      status: opts.status ?? "connected",
      syncEnabled: opts.syncEnabled ?? true,
      importUnlinkedLeads: true, // leads with no SF keys become contacts
      accessToken: "valid-token", // plaintext; a valid token avoids a refresh round-trip
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: pgMod.marketoConnectionsTable.id });
  return conn.id;
}

async function seedStaticList(tenantId: number, connectionId: number, marketoId: string) {
  await pgMod.db.insert(pgMod.marketoListsTable).values({
    tenantId,
    connectionId,
    marketoId,
    listType: "static_list",
    name: `List ${marketoId}`,
    fetchedAt: new Date(),
  });
}

async function countSyncLogs(connectionId: number): Promise<number> {
  const r = await pgMod.pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM marketo_sync_log WHERE connection_id = $1`,
    [connectionId],
  );
  return Number(r.rows[0].c);
}

async function countContacts(tenantId: number): Promise<number> {
  const r = await pgMod.pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM sales_contacts WHERE tenant_id = $1`,
    [tenantId],
  );
  return Number(r.rows[0].c);
}

describe("scheduled Marketo sync poller — tenant eligibility filter (hermetic PG)", () => {
  it("imports only connected + sync-enabled connections under an active tenant", async () => {
    // ── Eligible: active tenant, connected, sync enabled. ──
    const eligibleTenant = await seedTenant("active");
    const eligibleConn = await seedConnection(eligibleTenant);
    const eligibleList = "9001";
    await seedStaticList(eligibleTenant, eligibleConn, eligibleList);

    // ── Ineligible (a): connection is disconnected. ──
    const disconnTenant = await seedTenant("active");
    const disconnConn = await seedConnection(disconnTenant, { status: "disconnected" });
    const disconnList = "9002";
    await seedStaticList(disconnTenant, disconnConn, disconnList);

    // ── Ineligible (b): sync explicitly disabled. ──
    const disabledTenant = await seedTenant("active");
    const disabledConn = await seedConnection(disabledTenant, { syncEnabled: false });
    const disabledList = "9003";
    await seedStaticList(disabledTenant, disabledConn, disabledList);

    // ── Ineligible (c): connection is fine but its tenant is suspended. ──
    const suspendedTenant = await seedTenant("suspended");
    const suspendedConn = await seedConnection(suspendedTenant);
    const suspendedList = "9004";
    await seedStaticList(suspendedTenant, suspendedConn, suspendedList);

    // listEligibleConnections is the filter itself: only the eligible row.
    const eligible = await poller.listEligibleConnections();
    expect(eligible).toEqual([{ connectionId: eligibleConn, tenantId: eligibleTenant }]);

    // Drive the real GLOBAL sweep. Only the eligible list may be fetched; any
    // other list request means an ineligible tenant leaked through the filter.
    const listsFetched: string[] = [];
    fetchHandler = (url) => {
      const m = url.match(/\/v1\/list\/(\d+)\/leads\.json/);
      if (m) {
        const listId = m[1];
        listsFetched.push(listId);
        if (listId === eligibleList) {
          return fakeResponse({
            success: true,
            result: [
              { id: eligibleTenant * 1000 + 1, firstName: "Eligible", lastName: "Lead", email: "elig@nowhere.test" },
            ],
            moreResult: false,
          });
        }
        // An ineligible list was fetched → the eligibility filter failed.
        throw new Error(`ineligible list ${listId} was fetched by the sweep`);
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    await poller.runMarketoSyncPoll();

    // Exactly the eligible list was visited.
    expect(listsFetched).toEqual([eligibleList]);

    // Only the eligible connection recorded a sync run; none of the ineligible
    // ones did (the import never started for them).
    expect(await countSyncLogs(eligibleConn)).toBe(1);
    expect(await countSyncLogs(disconnConn)).toBe(0);
    expect(await countSyncLogs(disabledConn)).toBe(0);
    expect(await countSyncLogs(suspendedConn)).toBe(0);

    // Only the eligible tenant got a contact imported.
    expect(await countContacts(eligibleTenant)).toBe(1);
    expect(await countContacts(disconnTenant)).toBe(0);
    expect(await countContacts(disabledTenant)).toBe(0);
    expect(await countContacts(suspendedTenant)).toBe(0);
  }, 60_000);
});

describe("scheduled Marketo sync poller — in-process overlap guard (hermetic PG)", () => {
  it("coalesces two overlapping runMarketoSyncPoll calls into a single sweep", async () => {
    const tenantId = await seedTenant("active");
    const connId = await seedConnection(tenantId);
    const listId = "9101";
    await seedStaticList(tenantId, connId, listId);

    // A gate the import's first (and only) leads fetch parks on, so the first
    // sweep is guaranteed to still be in flight when the second call is made.
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    let leadsFetches = 0;
    fetchHandler = async (url) => {
      if (url.includes(`/v1/list/${listId}/leads.json`)) {
        leadsFetches++;
        await gate;
        return fakeResponse({
          success: true,
          result: [
            { id: tenantId * 1000 + 1, firstName: "Once", lastName: "Only", email: "once@nowhere.test" },
          ],
          moreResult: false,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    // Count how many times the sweep runs its eligible-connection selection.
    // listEligibleConnections is the ONLY query in this path that joins
    // marketo_connections to tenants (importLeads' own loads are single-table),
    // so counting those SQL statements counts distinct sweep executions. The
    // in-process guard must collapse the two overlapping kicks into ONE sweep
    // (1 eligibility query); without it a second sweep body would run and query
    // again (then no-op on the per-tenant advisory lock).
    // NOTE: runMarketoSyncPoll is `async`, so it returns a fresh wrapper promise
    // even when it hands back the shared `inflight` — reference equality can't
    // observe the coalescing, but the single sweep execution can.
    const querySpy = vi.spyOn(pgMod.pool, "query");
    const eligibilityQueryText = (arg: unknown): boolean => {
      const text = typeof arg === "string" ? arg : (arg as { text?: string })?.text;
      return (
        typeof text === "string" &&
        /inner join/i.test(text) &&
        /marketo_connections/i.test(text) &&
        /tenants/i.test(text)
      );
    };
    try {
      // Kick the sweep twice while the first is parked on the gate.
      const p1 = poller.runMarketoSyncPoll();
      const p2 = poller.runMarketoSyncPoll();

      // Let the parked import finish and wait for the (single) sweep to complete.
      releaseGate();
      await Promise.all([p1, p2]);

      // Exactly one sweep ran: one eligibility query, one leads fetch, one
      // sync-log row, one imported contact — the overlapping call coalesced.
      const eligibilityQueries = querySpy.mock.calls.filter((c) => eligibilityQueryText(c[0]));
      expect(eligibilityQueries).toHaveLength(1);
      expect(leadsFetches).toBe(1);
      expect(await countSyncLogs(connId)).toBe(1);
      expect(await countContacts(tenantId)).toBe(1);
    } finally {
      querySpy.mockRestore();
    }
  }, 60_000);
});
