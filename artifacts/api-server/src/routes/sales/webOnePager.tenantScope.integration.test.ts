/**
 * Regression: web one-pagers belong to the SIGNED-IN workspace.
 *
 * POST /web-one-pager used to take `tenantId` from the request body, so any
 * signed-in user could publish a page into another workspace by sending its
 * id. The view-count endpoint likewise answered for any page id. Both now use
 * the session's workspace only.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pool } from "@workspace/db";
import { dbAvailable } from "../../test-utils/dbAvailable";
import { inject } from "../../test-utils/injectRequest";
import webOnePagerRouter from "./web-one-pager";

const RUN = Date.now();
let tenantA = 0;
let tenantB = 0;
let pageB = 0;
let app: Express;

async function mkTenant(suffix: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings) VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT OnePager Scope ${suffix}`, `it-onepager-scope-${suffix}-${RUN}`],
  );
  return t.rows[0].id;
}

beforeAll(async () => {
  if (!dbAvailable) return;
  tenantA = await mkTenant("a");
  tenantB = await mkTenant("b");
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status) VALUES ($1, 'B page', $2, '[]'::jsonb, 'published') RETURNING id`,
    [tenantB, `it-scope-b-${RUN}`],
  );
  pageB = p.rows[0].id;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  // A member of workspace A (what requireAuth sets in the real app).
  app.use((req, _res, next) => {
    req.authUser = { userId: 999400001, email: "a@example.com", name: "A", tenantId: tenantA, role: "admin", permissions: {}, isAdmin: false, appUserRole: null };
    next();
  });
  app.use(webOnePagerRouter);
});

afterAll(async () => {
  for (const t of [tenantA, tenantB]) {
    if (!t) continue;
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [t]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [t]).catch(() => {});
  }
});

describe.skipIf(!dbAvailable)("web one-pager workspace scoping", () => {
  it("creates the page in the signed-in workspace even when the body names another", async () => {
    const res = await inject(app, { method: "POST", url: "/web-one-pager", body: { dsoName: "Scope Test DSO", tenantId: tenantB } });
    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId: number }).pageId;
    const { rows } = await pool.query<{ tenant_id: number }>(`SELECT tenant_id FROM lp_pages WHERE id = $1`, [pageId]);
    expect(rows[0].tenant_id).toBe(tenantA);
    const inB = await pool.query(`SELECT 1 FROM lp_pages WHERE tenant_id = $1 AND title ILIKE '%Scope Test DSO%'`, [tenantB]);
    expect(inB.rowCount).toBe(0);
  });

  it("does not report view counts for another workspace's page", async () => {
    const res = await inject(app, { method: "GET", url: `/web-one-pager/views/${pageB}` });
    expect(res.status).toBe(404);
  });
});
