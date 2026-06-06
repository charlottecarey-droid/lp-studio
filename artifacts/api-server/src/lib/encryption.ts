import { randomBytes, createCipheriv, createDecipheriv, type CipherGCMTypes } from "node:crypto";

/**
 * Credential encryption at rest for `lp_integrations.config` (task #860).
 *
 * Standard AES-256-GCM authenticated encryption with a versioned envelope so
 * future migrations can identify what's been encrypted vs. what's still
 * plaintext, and so a future `v2:` can switch algorithm/key without ambiguity.
 *
 * Stored envelope format: `"v1:" + base64(iv ‖ ciphertext ‖ authTag)`.
 *
 * Key rotation (task #862) — two-key procedure:
 *   1. Generate a new key. Set `CREDENTIAL_ENCRYPTION_KEY` to the NEW key and
 *      `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` to the OLD key, then redeploy.
 *      Decrypt tries the active key first and transparently falls back to the
 *      previous key, so reads keep working while ciphertext is still under the
 *      old key.
 *   2. Run `scripts/rotate-encrypt-integrations.ts` to re-encrypt every stored
 *      credential under the active (new) key. Idempotent + re-runnable.
 *   3. Once the script reports zero remaining rows under the old key, remove
 *      `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` and redeploy.
 *
 * Because GCM is authenticated, decrypting with the wrong key throws (bad auth
 * tag), so the active→previous fallback never returns garbage. The envelope
 * carries no key id; which key encrypted a value is discovered by trying.
 *
 * Loss of BOTH keys = inability to decrypt every stored integration credential.
 * Back them up out-of-band. NEVER log a key or a secret value.
 */

const ALGO: CipherGCMTypes = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Active (master) encryption key for stored credentials. 32 raw bytes,
 * base64-encoded in the env var. Generate with: `openssl rand -base64 32`.
 * Used for ALL new encryption and tried first on decrypt.
 */
function getActiveKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CREDENTIAL_ENCRYPTION_KEY is required in production. " +
          "Generate with: openssl rand -base64 32",
      );
    }
    // Non-prod: use a deterministic dev key so test fixtures work. Logged loudly.
    console.warn(
      "[encryption] CREDENTIAL_ENCRYPTION_KEY not set — using dev fallback. " +
        "Never run this way in production.",
    );
    return Buffer.from("dev-key-not-for-production-use-32".padEnd(32, "0").slice(0, 32));
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (base64-encoded). Got ${key.length} bytes.`,
    );
  }
  return key;
}

/**
 * Previous encryption key, used DECRYPT-ONLY during a key rotation. Set
 * `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` to the old key while the active key holds
 * the new one; decrypt falls back to this when the active key fails. Returns
 * null when unset (the steady state outside a rotation window). Throws on a
 * malformed value so a typo in the previous key fails loudly at boot rather
 * than silently disabling the decrypt fallback.
 */
function getPreviousKey(): Buffer | null {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS must be 32 bytes (base64-encoded). Got ${key.length} bytes.`,
    );
  }
  return key;
}

/**
 * Decrypt a `v1:` envelope with a specific key. Throws on a bad auth tag (wrong
 * key) or malformed envelope. Internal helper for the active→previous fallback.
 */
