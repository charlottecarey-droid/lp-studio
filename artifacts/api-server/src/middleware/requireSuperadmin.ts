import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "./requireAuth";
import { isRootSuperadminEmail } from "../lib/rootSuperadmin";

/**
 * Express middleware that gates a route on the authenticated session user
 * having `app_users.role = 'superadmin'`. This is the sole gating mechanism
 * for all SuperAdmin platform routes — identity-based, not shared-secret.
 *
 * Reads the session inline (does not depend on `requireAuth` having run).
 * Backfills `appUserRole` from `app_users.role` for sessions issued before
 * that field existed.
 */
export async function requireSuperadmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sid = (req as any).cookies?.[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  let user: AuthUser | null = null;
  try {
    const sres = await pool.query(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid],
    );
    if (sres.rows.length) user = JSON.parse(sres.rows[0].sess) as AuthUser;
  } catch {
    user = null;
  }
  if (!user) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  // The configured root superadmin is identified purely by email (case- and
  // whitespace-insensitive), so it always passes this gate even if the
  // app_users row it logged into never received the seeded 'superadmin' role
  // (e.g. an OAuth email-casing mismatch created a separate row).
  if (isRootSuperadminEmail(user.email)) {
    user.appUserRole = "superadmin";
  }
  // Re-read the role from app_users on every request when the cached
  // session value is missing OR not "superadmin". This handles the
  // promote-after-login case (user was just granted the role in the DB
  // but their session still has the old value) without forcing them to
  // sign back in. Demotion is intentionally not handled here — a removed
  // role becomes effective on next login, which is fine for the very
  // small operator population this gates.
  if (user.appUserRole !== "superadmin") {
    try {
      const r = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [user.userId]);
      user.appUserRole = r.rows[0]?.role ?? null;
    } catch {
      user.appUserRole = null;
    }
  }
  if (user.appUserRole !== "superadmin") {
    res.status(403).json({ error: "Superadmin role required" });
    return;
  }
  (req as any).authUser = user;
  next();
}
