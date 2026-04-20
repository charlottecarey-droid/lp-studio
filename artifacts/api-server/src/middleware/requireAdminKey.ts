import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

/**
 * Express middleware that gates a route on the `x-admin-key` header matching
 * the ADMIN_PASSWORD environment variable. Used by superadmin endpoints.
 *
 * If ADMIN_PASSWORD is not configured the route is treated as locked down
 * (401), never open.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const keyBuf = Buffer.from((key ? String(key) : "").padEnd(64, "\0"));
  const envBuf = Buffer.from(process.env.ADMIN_PASSWORD.padEnd(64, "\0"));
  let ok = false;
  try { ok = timingSafeEqual(keyBuf, envBuf); } catch { ok = false; }
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
