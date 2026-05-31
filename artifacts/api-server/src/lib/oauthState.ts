import crypto from "crypto";
import { pool } from "@workspace/db";

/**
 * Server-stored single-use CSRF nonces for the OAuth login flows.
 *
 * The Google and GitHub callbacks previously trusted whatever `state` blob came
 * back from the provider — they base64url-decoded the origin host / redirect URI
 * / next path out of it but never bound it to anything WE generated. That let an
 * attacker forge (or replay) a `state` and drive a victim's browser into an
 * attacker-owned authenticated session (login CSRF).
 *
 * Now the initiation endpoints call `mintOAuthState` to generate a
 * cryptographically random nonce, persist the flow context server-side keyed by
 * that nonce, and put ONLY the opaque nonce in the provider's `state` param. The
 * callbacks call `redeemOAuthState` BEFORE any token exchange / session
 * creation: it atomically deletes-and-returns the row (`DELETE ... RETURNING`),
 * so a nonce is single-use and a concurrent replay can never redeem twice. A
 * missing, forged, replayed, expired, or wrong-provider nonce returns `null`,
 * and the callers fail closed (redirect to `/?error=invalid_state`).
 *
 * Because the flow context (host / redirect URI / next) now lives server-side
 * and is keyed by an unguessable nonce, an attacker can't tamper with it either
 * — a useful defense-in-depth bonus over the old self-describing state blob.
 */

export type OAuthProvider = "google" | "github";

export interface OAuthStatePayload {
  /** Origin host the flow was initiated from (custom/tenant/dev domain). */
  host: string;
  /** Exact redirect URI used at initiation, replayed at token exchange. */
  redirectUri: string;
  /** Sanitized same-origin relative path to resume after login, or null. */
  next: string | null;
}

// Nonces are short-lived: long enough for a human to complete the provider's
// consent screen, short enough to bound the replay/forgery window and table
// growth.
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Mint a single-use state nonce, persist the flow context, and return the
 * opaque nonce to embed in the provider `state` param. Sweeps expired rows
 * best-effort so the table never grows unbounded.
 */
export async function mintOAuthState(
  provider: OAuthProvider,
  payload: OAuthStatePayload,
): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  // Opportunistic cleanup of expired nonces (best-effort; never block a login
  // on it). Bounded by the expires index.
  await pool
    .query(`DELETE FROM oauth_login_states WHERE expires_at < now()`)
    .catch(() => {});
  await pool.query(
    `INSERT INTO oauth_login_states (state, provider, host, redirect_uri, next_path, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [state, provider, payload.host, payload.redirectUri, payload.next, expiresAt],
  );
  return state;
}

/**
 * Atomically redeem a state nonce for the flow context it was minted with.
 * Returns `null` for any missing / forged / replayed / expired / wrong-provider
 * nonce. The DELETE ... RETURNING guarantees single-use even under concurrent
 * replay (only one caller can win the delete).
 */
export async function redeemOAuthState(
  state: string | undefined | null,
  provider: OAuthProvider,
): Promise<OAuthStatePayload | null> {
  if (!state || typeof state !== "string") return null;
  const result = await pool.query<{
    host: string;
    redirect_uri: string;
    next_path: string | null;
  }>(
    `DELETE FROM oauth_login_states
      WHERE state = $1 AND provider = $2 AND expires_at > now()
      RETURNING host, redirect_uri, next_path`,
    [state, provider],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    host: row.host ?? "",
    redirectUri: row.redirect_uri ?? "",
    next: row.next_path ?? null,
  };
}
