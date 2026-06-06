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
  /**
   * Raw value written to `tenants.plan`. Defaults to canonical "growth" so
   * existing specs keep the same behaviour (the legacy "trial" alias that
   * used to be the default also normalized to "growth", but "trial" is no
   * longer a storable value — the tenants_plan_canonical_check constraint
   * rejects it). Pass "starter" to exercise the plan-tier gate; "enterprise"
   * to opt into enterprise explicitly. Must be one of the canonical tiers:
   * free | starter | growth | scale | enterprise.
   */
  plan?: string;
  /**
   * Value written to `app_users.role` AND the session payload's
   * `appUserRole`. Defaults to "admin" (a normal tenant admin). Pass
   * "superadmin" to test the Dandy-operator bypass paths in
   * `requirePlanFeature`, AppShell's /sales redirect, and the mode
   * toggle's plan check.
   */
  appUserRole?: string;
  /**
   * Optional `brandName` written into the tenant's `lp_brand_settings.config`.
   * The one-pager client UI gates the two Dandy-coded built-ins
   * (comparison / agreement-summary) purely on
   * `brand.brandName.toLowerCase() === "dandy"` — NOT on the tenant slug — so
   * passing `brandName: "Dandy"` yields a fixture that the picker UI treats as
   * a Dandy workspace (the gated built-ins appear, PDF generation is enabled)
   * WITHOUT needing the reserved "dandy"/"dandy-smb" slug. The server
   * publish/save gate is slug-based instead (see `createDandyOperatorSession`).
   * Omitted by default → neutral, non-Dandy brand.
   */
  brandName?: string;
  /**
   * Optional value written to `tenants.trial_expires_at`. The trial-lifecycle
   * sweep (notifyTrialLifecycle) only matches active tenants on the `free`
   * plan whose trial expires inside a milestone's 1-day window, so the trial
   * nudge spec passes a Date a few days out together with `plan: "free"` to
   * land the tenant in the day-7 / day-11 / day-13 window. Omitted by default
   * (NULL) → never matched by the sweep, matching every pre-trial account.
   */
  trialExpiresAt?: Date;
}

export async function createRoyalTenant(
  pool: pg.Pool,
  opts: CreateRoyalTenantOptions = {},
): Promise<RoyalTenant> {
  const suffix = opts.uniqueSuffix ?? `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const slug = `royal-test-${suffix}`;
  const email = `royal-test-${suffix}@example.com`;
  const domain = opts.domain ?? "localhost";
  const plan = opts.plan ?? "growth";
  const appUserRole = opts.appUserRole ?? "admin";
  const trialExpiresAt = opts.trialExpiresAt ?? null;
  const sessionSid = randomBytes(24).toString("base64url");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Generic-industry tenant. The host check in requireAuth + the public
    // viewer slug lookup in /lp/page/:slug both resolve via tenants.domain.
    // `onboarding_completed_at` is set so AuthGate doesn't redirect the test
    // session into the new-tenant brand-setup wizard (see AuthGate.tsx).
    const tenantRes = await client.query<{ id: number }>(
      `INSERT INTO tenants (name, slug, domain, plan, status, settings, onboarding_completed_at, trial_expires_at)
       VALUES ($1, $2, $3, $4, 'active', '{"industry":"generic"}'::jsonb, now(), $5)
       RETURNING id`,
      [`Royal Test Tenant ${suffix}`, slug, domain, plan, trialExpiresAt],
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
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [tenantId, email, `Royal Test User ${suffix}`, appUserRole],
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
       VALUES ($1, $2, $3, $4, now())`,
      [tenantId, userId, roleId, email],
    );

    // The one-pager picker UI keys "is this a Dandy workspace?" off
    // `brand.brandName`, so merge in the caller's brandName when supplied.
    const brandConfig = opts.brandName
      ? { ...NEUTRAL_BRAND_CONFIG, brandName: opts.brandName }
      : NEUTRAL_BRAND_CONFIG;
    const brandRes = await client.query<{ id: number }>(
      `INSERT INTO lp_brand_settings (tenant_id, config)
       VALUES ($1, $2::jsonb)
       RETURNING id`,
      [tenantId, JSON.stringify(brandConfig)],
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
      // Global app_users.role surfaced to middleware that needs to
      // bypass per-tenant gates for Dandy operators (e.g.
      // requirePlanFeature, AppShell's /sales redirect, mode toggle).
      appUserRole,
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

/**
 * Delete the tenant-scoped sales rows that hold a NON-cascade (NO ACTION)
 * `tenant_id` foreign key on `tenants`, so the subsequent `DELETE FROM tenants`
 * can't raise a 23503. Sales Console specs (sales-delete-controls,
 * sales-console-*) insert into sales_accounts / sales_contacts / sales_signals
 * etc. under a royal-test tenant; those FKs are `ON DELETE NO ACTION`, so a
 * leftover sales row blocks the tenant delete and poisons every subsequent
 * spec's `purgeStaleRoyalTenants` beforeAll (which deletes ALL royal-test
 * tenants) — turning one orphan into a whole-suite cascade.
 *
 * Order matters because of intra-sales FKs:
 *   - sales_email_campaigns.template_id -> sales_email_templates is NO ACTION,
 *     so campaigns must go before templates.
 *   - sales_email_campaigns.account_id -> sales_accounts is SET NULL, so
 *     deleting accounts does NOT remove campaigns — delete them explicitly.
 *   - sales_accounts CASCADEs to sales_contacts / sales_briefings /
 *     sales_signals, and sales_contacts CASCADEs to sales_email_sends /
 *     sales_contact_briefings; the trailing explicit deletes mop up any
 *     account-less rows. sales_hotlinks / sales_briefings cascade on tenant_id.
 */
async function deleteTenantSalesRows(client: pg.PoolClient, tenantId: number): Promise<void> {
  await client.query(`DELETE FROM sales_email_campaigns WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM sales_email_templates WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM sales_audiences WHERE tenant_id = $1`, [tenantId]);
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
    // lp_integrations.tenant_id holds a NO ACTION FK on tenants (no ON DELETE
    // clause — see migration 0071); a leftover integration row blocks the
    // tenant DELETE below, so clear it first.
    await client.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [t.tenantId]);
    // Sales rows carry a NO ACTION tenant_id FK; clear them before the tenant.
    await deleteTenantSalesRows(client, t.tenantId);
    await client.query(`DELETE FROM app_users WHERE id = $1`, [t.userId]);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [t.tenantId]);
  } finally {
    client.release();
  }
}

