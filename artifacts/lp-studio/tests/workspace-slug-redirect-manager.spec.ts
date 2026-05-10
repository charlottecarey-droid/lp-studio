// Workspace URL redirect manager end-to-end (task #153).
//
// After a slug rename, the old slug sits in tenant_slug_redirects so old
// bookmarks keep resolving to the same tenant for SLUG_REDIRECT_TTL_DAYS.
// The redirect manager endpoints
//   GET    /api/admin/tenant-slug/redirects
//   DELETE /api/admin/tenant-slug/redirects/:oldSlug
// let an admin see the active redirects and release one early so the slug
// becomes reusable. A regression here could either strand users on a dead
// URL or, worse, let a stale host cache route the freed slug to the wrong
// tenant. This spec locks down the contract end-to-end:
//
//   1. After a rename, the old slug shows up in GET /tenant-slug/redirects.
//   2. DELETE /tenant-slug/redirects/:oldSlug removes the row, frees the
//      slug for reuse (availability + PATCH both succeed for ANOTHER
//      tenant), and findTenantByHost no longer resolves the old wildcard
//      host to the original tenant.
//   3. A non-admin without the `settings` permission gets 403 on DELETE
//      and on GET — the row stays put.

import { randomBytes } from "node:crypto";
import pg from "pg";
import { test, expect } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const { Pool } = pg;

// Mirror the api-server default in lib/tenantHosts.ts (the playwright
// webServer config doesn't override WILDCARD_TENANT_BASE_HOSTS).
const WILDCARD_BASE = "lpstudio.ai";

interface DomainContext {
  mode: "tenant-locked" | "microsite-only" | "open" | "not-found";
  tenantId: number | null;
  tenantSlug: string | null;
  redirectToHost: string | null;
}

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture " +
        "can create a Royal-style tenant in the dev DB.",
    );
  }
  return url;
}

