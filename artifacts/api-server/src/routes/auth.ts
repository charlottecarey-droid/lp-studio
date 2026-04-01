import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { pool } from "@workspace/db";
import crypto from "crypto";

const router = Router();

export const SESSION_COOKIE = "lp_sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/api/auth/google/callback`;
  return `http://localhost:${process.env.PORT ?? 8080}/api/auth/google/callback`;
}

function getOAuthClient(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new OAuth2Client(clientId, clientSecret, getRedirectUri());
}

// GET /api/auth/google — initiates Google OAuth flow
router.get("/auth/google", (req, res): void => {
  const client = getOAuthClient();
  if (!client) {
    res.status(503).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    return;
  }
  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
  res.redirect(url);
});

// GET /api/auth/google/callback — handles OAuth callback from Google
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const client = getOAuthClient();
  if (!client) {
    res.redirect("/?error=oauth_not_configured");
    return;
  }

  const { code, error: oauthError } = req.query as { code?: string; error?: string };
  if (oauthError || !code) {
    res.redirect(`/?error=${encodeURIComponent(oauthError ?? "oauth_failed")}`);
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
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

    // Check tenant membership (by user_id or pre-invite email)
    const memberResult = await pool.query(
      `SELECT tm.id as member_id, tm.tenant_id, tm.user_id, tm.role_id,
              tr.name as role_name, tr.permissions, tr.is_admin
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       WHERE (tm.user_id = $1 OR (tm.user_id IS NULL AND tm.email = $2))
         AND tm.accepted_at IS NOT NULL
       ORDER BY tm.user_id NULLS LAST
       LIMIT 1`,
      [user.id, email]
    );

    // If found by email-only pre-invite, link the user_id now
    if (memberResult.rows.length > 0 && memberResult.rows[0].user_id === null) {
      await pool.query(
        `UPDATE tenant_members SET user_id = $1 WHERE id = $2`,
        [user.id, memberResult.rows[0].member_id]
      );
    }

    let tenantId: number | null = user.tenant_id ?? null;
    let role = "viewer";
    let permissions: Record<string, boolean> = {};
    let isAdmin = false;

    if (memberResult.rows.length > 0) {
      const member = memberResult.rows[0];
      tenantId = member.tenant_id;
      role = member.role_name;
      permissions = (member.permissions as Record<string, boolean>) ?? {};
      isAdmin = member.is_admin ?? false;

      if (!user.tenant_id) {
        await pool.query(
          `UPDATE app_users SET tenant_id = $1 WHERE id = $2`,
          [tenantId, user.id]
        );
      }
    }

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

    res.redirect("/");
  } catch (err) {
    console.error("[auth] OAuth callback error:", err);
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
    res.json(JSON.parse(result.rows[0].sess));
  } catch (err) {
    console.error("[auth] /me error:", err);
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
