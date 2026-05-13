// Helper that seeds (and tears down) a generic-industry "Royal-style" tenant
// in the dev database for the no-Dandy-leak end-to-end check. The Playwright
// spec uses this fixture to exercise the live builder + viewer paths as a
// non-Dandy tenant, complete with a real session cookie + neutral brand
// settings, instead of the in-process generic-catalog fixture page.

import pg from "pg";
import { randomBytes } from "node:crypto";

export interface RoyalTenant {
  tenantId: number;
  userId: number;
  roleId: number;
  brandSettingsId: number;
  sessionSid: string;
  email: string;
  slug: string;
  /** Host that the api-server should resolve to this tenant. */
  domain: string;
}

// Neutral brand_settings — explicitly free of any Dandy-flavoured copy, URL,
// logo, or signature colour. The spec asserts these never appear in the
// rendered builder / viewer surface.
const NEUTRAL_BRAND_CONFIG = {
  primaryColor: "#1f4d8b",
  accentColor: "#5c8de0",
  textColor: "#0f172a",
  pageBackground: "#ffffff",
  cardBackground: "#f8fafc",
  navBgColor: "#ffffff",
  navText: "#0f172a",
  borderColor: "#e2e8f0",
  ctaBackground: "#1f4d8b",
  ctaText: "#ffffff",
  copyrightName: "Royal Test Co",
  navCtaText: "Get Started",
  navCtaUrl: "https://example.com/contact",
  defaultCtaText: "Get Started",
  defaultCtaUrl: "https://example.com/contact",
  socialUrls: { facebook: "", instagram: "", linkedin: "" },
} as const;

// Permissions snapshot mirroring routes/auth.ts at session-write time. The
// test session impersonates a tenant admin with full permissions so it can
// hit POST/PUT /api/lp/pages and read /api/block-catalog without 403s.
const FULL_PERMISSIONS: Record<string, boolean> = {
  pages: true,
  tests: true,
  analytics: true,
  forms_leads: true,
  brand: true,
  blocks: true,
  sales_dashboard: true,
  sales_contacts: true,
  sales_accounts: true,
  sales_outreach: true,
  sales_signals: true,
  sales_campaigns: true,
  settings: true,
  team: true,
  roles: true,
};

export interface CreateRoyalTenantOptions {
  /** Used so concurrent runs (or leftover crashes) never collide on the slug. */
  uniqueSuffix?: string;
  /**
   * Host the api-server must resolve to this tenant. The Vite dev-server proxy
   * forwards `/api/*` requests with `changeOrigin: true`, so the api-server
   * sees `Host: localhost:<API_PORT>` regardless of the browser URL — that's
   * why we register the tenant against `localhost` by default.
   */
  domain?: string;
}

