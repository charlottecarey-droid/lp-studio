/**
 * Regression test for task #507 (complements #490/#506): the authenticated
 * pages list (GET /lp/pages) MUST return a tenant's pages ordered by
 * `updatedAt` descending — most-recently-edited work first.
 *
 * Background: #490/#506 proved that background canary writes don't bump a
 * page's `updatedAt` while genuine edits do. This test locks in the
 * user-visible consequence: the dashboard / pages-gallery "recent work"
 * ordering. Without an assertion here, a future change to the list handler's
 * `orderBy` could silently scramble the order the user sees.
 *
 * Drives the REAL lp/pages GET handler IN-PROCESS (the vitest worker pool here
 * can't bind a listening port — see test-utils/injectRequest.ts), seeding a
 * session row directly so no network/OAuth is needed. The seeded pages have
 * their `updated_at` set explicitly via raw SQL (which bypasses Drizzle's
 * `$onUpdate` hook) so we control the exact ordering independent of insert
 * order. Gated on DB availability so it skips cleanly without a database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";

const TENANT_SLUG = `it-listorder-${Date.now()}`;
const SLUG_PREFIX = `it-listorder-page-${Date.now()}`;
const SID = `it-listorder-${randomUUID()}`;
const USER_ID = 999100002;

// Three pages, edited oldest → newest. We insert them in a deliberately
// SCRAMBLED order (middle, newest, oldest) and then stamp updated_at
// explicitly, so a handler that accidentally returns insert/id order rather
// than updatedAt order would fail.
const PAGES = [
  { slug: `${SLUG_PREFIX}-a`, title: "Page A (oldest edit)", updatedAt: "2026-01-01T00:00:00Z" },
  { slug: `${SLUG_PREFIX}-b`, title: "Page B (middle edit)", updatedAt: "2026-03-01T00:00:00Z" },
  { slug: `${SLUG_PREFIX}-c`, title: "Page C (newest edit)", updatedAt: "2026-05-01T00:00:00Z" },
];
const INSERT_ORDER = [1, 2, 0]; // indices into PAGES: B, C, A
const EXPECTED_SLUG_ORDER = [
  `${SLUG_PREFIX}-c`,
  `${SLUG_PREFIX}-b`,
  `${SLUG_PREFIX}-a`,
];

let tenantId: number;
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
// is evaluated when the suite is registered, BEFORE `beforeAll` runs.
const hasDb = await dbReachable();

function sessJson(): string {
  const full: AuthUser = {
    userId: USER_ID,
    email: "it-listorder@example.com",
    name: "List Order IT",
    avatarUrl: null,
    tenantId,
    role: "editor",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
  };
  return JSON.stringify(full);
}

async function cleanup(): Promise<void> {
  await pool
    .query(`DELETE FROM lp_pages WHERE slug LIKE $1`, [`${SLUG_PREFIX}%`])
    .catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  if (!hasDb) return;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT ListOrder Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // Insert in scrambled order, stamping updated_at explicitly. Raw SQL bypasses
  // Drizzle's $onUpdate hook so the timestamps stick exactly as written.
  for (const idx of INSERT_ORDER) {
    const p = PAGES[idx];
    await pool.query(
      `INSERT INTO lp_pages (tenant_id, title, slug, status, updated_at)
       VALUES ($1, $2, $3, 'draft', $4)`,
      [tenantId, p.title, p.slug, p.updatedAt],
    );
  }

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [SID, sessJson()],
  );

  const { default: pagesRouter } = await import("./pages");
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(pagesRouter);
});

afterAll(async () => {
  if (hasDb) await cleanup();
});

describe.skipIf(!hasDb)("GET /lp/pages ordering by updatedAt desc (task #507)", () => {
  it("returns the tenant's pages most-recently-edited first", async () => {
    const res = await inject(app, {
      method: "GET",
      url: "/lp/pages",
      headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);

    const rows = res.json as { slug: string; updatedAt: string }[];
    // Restrict to this test's seeded pages — the tenant is fresh, but be
    // defensive in case anything else writes under it.
    const ours = rows.filter((r) => r.slug.startsWith(SLUG_PREFIX));
    expect(ours.map((r) => r.slug)).toEqual(EXPECTED_SLUG_ORDER);

    // Stronger invariant: updatedAt is monotonically non-increasing across the
    // whole response, so the ordering holds regardless of which rows exist.
    const times = rows.map((r) => new Date(r.updatedAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });
});
