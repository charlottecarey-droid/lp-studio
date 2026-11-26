/**
 * Claude connector — pure tests (no database).
 *
 * The DB-backed end-to-end flow (OAuth → token → tools, cross-tenant decoy)
 * is in routes/mcp.integration.test.ts.
 */
import { vi, describe, it, expect, beforeAll } from "vitest";

vi.hoisted(() => {
  // @workspace/db builds its pool at import; nothing here connects.
  process.env.DATABASE_URL ??= "postgres://unit:unit@127.0.0.1:1/unit";
});

import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { requireAuth, getTenantId, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import { dispatch, setDispatchApp, rateLimitAddressFor } from "./dispatch";
import { isAllowedRedirectUri, normalizeScope, redirectUriMatches, verifyPkceS256, scopeHas } from "./oauthStore";
import { auditArgs, compact, TOOLS } from "./tools";
import { deepMerge, findBlock, outlineOf } from "./pageTools";
import { buildMcpServer } from "../../routes/mcp";

const rep: AuthUser = {
  userId: 4242,
  email: "rep@example.com",
  name: "Pat Rep",
  tenantId: 77,
  role: "Member",
  permissions: {},
  isAdmin: false,
  appUserRole: null,
};

describe("redirect URI allowlist", () => {
  it("allows Claude's hosted callbacks and loopback", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://claude.com/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:6274/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/callback")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isAllowedRedirectUri("https://evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai.evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://evilclaude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("http://claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
  });
  it("matches loopback callbacks on any port, others exactly", () => {
    expect(redirectUriMatches(["http://localhost:1000/cb"], "http://localhost:5555/cb")).toBe(true);
    expect(redirectUriMatches(["http://localhost:1000/cb"], "http://localhost:5555/other")).toBe(false);
    expect(redirectUriMatches(["https://claude.ai/api/mcp/auth_callback"], "https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(redirectUriMatches(["https://claude.ai/api/mcp/auth_callback"], "https://claude.ai/api/mcp/auth_callback2")).toBe(false);
  });
});

describe("scopes", () => {
  it("defaults to everything and drops unknown scopes", () => {
    expect(normalizeScope(undefined)).toBe("lpstudio:read lpstudio:drafts lpstudio:pages");
    expect(normalizeScope("bogus")).toBe("lpstudio:read lpstudio:drafts lpstudio:pages");
    expect(normalizeScope("lpstudio:read")).toBe("lpstudio:read");
  });
  it("drafts implies read", () => {
    expect(scopeHas(normalizeScope("lpstudio:drafts"), "lpstudio:read")).toBe(true);
  });
  it("page editing implies read", () => {
    expect(normalizeScope("lpstudio:pages")).toBe("lpstudio:read lpstudio:pages");
  });
});

describe("PKCE S256", () => {
  it("accepts the matching verifier only", () => {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256(`${verifier}x`, challenge)).toBe(false);
    expect(verifyPkceS256("short", challenge)).toBe(false);
  });
});

describe("compact", () => {
  it("drops page bodies and tracking tokens, bounds strings and arrays", () => {
    const out = compact({ title: "x", blocks: [{ a: 1 }], token: "secret", long: "y".repeat(2000), list: Array.from({ length: 60 }, (_, i) => i) }) as Record<string, unknown>;
    expect(out.blocks).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(String(out.long).length).toBeLessThan(700);
    expect((out.list as unknown[]).length).toBe(41);
  });
});

describe("in-process dispatch", () => {
  beforeAll(() => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(cookieParser());
    app.use(express.json());
    app.get("/api/probe", requireAuth, (req, res) => {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      res.json({ userId: req.authUser?.userId, tenantId, ip: req.ip });
    });
    app.post("/api/echo", requireAuth, (req, res) => res.json({ body: req.body }));
    setDispatchApp(app);
  });

  it("runs the route as the connector's rep, with a per-rep rate-limit address", async () => {
    const r = await dispatch(rep, { method: "GET", path: "/probe" });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ userId: 4242, tenantId: 77, ip: rateLimitAddressFor(4242) });
    expect(rateLimitAddressFor(4242)).not.toBe(rateLimitAddressFor(4243));
  });

  it("carries JSON bodies", async () => {
    const r = await dispatch(rep, { method: "POST", path: "/echo", body: { a: 1 } });
    expect(r.json).toEqual({ body: { a: 1 } });
  });

  it("cannot be reached from outside: a normal request without a session is still 401", async () => {
    const app = express();
    app.use(cookieParser());
    app.get("/api/probe", requireAuth, (_req, res) => res.json({ ok: true }));
    const r = await inject(app, { method: "GET", url: "/api/probe", headers: { "x-internal": "1", authorization: "Bearer whatever" } });
    expect(r.status).toBe(401);
  });
});

