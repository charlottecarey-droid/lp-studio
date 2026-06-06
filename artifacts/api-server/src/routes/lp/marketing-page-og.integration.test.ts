/**
 * Integration test for the marketing page share-card (Open Graph) endpoints.
 *
 * Runs the REAL marketing-page-og router against the REAL Postgres pool so the
 * `INSERT ... ON CONFLICT (page_key) DO UPDATE` upsert and the field-by-field
 * `toPublic()` fallback are exercised end-to-end.
 *
 * Requests are injected into the express app IN-PROCESS (no TCP socket): the
 * vitest worker pool in this environment cannot bind a listening port, so we
 * drive the router's `(req, res)` handler directly with a fabricated
 * IncomingMessage / ServerResponse pair. This still exercises the full
 * middleware chain (cookie-parser, body parsing, requireSuperadmin) and the
 * route handlers against the real DB.
 *
 * Asserted contract (Task: automated coverage for marketing share cards):
 *   1. GET /api/lp/page-og/:key is PUBLIC and returns the empty=fallback shape
 *      for an unset key (all "" / null), and the configured row once seeded.
 *   2. An unknown :key returns 404 on every route (public + admin GET/PUT).
 *   3. GET/PUT /api/admin/lp/page-og/:key are superadmin-gated (401 anon,
 *      403 non-superadmin, 200 superadmin).
 *   4. PUT upserts: a second PUT for the same key updates the same row (no
 *      duplicate), and the new values round-trip through the public GET.
 *
 * The test uses a real-but-isolated page key ("features") whose row it seeds and
 * tears down, so it never depends on whatever superadmin config happens to be in
 * the shared DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import marketingPageOgRouter from "./marketing-page-og";

// A real, validated marketing page key. We delete + restore its row around the
// suite so the shared DB's actual config is unaffected.
const PAGE_KEY = "features";
const UNKNOWN_KEY = "not-a-real-page";
const SUPER_SID = `it-super-${randomUUID()}`;
const TENANT_SID = `it-tenant-${randomUUID()}`;
const TENANT_SLUG = `it-pageog-${Date.now()}`;

let tenantId: number;
let app: Express;
/** Snapshot of the pre-existing row (if any) so we can restore it on teardown. */
let savedRow:
  | {
      og_title: string;
      og_description: string;
      og_image_url: string;
      og_image_width: number | null;
      og_image_height: number | null;
    }
  | null
  | undefined;

function injectSid(opts: { method: string; url: string; sid?: string; body?: unknown }): Promise<InjectResponse> {
  const headers = opts.sid ? { cookie: `${SESSION_COOKIE}=${opts.sid}` } : undefined;
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

beforeAll(async () => {
  // Stash + clear the real row so we always start from "unset".
  const existing = await pool.query(
    `SELECT og_title, og_description, og_image_url, og_image_width, og_image_height
       FROM marketing_page_og WHERE page_key = $1 LIMIT 1`,
    [PAGE_KEY],
  );
  savedRow = existing.rows[0] ?? null;
  await pool.query(`DELETE FROM marketing_page_og WHERE page_key = $1`, [PAGE_KEY]).catch(() => {});

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT PageOG Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  await seedSession(SUPER_SID, { userId: 999100001, tenantId: null, role: "superadmin", appUserRole: "superadmin" });
  await seedSession(TENANT_SID, { userId: 999100002, tenantId, role: "admin", isAdmin: true, appUserRole: null });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", marketingPageOgRouter);
});

afterAll(async () => {
  await pool.query(`DELETE FROM marketing_page_og WHERE page_key = $1`, [PAGE_KEY]).catch(() => {});
  // Restore the original row so we leave the shared DB as we found it.
  if (savedRow) {
    await pool
      .query(
        `INSERT INTO marketing_page_og
           (page_key, og_title, og_description, og_image_url, og_image_width, og_image_height, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (page_key) DO UPDATE SET
           og_title = EXCLUDED.og_title,
           og_description = EXCLUDED.og_description,
           og_image_url = EXCLUDED.og_image_url,
           og_image_width = EXCLUDED.og_image_width,
           og_image_height = EXCLUDED.og_image_height,
           updated_at = now()`,
        [
          PAGE_KEY,
          savedRow.og_title,
          savedRow.og_description,
          savedRow.og_image_url,
          savedRow.og_image_width,
          savedRow.og_image_height,
        ],
      )
      .catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, TENANT_SID]]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
});

