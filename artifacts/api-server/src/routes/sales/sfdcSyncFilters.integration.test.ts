/**
 * Integration test for the SFDC sync-filters editor API (Task #1356/#1358).
 *
 * Runs the REAL sfdc router against the REAL Postgres pool, injecting requests
 * IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/inject). The full middleware chain runs (cookie-parser, body
 * parsing, requireAuth, getTenantId, the route handlers + their DB reads/writes).
 *
 * Asserted contract:
 *   1. Auth: an unauthenticated request gets 401 on both routes.
 *   2. Round-trip: PUT a tenant's filters, then GET them back and see the
 *      persisted JSONB on the tenant's own connection.
 *   3. Validation: PUT fails closed (400) on an invalid shape and never mutates
 *      the stored filters.
 *   4. Tenant scope: each tenant only reads/writes the filters on ITS OWN
 *      connection — tenant B's GET never sees tenant A's filters, and a PUT by
 *      one tenant leaves the other tenant's connection untouched.
 *   5. Empty payload clears all filters ("sync everything").
 *
 * All rows created here are torn down in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import type { SfdcSyncFilters } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import sfdcRouter from "./sfdc";

const A_SID = `it-sfdcfilt-a-${randomUUID()}`;
const B_SID = `it-sfdcfilt-b-${randomUUID()}`;
const S_SID = `it-sfdcfilt-super-${randomUUID()}`;
const A_UID = 999310001;
const B_UID = 999310002;
const S_UID = 999310003;
const A_SLUG = `it-sfdcfilt-a-${randomUUID().slice(0, 8)}`;
const B_SLUG = `it-sfdcfilt-b-${randomUUID().slice(0, 8)}`;

let app: Express;
let tenantA = 0;
let tenantB = 0;
let connA = 0;
let connB = 0;

function injectSid(opts: {
  method: string;
  url: string;
  sid?: string;
  body?: unknown;
  xTenantId?: string;
}): Promise<InjectResponse> {
  const headers: Record<string, string> = {};
  if (opts.sid) headers["cookie"] = `${SESSION_COOKIE}=${opts.sid}`;
  if (opts.xTenantId !== undefined) headers["x-tenant-id"] = opts.xTenantId;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: "it@example.com",
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role: "viewer",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...u,
  };
  return JSON.stringify(full);
}

async function seedSession(sid: string, user: Partial<AuthUser> & Pick<AuthUser, "userId">): Promise<void> {
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

async function seedTenant(slug: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $1, 'active', '{}'::jsonb) RETURNING id`,
    [slug],
  );
  return t.rows[0]!.id;
}

async function seedConnection(tenantId: number): Promise<number> {
  const c = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_connections
       (tenant_id, instance_url, org_id, access_token, refresh_token, status, sync_filters)
     VALUES ($1, 'https://example.my.salesforce.com', $2, 'x', 'y', 'connected', '{}'::jsonb)
     RETURNING id`,
    [tenantId, `org-${randomUUID().slice(0, 8)}`],
  );
  return c.rows[0]!.id;
}

beforeAll(async () => {
  tenantA = await seedTenant(A_SLUG);
  tenantB = await seedTenant(B_SLUG);
  connA = await seedConnection(tenantA);
  connB = await seedConnection(tenantB);

  await seedSession(A_SID, { userId: A_UID, tenantId: tenantA, isAdmin: true });
  await seedSession(B_SID, { userId: B_UID, tenantId: tenantB, isAdmin: true });
  // A platform operator (app_users.role='superadmin') whose OWN tenant is A.
  // The X-Tenant-Id override lets it act on tenant B's connection.
  await seedSession(S_SID, {
    userId: S_UID,
    tenantId: tenantA,
    isAdmin: false,
    appUserRole: "superadmin",
  });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/sales", sfdcRouter);
});

afterAll(async () => {
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[A_SID, B_SID]]).catch(() => {});
  // sfdc_connections cascade-delete with their tenant.
  await pool.query(`DELETE FROM tenants WHERE id = ANY($1)`, [[tenantA, tenantB]]).catch(() => {});
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("SFDC sync-filters API", () => {
  it("returns 401 when unauthenticated on both routes", async () => {
    const get = await injectSid({ method: "GET", url: "/api/sales/sfdc/sync-filters" });
    expect(get.status).toBe(401);
    const put = await injectSid({ method: "PUT", url: "/api/sales/sfdc/sync-filters", body: {} });
    expect(put.status).toBe(401);
  });

  it("starts with empty filters (sync everything)", async () => {
    const res = await injectSid({ method: "GET", url: "/api/sales/sfdc/sync-filters", sid: A_SID });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({});
  });

  it("round-trips a PUT of filters and persists them on the caller's own connection", async () => {
    const filters: SfdcSyncFilters = {
      accounts: { types: ["Enterprise"], industries: ["Healthcare"] },
      opportunities: { status: "won", closedWithinYears: 2 },
    };
    const put = await injectSid({
      method: "PUT",
      url: "/api/sales/sfdc/sync-filters",
      sid: A_SID,
      body: filters,
    });
    expect(put.status).toBe(200);
    expect(put.json).toEqual(filters);

    const get = await injectSid({ method: "GET", url: "/api/sales/sfdc/sync-filters", sid: A_SID });
    expect(get.status).toBe(200);
    expect(get.json).toEqual(filters);

    // The JSONB landed on tenant A's connection specifically.
    const row = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connA],
    );
    expect(row.rows[0]!.sync_filters).toEqual(filters);
  });

  it("rejects an invalid filter shape (400) and leaves stored filters untouched", async () => {
    const bad = await injectSid({
      method: "PUT",
      url: "/api/sales/sfdc/sync-filters",
      sid: A_SID,
      body: { opportunities: { status: "lost" } },
    });
    expect(bad.status).toBe(400);

    // The previously persisted, valid filters are still intact.
    const get = await injectSid({ method: "GET", url: "/api/sales/sfdc/sync-filters", sid: A_SID });
    expect((get.json as SfdcSyncFilters).opportunities?.status).toBe("won");
  });

  it("scopes reads/writes to the caller's tenant — B never sees A's filters", async () => {
    // Tenant B reads its own (still-empty) filters, not tenant A's.
    const bGet = await injectSid({ method: "GET", url: "/api/sales/sfdc/sync-filters", sid: B_SID });
    expect(bGet.status).toBe(200);
    expect(bGet.json).toEqual({});

    // Tenant B writes its own distinct filters.
    const bFilters: SfdcSyncFilters = { leads: { statuses: ["Open"] } };
    const bPut = await injectSid({
      method: "PUT",
      url: "/api/sales/sfdc/sync-filters",
      sid: B_SID,
      body: bFilters,
    });
    expect(bPut.status).toBe(200);

    // Tenant A's connection is untouched by tenant B's write.
    const aRow = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connA],
    );
    expect(aRow.rows[0]!.sync_filters.leads).toBeUndefined();
    expect(aRow.rows[0]!.sync_filters.opportunities?.status).toBe("won");

    // Tenant B's connection carries only B's filters.
    const bRow = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connB],
    );
    expect(bRow.rows[0]!.sync_filters).toEqual(bFilters);
  });

  it("an empty payload clears all filters (sync everything)", async () => {
    const clear = await injectSid({
      method: "PUT",
      url: "/api/sales/sfdc/sync-filters",
      sid: A_SID,
      body: {},
    });
    expect(clear.status).toBe(200);
    expect(clear.json).toEqual({});

    const get = await injectSid({ method: "GET", url: "/api/sales/sfdc/sync-filters", sid: A_SID });
    expect(get.json).toEqual({});
  });

  it("ignores a forged X-Tenant-Id from a non-superadmin — reads/writes only its own connection", async () => {
    // Tenant A (an ordinary per-tenant admin, NOT a platform superadmin) forges
    // an X-Tenant-Id header pointing at tenant B and PUTs distinct filters.
    const forged: SfdcSyncFilters = {
      accounts: { types: ["Enterprise"], industries: ["ForgedHeaderTest"] },
    };
    const put = await injectSid({
      method: "PUT",
      url: "/api/sales/sfdc/sync-filters",
      sid: A_SID,
      xTenantId: String(tenantB),
      body: forged,
    });
    expect(put.status).toBe(200);
    expect(put.json).toEqual(forged);

    // The write landed on A's OWN connection, not the header-named tenant B.
    const aRow = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connA],
    );
    expect(aRow.rows[0]!.sync_filters).toEqual(forged);

    // Tenant B's connection is completely untouched — it still carries only
    // the filters B wrote earlier, never A's forged payload.
    const bRow = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connB],
    );
    expect(bRow.rows[0]!.sync_filters).toEqual({ leads: { statuses: ["Open"] } });

    // A GET with the same forged header also reads only A's own filters.
    const get = await injectSid({
      method: "GET",
      url: "/api/sales/sfdc/sync-filters",
      sid: A_SID,
      xTenantId: String(tenantB),
    });
    expect(get.status).toBe(200);
    expect(get.json).toEqual(forged);
  });

  it("honours X-Tenant-Id for a superadmin — targets the named tenant's connection", async () => {
    // A platform superadmin overrides to tenant B via X-Tenant-Id and writes.
    const superFilters: SfdcSyncFilters = { opportunities: { status: "open" } };
    const put = await injectSid({
      method: "PUT",
      url: "/api/sales/sfdc/sync-filters",
      sid: S_SID,
      xTenantId: String(tenantB),
      body: superFilters,
    });
    expect(put.status).toBe(200);
    expect(put.json).toEqual(superFilters);

    // The write landed on the header-named tenant B's connection.
    const bRow = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connB],
    );
    expect(bRow.rows[0]!.sync_filters).toEqual(superFilters);

    // The superadmin's own tenant (A) connection is left untouched.
    const aRow = await pool.query<{ sync_filters: SfdcSyncFilters }>(
      `SELECT sync_filters FROM sfdc_connections WHERE id = $1`,
      [connA],
    );
    expect(aRow.rows[0]!.sync_filters).toEqual({
      accounts: { types: ["Enterprise"], industries: ["ForgedHeaderTest"] },
    });

    // A GET with the override pointed at B reads B's filters back exactly.
    const getB = await injectSid({
      method: "GET",
      url: "/api/sales/sfdc/sync-filters",
      sid: S_SID,
      xTenantId: String(tenantB),
    });
    expect(getB.status).toBe(200);
    expect(getB.json).toEqual(superFilters);

    // And re-targeting to tenant A reads A's filters — the override selects the
    // connection precisely, exactly as on other superadmin-capable routes.
    const getA = await injectSid({
      method: "GET",
      url: "/api/sales/sfdc/sync-filters",
      sid: S_SID,
      xTenantId: String(tenantA),
    });
    expect(getA.status).toBe(200);
    expect(getA.json).toEqual({
      accounts: { types: ["Enterprise"], industries: ["ForgedHeaderTest"] },
    });
  });
});
