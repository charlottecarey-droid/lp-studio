/**
 * Integration test for the superadmin email-template editor API.
 *
 * Runs the REAL notifications router against the REAL Postgres pool. Sessions
 * are seeded directly into `app_sessions` (the auth middleware reads the session
 * row by cookie). Requests are injected IN-PROCESS (no TCP socket) because the
 * vitest worker pool here cannot bind a listening port — see test-utils/inject.
 *
 * The full middleware chain still runs (cookie-parser, body parsing,
 * requireSuperadmin, the route handlers + their DB writes / audit log).
 *
 * Asserted contract (Phase 1 editor API):
 *   1. Permission: a non-superadmin session gets 403 on every editor route.
 *   2. Round-trip: PATCH a template's body_html / wrap_in_shell / preview_data,
 *      then GET it back and see the persisted values (cache busted).
 *   3. Audit: the PATCH appends an `email_template_edit_log` row attributed to
 *      the editing superadmin.
 *   4. Rate limit: the 11th test-send in an hour returns 429 (gated off when a
 *      live RESEND key is present, so the test never sends real email).
 *
 * The chosen template's original row is snapshotted in beforeAll and restored
 * in afterAll so this test does not mutate live lifecycle-email content.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import notificationsRouter from "./notifications";

const TEMPLATE_KEY = "trial_day_7";
const SUPER_SID = `it-emed-super-${randomUUID()}`;
const PLAIN_SID = `it-emed-plain-${randomUUID()}`;
const SUPER_EMAIL = `it-emed-super-${Date.now()}@example.com`;
const SUPER_UID = 999200001;
const PLAIN_UID = 999200002;

// Skip the real test-send / rate-limit path when a live Resend key is present,
// so CI against a prod-keyed env never emits actual email.
const HAS_RESEND = !!process.env["RESEND_API_KEY"];

let app: Express;
let originalRow: Record<string, unknown> | null = null;

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

async function snapshotTemplate(): Promise<void> {
  const r = await pool.query(`SELECT * FROM notification_templates WHERE key = $1`, [TEMPLATE_KEY]);
  originalRow = r.rows[0] ?? null;
}

async function restoreTemplate(): Promise<void> {
  // Always clear whatever the test wrote, then restore the original row (if the
  // seed had one). Code defaults cover the no-row case via getNotificationTemplate.
  await pool.query(`DELETE FROM notification_templates WHERE key = $1`, [TEMPLATE_KEY]).catch(() => {});
  if (!originalRow) return;
  const o = originalRow;
  await pool
    .query(
      `INSERT INTO notification_templates
         (key, name, description, category, channels,
          email_subject, email_intro, email_cta_label, in_app_title, in_app_body,
          body_html, body_mode, wrap_in_shell, preview_data, enabled,
          last_test_sent_at, last_test_sent_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())`,
      [
        o["key"],
        o["name"],
        o["description"],
        o["category"],
        JSON.stringify(o["channels"]),
        o["email_subject"],
        o["email_intro"],
        o["email_cta_label"],
        o["in_app_title"],
        o["in_app_body"],
        o["body_html"],
        o["body_mode"],
        o["wrap_in_shell"],
        o["preview_data"] == null ? null : JSON.stringify(o["preview_data"]),
        o["enabled"],
        o["last_test_sent_at"],
        o["last_test_sent_by"],
      ],
    )
    .catch((err) => {
      console.error("[test] restore failed:", err);
    });
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[SUPER_SID, PLAIN_SID]]).catch(() => {});
  await pool.query(`DELETE FROM email_template_edit_log WHERE editor_email = $1`, [SUPER_EMAIL]).catch(() => {});
}

beforeAll(async () => {
  await snapshotTemplate();
  await cleanup();
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
});

afterAll(async () => {
  await cleanup();
  await restoreTemplate();
});

describe("superadmin email-template editor API", () => {
  it("denies a non-superadmin session with 403 on every editor route", async () => {
    const routes: Array<{ method: string; url: string }> = [
      { method: "GET", url: "/api/admin/notification-templates" },
      { method: "GET", url: `/api/admin/notification-templates/${TEMPLATE_KEY}` },
      { method: "PATCH", url: `/api/admin/notification-templates/${TEMPLATE_KEY}` },
      { method: "POST", url: `/api/admin/notification-templates/${TEMPLATE_KEY}/preview` },
      // requireSuperadmin runs BEFORE the rate limiter, so this 403 neither
      // sends email nor consumes the test-send budget.
      { method: "POST", url: `/api/admin/notification-templates/${TEMPLATE_KEY}/test-send` },
      { method: "GET", url: "/api/admin/email-shell" },
      { method: "PATCH", url: "/api/admin/email-shell" },
      { method: "POST", url: "/api/admin/email-shell/preview" },
      { method: "GET", url: "/api/admin/email-template-log" },
    ];
    for (const r of routes) {
      const res = await injectSid({ ...r, sid: PLAIN_SID, body: r.method === "GET" ? undefined : {} });
      expect(res.status, `${r.method} ${r.url}`).toBe(403);
    }
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await injectSid({ method: "GET", url: "/api/admin/notification-templates" });
    expect(res.status).toBe(401);
  });

  it("lists templates with the variable registry for a superadmin", async () => {
    const res = await injectSid({ method: "GET", url: "/api/admin/notification-templates", sid: SUPER_SID });
    expect(res.status).toBe(200);
    const body = res.json as { templates: unknown[]; variables: unknown[] };
    expect(Array.isArray(body.templates)).toBe(true);
    expect(Array.isArray(body.variables)).toBe(true);
    expect(body.variables.length).toBeGreaterThan(0);
  });

  it("round-trips a PATCH of body_html / wrap_in_shell / preview_data", async () => {
    const newBody = "<p>RT body {{ctaUrl}} — {{tenantName}}</p>";
    const patch = await injectSid({
      method: "PATCH",
      url: `/api/admin/notification-templates/${TEMPLATE_KEY}`,
      sid: SUPER_SID,
      body: {
        bodyHtml: newBody,
        bodyMode: "html",
        wrapInShell: false,
        previewData: { tenantName: "RoundTripCo" },
      },
    });
    expect(patch.status).toBe(200);

    const get = await injectSid({
      method: "GET",
      url: `/api/admin/notification-templates/${TEMPLATE_KEY}`,
      sid: SUPER_SID,
    });
    expect(get.status).toBe(200);
    const tpl = (get.json as { template: Record<string, unknown> }).template;
    expect(tpl["bodyHtml"]).toBe(newBody);
    expect(tpl["bodyMode"]).toBe("html");
    expect(tpl["wrapInShell"]).toBe(false);
    expect((tpl["previewData"] as Record<string, string>)["tenantName"]).toBe("RoundTripCo");
  });

  it("appends an audit-log row attributed to the editing superadmin", async () => {
    const res = await injectSid({
      method: "GET",
      url: "/api/admin/email-template-log",
      sid: SUPER_SID,
    });
    expect(res.status).toBe(200);
    const entries = (res.json as { entries: Array<Record<string, unknown>> }).entries;
    const mine = entries.find(
      (e) => e["target_key"] === TEMPLATE_KEY && e["action"] === "update" && e["editor_email"] === SUPER_EMAIL,
    );
    expect(mine, "expected an update audit row for the PATCH").toBeTruthy();
  });

  it("HTML-escapes interpolated variables in the rendered preview body", async () => {
    const res = await injectSid({
      method: "POST",
      url: `/api/admin/notification-templates/${TEMPLATE_KEY}/preview`,
      sid: SUPER_SID,
      body: {
        bodyHtml: "<p>Hi {{tenantName}}</p>",
        wrapInShell: false,
        previewData: { tenantName: '<script>alert(1)</script>' },
      },
    });
    expect(res.status).toBe(200);
    const html = (res.json as { html: string }).html;
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it.skipIf(HAS_RESEND)("rate-limits test-send to the 11th request with 429", async () => {
    let last: InjectResponse | null = null;
    for (let i = 0; i < 11; i++) {
      last = await injectSid({
        method: "POST",
        url: `/api/admin/notification-templates/${TEMPLATE_KEY}/test-send`,
        sid: SUPER_SID,
        body: {},
      });
    }
    expect(last?.status).toBe(429);
    expect((last?.json as { code?: string })?.code).toBe("rate_limited");
  });
});