describe("MCP server", () => {
  const ctx = (scope: string) => ({ user: rep, scope, origin: "https://app.example" });

  async function connect(scope: string) {
    const server = buildMcpServer(ctx(scope), "grant-1");
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
  }

  it("lists every tool for a full grant", async () => {
    const client = await connect("lpstudio:read lpstudio:drafts lpstudio:pages");
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(TOOLS.map((t) => t.name));
    expect(names).toContain("update_block");
    expect(names).toContain("generate_microsite");
    expect(names).toContain("weekly_summary");
  });

  it("hides draft tools from a read-only grant", async () => {
    const client = await connect("lpstudio:read");
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("generate_microsite");
    expect(names).not.toContain("create_partner_hub");
    expect(names).not.toContain("draft_email");
    expect(names).toContain("list_my_accounts");
    expect(names).not.toContain("get_page");
    expect(names).not.toContain("publish_page");
  });

  it("hides page tools from a grant without page editing", async () => {
    const client = await connect("lpstudio:read lpstudio:drafts");
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("generate_microsite");
    for (const n of ["get_page", "update_page", "update_block", "restore_page_version", "publish_page", "screenshot_page"]) expect(names).not.toContain(n);
  });

  it("flags publishing and restoring as destructive", async () => {
    const client = await connect("lpstudio:read lpstudio:pages");
    const tools = (await client.listTools()).tools;
    const hint = (n: string) => tools.find((t) => t.name === n)?.annotations?.destructiveHint;
    expect(hint("publish_page")).toBe(true);
    expect(hint("unpublish_page")).toBe(true);
    expect(hint("restore_page_version")).toBe(true);
    expect(hint("update_block")).toBe(false);
    expect(hint("get_page")).toBe(false);
  });

  it("whoami reports the rep and their permissions", async () => {
    const client = await connect("lpstudio:read");
    const res = await client.callTool({ name: "whoami", arguments: {} });
    const data = JSON.parse((res.content as { text: string }[])[0].text);
    expect(data).toMatchObject({ email: "rep@example.com", workspaceId: 77, canCreateDrafts: false, app: "https://app.example" });
  });

  it("marks only the creating and editing tools as not read-only", () => {
    const writers = TOOLS.filter((t) => !t.readOnly).map((t) => t.name).sort();
    expect(writers).toEqual([
      "checkpoint_page", "create_page", "create_partner_hub", "duplicate_page", "generate_microsite", "publish_page",
      "restore_page_version", "unpublish_page", "update_block", "update_page", "upload_media",
    ]);
    for (const t of TOOLS.filter((x) => x.scope === "lpstudio:read")) expect(t.readOnly).toBe(true);
  });
});

describe("consent host + issuer", () => {
  it("sends apex hosts to the app host (the apex is the marketing site)", async () => {
    const { consentOriginFor } = await import("../../routes/mcp");
    expect(consentOriginFor("https://lpstudio.ai")).toBe("https://app.lpstudio.ai");
    expect(consentOriginFor("https://www.lpstudio.ai")).toBe("https://app.lpstudio.ai");
    expect(consentOriginFor("https://app.lpstudio.ai")).toBe("https://app.lpstudio.ai");
    expect(consentOriginFor("https://lp.meetdandy.com")).toBe("https://lp.meetdandy.com");
    expect(consentOriginFor("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("returns the issuer Claude discovered, not the consent page's host", async () => {
    const { issuerForResource } = await import("../../routes/mcp");
    expect(issuerForResource("https://lpstudio.ai/api/mcp", "https://app.lpstudio.ai/api/oauth")).toBe("https://lpstudio.ai/api/oauth");
    expect(issuerForResource(null, "https://app.lpstudio.ai/api/oauth")).toBe("https://app.lpstudio.ai/api/oauth");
  });
});

describe("page tool helpers", () => {
  const blocks = [
    { id: "hero-1", type: "hero", props: { headline: "Hello there", cta: { label: "Book", url: "#" }, imageUrl: "https://x/y.png" } },
    { id: "sec-1", type: "section", props: {}, children: [{ id: "txt-1", type: "rich-text", props: { html: "<p>Inner copy</p>" } }] },
  ];

  it("finds nested blocks and outlines the tree", () => {
    expect(findBlock(blocks, "txt-1")?.type).toBe("rich-text");
    expect(findBlock(blocks, "nope")).toBeNull();
    const outline = outlineOf(blocks);
    expect(outline.map((o) => [o.id, o.depth])).toEqual([["hero-1", 0], ["sec-1", 0], ["txt-1", 1]]);
    expect(outline[0].text).toContain("Hello there");
    expect(outline[0].text).not.toContain("https://");
    expect(outline[2]).toMatchObject({ parentId: "sec-1", text: "Inner copy" });
  });

  it("deep-merges props: objects merge, arrays and scalars replace, null clears", () => {
    expect(deepMerge({ a: 1, cta: { label: "Book", url: "#" }, list: [1, 2] }, { cta: { label: "Talk" }, list: [3], b: null })).toEqual({
      a: 1, cta: { label: "Talk", url: "#" }, list: [3], b: null,
    });
  });

  it("keeps big payloads out of the audit log", () => {
    const a = auditArgs({ pageId: 3, blocks: [{}, {}], customCss: "x".repeat(1000), ctaDefault: { label: "Hi" } });
    expect(a).toMatchObject({ pageId: 3, blocks: "[2 items]", ctaDefault: { label: "Hi" } });
    expect(String(a.customCss).length).toBeLessThan(400);
  });
});
