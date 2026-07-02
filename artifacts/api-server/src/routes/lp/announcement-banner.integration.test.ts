/**
 * Integration test for the marketing homepage announcement-banner endpoints.
 *
 * Runs the REAL announcement-banner router against the REAL Postgres pool so the
 * single-row `INSERT ... ON CONFLICT (id) DO UPDATE` upsert, the `toPublic()`
 * fallback, and the link-URL safety guard are exercised end-to-end.
 *
 * Requests are injected into the express app IN-PROCESS (no TCP socket): the
 * vitest worker pool here cannot bind a listening port, so we drive the
 * router's `(req, res)` handler directly. This still exercises the full
 * middleware chain (cookie-parser, body parsing, requireSuperadmin).
 *
 * Asserted contract:
 *   1. GET /api/lp/announcement-banner is PUBLIC (no auth) and returns the
 *      single config row's public shape.
 *   2. GET/PUT /api/admin/lp/announcement-banner are superadmin-gated
 *      (401 anon, 403 non-superadmin, 200 superadmin).
 *   3. PUT upserts the single row (id=1, no duplicate) and round-trips through
 *      the public GET.
 *   4. PUT rejects a non-http(s) link URL (javascript:/data:) with 400 — the
 *      link is rendered into an <a href> on the public homepage, so this is a
 *      stored-XSS guard — and accepts http(s).
 *
 * The suite stashes + restores the real single row so the shared DB is left as
 * it was found.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import announcementBannerRouter from "./announcement-banner";

const SUPER_SID = `it-super-${randomUUID()}`;
const TENANT_SID = `it-tenant-${randomUUID()}`;
const TENANT_SLUG = `it-banner-${Date.now()}`;

let tenantId: number;
let app: Express;
/** Snapshot of the pre-existing row (if any) so we can restore it on teardown. */
let savedRow:
  | { enabled: boolean; text: string; link_url: string; cta_label: string }
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
  const existing = await pool.query(
    `SELECT enabled, text, link_url, cta_label
       FROM marketing_announcement_banner ORDER BY id ASC LIMIT 1`,
  );
  savedRow = existing.rows[0] ?? null;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Banner Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  await seedSession(SUPER_SID, { userId: 999200001, tenantId: null, role: "superadmin", appUserRole: "superadmin" });
  await seedSession(TENANT_SID, { userId: 999200002, tenantId, role: "admin", isAdmin: true, appUserRole: null });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", announcementBannerRouter);
});

afterAll(async () => {
  // Restore the original single row exactly as found (or clear if there was none).
  if (savedRow) {
    await pool
      .query(
        `INSERT INTO marketing_announcement_banner (id, enabled, text, link_url, cta_label, updated_at)
         VALUES (1, $1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET
           enabled = EXCLUDED.enabled, text = EXCLUDED.text,
           link_url = EXCLUDED.link_url, cta_label = EXCLUDED.cta_label, updated_at = now()`,
        [savedRow.enabled, savedRow.text, savedRow.link_url, savedRow.cta_label],
      )
      .catch(() => {});
  } else {
    await pool.query(`DELETE FROM marketing_announcement_banner WHERE id = 1`).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, TENANT_SID]]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("GET /api/lp/announcement-banner (public)", () => {
  it("does not require auth (no cookie still 200) and returns the public shape", async () => {
    const res = await inject(app, { method: "GET", url: `/api/lp/announcement-banner` });
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty("enabled");
    expect(res.json).toHaveProperty("text");
    expect(res.json).toHaveProperty("linkUrl");
    expect(res.json).toHaveProperty("ctaLabel");
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("admin GET/PUT /api/admin/lp/announcement-banner (superadmin gated)", () => {
  it("401s an anonymous PUT", async () => {
    const res = await inject(app, {
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      body: { enabled: true, text: "x", linkUrl: "https://example.com" },
    });
    expect(res.status).toBe(401);
  });

  it("403s a non-superadmin PUT and GET", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      sid: TENANT_SID,
      body: { enabled: true, text: "x", linkUrl: "https://example.com" },
    });
    expect(put.status).toBe(403);
    const get = await injectSid({ method: "GET", url: `/api/admin/lp/announcement-banner`, sid: TENANT_SID });
    expect(get.status).toBe(403);
  });

  it("superadmin PUT upserts the single row and the public GET reflects it", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      sid: SUPER_SID,
      body: {
        enabled: true,
        text: "  Read our new guide  ",
        linkUrl: "  https://test-lp.lpstudio.ai/api/storage/objects/uploads/abc  ",
        ctaLabel: "  Read the guide  ",
      },
    });
    expect(put.status).toBe(200);
    // Server trims all string fields.
    expect(put.json).toEqual({
      enabled: true,
      text: "Read our new guide",
      linkUrl: "https://test-lp.lpstudio.ai/api/storage/objects/uploads/abc",
      ctaLabel: "Read the guide",
    });

    // Exactly one row — upsert on id=1, never insert-duplicate.
    const count = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM marketing_announcement_banner`,
    );
    expect(count.rows[0].n).toBe(1);

    const pub = await inject(app, { method: "GET", url: `/api/lp/announcement-banner` });
    expect(pub.status).toBe(200);
    expect(pub.json).toMatchObject({ enabled: true, text: "Read our new guide" });
  });

  it("a second PUT updates the same row (no duplicate)", async () => {
    const put = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      sid: SUPER_SID,
      body: { enabled: false, text: "v2", linkUrl: "https://example.com/v2", ctaLabel: "" },
    });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ enabled: false, text: "v2", ctaLabel: "" });

    const count = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM marketing_announcement_banner`,
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("rejects a javascript: link URL with 400 (stored-XSS guard)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      sid: SUPER_SID,
      // eslint-disable-next-line no-script-url
      body: { enabled: true, text: "evil", linkUrl: "javascript:alert(1)", ctaLabel: "go" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a data: link URL with 400", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      sid: SUPER_SID,
      body: { enabled: true, text: "evil", linkUrl: "data:text/html,<script>1</script>", ctaLabel: "go" },
    });
    expect(res.status).toBe(400);
  });

  it("accepts an empty link URL (banner just won't render client-side)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/api/admin/lp/announcement-banner`,
      sid: SUPER_SID,
      body: { enabled: false, text: "", linkUrl: "", ctaLabel: "" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ linkUrl: "" });
  });
});
