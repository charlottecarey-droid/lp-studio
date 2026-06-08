/**
 * Integration tests for the marketing (LP) Salesforce one-click OAuth endpoints.
 *
 * The Salesforce integration was migrated from manual client_credentials to
 * one-click OAuth, sharing the per-tenant `sfdc_connections` row with the sales
 * console. These tests are the regression guard for the three status/auth
 * endpoints the migration introduced:
 *   - GET  /lp/integrations/salesforce           → status reflects sfdc_connections
 *   - GET  /lp/integrations/salesforce/auth-url   → returns a signed-state OAuth URL
 *   - POST /lp/integrations/salesforce/disconnect → marks the row disconnected
 *
 * Exercised against a HERMETIC throwaway Postgres (dev's NEON_DATABASE_URL points
 * at prod, so we stand up our own cluster and repoint the env BEFORE the first
 * `@workspace/db` import). Routes run in-process via inject() because the vitest
 * worker pool never fires app.listen's callback.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;
let verifySfdcState: (state: string) => { tenantId: number; returnTo?: string } | null;

let epg: EphemeralPg;
let app: Express;

const SID = `it-sf-int-${randomUUID()}`;
const SID_NO_TENANT = `it-sf-int-none-${randomUUID()}`;
let tenantId: number;

function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  });
}

async function seedSession(sid: string, tid: number | null, userId: number): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId,
    email: `it-${userId}@example.test`,
    name: "IT",
    avatarUrl: null,
    tenantId: tid,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

async function seedTenant(): Promise<number> {
  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`IT SF ${uniq}`, `it-sf-${uniq}`],
  );
  return t.rows[0].id;
}

/** Insert a sfdc_connections row for the test tenant; returns its id. */
async function seedConnection(opts: {
  status: string;
  orgId?: string;
  instanceUrl?: string;
}): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_connections
       (tenant_id, instance_url, org_id, access_token, refresh_token, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      tenantId,
      opts.instanceUrl ?? "https://na1.salesforce.com",
      opts.orgId ?? "00Dxx0000000001",
      "access-token-plaintext",
      "refresh-token-plaintext",
      opts.status,
    ],
  );
  return r.rows[0].id;
}

async function clearConnections(): Promise<void> {
  await pgMod.pool.query(`DELETE FROM sfdc_connections WHERE tenant_id = $1`, [tenantId]);
}

beforeAll(async () => {
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }

  pgMod = await import("@workspace/db");
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  verifySfdcState = (await import("../../lib/sfdc-oauth-state")).verifySfdcState;
  const integrationsRouter = (await import("./integrations")).default;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.requireAuth);
  app.use(integrationsRouter);

  tenantId = await seedTenant();
  await seedSession(SID, tenantId, 990001001);
  await seedSession(SID_NO_TENANT, null, 990001002);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface StatusResponse {
  connected: boolean;
  enabled: boolean;
  status: string | null;
  orgId: string | null;
  instanceUrl: string | null;
}

