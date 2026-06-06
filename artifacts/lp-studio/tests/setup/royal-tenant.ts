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
 * THE INVARIANT (read before adding a new tenant-scoped table):
 *
 * Every table that holds a foreign key to `tenants` must have its rows cleared
 * before `DELETE FROM tenants` runs, or the delete raises a 23503 and a single
 * leftover row from a crashed spec poisons EVERY later spec's setup (the
 * shared-Neon `purgeStaleRoyalTenants` beforeAll deletes ALL royal-test
 * tenants, so one orphan cascades into a whole-suite failure).
 *
 * Historically this list was maintained BY HAND in two separate routines
 * (`cleanupRoyalTenant` + `purgeStaleRoyalTenants`), and it broke repeatedly
 * whenever a new child table (sales_*, lp_forms, lp_library_items,
 * lp_integrations, …) was added but only wired into one of them. To stop that
 * from recurring, teardown now DISCOVERS the set of tenant-referencing tables
 * from the Postgres catalog at runtime — so a newly added table is covered
 * automatically with zero edits here.
 *
 * Ordering: some tenant-scoped tables reference each OTHER via ON DELETE NO
 * ACTION FKs (e.g. sales_email_campaigns.template_id -> sales_email_templates),
 * so a naive single pass can 23503. `deleteTenantReferencingRows` retries
 * blocked tables until their blocker is gone (see below). Children that are NOT
 * tenant-scoped are handled implicitly: a catalog audit confirms every FK from
 * a non-tenant-scoped table into a tenant-scoped one is ON DELETE CASCADE or
 * SET NULL, so deleting the tenant-scoped parents clears them. If that ever
 * stops being true, `deleteTenantReferencingRows` throws a descriptive error
 * instead of silently leaving an orphan.
 */
let cachedTenantTables: { table: string; column: string }[] | null = null;

async function discoverTenantReferencingTables(
  client: pg.PoolClient,
): Promise<{ table: string; column: string }[]> {
  if (cachedTenantTables) return cachedTenantTables;
  // All tables with a single-column FK referencing `tenants` (excluding tenants
  // itself). `conkey[1]` is the local FK column; `confrelid` is the referenced
  // relation. `conrelid::regclass::text` yields a ready-to-use (schema-qualified
  // when needed) identifier.
  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    `SELECT con.conrelid::regclass::text AS table_name, att.attname AS column_name
       FROM pg_constraint con
       JOIN pg_attribute att
         ON att.attrelid = con.conrelid
        AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'tenants'::regclass
        AND con.conrelid <> 'tenants'::regclass
        AND array_length(con.conkey, 1) = 1
      ORDER BY table_name`,
  );
  cachedTenantTables = rows.map((r) => ({ table: r.table_name, column: r.column_name }));
  return cachedTenantTables;
}

/**
 * Generically clear every row referencing `tenantId` from every table that
 * holds a tenant FK, so `DELETE FROM tenants` can't 23503. Must run inside a
 * transaction (it uses SAVEPOINTs). Retries tables blocked by an intra-table
 * NO ACTION FK from another tenant-scoped table until the blocker is gone;
 * CASCADE / SET NULL children disappear when their parent row does.
 */
async function deleteTenantReferencingRows(
  client: pg.PoolClient,
  tenantId: number,
): Promise<void> {
  const tables = await discoverTenantReferencingTables(client);
  let remaining = [...tables];
  while (remaining.length) {
    const blocked: typeof remaining = [];
    let madeProgress = false;
    for (const t of remaining) {
      await client.query("SAVEPOINT del_sp");
      try {
        await client.query(`DELETE FROM ${t.table} WHERE "${t.column}" = $1`, [tenantId]);
        await client.query("RELEASE SAVEPOINT del_sp");
        madeProgress = true;
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT del_sp");
        if ((err as { code?: string }).code === "23503") {
          blocked.push(t);
        } else {
          throw err;
        }
      }
    }
    if (blocked.length && !madeProgress) {
      throw new Error(
        `royal-tenant teardown: could not delete tenant-referencing rows for tenant ${tenantId}; ` +
          `tables still blocked by a foreign key: ${blocked.map((b) => b.table).join(", ")}. ` +
          `This means a child table references one of these via an ON DELETE NO ACTION FK that is ` +
          `NOT tenant-scoped (so it can't be auto-discovered). Give that FK ON DELETE CASCADE/SET ` +
          `NULL, or delete its rows explicitly before calling deleteTenantReferencingRows.`,
      );
    }
    remaining = blocked;
  }
}

export async function cleanupRoyalTenant(pool: pg.Pool, t: RoyalTenant): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // app_sessions has no tenant FK (keyed by sid), so it's cleared explicitly.
    await client.query(`DELETE FROM app_sessions WHERE sid = $1`, [t.sessionSid]);
    // Everything else with a tenant FK (lp_pages, lp_brand_settings,
    // lp_library_items, lp_integrations, sales_*, app_users, tenant_members,
    // tenant_roles, …) is discovered + cleared generically.
    await deleteTenantReferencingRows(client, t.tenantId);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [t.tenantId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
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
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM tenants WHERE slug LIKE 'royal-test-%'`,
    );
    for (const row of rows) {
      await client.query("BEGIN");
      try {
        // Discover + clear every tenant-referencing table generically (see the
        // INVARIANT comment above deleteTenantReferencingRows). A newly added
        // child table is covered automatically — no manual edit needed here.
        await deleteTenantReferencingRows(client, row.id);
        await client.query(`DELETE FROM tenants WHERE id = $1`, [row.id]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
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
