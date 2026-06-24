import { Router } from "express";
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { pool, db, lpPageReviewsTable, lpPagesTable, tenantsTable, lpBrandSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { findTenantByHost, extractWildcardSlug, isWildcardBaseHost, WILDCARD_BASE_HOSTS, isSlugRedirectReserved, invalidateTenantHostCache, defaultPageSubdomain } from "../lib/tenantHosts";
import { getRequestHost } from "../lib/requestHost";
import {
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
} from "../lib/notifications";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../lib/password";
import { verifyTurnstile } from "../lib/turnstile";
import {
  twilioConfigured,
  lookupLineType,
  isVoipLineType,
  sendVerificationCode,
  checkVerificationCode,
} from "../lib/twilioVerify";
import {
  isValidE164,
  hashPhone,
  mintPhoneVerifiedToken,
  redeemPhoneVerifiedToken,
  hasPhoneTrialed,
  recordPhoneTrial,
} from "../lib/phoneVerification";
import {
  mintEmailToken,
  redeemEmailToken,
  invalidateUserTokens,
} from "../lib/authEmailTokens";
import { mintOAuthState, redeemOAuthState } from "../lib/oauthState";
import { dispatchNotification } from "../lib/notificationDispatcher";
import { enqueueWorkflowTrigger } from "../lib/workflowEngine";
import {
  normalizePlan,
  TRIAL_DURATION_DAYS,
  effectivePlan,
  computeTrialState,
  isProtectedEnterpriseSlug,
  type Plan,
} from "../lib/planFeatures";
import { getPlanFeaturesMap } from "../lib/planConfig";
import { isRootSuperadminEmail } from "../lib/rootSuperadmin";

/**
 * Pick the user-facing wildcard base host for building tenant login URLs
 * (e.g. "lpstudio.ai"). Prefers a base that does NOT start with "app." so
 * users see the cleaner `<slug>.lpstudio.ai` rather than
 * `<slug>.app.lpstudio.ai`. Falls back to the first configured base.
 */
/**
 * Validate a post-login "next" destination. We accept only relative,
 * same-origin paths so an attacker can't piggy-back the auth flow into an
 * open redirect (e.g. `?next=https://evil.com`). Anything else collapses to
 * `null` and the caller falls back to `/`.
 *
 * Rules:
 *   - Must start with a single `/` (path-absolute), so we stay on the same
 *     origin as the callback/accept endpoint.
 *   - Must NOT start with `//` or `/\` — both can be interpreted by browsers
 *     as protocol-relative URLs and would escape the origin.
 *   - Capped at 2048 chars to keep DB/log/cookie footprints sane.
 */
function sanitizeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

function publicWildcardBaseHost(): string | null {
  const preferred = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app."));
  return preferred ?? WILDCARD_BASE_HOSTS[0] ?? null;
}

/**
 * Compute the canonical login host for a tenant. Prefers the tenant's
 * configured custom `domain` (e.g. meetdandy-lp.com); otherwise falls back
 * to `<slug>.<wildcardBaseHost>` (e.g. acme.lpstudio.ai).
 */
function getCanonicalTenantHost(t: { domain: string | null; slug: string | null }): string | null {
  if (t.domain) return t.domain.toLowerCase();
  const base = publicWildcardBaseHost();
  if (!base || !t.slug) return null;
  return `${t.slug.toLowerCase()}.${base}`;
}

const router = Router();

// Rate limit OAuth initiation: 20 per IP per minute.
const oauthInitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a minute." },
});

// Strict rate limit for password-based auth: 5 attempts per 15 minutes per IP.
// Tighter than the OAuth limiter because password endpoints accept a shared
// secret and must not be brute-forceable.
const passwordAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again later." },
});

// Rate limit for endpoints that SEND an email (magic link, register, forgot
// password, resend verification): 5 per IP per 15 minutes. Tight enough to
// blunt email-bombing / enumeration probing while leaving room for a genuine
// retry after a typo.
const emailSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Strict rate limit for the public workspace finder: 15 lookups per IP per
// minute. The finder is exact-match only and never lists/enumerates, but we
// still cap it tightly to blunt brute-force tenant-existence probing.
const findWorkspaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookups. Please try again in a minute." },
});

// Strict rate limit for the SMS send endpoint: 5 per IP per 15 minutes. Each
// hit costs a real SMS, so this is as tight as the email-send limiter to blunt
// SMS-pumping / toll-fraud and verification-spam against a single number.
const phoneSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many code requests. Please try again later." },
});

// Rate limit for the code-check endpoint: 10 per IP per 15 minutes. Twilio
// Verify enforces its own per-verification attempt cap; this is a coarse outer
// guard against distributed code-guessing.
const phoneVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

export const SESSION_COOKIE = "lp_sid";
// 7-day TTL. All three res.cookie() calls below pass maxAge: SESSION_TTL_MS so
// the cookie persists across browser restarts (not just for the browser session).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory cache for domain-context lookups — avoids 2 DB queries per page load.
// TTL is 5 minutes; bounded to MAX_ENTRIES so it never grows unbounded in
// multi-tenant setups where thousands of unique hostnames could appear.
const DOMAIN_CTX_TTL_MS = 5 * 60 * 1000;
const DOMAIN_CTX_MAX_ENTRIES = 500;
interface DomainCtxEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}
const domainCtxCache = new Map<string, DomainCtxEntry>();

function domainCtxSet(domain: string, entry: DomainCtxEntry) {
  // Evict all expired entries first; if still at max, evict the oldest insertion.
  const now = Date.now();
  for (const [key, val] of domainCtxCache) {
    if (val.expiresAt <= now) domainCtxCache.delete(key);
  }
  if (domainCtxCache.size >= DOMAIN_CTX_MAX_ENTRIES) {
    const oldest = domainCtxCache.keys().next().value;
    if (oldest !== undefined) domainCtxCache.delete(oldest);
  }
  domainCtxCache.set(domain, entry);
}

/**
 * Drop every cached domain-context entry that resolved to the given tenant.
 * Called by /api/admin/tenant-settings after a PATCH so a change to
 * `rootRedirectUrl` / `vanityLinks` is reflected on the next microsite load
 * instead of waiting up to 5 minutes for the entry to expire.
 */
export function invalidateDomainContextForTenant(tenantId: number): void {
  for (const [key, val] of domainCtxCache) {
    const t = (val.data as { tenantId?: number | null }).tenantId;
    if (t === tenantId) domainCtxCache.delete(key);
  }
}

function getRedirectUri(requestHost?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  if (requestHost) {
    const isLocal = requestHost.startsWith("localhost") || requestHost.startsWith("127.");
    const protocol = isLocal ? "http" : "https";
    const host = requestHost.split(":")[0]; // strip port for non-local
    const port = isLocal ? `:${requestHost.split(":")[1] ?? process.env.PORT ?? 8080}` : "";
    return `${protocol}://${host}${port}/api/auth/google/callback`;
  }
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/api/auth/google/callback`;
  return `http://localhost:${process.env.PORT ?? 8080}/api/auth/google/callback`;
}

function getOAuthClient(redirectUri?: string): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new OAuth2Client(clientId, clientSecret, redirectUri ?? getRedirectUri());
}

/**
 * Build the absolute base URL (`https://host` or `http://localhost:port`) for
 * the host a request arrived on. Used to construct the email links (magic
 * link, verify, reset) so they always point back at the exact host the user
 * started from — which is also the host that token redemption is bound to.
 */
function buildHostBaseUrl(req: Request): string {
  const host = getRequestHost(req) || process.env.REPLIT_DEV_DOMAIN || `localhost:${process.env.PORT ?? 8080}`;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const proto = isLocal ? "http" : "https";
  return `${proto}://${host}`;
}

interface SessionUserRow {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  tenant_id: number | null;
}

/**
 * Resolve tenant membership for a freshly-authenticated user, create a
 * server-side session row, and set the session cookie on `res`. Shared by the
 * Google OAuth callback and the email/password + magic-link login flows so the
 * membership-resolution and session-creation logic never drifts between them.
 *
 * Membership resolution mirrors the two-mode behaviour of the original Google
 * callback:
 *   - tenant-locked host → membership in THAT tenant only (pending invites are
 *     auto-accepted; an email-only pre-invite is linked to the user id).
 *   - open host          → membership in any non-domain-locked tenant.
 * When no membership is found `tenantId` stays null (AuthGate then shows
 * "Access Pending" or "Create workspace").
 *
 * Does NOT perform cross-domain handoff — the Google callback layers that on
 * top using the returned `sid`. The JSON/redirect email flows always run on the
 * destination host already, so the cookie set here is the final one.
 */