export interface DandyOperatorSession {
  /** lp_sid cookie value for the impersonation session. */
  sid: string;
  /** id of the seeded Dandy tenant this session acts as. */
  tenantId: number;
  /** "dandy-smb" (preferred) or "dandy". */
  slug: string;
}

/**
 * Create a short-lived admin session that impersonates a *seeded* Dandy
 * workspace ("dandy-smb" preferred, "dandy" as a fallback) so tests can
 * exercise the server-side, slug-based Dandy gate on the one-pager
 * publish/save routes.
 *
 * We can't create a NEW Dandy tenant: the gate keys off the reserved
 * "dandy"/"dandy-smb" slug, which already exists in the database (the seeded
 * Dandy workspaces) and is unique. So instead we mint an app_sessions row
 * whose payload points at the existing tenant. The session payload sets
 * `isAdmin: true` (exempting it from the per-host tenant check in requireAuth)
 * and `appUserRole: "admin"` (so requireAuth never backfills via app_users —
 * the synthetic userId is therefore never dereferenced). Only the session row
 * is created against the real tenant; callers MUST delete any rows they then
 * write through the gated routes (see `cleanupDandyOnePagerRows`) so the real
 * Dandy workspace is left untouched.
 */
export async function createDandyOperatorSession(pool: pg.Pool): Promise<DandyOperatorSession> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM tenants
        WHERE slug IN ('dandy-smb', 'dandy')
        ORDER BY (slug = 'dandy-smb') DESC
        LIMIT 1`,
    );
    if (!rows.length) {
      throw new Error(
        "No seeded Dandy tenant (dandy / dandy-smb) found — the Dandy positive-path gate test can't run",
      );
    }
    const { id: tenantId, slug } = rows[0];

    // Best-effort real user id for the tenant. Not required by the gated
    // routes (they only read tenantId + permissions), but it keeps the
    // session payload realistic and avoids a synthetic id.
    const u = await client.query<{ id: number }>(
      `SELECT id FROM app_users WHERE tenant_id = $1 ORDER BY id LIMIT 1`,
      [tenantId],
    );
    const userId = u.rows[0]?.id ?? 0;

    const sessionSid = randomBytes(24).toString("base64url");
    const authUserPayload = {
      userId,
      email: "e2e-dandy-gate-probe@example.com",
      name: "E2E Dandy Gate Probe",
      avatarUrl: null,
      tenantId,
      role: "admin",
      permissions: FULL_PERMISSIONS,
      isAdmin: true,
      appUserRole: "admin",
      micrositeDomain: null,
    };
    const expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
      [sessionSid, JSON.stringify(authUserPayload), expire],
    );
    return { sid: sessionSid, tenantId, slug };
  } finally {
    client.release();
  }
}

/** Drop the impersonation session row. */
export async function cleanupDandyOperatorSession(
  pool: pg.Pool,
  s: DandyOperatorSession,
): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [s.sid]);
}

/**
 * Delete one-pager rows written to a real Dandy tenant by the gated
 * publish/save routes during the positive-path test. `templateIds` are
 * `sales_one_pager_templates.id`s, `pageIds` are `lp_pages.id`s. Safe to call
 * with empty arrays. Never touches rows the test didn't create (deletes are
 * scoped by explicit id AND tenant_id).
 */
export async function cleanupDandyOnePagerRows(
  pool: pg.Pool,
  tenantId: number,
  ids: { templateIds?: number[]; pageIds?: number[] },
): Promise<void> {
  const client = await pool.connect();
  try {
    for (const id of ids.templateIds ?? []) {
      await client.query(
        `DELETE FROM sales_one_pager_templates WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
    }
    for (const id of ids.pageIds ?? []) {
      await client.query(
        `DELETE FROM lp_pages WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
    }
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
      // lp_integrations.tenant_id has a NO ACTION FK on tenants (migration 0071,
      // no ON DELETE clause) — a leftover integration row from a crashed
      // integration spec holds the FK and 23503s the tenant DELETE below.
      await client.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [row.id]);
      // Sales rows carry a NO ACTION tenant_id FK on tenants — a leftover
      // sales_account from a crashed/failed Sales Console spec holds the FK and
      // blocks the tenant DELETE below, cascading a 23503 into every later
      // spec's beforeAll. Clear them before the tenant row itself.
      await deleteTenantSalesRows(client, row.id);
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
