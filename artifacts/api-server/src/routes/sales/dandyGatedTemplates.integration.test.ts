/**
 * Integration test that the formerly Dandy-gated built-ins STAY un-gated.
 *
 * The built-in templates "comparison" (Evolution) and "agreement-summary" used
 * to be reserved for the two protected Dandy workspaces (dandy / dandy-smb)
 * because they were too Dandy-coded to neutralize via copy scrubbing. They have
 * since been rewritten to be brand-agnostic (tenant palette via resolvePalette,
 * copy via scrubBrandDeep, neutral/tenant header image via resolveOnePagerAssets)
 * and are now available to EVERY tenant.
 *
 * The gate mechanism itself is live again: "roi" was re-gated in July 2026
 * because its unit economics and named case studies are irreducibly Dandy (see
 * DANDY_GATED_BUILTIN_IDS in one-pager-types/constants.ts; onePagerRebrand.test.ts
 * pins roi's membership). This file guards the other direction: the server must
 * NOT reject a non-Dandy tenant that saves, publishes, or authors layout state
 * for the two formerly gated built-ins.
 *
 * All routes are exercised in-process (no TCP socket) via the inject() helper,
 * against the REAL Postgres pool so `isDandyTenant` runs its real slug lookup:
 *   - POST/PATCH /sales/one-pager-templates  (save gate, builtinId)
 *   - POST       /sales/web-one-pager         (publish gate, builtinId/template)
 *   - PUT/DELETE /sales/layout-defaults/:key  (editor layout gate, storage key)
 *
 * Each case asserts the response is NOT a 403 (the gate no longer fires). The
 * exact non-403 status varies by route (201 save, 404 patch of a missing row,
 * 200/201 layout upsert, etc.), so the gate-specific assertion is "not 403".
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
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

/** The built-ins that used to be Dandy-gated and are now available to all. */
const FORMERLY_GATED_BUILTIN_IDS = ["comparison", "agreement-summary"] as const;

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
  // the save route's requireAnyPermission gate passes and execution reaches the
  // Dandy-gate check — the thing under test.
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

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("formerly gated built-ins stay un-gated", () => {
  it("comparison and agreement-summary are not in the gated list", () => {
    for (const id of FORMERLY_GATED_BUILTIN_IDS) {
      expect(DANDY_GATED_BUILTIN_IDS).not.toContain(id);
    }
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("save gate — POST /sales/one-pager-templates", () => {
  for (const builtinId of FORMERLY_GATED_BUILTIN_IDS) {
    it(`allows formerly-gated built-in "${builtinId}" for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "POST",
        url: "/one-pager-templates",
        sid: SID,
        body: { name: `Cloned ${builtinId}`, builtinId },
      });
      expect(res.status).not.toBe(403);
    });
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("save gate — PATCH /sales/one-pager-templates/:id", () => {
  for (const builtinId of FORMERLY_GATED_BUILTIN_IDS) {
    it(`does not gate formerly-gated built-in "${builtinId}" on update for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "PATCH",
        url: "/one-pager-templates/1",
        sid: SID,
        body: { name: "x", builtinId },
      });
      expect(res.status).not.toBe(403);
    });
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("publish gate — POST /sales/web-one-pager", () => {
  for (const builtinId of FORMERLY_GATED_BUILTIN_IDS) {
    it(`does not gate formerly-gated built-in "${builtinId}" via builtinId for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "POST",
        url: "/web-one-pager",
        body: { dsoName: "Acme DSO", tenantId, builtinId },
      });
      expect(res.status).not.toBe(403);
    });

    it(`does not gate formerly-gated built-in "${builtinId}" via template for a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "POST",
        url: "/web-one-pager",
        body: { dsoName: "Acme DSO", tenantId, template: builtinId },
      });
      expect(res.status).not.toBe(403);
    });
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("editor layout gate — PUT /sales/layout-defaults/:key", () => {
  for (const builtinId of FORMERLY_GATED_BUILTIN_IDS) {
    it(`allows upsert of formerly-gated layout key for "${builtinId}" from a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "PUT",
        url: `/layout-defaults/${layoutKeyFor(builtinId)}`,
        sid: SID,
        body: { config: { fields: [] } },
      });
      // 201 on first insert, 200 on a subsequent upsert — either proves the gate
      // didn't fire (vs the old 403).
      expect([200, 201]).toContain(res.status);
    });
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("editor layout gate — DELETE /sales/layout-defaults/:key", () => {
  for (const builtinId of FORMERLY_GATED_BUILTIN_IDS) {
    it(`allows delete of formerly-gated layout key for "${builtinId}" from a non-Dandy tenant`, async () => {
      const res = await injectSid({
        method: "DELETE",
        url: `/layout-defaults/${layoutKeyFor(builtinId)}`,
        sid: SID,
      });
      expect(res.status).not.toBe(403);
    });
  }
});
