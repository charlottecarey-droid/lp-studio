/**
 * Claude connector — the LP Studio MCP endpoint and its OAuth 2.1 server.
 *
 * A rep adds `<app>/api/mcp` to Claude as a custom connector. Claude:
 *   1. calls /api/mcp without a token → 401 pointing at our protected-resource
 *      metadata → finds the authorization server (`<app>/api/oauth`),
 *   2. registers itself (dynamic client registration; callback hosts are
 *      allowlisted, see oauthStore.isAllowedRedirectUri),
 *   3. sends the rep's browser to /api/oauth/authorize, which hands off to the
 *      SPA consent page `/connect/claude` (normal LP Studio sign-in first),
 *   4. swaps the code (PKCE S256) for access + refresh tokens,
 *   5. calls tools on /api/mcp with the access token. Tools act as the rep in
 *      the workspace they approved, through the app's own routes
 *      (lib/mcp/dispatch.ts).
 *
 * Production routing only sends /api/* to this server, so every discovery
 * document is ALSO served under /api; the root /.well-known/* copies
 * (`wellKnownRootRouter`) are mounted in app.ts for clients that only look
 * there, and reach us once the deploy routes those paths here.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { getRequestOrigin } from "../lib/requestHost";
import { writeAuditLog } from "../lib/auditLog";
import {
  ACCESS_TOKEN_TTL_S,
  SCOPE_DRAFTS,
  SUPPORTED_SCOPES,
  claimAuthRequest,
  consumeSecret,
  createAuthRequest,
  createGrantWithCode,
  getAuthRequest,
  getClient,
  isAllowedRedirectUri,
  issueTokens,
  listConnections,
  loadAuthUser,
  normalizeScope,
  redirectUriMatches,
  registerClient,
  resolveAccessToken,
  revokeBySecret,
  revokeConnection,
  scopeHas,
  verifyPkceS256,
  type Grant,
} from "../lib/mcp/oauthStore";
import { TOOLS, runTool, type ToolContext } from "../lib/mcp/tools";

const router = Router();

/* ── URLs ───────────────────────────────────────────────────────────────── */

/** Public origin. MCP_PUBLIC_BASE_URL pins it (e.g. behind a proxy that rewrites Host). */
export function publicOrigin(req: Request): string {
  const pinned = (process.env.MCP_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return pinned || getRequestOrigin(req);
}
/**
 * Where the consent page lives. The apex (lpstudio.ai / www.lpstudio.ai)
 * serves the marketing site, which has no /connect/claude route, so a
 * connector added with the apex URL would land on the marketing 404. Send
 * those to the app host; every other origin already serves the app.
 */
export function consentOriginFor(origin: string): string {
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    if (h === "lpstudio.ai" || h === "www.lpstudio.ai") return `${u.protocol}//app.lpstudio.ai`;
  } catch {
    // not a URL — leave it alone
  }
  return origin;
}

/**
 * The `iss` we return to Claude must be the issuer Claude discovered, which is
 * the origin of the resource it connected to — not necessarily the host the
 * consent page ran on (see consentOriginFor).
 */
export function issuerForResource(resource: string | null, fallbackIssuer: string): string {
  if (!resource) return fallbackIssuer;
  try {
    return `${new URL(resource).origin}/api/oauth`;
  } catch {
    return fallbackIssuer;
  }
}

const issuerOf = (req: Request) => `${publicOrigin(req)}/api/oauth`;
const resourceOf = (req: Request) => `${publicOrigin(req)}/api/mcp`;
const resourceMetadataUrl = (req: Request) => `${publicOrigin(req)}/api/.well-known/oauth-protected-resource`;

function protectedResourceMetadata(req: Request) {
  return {
    resource: resourceOf(req),
    authorization_servers: [issuerOf(req)],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "LP Studio",
  };
}

