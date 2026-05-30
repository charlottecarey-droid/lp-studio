/**
 * Regression test for task #490: the scheduled asset-health canary must NOT
 * bump a page's `updatedAt`, while a genuine user edit MUST advance it.
 *
 * Background: `persistResult` (assetHealthCheck.ts) writes
 * `assetHealthCheckedAt` + `assetHealthResult` on every 15-minute sweep. Without
 * the explicit `updatedAt: sql\`${lpPagesTable.updatedAt}\`` self-assign, Drizzle's
 * `$onUpdate` hook (lpPages.ts) would stamp `updatedAt = now()` on every scan,
 * scrambling the dashboard "recent work" + pages-list sort order. This test
 * locks that behaviour in so a future change can't silently re-introduce the bug.
 *
 * Runs against the REAL Postgres pool. The genuine-edit half drives the REAL
 * lp/pages PUT handler IN-PROCESS (the vitest worker pool here can't bind a
 * listening port — see test-utils/injectRequest.ts), seeding a session row
 * directly so no network/OAuth is needed. Gated on DB availability so it skips
 * cleanly in environments without a database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";
import { persistResult, type AssetHealthResult } from "./assetHealthCheck";

const TENANT_SLUG = `it-ahc-${Date.now()}`;
const PAGE_SLUG = `it-ahc-page-${Date.now()}`;
const SID = `it-ahc-${randomUUID()}`;
const USER_ID = 999100001;

let tenantId: number;
let pageId: number;
let app: Express;

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// Resolve DB availability at collection time (top-level await): `describe.skipIf`
// is evaluated when the suite is registered, BEFORE `beforeAll` runs, so a flag
// set inside `beforeAll` would always read false here.
const hasDb = await dbReachable();

async function getUpdatedAt(id: number): Promise<number> {
  const r = await pool.query<{ updated_at: Date }>(
    `SELECT updated_at FROM lp_pages WHERE id = $1`,
    [id],
  );
  return new Date(r.rows[0].updated_at).getTime();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sessJson(): string {
  const full: AuthUser = {
    userId: USER_ID,
    email: "it-ahc@example.com",
    name: "AHC IT",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return JSON.stringify(full);
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM lp_pages WHERE slug = $1`, [PAGE_SLUG]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  if (!hasDb) return;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT AHC Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // Keep the page in 'draft' so the PUT handler's published-render/delete
  // side effects (R2/network) never fire.
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status)
     VALUES ($1, 'IT AHC Page', $2, 'draft')
     RETURNING id`,
    [tenantId, PAGE_SLUG],
  );
  pageId = p.rows[0].id;

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [SID, sessJson()],
  );

  const { default: pagesRouter } = await import("../routes/lp/pages");
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(pagesRouter);
});

afterAll(async () => {
  if (hasDb) await cleanup();
});

describe.skipIf(!hasDb)("asset-health persistence vs. updatedAt (task #490)", () => {
  it("persistResult does NOT change updatedAt (background canary write)", async () => {
    const before = await getUpdatedAt(pageId);
    // Ensure enough wall-clock delta that an accidental now() stamp would be
    // measurably different from the original timestamp.
    await sleep(25);

    const result: AssetHealthResult = {
      checked: 2,
      brokenAssets: [],
      host: "example.com",
      hadHtml: true,
    };
    await persistResult(pageId, result);

    const after = await getUpdatedAt(pageId);
    expect(after).toBe(before);

    // Sanity: the write actually happened (proves we're not just observing a
    // no-op). asset_health_result + asset_health_checked_at must be populated.
    const r = await pool.query<{ asset_health_result: unknown; asset_health_checked_at: Date | null }>(
      `SELECT asset_health_result, asset_health_checked_at FROM lp_pages WHERE id = $1`,
      [pageId],
    );
    expect(r.rows[0].asset_health_result).toEqual(result);
    expect(r.rows[0].asset_health_checked_at).not.toBeNull();
  });

  it("a genuine user edit (PUT /lp/pages/:id) DOES advance updatedAt", async () => {
    const before = await getUpdatedAt(pageId);
    await sleep(25);

    const res = await inject(app, {
      method: "PUT",
      url: `/lp/pages/${pageId}`,
      headers: { cookie: `${SESSION_COOKIE}=${SID}` },
      body: { title: "Edited By User" },
    });
    expect(res.status).toBe(200);

    const after = await getUpdatedAt(pageId);
    expect(after).toBeGreaterThan(before);
  });
});
