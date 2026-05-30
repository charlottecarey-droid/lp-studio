/**
 * Integration test for the Dandy-only built-in one-pager template gate.
 *
 * The built-in templates "comparison" and "agreement-summary" are too
 * Dandy-coded to neutralize via copy scrubbing, so they are reserved for the
 * two protected Dandy workspaces (dandy / dandy-smb). The client picker hides
 * them, but the server is the real boundary: it must reject any explicit
 * request to save or publish a gated built-in from a non-Dandy tenant. A
 * regression here would let a competitor workspace clone a Dandy-branded
 * one-pager.
 *
 * Both gated routes are exercised in-process (no TCP socket) via the inject()
 * helper, against the REAL Postgres pool so `isDandyTenant` runs its real slug
 * lookup:
 *   - POST/PATCH /sales/one-pager-templates  (save gate, builtinId)
 *   - POST       /sales/web-one-pager         (publish gate, builtinId/template)
 *   - PUT/DELETE /sales/layout-defaults/:key  (editor layout gate, storage key)
 *
 * The layout-defaults gate keys off the editor's storage key shape
 * (`dandy_<id>_template_layout`); a non-Dandy tenant must not be able to
 * author/persist or delete layout state for the gated built-ins.
 *
 * Negative paths use a non-Dandy tenant. Positive controls prove the 403 is
 * the gate itself, not a blanket failure: a NON-gated template/key succeeds for
 * the same non-Dandy tenant, and — for the layout gate — a gated key succeeds
 * for the SEEDED Dandy tenant (looked up by reserved slug; the single row it
 * writes is cleaned up so the real Dandy workspace is left untouched).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { DANDY_GATED_BUILTIN_IDS } from "@workspace/one-pager-types/constants";
import { SESSION_COOKIE, optionalAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import onePagerTemplatesRouter from "./one-pager-templates";
import webOnePagerRouter from "./web-one-pager";
import layoutDefaultsRouter from "./layout-defaults";

/** Editor storage key for a built-in's layout (hyphens → underscores). */
const layoutKeyFor = (builtinId: string): string =>
  `dandy_${builtinId.replace(/-/g, "_")}_template_layout`;

const TENANT_SLUG = `it-dandygate-${Date.now()}`;
const SID = `it-dandygate-${randomUUID()}`;

let tenantId: number;
let app: Express;

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
  if (tenantId) {
    await pool.query(`DELETE FROM sales_one_pager_templates WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_layout_defaults WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();

  // A NON-Dandy tenant: any slug other than the reserved dandy / dandy-smb.
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT DandyGate Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // Session member of the non-Dandy tenant WITH template-edit permission, so
  // the save route's requireAnyPermission gate passes and execution reaches
  // the Dandy-gate check (the thing under test).
  await seedSession(SID, {
    userId: 999100001,
    tenantId,
    role: "admin",
    // one_pager_templates → save/publish gates; sales_campaigns → layout gate.
    permissions: { one_pager_templates: true, sales_campaigns: true },
  });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  // optionalAuth hydrates req.authUser from the session cookie without
  // rejecting (mirrors how the global auth guard populates authUser before
  // /sales in the real router). web-one-pager is intentionally public.
  app.use(optionalAuth);
  app.use(onePagerTemplatesRouter);
  app.use(webOnePagerRouter);
  app.use(layoutDefaultsRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("save gate — POST /sales/one-pager-templates", () => {
  for (const builtinId of DANDY_GATED_BUILTIN_IDS) {
    it(`rejects gated built-in "${builtinId}" for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "POST",
        url: "/one-pager-templates",
        sid: SID,
        body: { name: `Cloned ${builtinId}`, builtinId },
      });
      expect(res.status).toBe(403);
    });
  }

  it("allows a non-gated built-in for the same non-Dandy tenant (positive control)", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/one-pager-templates",
      sid: SID,
      body: { name: "Neutral template", builtinId: "default" },
    });
    expect(res.status).toBe(201);
  });
});