function authorizationServerMetadata(req: Request) {
  const issuer = issuerOf(req);
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    revocation_endpoint: `${issuer}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SUPPORTED_SCOPES],
    authorization_response_iss_parameter_supported: true,
  };
}

function discovery(build: (req: Request) => unknown) {
  return (req: Request, res: Response): void => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(build(req));
  };
}
const prm = discovery(protectedResourceMetadata);
const asm = discovery(authorizationServerMetadata);

/* ── Discovery (under /api) ─────────────────────────────────────────────── */

router.get(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp", "/mcp/.well-known/oauth-protected-resource"], prm);
router.get(
  [
    "/oauth/.well-known/oauth-authorization-server",
    "/oauth/.well-known/openid-configuration",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/oauth",
  ],
  asm,
);

/** Root-level copies, mounted on the app itself in app.ts. */
export const wellKnownRootRouter = Router();
wellKnownRootRouter.get(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/api/mcp"], prm);
wellKnownRootRouter.get(
  ["/.well-known/oauth-authorization-server/api/oauth", "/.well-known/openid-configuration/api/oauth", "/.well-known/oauth-authorization-server"],
  asm,
);

/* ── Dynamic client registration (RFC 7591) ─────────────────────────────── */

const registerLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "slow_down" } });

router.post("/oauth/register", registerLimiter, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || uris.length > 10) {
    res.status(400).json({ error: "invalid_redirect_uri", error_description: "redirect_uris is required (1-10 URIs)." });
    return;
  }
  const bad = uris.find((u) => !isAllowedRedirectUri(u));
  if (bad) {
    res.status(400).json({ error: "invalid_redirect_uri", error_description: `Redirect URI not allowed: ${bad}` });
    return;
  }
  const name = typeof body.client_name === "string" ? body.client_name.slice(0, 120) : null;
  try {
    const client = await registerClient(name, uris);
    res.status(201).setHeader("Cache-Control", "no-store");
    res.json({
      client_id: client.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.clientName ?? undefined,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SUPPORTED_SCOPES.join(" "),
    });
  } catch (err) {
    req.log?.error({ err }, "[mcp] client registration failed");
    res.status(500).json({ error: "server_error" });
  }
});

/* ── Authorization endpoint ─────────────────────────────────────────────── */

function redirectWithError(res: Response, redirectUri: string, error: string, state: string | null, issuer: string, description?: string): void {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (description) u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  u.searchParams.set("iss", issuer);
  res.redirect(302, u.toString());
}

router.get("/oauth/authorize", async (req: Request, res: Response): Promise<void> => {
  const q = req.query as Record<string, string | undefined>;
  const clientId = String(q.client_id ?? "");
  const redirectUri = String(q.redirect_uri ?? "");
  const state = q.state ? String(q.state) : null;
  const issuer = issuerOf(req);
  try {
    const client = clientId ? await getClient(clientId) : null;
    // Never redirect to an unverified URI: show an error instead.
    if (!client || !redirectUri || !redirectUriMatches(client.redirectUris, redirectUri) || !isAllowedRedirectUri(redirectUri)) {
      res.status(400).type("text/plain").send("This Claude connection request is invalid or has expired. Remove LP Studio from Claude's connectors and add it again.");
      return;
    }
    if (q.response_type !== "code") return redirectWithError(res, redirectUri, "unsupported_response_type", state, issuer);
    if (!q.code_challenge || q.code_challenge_method !== "S256") {
      return redirectWithError(res, redirectUri, "invalid_request", state, issuer, "PKCE with S256 is required.");
    }
    const resource = q.resource ? String(q.resource) : null;
    if (resource && resource.replace(/\/+$/, "") !== resourceOf(req)) {
      return redirectWithError(res, redirectUri, "invalid_target", state, issuer, "Unknown resource.");
    }
    const id = await createAuthRequest({
      clientId,
      redirectUri,
      codeChallenge: String(q.code_challenge),
      state,
      scope: normalizeScope(q.scope),
      resource,
    });
    res.redirect(302, `${consentOriginFor(publicOrigin(req))}/connect/claude?request=${encodeURIComponent(id)}`);
  } catch (err) {
    req.log?.error({ err }, "[mcp] authorize failed");
    redirectWithError(res, redirectUri, "server_error", state, issuer);
  }
});

/* ── Consent (the SPA page /connect/claude; normal session auth + CSRF) ─── */

router.get("/oauth/requests/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const ar = await getAuthRequest(String(req.params.id));
  if (!ar || ar.decidedAt) {
    res.status(404).json({ error: "This connection request has expired. Start again from Claude." });
    return;
  }
  const client = await getClient(ar.clientId);
  const user = req.authUser!;
  const ws = user.tenantId ? await pool.query(`SELECT name FROM tenants WHERE id = $1`, [user.tenantId]) : null;
  res.setHeader("Cache-Control", "no-store");
  res.json({
    clientName: client?.clientName || "Claude",
    redirectHost: new URL(ar.redirectUri).host,
    scopes: ar.scope.split(" "),
    canAskForDrafts: scopeHas(ar.scope, SCOPE_DRAFTS),
    user: { name: user.name, email: user.email },
    workspace: user.tenantId ? { id: user.tenantId, name: ws?.rows[0]?.name ?? "" } : null,
  });
});

router.post("/oauth/requests/:id/decision", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.authUser!;
  const ar = await getAuthRequest(String(req.params.id));
  if (!ar || ar.decidedAt) {
    res.status(404).json({ error: "This connection request has expired. Start again from Claude." });
    return;
  }
  const approve = req.body?.approve === true;
  const issuer = issuerForResource(ar.resource, issuerOf(req));
  if (!(await claimAuthRequest(ar.id))) {
    res.status(409).json({ error: "This connection request was already answered." });
    return;
  }
  const back = new URL(ar.redirectUri);
  if (ar.state) back.searchParams.set("state", ar.state);
  back.searchParams.set("iss", issuer);
  if (!approve) {
    back.searchParams.set("error", "access_denied");
    res.json({ redirectUrl: back.toString() });
    return;
  }
  if (user.tenantId == null || !(await loadAuthUser(user.userId, user.tenantId))) {
    res.status(403).json({ error: "You need to be an active member of a workspace to connect Claude." });
    return;
  }
  const scope = req.body?.allowDrafts === false ? normalizeScope(ar.scope.split(" ").filter((s) => s !== SCOPE_DRAFTS).join(" ") || "lpstudio:read") : ar.scope;
  const { grantId, code } = await createGrantWithCode({ clientId: ar.clientId, userId: user.userId, tenantId: user.tenantId, scope }, ar.redirectUri, ar.codeChallenge);
  await writeAuditLog({
    actorUserId: user.userId,
    actorEmail: user.email,
    action: "claude_connector.connected",
    targetType: "mcp_grant",
    targetKey: grantId,
    metadata: { tenantId: user.tenantId, scope, clientId: ar.clientId },
  });
  back.searchParams.set("code", code);
  res.json({ redirectUrl: back.toString() });
});

/* ── Token + revocation ─────────────────────────────────────────────────── */

const tokenLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: "slow_down" } });

function tokenError(res: Response, status: number, error: string, description?: string): void {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.json({ error, ...(description ? { error_description: description } : {}) });
}

router.post("/oauth/token", tokenLimiter, async (req: Request, res: Response): Promise<void> => {
  const b = (req.body ?? {}) as Record<string, string | undefined>;
  try {
    if (b.grant_type === "authorization_code") {
      if (!b.code || !b.code_verifier || !b.client_id) return tokenError(res, 400, "invalid_request", "code, code_verifier and client_id are required.");
      const row = await consumeSecret(b.code, "code");
      if (!row || row.clientId !== b.client_id || (b.redirect_uri && row.redirectUri !== b.redirect_uri) || !row.codeChallenge || !verifyPkceS256(b.code_verifier, row.codeChallenge)) {
        return tokenError(res, 400, "invalid_grant");
      }
      const t = await issueTokens(row.grantId);
      res.setHeader("Cache-Control", "no-store");
      res.json({ access_token: t.accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: t.refreshToken, scope: row.scope });
      return;
    }
    if (b.grant_type === "refresh_token") {
      if (!b.refresh_token || !b.client_id) return tokenError(res, 400, "invalid_request", "refresh_token and client_id are required.");
      const row = await consumeSecret(b.refresh_token, "refresh");
      if (!row || row.clientId !== b.client_id) return tokenError(res, 400, "invalid_grant");
      // Still a member? A removed rep's connection ends here rather than at the next tool call.
      if (!(await loadAuthUser(row.userId, row.tenantId))) {
        await pool.query(`UPDATE mcp_oauth_grants SET revoked_at = now() WHERE id = $1`, [row.grantId]);
        return tokenError(res, 400, "invalid_grant", "No longer a member of this workspace.");
      }
      const t = await issueTokens(row.grantId);
      res.setHeader("Cache-Control", "no-store");
      res.json({ access_token: t.accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: t.refreshToken, scope: row.scope });
      return;
    }
    tokenError(res, 400, "unsupported_grant_type");
  } catch (err) {
    req.log?.error({ err }, "[mcp] token failed");
    tokenError(res, 500, "server_error");
  }
});

router.post("/oauth/revoke", tokenLimiter, async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (token) await revokeBySecret(token).catch(() => {});
  res.status(200).json({});
});

/* ── The rep's connections (Settings → Integrations → Claude) ───────────── */

router.get("/claude-connector/connections", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const u = req.authUser!;
  if (u.tenantId == null) {
    res.json({ mcpUrl: resourceOf(req), connections: [] });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ mcpUrl: resourceOf(req), connections: await listConnections(u.userId, u.tenantId) });
});

router.delete("/claude-connector/connections/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const u = req.authUser!;
  const ok = u.tenantId != null && (await revokeConnection(String(req.params.id), u.userId, u.tenantId));
  if (!ok) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }
  await writeAuditLog({ actorUserId: u.userId, actorEmail: u.email, action: "claude_connector.disconnected", targetType: "mcp_grant", targetKey: String(req.params.id), metadata: { tenantId: u.tenantId } });
  res.json({ ok: true });
});

/* ── The MCP endpoint ───────────────────────────────────────────────────── */

interface McpLocals {
  grant: Grant;
  ctx: ToolContext;
}

async function bearer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const unauthorized = (error?: string) => {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${resourceMetadataUrl(req)}"${error ? `, error="${error}"` : ""}, scope="${SUPPORTED_SCOPES.join(" ")}"`,
    );
    res.status(401).json({ error: error ?? "unauthorized" });
  };
  const header = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return unauthorized();
  try {
    const grant = await resolveAccessToken(m[1].trim());
    if (!grant) return unauthorized("invalid_token");
    const user = await loadAuthUser(grant.userId, grant.tenantId);
    if (!user) return unauthorized("invalid_token");
    (res.locals as McpLocals).grant = grant;
    (res.locals as McpLocals).ctx = { user, scope: grant.scope, origin: publicOrigin(req) };
    next();
  } catch (err) {
    req.log?.error({ err }, "[mcp] token check failed");
    res.status(503).json({ error: "temporarily_unavailable" });
  }
}

