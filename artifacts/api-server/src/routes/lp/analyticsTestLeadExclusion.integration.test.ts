/**
 * Regression guard: suspected test/junk leads must stay out of EVERY analytics
 * number by default, and must be reconcilable across endpoints (task #826).
 *
 * Test/junk leads (e.g. `test@example.com`, "Test User", keyboard-mash names)
 * are hidden from the Submissions tab, the dashboard overview, the Analytics
 * page lead counts, and A/B test results — all via the shared `isTestLead`
 * heuristic applied IN MEMORY (the rule isn't expressible in SQL). The danger
 * is a future lead-counting endpoint that reaches for a plain SQL `count(*)`
 * instead of the in-memory filter, silently re-inflating the numbers. Until now
 * that consistency was only checked by hand. This is the automated proof.
 *
 * It exercises the REAL route handlers via the in-process `inject()` helper
 * (`app.listen` hangs in the vitest worker pool) against a HERMETIC, throwaway
 * Postgres built straight from the drizzle schema via `drizzle-kit push`. This
 * must NOT run against prod Neon: dev's `NEON_DATABASE_URL` points at the
 * production DB, so we stand up our own ephemeral cluster and repoint the env at
 * it BEFORE the first import of `@workspace/db`.
 *
 * Asserted (default excludes junk; `?includeTest=1` includes it):
 *   - GET /lp/analytics/overview  totalLeads
 *   - GET /lp/analytics/traffic   summed daily leads
 *   - GET /lp/analytics/pages     per-page + total leads
 *   - GET /lp/tests/:id/results   totalLeads + per-variant leads
 *   - all reconcile with GET /lp/leads/summary and GET /lp/leads/all
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
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

const SID = `it-analytics-${randomUUID()}`;

let tenantId: number;
let page1Id: number;
let page2Id: number;
let testId: number;
let controlVariantId: number;
let variantBId: number;

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

function get(url: string): Promise<InjectResponse> {
  return inject(app, { method: "GET", url, headers: { cookie: `${SESSION_COOKIE}=${SID}` } });
}

async function seedSession(sid: string, tid: number | null, userId: number): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId,
    email: `it-${userId}@example.test`,
    name: "IT",
    avatarUrl: null,
    tenantId: tid,
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
    [`IT Analytics ${uniq}`, `it-analytics-${uniq}`],
  );
  return t.rows[0].id;
}

async function seedPage(tid: number, label: string): Promise<number> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status)
     VALUES ($1, $2, $3, 'published') RETURNING id`,
    [tid, `Page ${uniq}`, `page-${uniq}`],
  );
  return p.rows[0].id;
}

async function seedTest(tid: number, label: string): Promise<number> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO lp_tests (tenant_id, name, slug, status)
     VALUES ($1, $2, $3, 'running') RETURNING id`,
    [tid, `Test ${uniq}`, `test-${uniq}`],
  );
  return t.rows[0].id;
}

async function seedVariant(tid: number, builderPageId: number, name: string, isControl: boolean): Promise<number> {
  const { pool } = pgMod;
  const v = await pool.query<{ id: number }>(
    `INSERT INTO lp_variants (test_id, name, is_control, builder_page_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tid, name, isControl, builderPageId],
  );
  return v.rows[0].id;
}

async function seedLead(
  tid: number,
  pageId: number,
  variantId: number | null,
  fields: Record<string, unknown>,
): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_leads (tenant_id, page_id, variant_id, fields)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [tid, pageId, variantId, JSON.stringify(fields)],
  );
  return r.rows[0].id;
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
  const analyticsRouter = (await import("./analytics")).default;
  const resultsRouter = (await import("./results")).default;
  const leadsRouter = (await import("./leads")).default;

  // 4. Mount the genuine routers with the real auth/cookie/body middleware.
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(analyticsRouter);
  app.use(resultsRouter);
  app.use(leadsRouter);

  // 5. Seed one tenant with two pages and an A/B test (control + variant B,
  //    both pointed at page 1). One admin session acts as the tenant.
  tenantId = await seedTenant("t");
  await seedSession(SID, tenantId, 990000826);
  page1Id = await seedPage(tenantId, "p1");
  page2Id = await seedPage(tenantId, "p2");
  testId = await seedTest(tenantId, "ab");
  controlVariantId = await seedVariant(testId, page1Id, "Control", true);
  variantBId = await seedVariant(testId, page1Id, "Variant B", false);

  // 6. Seed a deliberate mix of REAL and JUNK leads:
  //    - page 1 / control:   1 real, 1 junk (test@example.com)
  //    - page 1 / variant B:  1 real, 1 junk ("Test User" name)
  //    - page 2 / no variant: 1 real, 1 junk (keyboard-mash "asdfgh")
  //  => 3 real, 3 junk overall; per page: P1 = 2 real / 4 total, P2 = 1 / 2.
  await seedLead(tenantId, page1Id, controlVariantId, {
    firstName: "Jane", lastName: "Smith", email: "jane.smith@hospital.org",
  });
  await seedLead(tenantId, page1Id, variantBId, {
    name: "Robert Brown", email: "robert@clinic.com",
  });
  await seedLead(tenantId, page2Id, null, {
    firstName: "Alice", lastName: "Wong", email: "alice.wong@dental.com",
  });
  // Junk: example.com + "test" local part.
  await seedLead(tenantId, page1Id, controlVariantId, {
    name: "QA Bot", email: "test@example.com",
  });
  // Junk: filler name "Test User".
  await seedLead(tenantId, page1Id, variantBId, {
    name: "Test User", email: "tester@somecorp.io",
  });
  // Junk: keyboard-mash gibberish name.
  await seedLead(tenantId, page2Id, null, {
    name: "asdfgh", email: "qwertyzz@somewhere.io",
  });
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface OverviewBody { totalLeads: number }
interface TrafficRow { leads: number }
interface PageRow { pageId: number; leads: number }
interface VariantResult { variantId: number; leads: number }
interface ResultsBody { totalLeads: number; variants: VariantResult[] }
interface SummaryRow { id: number; leadCount: number }
interface AllLeadsBody { total: number }

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("analytics endpoints exclude test/junk leads by default (regression for #826)", () => {
  it("GET /lp/analytics/overview totalLeads excludes junk by default, includes with ?includeTest=1", async () => {
    const def = await get("/lp/analytics/overview");
    expect(def.status).toBe(200);
    expect((def.json as OverviewBody).totalLeads).toBe(3);

    const inc = await get("/lp/analytics/overview?includeTest=1");
    expect(inc.status).toBe(200);
    expect((inc.json as OverviewBody).totalLeads).toBe(6);
  });

  it("GET /lp/analytics/traffic summed daily leads excludes junk by default, includes with ?includeTest=1", async () => {
    const sumLeads = (rows: TrafficRow[]) => rows.reduce((s, r) => s + r.leads, 0);

    const def = await get("/lp/analytics/traffic");
    expect(def.status).toBe(200);
    expect(sumLeads(def.json as TrafficRow[])).toBe(3);

    const inc = await get("/lp/analytics/traffic?includeTest=1");
    expect(inc.status).toBe(200);
    expect(sumLeads(inc.json as TrafficRow[])).toBe(6);
  });

  it("GET /lp/analytics/pages per-page + total leads exclude junk by default, include with ?includeTest=1", async () => {
    const def = await get("/lp/analytics/pages");
    expect(def.status).toBe(200);
    const defRows = def.json as PageRow[];
    const defByPage = new Map(defRows.map((r) => [r.pageId, r.leads]));
    expect(defByPage.get(page1Id)).toBe(2);
    expect(defByPage.get(page2Id)).toBe(1);
    expect(defRows.reduce((s, r) => s + r.leads, 0)).toBe(3);

    const inc = await get("/lp/analytics/pages?includeTest=1");
    expect(inc.status).toBe(200);
    const incRows = inc.json as PageRow[];
    const incByPage = new Map(incRows.map((r) => [r.pageId, r.leads]));
    expect(incByPage.get(page1Id)).toBe(4);
    expect(incByPage.get(page2Id)).toBe(2);
    expect(incRows.reduce((s, r) => s + r.leads, 0)).toBe(6);
  });

  it("GET /lp/tests/:id/results totalLeads + per-variant leads exclude junk by default, include with ?includeTest=1", async () => {
    const def = await get(`/lp/tests/${testId}/results`);
    expect(def.status).toBe(200);
    const defBody = def.json as ResultsBody;
    expect(defBody.totalLeads).toBe(2);
    const defByVariant = new Map(defBody.variants.map((v) => [v.variantId, v.leads]));
    expect(defByVariant.get(controlVariantId)).toBe(1);
    expect(defByVariant.get(variantBId)).toBe(1);

    const inc = await get(`/lp/tests/${testId}/results?includeTest=1`);
    expect(inc.status).toBe(200);
    const incBody = inc.json as ResultsBody;
    expect(incBody.totalLeads).toBe(4);
    const incByVariant = new Map(incBody.variants.map((v) => [v.variantId, v.leads]));
    expect(incByVariant.get(controlVariantId)).toBe(2);
    expect(incByVariant.get(variantBId)).toBe(2);
  });

  it("totals reconcile with /lp/leads/summary (per-page) and /lp/leads/all (tenant total)", async () => {
    // Per-page summary, default (junk excluded).
    const sumDef = await get("/lp/leads/summary");
    expect(sumDef.status).toBe(200);
    const sumDefByPage = new Map((sumDef.json as SummaryRow[]).map((r) => [r.id, r.leadCount]));
    expect(sumDefByPage.get(page1Id)).toBe(2);
    expect(sumDefByPage.get(page2Id)).toBe(1);

    // Per-page summary, includeTest.
    const sumInc = await get("/lp/leads/summary?includeTest=1");
    expect(sumInc.status).toBe(200);
    const sumIncByPage = new Map((sumInc.json as SummaryRow[]).map((r) => [r.id, r.leadCount]));
    expect(sumIncByPage.get(page1Id)).toBe(4);
    expect(sumIncByPage.get(page2Id)).toBe(2);

    // Tenant-wide master list totals must match the overview totals exactly.
    const allDef = await get("/lp/leads/all");
    expect(allDef.status).toBe(200);
    expect((allDef.json as AllLeadsBody).total).toBe(3);

    const allInc = await get("/lp/leads/all?includeTest=1");
    expect(allInc.status).toBe(200);
    expect((allInc.json as AllLeadsBody).total).toBe(6);
  });
});
