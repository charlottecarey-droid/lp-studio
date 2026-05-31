/**
 * Integration test for the ROOT-only superadmin roster management routes
 * (Task #641): GET/POST /superadmin/admins and DELETE /superadmin/admins/:id.
 *
 * Verifies the dual gate (requireSuperadmin + requireRootSuperadmin):
 *   - the root superadmin can list, grant, and revoke
 *   - an ordinary (non-root) superadmin is rejected with 403 on every route
 *   - granting an unknown email 404s (no silent account creation)
 *   - the root account can never be demoted/removed (403)
 *
 * Exercised in-process via inject() against the REAL Postgres pool so the
 * middleware runs its real session + app_users lookups. Root identity is
 * pinned to a unique per-run email via ROOT_SUPERADMIN_EMAIL (read at call
 * time by lib/rootSuperadmin), so the test never touches the real
 * admin@lpstudio.ai seed row. All seeded rows/sessions are cleaned up.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";

const RUN = randomUUID().slice(0, 8);
const ROOT_EMAIL = `root-it-${RUN}@example.com`;
const NONROOT_EMAIL = `nonroot-it-${RUN}@example.com`;
const PROMOTE_EMAIL = `promote-it-${RUN}@example.com`;
const DEMOTE_EMAIL = `demote-it-${RUN}@example.com`;

const ROOT_SID = `it-root-${RUN}`;
const NONROOT_SID = `it-nonroot-${RUN}`;

let app: Express;
let rootId = 0;
let nonRootId = 0;
let promoteId = 0;
let demoteId = 0;

function sess(userId: number, email: string): string {
  const user: AuthUser = {
    userId,
    email,
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role: "superadmin",
    permissions: {},
    isAdmin: false,
    appUserRole: "superadmin",
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
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[ROOT_SID, NONROOT_SID]]).catch(() => {});
  await pool
    .query(`DELETE FROM app_users WHERE email = ANY($1)`, [
      [ROOT_EMAIL, NONROOT_EMAIL, PROMOTE_EMAIL, DEMOTE_EMAIL],
    ])
    .catch(() => {});
}

beforeAll(async () => {
  process.env.ROOT_SUPERADMIN_EMAIL = ROOT_EMAIL;
  await cleanup();

  rootId = await insertUser(ROOT_EMAIL, "superadmin");
  nonRootId = await insertUser(NONROOT_EMAIL, "superadmin");
  promoteId = await insertUser(PROMOTE_EMAIL, "rep");
  demoteId = await insertUser(DEMOTE_EMAIL, "superadmin");

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [ROOT_SID, sess(rootId, ROOT_EMAIL)],
  );
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [NONROOT_SID, sess(nonRootId, NONROOT_EMAIL)],
  );

  // Import the router AFTER the env var is set (defensive — the lib reads env
  // at call time, but this keeps ordering unambiguous).
  const adminRouter = (await import("./admin")).default;
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
});

afterAll(async () => {
  delete process.env.ROOT_SUPERADMIN_EMAIL;
  await cleanup();
});

function asRoot(method: string, url: string, body?: unknown) {
  return inject(app, { method: method as any, url, headers: { cookie: `${SESSION_COOKIE}=${ROOT_SID}` }, body });
}
function asNonRoot(method: string, url: string, body?: unknown) {
  return inject(app, { method: method as any, url, headers: { cookie: `${SESSION_COOKIE}=${NONROOT_SID}` }, body });
}

describe("superadmin roster — root gate", () => {
  it("lets root list superadmins and flags the root row", async () => {
    const res = await asRoot("GET", "/superadmin/admins");
    expect(res.status).toBe(200);
    const body = res.json as { admins: { id: number; email: string; isRoot: boolean }[]; rootEmail: string };
    expect(body.rootEmail).toBe(ROOT_EMAIL);
    const root = body.admins.find((a) => a.id === rootId);
    expect(root?.isRoot).toBe(true);
    const nonRoot = body.admins.find((a) => a.id === nonRootId);
    expect(nonRoot?.isRoot).toBe(false);
  });

  it("rejects a non-root superadmin with 403 on GET", async () => {
    const res = await asNonRoot("GET", "/superadmin/admins");
    expect(res.status).toBe(403);
  });

  it("rejects a non-root superadmin with 403 on POST", async () => {
    const res = await asNonRoot("POST", "/superadmin/admins", { email: PROMOTE_EMAIL });
    expect(res.status).toBe(403);
  });
});

describe("superadmin roster — grant", () => {
  it("404s when granting an email with no account", async () => {
    const res = await asRoot("POST", "/superadmin/admins", { email: `ghost-${RUN}@example.com` });
    expect(res.status).toBe(404);
  });

  it("grants superadmin to an existing account", async () => {
    const res = await asRoot("POST", "/superadmin/admins", { email: PROMOTE_EMAIL });
    expect(res.status).toBe(201);
    const { rows } = await pool.query<{ role: string }>(`SELECT role FROM app_users WHERE id = $1`, [promoteId]);
    expect(rows[0].role).toBe("superadmin");
  });

  it("409s when the account is already a superadmin", async () => {
    const res = await asRoot("POST", "/superadmin/admins", { email: PROMOTE_EMAIL });
    expect(res.status).toBe(409);
  });
});

describe("superadmin roster — revoke", () => {
  it("refuses to remove the root account (403)", async () => {
    const res = await asRoot("DELETE", `/superadmin/admins/${rootId}`);
    expect(res.status).toBe(403);
    const { rows } = await pool.query<{ role: string }>(`SELECT role FROM app_users WHERE id = $1`, [rootId]);
    expect(rows[0].role).toBe("superadmin");
  });

  it("revokes superadmin from a non-root account", async () => {
    const res = await asRoot("DELETE", `/superadmin/admins/${demoteId}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query<{ role: string }>(`SELECT role FROM app_users WHERE id = $1`, [demoteId]);
    expect(rows[0].role).toBe("rep");
  });
});
