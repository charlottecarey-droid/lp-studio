/**
 * Integration test for the tenant block-governance route (task #4).
 *
 * Runs the REAL tenantBlockGovernance router against the REAL Postgres pool so
 * the full-replace upsert + the "drop all-default rows" invariant are exercised
 * end-to-end. Sessions are seeded directly into `app_sessions`; requests are
 * injected IN-PROCESS (the vitest pool here cannot bind a port). See
 * blockCatalog.integration.test.ts for the same harness rationale.
 *
 * Asserted contract:
 *   1. GET on a virgin tenant returns an empty entry list (fail-open).
 *   2. PUT persists divergent entries and GET round-trips them.
 *   3. All-default entries are NOT persisted (empty == current behaviour).
 *   4. PUT is a full replace (omitted entries disappear).
 *   5. The write gate matches block-library-prefs (pages/settings/admin); a
 *      caller with none of those permissions is rejected with 403.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import governanceRouter from "./tenantBlockGovernance";

const TENANT_SLUG = `it-gov-${Date.now()}`;
const EDITOR_SID = `it-gov-editor-${randomUUID()}`;
const VIEWER_SID = `it-gov-viewer-${randomUUID()}`;

let tenantId: number;
let app: Express;

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

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM tenant_block_governance WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[EDITOR_SID, VIEWER_SID]]).catch(() => {});
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Governance Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // Editor: a tenant member with the "pages" permission (same gate as prefs).
  await seedSession(EDITOR_SID, {
    userId: 999100001,
    tenantId,
    role: "editor",
    isAdmin: true, // skip host-enforcement branch (127.0.0.1 maps to no tenant)
    permissions: { pages: true },
  });
  // Viewer: a tenant member with NO pages/settings permission and not admin.
  // isAdmin:false so the route's own permission gate (not isAdmin) decides;
  // requireAuth host-enforcement passes because 127.0.0.1 maps to no tenant.
  await seedSession(VIEWER_SID, {
    userId: 999100002,
    tenantId,
    role: "viewer",
    isAdmin: false,
    permissions: {},
  });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", governanceRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("tenant block-governance round-trip", () => {
  it("GET on a virgin tenant returns an empty entry list (fail-open)", async () => {
    const res = await injectSid({ method: "GET", url: "/api/tenant/block-governance", sid: EDITOR_SID });
    expect(res.status).toBe(200);
    expect((res.json as { entries: unknown[] }).entries).toEqual([]);
  });

  it("PUT persists divergent entries; GET round-trips them; all-default rows are dropped", async () => {
    const put = await injectSid({
      method: "PUT",
      url: "/api/tenant/block-governance",
      sid: EDITOR_SID,
      body: {
        entries: [
          // Use non-alias block types so canonicalization is a no-op here.
          { blockType: "hero", enabled: false, aiMode: "open", segments: [] }, // diverges (disabled)
          { blockType: "pricing-table", enabled: null, aiMode: "locked", segments: ["s1", "s2"] }, // diverges (mode+seg)
          { blockType: "faq", enabled: null, aiMode: "open", segments: [] }, // all-default → dropped
        ],
      },
    });
    expect(put.status).toBe(200);
    const persisted = (put.json as { entries: Array<{ blockType: string }> }).entries;
    expect(persisted.map((e) => e.blockType).sort()).toEqual(["hero", "pricing-table"]);

    const get = await injectSid({ method: "GET", url: "/api/tenant/block-governance", sid: EDITOR_SID });
    const entries = (get.json as { entries: Array<{ blockType: string; enabled: boolean | null; aiMode: string; segments: string[] }> }).entries;
    const byType = Object.fromEntries(entries.map((e) => [e.blockType, e]));
    expect(byType.hero).toMatchObject({ enabled: false, aiMode: "open", segments: [] });
    expect(byType["pricing-table"]).toMatchObject({ enabled: null, aiMode: "locked" });
    expect(byType["pricing-table"].segments.sort()).toEqual(["s1", "s2"]);
    expect(byType.faq).toBeUndefined(); // never persisted
  });

  it("PUT is a full replace — omitted entries disappear", async () => {
    const put = await injectSid({
      method: "PUT",
      url: "/api/tenant/block-governance",
      sid: EDITOR_SID,
      body: { entries: [{ blockType: "hero", enabled: false, aiMode: "open", segments: [] }] },
    });
    expect(put.status).toBe(200);

    const get = await injectSid({ method: "GET", url: "/api/tenant/block-governance", sid: EDITOR_SID });
    const entries = (get.json as { entries: Array<{ blockType: string }> }).entries;
    expect(entries.map((e) => e.blockType)).toEqual(["hero"]); // cta gone
  });

  it("canonicalizes block types on store so an alias round-trips as its canonical name", async () => {
    // "features" is a known alias of the canonical renderable "benefits-grid".
    const put = await injectSid({
      method: "PUT",
      url: "/api/tenant/block-governance",
      sid: EDITOR_SID,
      body: { entries: [{ blockType: "features", enabled: false, aiMode: "open", segments: [] }] },
    });
    expect(put.status).toBe(200);
    const get = await injectSid({ method: "GET", url: "/api/tenant/block-governance", sid: EDITOR_SID });
    const entries = (get.json as { entries: Array<{ blockType: string }> }).entries;
    expect(entries.map((e) => e.blockType)).toEqual(["benefits-grid"]);
  });

  it("rejects a caller without pages/settings/admin (403)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/tenant/block-governance",
      sid: VIEWER_SID,
      body: { entries: [] },
    });
    expect(res.status).toBe(403);
  });
});
