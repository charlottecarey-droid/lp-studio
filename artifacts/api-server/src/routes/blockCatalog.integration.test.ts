/**
 * Integration test for the superadmin block catalog override flow.
 *
 * Runs the REAL blockCatalog router against the REAL Postgres pool so the
 * `INSERT ... ON CONFLICT (block_type, industry)` upsert is exercised
 * end-to-end. Sessions are seeded directly into `app_sessions` (the auth
 * middleware reads the session row by cookie), so no network/OAuth is needed.
 *
 * Requests are injected into the express app IN-PROCESS (no TCP socket): the
 * vitest worker pool in this environment cannot bind a listening port, so we
 * drive the router's `(req, res)` handler directly with a fabricated
 * IncomingMessage / ServerResponse pair. This still exercises the full
 * middleware chain (cookie-parser, body parsing, requireAuth/requireSuperadmin)
 * and the route handlers against the real DB.
 *
 * Asserted contract (task: "saved defaults stick"):
 *   1. PUT /api/admin/block-catalog creates an override row keyed by
 *      (block_type, industry).
 *   2. A second PUT for the same (block_type, industry) UPSERTS the same row
 *      (no duplicate) and updates its values — this is what makes a saved
 *      default "stick".
 *   3. The (block_type, industry) pair is the unique key: the same block_type
 *      in a different industry is a separate row.
 *   4. GET /api/block-catalog for a tenant of that industry returns the
 *      override (the tenant inherits it), and does NOT leak a different
 *      industry's override.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import blockCatalogRouter from "./blockCatalog";

// Sentinel block_type so we never touch real registry/catalog rows. The
// superadmin upsert path is industry-agnostic, so a sentinel type fully
// exercises the (block_type, industry) key contract without clobbering data.
const SENTINEL_BLOCK = `__it_block_${Date.now()}`;
const SUPER_SID = `it-super-${randomUUID()}`;
const TENANT_SID = `it-tenant-${randomUUID()}`;
const TENANT_SLUG = `it-blockcat-${Date.now()}`;

let tenantId: number;
let app: Express;

/** Inject a request carrying the given session id as the auth cookie. */
function injectSid(opts: { method: string; url: string; sid?: string; body?: unknown }): Promise<InjectResponse> {
  const headers = opts.sid ? { cookie: `${SESSION_COOKIE}=${opts.sid}` } : undefined;
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

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM block_catalog WHERE block_type = $1`, [SENTINEL_BLOCK]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, TENANT_SID]]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT BlockCat Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // Superadmin: session already carries appUserRole='superadmin', so the
  // middleware never needs an app_users lookup.
  await seedSession(SUPER_SID, { userId: 999000001, tenantId: null, role: "superadmin", appUserRole: "superadmin" });
  // A normal tenant member of the generic tenant. isAdmin=true skips the
  // host-enforcement branch in requireAuth (127.0.0.1 maps to no tenant anyway).
  await seedSession(TENANT_SID, { userId: 999000002, tenantId, role: "admin", isAdmin: true, appUserRole: null });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", blockCatalogRouter);
});

afterAll(async () => {
  await cleanup();
});

function putRow(sid: string, body: Record<string, unknown>) {
  return injectSid({ method: "PUT", url: "/api/admin/block-catalog", sid, body });
}

async function rowCount(industry: string): Promise<number> {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM block_catalog WHERE block_type = $1 AND industry = $2`,
    [SENTINEL_BLOCK, industry],
  );
  return r.rows[0].n;
}

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("PUT /api/admin/block-catalog (saved defaults stick)", () => {
  it("creates an override row keyed by (block_type, industry)", async () => {
    const res = await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "First Label",
      category: "Content",
      default_props: { headline: "v1" },
    });
    expect(res.status).toBe(200);
    expect(await rowCount("generic")).toBe(1);
  });

  it("upserts the same (block_type, industry) — no duplicate, values updated", async () => {
    const res = await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "Second Label",
      category: "Hero",
      default_props: { headline: "v2" },
    });
    expect(res.status).toBe(200);
    expect(await rowCount("generic")).toBe(1);

    const r = await pool.query(
      `SELECT label, category, default_props FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`,
      [SENTINEL_BLOCK],
    );
    expect(r.rows[0].label).toBe("Second Label");
    expect(r.rows[0].category).toBe("Hero");
    expect(r.rows[0].default_props).toEqual({ headline: "v2" });
  });

  it("treats (block_type, industry) as the key — same block_type in another industry is a separate row", async () => {
    const res = await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "dental",
      label: "Dental Label",
      category: "Content",
      default_props: { headline: "dental" },
    });
    expect(res.status).toBe(200);
    expect(await rowCount("generic")).toBe(1);
    expect(await rowCount("dental")).toBe(1);
  });

  it("rejects non-superadmin callers", async () => {
    const res = await putRow(TENANT_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "x",
      category: "Content",
      default_props: {},
    });
    expect(res.status).toBe(403);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("PUT /api/admin/block-catalog (ai_enabled round-trip)", () => {
  it("persists ai_enabled=false and round-trips it on GET", async () => {
    const res = await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "AI Off Label",
      category: "Content",
      default_props: { headline: "v3" },
      ai_enabled: false,
    });
    expect(res.status).toBe(200);

    const r = await pool.query(
      `SELECT ai_enabled FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`,
      [SENTINEL_BLOCK],
    );
    expect(r.rows[0].ai_enabled).toBe(false);

    const get = await injectSid({ method: "GET", url: "/api/admin/block-catalog", sid: SUPER_SID });
    expect(get.status).toBe(200);
    const rows = get.json as Array<{ block_type: string; industry: string; ai_enabled: boolean }>;
    const mine = rows.find(r => r.block_type === SENTINEL_BLOCK && r.industry === "generic");
    expect(mine?.ai_enabled).toBe(false);
  });

  it("flips ai_enabled back to true on a subsequent PUT", async () => {
    const res = await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "AI On Label",
      category: "Content",
      default_props: { headline: "v4" },
      ai_enabled: true,
    });
    expect(res.status).toBe(200);

    const r = await pool.query(
      `SELECT ai_enabled FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`,
      [SENTINEL_BLOCK],
    );
    expect(r.rows[0].ai_enabled).toBe(true);
  });

  it("defaults ai_enabled to true when the field is omitted", async () => {
    // First force it false, then PUT without the field — COALESCE default is true.
    await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "Pre-omit",
      category: "Content",
      default_props: {},
      ai_enabled: false,
    });
    // Restore the canonical label so the downstream GET test (which asserts
    // the generic row still reads "Second Label") sees the expected state.
    const res = await putRow(SUPER_SID, {
      block_type: SENTINEL_BLOCK,
      industry: "generic",
      label: "Second Label",
      category: "Content",
      default_props: {},
    });
    expect(res.status).toBe(200);
    const r = await pool.query(
      `SELECT ai_enabled FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`,
      [SENTINEL_BLOCK],
    );
    expect(r.rows[0].ai_enabled).toBe(true);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("PUT /api/admin/block-catalog/batch (bulk upsert)", () => {
  const BATCH_BLOCK_A = `${SENTINEL_BLOCK}_batch_a`;
  const BATCH_BLOCK_B = `${SENTINEL_BLOCK}_batch_b`;

  afterAll(async () => {
    await pool
      .query(`DELETE FROM block_catalog WHERE block_type = ANY($1)`, [[BATCH_BLOCK_A, BATCH_BLOCK_B]])
      .catch(() => {});
  });

  it("upserts many rows in a single request and reports per-row success", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/admin/block-catalog/batch",
      sid: SUPER_SID,
      body: {
        rows: [
          { block_type: BATCH_BLOCK_A, industry: "generic", label: "Batch A", category: "Content", default_props: {} },
          { block_type: BATCH_BLOCK_A, industry: "dental", label: "Batch A Dental", category: "Content", default_props: {} },
          { block_type: BATCH_BLOCK_B, industry: "generic", label: "Batch B", category: "Hero", default_props: {} },
        ],
      },
    });
    expect(res.status).toBe(200);
    const body = res.json as { updated: number; failed: number; results: Array<{ ok: boolean; index: number }> };
    expect(body.updated).toBe(3);
    expect(body.failed).toBe(0);
    expect(body.results.map(r => r.index)).toEqual([0, 1, 2]);
    expect(body.results.every(r => r.ok)).toBe(true);

    const cnt = await pool.query(
      `SELECT count(*)::int AS n FROM block_catalog WHERE block_type = ANY($1)`,
      [[BATCH_BLOCK_A, BATCH_BLOCK_B]],
    );
    expect(cnt.rows[0].n).toBe(3);
  });

  it("reports partial failure per row (valid rows still persist)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/admin/block-catalog/batch",
      sid: SUPER_SID,
      body: {
        rows: [
          { block_type: BATCH_BLOCK_A, industry: "generic", label: "Batch A v2", category: "Updated", default_props: {} },
          { block_type: BATCH_BLOCK_B, industry: "not-a-real-industry", label: "Bad", category: "X", default_props: {} },
          { block_type: "", industry: "generic", label: "Missing type", category: "X", default_props: {} },
        ],
      },
    });
    expect(res.status).toBe(200);
    const body = res.json as {
      updated: number;
      failed: number;
      results: Array<{ ok: boolean; index: number; error?: string }>;
    };
    expect(body.updated).toBe(1);
    expect(body.failed).toBe(2);
    expect(body.results[0].ok).toBe(true);
    expect(body.results[1].ok).toBe(false);
    expect(body.results[1].error).toBe("Invalid industry");
    expect(body.results[2].ok).toBe(false);
    expect(body.results[2].error).toBe("block_type, industry, label, category required");

    // The valid row was updated despite the sibling failures.
    const r = await pool.query(
      `SELECT category FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`,
      [BATCH_BLOCK_A],
    );
    expect(r.rows[0].category).toBe("Updated");
  });

  it("returns an empty result for an empty rows array", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/admin/block-catalog/batch",
      sid: SUPER_SID,
      body: { rows: [] },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ updated: 0, failed: 0, results: [] });
  });

  it("rejects a malformed body (no rows array)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/admin/block-catalog/batch",
      sid: SUPER_SID,
      body: { notRows: true },
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-superadmin callers", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/admin/block-catalog/batch",
      sid: TENANT_SID,
      body: { rows: [{ block_type: BATCH_BLOCK_A, industry: "generic", label: "x", category: "Content", default_props: {} }] },
    });
    expect(res.status).toBe(403);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("GET /api/block-catalog (tenant inherits the override)", () => {
  it("returns the override for a tenant of that industry and does not leak another industry's row", async () => {
    const res = await injectSid({ method: "GET", url: "/api/block-catalog", sid: TENANT_SID });
    expect(res.status).toBe(200);
    const rows = res.json as Array<{ block_type: string; industry: string; label: string }>;

    const mine = rows.filter(r => r.block_type === SENTINEL_BLOCK);
    expect(mine).toHaveLength(1);
    expect(mine[0].industry).toBe("generic");
    expect(mine[0].label).toBe("Second Label");
    // The dental override must never appear for a generic tenant.
    expect(rows.some(r => r.block_type === SENTINEL_BLOCK && r.industry === "dental")).toBe(false);
  });
});
