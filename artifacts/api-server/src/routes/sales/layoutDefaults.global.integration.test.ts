/**
 * Integration tests for GLOBAL one-pager layout defaults (July 2026).
 *
 * sales_layout_defaults now supports tenant_id-NULL rows: superadmin-managed
 * GLOBAL defaults every tenant inherits when it has no row of its own for a
 * key (whole-row precedence, no field-level merge). Covered contracts:
 *
 *   1. GET /sales/layout-defaults/:key — tenant row → global row → null.
 *   2. GET /sales/layout-defaults      — global layer under tenant layer.
 *   3. Dandy-gated keys (isDandyGatedLayoutKey, currently roi) never fall
 *      back to a global row for a NON-Dandy tenant — single or list GET.
 *   4. Superadmin CRUD — /admin one-pager-layouts GET/PUT/DELETE with
 *      requireSuperadmin, tenantOverrides counts, input validation.
 *   5. POST /sales/web-one-pager (partner) — server-side global fallback for
 *      dandy_partner_template_layout when the tenant has no row.
 *
 * Exercised in-process via inject() against the REAL Postgres pool (mirrors
 * dandyGatedTemplates.integration.test.ts / admin.shareLibrary conventions).
 *
 * Shared-database hygiene: precedence + CRUD cases use SYNTHETIC keys (never
 * collide with real data). The two cases that need REAL template keys
 * (dandy_roi_template_layout, dandy_partner_template_layout) snapshot any
 * existing global row in beforeAll and restore it in afterAll, so a run
 * against a shared staging database never destroys a real global default.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { isDandyGatedLayoutKey } from "@workspace/one-pager-types/constants";
import { SESSION_COOKIE, optionalAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import layoutDefaultsRouter from "./layout-defaults";
import webOnePagerRouter from "./web-one-pager";
import adminRouter from "../admin";

const RUN = randomUUID().slice(0, 8);
const TENANT_SLUG = `it-globallayout-${RUN}`;
const SID_TENANT = `it-globallayout-tenant-${RUN}`;
const SID_SUPER = `it-globallayout-super-${RUN}`;

/** Synthetic keys — never collide with real template data on a shared DB. */
const KEY_PLAIN = `it_global_plain_${RUN}`;
const KEY_CRUD = `it_global_crud_${RUN}`;

/** Real keys the gating / web fallback paths key on. */
const KEY_ROI = "dandy_roi_template_layout";
const KEY_PARTNER = "dandy_partner_template_layout";

let tenantId: number;
let app: Express;

/** Snapshot of pre-existing REAL global rows (restored in afterAll). */
const globalSnapshots = new Map<string, unknown | null>();

function injectSid(opts: { method: string; url: string; sid?: string; body?: unknown }): Promise<InjectResponse> {
  const headers = opts.sid ? { cookie: `${SESSION_COOKIE}=${opts.sid}` } : undefined;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: `globallayout-it-${RUN}@example.com`,
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

async function upsertGlobalRow(key: string, config: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO sales_layout_defaults (tenant_id, template_key, config)
     VALUES (NULL, $1, $2)
     ON CONFLICT (template_key) WHERE tenant_id IS NULL
     DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
    [key, JSON.stringify(config)],
  );
}

async function deleteGlobalRow(key: string): Promise<void> {
  await pool.query(
    `DELETE FROM sales_layout_defaults WHERE tenant_id IS NULL AND template_key = $1`,
    [key],
  );
}

/** Capture any real global row for `key` so afterAll can put it back. */
async function snapshotGlobalRow(key: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT config FROM sales_layout_defaults WHERE tenant_id IS NULL AND template_key = $1`,
    [key],
  );
  globalSnapshots.set(key, rows.length ? rows[0].config : null);
}

async function restoreGlobalRow(key: string): Promise<void> {
  if (!globalSnapshots.has(key)) return;
  const prior = globalSnapshots.get(key);
  if (prior === null) await deleteGlobalRow(key);
  else await upsertGlobalRow(key, prior);
}

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_layout_defaults WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  }
  await deleteGlobalRow(KEY_PLAIN).catch(() => {});
  await deleteGlobalRow(KEY_CRUD).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid IN ($1, $2)`, [SID_TENANT, SID_SUPER]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  if (!dbAvailable) return;
  // Preserve any real global rows for the REAL keys this suite touches.
  await snapshotGlobalRow(KEY_ROI);
  await snapshotGlobalRow(KEY_PARTNER);

  // A NON-Dandy tenant: any slug other than the reserved dandy / dandy-smb.
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT GlobalLayout Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  await seedSession(SID_TENANT, {
    userId: 999200001,
    tenantId,
    role: "admin",
    permissions: { sales_campaigns: true },
  });
  // Superadmin identity: cached appUserRole is already "superadmin", so the
  // middleware never re-reads app_users and no app_users row is needed.
  await seedSession(SID_SUPER, {
    userId: 999200002,
    tenantId,
    role: "admin",
    isAdmin: true,
    appUserRole: "superadmin",
  });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(optionalAuth);
  app.use(layoutDefaultsRouter);
  app.use(webOnePagerRouter);
  app.use("/admin", adminRouter);
});