export async function createRoyalTenant(
  pool: pg.Pool,
  opts: CreateRoyalTenantOptions = {},
): Promise<RoyalTenant> {
  const suffix = opts.uniqueSuffix ?? `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const slug = `royal-test-${suffix}`;
  const email = `royal-test-${suffix}@example.com`;
  const domain = opts.domain ?? "localhost";
  const sessionSid = randomBytes(24).toString("base64url");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Generic-industry tenant. The host check in requireAuth + the public
    // viewer slug lookup in /lp/page/:slug both resolve via tenants.domain.
    // `onboarding_completed_at` is set so AuthGate doesn't redirect the test
    // session into the new-tenant brand-setup wizard (see AuthGate.tsx).
    const tenantRes = await client.query<{ id: number }>(
      `INSERT INTO tenants (name, slug, domain, plan, status, settings, onboarding_completed_at)
       VALUES ($1, $2, $3, 'trial', 'active', '{"industry":"generic"}'::jsonb, now())
       RETURNING id`,
      [`Royal Test Tenant ${suffix}`, slug, domain],
    );
    const tenantId = tenantRes.rows[0].id;

    // Tenant-admin role. is_admin=true exempts the test session from the
    // requireAuth host check (see requireAuth.ts), but we still register
    // tenants.domain so the public viewer path can resolve the tenant by host.
    const roleRes = await client.query<{ id: number }>(
      `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
       VALUES ($1, 'Test Admin', $2::jsonb, true, false)
       RETURNING id`,
      [tenantId, JSON.stringify(FULL_PERMISSIONS)],
    );
    const roleId = roleRes.rows[0].id;

    const userRes = await client.query<{ id: number }>(
      `INSERT INTO app_users (tenant_id, email, name, role, status)
       VALUES ($1, $2, $3, 'admin', 'active')
       RETURNING id`,
      [tenantId, email, `Royal Test User ${suffix}`],
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       VALUES ($1, $2, $3, $4, now())`,
      [tenantId, userId, roleId, email],
    );

    const brandRes = await client.query<{ id: number }>(
      `INSERT INTO lp_brand_settings (tenant_id, config)
       VALUES ($1, $2::jsonb)
       RETURNING id`,
      [tenantId, JSON.stringify(NEUTRAL_BRAND_CONFIG)],
    );
    const brandSettingsId = brandRes.rows[0].id;

    // Server-side session — the lp_sid cookie value is just the sid, the
    // payload is a JSON-encoded AuthUser (see middleware/requireAuth.ts).
    const authUserPayload = {
      userId,
      email,
      name: `Royal Test User ${suffix}`,
      avatarUrl: null,
      tenantId,
      role: "admin",
      permissions: FULL_PERMISSIONS,
      // isAdmin here mirrors `tenant_roles.is_admin` (tenant-admin), which
      // requireAuth uses to exempt this session from the per-host tenant
      // enforcement check. It is NOT the global superadmin flag.
      isAdmin: true,
      micrositeDomain: null,
    };
    const expire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    await client.query(
      `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
      [sessionSid, JSON.stringify(authUserPayload), expire],
    );

    await client.query("COMMIT");
    return { tenantId, userId, roleId, brandSettingsId, sessionSid, email, slug, domain };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function cleanupRoyalTenant(pool: pg.Pool, t: RoyalTenant): Promise<void> {
  const client = await pool.connect();
  try {
    // Delete in dependency order. tenant_members and tenant_roles cascade on
    // tenant_id, but we still drop pages / brand / users / session explicitly.
    await client.query(`DELETE FROM app_sessions WHERE sid = $1`, [t.sessionSid]);
    await client.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM app_users WHERE id = $1`, [t.userId]);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [t.tenantId]);
  } finally {
    client.release();
  }
}

/**
 * Idempotent cleanup of leftover Royal-style test tenants. Used in beforeAll
 * so a previous run that crashed mid-test doesn't poison the next run with
 * orphan rows squatting on `tenants.domain = 'localhost'`.
 */
export async function purgeStaleRoyalTenants(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: number; email: string | null }>(
      `SELECT t.id, u.email
         FROM tenants t
         LEFT JOIN app_users u ON u.tenant_id = t.id
        WHERE t.slug LIKE 'royal-test-%'`,
    );
    for (const row of rows) {
      await client.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [row.id]);
      // lp_library_items.tenant_id has a FK on tenants — leftover rows from a
      // crashed run hold the FK and block the tenant DELETE below, which
      // poisons every subsequent test run until cleaned by hand.
      await client.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [row.id]);
      // lp_forms.tenant_id has a FK on tenants — must be cleared before the
      // tenant row itself, otherwise DELETE FROM tenants raises a 23503 and
      // poisons every subsequent test in the same run.
      await client.query(`DELETE FROM lp_forms WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM app_users WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM tenants WHERE id = $1`, [row.id]);
    }
    // Sessions for the deleted users are orphaned; the JSON sid lookup in
    // requireAuth fails closed for any tenant that no longer exists, so this
    // is harmless. Still, drop sessions whose payload references those users
    // by email.
    await client.query(
      `DELETE FROM app_sessions
        WHERE sess::jsonb ->> 'email' LIKE 'royal-test-%@example.com'`,
    );
  } finally {
    client.release();
  }
}
