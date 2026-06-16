/**
 * Integration test for per-tenant "Featured templates" (star toggle).
 *
 * Two server surfaces are pinned here:
 *
 *   1. PUT /lp/templates/:id/featured { featured: boolean } — the star toggle.
 *      Per-tenant curation: a tenant may feature any template it can SEE (its
 *      own templates, or any global template). It must:
 *        - feature/un-feature a tenant-owned template,
 *        - feature a GLOBAL template owned by another tenant,
 *        - 404 a tenant-owned (non-global) template belonging to ANOTHER tenant
 *          so a tenant can never feature (and thereby probe the existence of)
 *          a foreign workspace's private template,
 *        - be idempotent — starring twice leaves exactly one row; un-starring a
 *          row that isn't there is a no-op,
 *        - 400 a malformed id and a non-boolean body.
 *
 *   2. GET /lp/templates/enriched — the marketplace listing. Each template
 *      carries a per-tenant `featured` boolean computed from the caller tenant's
 *      starred set. It must:
 *        - default `featured:false` for every template before any star,
 *        - flip to `featured:true` for exactly the starred template,
 *        - keep featuring strictly per-tenant — a second tenant starring the
 *          SAME global template does not change the first tenant's view.
 *
 * Routes run IN-PROCESS via inject() — the vitest worker pool here can't bind a
 * listening port (app.listen never fires its callback). Everything runs against
 * the REAL Postgres pool, so a real tenant + template seed is the faithful way
 * to exercise the visibility + per-tenant rules.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import templatesRouter from "./templates";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const CALLER_SLUG = `it-feat-caller-${SUFFIX}`;
const OTHER_SLUG = `it-feat-other-${SUFFIX}`;
const CALLER_SID = `it-feat-caller-${randomUUID()}`;
const OTHER_SID = `it-feat-other-${randomUUID()}`;

let callerTenantId: number;
let otherTenantId: number;
let ownTemplateId: number; // is_template, owned by caller tenant
let globalTemplateId: number; // is_global + is_template, owned by other tenant
let foreignPrivateTemplateId: number; // is_template, NOT global, owned by other tenant

let app: Express;

async function seedTenant(slug: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [`IT Featured ${slug}`, slug],
  );
  return t.rows[0].id;
}

async function seedTemplate(opts: {
  tenantId: number;
  slug: string;
  title: string;
  isGlobal: boolean;
}): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, is_template, is_global)
     VALUES ($1, $2, $3, $4::jsonb, 'published', true, $5)
     RETURNING id`,
    [
      opts.tenantId,
      opts.title,
      opts.slug,
      JSON.stringify([{ type: "hero", props: { headline: opts.title } }]),
      opts.isGlobal,
    ],
  );
  return r.rows[0].id;
}

async function seedSession(sid: string, tenantId: number, slug: string): Promise<void> {
  // A tenant-scoped session. isAdmin:true skips requireAuth's host enforcement;
  // appUserRole null keeps it a NON-superadmin so getTenantId resolves strictly
  // to this tenant (no X-Tenant-Id override path).
  const sess: AuthUser = {
    userId: 0,
    email: `admin-${slug}@example.com`,
    name: "Tenant Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, JSON.stringify(sess)],
  );
}

function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    body: opts.body,
  });
}

/** Fetch the caller's enriched template list as a map id -> featured. */
async function featuredMap(sid: string): Promise<Map<number, boolean>> {
  const res = await injectAs(sid, { method: "GET", url: "/lp/templates/enriched" });
  expect(res.status).toBe(200);
  const rows = res.json as Array<{ id: number; featured: boolean }>;
  return new Map(rows.map((r) => [r.id, r.featured]));
}

