/**
 * Critical-path smoke test for page-visit analytics
 * (GET /lp/analytics/pages/:pageId/visits). Pre-launch audit S7.
 *
 * Goal: catch "the visits feed is broken" regressions — route unmounted, 500
 * (e.g. the ANY(array) bug that surfaced as "Could not load visits"), or a
 * cross-tenant leak — NOT exhaustive filter combinations.
 *
 * Auth-gated (getTenantId reads req.authUser), so we mount requireAuth and seed
 * a real admin session. Runs against the REAL Postgres pool via in-process
 * inject(); each test seeds + tears down its own tenant, session, pages, and
 * both the anonymous (lp_page_visits) and personalized (lp_personalized_links +
 * lp_personalized_link_visits) visit streams.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import lpRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999830000 + Math.floor(Math.random() * 100000),
    email: "visits-smoke-it@example.com",
    name: "IT Visits Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-visits-smoke-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-visits-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Visits Tenant', $1, 'active', 'growth') RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

async function seedPage(tenantId: number): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, mode)
     VALUES ($1, 'Visits Smoke Page', $2, 'published', 'default') RETURNING id`,
    [tenantId, `visits-${Math.floor(Math.random() * 1e9)}`],
  );
  return r.rows[0].id;
}

/** An anonymous visit (lp_page_visits). `daysAgo` controls created_at. */
async function seedAnonVisit(pageId: number, daysAgo = 0): Promise<void> {
  await pool.query(
    `INSERT INTO lp_page_visits (page_id, session_id, city, country, created_at)
     VALUES ($1, $2, 'Austin', 'US', now() - ($3 || ' days')::interval)`,
    [pageId, `sess-${randomUUID()}`, String(daysAgo)],
  );
}

/** A personalized/known visit (lp_personalized_links + _visits). */
async function seedPersonalizedVisit(
  tenantId: number,
  pageId: number,
  name: string,
  company: string,
  email: string,
  daysAgo = 0,
): Promise<void> {
  const link = await pool.query<{ id: number }>(
    `INSERT INTO lp_personalized_links (tenant_id, page_id, contact_name, company, email, token)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, pageId, name, company, email, `tok-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO lp_personalized_link_visits (link_id, city, country, scroll_depth_pct, cta_clicks, visited_at)
     VALUES ($1, 'Boston', 'US', 80, 1, now() - ($2 || ' days')::interval)`,
    [link.rows[0].id, String(daysAgo)],
  );
}

function authed(sid: string, url: string) {
  return inject(app, { method: "GET", url, headers: { cookie: `${SESSION_COOKIE}=${sid}` } });
}

interface Visit {
  id: string;
  source: "anonymous" | "personalized";
  contactName: string | null;
  company: string | null;
  email: string | null;
}
interface VisitsBody {
  visits: Visit[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(lpRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(
      `DELETE FROM lp_personalized_link_visits WHERE link_id IN
         (SELECT id FROM lp_personalized_links WHERE tenant_id = $1)`,
      [id],
    ).catch(() => {});
    await pool.query(`DELETE FROM lp_personalized_links WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(
      `DELETE FROM lp_page_visits WHERE page_id IN (SELECT id FROM lp_pages WHERE tenant_id = $1)`,
      [id],
    ).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Page-visits analytics smoke", () => {
  it("returns both anonymous and personalized visits with correct identity", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    await seedAnonVisit(pageId);
    await seedPersonalizedVisit(tenantId, pageId, "Pat Known", "Known Corp", "pat@known.example");

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;

    expect(body.total).toBe(2);
    expect(body.visits).toHaveLength(2);

    const anon = body.visits.find((v) => v.source === "anonymous");
    const known = body.visits.find((v) => v.source === "personalized");

    // Anonymous rows carry no identity; personalized rows resolve their contact.
    expect(anon).toBeDefined();
    expect(anon?.contactName).toBeNull();
    expect(anon?.company).toBeNull();

    expect(known).toBeDefined();
    expect(known?.contactName).toBe("Pat Known");
    expect(known?.company).toBe("Known Corp");
    expect(known?.email).toBe("pat@known.example");
  });

  it("knownOnly=true filters out anonymous visits", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    await seedAnonVisit(pageId);
    await seedAnonVisit(pageId);
    await seedPersonalizedVisit(tenantId, pageId, "Only Known", "K Co", "only@known.example");

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits?knownOnly=true`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;

    expect(body.total).toBe(1);
    expect(body.visits.every((v) => v.source === "personalized")).toBe(true);
    expect(body.visits[0].contactName).toBe("Only Known");
  });

  it("an out-of-range date window returns 200 with an empty list", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    // Both visits are older than the 1-day window.
    await seedAnonVisit(pageId, 10);
    await seedPersonalizedVisit(tenantId, pageId, "Old Visitor", "Old Co", "old@x.example", 10);

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits?days=1`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;
    expect(body.total).toBe(0);
    expect(body.visits).toHaveLength(0);
  });

  it("does not leak another tenant's page (404)", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const pageA = await seedPage(a.tenantId);
    await seedAnonVisit(pageA);

    const res = await authed(b.sid, `/lp/analytics/pages/${pageA}/visits`);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(200);
  });

  it("returns 400 for a non-numeric pageId", async () => {
    const { sid } = await seedTenant();
    const res = await authed(sid, `/lp/analytics/pages/not-a-number/visits`);
    expect(res.status).toBe(400);
  });
});
