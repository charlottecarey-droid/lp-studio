import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { pool, db, lpPageReviewsTable, lpPagesTable, tenantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { findTenantByHost, extractWildcardSlug, isWildcardBaseHost, WILDCARD_BASE_HOSTS, isSlugRedirectReserved, invalidateTenantHostCache } from "../lib/tenantHosts";
import { getRequestHost } from "../lib/requestHost";
import { sendWelcomeEmail } from "../lib/notifications";
import { normalizePlan, PLAN_FEATURES } from "../lib/planFeatures";

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

// GET /api/auth/google — initiates Google OAuth flow
router.get("/auth/google", oauthInitLimiter, (req, res): void => {
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
  // Embed origin host + redirect URI + next path in state so the callback can
  // replicate the exact redirect URI and resume the destination handoff.
  const state = Buffer.from(JSON.stringify({ host: originHost, redirectUri, next: nextPath })).toString("base64url");
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

  // Decode origin host + redirect URI + next destination from state
  let originHost = "";
  let stateRedirectUri = "";
  let nextPath: string | null = null;
  try {
    if (stateParam) {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
      originHost = decoded.host ?? "";
      stateRedirectUri = decoded.redirectUri ?? "";
      nextPath = sanitizeNextPath(decoded.next);
    }
  } catch { /* ignore malformed state */ }

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

    let tenantId: number | null = null;
    let role = "viewer";
    let permissions: Record<string, boolean> = {};
    let isAdmin = false;

    if (domainMode === "tenant-locked" && domainTenantId) {
      // Tenant-locked domain (e.g. ent.meetdandy.com): look up membership in that specific tenant.
      // Include pending invites (accepted_at IS NULL) — they are auto-accepted on first login.
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

      // Auto-accept pending invite and/or link email-only pre-invite to user_id on first login
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
      }

      if (memberResult.rows.length > 0) {
        const member = memberResult.rows[0];
        tenantId = member.tenant_id;
        role = member.role_name;
        permissions = (member.permissions as Record<string, boolean>) ?? {};
        isAdmin = member.is_admin ?? false;
        if (!user.tenant_id) {
          await pool.query(`UPDATE app_users SET tenant_id = $1 WHERE id = $2`, [tenantId, user.id]);
        }
      }
      // If not a member of the locked tenant, tenantId stays null → AuthGate shows "Access Pending"
    }
    else {
      // Open domain (e.g. app.lpstudio.ai): look up membership, but only to non-domain-locked tenants
      // (so Dandy employees don't get auto-dropped into Dandy's workspace on app.lpstudio.ai)
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

      // Auto-accept pending invite and/or link email-only pre-invite to user_id on first login
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
      }

      if (memberResult.rows.length > 0) {
        const member = memberResult.rows[0];
        tenantId = member.tenant_id;
        role = member.role_name;
        permissions = (member.permissions as Record<string, boolean>) ?? {};
        isAdmin = member.is_admin ?? false;
      }
      // If no open-domain membership found, tenantId stays null → AuthGate shows "Create workspace"
    }

    // Look up tenant's microsite domain so it's always available in the session
    let micrositeDomain: string | null = null;
    if (tenantId) {
      const tdResult = await pool.query(
        `SELECT microsite_domain FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (tdResult.rows.length > 0) micrositeDomain = tdResult.rows[0].microsite_domain ?? null;
    }

    // Clean up any stale "no-tenant" sessions for this user before creating a new one.
    // This prevents users from getting stuck on "Access Pending" after being added to a workspace.
    await pool.query(
      `DELETE FROM app_sessions
       WHERE (sess::jsonb->>'userId')::int = $1
         AND (sess::jsonb->>'tenantId') IS NULL`,
      [user.id]
    );

    // Create server-side session
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
      // Capture app_users.role at login so getTenantId can honour the
      // X-Tenant-Id cross-tenant override for Dandy operators (task #108).
      appUserRole: user.role ?? null,
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
      // Cross-domain: generate a short-lived exchange code (valid for 5 minutes, single-use)
      const exchangeCode = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute expiry
      await pool.query(
        `INSERT INTO auth_exchange_codes (code, sid, expires_at) VALUES ($1, $2, $3)`,
        [exchangeCode, sid, expiresAt]
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
      `SELECT sid FROM auth_exchange_codes WHERE code = $1 AND expires_at > now() LIMIT 1`,
      [code]
    );
    if (codeResult.rows.length === 0) {
      res.redirect("/?error=invalid_code");
      return;
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
    if (sess.tenantId) {
      const tenantResult = await pool.query(
        `SELECT onboarding_completed_at, settings, slug, domain, plan FROM tenants WHERE id = $1`,
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
        aiImageGenAvailable = PLAN_FEATURES[normalizePlan(tenantPlan)].aiImageGen;
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
    // Dandy super-admins (role='superadmin'). Tenant role lives in sess.role
    // and is unaffected. Done in /me so existing sessions get the value
    // without forcing every user to re-login.
    let appUserRole: string | null = null;
    if (sess.userId) {
      const ur = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [sess.userId]);
      if (ur.rows.length > 0) appUserRole = ur.rows[0].role ?? null;
    }

    // Canonical plan + feature matrix. The raw `tenantPlan` string above
    // is the legacy DB column value ("trial" / "business" / etc.) and is
    // still surfaced for existing AI-image-gen and other checks that
    // read it directly. `planTier` is the new canonical tier
    // ("starter" / "growth" / "enterprise") and `planFeatures` is the
    // server-computed feature map the UI uses to hide the Sales toggle
    // and short-circuit /sales/* routes before the request fires.
    const planTier = normalizePlan(tenantPlan);
    const planFeatures = PLAN_FEATURES[planTier];

    res.json({
      ...sess,
      onboardingCompleted,
      tenantIndustry,
      appUserRole,
      requireReviewBeforePublish,
      tenantSlug,
      tenantDomain,
      tenantHost,
      tenantLoginUrl,
      shouldRedirectToTenantHost,
      tenantPlan,
      planTier,
      planFeatures,
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
          RETURNING name, slug, domain`,
        [sess.tenantId]
      );
      if (claim.rows.length > 0) {
        const t = claim.rows[0];
        const host = getCanonicalTenantHost({ slug: t.slug ?? null, domain: t.domain ?? null });
        if (host) {
          const workspaceUrl = `https://${host}`;
          // Fire-and-forget so the API response isn't blocked on Resend.
          // Errors are logged inside sendWelcomeEmail.
          void sendWelcomeEmail({
            recipientEmail: sess.email,
            recipientName: sess.name ?? null,
            tenantName: t.name ?? "your workspace",
            workspaceUrl,
          });
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
    await pool.query(
      `INSERT INTO auth_exchange_codes (code, sid, expires_at) VALUES ($1, $2, $3)`,
      [code, sid, expiresAt]
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
router.post("/auth/password", async (req, res): Promise<void> => {
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
    // Find or create the user by email
    const upsertResult = await pool.query(
      `INSERT INTO app_users (email, name, status)
       VALUES ($1, $1, 'active')
       ON CONFLICT (email) DO UPDATE SET
         status = 'active',
         last_login_at = now(),
         updated_at = now()
       RETURNING id, email, name, avatar_url, role, tenant_id`,
      [email]
    );
    const user = upsertResult.rows[0];

    // Look up existing membership
    const memberResult = await pool.query(
      `SELECT tm.tenant_id, tm.role_id, tr.name as role_name, tr.permissions, tr.is_admin
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       WHERE tm.user_id = $1
       LIMIT 1`,
      [user.id]
    );

    let tenantId: number;
    let role: string;
    let permissions: Record<string, boolean>;
    let isAdmin: boolean;

    if (memberResult.rows.length > 0) {
      const m = memberResult.rows[0];
      tenantId = m.tenant_id;
      role = m.role_name;
      permissions = (m.permissions as Record<string, boolean>) ?? {};
      isAdmin = m.is_admin ?? false;
    } else {
      // Bootstrap: grant admin on tenant 1
      const adminRoleResult = await pool.query(
        `SELECT id, name, permissions FROM tenant_roles
         WHERE tenant_id = 1 AND is_admin = true LIMIT 1`
      );
      const adminRole = adminRoleResult.rows[0];

      await pool.query(
        `INSERT INTO tenant_members (tenant_id, user_id, role_id, email, accepted_at)
         VALUES (1, $1, $2, $3, now())
         ON CONFLICT DO NOTHING`,
        [user.id, adminRole.id, email]
      );

      await pool.query(
        `UPDATE app_users SET tenant_id = 1 WHERE id = $1`,
        [user.id]
      );

      tenantId = 1;
      role = adminRole.name;
      permissions = (adminRole.permissions as Record<string, boolean>) ?? {};
      isAdmin = true;
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
      // See login route — same rationale (task #108).
      appUserRole: user.role ?? null,
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
          vanityLinks,
        }
      : extractWildcardSlug(domain) !== null
        ? { mode: "not-found", tenantId: null, tenantName: null, tenantSlug: null, micrositeDomain: null, redirectToHost: null, rootRedirectUrl: null, vanityLinks: [] }
        : { mode: "open", tenantId: null, tenantName: null, tenantSlug: null, micrositeDomain: null, redirectToHost: null, rootRedirectUrl: null, vanityLinks: [] };

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

    const { name, slug } = req.body ?? {};
    if (!name || typeof name !== "string" || !slug || typeof slug !== "string") {
      res.status(400).json({ error: "name and slug are required" });
      return;
    }

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

      // Default new tenants to industry='generic' so they immediately resolve
      // to the generic block catalog with no manual settings patch required.
      //
      // Task #113: self-serve signups also opt OUT of the page-review workflow
      // (requireReviewBeforePublish=false). Existing tenants are backfilled
      // to TRUE on server boot so their #108 behaviour is preserved; this
      // path mirrors the admin-create default so all "new" tenants — however
      // they're created — start with the workflow off.
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, plan, status, settings)
         VALUES ($1, $2, 'trial', 'active',
                 '{"industry":"generic","requireReviewBeforePublish":false}'::jsonb)
         RETURNING id, name, slug`,
        [name.trim(), slugClean]
      );
      const tenant = tenantResult.rows[0];

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

      res.json({ ok: true, tenant });
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

// POST /api/auth/verify-password — kept for backward compat with backup app
router.post("/auth/verify-password", (req, res): void => {
  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) { res.status(503).json({ error: "Auth not configured" }); return; }
  if (typeof password !== "string" || password !== adminPassword) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  res.json({ ok: true });
});

export default router;
