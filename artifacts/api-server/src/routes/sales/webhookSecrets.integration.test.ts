/**
 * Settings → Integrations → Visitor identification webhooks (routes/sales/webhook-secrets.ts).
 *
 * Pins the management API for the per-tenant secrets that route inbound
 * RB2B / Apollo / Letterdrop webhooks (routes/webhooks.ts):
 *
 *   • GET returns a stable three-entry list (secret null when unconfigured).
 *   • Rotate creates a secret when none exists, and replaces (not duplicates)
 *     it on subsequent calls — the unique (tenant, integration) index means
 *     rotation is DELETE then INSERT, and the old URL must die immediately.
 *   • DELETE disables the integration.
 *   • Secrets are tenant-scoped — one tenant never sees another's.
 *   • The router sits behind the salesConsole plan gate (free plan → 402),
 *     matching where visitor_identified signals surface.
 *
 * Real Postgres via inject(); no external services touched.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../middleware/requireAuth";

const { pool } = await import("@workspace/db");
const { SESSION_COOKIE, requireAuth } = await import("../../middleware/requireAuth");
const { inject } = await import("../../test-utils/injectRequest");
const salesRouter = (await import("./index")).default;

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999840000 + Math.floor(Math.random() * 100000),
    email: "webhook-secrets-it@example.com",
    name: "IT Webhook Secrets Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-webhook-secrets-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(plan: "growth" | "free"): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-webhook-secrets-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Webhook Secrets Tenant', $1, 'active', $2)
     RETURNING id`,
    [slug, plan],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("visitor-identification webhook secrets API", () => {
  it("lists, generates, rotates, and disables a secret", async () => {
    const { tenantId, sid } = await seedTenant("growth");

    // Fresh tenant: stable three-entry list, all unconfigured.
    const initial = await authed(sid, "GET", "/sales/webhook-secrets");
    expect(initial.status).toBe(200);
    const initialSecrets = initial.json.secrets as Array<{ integration: string; secret: string | null }>;
    expect(initialSecrets.map((s) => s.integration).sort()).toEqual(["apollo", "letterdrop", "rb2b"]);
    expect(initialSecrets.every((s) => s.secret === null)).toBe(true);

    // Generate (rotate with no existing row).
    const gen = await authed(sid, "POST", "/sales/webhook-secrets/letterdrop/rotate");
    expect(gen.status).toBe(201);
    const first = gen.json as { integration: string; secret: string };
    expect(first.integration).toBe("letterdrop");
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{32}$/); // base64url(24 bytes)

    // GET reflects it.
    const afterGen = await authed(sid, "GET", "/sales/webhook-secrets");
    const ldEntry = (afterGen.json.secrets as Array<{ integration: string; secret: string | null }>)
      .find((s) => s.integration === "letterdrop");
    expect(ldEntry?.secret).toBe(first.secret);

    // Rotate replaces — new secret, old row gone, exactly one row remains.
    const rot = await authed(sid, "POST", "/sales/webhook-secrets/letterdrop/rotate");
    expect(rot.status).toBe(201);
    const second = rot.json as { secret: string };
    expect(second.secret).not.toBe(first.secret);
    const rows = await pool.query(
      `SELECT secret FROM tenant_webhook_secrets WHERE tenant_id = $1 AND integration = 'letterdrop'`,
      [tenantId],
    );
    expect(rows.rows.map((r) => r.secret)).toEqual([second.secret]);

    // Disable.
    const del = await authed(sid, "DELETE", "/sales/webhook-secrets/letterdrop");
    expect(del.status).toBe(204);
    const afterDel = await authed(sid, "GET", "/sales/webhook-secrets");
    const ldAfterDel = (afterDel.json.secrets as Array<{ integration: string; secret: string | null }>)
      .find((s) => s.integration === "letterdrop");
    expect(ldAfterDel?.secret).toBeNull();

    // Unknown integration is rejected.
    const bad = await authed(sid, "POST", "/sales/webhook-secrets/hubspot/rotate");
    expect(bad.status).toBe(400);
  });

  it("scopes secrets to the tenant", async () => {
    const a = await seedTenant("growth");
    const b = await seedTenant("growth");

    const gen = await authed(a.sid, "POST", "/sales/webhook-secrets/rb2b/rotate");
    expect(gen.status).toBe(201);

    const bView = await authed(b.sid, "GET", "/sales/webhook-secrets");
    const rb2bForB = (bView.json.secrets as Array<{ integration: string; secret: string | null }>)
      .find((s) => s.integration === "rb2b");
    expect(rb2bForB?.secret).toBeNull();
  });

  it("is plan-gated with the Sales Console", async () => {
    const { sid } = await seedTenant("free");
    const res = await authed(sid, "GET", "/sales/webhook-secrets");
    expect(res.status).toBe(402);
  });
});
