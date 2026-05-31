/**
 * Integration test for the superadmin trial-phone gate admin routes
 * (Task #643): GET /superadmin/trial-phones and
 * DELETE /superadmin/trial-phones/:phoneHash.
 *
 * Verifies:
 *   - a superadmin can list gated phones (hashed) joined to their tenant
 *   - a superadmin can release (delete) a specific record so the number can
 *     trial again, and the row is actually gone afterwards
 *   - releasing an unknown hash 404s
 *   - a malformed (non-64-hex) hash is rejected 400 before touching the DB
 *   - a non-superadmin session is rejected 403 on every route
 *
 * Exercised in-process via inject() against the REAL Postgres pool so the
 * requireSuperadmin middleware runs its real session + app_users lookups.
 * All seeded rows/sessions are cleaned up.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID, createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";

const RUN = randomUUID().slice(0, 8);
const SUPER_EMAIL = `super-tp-${RUN}@example.com`;
const REP_EMAIL = `rep-tp-${RUN}@example.com`;

const SUPER_SID = `it-super-tp-${RUN}`;
const REP_SID = `it-rep-tp-${RUN}`;

// SHA-256 hex hashes of fake E.164 numbers — exactly what the gate stores.
const HASH_A = createHash("sha256").update(`+1555000${RUN}1`).digest("hex");
const HASH_B = createHash("sha256").update(`+1555000${RUN}2`).digest("hex");
const HASH_GHOST = createHash("sha256").update(`+1555000${RUN}9`).digest("hex");

let app: Express;
let superId = 0;
let repId = 0;
let tenantId = 0;

function sess(userId: number, email: string, role: "superadmin" | "rep"): string {
  const user: AuthUser = {
    userId,
    email,
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role,
    permissions: {},
    isAdmin: false,
    appUserRole: role,
  };
  return JSON.stringify(user);
}

async function insertUser(email: string, role: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO app_users (email, name, role, status, tenant_id)
     VALUES ($1, 'IT User', $2, 'active', NULL)
     RETURNING id`,
    [email, role],
  );
  return rows[0].id;
}

async function cleanup(): Promise<void> {
  await pool
    .query(`DELETE FROM trial_phone_numbers WHERE phone_hash = ANY($1)`, [[HASH_A, HASH_B, HASH_GHOST]])
    .catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, REP_SID]]).catch(() => {});
  await pool.query(`DELETE FROM app_users WHERE email = ANY($1)`, [[SUPER_EMAIL, REP_EMAIL]]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();

  superId = await insertUser(SUPER_EMAIL, "superadmin");
  repId = await insertUser(REP_EMAIL, "rep");

  const { rows: trows } = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`Trial Phone IT ${RUN}`, `trial-phone-it-${RUN}`],
  );
  tenantId = trows[0].id;

  await pool.query(
    `INSERT INTO trial_phone_numbers (phone_hash, tenant_id) VALUES ($1, $2), ($3, $2)`,
    [HASH_A, tenantId, HASH_B],
  );

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [SUPER_SID, sess(superId, SUPER_EMAIL, "superadmin")],
  );
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [REP_SID, sess(repId, REP_EMAIL, "rep")],
  );

  const adminRouter = (await import("./admin")).default;
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
});

afterAll(async () => {
  await cleanup();
});

function asSuper(method: string, url: string, body?: unknown) {
  return inject(app, { method: method as any, url, headers: { cookie: `${SESSION_COOKIE}=${SUPER_SID}` }, body });
}
function asRep(method: string, url: string, body?: unknown) {
  return inject(app, { method: method as any, url, headers: { cookie: `${SESSION_COOKIE}=${REP_SID}` }, body });
}

describe("trial-phones — list", () => {
  it("lets a superadmin list gated phones joined to their tenant", async () => {
    const res = await asSuper("GET", "/superadmin/trial-phones");
    expect(res.status).toBe(200);
    const rows = res.json as { phone_hash: string; tenant_id: number | null; tenant_slug: string | null }[];
    const a = rows.find((r) => r.phone_hash === HASH_A);
    expect(a).toBeTruthy();
    expect(a?.tenant_id).toBe(tenantId);
    expect(a?.tenant_slug).toBe(`trial-phone-it-${RUN}`);
    // Never leaks anything but the hash for the number itself.
    expect(rows.find((r) => r.phone_hash === HASH_B)).toBeTruthy();
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("GET", "/superadmin/trial-phones");
    expect(res.status).toBe(403);
  });
});

describe("trial-phones — release", () => {
  it("rejects a malformed hash with 400 (no DB hit)", async () => {
    const res = await asSuper("DELETE", "/superadmin/trial-phones/not-a-valid-hash");
    expect(res.status).toBe(400);
  });

  it("404s when releasing an unknown hash", async () => {
    const res = await asSuper("DELETE", `/superadmin/trial-phones/${HASH_GHOST}`);
    expect(res.status).toBe(404);
  });

  it("rejects a non-superadmin with 403", async () => {
    const res = await asRep("DELETE", `/superadmin/trial-phones/${HASH_A}`);
    expect(res.status).toBe(403);
    const { rows } = await pool.query(`SELECT 1 FROM trial_phone_numbers WHERE phone_hash = $1`, [HASH_A]);
    expect(rows.length).toBe(1);
  });

  it("releases a record so the number can trial again", async () => {
    const res = await asSuper("DELETE", `/superadmin/trial-phones/${HASH_A}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM trial_phone_numbers WHERE phone_hash = $1`, [HASH_A]);
    expect(rows.length).toBe(0);
  });
});
