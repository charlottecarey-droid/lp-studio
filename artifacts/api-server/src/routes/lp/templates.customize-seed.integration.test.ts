/**
 * GET /lp/templates?includeId= — the "Customize with AI" seed.
 *
 * THE BUG THIS PINS: the Sales Template Library lists templates from
 * /lp/templates/enriched (everything the tenant can see), but the microsite
 * generator's dropdown loads the CURATED set (?salesMode=true&forMicrosite=true),
 * which excludes non-flagship globals. Clicking "Customize with AI" on one of
 * those preselected nothing and silently generated a page from scratch — the
 * rep picked a template and got something unrelated, with no explanation.
 *
 * `includeId` forces the explicitly-chosen template into the result. What it
 * must NOT do is become a way around governance or tenancy, so this pins all
 * four cases: the curated set is unchanged, an off-curation template the rep
 * asked for IS returned, a microsite-DISABLED template is still refused, and
 * another tenant's private template is never returned.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import pagesRouter from "./pages";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const CALLER_SLUG = `it-seed-caller-${SUFFIX}`;
const OTHER_SLUG = `it-seed-other-${SUFFIX}`;
const CALLER_SID = `it-seed-${randomUUID()}`;

const BLOCKS = [{ type: "hero", props: { headline: "starter" } }];

let callerTenantId: number;
let otherTenantId: number;
let plainGlobalId: number;      // global, NOT all-in-one/business-case → off-curation
let disabledOwnedId: number;    // owned but microsite_enabled = false
let ownedEnabledId: number;     // owned, eligible → in the curated set already
let otherTenantPrivateId: number;
let app: Express;

async function seedTenant(slug: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [`IT Seed ${slug}`, slug],
  );
  return t.rows[0].id;
}

async function seedTemplate(opts: {
  tenantId: number; slug: string; title: string; isGlobal: boolean;
  micrositeEnabled?: boolean | null;
}): Promise<number> {
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, is_template, is_global, microsite_enabled)
     VALUES ($1, $2, $3, $4::jsonb, 'draft', true, $5, $6)
     RETURNING id`,
    [opts.tenantId, opts.title, opts.slug, JSON.stringify(BLOCKS), opts.isGlobal, opts.micrositeEnabled ?? null],
  );
  return p.rows[0].id;
}

const listCurated = async (extra = ""): Promise<{ id: number }[]> => {
  const res = await inject(app, {
    method: "GET",
    url: `/lp/templates?salesMode=true&forMicrosite=true${extra}`,
    headers: { cookie: `${SESSION_COOKIE}=${CALLER_SID}` },
  });
  expect(res.status).toBe(200);
  return res.json as { id: number }[];
};

beforeAll(async () => {
  callerTenantId = await seedTenant(CALLER_SLUG);
  otherTenantId = await seedTenant(OTHER_SLUG);

  plainGlobalId = await seedTemplate({
    tenantId: otherTenantId, slug: `plain-global-${SUFFIX}`,
    title: "Plain Global Starter", isGlobal: true,
  });
  ownedEnabledId = await seedTemplate({
    tenantId: callerTenantId, slug: `owned-ok-${SUFFIX}`,
    title: "Owned Eligible", isGlobal: false,
  });
  disabledOwnedId = await seedTemplate({
    tenantId: callerTenantId, slug: `owned-off-${SUFFIX}`,
    title: "Owned Disabled For Microsites", isGlobal: false, micrositeEnabled: false,
  });
  otherTenantPrivateId = await seedTemplate({
    tenantId: otherTenantId, slug: `other-private-${SUFFIX}`,
    title: "Another Tenant's Private Template", isGlobal: false,
  });

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

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(pagesRouter);
});

afterAll(async () => {
  await pool.query(`DELETE FROM lp_pages WHERE tenant_id = ANY($1::int[])`, [[callerTenantId, otherTenantId]]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [CALLER_SID]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = ANY($1::int[])`, [[callerTenantId, otherTenantId]]).catch(() => {});
});

describe.skipIf(!dbAvailable)("GET /lp/templates?includeId= — Customize with AI seed", () => {
  it("without includeId, a plain global stays OUT of the curated set (the bug's cause)", async () => {
    const ids = (await listCurated()).map((t) => t.id);
    expect(ids).toContain(ownedEnabledId);
    expect(ids).not.toContain(plainGlobalId);
  });

  it("includeId returns the template the rep actually clicked", async () => {
    const ids = (await listCurated(`&includeId=${plainGlobalId}`)).map((t) => t.id);
    expect(ids).toContain(plainGlobalId);
  });

  it("does not duplicate a template that's already in the curated set", async () => {
    const ids = (await listCurated(`&includeId=${ownedEnabledId}`)).map((t) => t.id);
    expect(ids.filter((id) => id === ownedEnabledId)).toHaveLength(1);
  });

  it("REFUSES a template marketing disabled for microsites — governance is not a default", async () => {
    const ids = (await listCurated(`&includeId=${disabledOwnedId}`)).map((t) => t.id);
    expect(ids).not.toContain(disabledOwnedId);
  });

  it("NEVER returns another tenant's private template", async () => {
    const ids = (await listCurated(`&includeId=${otherTenantPrivateId}`)).map((t) => t.id);
    expect(ids).not.toContain(otherTenantPrivateId);
  });

  it("a junk or unknown includeId is ignored, not an error", async () => {
    expect((await listCurated("&includeId=abc")).length).toBeGreaterThan(0);
    expect((await listCurated("&includeId=999999999")).length).toBeGreaterThan(0);
  });
});
