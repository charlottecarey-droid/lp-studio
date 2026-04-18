import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { findTenantByHost } from "../lib/tenantHosts";

export const SESSION_COOKIE = "lp_sid";

export interface AuthUser {
  userId: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
  tenantId: number | null;
  role: string;
  permissions: Record<string, boolean>;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const user = JSON.parse(result.rows[0].sess) as AuthUser;
    req.authUser = user;

    // Host enforcement: if the request arrives via a host that maps to a
    // tenant (custom domain, microsite, or wildcard subdomain), the session's
    // tenant MUST match. Hosts that don't map to any tenant (the canonical
    // app URL, Replit dev domain, localhost) are exempt.
    const hostHeader = (req.headers["x-forwarded-host"] as string) || (req.headers.host as string) || "";
    const host = hostHeader.split(":")[0].toLowerCase();
    if (host) {
      try {
        const match = await findTenantByHost(host);
        if (match && user.tenantId != null && match.tenantId !== user.tenantId) {
          res.status(403).json({ error: "Session does not belong to this domain's tenant" });
          return;
        }
      } catch (err) {
        // Fail-CLOSED on resolver errors. Failing open here would let a session
        // from one tenant access another tenant's domain during a DB blip.
        console.error("[requireAuth] host resolver error:", err);
        res.status(503).json({ error: "Domain check temporarily unavailable" });
        return;
      }
    }

    next();
  } catch (err) {
    console.error("[requireAuth] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * Safely extract tenantId from the authenticated user.
 * Returns null and sends 403 if no tenant is associated.
 */
export function getTenantId(req: Request, res: Response): number | null {
  const tenantId = req.authUser?.tenantId;
  if (tenantId == null) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return null;
  }
  return tenantId;
}

/**
 * Middleware that requires tenantId to be present.
 * Throws 403 if user is not authenticated or has no tenant.
 * Use in routes that must have a valid tenant context.
 */
export function requireTenantId(req: Request, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.tenantId == null) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return;
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (user.isAdmin || user.permissions[permission]) { next(); return; }
    res.status(403).json({ error: "Permission denied" });
  };
}
