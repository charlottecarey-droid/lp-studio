/**
 * "Connect Google": a team member grants LP Studio read-only access to their
 * calendar events and Google Docs, so a partner room can show their customer
 * meetings and draft minutes from the notes Gemini attaches to them.
 *
 * Uses the same Google client as sign-in (GOOGLE_CLIENT_ID / _SECRET) with its
 * own redirect URI, which must be on that client's allowlist:
 *   GOOGLE_WORKSPACE_REDIRECT_URI, or the sign-in URI with
 *   /api/auth/google/callback swapped for /api/lp/google/callback.
 *
 * The consent round trip can leave the tenant's host (the callback is pinned
 * to one host), so who is connecting travels in an HMAC-signed state rather
 * than the session cookie. Refresh tokens are stored encrypted; access tokens
 * live in memory only.
 */
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, lpGoogleConnectionsTable } from "@workspace/db";
import { decryptCredential } from "./encryption";
import { logger } from "./logger";

export const GOOGLE_WORKSPACE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events.readonly", "https://www.googleapis.com/auth/documents.readonly"];
/** The two a room cannot work without. */
export const REQUIRED_SCOPES = GOOGLE_WORKSPACE_SCOPES.slice(2);

/**
 * The Google client "Connect Google" uses. Its own client when
 * GOOGLE_WORKSPACE_CLIENT_ID / _SECRET are set (so the calendar and docs
 * permissions, which Google treats as sensitive, live on a separate consent
 * screen and can never affect sign-in); otherwise the sign-in client.
 */
function client(): { id: string; secret: string; source: "workspace" | "signin" } {
  const id = cleanSecretValue(process.env.GOOGLE_WORKSPACE_CLIENT_ID);
  const secret = cleanSecretValue(process.env.GOOGLE_WORKSPACE_CLIENT_SECRET);
  if (id && secret) return { id, secret, source: "workspace" };
  return { id: process.env.GOOGLE_CLIENT_ID ?? "", secret: process.env.GOOGLE_CLIENT_SECRET ?? "", source: "signin" };
}

/** A pasted secret with the stray space, line break or quote marks around it removed. */
export function cleanSecretValue(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

const CLIENT_ID_RE = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

/** What is wrong with a client ID, in words a person setting it up can act on; null when it looks right. */
export function clientIdProblem(id: string, name: string): string | null {
  if (CLIENT_ID_RE.test(id)) return null;
  if (!id) return `${name} is empty.`;
  if (/^GOCSPX-/i.test(id)) return `${name} holds a client SECRET (it starts with GOCSPX-). Put the Client ID there instead: it ends in .apps.googleusercontent.com.`;
  if (/^AIza/.test(id)) return `${name} holds an API key. It needs the OAuth Client ID, which ends in .apps.googleusercontent.com.`;
  if (/^\d+$/.test(id)) return `${name} holds a project number. It needs the OAuth Client ID, which ends in .apps.googleusercontent.com.`;
  if (/\s/.test(id)) return `${name} has a space or line break in the middle of it. Copy the Client ID again with Google's copy button.`;
  if (!id.endsWith(".apps.googleusercontent.com")) return `${name} doesn't look like a Google Client ID. It should end in .apps.googleusercontent.com (copy it from Google Cloud → APIs & Services → Credentials).`;
  return `${name} doesn't look like a Google Client ID. Copy it again with Google's copy button.`;
}

/**
 * How "Connect Google" is set up, for the person setting it up: which client
 * it will use, the redirect address that client must allow, the tail of the
 * client ID (to tell two clients apart; an ID is not a secret), and anything
 * visibly wrong before Google gets a chance to say "client not found".
 */
export function googleWorkspaceSetup(): { source: "workspace" | "signin"; redirectUri: string; clientIdTail: string; problem: string | null } {
  const c = client();
  const wsId = cleanSecretValue(process.env.GOOGLE_WORKSPACE_CLIENT_ID);
  const wsSecret = cleanSecretValue(process.env.GOOGLE_WORKSPACE_CLIENT_SECRET);
  let problem = clientIdProblem(c.id, c.source === "workspace" ? "GOOGLE_WORKSPACE_CLIENT_ID" : "GOOGLE_CLIENT_ID");
  if (!problem && c.source === "workspace" && !/^GOCSPX-/.test(c.secret) && CLIENT_ID_RE.test(c.secret)) problem = "GOOGLE_WORKSPACE_CLIENT_SECRET holds a Client ID. Put the Client secret there (it starts with GOCSPX-).";
  if (c.source === "signin" && (wsId || wsSecret)) problem = `Only ${wsId ? "GOOGLE_WORKSPACE_CLIENT_ID" : "GOOGLE_WORKSPACE_CLIENT_SECRET"} is set, so the sign-in client is being used. Add ${wsId ? "GOOGLE_WORKSPACE_CLIENT_SECRET" : "GOOGLE_WORKSPACE_CLIENT_ID"} too, then publish again.`;
  const head = c.id.split(".apps.googleusercontent.com")[0];
  return { source: c.source, redirectUri: googleWorkspaceRedirectUri(), clientIdTail: CLIENT_ID_RE.test(c.id) ? `…${head.slice(-6)}.apps.googleusercontent.com` : "", problem };
}

export function googleWorkspaceConfigured(): boolean {
  const c = client();
  return !!c.id && !!c.secret;
}

export function googleWorkspaceRedirectUri(): string {
  if (process.env.GOOGLE_WORKSPACE_REDIRECT_URI) return process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
  const signIn = process.env.GOOGLE_REDIRECT_URI;
  if (signIn && signIn.endsWith("/api/auth/google/callback")) return signIn.replace(/\/api\/auth\/google\/callback$/, "/api/lp/google/callback");
  const dev = process.env.REPLIT_DEV_DOMAIN;
  return dev ? `https://${dev}/api/lp/google/callback` : `http://localhost:${process.env.PORT ?? 8080}/api/lp/google/callback`;
}

/* ── Signed state ────────────────────────────────────────────────────────── */

const STATE_TTL_MS = 10 * 60 * 1000;
let devSecret: string | null = null;
function stateKey(): string {
  const k = process.env.WORKER_HOST_SECRET;
  if (k) return k;
  devSecret ??= crypto.randomBytes(32).toString("hex");
  return devSecret;
}

export interface ConnectState {
  tenantId: number;
  userId: number;
  email: string;
  /** Where to send the browser afterwards: an absolute URL on the host the member started from. */
  returnTo: string;
}

export function signConnectState(s: ConnectState, now: number = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...s, ts: now, p: "gws" })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", stateKey()).update(body).digest("base64url")}`;
}

