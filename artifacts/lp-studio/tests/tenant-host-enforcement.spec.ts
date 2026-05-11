/**
 * Task #189 — regression test for the ENT subdomain 403 outage.
 *
 * The production failure mode this spec locks down: when the host enforcement
 * branch in `artifacts/api-server/src/middleware/requireAuth.ts` only exempts
 * per-tenant admins (`tenant_roles.is_admin`) and forgets to also exempt
 * global Dandy operators (`app_users.role === 'superadmin'`), every request
 * a Dandy superadmin makes back to `ent.meetdandy.com` returns
 *   403 {"error":"Session does not belong to this domain's tenant"}
 * the moment they have used `/superadmin/switch-tenant` to point their
 * session at a non-Dandy tenant. ent.meetdandy.com IS the canonical Dandy
 * admin host, so this manifests as "every request to ENT is 403" for the
 * exact operators who need that host.
 *
 * The spec is intentionally written so it would have failed against the
 * pre-fix `if (!user.isAdmin)` branch, and passes against
 * `if (!user.isAdmin && !isSuperadmin)`. It also covers the signed-out
 * baseline (no 403 on the public endpoints used by the SPA bootstrap on
 * any tenant subdomain), and exercises the host header path that ENT and
 * every other custom-domain tenant funnel through.
 *
 * Endpoints exercised (SPA-bootstrap critical-path):
 *   - GET /api/healthz              (sanity)
 *   - GET /api/auth/csrf            (no-session, no-403)
 *   - GET /api/auth/me              (no-session, must be 401 not 403)
 *   - GET /api/auth/domain-context  (resolves tenant from Host header)
 *   - GET /api/lp/brand             (public, tenant resolved from Host)
 *   - GET /api/auth/me              (superadmin session pointed at a
 *                                    DIFFERENT tenant — the regression case)
 */
import { test, expect, request } from "@playwright/test";
import pg from "pg";
import { randomBytes } from "node:crypto";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const API_PORT = process.env.E2E_API_PORT ?? "4319";
const API_BASE = `http://127.0.0.1:${API_PORT}`;

let pool: pg.Pool;

// "ENT-style" tenant: a tenant whose canonical access path is a custom
// domain. We use a synthetic .local host so the test is hermetic — the
// api-server resolves tenants by host header against `tenants.domain`,
// which we control via the Royal fixture's `domain` option.
let entTenant: RoyalTenant;

// Second tenant — used to construct the cross-tenant superadmin session
// (the precondition for the production bug).
let otherTenant: RoyalTenant;

// Bare custom-host string handed to the api-server via the `Host` header.
// `findTenantByHost` lower-cases and strips ports, so casing here doesn't
// matter for resolution.
let entHost: string;

// Session for a Dandy superadmin whose `app_users.role = 'superadmin'`
// AND whose `session.tenantId` points at `otherTenant` (i.e. they last
// used Switch Tenant). This is the exact session shape that triggered
// the ENT 403 outage in production.
let crossTenantSuperadminSid: string;
let crossTenantSuperadminEmail: string;
let crossTenantSuperadminUserId: number;

test.beforeAll(async () => {
  const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "NEON_DATABASE_URL or DATABASE_URL is required for tenant-host-enforcement.spec.ts",
    );
  }
  pool = new pg.Pool({ connectionString: dbUrl });
  await purgeStaleRoyalTenants(pool);

  // Stand up two tenants. The "ent" one owns the custom domain we'll send
  // requests to; the "other" one is the tenant the superadmin's session
  // points at after Switch Tenant.
  const suffix = randomBytes(4).toString("hex");
  entHost = `ent-${suffix}.local`;
  entTenant = await createRoyalTenant(pool, {
    uniqueSuffix: `ent-${suffix}`,
    domain: entHost,
  });
  otherTenant = await createRoyalTenant(pool, {
    uniqueSuffix: `other-${suffix}`,
    domain: `other-${suffix}.local`,
  });

  // The api-server caches host→tenant lookups in-memory for 60s. The Royal
  // fixture writes directly to the DB, so we have to invalidate the cache
  // (the test-only endpoint at /api/_test/invalidate-host-cache) before
  // any host-routed request will see the new tenants.
  const invalidateCtx = await request.newContext({ baseURL: API_BASE });
  const invRes = await invalidateCtx.post("/api/_test/invalidate-host-cache");
  expect(
    invRes.status(),
    "test-only host cache invalidation endpoint must be available in dev",
  ).toBe(200);
  await invalidateCtx.dispose();

  // Build the cross-tenant superadmin session by hand — the Royal fixture
  // creates a per-tenant admin, but we need the session payload to look
  // like a superadmin whose Switch Tenant target is `otherTenant`.
  crossTenantSuperadminEmail = `superadmin-${suffix}@example.com`;
  const userRes = await pool.query<{ id: number }>(
    `INSERT INTO app_users (tenant_id, email, name, role, status)
     VALUES ($1, $2, $3, 'superadmin', 'active')
     RETURNING id`,
    [otherTenant.tenantId, crossTenantSuperadminEmail, `Superadmin ${suffix}`],
  );
  crossTenantSuperadminUserId = userRes.rows[0].id;

  crossTenantSuperadminSid = randomBytes(24).toString("base64url");
  // Crucial fields for the bug:
  //   - tenantId = otherTenant.tenantId   (NOT entTenant — Switch Tenant
  //                                        moved them off Dandy/ent)
  //   - isAdmin  = false                  (they're not a per-tenant admin
  //                                        of the other tenant either; this
  //                                        is the "viewer impersonation"
  //                                        shape Switch Tenant produces)
  //   - appUserRole = "superadmin"        (the global flag that the host
  //                                        check MUST honour)
  const sessPayload = {
    userId: crossTenantSuperadminUserId,
    email: crossTenantSuperadminEmail,
    name: `Superadmin ${suffix}`,
    avatarUrl: null,
    tenantId: otherTenant.tenantId,
    role: "viewer",
    permissions: {},
    isAdmin: false,
    micrositeDomain: null,
    appUserRole: "superadmin",
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
    [
      crossTenantSuperadminSid,
      JSON.stringify(sessPayload),
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    ],
  );
});

