/**
 * Integration test for the Content Series subscriber view + CSV export
 * (Task #813).
 *
 * Runs the REAL content-series router against the REAL Postgres pool, injecting
 * requests IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/injectRequest). The full middleware chain runs (cookie-parser,
 * body parsing, requireAuth, the route handlers + their DB reads).
 *
 * Asserted contract:
 *   1. GET /lp/content-series/subscribers lists only built-in Subscribe-form
 *      leads (fields._source === 'content-series-subscribe'), excludes test
 *      leads and non-subscribe leads, dedupes by lowercased email (keeping the
 *      earliest subscribe date), flags opted-out subscribers, and sorts
 *      newest-first.
 *   2. GET /lp/content-series/subscribers.csv returns a downloadable CSV with a
 *      UTF-8 BOM, a header row, and the same membership as the JSON list.
 *   3. Both routes tenant-scope the page: a page belonging to another tenant
 *      404s, and an unauthenticated request 401s.
 *
 * All rows created here are torn down in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import contentSeriesRouter from "./content-series";

const SID = `it-cssub-${randomUUID()}`;
const UID = 999813001;
const SLUG_A = `it-cssub-a-${randomUUID().slice(0, 8)}`;
const SLUG_B = `it-cssub-b-${randomUUID().slice(0, 8)}`;

let app: Express;
let tenantId = 0;
let otherTenantId = 0;
let pageId = 0;
let otherPageId = 0;

function injectSid(opts: {
  method: string;
  url: string;
  sid?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<InjectResponse> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.sid) headers["cookie"] = `${SESSION_COOKIE}=${opts.sid}`;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: "it@example.com",
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role: "viewer",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...u,
  };
  return JSON.stringify(full);
}

async function seedSession(sid: string, user: Partial<AuthUser> & Pick<AuthUser, "userId">): Promise<void> {
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

async function seedLead(pid: number, tid: number, fields: Record<string, unknown>, createdAt: string): Promise<void> {
  await pool.query(
    `INSERT INTO lp_leads (tenant_id, page_id, fields, created_at) VALUES ($1, $2, $3::jsonb, $4)`,
    [tid, pid, JSON.stringify(fields), createdAt],
  );
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  for (const pid of [pageId, otherPageId]) {
    if (pid) {
      await pool.query(`DELETE FROM content_series_unsubscribes WHERE page_id = $1`, [pid]).catch(() => {});
      await pool.query(`DELETE FROM lp_leads WHERE page_id = $1`, [pid]).catch(() => {});
      await pool.query(`DELETE FROM lp_pages WHERE id = $1`, [pid]).catch(() => {});
    }
  }
  for (const tid of [tenantId, otherTenantId]) {
    if (tid) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tid]).catch(() => {});
  }
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT CS Sub', $1, 'active') RETURNING id`,
    [`it-cssub-t-${randomUUID().slice(0, 8)}`],
  );
  tenantId = t.rows[0]!.id;
  const t2 = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT CS Sub Other', $1, 'active') RETURNING id`,
    [`it-cssub-t2-${randomUUID().slice(0, 8)}`],
  );
  otherTenantId = t2.rows[0]!.id;

  const pg = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug) VALUES ($1, 'CS Sub Page', $2) RETURNING id`,
    [tenantId, SLUG_A],
  );
  pageId = pg.rows[0]!.id;
  const pg2 = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug) VALUES ($1, 'CS Sub Page Other', $2) RETURNING id`,
    [otherTenantId, SLUG_B],
  );
  otherPageId = pg2.rows[0]!.id;

  // Two genuine subscribers (newest-first ordering: bob before alice).
  await seedLead(pageId, tenantId, { _source: "content-series-subscribe", email: "alice@real.com" }, "2026-01-01T10:00:00Z");
  await seedLead(pageId, tenantId, { _source: "content-series-subscribe", email: "bob@real.com" }, "2026-02-01T10:00:00Z");
  // Duplicate of bob with an EARLIER date — dedupe must keep the earliest date.
  await seedLead(pageId, tenantId, { _source: "content-series-subscribe", email: "Bob@real.com" }, "2026-01-15T10:00:00Z");
  // Test lead — filtered out by isTestLead.
  await seedLead(pageId, tenantId, { _source: "content-series-subscribe", email: "qa@example.com" }, "2026-03-01T10:00:00Z");
  // Non-subscribe lead — excluded (different source).
  await seedLead(pageId, tenantId, { _source: "lead-form", email: "carol@real.com" }, "2026-03-01T10:00:00Z");
  // bob opted out.
  await pool.query(
    `INSERT INTO content_series_unsubscribes (tenant_id, page_id, email) VALUES ($1, $2, 'bob@real.com')`,
    [tenantId, pageId],
  );

  await seedSession(SID, { userId: UID, tenantId, role: "admin", isAdmin: true });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", requireAuth, contentSeriesRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("content series subscriber view + export", () => {
  it("returns 401 without a session", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/content-series/subscribers?pageId=${pageId}` });
    expect(res.status).toBe(401);
  });

  it("lists deduped non-test subscribers with opt-out status, newest-first", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/content-series/subscribers?pageId=${pageId}`, sid: SID });
    expect(res.status).toBe(200);
    const body = res.json as {
      total: number;
      optedOut: number;
      subscribers: Array<{ email: string; subscribedAt: string | null; optedOut: boolean }>;
    };
    expect(body.total).toBe(2);
    expect(body.optedOut).toBe(1);
    expect(body.subscribers.map((s) => s.email)).toEqual(["bob@real.com", "alice@real.com"]);
    const bob = body.subscribers.find((s) => s.email === "bob@real.com")!;
    const alice = body.subscribers.find((s) => s.email === "alice@real.com")!;
    expect(bob.optedOut).toBe(true);
    expect(alice.optedOut).toBe(false);
    // Dedupe keeps bob's EARLIEST subscribe date (Jan 15, not Feb 1).
    expect(bob.subscribedAt).toBe("2026-01-15T10:00:00.000Z");
  });

  it("exports a CSV with a BOM, header, and the same membership", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/content-series/subscribers.csv?pageId=${pageId}`, sid: SID });
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/csv");
    expect(String(res.headers["content-disposition"])).toContain("attachment");
    expect(res.text.startsWith("\uFEFF")).toBe(true);
    const lines = res.text.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Email,Subscribed At,Opted Out");
    expect(lines.length).toBe(3); // header + 2 subscribers
    expect(res.text).toContain("bob@real.com");
    expect(res.text).toContain("alice@real.com");
    expect(res.text).not.toContain("qa@example.com");
    expect(res.text).not.toContain("carol@real.com");
    // bob is opted out → "Yes"; alice → "No".
    expect(lines.some((l) => l.startsWith("bob@real.com,") && l.endsWith(",Yes"))).toBe(true);
    expect(lines.some((l) => l.startsWith("alice@real.com,") && l.endsWith(",No"))).toBe(true);
  });

  it("404s a page that belongs to another tenant (list)", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/content-series/subscribers?pageId=${otherPageId}`, sid: SID });
    expect(res.status).toBe(404);
  });

  it("404s a page that belongs to another tenant (CSV)", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/content-series/subscribers.csv?pageId=${otherPageId}`, sid: SID });
    expect(res.status).toBe(404);
  });
});
