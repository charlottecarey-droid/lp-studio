/**
 * Cross-tenant isolation guard for the master "All Leads" list and the
 * bulk-delete endpoints (task #803).
 *
 * `GET /lp/leads/all`, `DELETE /lp/leads`, and `DELETE /lp/leads/test` are all
 * strictly tenant-scoped — every query combines the caller's tenantId with the
 * row filter, so one workspace must never be able to read or destroy another
 * workspace's leads. There was no automated proof of that invariant; an
 * accidental regression (dropping the tenant filter, trusting a client-supplied
 * id list) would silently leak or delete another customer's leads. This test is
 * the regression guard.
 *
 * It exercises the REAL route handlers via the in-process `inject()` helper
 * (`app.listen` hangs in the vitest worker pool) against a HERMETIC, throwaway
 * Postgres. The schema is built straight from the drizzle schema definitions via
 * `drizzle-kit push`. This must NOT run against prod Neon: dev's
 * `NEON_DATABASE_URL` points at the production DB, so we stand up our own
 * ephemeral cluster and repoint the env at it BEFORE the first import of
 * `@workspace/db`.
 *
 * Asserted:
 *   - GET /lp/leads/all returns ONLY the current tenant's leads
 *     (with the default test-exclusion, includeTest=1, and search variants).
 *   - DELETE /lp/leads with another tenant's lead ids deletes 0 rows and leaves
 *     them intact.
 *   - DELETE /lp/leads/test only removes the current tenant's test leads.
 *   - All three endpoints fail closed (403) on a session with no tenant.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// these modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest
// of the file stays type-checked.
type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

// One session per tenant + one tenantless session (fail-closed check).
const SID_A = `it-leads-a-${randomUUID()}`;
const SID_B = `it-leads-b-${randomUUID()}`;
const SID_NO_TENANT = `it-leads-none-${randomUUID()}`;

let tenantAId: number;
let tenantBId: number;

interface SeededLeads {
  realId: number;
  testId: number;
}
let leadsA: SeededLeads;
let leadsB: SeededLeads;

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

function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    body: opts.body,
  });
}

/** Insert (or refresh) a session row with the given tenantId (null allowed). */
async function seedSession(sid: string, tenantId: number | null, userId: number): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId,
    email: `it-${userId}@example.test`,
    name: "IT",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

async function seedTenant(label: string): Promise<number> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT Leads ${uniq}`, `it-leads-${uniq}`],
  );
  return t.rows[0].id;
}

async function seedPage(tenantId: number, label: string): Promise<number> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status)
     VALUES ($1, $2, $3, 'published') RETURNING id`,
    [tenantId, `Page ${uniq}`, `page-${uniq}`],
  );
  return p.rows[0].id;
}

async function seedLead(tenantId: number, pageId: number, fields: Record<string, unknown>): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_leads (tenant_id, page_id, fields)
     VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [tenantId, pageId, JSON.stringify(fields)],
  );
  return r.rows[0].id;
}

/** Seed one real lead + one test lead for a tenant; returns their ids. */
async function seedTenantLeads(tenantId: number, label: string, realFields: Record<string, unknown>): Promise<SeededLeads> {
  const pageId = await seedPage(tenantId, label);
  const realId = await seedLead(tenantId, pageId, realFields);
  // `test@example.com` trips isTestLead (example.com + local part "test").
  const testId = await seedLead(tenantId, pageId, { firstName: "QA", lastName: "Bot", email: "test@example.com" });
  return { realId, testId };
}

