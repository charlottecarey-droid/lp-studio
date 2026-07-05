/**
 * Integration tests for GLOBAL custom one-pager templates (July 2026,
 * Phase 2 of the global one-pager work).
 *
 * sales_one_pager_templates now supports tenant_id-NULL rows: superadmin-
 * authored GLOBAL templates every tenant sees read-only in its gallery and
 * duplicates into its own workspace to edit. Covered contracts:
 *
 *   1. Tenant GET list includes ACTIVE global rows for admins and reps, and
 *      hides soft-deleted global rows from everyone.
 *   2. Tenant GET :id serves an active global row; tenant PATCH/DELETE on a
 *      global id 404 (mutations are scoped to the tenant's own rows).
 *   3. Superadmin CRUD — /admin/superadmin/one-pager-templates POST/PATCH/
 *      DELETE with requireSuperadmin; non-superadmin rejected; superadmin
 *      list includes soft-deleted rows (restorable).
 *   4. "Duplicate to workspace" = tenant POST with the global row's fields —
 *      creates an independent tenant-owned copy.
 *
 * Exercised in-process via inject() against the REAL Postgres pool. Global
 * rows created here use run-unique names and are deleted in afterAll, so a
 * run against a shared database leaves no residue.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, optionalAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import onePagerTemplatesRouter from "./one-pager-templates";
import adminRouter from "../admin";

const RUN = randomUUID().slice(0, 8);
const TENANT_SLUG = `it-globaltpl-${RUN}`;
const SID_ADMIN = `it-globaltpl-admin-${RUN}`;
const SID_REP = `it-globaltpl-rep-${RUN}`;
const SID_SUPER = `it-globaltpl-super-${RUN}`;

let tenantId: number;
let app: Express;
let globalActiveId: number;
let globalDeletedId: number;

function injectSid(opts: { method: string; url: string; sid: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${opts.sid}` },
    body: opts.body,
  });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: `globaltpl-it-${RUN}@example.com`,
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
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

async function insertGlobalTemplate(name: string, isDeleted: boolean): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sales_one_pager_templates (tenant_id, name, background_url, orientation, fields, is_deleted)
     VALUES (NULL, $1, '', 'portrait', '[]'::jsonb, $2) RETURNING id`,
    [name, isDeleted],
  );
  return rows[0].id;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM sales_one_pager_templates WHERE name LIKE $1`, [`IT GlobalTpl ${RUN}%`]).catch(() => {});
  if (tenantId) {
    await pool.query(`DELETE FROM sales_one_pager_templates WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid IN ($1, $2, $3)`, [SID_ADMIN, SID_REP, SID_SUPER]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  if (!dbAvailable) return;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT GlobalTpl Tenant', $1, 'active') RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  await seedSession(SID_ADMIN, {
    userId: 999400001, tenantId, role: "admin", isAdmin: true,
    permissions: { sales_campaigns: true, one_pager_templates: true },
  });
  await seedSession(SID_REP, { userId: 999400002, tenantId, role: "member" });
  // Superadmin: cached appUserRole "superadmin" — middleware skips the
  // app_users re-read, so no app_users row is needed.
  await seedSession(SID_SUPER, { userId: 999400003, tenantId, role: "admin", isAdmin: true, appUserRole: "superadmin" });

  globalActiveId = await insertGlobalTemplate(`IT GlobalTpl ${RUN} active`, false);
  globalDeletedId = await insertGlobalTemplate(`IT GlobalTpl ${RUN} deleted`, true);

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(optionalAuth);
  app.use(onePagerTemplatesRouter);
  app.use("/admin", adminRouter);
});

afterAll(async () => {
  if (!dbAvailable) return;
  await cleanup();
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("tenant list — GET /one-pager-templates includes global rows", () => {
  it("admin sees the active global template but not the soft-deleted one", async () => {
    const res = await injectSid({ method: "GET", url: "/one-pager-templates", sid: SID_ADMIN });
    expect(res.status).toBe(200);
    const rows = res.json as Array<{ id: number; tenantId: number | null }>;
    const ids = rows.map(r => r.id);
    expect(ids).toContain(globalActiveId);
    expect(ids).not.toContain(globalDeletedId);
    expect(rows.find(r => r.id === globalActiveId)?.tenantId).toBeNull();
  });

  it("a rep (non-admin) also sees the active global template", async () => {
    const res = await injectSid({ method: "GET", url: "/one-pager-templates", sid: SID_REP });
    expect(res.status).toBe(200);
    const ids = (res.json as Array<{ id: number }>).map(r => r.id);
    expect(ids).toContain(globalActiveId);
    expect(ids).not.toContain(globalDeletedId);
  });

  it("GET :id serves the active global row, 404s the soft-deleted one", async () => {
    const ok = await injectSid({ method: "GET", url: `/one-pager-templates/${globalActiveId}`, sid: SID_REP });
    expect(ok.status).toBe(200);
    const gone = await injectSid({ method: "GET", url: `/one-pager-templates/${globalDeletedId}`, sid: SID_ADMIN });
    expect(gone.status).toBe(404);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("tenant mutations can never touch a global row", () => {
  it("PATCH on a global id 404s", async () => {
    const res = await injectSid({
      method: "PATCH",
      url: `/one-pager-templates/${globalActiveId}`,
      sid: SID_ADMIN,
      body: { name: "hijacked" },
    });
    expect(res.status).toBe(404);
  });

  it("DELETE on a global id 404s", async () => {
    const res = await injectSid({ method: "DELETE", url: `/one-pager-templates/${globalActiveId}`, sid: SID_ADMIN });
    expect(res.status).toBe(404);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("superadmin CRUD — /admin/superadmin/one-pager-templates", () => {
  it("rejects a non-superadmin session", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/admin/superadmin/one-pager-templates",
      sid: SID_ADMIN,
      body: { name: `IT GlobalTpl ${RUN} rejected` },
    });
    expect([401, 403]).toContain(res.status);
  });

  it("POST creates a global row; superadmin list includes soft-deleted rows", async () => {
    const created = await injectSid({
      method: "POST",
      url: "/admin/superadmin/one-pager-templates",
      sid: SID_SUPER,
      body: { name: `IT GlobalTpl ${RUN} authored`, orientation: "landscape", fields: [{ id: "f1", type: "dso_name" }] },
    });
    expect(created.status).toBe(201);
    const row = created.json as { id: number; tenantId: number | null; orientation: string };
    expect(row.tenantId).toBeNull();
    expect(row.orientation).toBe("landscape");

    const list = await injectSid({ method: "GET", url: "/admin/superadmin/one-pager-templates", sid: SID_SUPER });
    expect(list.status).toBe(200);
    const ids = (list.json as Array<{ id: number }>).map(r => r.id);
    expect(ids).toContain(row.id);
    expect(ids).toContain(globalDeletedId); // superadmins see (and can restore) soft-deleted globals
  });

  it("PATCH updates a global row; DELETE removes it; tenant ids are untouchable", async () => {
    const patched = await injectSid({
      method: "PATCH",
      url: `/admin/superadmin/one-pager-templates/${globalActiveId}`,
      sid: SID_SUPER,
      body: { name: `IT GlobalTpl ${RUN} renamed` },
    });
    expect(patched.status).toBe(200);
    expect((patched.json as { name: string }).name).toBe(`IT GlobalTpl ${RUN} renamed`);

    // A tenant-owned row is invisible to the superadmin global routes.
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO sales_one_pager_templates (tenant_id, name, background_url, orientation, fields)
       VALUES ($1, $2, '', 'portrait', '[]'::jsonb) RETURNING id`,
      [tenantId, `IT GlobalTpl ${RUN} tenant-owned`],
    );
    const tenantRowId = rows[0].id;
    const patchTenant = await injectSid({
      method: "PATCH",
      url: `/admin/superadmin/one-pager-templates/${tenantRowId}`,
      sid: SID_SUPER,
      body: { name: "should 404" },
    });
    expect(patchTenant.status).toBe(404);

    const del = await injectSid({ method: "DELETE", url: `/admin/superadmin/one-pager-templates/${globalDeletedId}`, sid: SID_SUPER });
    expect(del.status).toBe(200);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("duplicate-to-workspace — tenant POST of a global row's fields", () => {
  it("creates an independent tenant-owned copy", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/one-pager-templates",
      sid: SID_ADMIN,
      body: { name: `IT GlobalTpl ${RUN} my copy`, background_url: "", orientation: "portrait", fields: [] },
    });
    expect(res.status).toBe(201);
    const copy = res.json as { id: number; tenantId: number };
    expect(copy.tenantId).toBe(tenantId);
    expect(copy.id).not.toBe(globalActiveId);
  });
});