/** Count featured rows for a (tenant, template) pair — proves idempotency. */
async function featuredRowCount(tenantId: number, templateId: number): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM lp_tenant_featured_templates
      WHERE tenant_id = $1 AND template_id = $2`,
    [tenantId, templateId],
  );
  return Number(r.rows[0]?.n ?? "0");
}

beforeAll(async () => {
  callerTenantId = await seedTenant(CALLER_SLUG);
  otherTenantId = await seedTenant(OTHER_SLUG);

  ownTemplateId = await seedTemplate({
    tenantId: callerTenantId,
    slug: `own-tpl-${SUFFIX}`,
    title: "Caller Own Template",
    isGlobal: false,
  });
  globalTemplateId = await seedTemplate({
    tenantId: otherTenantId,
    slug: `global-tpl-${SUFFIX}`,
    title: "Global Flagship Template",
    isGlobal: true,
  });
  foreignPrivateTemplateId = await seedTemplate({
    tenantId: otherTenantId,
    slug: `foreign-tpl-${SUFFIX}`,
    title: "Other Tenant Private Template",
    isGlobal: false,
  });

  await seedSession(CALLER_SID, callerTenantId, CALLER_SLUG);
  await seedSession(OTHER_SID, otherTenantId, OTHER_SLUG);

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(templatesRouter);
});

afterAll(async () => {
  await pool
    .query(`DELETE FROM lp_tenant_featured_templates WHERE tenant_id = ANY($1::int[])`, [
      [callerTenantId, otherTenantId],
    ])
    .catch(() => {});
  await pool
    .query(`DELETE FROM lp_pages WHERE tenant_id = ANY($1::int[])`, [[callerTenantId, otherTenantId]])
    .catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1::text[])`, [[CALLER_SID, OTHER_SID]]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = ANY($1::int[])`, [[callerTenantId, otherTenantId]]).catch(() => {});
});

describe("PUT /lp/templates/:id/featured — star toggle", () => {
  it("features and un-features a tenant-owned template, idempotently", async () => {
    // Star it.
    const on = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${ownTemplateId}/featured`,
      body: { featured: true },
    });
    expect(on.status).toBe(200);
    expect((on.json as { featured: boolean }).featured).toBe(true);
    expect(await featuredRowCount(callerTenantId, ownTemplateId)).toBe(1);

    // Star again — idempotent, still exactly one row.
    const onAgain = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${ownTemplateId}/featured`,
      body: { featured: true },
    });
    expect(onAgain.status).toBe(200);
    expect(await featuredRowCount(callerTenantId, ownTemplateId)).toBe(1);

    // Un-star it.
    const off = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${ownTemplateId}/featured`,
      body: { featured: false },
    });
    expect(off.status).toBe(200);
    expect((off.json as { featured: boolean }).featured).toBe(false);
    expect(await featuredRowCount(callerTenantId, ownTemplateId)).toBe(0);

    // Un-star again — no-op delete, still no row, no error.
    const offAgain = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${ownTemplateId}/featured`,
      body: { featured: false },
    });
    expect(offAgain.status).toBe(200);
    expect(await featuredRowCount(callerTenantId, ownTemplateId)).toBe(0);
  });

  it("features a GLOBAL template owned by another tenant", async () => {
    const res = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${globalTemplateId}/featured`,
      body: { featured: true },
    });
    expect(res.status).toBe(200);
    expect(await featuredRowCount(callerTenantId, globalTemplateId)).toBe(1);

    // cleanup so the per-tenant isolation test below starts clean
    await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${globalTemplateId}/featured`,
      body: { featured: false },
    });
  });

  it("404s a tenant-owned (non-global) template from ANOTHER tenant — never features or probes it", async () => {
    const res = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${foreignPrivateTemplateId}/featured`,
      body: { featured: true },
    });
    expect(res.status).toBe(404);
    // Nothing was written for the caller against the foreign private template.
    expect(await featuredRowCount(callerTenantId, foreignPrivateTemplateId)).toBe(0);
  });

  it("404s a non-existent template id", async () => {
    const res = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/2147483600/featured`,
      body: { featured: true },
    });
    expect(res.status).toBe(404);
  });

  it("400s a malformed id and a non-boolean body", async () => {
    const badId = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/not-a-number/featured`,
      body: { featured: true },
    });
    expect(badId.status).toBe(400);

    const badBody = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${ownTemplateId}/featured`,
      body: { featured: "yes" },
    });
    expect(badBody.status).toBe(400);
  });
});

describe("GET /lp/templates/enriched — per-tenant featured flag", () => {
  it("defaults featured:false, flips to true only for the starred template, and stays per-tenant", async () => {
    // Baseline: nothing starred → all visible templates report featured:false.
    const before = await featuredMap(CALLER_SID);
    expect(before.get(ownTemplateId)).toBe(false);
    expect(before.get(globalTemplateId)).toBe(false);

    // Caller stars the global template.
    const on = await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${globalTemplateId}/featured`,
      body: { featured: true },
    });
    expect(on.status).toBe(200);

    // Caller's view: exactly the global template is featured; own is not.
    const callerView = await featuredMap(CALLER_SID);
    expect(callerView.get(globalTemplateId)).toBe(true);
    expect(callerView.get(ownTemplateId)).toBe(false);

    // The OTHER tenant sees that same global template as NOT featured — the
    // star is strictly per-tenant.
    const otherView = await featuredMap(OTHER_SID);
    expect(otherView.get(globalTemplateId)).toBe(false);

    // cleanup
    await injectAs(CALLER_SID, {
      method: "PUT",
      url: `/lp/templates/${globalTemplateId}/featured`,
      body: { featured: false },
    });
  });
});
