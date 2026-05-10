import type { Request, Response, NextFunction } from "express";
import { doubleCsrf } from "csrf-csrf";
import { SESSION_COOKIE } from "../middleware/requireAuth";

const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET) {
  throw new Error(
    "CSRF_SECRET is required at startup. Set it via the environment-secrets workflow.",
  );
}

const IS_PROD = process.env.NODE_ENV === "production";

// Paths that bypass CSRF entirely.
//
// - /api/webhooks/* are authenticated via per-tenant secrets (HMAC), not via
//   browser cookies, so there's nothing for an attacker to "forge" — and the
//   third-party callers (RB2B, Apollo, etc.) cannot send a CSRF token.
// - /api/_test/* are dev-only fixtures used by Playwright; they're hard-gated
//   on NODE_ENV !== "production" by app.ts and never registered in prod.
// - The auth endpoints listed below are *login* endpoints: at the moment they
//   are called there is, by definition, no authenticated session yet, so a
//   CSRF token bound to that (non-existent) session would be useless.
//   /api/auth/logout is intentionally NOT in this list — it is the canonical
//   CSRF target and must require a valid token.
const CSRF_EXEMPT_PREFIXES = ["/api/webhooks/", "/api/_test/"];
const CSRF_EXEMPT_EXACT = new Set([
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/password",
  "/api/auth/signup",
  "/api/auth/accept",
  "/api/auth/handoff-code",
  "/api/auth/verify-password",
]);

function isExemptPath(path: string): boolean {
  if (CSRF_EXEMPT_EXACT.has(path)) return true;
  for (const p of CSRF_EXEMPT_PREFIXES) {
    if (path.startsWith(p)) return true;
  }
  return false;
}

const csrf = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  // Bind the token to the active session so a token issued for one user can't
  // be replayed by another. Anonymous visitors share a stable bucket — they
  // hit only public endpoints (which are exempted below by the no-cookie
  // skip), so the shared identifier is harmless.
  getSessionIdentifier: (req) =>
    (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? "anonymous",
  cookieName: "lp_csrf",
  cookieOptions: {
    sameSite: "strict",
    secure: IS_PROD,
    httpOnly: true,
    path: "/",
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"],
  skipCsrfProtection: (req) => {
    if (isExemptPath(req.path)) return true;
    // No session cookie ⇒ no ambient credentials for the browser to forge with,
    // so there's no CSRF risk on this request. This naturally exempts every
    // public lp/sales endpoint (form submissions, tracking, public token
    // resolution, etc.) without us having to enumerate them.
    if (!req.cookies?.[SESSION_COOKIE]) return true;
    return false;
  },
});

export const csrfProtection = csrf.doubleCsrfProtection;
export const generateCsrfToken = csrf.generateCsrfToken;
export const invalidCsrfTokenError = csrf.invalidCsrfTokenError;

/** True if `err` was thrown by the csrf-csrf middleware. */
export function isCsrfError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  return e.code === "EBADCSRFTOKEN" ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("csrf"));
}

/** Express error handler that maps CSRF failures to a clean 403. */
export function csrfErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isCsrfError(err)) {
    if (!res.headersSent) {
      res.status(403).json({ error: "Invalid or missing CSRF token" });
    }
    return;
  }
  next(err);
}
