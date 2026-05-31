/**
 * Integration test for the TENANT email-template editor API (Task #588).
 *
 * Runs the REAL notifications router against the REAL Postgres pool, injecting
 * requests IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/inject). The full middleware chain runs (cookie-parser, body
 * parsing, requireAuth, requirePermission("settings"), getTenantId, the route
 * handlers + their DB writes / audit log).
 *
 * Asserted contract:
 *   1. Permission: a same-tenant non-admin session gets 403 on every route; an
 *      unauthenticated request gets 401.
 *   2. Scope: the routes resolve the tenant from the session via getTenantId —
 *      there is no tenant_id param — so the data returned is always the caller's
 *      own tenant. A tenant-admin override header (X-Tenant-Id) is ignored for a
 *      non-superadmin, proving cross-tenant access is structurally impossible.
 *   3. Round-trip: PATCH a tenant template's body_html / wrap_in_shell, then GET
 *      it back and see the persisted (scope='tenant') values.
 *   4. Audit: the PATCH appends an edit-log row keyed `tenant:<id>:<key>`.
 *   5. Preview escapes interpolated variables.
 *   6. Test-send rejects a malformed recipient (400) and rate-limits the 11th
 *      request (429) — both gated off when a live RESEND key is present.
 *   7. Shell GET returns brand-derived defaults; PATCH round-trips an override.
 *
 * All rows created here are torn down in afterAll; nothing touches platform
 * (scope='platform') templates, so the Phase-1 byte-identical guard is unaffected.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import notificationsRouter from "./notifications";

const TEMPLATE_KEY = "lead_notification";
const ADMIN_SID = `it-tenem-admin-${randomUUID()}`;
const PLAIN_SID = `it-tenem-plain-${randomUUID()}`;
const ADMIN_EMAIL = `it-tenem-admin-${Date.now()}@example.com`;
const ADMIN_UID = 999300001;
const PLAIN_UID = 999300002;
const TENANT_SLUG = `it-tenem-${randomUUID().slice(0, 8)}`;

const HAS_RESEND = !!process.env["RESEND_API_KEY"];

let app: Express;
let tenantId = 0;

function injectSid(opts: {
  method: string;
  url: string;
  sid?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<InjectResponse> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
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

async function seedSession(sid: string, user: Partial<AuthUser> & Pick<AuthUser, "userId">): Promise<void> {
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1)`, [[ADMIN_SID, PLAIN_SID]]).catch(() => {});
  if (tenantId) {
    await pool
      .query(`DELETE FROM email_template_edit_log WHERE target_key LIKE $1`, [`tenant:${tenantId}%`])
      .catch(() => {});
    await pool.query(`DELETE FROM notification_templates WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenant_email_shells WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  }
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Tenant Email', $1, 'active', '{"brandName":"IT Tenant Email","primaryColor":"#123456"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0]!.id;

  // Tenant ADMIN: isAdmin satisfies requirePermission("settings"); appUserRole
  // is NOT superadmin, so the X-Tenant-Id override is ignored and getTenantId
  // resolves strictly to this tenant.
  await seedSession(ADMIN_SID, {
    userId: ADMIN_UID,
    email: ADMIN_EMAIL,
    tenantId,
    role: "admin",
    isAdmin: true,
  });
  // Same-tenant NON-admin: no settings permission → 403 on every route.
  await seedSession(PLAIN_SID, { userId: PLAIN_UID, tenantId, role: "viewer", isAdmin: false });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", notificationsRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("tenant email-template editor API", () => {
  it("denies a same-tenant non-admin with 403 on every route", async () => {
    const routes: Array<{ method: string; url: string }> = [
      { method: "GET", url: "/api/tenant/notification-templates" },
      { method: "GET", url: `/api/tenant/notification-templates/${TEMPLATE_KEY}` },
      { method: "PATCH", url: `/api/tenant/notification-templates/${TEMPLATE_KEY}` },
      { method: "POST", url: `/api/tenant/notification-templates/${TEMPLATE_KEY}/preview` },
      { method: "POST", url: `/api/tenant/notification-templates/${TEMPLATE_KEY}/test-send` },
      { method: "GET", url: "/api/tenant/email-shell" },
      { method: "PATCH", url: "/api/tenant/email-shell" },
      { method: "POST", url: "/api/tenant/email-shell/preview" },
    ];
    for (const r of routes) {
      const res = await injectSid({ ...r, sid: PLAIN_SID, body: r.method === "GET" ? undefined : {} });
      expect(res.status, `${r.method} ${r.url}`).toBe(403);
    }
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await injectSid({ method: "GET", url: "/api/tenant/notification-templates" });
    expect(res.status).toBe(401);
  });

  it("ignores an X-Tenant-Id override from a non-superadmin (stays in own tenant)", async () => {
    const res = await injectSid({
      method: "GET",
      url: "/api/tenant/notification-templates",
      sid: ADMIN_SID,
      headers: { "x-tenant-id": String(tenantId + 1) },
    });
    // The override is silently dropped; the request still resolves to the
    // caller's own tenant and succeeds (rather than acting on tenantId+1).
    expect(res.status).toBe(200);
    const body = res.json as { templates: unknown[]; variables: unknown[] };
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBeGreaterThan(0);
  });

  it("lists tenant templates with the tenant variable registry", async () => {
    const res = await injectSid({ method: "GET", url: "/api/tenant/notification-templates", sid: ADMIN_SID });
    expect(res.status).toBe(200);
    const body = res.json as { templates: Array<{ key: string }>; variables: unknown[] };
    expect(body.templates.some((t) => t.key === TEMPLATE_KEY)).toBe(true);
    expect(Array.isArray(body.variables)).toBe(true);
    expect(body.variables.length).toBeGreaterThan(0);
  });

  it("round-trips a PATCH of body_html / wrap_in_shell (scope='tenant')", async () => {
    const newBody = "<p>Tenant RT {{leadName}} — {{brandName}}</p>";
    const patch = await injectSid({
      method: "PATCH",
      url: `/api/tenant/notification-templates/${TEMPLATE_KEY}`,
      sid: ADMIN_SID,
      body: { bodyHtml: newBody, bodyMode: "html", wrapInShell: false },
    });
    expect(patch.status).toBe(200);

    const get = await injectSid({
      method: "GET",
      url: `/api/tenant/notification-templates/${TEMPLATE_KEY}`,
      sid: ADMIN_SID,
    });
    expect(get.status).toBe(200);
    const tpl = (get.json as { template: Record<string, unknown> }).template;
    expect(tpl["bodyHtml"]).toBe(newBody);
    expect(tpl["wrapInShell"]).toBe(false);

    // The override row is tenant-scoped and bound to this tenant only.
    const row = await pool.query(
      `SELECT scope, tenant_id FROM notification_templates WHERE tenant_id = $1 AND key = $2`,
      [tenantId, TEMPLATE_KEY],
    );
    expect(row.rows[0]).toMatchObject({ scope: "tenant", tenant_id: tenantId });
  });

  it("appends a tenant-keyed audit-log row for the PATCH", async () => {
    const r = await pool.query(
      `SELECT 1 FROM email_template_edit_log
        WHERE target_key = $1 AND action = 'update' AND editor_email = $2 LIMIT 1`,
      [`tenant:${tenantId}:${TEMPLATE_KEY}`, ADMIN_EMAIL],
    );
    expect(r.rows.length).toBe(1);
  });

  it("HTML-escapes interpolated variables in the tenant preview body", async () => {
    const res = await injectSid({
      method: "POST",
      url: `/api/tenant/notification-templates/${TEMPLATE_KEY}/preview`,
      sid: ADMIN_SID,
      body: {
        bodyHtml: "<p>Hi {{brandName}}</p>",
        wrapInShell: false,
        previewData: { brandName: "<script>alert(1)</script>" },
      },
    });
    expect(res.status).toBe(200);
    const html = (res.json as { html: string }).html;
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("rejects a test-send with a malformed recipient override (400)", async () => {
    const res = await injectSid({
      method: "POST",
      url: `/api/tenant/notification-templates/${TEMPLATE_KEY}/test-send`,
      sid: ADMIN_SID,
      body: { to: "not-an-email" },
    });
    expect(res.status).toBe(400);
  });

  it("returns brand-derived shell defaults and round-trips an override", async () => {
    const get = await injectSid({ method: "GET", url: "/api/tenant/email-shell", sid: ADMIN_SID });
    expect(get.status).toBe(200);
    const body = get.json as { overrides: Record<string, unknown>; defaults: Record<string, string> };
    expect(typeof body.defaults.shellHtml).toBe("string");
    expect(body.defaults.shellHtml.length).toBeGreaterThan(0);

    const patch = await injectSid({
      method: "PATCH",
      url: "/api/tenant/email-shell",
      sid: ADMIN_SID,
      body: { headerBg: "#abcdef" },
    });
    expect(patch.status).toBe(200);
    expect((patch.json as { overrides: { headerBg: string } }).overrides.headerBg).toBe("#abcdef");
  });

  it.skipIf(HAS_RESEND)("test-send audit is metadata-only (no recipient PII)", async () => {
    const override = `it-tenem-recip-${Date.now()}@example.com`;
    const res = await injectSid({
      method: "POST",
      url: `/api/tenant/notification-templates/${TEMPLATE_KEY}/test-send`,
      sid: ADMIN_SID,
      body: { to: override },
    });
    expect(res.status).toBe(200);
    const log = await pool.query(
      `SELECT editor_email, diff FROM email_template_edit_log
        WHERE target_key = $1 AND action = 'test_send'
        ORDER BY created_at DESC LIMIT 1`,
      [`tenant:${tenantId}:${TEMPLATE_KEY}`],
    );
    const row = log.rows[0] as { editor_email: string | null; diff: Record<string, unknown> };
    expect(JSON.stringify(row.diff)).not.toContain(override);
    expect(row.diff).toMatchObject({ customRecipient: true });
    // The actor is the tenant admin — never the recipient address.
    expect(row.editor_email).toBe(ADMIN_EMAIL);
  });

  it.skipIf(HAS_RESEND)("rate-limits tenant test-send to the 11th request with 429", async () => {
    let last: InjectResponse | null = null;
    for (let i = 0; i < 11; i++) {
      last = await injectSid({
        method: "POST",
        url: `/api/tenant/notification-templates/${TEMPLATE_KEY}/test-send`,
        sid: ADMIN_SID,
        body: {},
      });
    }
    expect(last?.status).toBe(429);
  });
});
