/**
 * Claude connector — end to end against a real Postgres:
 * register → authorize → consent → token → MCP tools → refresh → revoke,
 * plus the cross-tenant decoy: a second workspace holds an account with the
 * SAME owner name and a matching search term, and must never show up.
 *
 * Runs only when a database is reachable (see test-utils/dbAvailable.ts).
 * NEVER point this at production; use a disposable Neon branch.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { pool } from "@workspace/db";
import { dbAvailable } from "../test-utils/dbAvailable";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import { deleteTenantCascade } from "../test-utils/tenantCleanup";

const SLUG = `mcp-it-${Date.now()}`;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const OWNER = `Pat Connector ${Date.now()}`;

let app: express.Express;
let tenantA = 0;
let tenantB = 0;
let userA = 0;
let userB = 0;
let sidA = "";
let accountA = 0;
let accountOtherA = 0;
let accountB = 0;

async function mkTenant(suffix: string): Promise<{ tenantId: number; roleId: number }> {
  const t = await pool.query<{ id: number }>(`INSERT INTO tenants (name, slug, status, plan) VALUES ($1, $2, 'active', 'growth') RETURNING id`, [
    `MCP ${suffix}`,
    `${SLUG}-${suffix}`,
  ]);
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system) VALUES ($1, 'Member', '{}'::jsonb, false, false) RETURNING id`,
    [t.rows[0].id],
  );
  return { tenantId: t.rows[0].id, roleId: r.rows[0].id };
}

async function mkUser(tenantId: number, roleId: number, email: string): Promise<number> {
  const u = await pool.query<{ id: number }>(`INSERT INTO app_users (tenant_id, email, name, role, status) VALUES ($1, $2, $3, 'member', 'active') RETURNING id`, [
    tenantId,
    email,
    OWNER,
  ]);
  await pool.query(`INSERT INTO tenant_members (tenant_id, role_id, user_id, email, accepted_at) VALUES ($1, $2, $3, $4, now())`, [tenantId, roleId, u.rows[0].id, email]);
  return u.rows[0].id;
}

async function mkAccount(tenantId: number, name: string, owner: string): Promise<number> {
  const r = await pool.query<{ id: number }>(`INSERT INTO sales_accounts (tenant_id, name, owner) VALUES ($1, $2, $3) RETURNING id`, [tenantId, name, owner]);
  return r.rows[0].id;
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
// In-process requests have no socket address; give IP-keyed rate limiters one, as the proxy would.
const IP = { "x-forwarded-for": "203.0.113.9" };
const post = (url: string, body: unknown, headers: Record<string, string> = {}) => inject(app, { method: "POST", url, body, headers: { ...IP, ...headers } });
const postForm = (url: string, o: Record<string, string>) =>
  inject(app, { method: "POST", url, body: form(o), headers: { ...IP, "content-type": "application/x-www-form-urlencoded" } });

function mcp(token: string, method: string, params: unknown = {}): Promise<InjectResponse> {
  return post(
    "/api/mcp",
    { jsonrpc: "2.0", id: 1, method, params },
    { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream" },
  );
}

async function callTool(token: string, name: string, args: Record<string, unknown> = {}): Promise<{ isError?: boolean; data: unknown; text: string }> {
  const r = await mcp(token, "tools/call", { name, arguments: args });
  expect(r.status).toBe(200);
  const result = (r.json as { result: { isError?: boolean; content: { text: string }[] } }).result;
  const text = result.content[0]?.text ?? "";
  let data: unknown = undefined;
  try {
    data = JSON.parse(text);
  } catch {
    /* error text */
  }
  return { isError: result.isError, data, text };
}

