/**
 * Integration tests for the dedicated Marketo two-way-sync routes
 * (routes/sales/marketo.ts).
 *
 * Covers, against the REAL Postgres pool, in-process via inject() (the vitest
 * worker pool never fires app.listen's callback — see test-utils/injectRequest):
 *   1. test-connection / connect credential flow (validation + happy path,
 *      no clientSecret ever leaks back to the client).
 *   2. connection status GET (404 before connect) + PATCH toggles
 *      (syncEnabled / importUnlinkedLeads).
 *   3. field-mapping CRUD with the SAFE_IDENTIFIER / ALLOWED_TABLES /
 *      direction validation guards.
 *   4. sync triggers (full + per-object), the invalid-object guard, the
 *      sync-log history feed, and discovery (fields + cached lists).
 *   5. tenant scoping — tenant B cannot read or mutate tenant A's connection
 *      or field mappings.
 *
 * MARKETO_FAKE_MODE=1 is set before the service module is loaded so every
 * Marketo network call short-circuits to a canned response (no live creds /
 * unresolvable *.mktorest.com host in the sandbox).
 */
process.env.MARKETO_FAKE_MODE = "1";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../middleware/requireAuth";

const { pool } = await import("@workspace/db");
const { SESSION_COOKIE, requireAuth } = await import("../../middleware/requireAuth");
const { inject } = await import("../../test-utils/injectRequest");
const salesRouter = (await import("./index")).default;

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

const VALID_CREDS = {
  munchkinId: "123-ABC-456",
  restEndpoint: "https://123-ABC-456.mktorest.com/rest",
  identityEndpoint: "https://123-ABC-456.mktorest.com/identity",
  clientId: "00000000-0000-0000-0000-000000000000",
  clientSecret: "super-secret-value",
};

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999820000 + Math.floor(Math.random() * 100000),
    email: "marketo-it@example.com",
    name: "IT Marketo Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-marketo-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-marketo-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Marketo Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

// tenantA + tenantB are connected in beforeAll so the mapping / sync / scoping
// describes have a live connection regardless of test ordering. tenantNone is
// left unconnected to exercise the empty-state / connect happy path.
let tenantA = { tenantId: 0, sid: "" };
let tenantB = { tenantId: 0, sid: "" };
let tenantNone = { tenantId: 0, sid: "" };
let connectionIdA = 0;
let connectionIdB = 0;

beforeAll(async () => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);

  tenantA = await seedTenant();
  tenantB = await seedTenant();
  tenantNone = await seedTenant();

  const ra = await authed(tenantA.sid, "POST", "/sales/marketo/connect", VALID_CREDS);
  expect(ra.status).toBe(200);
  connectionIdA = (ra.json as { connectionId: number }).connectionId;

  const rb = await authed(tenantB.sid, "POST", "/sales/marketo/connect", VALID_CREDS);
  expect(rb.status).toBe(200);
  connectionIdB = (rb.json as { connectionId: number }).connectionId;
}, 60_000);

