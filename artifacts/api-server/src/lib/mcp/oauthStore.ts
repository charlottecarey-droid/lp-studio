/**
 * Claude connector — OAuth 2.1 storage (authorization code + PKCE S256,
 * dynamic client registration, rotating refresh tokens).
 *
 * Every secret we hand out (code, access token, refresh token) is 32 random
 * bytes, and only its SHA-256 hash is stored. A token resolves to a grant
 * (rep + workspace + client); the rep's identity is re-derived from their
 * CURRENT workspace membership on every use, so removing someone from a
 * workspace or changing their role takes effect on the next call.
 */
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import type { AuthUser } from "../../middleware/requireAuth";
import { isRootSuperadminEmail } from "../rootSuperadmin";

export const SCOPE_READ = "lpstudio:read";
export const SCOPE_DRAFTS = "lpstudio:drafts";
/** Edit, version, restore and publish pages (Nov 2026). */
export const SCOPE_PAGES = "lpstudio:pages";
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_DRAFTS, SCOPE_PAGES] as const;

export const ACCESS_TOKEN_TTL_S = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 60; // 60 days
const CODE_TTL_S = 5 * 60;
const REQUEST_TTL_S = 30 * 60; // time to sign in + approve

export const sha256 = (v: string): string => crypto.createHash("sha256").update(v).digest("hex");
const randomSecret = (): string => crypto.randomBytes(32).toString("base64url");
const randomId = (): string => crypto.randomBytes(16).toString("base64url");

/* ── Scopes ─────────────────────────────────────────────────────────────── */

/** Requested scope string → the supported subset (default: everything). */
export function normalizeScope(requested: string | null | undefined): string {
  const asked = (requested ?? "").split(/\s+/).filter(Boolean);
  const known = asked.filter((s): s is (typeof SUPPORTED_SCOPES)[number] => (SUPPORTED_SCOPES as readonly string[]).includes(s));
  const picked = known.length ? known : [...SUPPORTED_SCOPES];
  // Drafts always implies read: a tool that makes a draft has to find the account first.
  // Same for page editing.
  if ((picked.includes(SCOPE_DRAFTS) || picked.includes(SCOPE_PAGES)) && !picked.includes(SCOPE_READ)) picked.unshift(SCOPE_READ);
  return [...new Set(picked)].join(" ");
}

export const scopeHas = (scope: string | null | undefined, s: string): boolean => (scope ?? "").split(/\s+/).includes(s);

/* ── Redirect URIs ──────────────────────────────────────────────────────── */

/**
 * Which callback URLs a registered client may use. Claude's hosted callback
 * (claude.ai / claude.com) and loopback callbacks (Claude Desktop, Claude
 * Code) by default; more hosts via MCP_EXTRA_REDIRECT_HOSTS (comma-separated).
 * An allowlist keeps an arbitrary site from registering a client and using
 * our consent screen to phish a rep's token.
 */
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  const host = u.hostname.toLowerCase();
  if (u.protocol === "http:") return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (u.protocol !== "https:") return false;
  const extra = (process.env.MCP_EXTRA_REDIRECT_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const allowed = ["claude.ai", "claude.com", ...extra];
  return allowed.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Loopback redirect URIs may use any port (RFC 8252 §7.3). */
export function redirectUriMatches(registered: string[], uri: string): boolean {
  if (registered.includes(uri)) return true;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol !== "http:") return false;
  const strip = (x: URL) => `${x.protocol}//${x.hostname}${x.pathname}${x.search}`;
  return registered.some((r) => {
    try {
      const ru = new URL(r);
      return ru.protocol === "http:" && strip(ru) === strip(u);
    } catch {
      return false;
    }
  });
}

/* ── Clients ────────────────────────────────────────────────────────────── */

export interface OAuthClient {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
}

export async function registerClient(clientName: string | null, redirectUris: string[]): Promise<OAuthClient> {
  const clientId = `lpsc_${randomId()}`;
  await pool.query(`INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris) VALUES ($1, $2, $3::jsonb)`, [
    clientId,
    clientName,
    JSON.stringify(redirectUris),
  ]);
  return { clientId, clientName, redirectUris };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const r = await pool.query(`SELECT client_id, client_name, redirect_uris FROM mcp_oauth_clients WHERE client_id = $1`, [clientId]);
  const row = r.rows[0];
  if (!row) return null;
  return { clientId: row.client_id, clientName: row.client_name ?? null, redirectUris: (row.redirect_uris as string[]) ?? [] };
}

