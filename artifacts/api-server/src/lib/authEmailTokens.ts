import crypto from "crypto";
import { pool } from "@workspace/db";

export type EmailTokenPurpose = "magic_link" | "password_reset" | "email_verify";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface MintTokenOptions {
  userId: number;
  purpose: EmailTokenPurpose;
  ttlMs: number;
  targetHost?: string | null;
  nextPath?: string | null;
}

/**
 * Mint a single-use email token. Returns the RAW token (goes in the email
 * link); only its SHA-256 hash is persisted. Caller chooses the TTL per flow.
 */
export async function mintEmailToken(opts: MintTokenOptions): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + opts.ttlMs);
  await pool.query(
    `INSERT INTO auth_email_tokens (token_hash, user_id, purpose, expires_at, target_host, next_path)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tokenHash, opts.userId, opts.purpose, expiresAt, opts.targetHost ?? null, opts.nextPath ?? null],
  );
  return raw;
}

export interface RedeemedToken {
  userId: number;
  targetHost: string | null;
  nextPath: string | null;
}

/**
 * Atomically redeem a token for the given purpose. The single `UPDATE … WHERE
 * used_at IS NULL AND expires_at > now() RETURNING` guarantees single use even
 * under concurrent requests — a second redemption finds no matching unused row.
 * Returns null for unknown / expired / already-used / wrong-purpose tokens.
 */
export async function redeemEmailToken(
  raw: string,
  purpose: EmailTokenPurpose,
): Promise<RedeemedToken | null> {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const tokenHash = hashToken(raw);
  const result = await pool.query(
    `UPDATE auth_email_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND purpose = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id, target_host, next_path`,
    [tokenHash, purpose],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { userId: row.user_id, targetHost: row.target_host ?? null, nextPath: row.next_path ?? null };
}

/**
 * Invalidate all outstanding tokens of a purpose for a user. Called before
 * minting a fresh one (so a user only ever has one live reset/verify link) and
 * after a password reset (so any other pending reset links are voided).
 */
export async function invalidateUserTokens(userId: number, purpose: EmailTokenPurpose): Promise<void> {
  await pool.query(
    `UPDATE auth_email_tokens SET used_at = now()
      WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose],
  );
}