afterAll(async () => {
  if (!dbAvailable) return;
  await cleanup();
  await restoreGlobalRow(KEY_ROI);
  await restoreGlobalRow(KEY_PARTNER);
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("GET /sales/layout-defaults/:key — global fallback precedence", () => {
  it("returns null when neither a tenant nor a global row exists", async () => {
    const res = await injectSid({ method: "GET", url: `/layout-defaults/${KEY_PLAIN}`, sid: SID_TENANT });
    expect(res.status).toBe(200);
    expect(res.json).toBeNull();
  });

  it("falls back to the global row when the tenant has none", async () => {
    await upsertGlobalRow(KEY_PLAIN, { source: "global", sectionRowGap: 24 });
    const res = await injectSid({ method: "GET", url: `/layout-defaults/${KEY_PLAIN}`, sid: SID_TENANT });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ source: "global", sectionRowGap: 24 });
  });

  it("tenant row fully overrides the global row (whole-row precedence)", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/layout-defaults/${KEY_PLAIN}`,
      sid: SID_TENANT,
      body: { config: { source: "tenant" } },
    });
    expect([200, 201]).toContain(put.status);
    const res = await injectSid({ method: "GET", url: `/layout-defaults/${KEY_PLAIN}`, sid: SID_TENANT });
    expect(res.status).toBe(200);
    // No field-level merge: sectionRowGap from the global row must NOT bleed in.
    expect(res.json).toEqual({ source: "tenant" });
  });

  it("deleting the tenant row re-exposes the global row", async () => {
    const del = await injectSid({ method: "DELETE", url: `/layout-defaults/${KEY_PLAIN}`, sid: SID_TENANT });
    expect(del.status).toBe(200);
    const res = await injectSid({ method: "GET", url: `/layout-defaults/${KEY_PLAIN}`, sid: SID_TENANT });
    expect(res.json).toEqual({ source: "global", sectionRowGap: 24 });
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("GET /sales/layout-defaults — list merges global under tenant", () => {
  it("global-only keys appear; tenant rows win per key", async () => {
    await upsertGlobalRow(KEY_PLAIN, { source: "global" });
    await injectSid({
      method: "PUT",
      url: `/layout-defaults/${KEY_CRUD}`,
      sid: SID_TENANT,
      body: { config: { source: "tenant" } },
    });
    await upsertGlobalRow(KEY_CRUD, { source: "global-shadowed" });

    const res = await injectSid({ method: "GET", url: "/layout-defaults", sid: SID_TENANT });
    expect(res.status).toBe(200);
    const map = res.json as Record<string, unknown>;
    expect(map[KEY_PLAIN]).toEqual({ source: "global" });
    expect(map[KEY_CRUD]).toEqual({ source: "tenant" });
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Dandy-gated keys never fall back globally for non-Dandy tenants", () => {
  it("the roi layout key is currently the gated fixture this suite relies on", () => {
    expect(isDandyGatedLayoutKey(KEY_ROI)).toBe(true);
  });

  it("single GET returns null despite an existing global row", async () => {
    await upsertGlobalRow(KEY_ROI, { source: "global-roi" });
    const res = await injectSid({ method: "GET", url: `/layout-defaults/${KEY_ROI}`, sid: SID_TENANT });
    expect(res.status).toBe(200);
    expect(res.json).toBeNull();
  });

  it("list GET excludes the gated global key", async () => {
    const res = await injectSid({ method: "GET", url: "/layout-defaults", sid: SID_TENANT });
    expect(res.status).toBe(200);
    expect((res.json as Record<string, unknown>)[KEY_ROI]).toBeUndefined();
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("superadmin CRUD — /admin/superadmin/one-pager-layouts", () => {
  it("rejects a non-superadmin session", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_TENANT,
      body: { config: { a: 1 } },
    });
    expect([401, 403]).toContain(res.status);
  });

  it("validates config shape and key format", async () => {
    const badConfig = await injectSid({
      method: "PUT",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_SUPER,
      body: { config: [1, 2, 3] },
    });
    expect(badConfig.status).toBe(400);
    const badKey = await injectSid({
      method: "PUT",
      url: `/admin/superadmin/one-pager-layouts/${encodeURIComponent("bad key!")}`,
      sid: SID_SUPER,
      body: { config: { a: 1 } },
    });
    expect(badKey.status).toBe(400);
  });

  it("PUT upserts, GET reads back, list carries tenantOverrides counts", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_SUPER,
      body: { config: { source: "superadmin", v: 1 } },
    });
    expect(put.status).toBe(200);

    // Upsert again to prove the partial-unique-index ON CONFLICT path works.
    const put2 = await injectSid({
      method: "PUT",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_SUPER,
      body: { config: { source: "superadmin", v: 2 } },
    });
    expect(put2.status).toBe(200);

    const single = await injectSid({
      method: "GET",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_SUPER,
    });
    expect(single.status).toBe(200);
    expect(single.json).toEqual({ source: "superadmin", v: 2 });

    const list = await injectSid({ method: "GET", url: "/admin/superadmin/one-pager-layouts", sid: SID_SUPER });
    expect(list.status).toBe(200);
    const body = list.json as { layouts: Record<string, unknown>; tenantOverrides: Record<string, number> };
    expect(body.layouts[KEY_CRUD]).toEqual({ source: "superadmin", v: 2 });
    // The tenant row saved for KEY_CRUD in the list-merge suite above counts
    // as an override of this global key.
    expect(body.tenantOverrides[KEY_CRUD]).toBeGreaterThanOrEqual(1);
  });

  it("DELETE removes the global row only", async () => {
    const del = await injectSid({
      method: "DELETE",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_SUPER,
    });
    expect(del.status).toBe(200);
    const single = await injectSid({
      method: "GET",
      url: `/admin/superadmin/one-pager-layouts/${KEY_CRUD}`,
      sid: SID_SUPER,
    });
    expect(single.json).toBeNull();
    // The tenant's own row for the same key must survive the global delete.
    const tenantRow = await injectSid({ method: "GET", url: `/layout-defaults/${KEY_CRUD}`, sid: SID_TENANT });
    expect(tenantRow.json).toEqual({ source: "tenant" });
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("POST /sales/web-one-pager — partner layout global fallback", () => {
  it("uses the global partner layout when the tenant has no row", async () => {
    const headline = `Global fallback headline ${RUN}`;
    await upsertGlobalRow(KEY_PARTNER, { partnerHeadline: headline });
    // Ensure the tenant genuinely has no partner row of its own.
    await pool.query(
      `DELETE FROM sales_layout_defaults WHERE tenant_id = $1 AND template_key = $2`,
      [tenantId, KEY_PARTNER],
    );

    const res = await injectSid({
      method: "POST",
      url: "/web-one-pager",
      body: { dsoName: "Acme DSO", tenantId, template: "new-partner" },
    });
    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId?: number } | undefined)?.pageId;
    expect(typeof pageId).toBe("number");

    const { rows } = await pool.query<{ blocks: Array<{ type: string; props?: Record<string, unknown> }> }>(
      `SELECT blocks FROM lp_pages WHERE id = $1`,
      [pageId],
    );
    expect(rows).toHaveLength(1);
    const hero = rows[0].blocks.find((b) => b.type === "one-pager-hero");
    expect(hero?.props?.headline).toBe(headline);
  });

  it("a tenant row still beats the global partner layout", async () => {
    const tenantHeadline = `Tenant headline ${RUN}`;
    await pool.query(
      `INSERT INTO sales_layout_defaults (tenant_id, template_key, config)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, template_key) DO UPDATE SET config = EXCLUDED.config`,
      [tenantId, KEY_PARTNER, JSON.stringify({ partnerHeadline: tenantHeadline })],
    );

    const res = await injectSid({
      method: "POST",
      url: "/web-one-pager",
      body: { dsoName: "Acme DSO", tenantId, template: "new-partner" },
    });
    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId?: number }).pageId as number;
    const { rows } = await pool.query<{ blocks: Array<{ type: string; props?: Record<string, unknown> }> }>(
      `SELECT blocks FROM lp_pages WHERE id = $1`,
      [pageId],
    );
    const hero = rows[0].blocks.find((b) => b.type === "one-pager-hero");
    expect(hero?.props?.headline).toBe(tenantHeadline);
  });
});
