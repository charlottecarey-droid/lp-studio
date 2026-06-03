/**
 * Integration test for the Page Detail "Visits" table endpoint
 * (GET /lp/analytics/pages/:pageId/visits).
 *
 * The visits feed UNIONs two streams into one combined, paginated table:
 *  - anonymous traffic       (lp_page_visits, joined to lp_heatmap_events for
 *                             engagement + to lp_events for conversion)
 *  - personalized link hits  (lp_personalized_link_visits → lp_personalized_links)
 *
 * "Unresolved token" visits — a visitor who lands without a resolvable
 * personalized link — are recorded as plain anonymous lp_page_visits rows, so
 * the anonymous-only case below is exactly that path.
 *
 * Covers:
 *  1. Happy path — a page with BOTH an anonymous visit and a personalized link
 *     visit returns both rows (newest-first), with source/contact fields and a
 *     conversion flag derived from lp_events.
 *  2. Empty — a page with no traffic returns an empty, well-formed envelope.
 *  3. Anonymous / unresolved — a page with only anonymous lp_page_visits returns
 *     `source: "anonymous"` rows with null contact fields.
 *  4. Auth + tenant scoping — unauthenticated requests are rejected, and one
 *     tenant cannot read another tenant's page (404).
 *
 * Exercised in-process (no TCP socket) via inject(), against the REAL Postgres
 * pool so requireAuth runs its real lookups. Each run seeds + tears down its own
 * growth tenants, sessions, pages, and visit rows.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import pageDetailRouter from "./page-detail";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];
const createdPageIds: number[] = [];

interface VisitRow {
  id: string;
  source: "anonymous" | "personalized";
  resolved?: boolean;
  visitedAt: string;
  contactName: string | null;
  company: string | null;
  email: string | null;
  converted: boolean;
  clicks: number;
  scrollDepthPct: number | null;
}
interface VisitsBody {
  visits: VisitRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999820000 + Math.floor(Math.random() * 100000),
    email: "page-detail-it@example.com",
    name: "IT Page Detail Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-pagedetail-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-pagedetail-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Page Detail Tenant', $1, 'active', 'growth')
     RETURNING id`,
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
  const slug = `it-pd-page-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, mode)
     VALUES ($1, 'IT Page Detail Page', $2, 'published', 'sales')
     RETURNING id`,
    [tenantId, slug],
  );
  createdPageIds.push(r.rows[0].id);
  return r.rows[0].id;
}

/** Seed an anonymous page visit (the "unresolved token" path). */
async function seedAnonVisit(
  pageId: number,
  sessionId: string,
  minutesAgo: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO lp_page_visits (page_id, session_id, city, country, created_at)
     VALUES ($1, $2, 'Austin', 'US', now() - ($3 || ' minutes')::interval)`,
    [pageId, sessionId, String(minutesAgo)],
  );
}

/** Mark an anonymous session as converted via an lp_events conversion row. */
async function seedConversion(pageId: number, sessionId: string): Promise<void> {
  await pool.query(
    `INSERT INTO lp_events (session_id, page_id, event_type) VALUES ($1, $2, 'conversion')`,
    [sessionId, pageId],
  );
}

/**
 * Seed a lead-form submission carrying a tracking session id. This is the
 * de-anonymization signal (Task #910): an anonymous lp_page_visits row whose
 * session_id matches a lead's session_id should reveal that lead's identity.
 */
async function seedLead(
  tenantId: number,
  pageId: number,
  sessionId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO lp_leads (tenant_id, page_id, session_id, fields)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, pageId, sessionId, JSON.stringify(fields)],
  );
}

/** Seed a personalized link + a visit against it. */
async function seedPersonalizedVisit(
  tenantId: number,
  pageId: number,
  contactName: string,
  minutesAgo: number,
): Promise<void> {
  const linkRes = await pool.query<{ id: number }>(
    `INSERT INTO lp_personalized_links (page_id, tenant_id, contact_name, company, email, token)
     VALUES ($1, $2, $3, 'Acme Co', 'lead@acme.test', $4)
     RETURNING id`,
    [pageId, tenantId, contactName, `it-tok-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO lp_personalized_link_visits (link_id, city, country, scroll_depth_pct, cta_clicks, visited_at)
     VALUES ($1, 'Boston', 'US', 80, 2, now() - ($2 || ' minutes')::interval)`,
    [linkRes.rows[0].id, String(minutesAgo)],
  );
}

function authed(sid: string, url: string) {
  return inject(app, { method: "GET", url, headers: { cookie: `${SESSION_COOKIE}=${sid}` } });
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(pageDetailRouter);
});

afterAll(async () => {
  for (const id of createdPageIds) {
    // lp_events has no cascade FK on page_id; clear it explicitly. Visits +
    // personalized links cascade off lp_pages.
    await pool.query(`DELETE FROM lp_events WHERE page_id = $1`, [id]).catch(() => {});
  }
  for (const id of createdPageIds) {
    await pool.query(`DELETE FROM lp_pages WHERE id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("GET /lp/analytics/pages/:pageId/visits", () => {
  it("returns both anonymous and personalized visits (happy path), newest first, with conversion flag", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    const anonSession = `it-sess-${randomUUID()}`;

    // anonymous visit 20m ago (converted), personalized visit 5m ago (newer)
    await seedAnonVisit(pageId, anonSession, 20);
    await seedConversion(pageId, anonSession);
    await seedPersonalizedVisit(tenantId, pageId, "Dana Lead", 5);

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;

    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.visits).toHaveLength(2);

    // newest first → personalized (5m) before anonymous (20m)
    expect(body.visits[0].source).toBe("personalized");
    expect(body.visits[1].source).toBe("anonymous");

    const personalized = body.visits[0];
    expect(personalized.contactName).toBe("Dana Lead");
    expect(personalized.company).toBe("Acme Co");
    expect(personalized.email).toBe("lead@acme.test");
    expect(personalized.converted).toBe(true); // cta_clicks > 0
    expect(personalized.clicks).toBe(2);
    expect(personalized.scrollDepthPct).toBe(80);

    const anon = body.visits[1];
    expect(anon.contactName).toBeNull();
    expect(anon.company).toBeNull();
    expect(anon.email).toBeNull();
    expect(anon.converted).toBe(true); // lp_events conversion for its session
  });

  it("returns an empty, well-formed envelope when the page has no visits", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;

    expect(body.visits).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(false);
  });

  it("returns anonymous (unresolved-token) visits with null contact fields", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    await seedAnonVisit(pageId, `it-sess-${randomUUID()}`, 10);
    await seedAnonVisit(pageId, `it-sess-${randomUUID()}`, 30);

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;

    expect(body.total).toBe(2);
    expect(body.visits).toHaveLength(2);
    for (const v of body.visits) {
      expect(v.source).toBe("anonymous");
      expect(v.contactName).toBeNull();
      expect(v.company).toBeNull();
      expect(v.email).toBeNull();
      expect(v.converted).toBe(false);
    }
  });

  it("de-anonymizes an anonymous visit whose session later submitted a lead form", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    const knownSession = `it-sess-${randomUUID()}`;
    const unknownSession = `it-sess-${randomUUID()}`;

    // Two anonymous visits; only `knownSession` later submits a lead form.
    await seedAnonVisit(pageId, knownSession, 10);
    await seedAnonVisit(pageId, unknownSession, 20);
    await seedLead(tenantId, pageId, knownSession, {
      firstName: "Riley",
      lastName: "Known",
      company: "Globex",
      email: "riley@globex.test",
    });

    const res = await authed(sid, `/lp/analytics/pages/${pageId}/visits`);
    expect(res.status).toBe(200);
    const body = res.json as VisitsBody;

    expect(body.total).toBe(2);
    const known = body.visits.find((v) => v.contactName !== null);
    const unknown = body.visits.find((v) => v.contactName === null);
    expect(known).toBeTruthy();
    expect(unknown).toBeTruthy();

    // The resolved row stays an anonymous-source row but reveals the lead.
    expect(known!.source).toBe("anonymous");
    expect(known!.resolved).toBe(true);
    expect(known!.contactName).toBe("Riley Known");
    expect(known!.company).toBe("Globex");
    expect(known!.email).toBe("riley@globex.test");

    // The unmatched anonymous row remains anonymous and unresolved.
    expect(unknown!.source).toBe("anonymous");
    expect(unknown!.resolved).toBeFalsy();

    // "Known only" now includes the resolved anonymous row.
    const knownOnlyRes = await authed(
      sid,
      `/lp/analytics/pages/${pageId}/visits?knownOnly=true`,
    );
    const knownBody = knownOnlyRes.json as VisitsBody;
    expect(knownBody.total).toBe(1);
    expect(knownBody.visits[0].contactName).toBe("Riley Known");

    // Contact search matches the resolved identity's fields.
    const searchRes = await authed(
      sid,
      `/lp/analytics/pages/${pageId}/visits?contactSearch=Globex`,
    );
    const searchBody = searchRes.json as VisitsBody;
    expect(searchBody.total).toBe(1);
    expect(searchBody.visits[0].company).toBe("Globex");
  });

  it("rejects unauthenticated requests", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId);
    void sid;

    const res = await inject(app, { method: "GET", url: `/lp/analytics/pages/${pageId}/visits` });
    expect(res.status).toBe(401);
  });

  it("is tenant-scoped: a tenant cannot read another tenant's page (404)", async () => {
    const a = await seedTenant();
    const pageA = await seedPage(a.tenantId);
    const b = await seedTenant();

    const res = await authed(b.sid, `/lp/analytics/pages/${pageA}/visits`);
    expect(res.status).toBe(404);
  });
});
