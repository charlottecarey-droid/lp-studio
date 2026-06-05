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

/**
 * Bulk-seed many contacts in a single round-trip (a 600+ row audience done with
 * one INSERT-per-contact would dominate the test runtime). Emails may be null to
 * exercise the skipped-no-email path. Returns a firstName→id map so callers can
 * reconstruct the exact input order regardless of RETURNING order.
 */
async function seedContactsBulk(
  tenantId: number,
  accountId: number,
  specs: Array<{ firstName: string; lastName: string; email: string | null; status?: string }>,
): Promise<Map<string, number>> {
  const firstNames = specs.map(s => s.firstName);
  const lastNames = specs.map(s => s.lastName);
  const emails = specs.map(s => s.email);
  const statuses = specs.map(s => s.status ?? "active");
  const r = await pool.query<{ id: number; first_name: string }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     SELECT $1, $2, fn, ln, em, st
     FROM unnest($3::text[], $4::text[], $5::text[], $6::text[]) AS t(fn, ln, em, st)
     RETURNING id, first_name`,
    [tenantId, accountId, firstNames, lastNames, emails, statuses],
  );
  return new Map(r.rows.map(row => [row.first_name, row.id]));
}

// Mirror the LinkExportPanel client: it builds a large audience in chunks of
// BUILD_BATCH_SIZE rather than one giant request, accumulating rows + skipped
// counts across batches. The test drives the same shape so multi-batch behavior
// (the panel's real code path) is exercised end-to-end.
const PANEL_BUILD_BATCH_SIZE = 250;

async function runBatchedBuild(
  sid: string,
  pageId: number,
  contactIds: number[],
): Promise<{ rows: Array<{ contactId: number; link: string; company: string }>; skippedNoEmail: number; batches: number }> {
  const rows: Array<{ contactId: number; link: string; company: string }> = [];
  let skippedNoEmail = 0;
  let batches = 0;
  for (let i = 0; i < contactIds.length; i += PANEL_BUILD_BATCH_SIZE) {
    const chunk = contactIds.slice(i, i + PANEL_BUILD_BATCH_SIZE);
    const res = await authed(sid, "POST", "/sales/link-export/build", { pageId, contactIds: chunk });
    expect(res.status).toBe(200);
    const body = res.json as {
      skippedNoEmail: number;
      rows: Array<{ contactId: number; link: string; company: string }>;
    };
    rows.push(...body.rows);
    skippedNoEmail += body.skippedNoEmail;
    batches += 1;
  }
  return { rows, skippedNoEmail, batches };
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

  it(
    "builds reliable links for a large multi-batch audience: one link per active+emailed contact, stable order/tokens, accurate skips, idempotent re-build",
    async () => {
      const { tenantId, sid } = await seedTenant();
      const pageId = await seedPage(tenantId, "published");
      const accountId = await seedAccount(tenantId, "Big Audience Co");

      // 630 contacts spanning three panel batches (250 + 250 + 130). Every 21st
      // contact has no email (→ 30 skipped), the rest are active+emailed (→ 600
      // links). The no-email contacts are interleaved so each batch carries a
      // mix and the per-batch skip accounting must accumulate correctly.
      const TOTAL = 630;
      const specs = Array.from({ length: TOTAL }, (_, i) => {
        const firstName = `Big${String(i).padStart(4, "0")}`;
        const emailed = i % 21 !== 20;
        return {
          firstName,
          lastName: "Audience",
          email: emailed ? `${firstName.toLowerCase()}@big.test` : null,
        };
      });
      const expectedSkipped = specs.filter(s => s.email === null).length;
      const expectedLinks = TOTAL - expectedSkipped;
      expect(expectedSkipped).toBe(30);
      expect(expectedLinks).toBe(600);

      const idByName = await seedContactsBulk(tenantId, accountId, specs);
      // Input order = the spec order (interleaved emailed/no-email).
      const allContactIds = specs.map(s => idByName.get(s.firstName)!);
      const expectedUsableIdsInOrder = specs
        .filter(s => s.email !== null)
        .map(s => idByName.get(s.firstName)!);

      // First build, batched exactly like the panel.
      const first = await runBatchedBuild(sid, pageId, allContactIds);
      expect(first.batches).toBe(3);
      expect(first.skippedNoEmail).toBe(expectedSkipped);
      expect(first.rows).toHaveLength(expectedLinks);

      // Row ordering is preserved across the concurrency worker pool AND across
      // batch boundaries: concatenated rows match the usable contacts in input
      // order, with no duplicates or omissions.
      const builtIds = first.rows.map(r => r.contactId);
      expect(builtIds).toEqual(expectedUsableIdsInOrder);
      expect(new Set(builtIds).size).toBe(expectedLinks);

      for (const row of first.rows) {
        expect(row.company).toBe("Big Audience Co");
        expect(row.link).toMatch(/\/p\/[A-Za-z0-9_-]+$/);
      }

      // Exactly one hotlink row was created per usable contact — the bounded
      // concurrency + ON CONFLICT find-or-create never double-inserts.
      const countAfterFirst = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sales_hotlinks WHERE tenant_id = $1`,
        [tenantId],
      );
      expect(Number(countAfterFirst.rows[0].n)).toBe(expectedLinks);

      // Re-build the whole audience again (find-or-create) — idempotent: same
      // count of links, same skips, same token per contact, no new rows.
      const linkByContact = new Map(first.rows.map(r => [r.contactId, r.link]));
      const second = await runBatchedBuild(sid, pageId, allContactIds);
      expect(second.skippedNoEmail).toBe(expectedSkipped);
      expect(second.rows).toHaveLength(expectedLinks);
      expect(second.rows.map(r => r.contactId)).toEqual(expectedUsableIdsInOrder);
      for (const row of second.rows) {
        expect(row.link).toBe(linkByContact.get(row.contactId));
      }

      const countAfterSecond = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sales_hotlinks WHERE tenant_id = $1`,
        [tenantId],
      );
      expect(Number(countAfterSecond.rows[0].n)).toBe(expectedLinks);
    },
    120_000,
  );

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
    const body = res.json as { destinations: Array<{ id: string; configured: boolean; available: boolean; setupPath?: string; resultType: string }> };
    const csv = body.destinations.find(d => d.id === "csv");
    expect(csv).toBeTruthy();
    expect(csv!.configured).toBe(true);
    expect(csv!.available).toBe(true);
    expect(csv!.resultType).toBe("file");
    // Sheets + Marketo are present but not configured for a bare tenant.
    expect(body.destinations.some(d => d.id === "google_sheets")).toBe(true);
    expect(body.destinations.some(d => d.id === "marketo")).toBe(true);

    // Every destination named on the homepage promise is present.
    const salesforce = body.destinations.find(d => d.id === "salesforce");
    expect(salesforce).toBeTruthy();
    expect(salesforce!.available).toBe(true);
    expect(salesforce!.configured).toBe(false); // no SFDC connection for a bare tenant
    expect(salesforce!.setupPath).toBe("/sales/sfdc");

    const webhook = body.destinations.find(d => d.id === "webhook");
    expect(webhook).toBeTruthy();
    expect(webhook!.available).toBe(true);
    expect(webhook!.configured).toBe(false); // no webhook configured for a bare tenant
    expect(webhook!.setupPath).toBe("/integrations");

    // HubSpot is named on the homepage but not shippable yet — gated "coming soon".
    const hubspot = body.destinations.find(d => d.id === "hubspot");
    expect(hubspot).toBeTruthy();
    expect(hubspot!.available).toBe(false);
    expect(hubspot!.configured).toBe(false);
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
