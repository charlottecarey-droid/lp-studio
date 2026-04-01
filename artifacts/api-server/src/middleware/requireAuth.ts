import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

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
    req.authUser = JSON.parse(result.rows[0].sess) as AuthUser;
    next();
  } catch (err) {
    console.error("[requireAuth] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (user.isAdmin || user.permissions[permission]) { next(); return; }
    res.status(403).json({ error: "Permission denied" });
  };
}
