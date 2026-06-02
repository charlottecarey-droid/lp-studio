/**
 * Critical-path smoke test for visitor-facing hotlink/token resolution
 * (GET /sales/resolve/:token). Pre-launch audit S7.
 *
 * This route is PUBLIC — recipients click a personalized link with no session.
 * In production it's exempted from requireAuth via the LP_PUBLIC list, and
 * requirePlanFeature("salesConsole") (mounted across /sales) self-exempts when
 * there's no authUser. We reproduce that here by mounting salesRouter WITHOUT
 * requireAuth, so a cookie-less request flows straight to the handler.
 *
 * Goal: catch "the recipient link is dead" regressions — route unmounted, 500,
 * inactive/unknown token not 404'd, or personalization silently dropped — NOT
 * exhaustive personalization edge cases. Runs against the REAL Postgres pool
 * via in-process inject(); each test seeds + tears down its own tenant data.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";

import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import { ensureHotlinkForContact } from "../../lib/ensureHotlink";
import salesRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];

async function seedTenant(): Promise<number> {
  const slug = `it-resolve-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Resolve Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

async function seedPage(tenantId: number, title: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, mode)
     VALUES ($1, $2, $3, 'published', 'sales') RETURNING id`,
    [tenantId, title, `resolve-${Math.floor(Math.random() * 1e9)}`],
  );
  return r.rows[0].id;
}

async function seedContact(
  tenantId: number,
  accountId: number,
  firstName: string,
  lastName: string,
): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
    [tenantId, accountId, firstName, lastName],
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

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  // Deliberately NO requireAuth — mirrors the LP_PUBLIC exemption so the public
  // resolve route is reachable, and requirePlanFeature self-exempts (no authUser).
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Hotlink/token resolution smoke", () => {
  it("resolves a live token to its page + contact identity and records a page_view signal", async () => {
    const tenantId = await seedTenant();
    const accountId = await seedAccount(tenantId, "Resolve Co");
    const contactId = await seedContact(tenantId, accountId, "Dana", "Visitor");
    const pageId = await seedPage(tenantId, "Resolve Smoke Page");
    const { id: hotlinkId, token } = await ensureHotlinkForContact(tenantId, contactId, pageId, null);

    const res = await inject(app, { method: "GET", url: `/sales/resolve/${token}` });

    expect(res.status).toBe(200);
    const body = res.json as {
      pageSlug: string;
      pageTitle: string;
      firstName: string;
      lastName: string;
      contactName: string;
      token: string;
      hotlinkId: number;
      contactId: number;
      accountId: number;
    };
    expect(body.pageTitle).toBe("Resolve Smoke Page");
    expect(body.firstName).toBe("Dana");
    expect(body.lastName).toBe("Visitor");
    expect(body.contactName).toContain("Dana");
    expect(body.token).toBe(token);
    expect(body.hotlinkId).toBe(hotlinkId);
    expect(body.contactId).toBe(contactId);
    expect(body.accountId).toBe(accountId);

    // A page_view signal must have been recorded for this visit.
    const sig = await pool.query<{ type: string; hotlink_id: number; tenant_id: number }>(
      `SELECT type, hotlink_id, tenant_id FROM sales_signals
       WHERE hotlink_id = $1 AND type = 'page_view'`,
      [hotlinkId],
    );
    expect(sig.rows.length).toBeGreaterThanOrEqual(1);
    expect(sig.rows[0].tenant_id).toBe(tenantId);
  });

  it("returns 404 for an unknown token", async () => {
    const res = await inject(app, { method: "GET", url: `/sales/resolve/this-token-does-not-exist` });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a soft-deleted (inactive) hotlink", async () => {
    const tenantId = await seedTenant();
    const accountId = await seedAccount(tenantId, "Inactive Co");
    const contactId = await seedContact(tenantId, accountId, "Gone", "Away");
    const pageId = await seedPage(tenantId, "Inactive Page");
    const { id: hotlinkId, token } = await ensureHotlinkForContact(tenantId, contactId, pageId, null);

    await pool.query(`UPDATE sales_hotlinks SET is_active = false WHERE id = $1`, [hotlinkId]);

    const res = await inject(app, { method: "GET", url: `/sales/resolve/${token}` });
    expect(res.status).toBe(404);
  });

  it("handles concurrent resolves of the same token without crashing", async () => {
    const tenantId = await seedTenant();
    const accountId = await seedAccount(tenantId, "Concurrent Co");
    const contactId = await seedContact(tenantId, accountId, "Race", "Condition");
    const pageId = await seedPage(tenantId, "Concurrent Page");
    const { token } = await ensureHotlinkForContact(tenantId, contactId, pageId, null);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => inject(app, { method: "GET", url: `/sales/resolve/${token}` })),
    );
    for (const r of results) expect(r.status).toBe(200);
  });
});
