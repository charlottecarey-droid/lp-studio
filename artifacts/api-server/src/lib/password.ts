import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

// OWASP-recommended scrypt parameters (N=2^14, r=8, p=1). 128 * N * r ≈ 16 MB
// of memory per hash, which sits under Node's default 32 MB scrypt cap.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;
const SCRYPT_OPTS: crypto.ScryptOptions = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 };

/**
 * Produce a self-describing password hash string:
 *   `scrypt$<N>$<r>$<p>$<salt-hex>$<key-hex>`
 * Embedding the parameters lets us tune them later without breaking old hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, SCRYPT_OPTS);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Constant-time verify against a stored `hashPassword()` string. Returns false
 * (never throws) for any malformed/legacy/empty stored value so callers can
 * treat "no usable credential" and "wrong password" identically.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = Number.parseInt(parts[1], 10);
    const r = Number.parseInt(parts[2], 10);
    const p = Number.parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || expected.length === 0) return false;
    const key = await scryptAsync(password, salt, expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/**
 * Minimum password policy shared by register + reset. Kept deliberately simple
 * (length-based, OWASP-aligned) — length is the dominant strength factor.
 */
export function validatePasswordStrength(password: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof password !== "string") return { ok: false, error: "Password is required" };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  if (password.length > 200) return { ok: false, error: "Password is too long" };
  return { ok: true };
}