/* ── Pending authorization requests ─────────────────────────────────────── */

export interface AuthRequest {
  id: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scope: string;
  resource: string | null;
  expiresAt: Date;
  decidedAt: Date | null;
}

export async function createAuthRequest(input: Omit<AuthRequest, "id" | "expiresAt" | "decidedAt">): Promise<string> {
  const id = randomSecret();
  await pool.query(
    `INSERT INTO mcp_oauth_requests (id, client_id, redirect_uri, code_challenge, state, scope, resource, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8))`,
    [id, input.clientId, input.redirectUri, input.codeChallenge, input.state, input.scope, input.resource, REQUEST_TTL_S],
  );
  // Opportunistic cleanup of long-dead rows; cheap and bounded by the index-less table staying small.
  void pool.query(`DELETE FROM mcp_oauth_requests WHERE expires_at < now() - interval '1 day'`).catch(() => {});
  return id;
}

export async function getAuthRequest(id: string): Promise<AuthRequest | null> {
  const r = await pool.query(
    `SELECT id, client_id, redirect_uri, code_challenge, state, scope, resource, expires_at, decided_at
       FROM mcp_oauth_requests WHERE id = $1 AND expires_at > now()`,
    [id],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    state: row.state ?? null,
    scope: row.scope ?? "",
    resource: row.resource ?? null,
    expiresAt: new Date(row.expires_at),
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
  };
}

/** Marks the request decided exactly once; false when someone already did. */
export async function claimAuthRequest(id: string): Promise<boolean> {
  const r = await pool.query(`UPDATE mcp_oauth_requests SET decided_at = now() WHERE id = $1 AND decided_at IS NULL AND expires_at > now()`, [id]);
  return (r.rowCount ?? 0) === 1;
}

/* ── Grants + tokens ────────────────────────────────────────────────────── */

export interface Grant {
  id: string;
  clientId: string;
  userId: number;
  tenantId: number;
  scope: string;
}

export async function createGrantWithCode(
  g: Omit<Grant, "id">,
  redirectUri: string,
  codeChallenge: string,
): Promise<{ grantId: string; code: string }> {
  const grantId = randomId();
  const code = randomSecret();
  await pool.query(`INSERT INTO mcp_oauth_grants (id, client_id, user_id, tenant_id, scope) VALUES ($1, $2, $3, $4, $5)`, [
    grantId,
    g.clientId,
    g.userId,
    g.tenantId,
    g.scope,
  ]);
  await pool.query(
    `INSERT INTO mcp_oauth_tokens (token_hash, kind, grant_id, redirect_uri, code_challenge, expires_at)
     VALUES ($1, 'code', $2, $3, $4, now() + make_interval(secs => $5))`,
    [sha256(code), grantId, redirectUri, codeChallenge, CODE_TTL_S],
  );
  return { grantId, code };
}

interface TokenRow {
  grantId: string;
  kind: string;
  redirectUri: string | null;
  codeChallenge: string | null;
  clientId: string;
  userId: number;
  tenantId: number;
  scope: string;
}

/**
 * Atomically consume a single-use secret (code or refresh token). Returns
 * null when it's unknown, expired, already used, the wrong kind, or its grant
 * was revoked.
 */
export async function consumeSecret(secret: string, kind: "code" | "refresh"): Promise<TokenRow | null> {
  const r = await pool.query(
    `UPDATE mcp_oauth_tokens t SET used_at = now()
       FROM mcp_oauth_grants g
      WHERE t.token_hash = $1 AND t.kind = $2 AND t.used_at IS NULL AND t.expires_at > now()
        AND g.id = t.grant_id AND g.revoked_at IS NULL
      RETURNING t.grant_id, t.kind, t.redirect_uri, t.code_challenge, g.client_id, g.user_id, g.tenant_id, g.scope`,
    [sha256(secret), kind],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    grantId: row.grant_id,
    kind: row.kind,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    clientId: row.client_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    scope: row.scope ?? "",
  };
}

export async function issueTokens(grantId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = randomSecret();
  const refreshToken = randomSecret();
  await pool.query(
    `INSERT INTO mcp_oauth_tokens (token_hash, kind, grant_id, expires_at) VALUES
       ($1, 'access', $3, now() + make_interval(secs => $4)),
       ($2, 'refresh', $3, now() + make_interval(secs => $5))`,
    [sha256(accessToken), sha256(refreshToken), grantId, ACCESS_TOKEN_TTL_S, REFRESH_TOKEN_TTL_S],
  );
  // Expired/used secrets are dead weight; trim this grant's.
  void pool
    .query(`DELETE FROM mcp_oauth_tokens WHERE grant_id = $1 AND (expires_at < now() OR (used_at IS NOT NULL AND used_at < now() - interval '1 day'))`, [grantId])
    .catch(() => {});
  return { accessToken, refreshToken };
}

