import type { Request, Response, NextFunction } from "express";
import { isRootSuperadminEmail } from "../lib/rootSuperadmin";

/**
 * Express middleware that gates a route on the authenticated session user being
 * the ROOT superadmin. MUST run AFTER `requireSuperadmin`, which performs the
 * session lookup, re-reads the role from app_users, and populates
 * `req.authUser`. This middleware only adds the root-email check on top, so a
 * non-root superadmin is rejected with 403 even though they hold the
 * superadmin role.
 *
 * Used to gate the superadmin-roster management routes (list / add / remove
 * superadmins), which only the single bootstrap "root" account may touch.
 */
export function requireRootSuperadmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authUser = (req as any).authUser as { email?: string } | undefined;
  if (!authUser || !isRootSuperadminEmail(authUser.email)) {
    res.status(403).json({ error: "Root superadmin role required" });
    return;
  }
  next();
}
