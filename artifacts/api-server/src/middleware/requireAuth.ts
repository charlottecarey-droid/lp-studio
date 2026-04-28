import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { findTenantByHost } from "../lib/tenantHosts";
import { getRequestHost } from "../lib/requestHost";

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
  /**
   * Global app_users.role — distinct from per-tenant `role`. A value of
   * "superadmin" identifies a Dandy operator who is allowed to act across
   * tenants (e.g. via the X-Tenant-Id override on getTenantId). Optional for
   * backward compatibility with sessions issued before this field existed.
   */
  appUserRole?: string | null;
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
    // Backfill appUserRole for sessions issued before task #108 added the
    // field. Without this, getTenantId's X-Tenant-Id cross-tenant override
    // would silently no-op for superadmins still riding an old session.
    if (user.appUserRole === undefined) {
      try {
        const r = await pool.query(
          `SELECT role FROM app_users WHERE id = $1`,
          [user.userId],
        );
        user.appUserRole = r.rows[0]?.role ?? null;
      } catch {
        user.appUserRole = null;
      }
    }
    req.authUser = user;

    // Host enforcement: if the request arrives via a host that maps to a
    // tenant (custom domain, microsite, or wildcard subdomain), the session's
    // tenant MUST match. Hosts that don't map to any tenant (the canonical
    // app URL, Replit dev domain, localhost) are exempt.
    //
    // Superadmins (isAdmin=true) are exempt from this check: they need to be
    // able to use the cross-tenant Switch Tenant tool (and access /superadmin
    // endpoints) from any domain. Tenant data isolation for normal users is
    // still enforced via getTenantId() / req.authUser.tenantId in each route.
    if (!user.isAdmin) {
      const host = getRequestHost(req);
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
 *
 * Cross-tenant override (task #108): a Dandy operator (app_users.role='superadmin')
 * may pass an `X-Tenant-Id` header to act on a tenant they're not a member of.
 * The header is honoured ONLY when `req.authUser.appUserRole === 'superadmin'`;
 * for everyone else it is silently ignored so a regular user cannot escape
 * their tenant scope by setting the header.
 */
export function getTenantId(req: Request, res: Response): number | null {
  const user = req.authUser;
  if (user?.appUserRole === "superadmin") {
    const raw = req.header("x-tenant-id");
    if (raw) {
      const overrideId = Number.parseInt(raw, 10);
      if (Number.isFinite(overrideId) && overrideId > 0) {
        return overrideId;
      }
    }
  }
  const tenantId = user?.tenantId;
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

export function requireAnyPermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (user.isAdmin || permissions.some(p => user.permissions[p])) { next(); return; }
    res.status(403).json({ error: "Permission denied" });
  };
}
