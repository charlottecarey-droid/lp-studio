/**
 * Integration test for the superadmin image-library share endpoint
 * (Task #665): POST /superadmin/tenants/:id/share-library.
 *
 * The media API's resolveLibraryTenantScope only grants cross-tenant library
 * access when BOTH tenant rows point at each other via
 * `tenants.shares_library_with_tenant_id`, so this endpoint must always write
 * (or clear) the link reciprocally and never leave a dangling one-sided link.
 * This test covers that non-trivial transactional logic:
 *   - linking A→B sets the link on BOTH rows
 *   - unlinking (siblingTenantId:null) clears BOTH rows
 *   - re-linking a tenant whose chosen sibling already points elsewhere clears
 *     the stale partner so no dangling one-sided link survives
 *   - self-linking is rejected (400)
 *   - an invalid id is rejected (400) and a missing target/sibling 404s
 *
 * Exercised in-process (no TCP socket) via inject() against the REAL Postgres
 * pool so requireSuperadmin runs its real session lookup. Superadmin identity
 * is a fabricated session whose cached appUserRole is already "superadmin"
 * (the middleware only re-reads app_users when the cached role is missing), so
 * no app_users row is needed. All seeded tenant rows + the session are cleaned
 * up.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";
import adminRouter from "./admin";

const RUN = randomUUID().slice(0, 8);
const SID = `it-sharelib-${RUN}`;
const SLUG_PREFIX = `it-sharelib-${RUN}`;

let app: Express;
let tenantA = 0;
let tenantB = 0;
let tenantC = 0;

function superadminSess(): string {
  const user: AuthUser = {
    userId: 999700001,
    email: `sharelib-it-${RUN}@example.com`,
    name: "IT Superadmin",
    avatarUrl: null,
    tenantId: null,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: "superadmin",
  };
  return JSON.stringify(user);
}

async function makeTenant(label: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`IT ShareLib ${label} ${RUN}`, `${SLUG_PREFIX}-${label.toLowerCase()}`],
  );
  return rows[0].id;
}

async function sibling(id: number): Promise<number | null> {
  const { rows } = await pool.query<{ sibling: number | null }>(
    `SELECT shares_library_with_tenant_id AS sibling FROM tenants WHERE id = $1`,
    [id],
  );
  return rows[0]?.sibling ?? null;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE slug LIKE $1`, [`${SLUG_PREFIX}-%`]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [SID, superadminSess()],
  );
  tenantA = await makeTenant("A");
  tenantB = await makeTenant("B");
  tenantC = await makeTenant("C");

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
});

afterAll(async () => {
  await cleanup();
});

function shareLibrary(targetId: number | string, body: unknown) {
  return inject(app, {
    method: "POST",
    url: `/superadmin/tenants/${targetId}/share-library`,
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body,
  });
}

describe("POST /superadmin/tenants/:id/share-library — reciprocal linking", () => {
  it("links A→B reciprocally on both rows", async () => {
    const res = await shareLibrary(tenantA, { siblingTenantId: tenantB });
    expect(res.status).toBe(200);
    expect((res.json as { siblingTenantId?: number })?.siblingTenantId).toBe(tenantB);
    expect(await sibling(tenantA)).toBe(tenantB);
    expect(await sibling(tenantB)).toBe(tenantA);
  });

  it("unlinks A (siblingTenantId:null) and clears both rows", async () => {
    const res = await shareLibrary(tenantA, { siblingTenantId: null });
    expect(res.status).toBe(200);
    expect((res.json as { siblingTenantId?: number | null })?.siblingTenantId).toBeNull();
    expect(await sibling(tenantA)).toBeNull();
    expect(await sibling(tenantB)).toBeNull();
  });

  it("clears a stale partner when re-linking to a sibling already linked elsewhere", async () => {
    // Establish A↔B first.
    expect((await shareLibrary(tenantA, { siblingTenantId: tenantB })).status).toBe(200);
    expect(await sibling(tenantA)).toBe(tenantB);
    expect(await sibling(tenantB)).toBe(tenantA);

    // Now link C↔A. A was pointing at B, so B must be cleared (no dangling
    // one-sided B→A link) and A must be re-pointed at C reciprocally.
    const res = await shareLibrary(tenantC, { siblingTenantId: tenantA });
    expect(res.status).toBe(200);
    expect(await sibling(tenantC)).toBe(tenantA);
    expect(await sibling(tenantA)).toBe(tenantC);
    expect(await sibling(tenantB)).toBeNull();
  });
});

describe("POST /superadmin/tenants/:id/share-library — rejections", () => {
  it("rejects self-linking with 400", async () => {
    const res = await shareLibrary(tenantA, { siblingTenantId: tenantA });
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric tenant id with 400", async () => {
    const res = await shareLibrary("not-a-number", { siblingTenantId: tenantB });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid siblingTenantId with 400", async () => {
    const res = await shareLibrary(tenantA, { siblingTenantId: -5 });
    expect(res.status).toBe(400);
  });

  it("404s when the target tenant does not exist", async () => {
    const res = await shareLibrary(987654321, { siblingTenantId: tenantB });
    expect(res.status).toBe(404);
  });

  it("404s when the sibling tenant does not exist", async () => {
    const res = await shareLibrary(tenantA, { siblingTenantId: 987654321 });
    expect(res.status).toBe(404);
  });
});