beforeAll(async () => {
  // 1. Stand up the throwaway cluster and repoint the db env BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  // 2. Build the real schema straight from the drizzle definitions.
  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }

  // 3. Safe to load the db layer + the real route handlers now.
  pgMod = await import("@workspace/db");
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const leadsRouter = (await import("./leads")).default;

  // 4. Mount the genuine router with the real auth/cookie/body middleware.
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(leadsRouter);

  // 5. Seed two isolated tenants, each with a real + a test lead, plus the
  //    sessions used to act as each (and a tenantless one).
  tenantAId = await seedTenant("a");
  tenantBId = await seedTenant("b");
  await seedSession(SID_A, tenantAId, 990000101);
  await seedSession(SID_B, tenantBId, 990000102);
  await seedSession(SID_NO_TENANT, null, 990000103);

  leadsA = await seedTenantLeads(tenantAId, "a", {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@hospital.org",
  });
  leadsB = await seedTenantLeads(tenantBId, "b", {
    firstName: "Bob",
    lastName: "Jones",
    email: "bob.jones@clinic.com",
  });
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface AllLeadsResponse {
  leads: { id: number }[];
  total: number;
}

describe("lp/leads cross-tenant isolation (regression for #803)", () => {
  it("GET /lp/leads/all returns only the caller's tenant's leads (default excludes test)", async () => {
    const res = await injectAs(SID_A, { method: "GET", url: "/lp/leads/all" });
    expect(res.status).toBe(200);
    const body = res.json as AllLeadsResponse;
    const ids = body.leads.map((l) => l.id);
    // Only tenant A's real lead (test lead excluded by default).
    expect(ids).toContain(leadsA.realId);
    expect(ids).not.toContain(leadsA.testId);
    // Never any of tenant B's leads.
    expect(ids).not.toContain(leadsB.realId);
    expect(ids).not.toContain(leadsB.testId);
    expect(body.total).toBe(1);
  });

  it("GET /lp/leads/all?includeTest=1 includes the caller's test lead but still no other tenant's", async () => {
    const res = await injectAs(SID_A, { method: "GET", url: "/lp/leads/all?includeTest=1" });
    expect(res.status).toBe(200);
    const ids = (res.json as AllLeadsResponse).leads.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining([leadsA.realId, leadsA.testId]));
    expect(ids).not.toContain(leadsB.realId);
    expect(ids).not.toContain(leadsB.testId);
  });

  it("GET /lp/leads/all?search=… never matches another tenant's lead", async () => {
    // Searching tenant A for B's lead name returns nothing — the tenant filter
    // is applied before the search, so cross-tenant rows are never candidates.
    const miss = await injectAs(SID_A, { method: "GET", url: "/lp/leads/all?search=bob" });
    expect(miss.status).toBe(200);
    expect((miss.json as AllLeadsResponse).leads).toHaveLength(0);

    // A's own lead is still findable by its name within its own tenant.
    const hit = await injectAs(SID_A, { method: "GET", url: "/lp/leads/all?search=jane" });
    expect(hit.status).toBe(200);
    const hitIds = (hit.json as AllLeadsResponse).leads.map((l) => l.id);
    expect(hitIds).toEqual([leadsA.realId]);

    // And tenant B can find B's lead but never A's.
    const bHit = await injectAs(SID_B, { method: "GET", url: "/lp/leads/all?search=bob" });
    expect(bHit.status).toBe(200);
    const bIds = (bHit.json as AllLeadsResponse).leads.map((l) => l.id);
    expect(bIds).toContain(leadsB.realId);
    expect(bIds).not.toContain(leadsA.realId);
  });

  it("DELETE /lp/leads with another tenant's ids deletes 0 rows and leaves them intact", async () => {
    const { pool } = pgMod;
    // Tenant A attempts to bulk-delete BOTH of tenant B's leads.
    const res = await injectAs(SID_A, {
      method: "DELETE",
      url: "/lp/leads",
      body: { ids: [leadsB.realId, leadsB.testId] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { deleted: number }).deleted).toBe(0);

    // B's leads are untouched.
    const survivors = await pool.query<{ id: number }>(
      `SELECT id FROM lp_leads WHERE id = ANY($1::int[])`,
      [[leadsB.realId, leadsB.testId]],
    );
    expect(survivors.rows.map((r) => r.id).sort()).toEqual([leadsB.realId, leadsB.testId].sort());
  });

  it("DELETE /lp/leads only removes the caller's own matching ids when ids are mixed across tenants", async () => {
    const { pool } = pgMod;
    // Seed a throwaway real lead for tenant A and try to delete it together with
    // one of tenant B's leads in the same request. Only A's row may be deleted.
    const pageA = await seedPage(tenantAId, "mixed");
    const aDeletable = await seedLead(tenantAId, pageA, {
      firstName: "Mixed",
      lastName: "Case",
      email: "mixed.case@hospital.org",
    });

    const res = await injectAs(SID_A, {
      method: "DELETE",
      url: "/lp/leads",
      body: { ids: [aDeletable, leadsB.realId] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { deleted: number }).deleted).toBe(1);

    // A's row is gone; B's row survives.
    const aGone = await pool.query(`SELECT id FROM lp_leads WHERE id = $1`, [aDeletable]);
    expect(aGone.rows).toHaveLength(0);
    const bAlive = await pool.query(`SELECT id FROM lp_leads WHERE id = $1`, [leadsB.realId]);
    expect(bAlive.rows).toHaveLength(1);
  });

  it("DELETE /lp/leads/test only removes the caller's test leads, never another tenant's", async () => {
    const { pool } = pgMod;
    // Tenant B purges its test leads.
    const res = await injectAs(SID_B, { method: "DELETE", url: "/lp/leads/test" });
    expect(res.status).toBe(200);
    expect((res.json as { deleted: number }).deleted).toBe(1);

    // B's test lead is gone; B's real lead survives.
    const bTest = await pool.query(`SELECT id FROM lp_leads WHERE id = $1`, [leadsB.testId]);
    expect(bTest.rows).toHaveLength(0);
    const bReal = await pool.query(`SELECT id FROM lp_leads WHERE id = $1`, [leadsB.realId]);
    expect(bReal.rows).toHaveLength(1);

    // Tenant A's test lead is completely unaffected by B's purge.
    const aTest = await pool.query(`SELECT id FROM lp_leads WHERE id = $1`, [leadsA.testId]);
    expect(aTest.rows).toHaveLength(1);
  });

  it("fails closed (403) on a session with no tenant", async () => {
    const all = await injectAs(SID_NO_TENANT, { method: "GET", url: "/lp/leads/all" });
    expect(all.status).toBe(403);

    const bulk = await injectAs(SID_NO_TENANT, {
      method: "DELETE",
      url: "/lp/leads",
      body: { ids: [leadsA.realId] },
    });
    expect(bulk.status).toBe(403);

    const test = await injectAs(SID_NO_TENANT, { method: "DELETE", url: "/lp/leads/test" });
    expect(test.status).toBe(403);

    // The tenantless caller deleted nothing.
    const { pool } = pgMod;
    const aReal = await pool.query(`SELECT id FROM lp_leads WHERE id = $1`, [leadsA.realId]);
    expect(aReal.rows).toHaveLength(1);
  });
});
