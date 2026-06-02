/**
 * Integration test for the no-email "Generate personalized links only" export
 * flow (Quick Campaign wizard).
 *
 * Covers:
 *  1. POST /sales/link-export/build generates a personalized hotlink per
 *     active+emailed contact, skips contacts without an email, and requires a
 *     PUBLISHED landing page.
 *  2. GET /sales/link-export/destinations exposes the destination registry with
 *     per-tenant configured state (CSV is always configured).
 *  3. POST /sales/link-export/csv streams a CSV file containing the links.
 *  4. Everything is tenant-scoped: tenant B cannot build links against tenant
 *     A's page or contacts.
 *
 * Exercised in-process (no TCP socket) via inject(), against the REAL Postgres
 * pool so requireAuth + requirePlanFeature run their real lookups. Each run
 * seeds + tears down its own growth tenants, sessions, and sales rows.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999810000 + Math.floor(Math.random() * 100000),
    email: "link-export-it@example.com",
    name: "IT Link Export Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-linkexport-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-linkexport-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Link Export Tenant', $1, 'active', 'growth')
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

async function seedPage(tenantId: number, status: "draft" | "published"): Promise<number> {
  const slug = `it-page-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, mode)
     VALUES ($1, 'IT Link Export Page', $2, $3, 'sales')
     RETURNING id`,
    [tenantId, slug, status],
  );
  return r.rows[0].id;
}

async function seedAccount(tenantId: number, name: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenantId, name],
  );
  return r.rows[0].id;
}

async function seedContact(
  tenantId: number,
  accountId: number,
  opts: { firstName: string; lastName: string; email: string | null; status?: string },
): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, accountId, opts.firstName, opts.lastName, opts.email, opts.status ?? "active"],
  );
  return r.rows[0].id;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Personalized link export flow", () => {
  it("builds a personalized link per active+emailed contact and skips contacts with no email", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId, "published");
    const accountId = await seedAccount(tenantId, "Acme Corp");
    const c1 = await seedContact(tenantId, accountId, { firstName: "Ada", lastName: "Lovelace", email: "ada@acme.test" });
    const c2 = await seedContact(tenantId, accountId, { firstName: "Alan", lastName: "Turing", email: "alan@acme.test" });
    const c3 = await seedContact(tenantId, accountId, { firstName: "No", lastName: "Email", email: null });

    const res = await authed(sid, "POST", "/sales/link-export/build", {
      pageId,
      contactIds: [c1, c2, c3],
    });
    expect(res.status).toBe(200);
    const body = res.json as {
      pageId: number;
      skippedNoEmail: number;
      rows: Array<{ contactId: number; email: string; company: string; link: string }>;
    };
    expect(body.pageId).toBe(pageId);
    expect(body.rows).toHaveLength(2);
    expect(body.skippedNoEmail).toBe(1);
    const ids = body.rows.map(r => r.contactId).sort();
    expect(ids).toEqual([c1, c2].sort());
    for (const row of body.rows) {
      expect(row.company).toBe("Acme Corp");
      expect(row.link).toMatch(/\/p\/[A-Za-z0-9_-]+$/);
    }
    // Same (contact,page) → stable token across calls (find-or-create).
    const res2 = await authed(sid, "POST", "/sales/link-export/build", { pageId, contactIds: [c1] });
    const link2 = (res2.json as { rows: Array<{ link: string }> }).rows[0].link;
    const link1 = body.rows.find(r => r.contactId === c1)!.link;
    expect(link2).toBe(link1);
  });

  it("refuses to build links for an unpublished page", async () => {
    const { tenantId, sid } = await seedTenant();
    const draftPageId = await seedPage(tenantId, "draft");
    const accountId = await seedAccount(tenantId, "Draft Co");
    const c1 = await seedContact(tenantId, accountId, { firstName: "Grace", lastName: "Hopper", email: "grace@draft.test" });

    const res = await authed(sid, "POST", "/sales/link-export/build", { pageId: draftPageId, contactIds: [c1] });
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toMatch(/not published/i);
  });

  it("exposes the destination registry with CSV always configured", async () => {
    const { sid } = await seedTenant();
    const res = await authed(sid, "GET", "/sales/link-export/destinations");
    expect(res.status).toBe(200);
    const body = res.json as { destinations: Array<{ id: string; configured: boolean; resultType: string }> };
    const csv = body.destinations.find(d => d.id === "csv");
    expect(csv).toBeTruthy();
    expect(csv!.configured).toBe(true);
    expect(csv!.resultType).toBe("file");
    // Sheets + Marketo are present but not configured for a bare tenant.
    expect(body.destinations.some(d => d.id === "google_sheets")).toBe(true);
    expect(body.destinations.some(d => d.id === "marketo")).toBe(true);
  });

  it("streams a CSV file containing the personalized links", async () => {
    const { tenantId, sid } = await seedTenant();
    const pageId = await seedPage(tenantId, "published");
    const accountId = await seedAccount(tenantId, "CSV Co");
    const c1 = await seedContact(tenantId, accountId, { firstName: "Edsger", lastName: "Dijkstra", email: "edsger@csv.test" });

    const res = await authed(sid, "POST", "/sales/link-export/csv", { pageId, contactIds: [c1], options: {} });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=/);
    const text = res.text ?? "";
    expect(text).toContain("First Name,Last Name,Email,Company,Title,Personalized Link");
    expect(text).toContain("edsger@csv.test");
    expect(text).toContain("CSV Co");
    expect(text).toMatch(/\/p\/[A-Za-z0-9_-]+/);
  });

  it("is tenant-scoped: tenant B cannot build links against tenant A's page or contacts", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const pageA = await seedPage(a.tenantId, "published");
    const accountA = await seedAccount(a.tenantId, "Tenant A Co");
    const contactA = await seedContact(a.tenantId, accountA, { firstName: "Secret", lastName: "A", email: "secret@a.test" });

    // B references A's page → 404 (page not found in B's tenant).
    const pageRes = await authed(b.sid, "POST", "/sales/link-export/build", { pageId: pageA, contactIds: [contactA] });
    expect(pageRes.status).toBe(404);

    // Even with B's own published page, A's contact id resolves to nothing for B.
    const pageB = await seedPage(b.tenantId, "published");
    const res = await authed(b.sid, "POST", "/sales/link-export/build", { pageId: pageB, contactIds: [contactA] });
    expect(res.status).toBe(200);
    expect((res.json as { rows: unknown[] }).rows).toHaveLength(0);
  });
});
