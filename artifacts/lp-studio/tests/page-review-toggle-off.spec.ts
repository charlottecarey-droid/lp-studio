// E2E coverage for the tenant-wide `requireReviewBeforePublish` toggle (task #113).
//
// Why this spec exists:
//   - Task #113 introduces a per-tenant flag in tenants.settings JSONB. When
//     OFF, the four review-workflow endpoints (submit-review / approve /
//     reject / pending-review) MUST return 409, and any user with the basic
//     `pages` perm MUST be able to publish a page directly via PUT
//     /lp/pages/:id with status=published. The companion #108 spec covers
//     the toggle-ON path; this spec is the negative half.
//
// Setup mirrors the #108 spec — same helper, but the `requireReviewBeforePublish`
// option is forced to false so we exercise the new code paths.

import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import { randomBytes } from "node:crypto";
import {
  createReviewWorkflowTenant,
  cleanupReviewWorkflowTenant,
  type ReviewWorkflowTenant,
} from "./setup/review-workflow-tenant";

const API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "4319"}/api/`;

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL is required for page-review-toggle-off.spec.ts");
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: ReviewWorkflowTenant;

test.beforeAll(async () => {
  // Force the toggle OFF — this is the new-tenant default introduced by #113.
  // The unique suffix prefix keeps it distinct from the on-by-default tenants
  // seeded by the parallel #108 spec so cleanup is targeted.
  tenant = await createReviewWorkflowTenant(pool, {
    uniqueSuffix: `toggle-off-${Date.now().toString(36)}`,
    requireReviewBeforePublish: false,
  });
});

test.afterAll(async () => {
  if (tenant) await cleanupReviewWorkflowTenant(pool, tenant);
  await pool.end();
});

async function clientFor(sid: string): Promise<APIRequestContext> {
  return await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Cookie: `lp_sid=${sid}` },
  });
}

async function createPage(sid: string, tenantId: number, title: string): Promise<{ id: number; slug: string }> {
  const ctx = await clientFor(sid);
  const slug = `toggle-off-${tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await ctx.post(`lp/pages`, {
    data: { title, slug, blocks: [], status: "draft" },
  });
  expect(res.status(), `create page (HTTP ${res.status()}: ${await res.text()})`).toBe(201);
  const page = await res.json() as { id: number; slug: string };
  await ctx.dispose();
  return { id: page.id, slug: page.slug };
}

