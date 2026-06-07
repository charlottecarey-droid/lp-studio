/**
 * Integration test for the brand-save logo media tagging (Task #1173, tested
 * under Task #1177).
 *
 * Runs the REAL brand router against the REAL Postgres pool, injecting requests
 * IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/injectRequest). The full middleware chain runs (cookie-parser,
 * body parsing, requireAuth, the PUT /lp/brand handler + its DB writes).
 *
 * Asserted contract:
 *   1. Saving Brand Settings with a logoUrl (and logoUrlDark) merges a "logo"
 *      tag onto the matching tenant-scoped lp_media rows.
 *   2. Tagging is idempotent — re-saving does not duplicate the tag, and other
 *      pre-existing tags are preserved.
 *   3. It is a no-op when no media row matches the stored logo path (e.g. an
 *      external URL), and never tags another tenant's identically-URL'd row.
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
import brandRouter from "./brand";

const SID = `it-brandlogo-${randomUUID()}`;
const UID = 999117701;
const LOGO_URL = `/api/storage/it-brandlogo-${randomUUID().slice(0, 8)}.png`;
const LOGO_URL_DARK = `/api/storage/it-brandlogo-dark-${randomUUID().slice(0, 8)}.png`;
const EXTERNAL_LOGO_URL = `https://cdn.example.com/it-brandlogo-${randomUUID().slice(0, 8)}.png`;

let app: Express;
let tenantId = 0;
let otherTenantId = 0;
let lightMediaId = 0;
let darkMediaId = 0;
let otherMediaId = 0;

function injectSid(opts: {
  method: string;
  url: string;
  sid?: string;
  body?: unknown;
}): Promise<InjectResponse> {
  const headers: Record<string, string> = {};
  if (opts.sid) headers["cookie"] = `${SESSION_COOKIE}=${opts.sid}`;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: "it-brandlogo@example.com",
    name: "IT Brand Logo",
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

async function seedMedia(tid: number, url: string, tags: string[]): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, tags)
     VALUES ($1, 'logo', $2, 'image', $3::jsonb) RETURNING id`,
    [tid, url, JSON.stringify(tags)],
  );
  return r.rows[0]!.id;
}

async function tagsOf(id: number): Promise<string[]> {
  const r = await pool.query<{ tags: string[] }>(`SELECT tags FROM lp_media WHERE id = $1`, [id]);
  return (r.rows[0]?.tags as string[]) ?? [];
}

/**
 * The PUT /lp/brand handler sends its response BEFORE the best-effort logo
 * tagging finishes (the tag writes run after res.json), so a read immediately
 * after the response can race the tagging. Poll with a short bounded wait until
 * the predicate holds, so the assertions test eventual state, not timing.
 */
async function waitForTags(
  id: number,
  predicate: (tags: string[]) => boolean,
  timeoutMs = 5000,
): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  let tags = await tagsOf(id);
  while (!predicate(tags) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    tags = await tagsOf(id);
  }
  return tags;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  for (const id of [lightMediaId, darkMediaId, otherMediaId]) {
    if (id) await pool.query(`DELETE FROM lp_media WHERE id = $1`, [id]).catch(() => {});
  }
  for (const tid of [tenantId, otherTenantId]) {
    if (tid) {
      await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tid]).catch(() => {});
      await pool.query(`DELETE FROM tenants WHERE id = $1`, [tid]).catch(() => {});
    }
  }
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT Brand Logo', $1, 'active') RETURNING id`,
    [`it-brandlogo-t-${randomUUID().slice(0, 8)}`],
  );
  tenantId = t.rows[0]!.id;
  const t2 = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT Brand Logo Other', $1, 'active') RETURNING id`,
    [`it-brandlogo-t2-${randomUUID().slice(0, 8)}`],
  );
  otherTenantId = t2.rows[0]!.id;

  // Light logo row has a pre-existing tag — tagging must preserve it.
  lightMediaId = await seedMedia(tenantId, LOGO_URL, ["brand"]);
  darkMediaId = await seedMedia(tenantId, LOGO_URL_DARK, []);
  // Another tenant owns a row with the SAME url as our light logo — must NOT be
  // tagged when our tenant saves its brand (tenant-scoped match).
  otherMediaId = await seedMedia(otherTenantId, LOGO_URL, []);

  await seedSession(SID, { userId: UID, tenantId, role: "admin", isAdmin: true });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", requireAuth, brandRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("PUT /lp/brand — logo media tagging", () => {
  it("401s without a session", async () => {
    const res = await injectSid({ method: "PUT", url: "/api/lp/brand", body: { logoUrl: LOGO_URL } });
    expect(res.status).toBe(401);
  });

  it("merges a 'logo' tag onto the matching light + dark media rows, preserving existing tags", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/lp/brand",
      sid: SID,
      body: { logoUrl: LOGO_URL, logoUrlDark: LOGO_URL_DARK, primaryColor: "#123456" },
    });
    expect(res.status).toBe(200);

    const lightTags = await waitForTags(lightMediaId, (t) => t.includes("logo"));
    const darkTags = await waitForTags(darkMediaId, (t) => t.includes("logo"));
    expect(lightTags).toContain("logo");
    expect(lightTags).toContain("brand"); // pre-existing tag preserved
    expect(darkTags).toContain("logo");
    // The other tenant's identically-URL'd row is untouched.
    expect(await tagsOf(otherMediaId)).not.toContain("logo");
  });

  it("is idempotent — re-saving does not duplicate the 'logo' tag", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/lp/brand",
      sid: SID,
      body: { logoUrl: LOGO_URL, logoUrlDark: LOGO_URL_DARK },
    });
    expect(res.status).toBe(200);
    // The tag is already present from the prior save; allow the (no-op) re-tag
    // pass to settle, then assert it was not duplicated.
    await new Promise((r) => setTimeout(r, 200));
    const lightTags = await tagsOf(lightMediaId);
    expect(lightTags.filter((t) => t === "logo")).toHaveLength(1);
  });

  it("is a no-op when no media row matches the logo url (e.g. an external URL)", async () => {
    const res = await injectSid({
      method: "PUT",
      url: "/api/lp/brand",
      sid: SID,
      body: { logoUrl: EXTERNAL_LOGO_URL },
    });
    expect(res.status).toBe(200);
    // No row matches the external URL, so nothing new is tagged. The previously
    // tagged rows still carry their 'logo' tag (untouched by this save).
    expect(await tagsOf(lightMediaId)).toContain("logo");
  });
});