async function establishSession(
  res: Response,
  user: SessionUserRow,
  domainMode: "open" | "tenant-locked",
  domainTenantId: number | null,
): Promise<{ sid: string; tenantId: number | null }> {
  const email = user.email;
  let tenantId: number | null = null;
  let role = "viewer";
  let permissions: Record<string, boolean> = {};
  let isAdmin = false;

  if (domainMode === "tenant-locked" && domainTenantId) {
    const memberResult = await pool.query(
      `SELECT tm.id as member_id, tm.tenant_id, tm.user_id, tm.role_id,
              tr.name as role_name, tr.permissions, tr.is_admin, tm.accepted_at
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       WHERE tm.tenant_id = $1
         AND (tm.user_id = $2 OR (tm.user_id IS NULL AND LOWER(tm.email) = LOWER($3)))
       ORDER BY tm.user_id NULLS LAST
       LIMIT 1`,
      [domainTenantId, user.id, email]
    );

    if (memberResult.rows.length > 0) {
      const needsUserId = memberResult.rows[0].user_id === null;
      const needsAccept = memberResult.rows[0].accepted_at === null;
      if (needsUserId || needsAccept) {
        await pool.query(
          `UPDATE tenant_members SET
             user_id = COALESCE(user_id, $1),
             accepted_at = COALESCE(accepted_at, now())
           WHERE id = $2`,
          [user.id, memberResult.rows[0].member_id]
        );
      }
      const member = memberResult.rows[0];
      tenantId = member.tenant_id;
      role = member.role_name;
      permissions = (member.permissions as Record<string, boolean>) ?? {};
      isAdmin = member.is_admin ?? false;
      if (!user.tenant_id) {
        await pool.query(`UPDATE app_users SET tenant_id = $1 WHERE id = $2`, [tenantId, user.id]);
      }
    }
  } else {
    const memberResult = await pool.query(
      `SELECT tm.id as member_id, tm.tenant_id, tm.user_id, tm.role_id,
              tr.name as role_name, tr.permissions, tr.is_admin, tm.accepted_at
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       JOIN tenants t ON t.id = tm.tenant_id
       WHERE (tm.user_id = $1 OR (tm.user_id IS NULL AND LOWER(tm.email) = LOWER($2)))
         AND (t.domain IS NULL OR t.domain = '')
       ORDER BY tm.user_id NULLS LAST
       LIMIT 1`,
      [user.id, email]
    );

    if (memberResult.rows.length > 0) {
      const needsUserId = memberResult.rows[0].user_id === null;
      const needsAccept = memberResult.rows[0].accepted_at === null;
      if (needsUserId || needsAccept) {
        await pool.query(
          `UPDATE tenant_members SET
             user_id = COALESCE(user_id, $1),
             accepted_at = COALESCE(accepted_at, now())
           WHERE id = $2`,
          [user.id, memberResult.rows[0].member_id]
        );
      }
      const member = memberResult.rows[0];
      tenantId = member.tenant_id;
      role = member.role_name;
      permissions = (member.permissions as Record<string, boolean>) ?? {};
      isAdmin = member.is_admin ?? false;
    }
  }

  // Look up tenant's microsite domain so it's always available in the session.
  let micrositeDomain: string | null = null;
  if (tenantId) {
    const tdResult = await pool.query(
      `SELECT microsite_domain FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (tdResult.rows.length > 0) micrositeDomain = tdResult.rows[0].microsite_domain ?? null;
  }

  // Clean up any stale "no-tenant" sessions for this user before creating a new
  // one — prevents users from getting stuck on "Access Pending" after being
  // added to a workspace.
  await pool.query(
    `DELETE FROM app_sessions
     WHERE (sess::jsonb->>'userId')::int = $1
       AND (sess::jsonb->>'tenantId') IS NULL`,
    [user.id]
  );

  const sid = crypto.randomUUID();
  const sess = JSON.stringify({
    userId: user.id,
    email: user.email,
    name: user.name ?? "",
    avatarUrl: user.avatar_url ?? null,
    tenantId,
    role,
    permissions,
    isAdmin,
    micrositeDomain,
    // Root superadmin is email-identified (case-insensitive), so stamp the
    // operator role at session-creation time too — independent of the
    // app_users.role on the (possibly case-mismatched) row this login resolved.
    appUserRole: isRootSuperadminEmail(user.email) ? "superadmin" : (user.role ?? null),
  });
  const expire = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
    [sid, sess, expire]
  );

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });

  return { sid, tenantId };
}

// GET /api/auth/google — initiates Google OAuth flow
router.get("/auth/google", oauthInitLimiter, async (req, res): Promise<void> => {
  // Determine the host the request came from (custom domain, wildcard tenant
  // subdomain via Cloudflare Worker, or dev domain).
  const originHost = getRequestHost(req);
  const redirectUri = getRedirectUri(originHost);
  const client = getOAuthClient(redirectUri);
  if (!client) {
    res.status(503).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    return;
  }
  // Optional `?next=` — a relative path (path + query string) the caller
  // wants us to land on after the OAuth round-trip completes. Used by the
  // marketing-homepage handoff so a logged-out visitor who clicks "Generate
  // page" lands back on `/pages?new=ai&prompt=…` rather than the workspace
  // root. Anything that isn't a same-origin relative path is dropped.
  const nextPath = sanitizeNextPath((req.query as { next?: unknown }).next);
  // Mint a cryptographically-strong, server-stored, single-use state nonce and
  // stash the origin host + redirect URI + next path against it. The callback
  // redeems the nonce BEFORE token exchange, defeating login CSRF (an attacker
  // can't forge or replay a nonce we never minted). Only the opaque nonce ever
  // travels to the provider, so the flow context can't be tampered with either.
  let state: string;
  try {
    state = await mintOAuthState("google", { host: originHost, redirectUri, next: nextPath });
  } catch (err) {
    console.error("[auth] failed to mint Google OAuth state:", err);
    res.status(503).json({ error: "Login temporarily unavailable. Please try again." });
    return;
  }
  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });
  res.redirect(url);
});

// GET /api/auth/google/callback — handles OAuth callback from Google
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, error: oauthError, state: stateParam } = req.query as { code?: string; error?: string; state?: string };
  if (oauthError || !code) {
    res.redirect(`/?error=${encodeURIComponent(oauthError ?? "oauth_failed")}`);
    return;
  }

  // Verify the `state` against the server-stored single-use nonce BEFORE any
  // token exchange or session creation. This binds the callback to a flow WE
  // initiated, defeating login CSRF — an attacker can't forge a nonce we never
  // minted, and a captured nonce can't be replayed (redemption is atomic and
  // single-use). A missing / forged / replayed / expired nonce fails closed.
  const stateData = await redeemOAuthState(stateParam, "google");
  if (!stateData) {
    res.redirect("/?error=invalid_state");
    return;
  }
  const originHost = stateData.host;
  const stateRedirectUri = stateData.redirectUri;
  const nextPath: string | null = sanitizeNextPath(stateData.next);

  // Use the same redirect URI that was used when initiating the flow
  const callbackClient = getOAuthClient(stateRedirectUri || getRedirectUri(originHost));
  if (!callbackClient) {
    res.redirect("/?error=oauth_not_configured");
    return;
  }

  // Resolve domain context for the origin host (uses shared resolver so it
  // honours custom domains, microsite domains, AND wildcard subdomains).
  let domainMode: "open" | "tenant-locked" = "open";
  let domainTenantId: number | null = null;
  if (originHost) {
    const match = await findTenantByHost(originHost);
    if (match && match.mode === "tenant-locked") {
      domainMode = "tenant-locked";
      domainTenantId = match.tenantId;
    }
  }

  try {
    const { tokens } = await callbackClient.getToken(code);
    callbackClient.setCredentials(tokens);

    const ticket = await callbackClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    const payload = ticket.getPayload()!;
    const { sub: googleId, email, name = "", picture: avatarUrl } = payload;

    if (!email) {
      res.redirect("/?error=no_email");
      return;
    }

    // Upsert user
    const upsertResult = await pool.query(
      `INSERT INTO app_users (google_id, email, name, avatar_url, status, last_login_at)
       VALUES ($1, $2, $3, $4, 'active', now())
       ON CONFLICT (email) DO UPDATE SET
         google_id = COALESCE(EXCLUDED.google_id, app_users.google_id),
         name = COALESCE(NULLIF(EXCLUDED.name, ''), app_users.name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
         status = 'active',
         last_login_at = now(),
         updated_at = now()
       RETURNING id, email, name, avatar_url, role, tenant_id`,
      [googleId, email, name, avatarUrl ?? null]
    );
    const user = upsertResult.rows[0];

    // Resolve membership + create the session (shared with the email/password
    // and magic-link flows so the logic never drifts).
    const { sid } = await establishSession(res, user, domainMode, domainTenantId);

    // If the user came from a different domain (e.g. meetdandy-lp.com) but our
    // canonical callback lives on app.lpstudio.ai, we need to hand the session
    // across domains via the /api/auth/accept endpoint using a short-lived exchange code.
    const callbackHost = (() => {
      try {
        const uri = process.env.GOOGLE_REDIRECT_URI;
        if (uri) return new URL(uri).hostname;
      } catch { /* ignore */ }
      return "";
    })();
    const originHostname = originHost.split(":")[0].toLowerCase();
    if (callbackHost && originHostname && originHostname !== callbackHost) {
      // Cross-domain: generate a short-lived exchange code (valid for 5 minutes, single-use).
      // The code is bound to `originHostname` (the tenant host that initiated
      // the OAuth flow); /auth/accept will refuse to redeem it on any other
      // host. This stops a stolen/phished code from being used to mint a
      // session cookie on an attacker-controlled domain that also points at
      // this API.
      const exchangeCode = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute expiry
      await pool.query(
        `INSERT INTO auth_exchange_codes (code, sid, expires_at, target_host) VALUES ($1, $2, $3, $4)`,
        [exchangeCode, sid, expiresAt, originHostname]
      );
      const proto = "https";
      const nextSuffix = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
      res.redirect(`${proto}://${originHostname}/api/auth/accept?code=${encodeURIComponent(exchangeCode)}${nextSuffix}`);
    } else {
      // Same-domain: land the user on their intended destination (e.g. the
      // marketing-homepage handoff target `/pages?new=ai&prompt=…`). When
      // `nextPath` is absent or fails validation, fall back to root.
      res.redirect(nextPath ?? "/");
    }
  } catch (err) {
    console.error("[auth] OAuth callback error:", err);
    res.redirect("/?error=auth_failed");
  }
});

// ── GitHub OAuth ────────────────────────────────────────────────────────────
// GitHub has no id_token (unlike Google): we exchange the authorization code for
// an access token, then read the account + verified emails from the GitHub REST
// API. The numeric GitHub user id (stored as text) is the stable identity — the
// `sub` equivalent — persisted in app_users.github_id. GitHub OAuth apps allow
// only ONE callback host, so a tenant domain that initiated the flow gets the
// session minted on its own host via the same cross-domain exchange-code handoff
// the Google flow uses.

function getGithubRedirectUri(requestHost?: string): string {
  if (process.env.GITHUB_OAUTH_REDIRECT_URI) return process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (requestHost) {
    const isLocal = requestHost.startsWith("localhost") || requestHost.startsWith("127.");
    const protocol = isLocal ? "http" : "https";
    const host = requestHost.split(":")[0]; // strip port for non-local
    const port = isLocal ? `:${requestHost.split(":")[1] ?? process.env.PORT ?? 8080}` : "";
    return `${protocol}://${host}${port}/api/auth/github/callback`;
  }
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/api/auth/github/callback`;
  return `http://localhost:${process.env.PORT ?? 8080}/api/auth/github/callback`;
}

function getGithubOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

// GET /api/auth/github/config — lets the frontend render the "Continue with
// GitHub" button only when the provider is configured (mirrors the Turnstile
// config probe). Public + unauthenticated; reveals only a boolean.
router.get("/auth/github/config", (_req, res): void => {
  res.json({ enabled: !!getGithubOAuthConfig() });
});

// GET /api/auth/github — initiates the GitHub OAuth flow.
router.get("/auth/github", oauthInitLimiter, async (req, res): Promise<void> => {
  const cfg = getGithubOAuthConfig();
  if (!cfg) {
    res.status(503).json({ error: "GitHub OAuth not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET." });
    return;
  }
  const originHost = getRequestHost(req);
  const redirectUri = getGithubRedirectUri(originHost);
  // Optional `?next=` — a same-origin relative path to resume after the OAuth
  // round-trip (mirrors the Google flow). Anything else is dropped.
  const nextPath = sanitizeNextPath((req.query as { next?: unknown }).next);
  // Mint a server-stored single-use state nonce (same login-CSRF defense as the
  // Google flow). Only the opaque nonce travels to GitHub; the callback redeems
  // it before token exchange and reads the flow context from our DB.
  let state: string;
  try {
    state = await mintOAuthState("github", { host: originHost, redirectUri, next: nextPath });
  } catch (err) {
    console.error("[auth] failed to mint GitHub OAuth state:", err);
    res.status(503).json({ error: "Login temporarily unavailable. Please try again." });
    return;
  }
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", cfg.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "read:user user:email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("allow_signup", "true");
  res.redirect(authUrl.toString());
});

