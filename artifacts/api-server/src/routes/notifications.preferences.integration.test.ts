/**
 * Integration test for the PERSONAL email-preference center API.
 *
 * Runs the REAL notifications router against the REAL Postgres pool, injecting
 * requests IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/inject). The full middleware chain runs (cookie-parser, body
 * parsing, requireAuth, getTenantId, the route handlers + their DB writes).
 *
 * Asserted contract:
 *   1. Auth: an unauthenticated request gets 401.
 *   2. GET returns human-friendly preference GROUPS (not raw internal template
 *      names) for the signed-in user, plus their recipient email.
 *   3. PATCH a group with subscribed:false writes opt-out rows for ALL of that
 *      group's member templates; subscribed:true clears them. Scoped to BOTH
 *      app_user_id and tenant_id.
 *   4. An unknown groupId is rejected with 400 (the old bug class — the previous
 *      per-template PATCH 400'd on operator-created templates the GET had listed).
 *
 * All rows created here are torn down in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import notificationsRouter from "./notifications";

const SID = `it-emailpref-${randomUUID()}`;
const USER_EMAIL = `it-emailpref-${Date.now()}@example.com`;
const USER_UID = 999310001;
const TENANT_SLUG = `it-emailpref-${randomUUID().slice(0, 8)}`;

let app: Express;
let tenantId = 0;

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

async function optOutRows(): Promise<string[]> {
  const r = await pool.query<{ template_key: string }>(
    `SELECT template_key FROM notification_preferences
      WHERE tenant_id = $1 AND app_user_id = $2 AND channel = 'email'
      ORDER BY template_key`,
    [tenantId, USER_UID],
  );
  return r.rows.map((x) => x.template_key);
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Email Prefs', $1, 'active', '{"brandName":"IT Email Prefs"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0]!.id;

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [SID, sessJson({ userId: USER_UID, email: USER_EMAIL, tenantId, role: "viewer", isAdmin: false })],
  );

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", notificationsRouter);
});

afterAll(async () => {
  await pool.query(`DELETE FROM notification_preferences WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
});

describe("personal email-preference center API", () => {
  it("returns 401 when no session cookie is present", async () => {
    const res = await injectSid({ method: "GET", url: "/api/notifications/preferences" });
    expect(res.status).toBe(401);
  });

  it("GET returns human-friendly groups (not raw template keys) + recipient email", async () => {
    const res = await injectSid({ method: "GET", url: "/api/notifications/preferences", sid: SID });
    expect(res.status).toBe(200);
    const body = res.json as {
      groups: Array<{ id: string; name: string; description: string; subscribed: boolean }>;
      recipientEmail: string;
    };
    expect(body.recipientEmail).toBe(USER_EMAIL);
    expect(Array.isArray(body.groups)).toBe(true);
    // The code-owned categories always exist; everything starts subscribed.
    const ids = body.groups.map((g) => g.id);
    expect(ids).toContain("getting_started");
    expect(ids).toContain("trial_billing");
    expect(body.groups.every((g) => g.subscribed)).toBe(true);
    // The list is categories, never internal template names like "trial_day_7".
    expect(ids).not.toContain("trial_day_7");
  });

  it("PATCH a group off writes opt-out rows for every member; on clears them", async () => {
    const off = await injectSid({
      method: "PATCH",
      url: "/api/notifications/preferences",
      sid: SID,
      body: { groupId: "trial_billing", subscribed: false },
    });
    expect(off.status).toBe(200);
    expect(await optOutRows()).toEqual(["trial_day_11", "trial_day_13", "trial_day_7"]);

    // The group now reads as off via GET.
    const after = await injectSid({ method: "GET", url: "/api/notifications/preferences", sid: SID });
    const grp = (after.json as { groups: Array<{ id: string; subscribed: boolean }> }).groups.find(
      (g) => g.id === "trial_billing",
    );
    expect(grp?.subscribed).toBe(false);

    const on = await injectSid({
      method: "PATCH",
      url: "/api/notifications/preferences",
      sid: SID,
      body: { groupId: "trial_billing", subscribed: true },
    });
    expect(on.status).toBe(200);
    expect(await optOutRows()).toEqual([]);
  });

  it("rejects an unknown groupId with 400 (never trusts a client-named template)", async () => {
    const res = await injectSid({
      method: "PATCH",
      url: "/api/notifications/preferences",
      sid: SID,
      body: { groupId: "trial_day_7", subscribed: false },
    });
    expect(res.status).toBe(400);
    // A real template key is NOT a valid group, so nothing was written.
    expect(await optOutRows()).toEqual([]);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await injectSid({
      method: "PATCH",
      url: "/api/notifications/preferences",
      sid: SID,
      body: { subscribed: false },
    });
    expect(res.status).toBe(400);
  });
});
