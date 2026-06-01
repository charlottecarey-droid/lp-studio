/**
 * Integration test for editing an existing workflow trigger in place.
 *
 * Runs the REAL notifications router against the REAL Postgres pool, injecting
 * requests IN-PROCESS (the vitest worker pool can't bind a listening port — see
 * test-utils/inject). The full middleware chain runs (cookie-parser, body
 * parsing, requireSuperadmin, the route handlers + their DB writes).
 *
 * Asserted contract for PATCH /api/admin/email-workflow-triggers/:key:
 *   1. Permission: a non-superadmin session gets 403.
 *   2. Round-trip: editing a scheduled trigger's time/timezone/frequency
 *      persists the new config (and the occurrence id is derived from config at
 *      sweep time, so future fires recompute automatically).
 *   3. Validation: an invalid schedule (bad time) is rejected with 400 and the
 *      stored config is left unchanged.
 *   4. Missing: PATCH of an unknown key returns 404.
 *   5. System-protected triggers cannot be edited (403).
 *
 * All rows the test creates are cleaned up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import notificationsRouter from "./notifications";

const TRIGGER_KEY = `it_trig_edit_${Date.now()}`;
const SUPER_SID = `it-trig-super-${randomUUID()}`;
const PLAIN_SID = `it-trig-plain-${randomUUID()}`;
const SUPER_EMAIL = `it-trig-super-${Date.now()}@example.com`;
const SUPER_UID = 999210001;
const PLAIN_UID = 999210002;

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

async function readConfig(key: string): Promise<Record<string, unknown> | null> {
  const r = await pool.query<{ config: Record<string, unknown> }>(
    `SELECT config FROM email_workflow_triggers WHERE key = $1`,
    [key],
  );
  return r.rows[0]?.config ?? null;
}

beforeAll(async () => {
  await seedSession(SUPER_SID, {
    userId: SUPER_UID,
    email: SUPER_EMAIL,
    tenantId: null,
    role: "superadmin",
    appUserRole: "superadmin",
  });
  // Non-superadmin: appUserRole null forces an app_users lookup, which finds no
  // row for this synthetic id → role stays null → 403.
  await seedSession(PLAIN_SID, { userId: PLAIN_UID, tenantId: null, role: "admin", isAdmin: true, appUserRole: null });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", notificationsRouter);

  // Create the scheduled trigger we will edit (POST already upserts by key).
  const created = await injectSid({
    method: "POST",
    url: "/api/admin/email-workflow-triggers",
    sid: SUPER_SID,
    body: {
      key: TRIGGER_KEY,
      name: "IT Trigger Edit",
      triggerType: "scheduled",
      config: { role: "member", frequency: "daily", time: "09:00", timezone: "UTC" },
    },
  });
  expect(created.status).toBe(200);
});

afterAll(async () => {
  await pool.query(`DELETE FROM email_workflow_triggers WHERE key = $1`, [TRIGGER_KEY]).catch(() => {});
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, PLAIN_SID]]).catch(() => {});
  await pool.query(`DELETE FROM email_template_edit_log WHERE editor_email = $1`, [SUPER_EMAIL]).catch(() => {});
});

describe("PATCH /api/admin/email-workflow-triggers/:key", () => {
  it("denies a non-superadmin session with 403", async () => {
    const res = await injectSid({
      method: "PATCH",
      url: `/api/admin/email-workflow-triggers/${TRIGGER_KEY}`,
      sid: PLAIN_SID,
      body: { config: { role: "member", frequency: "daily", time: "10:00", timezone: "UTC" } },
    });
    expect(res.status).toBe(403);
  });

  it("round-trips an edit of frequency / time / timezone", async () => {
    const res = await injectSid({
      method: "PATCH",
      url: `/api/admin/email-workflow-triggers/${TRIGGER_KEY}`,
      sid: SUPER_SID,
      body: {
        name: "IT Trigger Edited",
        config: {
          role: "admin",
          frequency: "weekly",
          time: "14:30",
          timezone: "America/New_York",
          dayOfWeek: 3,
        },
      },
    });
    expect(res.status).toBe(200);

    const cfg = await readConfig(TRIGGER_KEY);
    expect(cfg).toMatchObject({
      role: "admin",
      frequency: "weekly",
      time: "14:30",
      timezone: "America/New_York",
      dayOfWeek: 3,
    });

    const r = await pool.query<{ name: string }>(
      `SELECT name FROM email_workflow_triggers WHERE key = $1`,
      [TRIGGER_KEY],
    );
    expect(r.rows[0]?.name).toBe("IT Trigger Edited");
  });

  it("rejects an invalid schedule (bad time) with 400 and leaves config unchanged", async () => {
    const before = await readConfig(TRIGGER_KEY);
    const res = await injectSid({
      method: "PATCH",
      url: `/api/admin/email-workflow-triggers/${TRIGGER_KEY}`,
      sid: SUPER_SID,
      body: { config: { role: "admin", frequency: "daily", time: "99:99", timezone: "UTC" } },
    });
    expect(res.status).toBe(400);
    const after = await readConfig(TRIGGER_KEY);
    expect(after).toEqual(before);
  });

  it("returns 404 for an unknown trigger key", async () => {
    const res = await injectSid({
      method: "PATCH",
      url: `/api/admin/email-workflow-triggers/it_trig_does_not_exist_${Date.now()}`,
      sid: SUPER_SID,
      body: { config: { role: "member", frequency: "daily", time: "09:00", timezone: "UTC" } },
    });
    expect(res.status).toBe(404);
  });

  it("refuses to edit a system-protected trigger with 403", async () => {
    const sys = await pool.query<{ key: string }>(
      `SELECT key FROM email_workflow_triggers WHERE is_system = true LIMIT 1`,
    );
    if (!sys.rows[0]) return; // no system trigger seeded in this env → nothing to assert
    const res = await injectSid({
      method: "PATCH",
      url: `/api/admin/email-workflow-triggers/${sys.rows[0].key}`,
      sid: SUPER_SID,
      body: { config: {} },
    });
    expect(res.status).toBe(403);
  });
});