describe("GET /api/lp/page-og/:key (public)", () => {
  it("returns the empty=fallback shape for an unset key", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/page-og/${PAGE_KEY}` });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      title: "",
      description: "",
      imageUrl: "",
      imageWidth: null,
      imageHeight: null,
    });
  });

  it("does not require auth (no cookie still 200)", async () => {
    const res = await inject(app, { method: "GET", url: `/api/lp/page-og/${PAGE_KEY}` });
    expect(res.status).toBe(200);
  });

  it("404s an unknown page key", async () => {
    const res = await injectSid({ method: "GET", url: `/api/lp/page-og/${UNKNOWN_KEY}` });
    expect(res.status).toBe(404);
  });
});

describe("admin GET/PUT /api/admin/lp/page-og/:key (superadmin gated)", () => {
  it("401s an anonymous PUT", async () => {
    const res = await inject(app, {
      method: "PUT",
      url: `/api/admin/lp/page-og/${PAGE_KEY}`,
      body: { title: "x" },
    });
    expect(res.status).toBe(401);
  });

  it("403s a non-superadmin PUT", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/page-og/${PAGE_KEY}`,
      sid: TENANT_SID,
      body: { title: "x" },
    });
    expect(res.status).toBe(403);
  });

  it("403s a non-superadmin GET", async () => {
    const res = await injectSid({ method: "GET", url: `/api/admin/lp/page-og/${PAGE_KEY}`, sid: TENANT_SID });
    expect(res.status).toBe(403);
  });

  it("404s an unknown key even for a superadmin", async () => {
    const get = await injectSid({ method: "GET", url: `/api/admin/lp/page-og/${UNKNOWN_KEY}`, sid: SUPER_SID });
    expect(get.status).toBe(404);
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/page-og/${UNKNOWN_KEY}`,
      sid: SUPER_SID,
      body: { title: "x" },
    });
    expect(put.status).toBe(404);
  });

  it("superadmin PUT upserts and the public GET reflects it", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/page-og/${PAGE_KEY}`,
      sid: SUPER_SID,
      body: {
        title: "Features — configured",
        description: "Configured share card description.",
        imageUrl: "  /api/storage/og-feature.jpg  ",
        imageWidth: "1200",
        imageHeight: 630.7,
      },
    });
    expect(put.status).toBe(200);
    // Server trims the imageUrl and truncates dims to positive ints.
    expect(put.json).toEqual({
      title: "Features — configured",
      description: "Configured share card description.",
      imageUrl: "/api/storage/og-feature.jpg",
      imageWidth: 1200,
      imageHeight: 630,
    });

    // Exactly one row for this key — upsert, not insert-duplicate.
    const count = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM marketing_page_og WHERE page_key = $1`,
      [PAGE_KEY],
    );
    expect(count.rows[0].n).toBe(1);

    const pub = await inject(app, { method: "GET", url: `/api/lp/page-og/${PAGE_KEY}` });
    expect(pub.status).toBe(200);
    expect(pub.json).toMatchObject({
      title: "Features — configured",
      imageUrl: "/api/storage/og-feature.jpg",
    });
  });

  it("a second PUT updates the same row (no duplicate)", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/page-og/${PAGE_KEY}`,
      sid: SUPER_SID,
      body: { title: "Features — v2", description: "v2", imageUrl: "" },
    });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ title: "Features — v2", imageUrl: "", imageWidth: null, imageHeight: null });

    const count = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM marketing_page_og WHERE page_key = $1`,
      [PAGE_KEY],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("rejects a non-positive image dimension by storing null", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/page-og/${PAGE_KEY}`,
      sid: SUPER_SID,
      body: { title: "dims", imageUrl: "https://cdn.example.com/x.png", imageWidth: -5, imageHeight: 0 },
    });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ imageWidth: null, imageHeight: null });
  });
});