export function verifyConnectState(state: unknown, now: number = Date.now()): ConnectState | null {
  if (typeof state !== "string") return null;
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const a = Buffer.from(state.slice(dot + 1));
  const b = Buffer.from(crypto.createHmac("sha256", stateKey()).update(body).digest("base64url"));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (p.p !== "gws" || typeof p.ts !== "number" || now - p.ts > STATE_TTL_MS || now < p.ts - 60_000) return null;
    if (typeof p.tenantId !== "number" || typeof p.userId !== "number" || typeof p.email !== "string" || typeof p.returnTo !== "string") return null;
    return { tenantId: p.tenantId, userId: p.userId, email: p.email, returnTo: p.returnTo };
  } catch {
    return null;
  }
}

/** A same-site path to come back to: must start with one "/" and hold no scheme, host or backslash. */
export function safeReturnPath(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  return /^\/(?![/\\])[^\\\s]{0,500}$/.test(v) ? v : "/";
}

export function googleConsentUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: client().id,
    redirect_uri: googleWorkspaceRedirectUri(),
    response_type: "code",
    scope: GOOGLE_WORKSPACE_SCOPES.join(" "),
    access_type: "offline",
    // Always ask, so Google returns a refresh token even when the member connected before.
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

/* ── Talking to Google ───────────────────────────────────────────────────── */

async function tokenRequest(params: Record<string, string>): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client().id, client_secret: client().secret, ...params }).toString(),
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: resp.ok, status: resp.status, json };
}

const emailFromIdToken = (idToken: unknown): string => {
  // Read straight from Google's token endpoint over TLS in this same request, so the payload needs no signature check.
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  } catch {
    return "";
  }
};

/** Trade the consent code for tokens. `refreshToken` is empty when Google didn't issue one. */
export async function exchangeGoogleCode(code: string): Promise<{ ok: true; refreshToken: string; scopes: string[]; googleEmail: string } | { ok: false; error: string }> {
  const r = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleWorkspaceRedirectUri() });
  if (!r.ok) return { ok: false, error: String(r.json.error_description ?? r.json.error ?? `Google returned ${r.status}`) };
  return { ok: true, refreshToken: typeof r.json.refresh_token === "string" ? r.json.refresh_token : "", scopes: String(r.json.scope ?? "").split(/\s+/).filter(Boolean), googleEmail: emailFromIdToken(r.json.id_token) };
}

const accessCache = new Map<number, { token: string; expiresAt: number }>();

/** A fresh access token for a connection; null when the member's grant no longer works (the row is then marked revoked). */
export async function googleAccessToken(connectionId: number): Promise<string | null> {
  const cached = accessCache.get(connectionId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const [row] = await db.select().from(lpGoogleConnectionsTable).where(eq(lpGoogleConnectionsTable.id, connectionId)).limit(1);
  if (!row || row.status !== "connected") return null;
  const r = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptCredential(row.refreshToken) });
  if (!r.ok || typeof r.json.access_token !== "string") {
    // invalid_grant = the member removed access or the token expired; anything else may be temporary.
    if (r.json.error === "invalid_grant") {
      await db.update(lpGoogleConnectionsTable).set({ status: "revoked", lastError: "Google access was removed or expired. Connect Google again.", updatedAt: new Date() }).where(eq(lpGoogleConnectionsTable.id, connectionId));
    }
    logger.warn({ connectionId, status: r.status, error: r.json.error }, "google access token refresh failed");
    return null;
  }
  const ttl = typeof r.json.expires_in === "number" ? r.json.expires_in : 3000;
  accessCache.set(connectionId, { token: r.json.access_token, expiresAt: Date.now() + ttl * 1000 });
  return r.json.access_token;
}

export interface GoogleResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/** GET a Google API URL as the connection's member. `status` 401 with ok:false when the connection no longer works. */
export async function googleGet(connectionId: number, url: string): Promise<GoogleResponse> {
  if (!/^https:\/\/(www|docs)\.googleapis\.com\//.test(url)) throw new Error("googleGet: not a Google API URL");
  const token = await googleAccessToken(connectionId);
  if (!token) return { ok: false, status: 401, json: async () => ({}), text: async () => "connection not usable" };
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

/** Best effort: tell Google to forget the grant. */
export async function revokeGoogleToken(encryptedRefreshToken: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: decryptCredential(encryptedRefreshToken) }).toString() });
  } catch (err) {
    logger.warn({ err }, "google token revoke failed");
  }
}

export function forgetGoogleAccessToken(connectionId: number): void {
  accessCache.delete(connectionId);
}