describe("GET /lp/integrations/salesforce (status reflects sfdc_connections)", () => {
  it("reports not connected when the tenant has no connection row", async () => {
    await clearConnections();
    const res = await injectAs(SID, { method: "GET", url: "/lp/integrations/salesforce" });
    expect(res.status).toBe(200);
    const body = res.json as StatusResponse;
    expect(body.connected).toBe(false);
    expect(body.enabled).toBe(false);
    expect(body.status).toBeNull();
    expect(body.orgId).toBeNull();
    expect(body.instanceUrl).toBeNull();
  });

  it("reports connected (with org/instance) when an active connection exists", async () => {
    await clearConnections();
    await seedConnection({
      status: "connected",
      orgId: "00Dxx0000000ABC",
      instanceUrl: "https://acme.my.salesforce.com",
    });
    const res = await injectAs(SID, { method: "GET", url: "/lp/integrations/salesforce" });
    expect(res.status).toBe(200);
    const body = res.json as StatusResponse;
    expect(body.connected).toBe(true);
    expect(body.enabled).toBe(true);
    expect(body.status).toBe("connected");
    expect(body.orgId).toBe("00Dxx0000000ABC");
    expect(body.instanceUrl).toBe("https://acme.my.salesforce.com");
  });

  it("reports not connected (but surfaces status) for a disconnected row, hiding org/instance", async () => {
    await clearConnections();
    await seedConnection({ status: "disconnected", orgId: "00Dxx0000000DEF" });
    const res = await injectAs(SID, { method: "GET", url: "/lp/integrations/salesforce" });
    expect(res.status).toBe(200);
    const body = res.json as StatusResponse;
    expect(body.connected).toBe(false);
    expect(body.enabled).toBe(false);
    expect(body.status).toBe("disconnected");
    // org/instance are only exposed for a live connection.
    expect(body.orgId).toBeNull();
    expect(body.instanceUrl).toBeNull();
  });

  it("fails closed (403) on a session with no tenant", async () => {
    const res = await injectAs(SID_NO_TENANT, { method: "GET", url: "/lp/integrations/salesforce" });
    expect(res.status).toBe(403);
  });
});

describe("GET /lp/integrations/salesforce/auth-url", () => {
  it("returns a Salesforce OAuth URL carrying a verifiable signed state bound to the tenant", async () => {
    const res = await injectAs(SID, { method: "GET", url: "/lp/integrations/salesforce/auth-url" });
    expect(res.status).toBe(200);
    const { url } = res.json as { url: string };
    expect(url).toContain("/services/oauth2/authorize");
    expect(url).toContain("response_type=code");

    // The embedded state must verify and decode back to THIS tenant with the
    // marketing returnTo, proving signSfdcState/verifySfdcState round-trip.
    const state = new URL(url).searchParams.get("state");
    expect(state).toBeTruthy();
    const decoded = verifySfdcState(state as string);
    expect(decoded).not.toBeNull();
    expect(decoded?.tenantId).toBe(tenantId);
    expect(decoded?.returnTo).toBe("/integrations");
  });

  it("fails closed (403) on a session with no tenant", async () => {
    const res = await injectAs(SID_NO_TENANT, { method: "GET", url: "/lp/integrations/salesforce/auth-url" });
    expect(res.status).toBe(403);
  });
});

describe("POST /lp/integrations/salesforce/disconnect", () => {
  it("marks the connection disconnected and clears its tokens", async () => {
    await clearConnections();
    const connId = await seedConnection({ status: "connected" });

    const res = await injectAs(SID, { method: "POST", url: "/lp/integrations/salesforce/disconnect" });
    expect(res.status).toBe(200);
    expect((res.json as { ok: boolean }).ok).toBe(true);

    const row = await pgMod.pool.query<{ status: string; access_token: string; refresh_token: string }>(
      `SELECT status, access_token, refresh_token FROM sfdc_connections WHERE id = $1`,
      [connId],
    );
    expect(row.rows[0].status).toBe("disconnected");
    expect(row.rows[0].access_token).toBe("");
    expect(row.rows[0].refresh_token).toBe("");

    // Status now reflects the disconnect.
    const status = await injectAs(SID, { method: "GET", url: "/lp/integrations/salesforce" });
    expect((status.json as StatusResponse).connected).toBe(false);
  });

  it("is a no-op ok:true when there is no connection to disconnect", async () => {
    await clearConnections();
    const res = await injectAs(SID, { method: "POST", url: "/lp/integrations/salesforce/disconnect" });
    expect(res.status).toBe(200);
    expect((res.json as { ok: boolean }).ok).toBe(true);
  });

  it("fails closed (403) on a session with no tenant", async () => {
    const res = await injectAs(SID_NO_TENANT, { method: "POST", url: "/lp/integrations/salesforce/disconnect" });
    expect(res.status).toBe(403);
  });
});