/** Access token → its live grant, or null. Touches last_used_at (throttled). */
export async function resolveAccessToken(token: string): Promise<Grant | null> {
  const r = await pool.query(
    `SELECT g.id, g.client_id, g.user_id, g.tenant_id, g.scope
       FROM mcp_oauth_tokens t JOIN mcp_oauth_grants g ON g.id = t.grant_id
      WHERE t.token_hash = $1 AND t.kind = 'access' AND t.expires_at > now() AND g.revoked_at IS NULL`,
    [sha256(token)],
  );
  const row = r.rows[0];
  if (!row) return null;
  void pool
    .query(`UPDATE mcp_oauth_grants SET last_used_at = now() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')`, [row.id])
    .catch(() => {});
  return { id: row.id, clientId: row.client_id, userId: row.user_id, tenantId: row.tenant_id, scope: row.scope ?? "" };
}

/** RFC 7009: revoking either token kills the whole connection. Unknown tokens are a no-op. */
export async function revokeBySecret(secret: string): Promise<void> {
  await pool.query(
    `UPDATE mcp_oauth_grants SET revoked_at = now()
      WHERE revoked_at IS NULL AND id = (SELECT grant_id FROM mcp_oauth_tokens WHERE token_hash = $1 AND kind IN ('access', 'refresh'))`,
    [sha256(secret)],
  );
}

/* ── Connections (the rep's Settings view) ──────────────────────────────── */

export interface Connection {
  id: string;
  clientName: string | null;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listConnections(userId: number, tenantId: number): Promise<Connection[]> {
  const r = await pool.query(
    `SELECT g.id, c.client_name, g.scope, g.created_at, g.last_used_at
       FROM mcp_oauth_grants g LEFT JOIN mcp_oauth_clients c ON c.client_id = g.client_id
      WHERE g.user_id = $1 AND g.tenant_id = $2 AND g.revoked_at IS NULL
      ORDER BY COALESCE(g.last_used_at, g.created_at) DESC`,
    [userId, tenantId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    clientName: row.client_name ?? null,
    scope: row.scope ?? "",
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  }));
}

/** Only the rep who owns the connection can revoke it. */
export async function revokeConnection(id: string, userId: number, tenantId: number): Promise<boolean> {
  const r = await pool.query(
    `UPDATE mcp_oauth_grants SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND revoked_at IS NULL`,
    [id, userId, tenantId],
  );
  return (r.rowCount ?? 0) === 1;
}

/* ── Identity ───────────────────────────────────────────────────────────── */

/**
 * The rep as the app would see them in this workspace right now: same
 * membership query as the workspace switcher (accepted member of an active
 * tenant), same role/permission fields as a login session. Null when they're
 * no longer a member, so a removed rep's connector stops working at once.
 */
export async function loadAuthUser(userId: number, tenantId: number): Promise<AuthUser | null> {
  const r = await pool.query(
    `SELECT u.id, u.email, u.name, u.avatar_url, u.role AS app_role, u.status AS user_status,
            t.microsite_domain, tr.name AS role_name, tr.permissions, tr.is_admin
       FROM app_users u
       JOIN tenant_members tm ON tm.user_id = u.id
       JOIN tenants t ON t.id = tm.tenant_id
       JOIN tenant_roles tr ON tr.id = tm.role_id
      WHERE u.id = $1 AND tm.tenant_id = $2 AND tm.accepted_at IS NOT NULL AND t.status = 'active'
      LIMIT 1`,
    [userId, tenantId],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.user_status && row.user_status !== "active") return null;
  return {
    userId: row.id,
    email: row.email,
    name: row.name ?? "",
    avatarUrl: row.avatar_url ?? null,
    tenantId,
    role: row.role_name,
    permissions: (row.permissions as Record<string, boolean>) ?? {},
    isAdmin: !!row.is_admin,
    appUserRole: isRootSuperadminEmail(row.email) ? "superadmin" : (row.app_role ?? null),
  };
}

/* ── PKCE ───────────────────────────────────────────────────────────────── */

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