/** Per connection, generous: a weekly digest is ~5 tool calls. */
const mcpLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (_req, res) => `mcp:${(res.locals as McpLocals).grant?.id ?? "anon"}`,
  message: { jsonrpc: "2.0", error: { code: -32000, message: "Too many requests. Slow down." }, id: null },
});

export function buildMcpServer(ctx: ToolContext, grantId: string): McpServer {
  const server = new McpServer(
    { name: "lp-studio", title: "LP Studio", version: "1.0.0" },
    {
      instructions:
        "LP Studio is the rep's landing-page and account-engagement workspace. For a weekly update call weekly_summary first. Links point into the LP Studio app. Draft tools never publish or send anything; tell the rep to review drafts in LP Studio.",
    },
  );
  for (const tool of TOOLS) {
    if (!scopeHas(ctx.scope, tool.scope)) continue;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { title: tool.title, readOnlyHint: tool.readOnly, destructiveHint: false, idempotentHint: tool.readOnly, openWorldHint: false },
      },
      async (args: Record<string, unknown>) => {
        if (!tool.readOnly) {
          await writeAuditLog({
            actorUserId: ctx.user.userId,
            actorEmail: ctx.user.email,
            action: `claude_connector.${tool.name}`,
            targetType: "mcp_grant",
            targetKey: grantId,
            metadata: { tenantId: ctx.user.tenantId, args },
          });
        }
        return runTool(tool, ctx, args);
      },
    );
  }
  return server;
}

router.post("/mcp", bearer, mcpLimiter, async (req: Request, res: Response): Promise<void> => {
  const { ctx, grant } = res.locals as McpLocals;
  const server = buildMcpServer(ctx, grant.id);
  // Stateless: one server + transport per HTTP request, JSON responses (no SSE).
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    req.log?.error({ err }, "[mcp] request failed");
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});

// Stateless server: no standalone SSE stream and no sessions to delete.
router.get("/mcp", bearer, (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
});
router.delete("/mcp", bearer, (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
});

export default router;
