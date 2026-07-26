/**
 * Pins the July 2026 decision that Slack configuration is UNGATED — reachable
 * on every plan (settings consolidation Phase 4).
 *
 * Slack lead alerts fire for every tenant's form submissions regardless of
 * tier, so the connect flow + channel/event settings must be reachable on
 * every plan too. routes/sales/index.ts mounts slackRouter BEFORE the
 * requirePlanFeature("salesConsole") gate; this test locks that mount order:
 * a plan with NO salesConsole feature gets 200s from /sales/slack/* while the
 * still-gated CRM routers (marketo here, as the control) keep 402ing.
 *
 * Uses the 'free' plan — the floor tier, which must never grow the
 * salesConsole feature. Real Postgres via inject(); no Slack API is touched
 * (an unconnected tenant's GETs never leave the process).
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
    userId: 999830000 + Math.floor(Math.random() * 100000),
    email: "slack-ungated-it@example.com",
    name: "IT Slack Ungated Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-slack-ungated-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedFreeTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-slack-ungated-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Slack Ungated Tenant', $1, 'active', 'free')
     RETURNING id`,
    [slug],
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
describe.skipIf(!dbAvailable)("Slack config is reachable on every plan", () => {
  it("free-plan tenant reaches /sales/slack/* while gated CRM routes still 402", async () => {
    const { sid } = await seedFreeTenant();

    // Slack: ungated. An unconnected tenant gets a clean status, not a plan wall.
    const conn = await authed(sid, "GET", "/sales/slack/connection");
    expect(conn.status).toBe(200);
    expect((conn.json as { connected: boolean }).connected).toBe(false);

    // The settings PATCH is also in front of the gate (404 = no connection row,
    // which proves the gate didn't intercept with 402 first).
    const patch = await authed(sid, "PATCH", "/sales/slack/settings", { defaultChannelId: "C123" });
    expect(patch.status).not.toBe(402);

    // Control: the CRM routers behind the gate still 402 for this plan, so
    // this test fails loudly if someone ever moves the gate itself.
    const marketo = await authed(sid, "GET", "/sales/marketo/connection");
    expect(marketo.status).toBe(402);
    expect((marketo.json as { gate?: string }).gate).toBe("salesConsole");
  });
});
