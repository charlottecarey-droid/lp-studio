import type { Request } from "express";
import type { AuthUser } from "./requireAuth";

/**
 * Identity for requests the API server dispatches to itself (the Claude
 * connector's tools call the same routes the app uses, as the rep who
 * approved the connection; see lib/mcp/dispatch.ts).
 *
 * Keyed by the request object in a WeakMap, so it can only be attached
 * in-process: nothing a network client sends (headers, cookies, body) can
 * set it. `requireAuth` / `optionalAuth` honour it before looking for a
 * session cookie.
 */
const internalUsers = new WeakMap<object, AuthUser>();

export function setInternalAuthUser(req: object, user: AuthUser): void {
  internalUsers.set(req, user);
}

export function getInternalAuthUser(req: Request): AuthUser | undefined {
  return internalUsers.get(req);
}