// GET /api/auth/github/callback — handles the OAuth callback from GitHub.
router.get("/auth/github/callback", async (req, res): Promise<void> => {
  const { code, error: oauthError, state: stateParam } = req.query as { code?: string; error?: string; state?: string };
  if (oauthError || !code) {
    res.redirect(`/?error=${encodeURIComponent(oauthError ?? "oauth_failed")}`);
    return;
  }

  // Verify the `state` against the server-stored single-use nonce BEFORE any
  // token exchange or session creation (same login-CSRF defense as the Google
  // callback). A missing / forged / replayed / expired nonce fails closed.
  const stateData = await redeemOAuthState(stateParam, "github");
  if (!stateData) {
    res.redirect("/?error=invalid_state");
    return;
  }
  const originHost = stateData.host;
  const stateRedirectUri = stateData.redirectUri;
  const nextPath: string | null = sanitizeNextPath(stateData.next);

  const cfg = getGithubOAuthConfig();
  if (!cfg) {
    res.redirect("/?error=oauth_not_configured");
    return;
  }
  // Use the exact redirect URI that was used when initiating the flow.
  const redirectUri = stateRedirectUri || getGithubRedirectUri(originHost);

  // Resolve domain context for the origin host (custom domain, microsite
  // domain, or wildcard tenant subdomain) — same resolver the Google flow uses.
  let domainMode: "open" | "tenant-locked" = "open";
  let domainTenantId: number | null = null;
  if (originHost) {
    const match = await findTenantByHost(originHost);
    if (match && match.mode === "tenant-locked") {
      domainMode = "tenant-locked";
      domainTenantId = match.tenantId;
    }
  }

  try {
    // 1. Exchange the authorization code for an access token.
    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenResp.json().catch(() => ({}))) as { access_token?: string; error?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      res.redirect("/?error=auth_failed");
      return;
    }

    // 2. Read the GitHub account. GitHub requires a User-Agent header.
    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "LP-Studio",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const userResp = await fetch("https://api.github.com/user", { headers: ghHeaders });
    if (!userResp.ok) {
      res.redirect("/?error=auth_failed");
      return;
    }
    const ghUser = (await userResp.json()) as {
      id?: number;
      login?: string;
      name?: string | null;
      avatar_url?: string | null;
      email?: string | null;
    };
    if (!ghUser.id) {
      res.redirect("/?error=auth_failed");
      return;
    }
    const githubId = String(ghUser.id);

    // 3. Resolve a verified primary email. GitHub omits the email from /user
    //    when the user keeps it private, so always read /user/emails and pick
    //    the primary verified address (falling back to any verified one). We
    //    only ever accept a VERIFIED email so a GitHub login can't be used to
    //    hijack an unverified account by claiming someone else's address.
    let email: string | null = null;
    const emailsResp = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
    if (emailsResp.ok) {
      const emails = (await emailsResp.json().catch(() => [])) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified);
      const anyVerified = emails.find((e) => e.verified);
      email = (primary ?? anyVerified)?.email ?? null;
    }
    if (!email) {
      res.redirect("/?error=no_email");
      return;
    }

    const name = ghUser.name || ghUser.login || "";
    const avatarUrl = ghUser.avatar_url ?? null;

    // 4. Upsert the user, linking a GitHub login to an existing account that
    //    shares the same verified email (mirrors the Google upsert).
    const upsertResult = await pool.query(
      `INSERT INTO app_users (github_id, email, name, avatar_url, status, last_login_at)
       VALUES ($1, $2, $3, $4, 'active', now())
       ON CONFLICT (email) DO UPDATE SET
         github_id = COALESCE(EXCLUDED.github_id, app_users.github_id),
         name = COALESCE(NULLIF(EXCLUDED.name, ''), app_users.name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url),
         status = 'active',
         last_login_at = now(),
         updated_at = now()
       RETURNING id, email, name, avatar_url, role, tenant_id`,
      [githubId, email, name, avatarUrl]
    );
    const user = upsertResult.rows[0];

    // Resolve membership + create the session (shared with the Google,
    // email/password, and magic-link flows so the logic never drifts).
    const { sid } = await establishSession(res, user, domainMode, domainTenantId);

    // Cross-domain handoff: if the flow started on a tenant host that differs
    // from our single registered GitHub callback host, mint the session on the
    // origin host via a short-lived, host-bound exchange code (same mechanism
    // and security properties as the Google callback).
    const callbackHost = (() => {
      try {
        const uri = process.env.GITHUB_OAUTH_REDIRECT_URI;
        if (uri) return new URL(uri).hostname;
      } catch { /* ignore */ }
      return "";
    })();
    const originHostname = originHost.split(":")[0].toLowerCase();
    if (callbackHost && originHostname && originHostname !== callbackHost) {
      const exchangeCode = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute expiry
      await pool.query(
        `INSERT INTO auth_exchange_codes (code, sid, expires_at, target_host) VALUES ($1, $2, $3, $4)`,
        [exchangeCode, sid, expiresAt, originHostname]
      );
      const nextSuffix = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
      res.redirect(`https://${originHostname}/api/auth/accept?code=${encodeURIComponent(exchangeCode)}${nextSuffix}`);
    } else {
      res.redirect(nextPath ?? "/");
    }
  } catch (err) {
    console.error("[auth] GitHub OAuth callback error:", err);
    res.redirect("/?error=auth_failed");
  }
});

