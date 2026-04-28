// Helpers for the page-review workflow spec (task #108).
//
// Seeds a single tenant that contains four distinct users so the spec can
// exercise the full role matrix in one test run:
//   - admin           → tenant_roles.is_admin (publisher + reviewer)
//   - contentManager  → custom role with pages + pages.publish + pages.review
//   - editor          → custom role with `pages` only (no publish, no review)
//   - superadmin      → app_users.role = 'superadmin' (cross-tenant publisher)
//
// Each user has its own server-side session (sid) and matching app_users row;
// the spec attaches them per-request via the lp_sid cookie.

import pg from "pg";
import { randomBytes } from "node:crypto";

export interface ReviewWorkflowUser {
  userId: number;
  email: string;
  sessionSid: string;
}

export interface ReviewWorkflowTenant {
  tenantId: number;
  domain: string;
  slug: string;
  /** Test admin (is_admin=true). Has every permission. */
  admin: ReviewWorkflowUser;
  /** Custom role: pages + pages.publish + pages.review (Content Manager). */
  contentManager: ReviewWorkflowUser;
  /** Custom role: pages only — cannot publish or review. */
  editor: ReviewWorkflowUser;
  /** app_users.role='superadmin' — gates on the per-user role, not the tenant. */
  superadmin: ReviewWorkflowUser;
}

const ADMIN_PERMS: Record<string, boolean> = {
  pages: true, "pages.publish": true, "pages.review": true,
  tests: true, analytics: true, forms_leads: true, brand: true, blocks: true,
  settings: true, team: true, roles: true,
};

const CONTENT_MANAGER_PERMS: Record<string, boolean> = {
  pages: true,
  "pages.publish": true,
  "pages.review": true,
};

const EDITOR_PERMS: Record<string, boolean> = {
  pages: true,
};