test.describe("Page review workflow — tenant toggle OFF (task #113)", () => {
  test("submit-review returns 409 even for the editor who would otherwise be allowed", async () => {
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Toggle off — submit");
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.post(`lp/pages/${page.id}/submit-review`);
    expect(res.status()).toBe(409);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/disabled/i);
    await ctx.dispose();
  });

  test("approve returns 409 even when called by an admin", async () => {
    const page = await createPage(tenant.admin.sessionSid, tenant.tenantId, "Toggle off — approve");
    const ctx = await clientFor(tenant.admin.sessionSid);
    const res = await ctx.post(`lp/pages/${page.id}/approve`);
    expect(res.status()).toBe(409);
    await ctx.dispose();
  });

  test("reject returns 409 even when called by an admin", async () => {
    const page = await createPage(tenant.admin.sessionSid, tenant.tenantId, "Toggle off — reject");
    const ctx = await clientFor(tenant.admin.sessionSid);
    const res = await ctx.post(`lp/pages/${page.id}/reject`, { data: { note: "n/a" } });
    expect(res.status()).toBe(409);
    await ctx.dispose();
  });

  test("pending-review queue returns 409 (the route is meaningless when the workflow is off)", async () => {
    const ctx = await clientFor(tenant.admin.sessionSid);
    const res = await ctx.get(`lp/pages/pending-review`);
    expect(res.status()).toBe(409);
    await ctx.dispose();
  });

  test("editor with `pages` perm publishes directly via PUT (toggle off lets them bypass review)", async () => {
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Toggle off — direct publish");
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.put(`lp/pages/${page.id}`, {
      data: { status: "published" },
    });
    expect(res.status(), `direct publish (HTTP ${res.status()}: ${await res.text()})`).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("published");
    await ctx.dispose();
  });

  test("/api/auth/me reflects the toggle so the client can hide review UI", async () => {
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.get(`auth/me`);
    expect(res.status()).toBe(200);
    const me = await res.json() as { requireReviewBeforePublish?: boolean };
    expect(me.requireReviewBeforePublish).toBe(false);
    await ctx.dispose();
  });

  test("self-serve signup creates a tenant with the workflow OFF and the editor publishes directly", async () => {
    // The signup endpoint requires an authenticated session that does NOT
    // yet belong to a tenant, mirroring the real onboarding flow. We seed
    // a no-tenant user + session row directly so we don't need to wire up
    // OAuth in tests, then call POST /api/auth/signup and assert the
    // resulting tenant inherits the new task #113 default.
    const suffix = `signup-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
    const email = `signup-${suffix}@example.com`;
    const sid = randomBytes(24).toString("base64url");

    const client = await pool.connect();
    let userId = 0;
    try {
      const userRes = await client.query<{ id: number }>(
        `INSERT INTO app_users (tenant_id, email, name, role, status)
         VALUES (NULL, $1, $2, 'user', 'active')
         RETURNING id`,
        [email, `Signup ${suffix}`],
      );
      userId = userRes.rows[0].id;
      await client.query(
        `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
        [
          sid,
          JSON.stringify({
            userId,
            email,
            name: `Signup ${suffix}`,
            avatarUrl: null,
            tenantId: null,
            role: "user",
            permissions: {},
            isAdmin: false,
            micrositeDomain: null,
            appUserRole: "user",
          }),
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        ],
      );
    } finally {
      client.release();
    }

    const ctx = await clientFor(sid);
    let createdTenantId = 0;
    try {
      const slug = `signup-${suffix}`;
      const signupRes = await ctx.post(`auth/signup`, {
        data: { name: `Signup Workspace ${suffix}`, slug },
      });
      expect(signupRes.status(), `signup (HTTP ${signupRes.status()}: ${await signupRes.text()})`).toBe(200);

      // After signup, /me must report requireReviewBeforePublish=false.
      const meRes = await ctx.get(`auth/me`);
      expect(meRes.status()).toBe(200);
      const me = await meRes.json() as { tenantId: number; requireReviewBeforePublish?: boolean };
      expect(me.requireReviewBeforePublish).toBe(false);
      createdTenantId = me.tenantId;
      expect(createdTenantId).toBeGreaterThan(0);

      // The signing-up user is the workspace admin, so they have all perms.
      // We assert the editor-style direct-publish path by creating a page
      // directly as published — this only works when the toggle is off and
      // the user holds the `pages` perm.
      const createRes = await ctx.post(`lp/pages`, {
        data: {
          title: "Signup tenant — direct publish",
          slug: `signup-published-${suffix}`,
          blocks: [],
          status: "published",
        },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json() as { status: string };
      // Admins (and `pages.publish` holders, which the signup admin has)
      // can create-as-published. The deeper assertion — that an editor with
      // ONLY the basic `pages` perm can publish — is covered by the earlier
      // "editor with `pages` perm publishes directly" test in this file.
      expect(created.status).toBe("published");
    } finally {
      await ctx.dispose();
      // Cleanup: drop everything we created so re-runs don't conflict.
      const cleanup = await pool.connect();
      try {
        if (createdTenantId > 0) {
          await cleanup.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [createdTenantId]);
          await cleanup.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [createdTenantId]);
          await cleanup.query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [createdTenantId]);
          await cleanup.query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [createdTenantId]);
          await cleanup.query(`DELETE FROM app_users WHERE tenant_id = $1`, [createdTenantId]);
          await cleanup.query(`DELETE FROM tenants WHERE id = $1`, [createdTenantId]);
        }
        await cleanup.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]);
        await cleanup.query(`DELETE FROM app_users WHERE id = $1`, [userId]);
      } finally {
        cleanup.release();
      }
    }
  });

  test("admin can flip the toggle back ON via PATCH /api/admin/tenant-settings; submit-review then succeeds", async () => {
    const ctx = await clientFor(tenant.admin.sessionSid);

    // Flip ON.
    const patchRes = await ctx.patch(`admin/tenant-settings`, {
      data: { requireReviewBeforePublish: true },
    });
    expect(patchRes.status()).toBe(200);
    const patched = await patchRes.json() as { requireReviewBeforePublish: boolean };
    expect(patched.requireReviewBeforePublish).toBe(true);

    // Now submit-review must succeed instead of 409ing.
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Toggle flipped on");
    const editorCtx = await clientFor(tenant.editor.sessionSid);
    const submitRes = await editorCtx.post(`lp/pages/${page.id}/submit-review`);
    expect(submitRes.status()).toBe(200);
    await editorCtx.dispose();

    // Flip OFF again so the rest of the suite (and any future re-runs)
    // observe a clean toggle-off baseline.
    const restoreRes = await ctx.patch(`admin/tenant-settings`, {
      data: { requireReviewBeforePublish: false },
    });
    expect(restoreRes.status()).toBe(200);
    await ctx.dispose();
  });
});