function decryptEnvelopeWithKey(value: string, key: Buffer): string {
  const envelope = Buffer.from(value.slice(VERSION.length + 1), "base64");
  if (envelope.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("decryptCredential: envelope too short");
  }

  const iv = envelope.subarray(0, IV_LENGTH);
  const authTag = envelope.subarray(envelope.length - AUTH_TAG_LENGTH);
  const ciphertext = envelope.subarray(IV_LENGTH, envelope.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** True when a value already carries the encrypted-envelope version prefix. */
function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}:`);
}

/**
 * Eagerly validate the encryption key(s) at boot. Forces the same presence
 * (prod), base64-decode, and 32-byte length checks that `getActiveKey()` runs
 * lazily on first encrypt/decrypt, so a missing or malformed key fails at
 * startup instead of on the first credential write. Also validates the optional
 * previous (decrypt-only) rotation key when present, so a typo in it can't
 * silently disable the rotation decrypt fallback. Throws on invalid config.
 */
export function assertEncryptionKeyValid(): void {
  getActiveKey();
  getPreviousKey();
}

/**
 * Encrypt a credential string. Returns a versioned envelope:
 *   "v1:" + base64(iv || ciphertext || authTag)
 *
 * Empty strings round-trip as-is.
 */
export function encryptCredential(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encryptCredential: input must be a string");
  }
  if (plaintext === "") return ""; // empty strings round-trip as-is

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getActiveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope = Buffer.concat([iv, ciphertext, authTag]);
  return `${VERSION}:${envelope.toString("base64")}`;
}

/**
 * Decrypt a credential string. Accepts:
 *   - "v1:base64..." → decrypts via AES-256-GCM
 *   - bare string (no version prefix) → returned as-is (legacy plaintext, during migration)
 *   - "" / null / undefined → returned as ""
 *
 * The plaintext fallback lets the decrypt-on-read code ship BEFORE the backfill
 * migration runs, so partial rollouts don't break.
 *
 * During a key rotation the active key is tried first; if it fails (bad auth
 * tag → the value was encrypted under the OLD key) the previous key is tried.
 * Outside a rotation window (no previous key set) only the active key is used.
 */
export function decryptCredential(value: string | null | undefined): string {
  if (value == null || value === "") return value ?? "";
  if (typeof value !== "string") {
    throw new Error("decryptCredential: input must be a string");
  }

  // Legacy plaintext path — return as-is.
  if (!isEncrypted(value)) return value;

  try {
    return decryptEnvelopeWithKey(value, getActiveKey());
  } catch (activeErr) {
    const previous = getPreviousKey();
    if (previous) {
      try {
        return decryptEnvelopeWithKey(value, previous);
      } catch {
        // fall through to throw the active-key error below
      }
    }
    throw activeErr;
  }
}

/**
 * Whitelist of which `config` keys are credentials per provider. Explicit list
 * so we never accidentally encrypt display labels or non-secret IDs.
 */
const CREDENTIAL_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  marketo: ["clientSecret", "accessToken"],
  hubspot: ["accessToken"],
  salesforce: ["clientSecret"],
  slack: ["accessToken", "incomingWebhookUrl"],
  google_sheets: ["privateKey"],
  asana: ["pat"],
  webhook: ["signingSecret"],
  // Add new providers here as integrations ship.
};

export function isCredentialField(provider: string, fieldName: string): boolean {
  return (CREDENTIAL_FIELDS_BY_PROVIDER[provider] ?? []).includes(fieldName);
}

/**
 * Encrypt all credential fields within a config object. Returns a NEW object;
 * does not mutate the input. Non-credential fields are returned as-is. Values
 * that already carry the `v1:` prefix are left untouched — a second guard
 * against double-encryption (`v1:v1:…`) if an already-encrypted config is
 * re-persisted without going through the decrypt-on-read path.
 */
export function encryptConfigCredentials(
  provider: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const credentialFields = CREDENTIAL_FIELDS_BY_PROVIDER[provider] ?? [];
  const out: Record<string, unknown> = { ...config };
  for (const field of credentialFields) {
    const value = config[field];
    if (typeof value === "string" && value !== "" && !isEncrypted(value)) {
      out[field] = encryptCredential(value);
    }
  }
  return out;
}

/**
 * Decrypt all credential fields within a config object. Returns a NEW object;
 * does not mutate the input. Already-plaintext fields pass through unchanged
 * (legacy support during the backfill window).
 */
export function decryptConfigCredentials(
  provider: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const credentialFields = CREDENTIAL_FIELDS_BY_PROVIDER[provider] ?? [];
  const out: Record<string, unknown> = { ...config };
  for (const field of credentialFields) {
    const value = config[field];
    if (typeof value === "string" && value !== "") {
      out[field] = decryptCredential(value);
    }
  }
  return out;
}

/**
 * Re-encrypt a single credential under the ACTIVE key (key rotation, task #862).
 * Returns `{ value, rotated }`:
 *   - `rotated: false` (value unchanged) when the input is empty, plaintext, or
 *     already decryptable with the active key — i.e. nothing to do.
 *   - `rotated: true` with a fresh envelope when the value was decryptable only
 *     with the PREVIOUS key, so it gets re-wrapped under the active key.
 *
 * Throws if an encrypted value can't be decrypted by either key (so the rotation
 * script fails loudly on an undecryptable row instead of silently dropping it).
 *
 * Idempotent: once a value is under the active key, re-running is a no-op, so the
 * rotation script can be run repeatedly and resumed safely.
 */
export function rotateCredential(value: string | null | undefined): {
  value: string;
  rotated: boolean;
} {
  if (value == null || value === "") return { value: value ?? "", rotated: false };
  if (typeof value !== "string") {
    throw new Error("rotateCredential: input must be a string");
  }

  // Plaintext is out of scope for rotation (the backfill script handles that).
  if (!isEncrypted(value)) return { value, rotated: false };

  // Already under the active key → nothing to do (idempotent).
  try {
    decryptEnvelopeWithKey(value, getActiveKey());
    return { value, rotated: false };
  } catch {
    // Not under the active key; try the previous key below.
  }

  const previous = getPreviousKey();
  if (!previous) {
    throw new Error(
      "rotateCredential: value is not decryptable with the active key and no " +
        "CREDENTIAL_ENCRYPTION_KEY_PREVIOUS is set to decrypt it.",
    );
  }

  // Decryptable with the previous key → re-encrypt under the active key.
  const plaintext = decryptEnvelopeWithKey(value, previous);
  return { value: encryptCredential(plaintext), rotated: true };
}

/**
 * Re-encrypt every credential field in a config under the active key. Returns a
 * NEW object plus `rotated` = how many fields were actually re-wrapped (0 means
 * the whole config was already under the active key — used by the rotation
 * script to skip the DB write). Non-credential fields pass through unchanged.
 */
export function rotateConfigCredentials(
  provider: string,
  config: Record<string, unknown>,
): { config: Record<string, unknown>; rotated: number } {
  const credentialFields = CREDENTIAL_FIELDS_BY_PROVIDER[provider] ?? [];
  const out: Record<string, unknown> = { ...config };
  let rotated = 0;
  for (const field of credentialFields) {
    const value = config[field];
    if (typeof value === "string" && value !== "") {
      const result = rotateCredential(value);
      out[field] = result.value;
      if (result.rotated) rotated++;
    }
  }
  return { config: out, rotated };
}