async function insertUserWithSession(
  client: pg.PoolClient,
  tenantId: number,
  roleId: number,
  perms: Record<string, boolean>,
  opts: { email: string; name: string; isAdmin: boolean; userRole: "admin" | "user" | "superadmin" },
): Promise<ReviewWorkflowUser> {
  const userRes = await client.query<{ id: number }>(
    `INSERT INTO app_users (tenant_id, email, name, role, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id`,
    [tenantId, opts.email, opts.name, opts.userRole],
  );
  const userId = userRes.rows[0].id;
  await client.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
     VALUES ($1, $2, $3, $4, now())`,
    [tenantId, userId, roleId, opts.email],
  );
  const sessionSid = randomBytes(24).toString("base64url");
  const payload = {
    userId, email: opts.email, name: opts.name, avatarUrl: null,
    tenantId, role: opts.userRole, permissions: perms, isAdmin: opts.isAdmin,
    micrositeDomain: null,
    // Mirror the production session shape so getTenantId can honour the
    // X-Tenant-Id cross-tenant override for Dandy operators (task #108).
    appUserRole: opts.userRole,
  };
  await client.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
    [sessionSid, JSON.stringify(payload), new Date(Date.now() + 24 * 60 * 60 * 1000)],
  );
  return { userId, email: opts.email, sessionSid };
}

export interface CreateReviewWorkflowTenantOptions {
  uniqueSuffix?: string;
  domain?: string;
}

export async function createReviewWorkflowTenant(
  pool: pg.Pool,
  opts: CreateReviewWorkflowTenantOptions = {},
): Promise<ReviewWorkflowTenant> {
  const suffix = opts.uniqueSuffix ?? `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const slug = `review-test-${suffix}`;
  const domain = opts.domain ?? "localhost";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tenantRes = await client.query<{ id: number }>(
      `INSERT INTO tenants (name, slug, domain, plan, status, settings, onboarding_completed_at)
       VALUES ($1, $2, $3, 'trial', 'active', '{"industry":"generic"}'::jsonb, now())
       RETURNING id`,
      [`Review Workflow Tenant ${suffix}`, slug, domain],
    );
    const tenantId = tenantRes.rows[0].id;

    const adminRoleRes = await client.query<{ id: number }>(
      `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
       VALUES ($1, 'Test Admin', $2::jsonb, true, false)
       RETURNING id`,
      [tenantId, JSON.stringify(ADMIN_PERMS)],
    );
    const adminRoleId = adminRoleRes.rows[0].id;

    const cmRoleRes = await client.query<{ id: number }>(
      `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
       VALUES ($1, 'Content Manager', $2::jsonb, false, true)
       RETURNING id`,
      [tenantId, JSON.stringify(CONTENT_MANAGER_PERMS)],
    );
    const cmRoleId = cmRoleRes.rows[0].id;

    const editorRoleRes = await client.query<{ id: number }>(
      `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
       VALUES ($1, 'Test Editor', $2::jsonb, false, false)
       RETURNING id`,
      [tenantId, JSON.stringify(EDITOR_PERMS)],
    );
    const editorRoleId = editorRoleRes.rows[0].id;

    const admin = await insertUserWithSession(client, tenantId, adminRoleId, ADMIN_PERMS, {
      email: `review-admin-${suffix}@example.com`,
      name: `Review Admin ${suffix}`,
      isAdmin: true,
      userRole: "admin",
    });

    const contentManager = await insertUserWithSession(client, tenantId, cmRoleId, CONTENT_MANAGER_PERMS, {
      email: `review-cm-${suffix}@example.com`,
      name: `Review CM ${suffix}`,
      isAdmin: false,
      userRole: "user",
    });

    const editor = await insertUserWithSession(client, tenantId, editorRoleId, EDITOR_PERMS, {
      email: `review-editor-${suffix}@example.com`,
      name: `Review Editor ${suffix}`,
      isAdmin: false,
      userRole: "user",
    });

    // Superadmin: lives in this tenant only for session attachment, but the
    // server-side perm check (userCanPublish / userCanReview) keys off
    // app_users.role = 'superadmin' independent of tenant_roles.permissions.
    const superadmin = await insertUserWithSession(client, tenantId, editorRoleId, EDITOR_PERMS, {
      email: `review-super-${suffix}@example.com`,
      name: `Review Super ${suffix}`,
      isAdmin: false,
      userRole: "superadmin",
    });

    await client.query(
      `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, '{}'::jsonb)`,
      [tenantId],
    );

    // Seed an enabled Asana integration so submit-review / approve / reject
    // exercise the createReviewTask + commentAndCompleteTask paths in fake
    // mode. The api-server's webServer config sets ASANA_FAKE_MODE=1, so the
    // PAT/projectId values here are dummies that never leave the process.
    await client.query(
      `INSERT INTO lp_integrations (tenant_id, provider, config, enabled, updated_at)
       VALUES ($1, 'asana', $2::jsonb, true, now())`,
      [tenantId, JSON.stringify({ pat: "fake-pat", projectId: `fake-project-${tenantId}` })],
    );

    await client.query("COMMIT");
    return { tenantId, domain, slug, admin, contentManager, editor, superadmin };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function cleanupReviewWorkflowTenant(
  pool: pg.Pool,
  t: ReviewWorkflowTenant,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `DELETE FROM app_sessions WHERE sid = ANY($1::text[])`,
      [[t.admin.sessionSid, t.contentManager.sessionSid, t.editor.sessionSid, t.superadmin.sessionSid]],
    );
    await client.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM app_users WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [t.tenantId]);
  } finally {
    client.release();
  }
}

export async function purgeStaleReviewWorkflowTenants(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM tenants WHERE slug LIKE 'review-test-%'`,
    );
    for (const row of rows) {
      await client.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM app_users WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM tenants WHERE id = $1`, [row.id]);
    }
    await client.query(
      `DELETE FROM app_sessions
        WHERE sess::jsonb ->> 'email' LIKE 'review-%@example.com'`,
    );
  } finally {
    client.release();
  }
}
