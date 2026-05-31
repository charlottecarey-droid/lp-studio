import crypto from "node:crypto";
import { pool } from "@workspace/db";

// Persistence + hashing helpers for the trial phone gate (Task #637). Pairs
// with `twilioVerify.ts` (the Twilio calls) and is consumed by the auth routes.
//
// Only SHA-256 hashes of the normalized E.164 number are ever stored — the raw
// number is used transiently to send/check the SMS and then discarded.

// How long a minted "phone verified" token stays redeemable. Long enough for a
// user to fill in workspace name + slug after verifying, short enough to limit
// replay. Single-use regardless of TTL.
export const PHONE_VERIFIED_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Minimal executor shape so callers can run helpers either on the shared pool
// or inside a signup transaction's PoolClient (so the redeem + record happen
// atomically with the tenant INSERT).
interface Querier {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** SHA-256 hex of an E.164 number — the stable key for trial gating. */
export function hashPhone(e164: string): string {
  return sha256Hex(e164);
}

/**
 * Strict E.164 validator. Twilio Lookup canonicalizes numbers server-side; this
 * only guards the value the client echoes back (so we hash exactly the form we
 * sent the code to) — it is NOT a parser.
 */
export function isValidE164(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

/**
 * Best-effort normalization of an operator-typed phone number to the strict
 * E.164 form the gate hashes, for the superadmin lookup box only. Strips common
 * formatting (spaces, dashes, dots, parentheses) and accepts a `00` IDD prefix
 * in place of `+`. Returns the E.164 string when the cleaned value is valid,
 * else null.
 *
 * The signup gate canonicalizes via Twilio Lookup (which can infer a country
 * code from a national number); here the operator already knows the full number
 * and includes the country code, so a Twilio round-trip per lookup is avoided.
 * The raw input is used only transiently to produce a hash — never persisted.
 */
export function normalizeE164Input(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[\s().\-]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  return isValidE164(s) ? s : null;
}

/**
 * Mint a single-use, short-lived token proving `userId` controls `phoneE164`.
 * Returns the raw token (the only place it ever exists in cleartext); only its
 * hash is stored. Any earlier un-redeemed token for the user is invalidated so
 * a user can't stockpile tokens for multiple numbers.
 */
export async function mintPhoneVerifiedToken(opts: {
  userId: number;
  phoneE164: string;
  ttlMs?: number;
}): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(raw);
  const phoneHash = hashPhone(opts.phoneE164);
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? PHONE_VERIFIED_TTL_MS));
  await pool.query(
    `UPDATE trial_phone_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [opts.userId],
  );
  await pool.query(
    `INSERT INTO trial_phone_tokens (token_hash, user_id, phone_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenHash, opts.userId, phoneHash, expiresAt],
  );
  return raw;
}

/**
 * Atomically redeem a phone-verified token bound to `userId`. Single-use: the
 * UPDATE only matches an un-redeemed, unexpired row and stamps `used_at` in the
 * same statement, so a double-submit can't redeem twice. Returns the verified
 * number's hash, or null when the token is missing/expired/used/foreign.
 *
 * Pass the signup transaction's client as `q` so redemption commits/rolls back
 * together with the tenant INSERT.
 */
export async function redeemPhoneVerifiedToken(
  q: Querier,
  raw: unknown,
  userId: number,
): Promise<{ phoneHash: string } | null> {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const tokenHash = sha256Hex(raw);
  const result = await q.query(
    `UPDATE trial_phone_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND user_id = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING phone_hash`,
    [tokenHash, userId],
  );
  const row = result.rows[0] as { phone_hash?: string } | undefined;
  if (!row?.phone_hash) return null;
  return { phoneHash: row.phone_hash };
}

/** True when this phone number has already consumed a free trial. */
export async function hasPhoneTrialed(q: Querier, phoneHash: string): Promise<boolean> {
  const result = await q.query(
    `SELECT 1 FROM trial_phone_numbers WHERE phone_hash = $1`,
    [phoneHash],
  );
  return result.rows.length > 0;
}

/**
 * Record that this phone number has consumed its one free trial. Idempotent
 * under the primary key so a retry can't error or double-insert.
 */
export async function recordPhoneTrial(
  q: Querier,
  phoneHash: string,
  tenantId: number,
): Promise<void> {
  await q.query(
    `INSERT INTO trial_phone_numbers (phone_hash, tenant_id)
     VALUES ($1, $2)
     ON CONFLICT (phone_hash) DO NOTHING`,
    [phoneHash, tenantId],
  );
}