describe("save gate — PATCH /sales/one-pager-templates/:id", () => {
  for (const builtinId of DANDY_GATED_BUILTIN_IDS) {
    it(`rejects gated built-in "${builtinId}" on update for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "PATCH",
        url: "/one-pager-templates/1",
        sid: SID,
        body: { name: "x", builtinId },
      });
      expect(res.status).toBe(403);
    });
  }
});

describe("publish gate — POST /sales/web-one-pager", () => {
  for (const builtinId of DANDY_GATED_BUILTIN_IDS) {
    it(`rejects gated built-in "${builtinId}" via builtinId for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "POST",
        url: "/web-one-pager",
        body: { dsoName: "Acme DSO", tenantId, builtinId },
      });
      expect(res.status).toBe(403);
    });

    it(`rejects gated built-in "${builtinId}" via template for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "POST",
        url: "/web-one-pager",
        body: { dsoName: "Acme DSO", tenantId, template: builtinId },
      });
      expect(res.status).toBe(403);
    });
  }
});

describe("editor layout gate — PUT /sales/layout-defaults/:key", () => {
  for (const builtinId of DANDY_GATED_BUILTIN_IDS) {
    it(`rejects upsert of gated layout key for "${builtinId}" from a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "PUT",
        url: `/layout-defaults/${layoutKeyFor(builtinId)}`,
        sid: SID,
        body: { config: { fields: [] } },
      });
      expect(res.status).toBe(403);
    });
  }

  it("allows a non-gated layout key for the same non-Dandy tenant (positive control)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/layout-defaults/${layoutKeyFor("pilot")}`,
      sid: SID,
      body: { config: { fields: [] } },
    });
    // 201 on first insert, 200 on a subsequent upsert — either proves the gate
    // didn't fire (vs the 403 above).
    expect([200, 201]).toContain(res.status);
  });
});

describe("editor layout gate — DELETE /sales/layout-defaults/:key", () => {
  for (const builtinId of DANDY_GATED_BUILTIN_IDS) {
    it(`rejects delete of gated layout key for "${builtinId}" from a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "DELETE",
        url: `/layout-defaults/${layoutKeyFor(builtinId)}`,
        sid: SID,
      });
      expect(res.status).toBe(403);
    });
  }

  it("allows deleting a non-gated layout key for the same non-Dandy tenant (positive control)", async () => {
    const res = await injectSid({
      method: "DELETE",
      url: `/layout-defaults/${layoutKeyFor("pilot")}`,
      sid: SID,
    });
    expect(res.status).toBe(200);
  });
});

// Positive control against the SEEDED Dandy workspace: the gate must NOT block
// a real Dandy tenant from authoring a gated layout. Looked up by reserved slug
// (dandy / dandy-smb); only the one row we write is cleaned up afterwards so the
// real workspace is left untouched. Skips cleanly if no Dandy tenant is seeded.
describe("editor layout gate — Dandy tenant positive control", () => {
  let dandyTenantId: number | null = null;
  let dandySid: string | null = null;
  const dandyKey = layoutKeyFor(DANDY_GATED_BUILTIN_IDS[0]);

  beforeAll(async () => {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM tenants
        WHERE slug IN ('dandy-smb', 'dandy')
        ORDER BY (slug = 'dandy-smb') DESC
        LIMIT 1`,
    );
    if (!rows.length) return;
    dandyTenantId = rows[0].id;
    dandySid = `it-dandygate-dandy-${randomUUID()}`;
    await seedSession(dandySid, {
      userId: 999100002,
      tenantId: dandyTenantId,
      role: "admin",
      isAdmin: true,
      appUserRole: "admin",
      permissions: { sales_campaigns: true },
    });
  });

  afterAll(async () => {
    if (dandyTenantId) {
      await pool
        .query(`DELETE FROM sales_layout_defaults WHERE tenant_id = $1 AND template_key = $2`, [dandyTenantId, dandyKey])
        .catch(() => {});
    }
    if (dandySid) await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [dandySid]).catch(() => {});
  });

  it("allows upsert of a gated layout key for the seeded Dandy tenant", async () => {
    if (!dandyTenantId || !dandySid) {
      // No seeded Dandy workspace in this DB — nothing to assert.
      return;
    }
    const res = await injectSid({
      method: "PUT",
      url: `/layout-defaults/${dandyKey}`,
      sid: dandySid,
      body: { config: { fields: [] } },
    });
    // 201 on insert / 200 on upsert — the gate must NOT 403 a real Dandy tenant.
    expect([200, 201]).toContain(res.status);
  });
});