afterAll(async () => {
  if (createdTenantIds.length) {
    // marketo_* + sales_* rows carry tenant_id FKs; the marketo tables CASCADE
    // on tenant delete, but sales_* are NO ACTION so clear them first.
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = ANY($1)`, [createdTenantIds]);
  }
  if (createdSids.length) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [createdSids]);
  }
  if (createdTenantIds.length) {
    await pool.query(`DELETE FROM tenants WHERE id = ANY($1)`, [createdTenantIds]);
  }
  await pool.end().catch(() => undefined);
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Marketo credentials: test-connection & connect (tenantNone)", () => {
  it("GET /connection 404s before any connection exists", async () => {
    const res = await authed(tenantNone.sid, "GET", "/sales/marketo/connection");
    expect(res.status).toBe(404);
  });

  it("GET /field-mappings 404s with no connection", async () => {
    const res = await authed(tenantNone.sid, "GET", "/sales/marketo/field-mappings");
    expect(res.status).toBe(404);
  });

  it("POST /sync 404s with no active connection", async () => {
    const res = await authed(tenantNone.sid, "POST", "/sales/marketo/sync");
    expect(res.status).toBe(404);
  });

  it("POST /test-connection 400s when fields are missing", async () => {
    const res = await authed(tenantNone.sid, "POST", "/sales/marketo/test-connection", {
      clientId: "x",
    });
    expect(res.status).toBe(400);
  });

  it("POST /test-connection returns ok:true for valid creds (fake mode)", async () => {
    const res = await authed(tenantNone.sid, "POST", "/sales/marketo/test-connection", {
      identityEndpoint: VALID_CREDS.identityEndpoint,
      clientId: VALID_CREDS.clientId,
      clientSecret: VALID_CREDS.clientSecret,
    });
    expect(res.status).toBe(200);
    expect((res.json as { ok: boolean }).ok).toBe(true);
  });

  it("POST /connect 400s when required fields are missing", async () => {
    const res = await authed(tenantNone.sid, "POST", "/sales/marketo/connect", {
      munchkinId: "123-ABC-456",
    });
    expect(res.status).toBe(400);
  });

  it("POST /connect persists the connection and never echoes the clientSecret", async () => {
    const res = await authed(tenantNone.sid, "POST", "/sales/marketo/connect", VALID_CREDS);
    expect(res.status).toBe(200);
    const body = res.json as { success: boolean; connectionId: number; munchkinId: string };
    expect(body.success).toBe(true);
    expect(body.munchkinId).toBe(VALID_CREDS.munchkinId);
    expect(res.text).not.toContain(VALID_CREDS.clientSecret);

    const conn = await authed(tenantNone.sid, "GET", "/sales/marketo/connection");
    expect(conn.status).toBe(200);
    const c = conn.json as {
      status: string;
      syncEnabled: boolean;
      importUnlinkedLeads: boolean;
      munchkinId: string;
      clientId: string;
    };
    expect(c.status).toBe("connected");
    expect(c.syncEnabled).toBe(true);
    expect(c.importUnlinkedLeads).toBe(false);
    expect(c.munchkinId).toBe(VALID_CREDS.munchkinId);
    // The status payload exposes the clientId (not a secret) but must never
    // include the clientSecret or the access token.
    expect(conn.text).not.toContain(VALID_CREDS.clientSecret);
    expect(conn.text).not.toContain("clientSecret");
    expect(conn.text).not.toContain("accessToken");
  });

  it("PATCH /connection toggles importUnlinkedLeads", async () => {
    const res = await authed(tenantNone.sid, "PATCH", "/sales/marketo/connection", {
      importUnlinkedLeads: true,
    });
    expect(res.status).toBe(200);
    expect((res.json as { importUnlinkedLeads: boolean }).importUnlinkedLeads).toBe(true);
  });

  it("PATCH /connection 400s with no recognized fields", async () => {
    const res = await authed(tenantNone.sid, "PATCH", "/sales/marketo/connection", {
      bogus: 1,
    });
    expect(res.status).toBe(400);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Marketo field-mapping CRUD (tenantA)", () => {
  let mappingId = 0;

  it("POST creates a mapping with valid fields", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/field-mappings", {
      marketoField: "leadScore",
      localTable: "sales_contacts",
      localField: "metadata.leadScore",
      direction: "inbound",
      transformFn: "toNumber",
    });
    expect(res.status).toBe(201);
    const m = res.json as { id: number; direction: string; transformFn: string | null };
    expect(m.id).toBeGreaterThan(0);
    expect(m.direction).toBe("inbound");
    expect(m.transformFn).toBe("toNumber");
    mappingId = m.id;
  });

  it("POST 400s on a disallowed localTable", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/field-mappings", {
      marketoField: "email",
      localTable: "app_users",
      localField: "email",
    });
    expect(res.status).toBe(400);
  });

  it("POST 400s on an unsafe marketoField identifier", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/field-mappings", {
      marketoField: "drop table;--",
      localTable: "sales_contacts",
      localField: "email",
    });
    expect(res.status).toBe(400);
  });

  it("POST 400s when required fields are missing", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/field-mappings", {
      marketoField: "email",
    });
    expect(res.status).toBe(400);
  });

  it("GET lists the created mapping", async () => {
    const res = await authed(tenantA.sid, "GET", "/sales/marketo/field-mappings");
    expect(res.status).toBe(200);
    const list = res.json as Array<{ id: number }>;
    expect(list.some((m) => m.id === mappingId)).toBe(true);
  });

  it("PUT updates isActive and an unknown direction falls back to 'both'", async () => {
    const res = await authed(tenantA.sid, "PUT", `/sales/marketo/field-mappings/${mappingId}`, {
      isActive: false,
      direction: "sideways",
    });
    expect(res.status).toBe(200);
    const m = res.json as { isActive: boolean; direction: string };
    expect(m.isActive).toBe(false);
    expect(m.direction).toBe("both");
  });

  it("PUT 400s on a non-integer id", async () => {
    const res = await authed(tenantA.sid, "PUT", "/sales/marketo/field-mappings/abc", {
      isActive: true,
    });
    expect(res.status).toBe(400);
  });

  it("DELETE removes the mapping and a repeat delete 404s", async () => {
    const first = await authed(tenantA.sid, "DELETE", `/sales/marketo/field-mappings/${mappingId}`);
    expect(first.status).toBe(200);
    const again = await authed(tenantA.sid, "DELETE", `/sales/marketo/field-mappings/${mappingId}`);
    expect(again.status).toBe(404);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Marketo sync & discovery (tenantA)", () => {
  it("POST /sync starts a background full sync", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/sync");
    expect(res.status).toBe(200);
    expect((res.json as { success: boolean }).success).toBe(true);
  });

  it("POST /sync/leads runs the lead import synchronously", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/sync/leads");
    expect(res.status).toBe(200);
    const body = res.json as { success: boolean; object: string; result: { ok: boolean } };
    expect(body.success).toBe(true);
    expect(body.object).toBe("leads");
    expect(body.result.ok).toBe(true);
  });

  it("POST /sync/lists refreshes the discovery cache", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/sync/lists");
    expect(res.status).toBe(200);
    expect((res.json as { success: boolean }).success).toBe(true);
  });

  it("POST /sync/:object 400s on an unknown object type", async () => {
    const res = await authed(tenantA.sid, "POST", "/sales/marketo/sync/widgets");
    expect(res.status).toBe(400);
  });

  it("GET /sync/log returns the tenant's sync history", async () => {
    const res = await authed(tenantA.sid, "GET", "/sales/marketo/sync/log");
    expect(res.status).toBe(200);
    const logs = res.json as Array<{ objectType: string; tenantId: number }>;
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.objectType === "leads")).toBe(true);
  });

  it("GET /discover/fields returns the lead attribute schema", async () => {
    const res = await authed(tenantA.sid, "GET", "/sales/marketo/discover/fields");
    expect(res.status).toBe(200);
    const fields = res.json as Array<{ name: string }>;
    expect(fields.some((f) => f.name === "email")).toBe(true);
  });

  it("GET /discover/lists returns the cached lists after a refresh", async () => {
    await authed(tenantA.sid, "POST", "/sales/marketo/discover/refresh");
    const res = await authed(tenantA.sid, "GET", "/sales/marketo/discover/lists");
    expect(res.status).toBe(200);
    const lists = res.json as Array<{ marketoId: string }>;
    expect(lists.some((l) => l.marketoId === "1001")).toBe(true);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Marketo tenant scoping (tenantA vs tenantB)", () => {
  it("tenant B's connection status is its own row, not tenant A's", async () => {
    const res = await authed(tenantB.sid, "GET", "/sales/marketo/connection");
    expect(res.status).toBe(200);
    const c = res.json as { id: number };
    expect(c.id).toBe(connectionIdB);
    expect(c.id).not.toBe(connectionIdA);
  });

  it("tenant B cannot update or delete tenant A's field mapping", async () => {
    // Create a mapping under tenant A.
    const created = await authed(tenantA.sid, "POST", "/sales/marketo/field-mappings", {
      marketoField: "firstName",
      localTable: "sales_contacts",
      localField: "first_name",
      direction: "both",
    });
    expect(created.status).toBe(201);
    const aMappingId = (created.json as { id: number }).id;

    // Tenant B (which has its own connection) must not be able to touch it.
    const put = await authed(tenantB.sid, "PUT", `/sales/marketo/field-mappings/${aMappingId}`, {
      isActive: false,
    });
    expect(put.status).toBe(404);

    const del = await authed(tenantB.sid, "DELETE", `/sales/marketo/field-mappings/${aMappingId}`);
    expect(del.status).toBe(404);

    // And it still exists for tenant A.
    const list = await authed(tenantA.sid, "GET", "/sales/marketo/field-mappings");
    expect((list.json as Array<{ id: number }>).some((m) => m.id === aMappingId)).toBe(true);
  });
});