// GET /api/auth/accept — cross-domain session handoff via short-lived exchange code
// Called when the OAuth callback domain differs from the origin domain (e.g. Dandy on meetdandy-lp.com).
// Uses a short-lived exchange code instead of passing the session token in the URL.
// This prevents session tokens from appearing in browser history, logs, or referrer headers.
router.get("/auth/accept", async (req, res): Promise<void> => {
  const { code, next } = req.query as { code?: string; next?: string };
  if (!code) {
    res.redirect("/?error=missing_code");
    return;
  }
  // Resume the original post-login destination on this (tenant) host.
  // sanitizeNextPath rejects anything that isn't a same-origin relative path,
  // so an attacker cannot use `?next=` to bounce users to an external URL.
  const nextPath = sanitizeNextPath(next);
  try {
    // Look up the exchange code and retrieve the associated session
    // Exchange codes are single-use and expire after 5 minutes
    const codeResult = await pool.query(
      `SELECT sid, target_host FROM auth_exchange_codes WHERE code = $1 AND expires_at > now() LIMIT 1`,
      [code]
    );
    if (codeResult.rows.length === 0) {
      res.redirect("/?error=invalid_code");
      return;
    }

    // Enforce host binding. A code minted for tenant host A must not be
    // redeemable on host B — otherwise a phished code could be used to set
    // a session cookie on an attacker's domain that also points at this
    // API. `target_host` is nullable for in-flight codes minted before the
    // 0031 migration; those still redeem (5 min grace) but new codes are
    // always bound.
    const targetHost = codeResult.rows[0].target_host as string | null;
    if (targetHost) {
      const reqHost = (getRequestHost(req) ?? "").split(":")[0].toLowerCase();
      if (reqHost !== targetHost.toLowerCase()) {
        res.redirect("/?error=invalid_code");
        return;
      }
    }

    const sid = codeResult.rows[0].sid;

    // Verify the session exists and hasn't expired
    const sessionResult = await pool.query(
      `SELECT sid FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid]
    );
    if (sessionResult.rows.length === 0) {
      res.redirect("/?error=invalid_session");
      return;
    }

    // Delete the used exchange code (single-use)
    await pool.query(`DELETE FROM auth_exchange_codes WHERE code = $1`, [code]);

    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS,
      path: "/",
    });
    res.redirect(nextPath ?? "/");
  } catch (err) {
    console.error("[auth] accept session error:", err);
    res.redirect("/?error=auth_failed");
  }
});

// GET /api/auth/me — returns current session user
router.get("/auth/me", async (req, res): Promise<void> => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid]
    );
    if (!result.rows.length) {
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const sess = JSON.parse(result.rows[0].sess);

    // Include onboardingCompleted flag + tenant industry from tenants table
    let onboardingCompleted = true; // default true so existing sessions are never blocked
    // Default to "generic" when settings.industry is missing — only an
    // explicit "dental" value should resolve to the dental experience.
    // Tenants #1 and #5 are the historical Dandy dental tenants and are
    // backfilled to "dental" on first server boot; everyone else stays
    // generic.
    let tenantIndustry: string = "generic";
    // Task #113: tenant-wide page-review-workflow toggle. Default TRUE so
    // any tenant the boot backfill hasn't yet touched preserves the #108
    // behaviour (Submit-for-Review / Approve / Reject UI visible).
    let requireReviewBeforePublish = true;
    // Task #219 follow-up — tenant-level AI image generation toggle. Top-tier
    // plans only; defaults OFF so we never silently spend image-API credits.
    // The frontend uses these to hide the per-page "Generate AI images"
    // toggle and per-image regenerate buttons unless the workspace has both
    // the eligible plan AND turned the feature on.
    let aiImageGenEnabled = false;
    let aiImageGenAvailable = false;
    // Task #234 — second, independent flag that gates the "Generate / Tweak"
    // controls on every shared ImagePicker and the corresponding
    // `POST /lp/image/generate` endpoint. Defaults OFF; superadmin-only toggle.
    let aiImageGenOutsideBuilderEnabled = false;
    let tenantPlan: string | null = null;
    // Task #132 — surface the canonical tenant login URL (custom domain or
    // wildcard subdomain) so the onboarding wizard, AuthGate auto-redirect,
    // and Settings → General can hand users off to / display their
    // personal workspace URL without hardcoding the wildcard base host.
    let tenantSlug: string | null = null;
    let tenantDomain: string | null = null;
    let tenantHost: string | null = null;
    let tenantLoginUrl: string | null = null;
    // DB-driven trial window (NOT Stripe's `trialing`). `effectiveTier` is the
    // plan the UI must reflect — it rises to the trial tier while the window is
    // open so trialing users actually see/keep the Growth feature set, then
    // falls back to the stored floor on expiry. Defaults assume no tenant.
    let effectiveTier: Plan = "free";
    let trialState = computeTrialState({ trialStartedAt: null, trialExpiresAt: null });
    if (sess.tenantId) {
      const tenantResult = await pool.query(
        `SELECT onboarding_completed_at, settings, slug, domain, plan,
                trial_started_at, trial_expires_at, has_trialed_before
           FROM tenants WHERE id = $1`,
        [sess.tenantId]
      );
      if (tenantResult.rows.length > 0) {
        const row = tenantResult.rows[0];
        onboardingCompleted = row.onboarding_completed_at !== null;
        const settings = row.settings ?? {};
        const ind = settings.industry;
        if (ind === "dental" || ind === "generic") tenantIndustry = ind;
        if (settings.requireReviewBeforePublish === false) requireReviewBeforePublish = false;
        tenantSlug = row.slug ?? null;
        tenantDomain = row.domain ?? null;
        tenantHost = getCanonicalTenantHost({ slug: tenantSlug, domain: tenantDomain });
        tenantLoginUrl = tenantHost ? `https://${tenantHost}` : null;
        tenantPlan = row.plan ?? null;
        // Resolve the effective tier the same way getTenantPlan() does so the
        // UI and the API agree: Dandy is always enterprise; otherwise a live
        // trial window lifts the stored floor to the trial tier.
        trialState = computeTrialState({
          trialStartedAt: row.trial_started_at,
          trialExpiresAt: row.trial_expires_at,
        });
        effectiveTier = isProtectedEnterpriseSlug(tenantSlug)
          ? "enterprise"
          : effectivePlan({
              storedPlan: normalizePlan(tenantPlan),
              trialExpiresAt: row.trial_expires_at,
            });
        aiImageGenAvailable = (await getPlanFeaturesMap())[effectiveTier].aiImageGen;
        aiImageGenEnabled = aiImageGenAvailable && settings.aiImageGenEnabled === true;
        aiImageGenOutsideBuilderEnabled = settings.aiImageGenOutsideBuilderEnabled === true;
      }
    }

    // Task #132 — auto-redirect open-domain logins to the user's tenant
    // subdomain. Only flag a redirect when:
    //   • the request actually came in on one of the wildcard base hosts
    //     (e.g. lpstudio.ai / app.lpstudio.ai) — never on dev/replit hosts;
    //   • we have a canonical tenant host;
    //   • the canonical host differs from the host we were called on.
    // The frontend uses the existing /api/auth/handoff-code → /api/auth/accept
    // exchange to complete the cross-domain handoff.
    const requestHost = getRequestHost(req);
    const onOpenBaseHost = !!requestHost && isWildcardBaseHost(requestHost);

    // Multi-workspace guard: count the user's accepted memberships across
    // all tenants. If they belong to more than one workspace we must NOT
    // auto-redirect — they may want a workspace picker. We allow the
    // redirect only when the user is unambiguously bound to a single
    // workspace. Pending invites (accepted_at IS NULL) don't count.
    let workspaceCount = 0;
    if (sess.userId) {
      const wc = await pool.query(
        `SELECT COUNT(DISTINCT tm.tenant_id)::int AS n
           FROM tenant_members tm
          WHERE tm.user_id = $1 AND tm.accepted_at IS NOT NULL`,
        [sess.userId]
      );
      workspaceCount = wc.rows[0]?.n ?? 0;
    }

    const shouldRedirectToTenantHost = !!(
      onOpenBaseHost &&
      onboardingCompleted &&
      tenantHost &&
      tenantHost !== requestHost &&
      workspaceCount <= 1
    );

    // Pull app_users.role (NOT the tenant role!) so the frontend can detect
    // platform super-admins (role='superadmin'). Tenant role lives in sess.role
    // and is unaffected. Done in /me so existing sessions get the value
    // without forcing every user to re-login.
    let appUserRole: string | null = null;
    if (sess.userId) {
      const ur = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [sess.userId]);
      if (ur.rows.length > 0) appUserRole = ur.rows[0].role ?? null;
    }
    // A configured root superadmin is identified purely by email
    // (case-insensitive), so it ALWAYS resolves to the superadmin role here —
    // even if the app_users row this session logged into never received the
    // seeded 'superadmin' role (e.g. an OAuth email-casing mismatch created a
    // separate row). This mirrors the override in requireSuperadmin so the
    // frontend SuperAdmin guard and the API agree on who is a superadmin.
    if (isRootSuperadminEmail(sess.email)) {
      appUserRole = "superadmin";
    }
    // Task #641 — flag the bootstrap root superadmin so the SuperAdmin UI can
    // reveal the root-only "Superadmins" roster management section. Identity is
    // email-based (ROOT_SUPERADMIN_EMAIL, default admin@lpstudio.ai); only a
    // superadmin whose email matches is root.
    const isRootSuperadmin = appUserRole === "superadmin" && isRootSuperadminEmail(sess.email);

    // Canonical plan + feature matrix. The raw `tenantPlan` string above
    // is the legacy DB column value ("trial" / "business" / etc.) and is
    // still surfaced for existing AI-image-gen and other checks that
    // read it directly. `planTier` is the new canonical tier
    // ("starter" / "growth" / "enterprise") and `planFeatures` is the
    // server-computed feature map the UI uses to hide the Sales toggle
    // and short-circuit /sales/* routes before the request fires.
    const planTier = effectiveTier;
    const planFeatures = (await getPlanFeaturesMap())[planTier];

    res.json({
      ...sess,
      onboardingCompleted,
      tenantIndustry,
      appUserRole,
      isRootSuperadmin,
      requireReviewBeforePublish,
      tenantSlug,
      tenantDomain,
      tenantHost,
      tenantLoginUrl,
      shouldRedirectToTenantHost,
      tenantPlan,
      planTier,
      planFeatures,
      trial: {
        active: trialState.active,
        expired: trialState.expired,
        daysRemaining: trialState.daysRemaining,
        expiresAt: trialState.expiresAt ? trialState.expiresAt.toISOString() : null,
      },
      aiImageGenAvailable,
      aiImageGenEnabled,
      aiImageGenOutsideBuilderEnabled,
    });
  } catch (err) {
    console.error("[auth] /me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/complete-onboarding — marks the tenant's onboarding as complete
router.post("/auth/complete-onboarding", async (req, res): Promise<void> => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const sessionResult = await pool.query(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid]
    );
    if (!sessionResult.rows.length) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const sess = JSON.parse(sessionResult.rows[0].sess);
    if (!sess.tenantId) {
      res.status(400).json({ error: "No tenant associated with this session" });
      return;
    }
    await pool.query(
      `UPDATE tenants SET onboarding_completed_at = now() WHERE id = $1`,
      [sess.tenantId]
    );

    // Task #134 — fire a one-off welcome email containing the canonical
    // workspace URL. Gated on:
    //   • Open-domain request (the onboarding wizard only runs there)
    //   • welcome_email_sent_at IS NULL (atomic claim via UPDATE…RETURNING
    //     so concurrent calls send at most one email per tenant)
    //   • A resolvable canonical host and recipient email
    const requestHost = getRequestHost(req);
    if (requestHost && isWildcardBaseHost(requestHost) && sess.email) {
      const claim = await pool.query(
        `UPDATE tenants
            SET welcome_email_sent_at = now()
          WHERE id = $1 AND welcome_email_sent_at IS NULL
          RETURNING name, slug, domain, microsite_domain`,
        [sess.tenantId]
      );
      if (claim.rows.length > 0) {
        const t = claim.rows[0];
        const host = getCanonicalTenantHost({ slug: t.slug ?? null, domain: t.domain ?? null });
        // The tenant's managed landing-page host. Auto-assigned at signup, so
        // microsite_domain is normally set; fall back to the deterministic
        // default if it somehow isn't, so the welcome email always shows a
        // real address rather than an empty token.
        const landingPageDomain =
          (t.microsite_domain ?? "").trim() ||
          (t.slug ? defaultPageSubdomain(t.slug) : "");
        // Drop a welcome item into the in-app inbox (best-effort, deduped by
        // user). Runs through the notification system so the new signup sees
        // something in their bell on first load.
        if (typeof sess.userId === "number") {
          void dispatchNotification({
            templateKey: "welcome",
            tenantId: sess.tenantId,
            recipients: [{ appUserId: sess.userId, email: sess.email ?? null, name: sess.name ?? null }],
            context: {
              tenantName: t.name ?? "your workspace",
              workspaceUrl: host ? `https://${host}` : null,
              landingPageDomain,
            },
            dedupeBase: `welcome:tenant:${sess.tenantId}`,
            channels: ["in_app"],
          }).catch((err) => console.error("[auth] welcome in-app dispatch failed:", err));
        }
        if (host) {
          const workspaceUrl = `https://${host}`;
          // Welcome EMAIL now runs through the dispatcher too, so operators can
          // edit the subject/intro/CTA from the SuperAdmin Notifications tab.
          // The dispatcher dedupes per (recipient, channel) and the tenant-level
          // welcome_email_sent_at claim above guarantees this fan-out runs at
          // most once per tenant — no double welcome email can be sent.
          // Fire-and-forget so the API response isn't blocked on Resend.
          // Routed through the workflow engine (Task #589): a one-step "welcome"
          // workflow (email channel) sends this, so operators can chain
          // follow-up emails. The `fallback` is the original direct dispatch —
          // run verbatim if the workflow is disabled/missing/unavailable, so the
          // welcome email is byte-identical either way. The in-app inbox drop
          // above stays a direct dispatch (the workflow is email-only).
          const welcomeRecipients = [{
            appUserId: typeof sess.userId === "number" ? sess.userId : null,
            email: sess.email,
            name: sess.name ?? null,
          }];
          const welcomeContext = {
            tenantName: t.name ?? "your workspace",
            workspaceUrl,
            landingPageDomain,
          };
          void enqueueWorkflowTrigger({
            eventKey: "welcome",
            tenantId: sess.tenantId,
            recipients: welcomeRecipients,
            context: welcomeContext,
            dedupeBase: `welcome:tenant:${sess.tenantId}`,
            fallback: () =>
              dispatchNotification({
                templateKey: "welcome",
                tenantId: sess.tenantId,
                recipients: welcomeRecipients,
                context: welcomeContext,
                dedupeBase: `welcome:tenant:${sess.tenantId}`,
                channels: ["email"],
              }),
          }).catch((err) => console.error("[auth] welcome email dispatch failed:", err));
        } else {
          // Couldn't build a canonical URL — release the gate so a future
          // call (after the tenant gets a slug/domain) can still send it.
          await pool.query(
            `UPDATE tenants SET welcome_email_sent_at = NULL WHERE id = $1`,
            [sess.tenantId]
          );
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[auth] /complete-onboarding error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/handoff-code — task #132
// Exchanges the caller's current session for a single-use, short-lived code
// that can be redeemed via /api/auth/accept on the tenant's canonical host.
// Used by the onboarding wizard's "Open my workspace" button and the
// AuthGate auto-redirect, both of which need to land the user on the
// tenant subdomain already authenticated.
router.post("/auth/handoff-code", async (req, res): Promise<void> => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  // Optional `next` (body) — relative destination path to resume on the
  // tenant host after /auth/accept exchanges the code. Used by the
  // AuthGate tenant-redirect bridge so a logged-out visitor coming from
  // the marketing homepage lands on `/pages?new=ai&prompt=…` instead of
  // the workspace root after signing in.
  const nextPath = sanitizeNextPath((req.body as { next?: unknown })?.next);
  try {
    const sessionResult = await pool.query(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid]
    );
    if (!sessionResult.rows.length) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const sess = JSON.parse(sessionResult.rows[0].sess);
    if (!sess.tenantId) {
      res.status(400).json({ error: "No tenant associated with this session" });
      return;
    }
    const tenantResult = await pool.query(
      `SELECT slug, domain FROM tenants WHERE id = $1`,
      [sess.tenantId]
    );
    if (!tenantResult.rows.length) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    const host = getCanonicalTenantHost({
      slug: tenantResult.rows[0].slug ?? null,
      domain: tenantResult.rows[0].domain ?? null,
    });
    if (!host) {
      res.status(400).json({ error: "Tenant has no canonical host" });
      return;
    }
    const code = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute single-use
    // target_host binds the code to the canonical tenant host we're handing
    // off to. /auth/accept refuses to redeem on any other host. Without this
    // binding, a phished or intercepted code could be redeemed on an
    // attacker-controlled host that also resolves to this API, minting a
    // session cookie under a hostile origin. The host_normalize() call in
    // /auth/accept strips port + lowercases, so we store the bare hostname.
    const targetHost = host.split(":")[0].toLowerCase();
    await pool.query(
      `INSERT INTO auth_exchange_codes (code, sid, expires_at, target_host) VALUES ($1, $2, $3, $4)`,
      [code, sid, expiresAt, targetHost]
    );
    const nextSuffix = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
    res.json({ code, host, url: `https://${host}/api/auth/accept?code=${encodeURIComponent(code)}${nextSuffix}` });
  } catch (err) {
    console.error("[auth] /handoff-code error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) {
    try {
      await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]);
    } catch { /* ignore */ }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }
  res.json({ ok: true });
});

// POST /api/auth/password — email + admin-password fallback login
router.post("/auth/password", passwordAuthLimiter, async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(503).json({ error: "Password auth not configured" });
    return;
  }
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email is required" });
    return;
  }
  if (typeof password !== "string") {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  // Use constant-time comparison to prevent timing attacks
  const { timingSafeEqual } = crypto;
  const passwordBuf = Buffer.from(password.padEnd(64, '\0'));
  const adminPasswordBuf = Buffer.from(adminPassword.padEnd(64, '\0'));
  let passwordMatches = false;
  try {
    passwordMatches = timingSafeEqual(passwordBuf, adminPasswordBuf);
  } catch {
    // Buffers not equal length (shouldn't happen with padEnd, but be safe)
    passwordMatches = false;
  }

  if (!passwordMatches) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  try {
    // Only allow login for pre-existing superadmin accounts (matched
    // case-insensitively). This prevents arbitrary email → admin-session
    // creation via the shared password, which was the primary platform-takeover
    // path. A configured root superadmin (e.g. admin@lpstudio.ai) is always
    // allowed even if its row never received the seeded 'superadmin' role — the
    // email itself is the authority. The ORDER BY prefers an actual superadmin
    // row when a case-variant collision left more than one row for the email.
    const userResult = await pool.query(
      `SELECT id, email, name, avatar_url, role, tenant_id,
              last_login_at, updated_at
       FROM app_users
       WHERE LOWER(email) = LOWER($1)
       ORDER BY (role = 'superadmin') DESC NULLS LAST, id ASC
       LIMIT 1`,
      [email]
    );
    const candidate = userResult.rows[0];
    const isAllowed =
      !!candidate &&
      (candidate.role === "superadmin" || isRootSuperadminEmail(candidate.email));
    if (!isAllowed) {
      res.status(403).json({ error: "No superadmin account found for that email" });
      return;
    }
    const user = candidate;

    // Stamp last login
    await pool.query(
      `UPDATE app_users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
      [user.id]
    );

    // Look up existing membership
    const memberResult = await pool.query(
      `SELECT tm.tenant_id, tm.role_id, tr.name as role_name, tr.permissions, tr.is_admin
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       WHERE tm.user_id = $1
       LIMIT 1`,
      [user.id]
    );

    let tenantId: number | null;
    let role: string;
    let permissions: Record<string, boolean>;
    let isAdmin: boolean;

    if (memberResult.rows.length) {
      const m = memberResult.rows[0];
      tenantId = m.tenant_id;
      role = m.role_name;
      permissions = (m.permissions as Record<string, boolean>) ?? {};
      isAdmin = m.is_admin ?? false;
    } else {
      // Task #641 — a superadmin (e.g. the root platform-operator account
      // admin@lpstudio.ai) belongs to NO tenant. The role check above already
      // proved this account is a superadmin, so a missing tenant membership is
      // not an error: issue a tenant-less session. The SuperAdmin surface gates
      // on appUserRole='superadmin' (re-read server-side by requireSuperadmin),
      // not on a tenant binding, so an operator can manage the platform without
      // ever joining a tenant. They impersonate tenants via switch-tenant.
      tenantId = null;
      role = "superadmin";
      permissions = {};
      isAdmin = false;
    }

    // Look up tenant's microsite domain
    let micrositeDomain: string | null = null;
    if (tenantId) {
      const tdResult = await pool.query(
        `SELECT microsite_domain FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (tdResult.rows.length > 0) micrositeDomain = tdResult.rows[0].microsite_domain ?? null;
    }

    // Create session
    const sid = crypto.randomUUID();
    const sess = JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      avatarUrl: user.avatar_url ?? null,
      tenantId,
      role,
      permissions,
      isAdmin,
      micrositeDomain,
      // See login route — same rationale (task #108). Root superadmins are
      // email-identified, so stamp the superadmin role even if their row's
      // role column says otherwise.
      appUserRole: isRootSuperadminEmail(user.email) ? "superadmin" : (user.role ?? null),
    });
    const expire = new Date(Date.now() + SESSION_TTL_MS);

    await pool.query(
      `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, $3)`,
      [sid, sess, expire]
    );

    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS,
      path: "/",
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[auth] password login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/domain-context — identifies whether this domain is locked to a specific tenant
// Used by the frontend to decide between "invite-only" vs "create workspace" for unassigned users,
// and to detect microsite-only domains where only public LP pages should render.
router.get("/auth/domain-context", async (req, res): Promise<void> => {
  try {
    const queryHost = (req.query.host as string) || "";
    const domain = queryHost
      ? queryHost.split(":")[0].toLowerCase()
      : getRequestHost(req);

    if (!domain) {
      res.json({ mode: "open", tenantId: null, tenantName: null, tenantSlug: null, micrositeDomain: null });
      return;
    }

    // Prerender override (task #364): when the SPA is rendering a preview
    // page via puppeteer from a non-tenant host like `render.lpstudio.ai`,
    // the host has no tenant binding. The page URL carries a `reviewToken`
    // that already gates access to the draft; we use it (plus the URL slug)
    // to resolve the tenant directly from the page record. This makes the
    // prerender host behave as a microsite-only domain for that one page.
    // The reviewToken already authorizes viewing the page, so this does not
    // widen access. We bypass the host cache when this override is used.
    const reviewToken = typeof req.query.reviewToken === "string" ? req.query.reviewToken : null;
    const pageSlug = typeof req.query.slug === "string" ? req.query.slug.toLowerCase() : null;
    if (reviewToken && pageSlug) {
      const rows = await db
        .select({
          tenantId: tenantsTable.id,
          tenantName: tenantsTable.name,
          tenantSlug: tenantsTable.slug,
          micrositeDomain: tenantsTable.micrositeDomain,
        })
        .from(lpPageReviewsTable)
        .innerJoin(lpPagesTable, eq(lpPageReviewsTable.pageId, lpPagesTable.id))
        .innerJoin(tenantsTable, eq(lpPagesTable.tenantId, tenantsTable.id))
        .where(and(eq(lpPageReviewsTable.token, reviewToken), eq(lpPagesTable.slug, pageSlug)))
        .limit(1);
      if (rows.length) {
        const t = rows[0];
        const data = {
          mode: "microsite-only" as const,
          tenantId: t.tenantId,
          tenantName: t.tenantName,
          tenantSlug: t.tenantSlug,
          micrositeDomain: t.micrositeDomain,
          redirectToHost: null,
        };
        // Don't cache — keyed by token+slug, not by host.
        res.set("Cache-Control", "no-store");
        res.json(data);
        return;
      }
      // Fall through to normal host resolution if token/slug didn't match.
    }

    // Serve from in-memory cache if still fresh
    const cached = domainCtxCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      res.json(cached.data);
      return;
    }

    // Resolve via shared host resolver (handles exact domain, microsite_domain,
    // and wildcard subdomains <slug>.lpstudio.ai / <slug>.app.lpstudio.ai).
    const match = await findTenantByHost(domain);
    // Task #133 — when the host matched only via a slug rename redirect,
    // surface the canonical host so the frontend can immediately bounce the
    // user (and any cookies / sessions) to the new URL.
    const canonicalHost = match ? getCanonicalTenantHost({ slug: match.tenantSlug, domain: null }) : null;
    const redirectToHost = match?.viaSlugRedirect && canonicalHost && canonicalHost !== domain
      ? canonicalHost
      : null;
    // Microsite root-redirect + vanity-link map are publicly-safe extras
    // stored in tenants.settings JSONB. Fetched here (one extra SELECT on
    // cache miss only) so the microsite shell can render PartnerHome and
    // resolve short vanity URLs without a second client roundtrip.
    let rootRedirectUrl: string | null = null;
    let vanityLinks: Array<{ slug: string; targetUrl: string }> = [];
    // Tenant's own marketing website (BrandConfig.websiteUrl). Used as the
    // default root-redirect target for the microsite root when the tenant
    // hasn't configured an explicit rootRedirectUrl — so non-Dandy tenants
    // bounce to their OWN site instead of Dandy's homepage. Dandy's seeded
    // websiteUrl is meetdandy.com, so Dandy tenants keep their old behaviour.
    let tenantWebsiteUrl: string | null = null;
    if (match) {
      try {
        const settingsRow = await db
          .select({ settings: tenantsTable.settings })
          .from(tenantsTable)
          .where(eq(tenantsTable.id, match.tenantId))
          .limit(1);
        const s = (settingsRow[0]?.settings ?? {}) as Record<string, unknown>;
        if (typeof s.rootRedirectUrl === "string" && s.rootRedirectUrl.trim()) {
          rootRedirectUrl = s.rootRedirectUrl.trim();
        }
        if (Array.isArray(s.vanityLinks)) {
          vanityLinks = (s.vanityLinks as unknown[])
            .filter((x): x is { slug: string; targetUrl: string } =>
              !!x && typeof x === "object"
              && typeof (x as { slug?: unknown }).slug === "string"
              && typeof (x as { targetUrl?: unknown }).targetUrl === "string"
            )
            .map(x => ({ slug: x.slug.toLowerCase(), targetUrl: x.targetUrl }));
        }
      } catch {
        // Best-effort — fall back to no extras if the read fails.
      }
      try {
        const brandRow = await db
          .select({ config: lpBrandSettingsTable.config })
          .from(lpBrandSettingsTable)
          .where(eq(lpBrandSettingsTable.tenantId, match.tenantId))
          .limit(1);
        const cfg = (brandRow[0]?.config ?? {}) as Record<string, unknown>;
        if (typeof cfg.websiteUrl === "string" && cfg.websiteUrl.trim()) {
          tenantWebsiteUrl = cfg.websiteUrl.trim();
        }
      } catch {
        // Best-effort — leave null if the brand-config read fails.
      }
    }
    const data = match
      ? {
          mode: match.mode,
          tenantId: match.tenantId,
          tenantName: match.tenantName,
          tenantSlug: match.tenantSlug,
          micrositeDomain: match.micrositeDomain,
          redirectToHost,
          rootRedirectUrl,
          tenantWebsiteUrl,
          vanityLinks,
        }
      : extractWildcardSlug(domain) !== null
        ? { mode: "not-found", tenantId: null, tenantName: null, tenantSlug: null, micrositeDomain: null, redirectToHost: null, rootRedirectUrl: null, tenantWebsiteUrl: null, vanityLinks: [] }
        : { mode: "open", tenantId: null, tenantName: null, tenantSlug: null, micrositeDomain: null, redirectToHost: null, rootRedirectUrl: null, tenantWebsiteUrl: null, vanityLinks: [] };

    domainCtxSet(domain, { data, expiresAt: Date.now() + DOMAIN_CTX_TTL_MS });
    // `private` + short max-age: response now carries per-tenant settings
    // (rootRedirectUrl / vanityLinks) that a tenant admin can edit from
    // /brand. The 5-minute in-memory cache above absorbs DB load; this
    // header keeps shared caches out of the way and bounds browser
    // staleness to 60s so settings PATCHes show up quickly without a
    // hard reload.
    res.set("Cache-Control", "private, max-age=60, must-revalidate");
    res.json(data);
  } catch (err) {
    console.error("[auth] /domain-context error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Local slugify mirroring the client CreateWorkspaceForm slugify so a typed
// company name resolves to the same slug shape we generate at signup.
function slugifyQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Fuzzy workspace suggestions (typo-tolerant finder) ────────────────────
//
// When the exact name/slug lookup misses, we offer up to a handful of close,
// high-confidence suggestions so a user who mistyped or abbreviated their
// company name can still reach their workspace. To avoid turning the finder
// into an enumeration oracle, suggestions require a minimum query length, must
// clear a strict similarity floor, and are hard-capped (see the constants
// below). The endpoint-level rate limit and open-domain-only guard remain in
// force on top of these.

/** Minimum normalized (alphanumeric-only) query length before we ever suggest. */
const SUGGEST_MIN_QUERY_LEN = 3;
/** Strict similarity floor (0..1) a candidate must clear to be suggested. */
const SUGGEST_THRESHOLD = 0.72;
/** Hard cap on the number of suggestions returned. */
const SUGGEST_MAX = 3;
/** Minimum token length considered for the abbreviation / extra-word match. */
const SUGGEST_MIN_TOKEN_LEN = 3;
/** Per-token similarity required for the abbreviation / extra-word match. */
const SUGGEST_TOKEN_THRESHOLD = 0.85;
/** Score assigned when every significant target token is covered by the query. */
const SUGGEST_TOKEN_MATCH_SCORE = 0.9;

/** Lowercase + strip everything but [a-z0-9] for char-level comparison. */
function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Split a value into slug-shaped tokens for token-level comparison. */
function tokenizeForCompare(value: string): string[] {
  return slugifyQuery(value).split("-").filter(Boolean);
}

/** Classic Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Normalized Levenshtein similarity in [0,1] (1 = identical). */
function normLevSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Score how well a raw query matches a tenant's name/slug, returning the best
 * signal in [0,1]. Two complementary signals are combined:
 *   1. Char-level normalized edit similarity (catches typos: "acmee" → "acme").
 *   2. Token coverage (catches abbreviations / extra words: "acme corp" →
 *      "Acme") — every significant target token must be matched by some query
 *      token at high confidence.
 */
function scoreTenantMatch(
  rawQuery: string,
  tenant: { slug: string | null; name: string | null },
): number {
  const q = normalizeForCompare(rawQuery);
  if (!q) return 0;
  const targets = [tenant.slug, tenant.name].filter((t): t is string => !!t);

  let best = 0;
  for (const target of targets) {
    best = Math.max(best, normLevSimilarity(q, normalizeForCompare(target)));
  }

  const queryTokens = tokenizeForCompare(rawQuery);
  for (const target of targets) {
    const targetTokens = tokenizeForCompare(target).filter(t => t.length >= SUGGEST_MIN_TOKEN_LEN);
    if (!targetTokens.length) continue;
    const allCovered = targetTokens.every(tt =>
      queryTokens.some(
        qt => qt.length >= SUGGEST_MIN_TOKEN_LEN && normLevSimilarity(qt, tt) >= SUGGEST_TOKEN_THRESHOLD,
      ),
    );
    if (allCovered) best = Math.max(best, SUGGEST_TOKEN_MATCH_SCORE);
  }
  return best;
}

export interface WorkspaceSuggestion {
  name: string;
  host: string;
  url: string;
}

/**
 * Rank active tenants by fuzzy similarity to `rawQuery` and return up to
 * SUGGEST_MAX close matches above the strict threshold. Returns an empty array
 * when the query is too short or nothing is close enough — never a fallback to
 * the full tenant list.
 */
function rankWorkspaceSuggestions(
  rawQuery: string,
  rows: ReadonlyArray<{ slug: string | null; domain: string | null; name: string | null }>,
): WorkspaceSuggestion[] {
  if (normalizeForCompare(rawQuery).length < SUGGEST_MIN_QUERY_LEN) return [];

  const scored = rows
    .map(r => ({ r, score: scoreTenantMatch(rawQuery, r) }))
    .filter(x => x.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score || (a.r.name ?? "").localeCompare(b.r.name ?? ""));

  const suggestions: WorkspaceSuggestion[] = [];
  for (const { r } of scored) {
    const host = getCanonicalTenantHost({ slug: r.slug, domain: r.domain });
    if (!host) continue;
    suggestions.push({ name: r.name ?? r.slug ?? host, host, url: `https://${host}` });
    if (suggestions.length >= SUGGEST_MAX) break;
  }
  return suggestions;
}

// GET /api/auth/find-workspace?q=... — public workspace finder.
// Resolves an EXACT typed company name or workspace slug to that workspace's
// canonical login host so a member of an existing workspace can get to their
// own login page from the central domain. When there is no exact match, it
// returns up to a few close, high-confidence fuzzy suggestions so a mistyped or
// abbreviated company name still leads somewhere.
//
// Security: an exact hit returns { found: true, host, url } as before. A
// near-miss returns { found: false, suggestions: [{ name, host, url }] } with a
// hard-capped, strictly-thresholded list — never a fallback to the full tenant
// list (see rankWorkspaceSuggestions for the min-length / similarity-floor /
// cap guards). The finder stays strictly rate-limited and is only enabled on
// the open/central domain so it can't be abused from a tenant-locked host. The
// response never carries tenant metadata beyond display name + canonical host.
router.get("/auth/find-workspace", findWorkspaceLimiter, async (req, res): Promise<void> => {
  // Never let any finder response (positive OR negative) be cached by
  // intermediaries — results are tenant-state dependent and security-sensitive.
  res.set("Cache-Control", "no-store");
  try {
    // Only expose on the open/central domain. If the request host resolves to
    // a specific tenant (tenant-locked admin host or microsite), the finder is
    // off and we return a generic 404 rather than reveal it exists.
    const requestHost = getRequestHost(req);
    if (requestHost) {
      const hostMatch = await findTenantByHost(requestHost);
      if (hostMatch) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    }

    const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!raw || raw.length > 200) {
      res.json({ found: false });
      return;
    }

    // Build a small set of EXACT slug candidates: the raw text lowercased, a
    // slugified version of it, and (when the user pasted a host/URL) the
    // wildcard subdomain. Slugs are unique, so at most one tenant can match.
    const lower = raw.toLowerCase();
    const hostCandidate = lower.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    const slugCandidates = new Set<string>();
    const addCandidate = (s: string | null | undefined) => { if (s) slugCandidates.add(s); };
    addCandidate(lower);
    addCandidate(slugifyQuery(raw));
    addCandidate(extractWildcardSlug(hostCandidate));

    const result = await pool.query<{ slug: string | null; domain: string | null; name: string | null }>(
      `SELECT slug, domain, name FROM tenants
        WHERE status = 'active' AND (lower(slug) = ANY($1::text[]) OR lower(name) = $2)`,
      [Array.from(slugCandidates), lower],
    );

    // Prefer a slug match (unique). Fall back to an exact, case-insensitive
    // name match only when it is unambiguous — if multiple workspaces share a
    // name, return not-found rather than guess or reveal a list.
    let match = result.rows.find(r => r.slug && slugCandidates.has(r.slug.toLowerCase())) ?? null;
    if (!match) {
      const nameMatches = result.rows.filter(r => (r.name ?? "").toLowerCase() === lower);
      if (nameMatches.length === 1) match = nameMatches[0];
    }
    if (!match) {
      // No exact hit — fall back to a short list of close, high-confidence
      // suggestions so a mistyped/abbreviated company name still leads
      // somewhere. rankWorkspaceSuggestions enforces the min-length and
      // strict-threshold anti-enumeration guards; the endpoint's rate limit
      // and open-domain-only check above remain in force.
      const all = await pool.query<{ slug: string | null; domain: string | null; name: string | null }>(
        `SELECT slug, domain, name FROM tenants WHERE status = 'active'`,
      );
      const suggestions = rankWorkspaceSuggestions(raw, all.rows);
      if (suggestions.length) {
        res.json({ found: false, suggestions });
        return;
      }
      res.json({ found: false });
      return;
    }

    const host = getCanonicalTenantHost({ slug: match.slug, domain: match.domain });
    if (!host) {
      res.json({ found: false });
      return;
    }
    res.json({ found: true, host, url: `https://${host}` });
  } catch (err) {
    console.error("[auth] /find-workspace error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/signup — create a new tenant workspace for an authenticated user who has no tenant yet
router.post("/auth/signup", async (req, res): Promise<void> => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const sessionResult = await pool.query(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid]
    );
    if (!sessionResult.rows.length) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const sess = JSON.parse(sessionResult.rows[0].sess);

    if (sess.tenantId) {
      res.status(400).json({ error: "You already belong to a workspace" });
      return;
    }

    const { name, slug, phoneVerifiedToken } = req.body ?? {};
    if (!name || typeof name !== "string" || !slug || typeof slug !== "string") {
      res.status(400).json({ error: "name and slug are required" });
      return;
    }

    // Trial phone gate (Task #637). When Twilio is configured every self-serve
    // signup must present a phone-verified token; when it isn't, the gate is
    // skipped and the trial is granted as before (dev/e2e/pre-provisioning).
    const requirePhone = twilioConfigured();

    const slugClean = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slugClean) {
      res.status(400).json({ error: "Invalid slug — use letters, numbers, and hyphens only" });
      return;
    }

    // Task #133 — block reuse of a slug that's currently inside another
    // tenant's rename redirect window so we don't hijack their old bookmarks.
    if (await isSlugRedirectReserved(slugClean, null)) {
      res.status(409).json({ error: "That workspace URL was recently used by another workspace. Please choose another." });
      return;
    }

    // Mirror admin.ts presets exactly (task #108): pages.publish + pages.review
    // are gating perms for the page-review workflow. Admins/CMs can publish
    // directly, Editors must Submit-for-Review, Viewers can browse only.
    const ALL_PERMS = {
      pages: true, "pages.publish": true, "pages.review": true,
      tests: true, analytics: true, forms_leads: true, brand: true,
      blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
      sales_outreach: true, sales_campaigns: true, sales_signals: true, settings: true, team: true, roles: true,
    };
    const CONTENT_MANAGER_PERMS = {
      pages: true, "pages.publish": true, "pages.review": true,
      tests: true, analytics: true, forms_leads: true, brand: true,
      blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
      sales_outreach: true, sales_campaigns: false, sales_signals: true, settings: false, team: false, roles: false,
    };
    const EDITOR_PERMS = {
      pages: true, "pages.publish": false, "pages.review": false,
      tests: true, analytics: true, forms_leads: true, brand: true,
      blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
      sales_outreach: true, sales_campaigns: false, sales_signals: true, settings: false, team: false, roles: false,
    };
    const VIEWER_PERMS = {
      pages: true, "pages.publish": false, "pages.review": false,
      tests: false, analytics: true, forms_leads: false, brand: false,
      blocks: false, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
      sales_outreach: false, sales_campaigns: false, sales_signals: true, settings: false, team: false, roles: false,
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Redeem the phone-verified token (Task #637) inside the transaction so
      // the redeem + trial record commit/roll back atomically with the tenant
      // INSERT. When the gate is on, a missing/invalid/expired/used token blocks
      // signup. The verified number's hash decides trial-vs-free-floor: a number
      // that has trialed before gets a workspace on the free floor (no window).
      let grantTrial = true;
      let trialPhoneHash: string | null = null;
      let phoneAlreadyTrialed = false;
      if (requirePhone) {
        const redeemed = await redeemPhoneVerifiedToken(client, phoneVerifiedToken, sess.userId);
        if (!redeemed) {
          await client.query("ROLLBACK");
          res.status(400).json({
            error: "Phone verification is required. Please verify your mobile number to continue.",
            code: "phone_verification_required",
          });
          return;
        }
        trialPhoneHash = redeemed.phoneHash;
        phoneAlreadyTrialed = await hasPhoneTrialed(client, trialPhoneHash);
        grantTrial = !phoneAlreadyTrialed;
      }

      // Default new tenants to industry='generic' so they immediately resolve
      // to the generic block catalog with no manual settings patch required.
      //
      // Task #113: self-serve signups also opt OUT of the page-review workflow
      // (requireReviewBeforePublish=false). Existing tenants are backfilled
      // to TRUE on server boot so their #108 behaviour is preserved; this
      // path mirrors the admin-create default so all "new" tenants — however
      // they're created — start with the workflow off.
      // Auto-enroll every self-serve signup in the uniform 14-day Growth trial.
      // The stored plan is the FREE floor they fall back to after expiry; the
      // trial window (trial_started_at / trial_expires_at) is what grants Growth
      // features meanwhile via effectivePlan(). No card, no tier picker.
      //
      // Task #637: when the phone has already trialed (`grantTrial` false) the
      // window columns stay NULL so the tenant lands on the free floor with no
      // trial — billing/upgrade is unaffected and remains available.
      const tenantResult = grantTrial
        ? await client.query(
            `INSERT INTO tenants (name, slug, plan, status, settings, trial_started_at, trial_expires_at)
             VALUES ($1, $2, 'free', 'active',
                     '{"industry":"generic","requireReviewBeforePublish":false}'::jsonb,
                     now(), now() + make_interval(days => $3))
             RETURNING id, name, slug`,
            [name.trim(), slugClean, TRIAL_DURATION_DAYS]
          )
        : await client.query(
            `INSERT INTO tenants (name, slug, plan, status, settings, trial_started_at, trial_expires_at)
             VALUES ($1, $2, 'free', 'active',
                     '{"industry":"generic","requireReviewBeforePublish":false}'::jsonb,
                     NULL, NULL)
             RETURNING id, name, slug`,
            [name.trim(), slugClean]
          );
      const tenant = tenantResult.rows[0];

      // Auto-assign a managed landing-page host (e.g. acme-lp.lpstudio.ai) so
      // every new tenant has a clean public address for their pages from day
      // one. Served off our wildcard cert + worker — no tenant DNS, no
      // Cloudflare provisioning. Conflict-safe (only set when that exact host
      // isn't already claimed by another tenant's domain/microsite_domain) and
      // editable later in Settings → Domain. The legacy <slug>.lpstudio.ai/lp/…
      // URLs keep working independently via wildcard slug resolution.
      const pageHost = defaultPageSubdomain(tenant.slug);
      // The wildcard label this host resolves through (e.g. "acme-lp"). Guard
      // against claiming a host whose label is ALREADY another tenant's slug —
      // findTenantByHost matches an exact microsite_domain before the wildcard
      // slug, so without this we'd shadow that tenant's <slug>.lpstudio.ai host.
      const pageHostLabel = extractWildcardSlug(pageHost);
      await client.query(
        `UPDATE tenants SET microsite_domain = $1, updated_at = now()
           WHERE id = $2
             AND microsite_domain IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM tenants o
                WHERE o.id <> $2
                  AND (lower(o.domain) = $1 OR lower(o.microsite_domain) = $1)
             )
             AND NOT EXISTS (
               SELECT 1 FROM tenants s
                WHERE s.id <> $2 AND lower(s.slug) = $3
             )`,
        [pageHost, tenant.id, pageHostLabel],
      );
      invalidateTenantHostCache();

      // Record the number as having consumed its one free trial — only when a
      // trial was actually granted, and atomically with the tenant it unlocked.
      if (requirePhone && grantTrial && trialPhoneHash) {
        await recordPhoneTrial(client, trialPhoneHash, tenant.id);
      }

      const adminRoleResult = await client.query(
        `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
         VALUES ($1, 'Admin', $2, true, true) RETURNING id`,
        [tenant.id, JSON.stringify(ALL_PERMS)]
      );
      await client.query(
        `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
         VALUES ($1, 'Content Manager', $2, false, true)`,
        [tenant.id, JSON.stringify(CONTENT_MANAGER_PERMS)]
      );
      await client.query(
        `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
         VALUES ($1, 'Editor', $2, false, true)`,
        [tenant.id, JSON.stringify(EDITOR_PERMS)]
      );
      await client.query(
        `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
         VALUES ($1, 'Viewer', $2, false, true)`,
        [tenant.id, JSON.stringify(VIEWER_PERMS)]
      );
      const adminRoleId = adminRoleResult.rows[0].id;

      await client.query(
        `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
         VALUES ($1, $2, $3, $4, now())`,
        [tenant.id, sess.userId, adminRoleId, sess.email]
      );

      await client.query(
        `UPDATE app_users SET tenant_id = $1 WHERE id = $2`,
        [tenant.id, sess.userId]
      );

      await client.query("COMMIT");

      // Drop the in-memory tenant-host cache on this instance so the brand-new
      // slug resolves immediately via `<slug>.<wildcardBase>` instead of
      // 404-ing for up to TTL_MS (60s). Mirrors admin.ts tenant-mutation
      // routes. NOTE: only invalidates THIS process's cache — other
      // instances in a multi-replica deploy still pick up the new tenant
      // on their own 60s refresh.
      invalidateTenantHostCache();

      // Refresh the session with the new tenantId and Admin permissions
      const newSess = JSON.stringify({
        ...sess,
        tenantId: tenant.id,
        role: "Admin",
        permissions: ALL_PERMS,
        isAdmin: true,
      });
      const expire = new Date(Date.now() + SESSION_TTL_MS);
      await pool.query(
        `UPDATE app_sessions SET sess = $1, expire = $2 WHERE sid = $3`,
        [newSess, expire, sid]
      );

      res.json({ ok: true, tenant, trialGranted: grantTrial, phoneAlreadyTrialed });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err.code === "23505" && (err.constraint as string)?.includes("slug")) {
      res.status(409).json({ error: "That workspace URL is already taken. Please choose another." });
      return;
    }
    console.error("[auth] signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Email + password and passwordless (magic-link) authentication.
//
// Extends the existing Google OAuth + admin-password flows. All email-sending
// endpoints are optionally bot-challenged via Turnstile (gracefully skipped
// when no key is configured) and avoid account enumeration by returning the
// same generic response whether or not the address exists. Sessions are created
// through the shared `establishSession()` so membership resolution matches the
// Google flow exactly.
// ───────────────────────────────────────────────────────────────────────────

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const MAGIC_LINK_EXPIRY_LABEL = "15 minutes";
const EMAIL_VERIFY_EXPIRY_LABEL = "24 hours";
const PASSWORD_RESET_EXPIRY_LABEL = "30 minutes";
// Identical response for every email-sending request so the presence/absence of
// an account is never revealed.
const GENERIC_INBOX_MSG = "If that email address has an account, we've sent it a link. Please check your inbox.";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const e = value.trim().toLowerCase();
  if (e.length < 3 || e.length > 320 || !e.includes("@") || /\s/.test(e)) return null;
  return e;
}

/**
 * Resolve open vs tenant-locked mode for the host a (non-OAuth) request arrived
 * on, so the email/magic-link flows feed `establishSession` the same domain
 * context the Google callback derives from its OAuth `state`.
 */
async function resolveDomainMode(
  req: Request,
): Promise<{ domainMode: "open" | "tenant-locked"; domainTenantId: number | null }> {
  const originHost = getRequestHost(req);
  if (originHost) {
    const match = await findTenantByHost(originHost);
    if (match && match.mode === "tenant-locked") {
      return { domainMode: "tenant-locked", domainTenantId: match.tenantId };
    }
  }
  return { domainMode: "open", domainTenantId: null };
}

// A valid scrypt hash used as a constant-time decoy when the supplied email has
// no account, so a login probe can't distinguish "no such user" from "wrong
// password" by timing. Computed lazily once.
let decoyHashPromise: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  return (decoyHashPromise ??= hashPassword(crypto.randomBytes(24).toString("hex")));
}

// GET /api/auth/turnstile-config — expose the PUBLIC Turnstile site key (or
// null when unconfigured) so the frontend can decide whether to render the
// challenge widget. The secret key never leaves the server.
router.get("/auth/turnstile-config", (_req, res): void => {
  res.json({ siteKey: process.env.TURNSTILE_SITE_KEY ?? null });
});

// ───────────────────────────────────────────────────────────────────────────
// Trial phone gating (Task #637) — SMS phone verification limiting one free
// 14-day Growth trial per verified mobile number.
//
// Flow: a signed-in user without a workspace (post-login, pre-signup) verifies
// a mobile phone via Twilio Verify before creating a workspace. send-code looks
// the number up (rejecting VOIP/landline) and texts a code; verify-code checks
// it and mints a single-use token; /auth/signup redeems that token and decides
// trial-vs-free-floor based on whether the number has trialed before.
//
// Gating: when Twilio isn't configured (`twilioConfigured()` false) the gate is
// disabled — signup grants the trial as before so dev/e2e/pre-provisioning keep
// working — and these endpoints return a clear 503 setup error rather than ever
// pretending a number was verified.

// Resolve the session for a signed-in user who does NOT yet belong to a
// workspace (the only state in which phone verification runs). Mirrors the
// manual cookie+app_sessions read in /auth/signup (requireAuth can't be used
// because the user has no tenantId yet). Returns null with the response already
// sent on any failure.
async function requireTenantlessSession(
  req: Request,
  res: Response,
): Promise<{ sid: string; sess: any } | null> {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const sessionResult = await pool.query(
    `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
    [sid],
  );
  if (!sessionResult.rows.length) {
    res.status(401).json({ error: "Session expired" });
    return null;
  }
  const sess = JSON.parse(sessionResult.rows[0].sess);
  if (sess.tenantId) {
    res.status(400).json({ error: "You already belong to a workspace" });
    return null;
  }
  return { sid, sess };
}

// GET /api/auth/phone/config — tells the frontend whether the workspace-create
// flow must require SMS phone verification (i.e. whether Twilio is configured).
router.get("/auth/phone/config", (_req, res): void => {
  res.json({ required: twilioConfigured() });
});

// POST /api/auth/phone/send-code — validate the number (reject VOIP/landline
// via Twilio Lookup) and text an SMS verification code. Turnstile-gated and
// strictly rate-limited because each call sends a billable SMS.
router.post("/auth/phone/send-code", phoneSendLimiter, async (req, res): Promise<void> => {
  try {
    const session = await requireTenantlessSession(req, res);
    if (!session) return;

    if (!twilioConfigured()) {
      res.status(503).json({
        error: "Phone verification isn't available right now. Please try again later.",
        code: "phone_not_configured",
      });
      return;
    }

    const body = (req.body ?? {}) as { phone?: unknown; turnstileToken?: unknown };
    const turnstile = await verifyTurnstile(body.turnstileToken, req.ip);
    if (!turnstile.ok) {
      res.status(400).json({ error: "Bot check failed. Please try again." });
      return;
    }

    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!rawPhone) {
      res.status(400).json({ error: "Enter your mobile number.", code: "invalid_phone" });
      return;
    }

    const lookup = await lookupLineType(rawPhone);
    if (!lookup.valid || !lookup.phoneNumber) {
      res.status(400).json({
        error: "That doesn't look like a valid phone number. Include your country code (e.g. +1).",
        code: "invalid_phone",
      });
      return;
    }
    if (isVoipLineType(lookup.lineType)) {
      res.status(400).json({
        error: "That looks like a virtual or VOIP number. Please use a real mobile number.",
        code: "voip_rejected",
      });
      return;
    }

    const sent = await sendVerificationCode(lookup.phoneNumber);
    if (!sent.ok) {
      res.status(502).json({
        error: "We couldn't send a code to that number. Double-check it and try again.",
        code: "send_failed",
      });
      return;
    }

    // Return the canonical E.164 so the client echoes it back to verify-code
    // (the code was sent to this exact form, so the check must use it too).
    res.json({ ok: true, phone: lookup.phoneNumber });
  } catch (err) {
    console.error("[auth] phone send-code error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/phone/verify-code — check the SMS code and, on success, mint a
// single-use phone-verified token the signup flow redeems. Also reports whether
// the number has already used its one free trial so the UI can set expectations.
router.post("/auth/phone/verify-code", phoneVerifyLimiter, async (req, res): Promise<void> => {
  try {
    const session = await requireTenantlessSession(req, res);
    if (!session) return;

    if (!twilioConfigured()) {
      res.status(503).json({
        error: "Phone verification isn't available right now. Please try again later.",
        code: "phone_not_configured",
      });
      return;
    }

    const body = (req.body ?? {}) as { phone?: unknown; code?: unknown };
    // The client echoes the canonical E.164 returned by send-code. Validate it
    // strictly so we hash exactly the form the code was sent to.
    if (!isValidE164(body.phone)) {
      res.status(400).json({ error: "Enter a valid mobile number.", code: "invalid_phone" });
      return;
    }
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{4,10}$/.test(code)) {
      res.status(400).json({ error: "Enter the code from the text message.", code: "invalid_code" });
      return;
    }

    const check = await checkVerificationCode(body.phone, code);
    if (!check.approved) {
      res.status(400).json({
        error: "That code is incorrect or has expired. Request a new one.",
        code: "code_invalid",
      });
      return;
    }

    const phoneVerifiedToken = await mintPhoneVerifiedToken({
      userId: session.sess.userId,
      phoneE164: body.phone,
    });
    const alreadyTrialed = await hasPhoneTrialed(pool, hashPhone(body.phone));

    res.json({ ok: true, phoneVerifiedToken, alreadyTrialed });
  } catch (err) {
    console.error("[auth] phone verify-code error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/email/register — create an email+password account and send a
// verification link. Never overwrites an existing account (avoids takeover of a
// Google account) and never reveals whether the address already exists.
router.post("/auth/email/register", emailSendLimiter, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown; name?: unknown; turnstileToken?: unknown };
    const turnstile = await verifyTurnstile(body.turnstileToken, req.ip);
    if (!turnstile.ok) {
      res.status(400).json({ error: "Bot check failed. Please try again." });
      return;
    }
    const email = normalizeEmail(body.email);
    if (!email) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    const strength = validatePasswordStrength(body.password);
    if (!strength.ok) {
      res.status(400).json({ error: strength.error });
      return;
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const passwordHash = await hashPassword(body.password as string);

    const insert = await pool.query(
      `INSERT INTO app_users (email, name, password_hash, status, email_verified)
       VALUES ($1, $2, $3, 'active', false)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, name, passwordHash]
    );

    if (insert.rows.length > 0) {
      const userId = insert.rows[0].id as number;
      await invalidateUserTokens(userId, "email_verify");
      const raw = await mintEmailToken({
        userId,
        purpose: "email_verify",
        ttlMs: EMAIL_VERIFY_TTL_MS,
        targetHost: getRequestHost(req) || null,
      });
      const verifyUrl = `${buildHostBaseUrl(req)}/api/auth/email/verify?token=${encodeURIComponent(raw)}`;
      await sendEmailVerificationEmail({ recipientEmail: email, verifyUrl, expiryLabel: EMAIL_VERIFY_EXPIRY_LABEL });
    }
    res.json({ ok: true, message: "Check your inbox to confirm your email address." });
  } catch (err) {
    console.error("[auth] email register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/email/verify — redeem an email-verification token, mark the
// address verified, and log the user in.
router.get("/auth/email/verify", async (req, res): Promise<void> => {
  try {
    const token = (req.query.token as string) || "";
    const redeemed = await redeemEmailToken(token, "email_verify");
    if (!redeemed) {
      res.redirect("/?error=invalid_or_expired_link");
      return;
    }
    if (redeemed.targetHost && redeemed.targetHost !== getRequestHost(req)) {
      res.redirect("/?error=invalid_link_host");
      return;
    }
    const userRes = await pool.query(
      `UPDATE app_users SET email_verified = true, last_login_at = now(), updated_at = now()
       WHERE id = $1 RETURNING id, email, name, avatar_url, role, tenant_id`,
      [redeemed.userId]
    );
    if (!userRes.rows.length) {
      res.redirect("/?error=auth_failed");
      return;
    }
    const { domainMode, domainTenantId } = await resolveDomainMode(req);
    await establishSession(res, userRes.rows[0], domainMode, domainTenantId);
    res.redirect(sanitizeNextPath(redeemed.nextPath) ?? "/");
  } catch (err) {
    console.error("[auth] email verify error:", err);
    res.redirect("/?error=auth_failed");
  }
});

// POST /api/auth/email/resend-verification — re-send the verification email for
// an unverified password account. Generic response (no enumeration).
router.post("/auth/email/resend-verification", emailSendLimiter, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; turnstileToken?: unknown };
    const turnstile = await verifyTurnstile(body.turnstileToken, req.ip);
    if (!turnstile.ok) {
      res.status(400).json({ error: "Bot check failed. Please try again." });
      return;
    }
    const email = normalizeEmail(body.email);
    if (email) {
      const userRes = await pool.query(
        `SELECT id, email_verified, password_hash FROM app_users WHERE email = $1`,
        [email]
      );
      const row = userRes.rows[0];
      if (row && !row.email_verified && row.password_hash) {
        await invalidateUserTokens(row.id, "email_verify");
        const raw = await mintEmailToken({
          userId: row.id,
          purpose: "email_verify",
          ttlMs: EMAIL_VERIFY_TTL_MS,
          targetHost: getRequestHost(req) || null,
        });
        const verifyUrl = `${buildHostBaseUrl(req)}/api/auth/email/verify?token=${encodeURIComponent(raw)}`;
        await sendEmailVerificationEmail({ recipientEmail: email, verifyUrl, expiryLabel: EMAIL_VERIFY_EXPIRY_LABEL });
      }
    }
    res.json({ ok: true, message: GENERIC_INBOX_MSG });
  } catch (err) {
    console.error("[auth] resend verification error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/email/login — email + password sign-in. Requires a verified
// address. Generic 401 for any bad-credential case; constant-time to avoid
// account enumeration.
router.post("/auth/email/login", passwordAuthLimiter, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = normalizeEmail(body.email);
    if (!email || typeof body.password !== "string") {
      res.status(400).json({ error: "Enter your email and password." });
      return;
    }
    const userRes = await pool.query(
      `SELECT id, email, name, avatar_url, role, tenant_id, password_hash, email_verified
       FROM app_users WHERE email = $1`,
      [email]
    );
    const row = userRes.rows[0];
    const passwordOk = await verifyPassword(body.password, row?.password_hash ?? (await getDecoyHash()));
    if (!row || !row.password_hash || !passwordOk) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    if (!row.email_verified) {
      res.status(403).json({
        error: "Please verify your email first — check your inbox for the confirmation link.",
        needsVerification: true,
      });
      return;
    }
    await pool.query(`UPDATE app_users SET last_login_at = now(), updated_at = now() WHERE id = $1`, [row.id]);
    const { domainMode, domainTenantId } = await resolveDomainMode(req);
    await establishSession(res, row, domainMode, domainTenantId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[auth] email login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/magic-link — request a passwordless sign-in link. Creates the
// account if new (passwordless signup). Generic response either way.
router.post("/auth/magic-link", emailSendLimiter, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; turnstileToken?: unknown; next?: unknown };
    const turnstile = await verifyTurnstile(body.turnstileToken, req.ip);
    if (!turnstile.ok) {
      res.status(400).json({ error: "Bot check failed. Please try again." });
      return;
    }
    const email = normalizeEmail(body.email);
    if (!email) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    const nextPath = sanitizeNextPath(body.next);
    const userRes = await pool.query(
      `INSERT INTO app_users (email, name, status) VALUES ($1, '', 'active')
       ON CONFLICT (email) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [email]
    );
    const userId = userRes.rows[0].id as number;
    await invalidateUserTokens(userId, "magic_link");
    const raw = await mintEmailToken({
      userId,
      purpose: "magic_link",
      ttlMs: MAGIC_LINK_TTL_MS,
      targetHost: getRequestHost(req) || null,
      nextPath,
    });
    const magicLinkUrl = `${buildHostBaseUrl(req)}/api/auth/magic-link/verify?token=${encodeURIComponent(raw)}`;
    await sendMagicLinkEmail({ recipientEmail: email, magicLinkUrl, expiryLabel: MAGIC_LINK_EXPIRY_LABEL });
    res.json({ ok: true, message: GENERIC_INBOX_MSG });
  } catch (err) {
    console.error("[auth] magic-link request error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/magic-link/verify — redeem a magic-link token and log in. The
// link proves inbox ownership, so the address is marked verified.
router.get("/auth/magic-link/verify", async (req, res): Promise<void> => {
  try {
    const token = (req.query.token as string) || "";
    const redeemed = await redeemEmailToken(token, "magic_link");
    if (!redeemed) {
      res.redirect("/?error=invalid_or_expired_link");
      return;
    }
    if (redeemed.targetHost && redeemed.targetHost !== getRequestHost(req)) {
      res.redirect("/?error=invalid_link_host");
      return;
    }
    const userRes = await pool.query(
      `UPDATE app_users SET email_verified = true, last_login_at = now(), updated_at = now()
       WHERE id = $1 RETURNING id, email, name, avatar_url, role, tenant_id`,
      [redeemed.userId]
    );
    if (!userRes.rows.length) {
      res.redirect("/?error=auth_failed");
      return;
    }
    const { domainMode, domainTenantId } = await resolveDomainMode(req);
    await establishSession(res, userRes.rows[0], domainMode, domainTenantId);
    res.redirect(sanitizeNextPath(redeemed.nextPath) ?? "/");
  } catch (err) {
    console.error("[auth] magic-link verify error:", err);
    res.redirect("/?error=auth_failed");
  }
});

// POST /api/auth/password/forgot — send a password-reset link. Generic response
// (no enumeration). The reset link lands on the frontend /reset-password page.
router.post("/auth/password/forgot", emailSendLimiter, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as { email?: unknown; turnstileToken?: unknown };
    const turnstile = await verifyTurnstile(body.turnstileToken, req.ip);
    if (!turnstile.ok) {
      res.status(400).json({ error: "Bot check failed. Please try again." });
      return;
    }
    const email = normalizeEmail(body.email);
    if (email) {
      const userRes = await pool.query(`SELECT id FROM app_users WHERE email = $1`, [email]);
      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id as number;
        await invalidateUserTokens(userId, "password_reset");
        const raw = await mintEmailToken({
          userId,
          purpose: "password_reset",
          ttlMs: PASSWORD_RESET_TTL_MS,
          targetHost: getRequestHost(req) || null,
        });
        const resetUrl = `${buildHostBaseUrl(req)}/reset-password?token=${encodeURIComponent(raw)}`;
        await sendPasswordResetEmail({ recipientEmail: email, resetUrl, expiryLabel: PASSWORD_RESET_EXPIRY_LABEL });
      }
    }
    res.json({ ok: true, message: GENERIC_INBOX_MSG });
  } catch (err) {
    console.error("[auth] password forgot error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/password/reset — set a new password from a reset token, mark
// the address verified, and log the user in.
router.post("/auth/password/reset", passwordAuthLimiter, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as { token?: unknown; password?: unknown };
    const strength = validatePasswordStrength(body.password);
    if (!strength.ok) {
      res.status(400).json({ error: strength.error });
      return;
    }
    if (typeof body.token !== "string" || !body.token) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }
    const redeemed = await redeemEmailToken(body.token, "password_reset");
    if (!redeemed) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }
    // Host-bind the reset, same as the verify/magic-link redemption flows: a
    // token minted for one host must be redeemed on that host.
    if (redeemed.targetHost && redeemed.targetHost !== getRequestHost(req)) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }
    const passwordHash = await hashPassword(body.password as string);
    const userRes = await pool.query(
      `UPDATE app_users SET password_hash = $1, email_verified = true, last_login_at = now(), updated_at = now()
       WHERE id = $2 RETURNING id, email, name, avatar_url, role, tenant_id`,
      [passwordHash, redeemed.userId]
    );
    if (!userRes.rows.length) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }
    // Void any other outstanding reset links for this user.
    await invalidateUserTokens(redeemed.userId, "password_reset");
    const { domainMode, domainTenantId } = await resolveDomainMode(req);
    await establishSession(res, userRes.rows[0], domainMode, domainTenantId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[auth] password reset error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
