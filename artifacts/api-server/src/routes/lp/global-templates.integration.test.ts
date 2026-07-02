/**
 * Integration test for the homepage "feature a global template" path (Task #987).
 *
 * The marketing homepage's featured-templates picker accepts two id kinds:
 *   - a built-in flagship slug (bundled client-side), and
 *   - a `global:<id>` DB-backed GLOBAL template (is_global=true AND
 *     is_template=true), surfaced server-side.
 *
 * The global path spans two server surfaces, both pinned here:
 *
 *   1. GET /lp/global-templates/:id/preview — PUBLIC (LP_PUBLIC, no auth). The
 *      homepage preview iframe + the superadmin "Preview" link render a featured
 *      card's blocks from this endpoint. It must:
 *        - return blocks for an is_global+is_template row,
 *        - 404 a tenant-owned template (is_template but NOT is_global) so the
 *          public endpoint can never enumerate a tenant's private templates,
 *        - 404 a plain published page (is_global but NOT is_template — shouldn't
 *          happen, but the AND guard must hold),
 *        - 404 a non-existent id and 400 a malformed id,
 *        - be reachable WITHOUT any session cookie.
 *
 *   2. POST /lp/pages/:pageId/clone — the "use template" handoff. The
 *      pages-gallery handoff clones a `global:<id>` template into the caller's
 *      tenant and opens the new page in the builder. The clone must:
 *        - succeed cross-tenant (the source global template is owned by a
 *          DIFFERENT tenant) and land the copy in the CALLER's tenant with the
 *          source blocks copied, status "draft",
 *        - still 404 a tenant-owned (non-global) template belonging to another
 *          tenant — the cross-tenant allowance is global-templates-only.
 *
 * Routes run IN-PROCESS via inject() — the vitest worker pool here can't bind a
 * listening port (app.listen never fires its callback). Everything runs against
 * the REAL Postgres pool, so a real tenant + template seed is the faithful way
 * to exercise the visibility rules.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import featuredTemplatesRouter from "./featured-templates";
import pagesRouter from "./pages";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const OWNER_SLUG = `it-globaltpl-owner-${SUFFIX}`;
const CALLER_SLUG = `it-globaltpl-caller-${SUFFIX}`;
const CALLER_SID = `it-globaltpl-caller-${randomUUID()}`;

const GLOBAL_BLOCKS = [
  { type: "hero", props: { headline: "Global starter" } },
  { type: "cta-button", props: { label: "Get started" } },
];

let ownerTenantId: number;
let callerTenantId: number;
let globalTemplateId: number; // is_global + is_template, owned by ownerTenant
let tenantTemplateId: number; // is_template but NOT global, owned by ownerTenant
let globalNonTemplateId: number; // is_global but NOT a template (AND guard)

// `publicApp` mounts the featured-templates router with NO auth middleware,
// mirroring the LP_PUBLIC allowlist (the route skips the blanket /lp/* auth).
let publicApp: Express;
// `authedApp` mounts the pages router behind requireAuth so the clone handoff
// runs with a real tenant-scoped session.
let authedApp: Express;

async function seedTenant(slug: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [`IT GlobalTpl ${slug}`, slug],
  );
  return t.rows[0].id;
}

async function seedPage(opts: {
  tenantId: number;
  slug: string;
  title: string;
  isTemplate: boolean;
  isGlobal: boolean;
  blocks: unknown;
}): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, is_template, is_global)
     VALUES ($1, $2, $3, $4::jsonb, 'published', $5, $6)
     RETURNING id`,
    [opts.tenantId, opts.title, opts.slug, JSON.stringify(opts.blocks), opts.isTemplate, opts.isGlobal],
  );
  return r.rows[0].id;
}

function injectAsCaller(opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(authedApp, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${CALLER_SID}` },
    body: opts.body,
  });
}

beforeAll(async () => {
  ownerTenantId = await seedTenant(OWNER_SLUG);
  callerTenantId = await seedTenant(CALLER_SLUG);

  globalTemplateId = await seedPage({
    tenantId: ownerTenantId,
    slug: `global-tpl-${SUFFIX}`,
    title: "Global Flagship Template",
    isTemplate: true,
    isGlobal: true,
    blocks: GLOBAL_BLOCKS,
  });
  tenantTemplateId = await seedPage({
    tenantId: ownerTenantId,
    slug: `tenant-tpl-${SUFFIX}`,
    title: "Owner-private Template",
    isTemplate: true,
    isGlobal: false,
    blocks: [{ type: "hero", props: { headline: "private" } }],
  });
  globalNonTemplateId = await seedPage({
    tenantId: ownerTenantId,
    slug: `global-page-${SUFFIX}`,
    title: "Global but not a template",
    isTemplate: false,
    isGlobal: true,
    blocks: [{ type: "hero", props: { headline: "not a template" } }],
  });

  // A tenant-scoped session for the caller. isAdmin:true skips requireAuth's
  // host enforcement; appUserRole null keeps it a NON-superadmin so the clone
  // is scoped strictly to the caller's own tenant (no X-Tenant-Id override).
  const sess: AuthUser = {
    userId: 0,
    email: `admin-${CALLER_SLUG}@example.com`,
    name: "Caller Admin",
    avatarUrl: null,
    tenantId: callerTenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [CALLER_SID, JSON.stringify(sess)],
  );

  publicApp = express();
  publicApp.use(cookieParser());
  publicApp.use(express.json());
  publicApp.use(featuredTemplatesRouter);

  authedApp = express();
  authedApp.use(cookieParser());
  authedApp.use(express.json());
  authedApp.use(requireAuth);
  authedApp.use(pagesRouter);
});

afterAll(async () => {
  // Remove any pages cloned into the caller tenant during the run, then the
  // seeds, then sessions/tenants.
  await pool.query(`DELETE FROM lp_pages WHERE tenant_id = ANY($1::int[])`, [[ownerTenantId, callerTenantId]]).catch(() => {});
  await pool.query(`DELETE FROM lp_template_usage WHERE tenant_id = ANY($1::int[])`, [[ownerTenantId, callerTenantId]]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [CALLER_SID]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = ANY($1::int[])`, [[ownerTenantId, callerTenantId]]).catch(() => {});
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("GET /lp/global-templates/:id/preview — public preview endpoint", () => {
  it("returns the blocks for an is_global + is_template row, without any auth", async () => {
    const res = await inject(publicApp, {
      method: "GET",
      url: `/lp/global-templates/${globalTemplateId}/preview`,
      // No cookie header at all — proves the endpoint is reachable anonymously.
    });

    expect(res.status).toBe(200);
    const body = res.json as { id: number; title: string; blocks: unknown[] };
    expect(body.id).toBe(globalTemplateId);
    expect(body.title).toBe("Global Flagship Template");
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(body.blocks).toEqual(GLOBAL_BLOCKS);
  });

  it("404s a tenant-owned template (is_template but NOT is_global) so private templates never leak", async () => {
    const res = await inject(publicApp, {
      method: "GET",
      url: `/lp/global-templates/${tenantTemplateId}/preview`,
    });
    expect(res.status).toBe(404);
  });

  it("404s a global page that is NOT a template (the is_template AND is_global guard holds)", async () => {
    const res = await inject(publicApp, {
      method: "GET",
      url: `/lp/global-templates/${globalNonTemplateId}/preview`,
    });
    expect(res.status).toBe(404);
  });

  it("404s a non-existent id", async () => {
    const res = await inject(publicApp, {
      method: "GET",
      url: `/lp/global-templates/2147483600/preview`,
    });
    expect(res.status).toBe(404);
  });

  it("400s a malformed id", async () => {
    const bad = await inject(publicApp, { method: "GET", url: `/lp/global-templates/not-a-number/preview` });
    expect(bad.status).toBe(400);
    const zero = await inject(publicApp, { method: "GET", url: `/lp/global-templates/0/preview` });
    expect(zero.status).toBe(400);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("POST /lp/pages/:pageId/clone — featured global-template handoff", () => {
  it("clones a global template owned by ANOTHER tenant into the caller's tenant", async () => {
    const res = await injectAsCaller({
      method: "POST",
      url: `/lp/pages/${globalTemplateId}/clone`,
      body: {},
    });

    expect(res.status).toBe(201);
    const page = res.json as { id: number; tenantId: number; blocks: unknown[]; status: string; title: string };
    expect(typeof page.id).toBe("number");
    // The clone lands in the CALLER's tenant, not the owner's.
    expect(page.tenantId).toBe(callerTenantId);
    expect(page.status).toBe("draft");
    // Blocks are copied from the source global template.
    expect(page.blocks).toEqual(GLOBAL_BLOCKS);

    // It really persisted under the caller tenant (this is what the builder
    // route /builder/:id then opens).
    const check = await pool.query<{ tenant_id: number }>(
      `SELECT tenant_id FROM lp_pages WHERE id = $1`,
      [page.id],
    );
    expect(check.rows[0]?.tenant_id).toBe(callerTenantId);
  });

  it("does NOT clone a tenant-owned (non-global) template from another tenant — 404", async () => {
    const res = await injectAsCaller({
      method: "POST",
      url: `/lp/pages/${tenantTemplateId}/clone`,
      body: {},
    });
    expect(res.status).toBe(404);

    // Nothing was copied into the caller tenant from that private template.
    const leaked = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM lp_pages
        WHERE tenant_id = $1 AND title LIKE 'Copy of Owner-private Template%'`,
      [callerTenantId],
    );
    expect(leaked.rows[0]?.n).toBe("0");
  });
});