test.afterAll(async () => {
  if (crossTenantSuperadminSid) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [
      crossTenantSuperadminSid,
    ]).catch(() => undefined);
  }
  if (crossTenantSuperadminUserId) {
    await pool.query(`DELETE FROM app_users WHERE id = $1`, [
      crossTenantSuperadminUserId,
    ]).catch(() => undefined);
  }
  if (entTenant) await cleanupRoyalTenant(pool, entTenant).catch(() => undefined);
  if (otherTenant) await cleanupRoyalTenant(pool, otherTenant).catch(() => undefined);
  await pool.end();
});

/**
 * The signed-out SPA bootstrap path. None of these may return 403 against
 * a tenant custom domain — that would mean the SPA never even loads its
 * auth state. (`/api/auth/me` legitimately returns 401 here; that is the
 * "you are signed out" answer, not the host-enforcement 403.)
 */
test("signed-out requests to a tenant custom domain are never 403", async () => {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { host: entHost },
  });

  for (const path of [
    "/api/healthz",
    "/api/auth/csrf",
    "/api/auth/me",
    `/api/auth/domain-context?host=${encodeURIComponent(entHost)}`,
    "/api/lp/brand",
  ]) {
    const res = await ctx.get(path);
    expect(
      res.status(),
      `signed-out GET ${path} on ${entHost} must not 403 (got ${res.status()})`,
    ).not.toBe(403);
  }

  // domain-context must also resolve the host to the right tenant — if it
  // didn't, the SPA would render the wrong "create workspace vs invite-only"
  // branch and the user would see a misleading screen even on a 200.
  const dctxRes = await ctx.get(
    `/api/auth/domain-context?host=${encodeURIComponent(entHost)}`,
  );
  expect(dctxRes.status()).toBe(200);
  const dctx = await dctxRes.json();
  expect(dctx.tenantId).toBe(entTenant.tenantId);
  expect(dctx.mode).toBe("tenant-locked");

  await ctx.dispose();
});

/**
 * The per-tenant admin session (the Royal fixture's default shape). Sending
 * it to its OWN tenant's host must succeed — this is the baseline that the
 * host-check is supposed to allow.
 */
test("a tenant admin session reaches its own tenant's custom domain", async () => {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: {
      host: entHost,
      cookie: `lp_sid=${entTenant.sessionSid}`,
    },
  });
  const res = await ctx.get("/api/auth/me");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.email).toBe(entTenant.email);
  expect(body.tenantId).toBe(entTenant.tenantId);
  await ctx.dispose();
});

/**
 * The exact production failure mode for task #189.
 *
 * A Dandy superadmin (`app_users.role = 'superadmin'`) whose session was
 * moved to `otherTenant` via `/superadmin/switch-tenant` navigates back to
 * the canonical Dandy admin host (`entHost`). Pre-fix, the host enforcement
 * branch only exempted per-tenant admins, so this returned
 *   403 "Session does not belong to this domain's tenant"
 * on every request. Post-fix, superadmins are exempt and the request lands
 * normally.
 *
 * If this assertion ever flips back to 403, the ENT outage has regressed.
 */
test("a Dandy superadmin session reaches the canonical Dandy host even after Switch Tenant moved them off it", async () => {
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: {
      host: entHost,
      cookie: `lp_sid=${crossTenantSuperadminSid}`,
    },
  });

  for (const path of [
    "/api/auth/me",
    `/api/auth/domain-context?host=${encodeURIComponent(entHost)}`,
    "/api/lp/brand",
  ]) {
    const res = await ctx.get(path);
    expect(
      res.status(),
      `superadmin GET ${path} on ${entHost} must not 403 — that is the task #189 regression (got ${res.status()})`,
    ).not.toBe(403);
  }

  // /api/auth/me should reflect the superadmin's actual (switched) session
  // payload — proving the request reached the route handler instead of being
  // short-circuited at host enforcement.
  const meRes = await ctx.get("/api/auth/me");
  expect(meRes.status()).toBe(200);
  const me = await meRes.json();
  expect(me.email).toBe(crossTenantSuperadminEmail);
  expect(me.tenantId).toBe(otherTenant.tenantId);

  await ctx.dispose();
});
