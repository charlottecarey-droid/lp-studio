/**
 * "Connect Google" for a team member (read-only calendar events + Docs).
 *
 *   GET    /lp/google/status      is it set up, and is this member connected
 *   GET    /lp/google/auth-url    the consent URL to send the browser to
 *   GET    /lp/google/callback    PUBLIC: Google redirects here; who is
 *                                 connecting comes from the signed state
 *   DELETE /lp/google/connection  disconnect (rooms reading through it stop)
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, lpGoogleConnectionsTable, lpRoomSettingsTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { encryptCredential } from "../../lib/encryption";
import { getRequestHost } from "../../lib/requestHost";
import {
  REQUIRED_SCOPES,
  exchangeGoogleCode,
  forgetGoogleAccessToken,
  googleConsentUrl,
  googleWorkspaceConfigured,
  revokeGoogleToken,
  safeReturnPath,
  signConnectState,
  verifyConnectState,
} from "../../lib/googleWorkspace";

const router: IRouter = Router();

const mine = (tenantId: number, userId: number) => and(eq(lpGoogleConnectionsTable.tenantId, tenantId), eq(lpGoogleConnectionsTable.userId, userId));

router.get("/lp/google/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const userId = req.authUser?.userId;
    const [row] = userId ? await db.select().from(lpGoogleConnectionsTable).where(mine(tenantId, userId)).limit(1) : [];
    res.json({ configured: googleWorkspaceConfigured(), connection: row ? { id: row.id, googleEmail: row.googleEmail, status: row.status, lastError: row.lastError } : null });
  } catch (err) {
    req.log.error({ err }, "google status failed");
    res.status(500).json({ error: "Could not check the Google connection" });
  }
});

router.get("/lp/google/auth-url", (req: Request, res: Response): void => {
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Sign in first" });
    return;
  }
  if (!googleWorkspaceConfigured()) {
    res.status(503).json({ error: "Google isn't set up on this server." });
    return;
  }
  const host = getRequestHost(req);
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const returnTo = `${local ? "http" : "https"}://${host}${safeReturnPath(req.query.returnTo)}`;
  res.json({ url: googleConsentUrl(signConnectState({ tenantId, userId: user.userId, email: user.email.toLowerCase(), returnTo })) });
});

/** Send the browser back to where the member started, with the outcome in the query string. */
function back(res: Response, returnTo: string, outcome: string): void {
  const u = new URL(returnTo);
  u.searchParams.set("google", outcome);
  res.redirect(302, u.toString());
}

router.get("/lp/google/callback", async (req: Request, res: Response): Promise<void> => {
  const state = verifyConnectState(req.query.state);
  if (!state) {
    res.status(400).send("This Google connection link is invalid or has expired. Go back to LP Studio and choose Connect Google again.");
    return;
  }
  try {
    if (typeof req.query.error === "string" || typeof req.query.code !== "string") return back(res, state.returnTo, "declined");
    const tokens = await exchangeGoogleCode(req.query.code);
    if (!tokens.ok) {
      req.log.warn({ error: tokens.error }, "google code exchange failed");
      return back(res, state.returnTo, "failed");
    }
    // The consent screen lets a member untick a permission; without both, the room can't read anything useful.
    if (!REQUIRED_SCOPES.every((s) => tokens.scopes.includes(s))) return back(res, state.returnTo, "missing_access");
    if (!tokens.refreshToken) return back(res, state.returnTo, "failed");
    const values = { googleEmail: tokens.googleEmail || state.email, refreshToken: encryptCredential(tokens.refreshToken), scopes: tokens.scopes.join(" "), status: "connected", lastError: null, userEmail: state.email, updatedAt: new Date() };
    const [row] = await db
      .insert(lpGoogleConnectionsTable)
      .values({ tenantId: state.tenantId, userId: state.userId, ...values })
      .onConflictDoUpdate({ target: [lpGoogleConnectionsTable.tenantId, lpGoogleConnectionsTable.userId], set: values })
      .returning({ id: lpGoogleConnectionsTable.id });
    if (row) forgetGoogleAccessToken(row.id);
    back(res, state.returnTo, "connected");
  } catch (err) {
    req.log.error({ err }, "google connect callback failed");
    back(res, state.returnTo, "failed");
  }
});

router.delete("/lp/google/connection", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const userId = req.authUser?.userId;
    const [row] = userId ? await db.select().from(lpGoogleConnectionsTable).where(mine(tenantId, userId)).limit(1) : [];
    if (!row) {
      res.json({ ok: true });
      return;
    }
    await revokeGoogleToken(row.refreshToken);
    // Rooms that were reading through this connection stop reading; the meetings already in them stay.
    await db.update(lpRoomSettingsTable).set({ calendarConnectionId: null, calendarId: null, calendarSyncNote: "The Google connection this room used was disconnected." }).where(and(eq(lpRoomSettingsTable.tenantId, tenantId), eq(lpRoomSettingsTable.calendarConnectionId, row.id)));
    await db.delete(lpGoogleConnectionsTable).where(eq(lpGoogleConnectionsTable.id, row.id));
    forgetGoogleAccessToken(row.id);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "google disconnect failed");
    res.status(500).json({ error: "Could not disconnect Google" });
  }
});

export default router;