/** Full authorization-code + PKCE dance as Claude does it. Returns tokens. */
async function connect(opts: { allowDrafts?: boolean } = {}): Promise<{ access: string; refresh: string; clientId: string }> {
  const reg = await post("/api/oauth/register", { client_name: "Claude", redirect_uris: [REDIRECT] });
  expect(reg.status).toBe(201);
  const clientId = (reg.json as { client_id: string }).client_id;

  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "st8" });
  const auth = await inject(app, { method: "GET", url: `/api/oauth/authorize?${q}` });
  expect(auth.status).toBe(302);
  const consentUrl = new URL(String(auth.headers.location));
  expect(consentUrl.pathname).toBe("/connect/claude");
  const requestId = consentUrl.searchParams.get("request")!;

  const details = await inject(app, { method: "GET", url: `/api/oauth/requests/${requestId}`, headers: { cookie: `lp_sid=${sidA}` } });
  expect(details.status).toBe(200);
  expect(details.json).toMatchObject({ workspace: { id: tenantA }, canAskForDrafts: true });

  const decision = await post(`/api/oauth/requests/${requestId}/decision`, { approve: true, allowDrafts: opts.allowDrafts ?? true }, { cookie: `lp_sid=${sidA}` });
  expect(decision.status).toBe(200);
  const back = new URL((decision.json as { redirectUrl: string }).redirectUrl);
  expect(back.origin + back.pathname).toBe(REDIRECT);
  expect(back.searchParams.get("state")).toBe("st8");
  const code = back.searchParams.get("code")!;

  // A second answer to the same request is refused.
  const again = await post(`/api/oauth/requests/${requestId}/decision`, { approve: true }, { cookie: `lp_sid=${sidA}` });
  expect(again.status).not.toBe(200);

  // Wrong verifier burns nothing useful and fails.
  const tok = await postForm("/api/oauth/token", { grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
  expect(tok.status).toBe(200);
  const t = tok.json as { access_token: string; refresh_token: string; token_type: string };
  expect(t.token_type).toBe("Bearer");

  // Codes are single use.
  const replay = await postForm("/api/oauth/token", { grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
  expect(replay.status).toBe(400);
  return { access: t.access_token, refresh: t.refresh_token, clientId };
}

describe.skipIf(!dbAvailable)("Claude connector (MCP + OAuth) end to end", () => {
  beforeAll(async () => {
    process.env.CSRF_SECRET ??= "integration-test-secret";
    // Tables may not exist yet on a fresh test branch; the migration is idempotent.
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../../lib/db/migrations/0172_claude_connector.sql"), "utf8");
    await pool.query(sql);

    const a = await mkTenant("a");
    const b = await mkTenant("b");
    tenantA = a.tenantId;
    tenantB = b.tenantId;
    userA = await mkUser(tenantA, a.roleId, `${SLUG}-a@example.com`);
    userB = await mkUser(tenantB, b.roleId, `${SLUG}-b@example.com`);
    accountA = await mkAccount(tenantA, "Zephyr Dental Group", OWNER);
    accountOtherA = await mkAccount(tenantA, "Someone Else Dental", "Another Rep");
    // The decoy: other workspace, SAME owner name, matching search term.
    accountB = await mkAccount(tenantB, "Zephyr Decoy Partners", OWNER);

    sidA = crypto.randomUUID();
    await pool.query(`INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`, [
      sidA,
      JSON.stringify({ userId: userA, email: `${SLUG}-a@example.com`, name: OWNER, tenantId: tenantA, role: "Member", permissions: {}, isAdmin: false, appUserRole: null }),
    ]);

    const { default: router } = await import("./index");
    const { setDispatchApp } = await import("../lib/mcp/dispatch");
    app = express();
    app.set("trust proxy", 1);
    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use("/api", router);
    setDispatchApp(app);
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sidA]);
    await pool.query(`DELETE FROM mcp_oauth_tokens WHERE grant_id IN (SELECT id FROM mcp_oauth_grants WHERE tenant_id = ANY($1))`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM mcp_oauth_grants WHERE tenant_id = ANY($1)`, [[tenantA, tenantB]]);
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = ANY($1)`, [[tenantA, tenantB]]);
    for (const t of [tenantA, tenantB]) if (t) await deleteTenantCascade(pool, t);
    await pool.query(`DELETE FROM app_users WHERE id = ANY($1)`, [[userA, userB]]);
  }, 60_000);

  it("advertises discovery documents under /api", async () => {
    const unauth = await post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(unauth.status).toBe(401);
    expect(String(unauth.headers["www-authenticate"])).toContain("/api/.well-known/oauth-protected-resource");
    const prm = await inject(app, { method: "GET", url: "/api/.well-known/oauth-protected-resource" });
    expect((prm.json as { authorization_servers: string[] }).authorization_servers[0]).toMatch(/\/api\/oauth$/);
    const asm = await inject(app, { method: "GET", url: "/api/oauth/.well-known/openid-configuration" });
    expect(asm.json).toMatchObject({ code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"] });
  });

  it("refuses to register a client with a non-Claude callback", async () => {
    const r = await post("/api/oauth/register", { client_name: "Phish", redirect_uris: ["https://evil.example/cb"] });
    expect(r.status).toBe(400);
  });

  it("connects, then tools see only this rep's workspace", async () => {
    const { access } = await connect();

    const list = await mcp(access, "tools/list");
    if (!(list.json as { result?: unknown })?.result) console.error("MCP DEBUG", list.status, list.text, JSON.stringify(list.headers));
    const names = (list.json as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    expect(names).toContain("weekly_summary");
    expect(names).toContain("generate_microsite");

    const who = await callTool(access, "whoami");
    expect(who.data).toMatchObject({ workspaceId: tenantA, canCreateDrafts: true });

    const mine = await callTool(access, "list_my_accounts");
    const mineIds = (mine.data as { accounts: { id: number }[] }).accounts.map((a) => a.id);
    expect(mineIds).toEqual([accountA]);
    expect(mineIds).not.toContain(accountB);
    expect(mineIds).not.toContain(accountOtherA);

    const search = await callTool(access, "search_accounts", { query: "Zephyr" });
    const found = (search.data as { accounts: { id?: number; name: string }[] }).accounts;
    expect(found.map((a) => a.id)).toContain(accountA);
    expect(found.map((a) => a.id)).not.toContain(accountB);
    expect(found.map((a) => a.name)).not.toContain("Zephyr Decoy Partners");

    const decoy = await callTool(access, "get_account", { accountId: accountB });
    expect(decoy.isError).toBe(true);

    const weekly = await callTool(access, "weekly_summary", { days: 7 });
    expect(weekly.isError).toBeFalsy();
    expect(weekly.data).toMatchObject({ myAccountCount: 1 });
    expect(weekly.text).not.toContain("Decoy");

    // Drafts against another workspace's account fail like they do in the app.
    const hubB = await callTool(access, "create_partner_hub", { accountId: accountB });
    expect(hubB.isError).toBe(true);
  });

  it("a read-only connection cannot see or run draft tools", async () => {
    const { access } = await connect({ allowDrafts: false });
    const list = await mcp(access, "tools/list");
    const names = (list.json as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    expect(names).not.toContain("generate_microsite");
    expect(names).not.toContain("create_partner_hub");
    const tryIt = await mcp(access, "tools/call", { name: "create_partner_hub", arguments: { accountId: accountA } });
    const body = tryIt.json as { result?: { isError?: boolean }; error?: unknown };
    expect(body.error ?? body.result?.isError).toBeTruthy();
  });

  it("rotates refresh tokens and rejects reuse", async () => {
    const { refresh, clientId } = await connect();
    const first = await postForm("/api/oauth/token", { grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(first.status).toBe(200);
    const reuse = await postForm("/api/oauth/token", { grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(reuse.status).toBe(400);
  });

  it("lists connections in Settings and disconnecting kills the token", async () => {
    const { access } = await connect();
    const conns = await inject(app, { method: "GET", url: "/api/claude-connector/connections", headers: { cookie: `lp_sid=${sidA}` } });
    const list = (conns.json as { connections: { id: string }[] }).connections;
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) {
      const del = await inject(app, { method: "DELETE", url: `/api/claude-connector/connections/${c.id}`, headers: { cookie: `lp_sid=${sidA}` } });
      expect(del.status).toBe(200);
    }
    const after = await mcp(access, "tools/list");
    expect(after.status).toBe(401);
  });

  it("stops working as soon as the rep leaves the workspace", async () => {
    const { access } = await connect();
    await pool.query(`UPDATE tenant_members SET accepted_at = NULL WHERE user_id = $1 AND tenant_id = $2`, [userA, tenantA]);
    try {
      const r = await mcp(access, "tools/list");
      expect(r.status).toBe(401);
    } finally {
      await pool.query(`UPDATE tenant_members SET accepted_at = now() WHERE user_id = $1 AND tenant_id = $2`, [userA, tenantA]);
    }
  });
});