test.describe("Workspace slug redirect manager (task #153)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  // A second tenant on a different domain so the freed-slug reuse step
  // doesn't collide on tenants.domain="localhost".
  let otherTenant: RoyalTenant;
  // Captured slug history so afterAll can defensively drop any leftover
  // tenant_slug_redirects rows by old_slug.
  let originalSlug: string;
  let renamedSlug: string;
  // A non-admin session on `tenant` used to prove the 403 gate on the
  // redirect manager endpoints.
  let nonAdminSid: string;
  let nonAdminUserId: number;
  let nonAdminRoleId: number;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);

    tenant = await createRoyalTenant(pool);
    originalSlug = tenant.slug;

    otherTenant = await createRoyalTenant(pool, {
      domain: `slug-redirect-other-${Date.now().toString(36)}.test`,
    });

    // Seed a non-admin member on `tenant` with NO `settings` permission.
    // The redirect-manager routes gate on `isAdmin || permissions.settings`,
    // so this session must fail both checks to prove the 403 path.
    const suffix = randomBytes(3).toString("hex");
    const memberEmail = `royal-test-member-${suffix}@example.com`;
    const memberRoleRes = await pool.query<{ id: number }>(
      `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
       VALUES ($1, 'Test Member', $2::jsonb, false, false)
       RETURNING id`,
      [
        tenant.tenantId,
        JSON.stringify({
          pages: true,
          // Deliberately no `settings` permission.
        }),
      ],
    );
    nonAdminRoleId = memberRoleRes.rows[0].id;
    const memberUserRes = await pool.query<{ id: number }>(
      `INSERT INTO app_users (tenant_id, email, name, role, status)
       VALUES ($1, $2, $3, 'member', 'active')
       RETURNING id`,
      [tenant.tenantId, memberEmail, `Royal Test Member ${suffix}`],
    );
    nonAdminUserId = memberUserRes.rows[0].id;
    await pool.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       VALUES ($1, $2, $3, $4, now())`,
      [tenant.tenantId, nonAdminUserId, nonAdminRoleId, memberEmail],
    );
    nonAdminSid = randomBytes(24).toString("base64url");
    const expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
      [
        nonAdminSid,
        JSON.stringify({
          userId: nonAdminUserId,
          email: memberEmail,
          name: `Royal Test Member ${suffix}`,
          avatarUrl: null,
          tenantId: tenant.tenantId,
          role: "member",
          permissions: { pages: true },
          // Crucially false — without this the auth gate would let the
          // request through on the superadmin-bypass branch.
          isAdmin: false,
          micrositeDomain: null,
          appUserRole: "member",
        }),
        expire,
      ],
    );

    // Make freshly-inserted tenants visible to findTenantByHost without
    // waiting out the host cache TTL.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (!pool) return;
    try {
      const slugs = [originalSlug, renamedSlug].filter(Boolean);
      if (slugs.length) {
        await pool.query(
          `DELETE FROM tenant_slug_redirects WHERE old_slug = ANY($1::text[])`,
          [slugs],
        );
      }
      if (nonAdminSid) {
        await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [nonAdminSid]);
      }
      // tenant_members / tenant_roles cascade on tenant_id, but drop the
      // member user explicitly so cleanupRoyalTenant's tenant DELETE doesn't
      // trip on the FK from app_users.
      if (nonAdminUserId) {
        await pool.query(`DELETE FROM tenant_members WHERE user_id = $1`, [nonAdminUserId]);
        await pool.query(`DELETE FROM app_users WHERE id = $1`, [nonAdminUserId]);
      }
      if (otherTenant) await cleanupRoyalTenant(pool, otherTenant);
      if (tenant) await cleanupRoyalTenant(pool, tenant);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  test("admin sees active redirects, can release one, and the freed slug is reusable", async ({ request }) => {
    // Use unique target slugs so the domain-context route's per-host 5-min
    // in-memory cache (DOMAIN_CTX_TTL_MS) can't serve a stale entry from
    // an earlier run.
    const target = `redir-mgr-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
    renamedSlug = target;

    // ── 1. Rename the tenant so an old-slug redirect row gets created ────
    const renameRes = await request.patch("/api/admin/tenant-slug", {
      headers: {
        Cookie: `lp_sid=${tenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { slug: target },
    });
    expect(
      renameRes.ok(),
      `rename failed: ${renameRes.status()} ${await renameRes.text()}`,
    ).toBe(true);

    // ── 2. GET /tenant-slug/redirects must list the old slug ─────────────
    const listRes = await request.get("/api/admin/tenant-slug/redirects", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      listRes.ok(),
      `GET /tenant-slug/redirects failed: ${listRes.status()} ${await listRes.text()}`,
    ).toBe(true);
    const list = (await listRes.json()) as {
      currentSlug: string;
      baseHost: string | null;
      redirects: Array<{
        oldSlug: string;
        expiresAt: string;
        createdAt: string;
        oldHost: string | null;
      }>;
    };
    expect(list.currentSlug.toLowerCase()).toBe(target);
    expect(list.baseHost).toBe(WILDCARD_BASE);
    const row = list.redirects.find(r => r.oldSlug === originalSlug.toLowerCase());
    expect(
      row,
      `expected redirect row for old slug "${originalSlug}", got ${JSON.stringify(list.redirects)}`,
    ).toBeTruthy();
    expect(row!.oldHost).toBe(`${originalSlug.toLowerCase()}.${WILDCARD_BASE}`);
    expect(Date.parse(row!.expiresAt)).toBeGreaterThan(Date.now());

    // ── 3. Non-admin (no `settings` permission) gets 403 on GET ──────────
    const memberListRes = await request.get("/api/admin/tenant-slug/redirects", {
      headers: { Cookie: `lp_sid=${nonAdminSid}` },
    });
    expect(
      memberListRes.status(),
      `non-admin GET /tenant-slug/redirects must 403, got ${memberListRes.status()}`,
    ).toBe(403);

    // ── 4. Non-admin gets 403 on DELETE, and the row is still there ──────
    const memberDeleteRes = await request.delete(
      `/api/admin/tenant-slug/redirects/${encodeURIComponent(originalSlug.toLowerCase())}`,
      { headers: { Cookie: `lp_sid=${nonAdminSid}` } },
    );
    expect(
      memberDeleteRes.status(),
      `non-admin DELETE must 403, got ${memberDeleteRes.status()} ${await memberDeleteRes.text()}`,
    ).toBe(403);
    const stillThere = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM tenant_slug_redirects WHERE old_slug = $1`,
      [originalSlug.toLowerCase()],
    );
    expect(
      Number(stillThere.rows[0].count),
      "non-admin DELETE must NOT remove the redirect row",
    ).toBe(1);

    // ── 5. Admin DELETE removes the row ──────────────────────────────────
    const deleteRes = await request.delete(
      `/api/admin/tenant-slug/redirects/${encodeURIComponent(originalSlug.toLowerCase())}`,
      { headers: { Cookie: `lp_sid=${tenant.sessionSid}` } },
    );
    expect(
      deleteRes.ok(),
      `admin DELETE failed: ${deleteRes.status()} ${await deleteRes.text()}`,
    ).toBe(true);
    const deleteBody = (await deleteRes.json()) as { ok: boolean; oldSlug: string };
    expect(deleteBody.ok).toBe(true);
    expect(deleteBody.oldSlug).toBe(originalSlug.toLowerCase());

    // The DB row is actually gone.
    const gone = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM tenant_slug_redirects WHERE old_slug = $1`,
      [originalSlug.toLowerCase()],
    );
    expect(Number(gone.rows[0].count), "admin DELETE must remove the row").toBe(0);

    // The follow-up listing no longer mentions the released slug.
    const listAfterRes = await request.get("/api/admin/tenant-slug/redirects", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(listAfterRes.ok()).toBe(true);
    const listAfter = (await listAfterRes.json()) as {
      redirects: Array<{ oldSlug: string }>;
    };
    expect(
      listAfter.redirects.find(r => r.oldSlug === originalSlug.toLowerCase()),
      "released redirect must not appear in the follow-up listing",
    ).toBeUndefined();

    // ── 6. The freed slug is reusable by ANOTHER tenant ──────────────────
    // Cache the redirect deletion already calls invalidateTenantHostCache;
    // bounce the test endpoint too just in case the workers got out of sync.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    const otherAvailRes = await request.get(
      `/api/admin/tenant-slug/availability?slug=${encodeURIComponent(originalSlug)}`,
      { headers: { Cookie: `lp_sid=${otherTenant.sessionSid}` } },
    );
    expect(otherAvailRes.ok()).toBe(true);
    const otherAvail = (await otherAvailRes.json()) as { available: boolean };
    expect(
      otherAvail.available,
      "freed slug must be available to another tenant after release",
    ).toBe(true);

    const otherRenameRes = await request.patch("/api/admin/tenant-slug", {
      headers: {
        Cookie: `lp_sid=${otherTenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { slug: originalSlug },
    });
    expect(
      otherRenameRes.ok(),
      `another tenant must be able to claim the freed slug, got ${otherRenameRes.status()} ${await otherRenameRes.text()}`,
    ).toBe(true);

    // ── 7. findTenantByHost no longer resolves the old slug to the
    //      original tenant. We probe through /api/auth/domain-context,
    //      which calls findTenantByHost under the hood. The old wildcard
    //      host should now resolve to `otherTenant` (which just claimed
    //      the slug) rather than `tenant`. ──────────────────────────────
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
    const oldHost = `${originalSlug.toLowerCase()}.${WILDCARD_BASE}`;
    const oldCtxRes = await request.get(
      `/api/auth/domain-context?host=${encodeURIComponent(oldHost)}`,
    );
    expect(
      oldCtxRes.ok(),
      `domain-context for freed host failed: ${oldCtxRes.status()}`,
    ).toBe(true);
    const oldCtx = (await oldCtxRes.json()) as DomainContext;
    expect(
      oldCtx.tenantId,
      "old host must no longer resolve to the original tenant after release",
    ).not.toBe(tenant.tenantId);
    expect(
      oldCtx.tenantId,
      "old host must now resolve to the tenant that claimed the freed slug",
    ).toBe(otherTenant.tenantId);
    expect(
      oldCtx.redirectToHost,
      "the freshly-claimed slug is canonical for its new owner — no redirect signal",
    ).toBeNull();

    // Cleanup: rename otherTenant back to its original slug so afterAll's
    // cleanupRoyalTenant doesn't trip over a redirect row pointing at it.
    await request.patch("/api/admin/tenant-slug", {
      headers: {
        Cookie: `lp_sid=${otherTenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { slug: otherTenant.slug },
    });
    // Defensively drop any redirect rows owned by otherTenant.
    await pool.query(
      `DELETE FROM tenant_slug_redirects WHERE tenant_id = $1`,
      [otherTenant.tenantId],
    );
  });
});
