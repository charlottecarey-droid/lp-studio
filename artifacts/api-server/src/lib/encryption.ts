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
 * Loss of `CREDENTIAL_ENCRYPTION_KEY` = inability to decrypt every stored
 * integration credential. Back it up out-of-band. Rotation is a future
 * capability — for v1 the key is static. NEVER log the key or secret values.
 */

const ALGO: CipherGCMTypes = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Master encryption key for stored credentials. 32 raw bytes, base64-encoded
 * in the env var. Generate with: `openssl rand -base64 32`.
 */
function getKey(): Buffer {
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

/** True when a value already carries the encrypted-envelope version prefix. */
function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}:`);
}

/**
 * Eagerly validate the encryption key at boot. Forces the same presence (prod),
 * base64-decode, and 32-byte length checks that `getKey()` runs lazily on first
 * encrypt/decrypt, so a missing or malformed key fails at startup instead of on
 * the first credential write. Throws on invalid configuration.
 */
export function assertEncryptionKeyValid(): void {
  getKey();
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
  const cipher = createCipheriv(ALGO, getKey(), iv);
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
 */
export function decryptCredential(value: string | null | undefined): string {
  if (value == null || value === "") return value ?? "";
  if (typeof value !== "string") {
    throw new Error("decryptCredential: input must be a string");
  }

  // Legacy plaintext path — return as-is.
  if (!isEncrypted(value)) return value;

  const envelope = Buffer.from(value.slice(VERSION.length + 1), "base64");
  if (envelope.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("decryptCredential: envelope too short");
  }

  const iv = envelope.subarray(0, IV_LENGTH);
  const authTag = envelope.subarray(envelope.length - AUTH_TAG_LENGTH);
  const ciphertext = envelope.subarray(IV_LENGTH, envelope.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Whitelist of which `config` keys are credentials per provider. Explicit list
 * so we never accidentally encrypt display labels or non-secret IDs.
 */
const CREDENTIAL_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  marketo: ["clientSecret"],
  salesforce: ["clientSecret"],
  google_sheets: ["privateKey"],
  asana: ["pat"],
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
