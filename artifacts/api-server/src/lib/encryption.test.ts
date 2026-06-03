import { describe, it, expect } from "vitest";
import {
  encryptCredential,
  decryptCredential,
  encryptConfigCredentials,
  decryptConfigCredentials,
  isCredentialField,
  assertEncryptionKeyValid,
  rotateCredential,
  rotateConfigCredentials,
} from "./encryption";

// Two random 32-byte keys, base64-encoded, for exercising key rotation.
const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

/** Run `fn` with the given active/previous key env, restoring env after. */
function withKeys(
  active: string | undefined,
  previous: string | undefined,
  fn: () => void,
): void {
  const savedActive = process.env.CREDENTIAL_ENCRYPTION_KEY;
  const savedPrev = process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS;
  try {
    if (active === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = active;
    if (previous === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS;
    else process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS = previous;
    fn();
  } finally {
    if (savedActive === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = savedActive;
    if (savedPrev === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS;
    else process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS = savedPrev;
  }
}

describe("encryption", () => {
  it("round-trips a string", () => {
    const original = "super-secret-marketo-client-secret-abc123";
    const encrypted = encryptCredential(original);
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(original);
    expect(decryptCredential(encrypted)).toBe(original);
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const a = encryptCredential("hello");
    const b = encryptCredential("hello");
    expect(a).not.toBe(b);
    expect(decryptCredential(a)).toBe("hello");
    expect(decryptCredential(b)).toBe("hello");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptCredential("hello");
    const tampered = encrypted.slice(0, -4) + "XXXX";
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it("passes through plaintext (legacy) values unchanged", () => {
    expect(decryptCredential("not-a-v1-prefix")).toBe("not-a-v1-prefix");
    expect(decryptCredential("")).toBe("");
    expect(decryptCredential(null)).toBe("");
    expect(decryptCredential(undefined)).toBe("");
  });

  it("round-trips empty strings as-is (no envelope)", () => {
    expect(encryptCredential("")).toBe("");
  });

  it("encrypts only credential fields in a marketo config", () => {
    const config = {
      munchkinId: "123-ABC-456",
      clientId: "abc123",
      clientSecret: "super-secret",
    };
    const encrypted = encryptConfigCredentials("marketo", config);
    expect(encrypted.munchkinId).toBe("123-ABC-456");
    expect(encrypted.clientId).toBe("abc123");
    expect(encrypted.clientSecret).toMatch(/^v1:/);

    const decrypted = decryptConfigCredentials("marketo", encrypted);
    expect(decrypted.clientSecret).toBe("super-secret");
  });

  it("whitelists the right credential field per provider", () => {
    expect(isCredentialField("marketo", "clientSecret")).toBe(true);
    expect(isCredentialField("marketo", "clientId")).toBe(false);
    expect(isCredentialField("salesforce", "clientSecret")).toBe(true);
    expect(isCredentialField("google_sheets", "privateKey")).toBe(true);
    expect(isCredentialField("google_sheets", "serviceAccountEmail")).toBe(false);
    expect(isCredentialField("asana", "pat")).toBe(true);
    expect(isCredentialField("asana", "projectId")).toBe(false);
    expect(isCredentialField("unknown-provider", "anything")).toBe(false);
  });

  it("encrypts the whitelisted field for every provider", () => {
    const cases: Array<{ provider: string; field: string; other: Record<string, unknown> }> = [
      { provider: "salesforce", field: "clientSecret", other: { clientId: "cid", instanceUrl: "https://x" } },
      { provider: "google_sheets", field: "privateKey", other: { sheetId: "s", serviceAccountEmail: "a@b.c" } },
      { provider: "asana", field: "pat", other: { projectId: "p", workspaceId: "w" } },
    ];
    for (const { provider, field, other } of cases) {
      const config = { ...other, [field]: "the-secret" };
      const enc = encryptConfigCredentials(provider, config);
      expect(enc[field]).toMatch(/^v1:/);
      for (const [k, v] of Object.entries(other)) expect(enc[k]).toBe(v);
      expect(decryptConfigCredentials(provider, enc)[field]).toBe("the-secret");
    }
  });

  it("passes through unknown providers unchanged", () => {
    const config = { whatever: "value" };
    expect(encryptConfigCredentials("unknown-provider", config)).toEqual(config);
    expect(decryptConfigCredentials("unknown-provider", config)).toEqual(config);
  });

  it("does not double-encrypt an already-encrypted config (v1: skip guard)", () => {
    const once = encryptConfigCredentials("marketo", { clientSecret: "s", clientId: "c" });
    const twice = encryptConfigCredentials("marketo", once);
    // Re-encrypting must NOT wrap a second envelope; the value stays identical
    // and still decrypts to the original plaintext.
    expect(twice.clientSecret).toBe(once.clientSecret);
    expect(twice.clientSecret).not.toMatch(/^v1:v1:/);
    expect(decryptConfigCredentials("marketo", twice).clientSecret).toBe("s");
  });

  it("decrypt passes through empty/missing credential fields", () => {
    expect(decryptConfigCredentials("marketo", { clientSecret: "", clientId: "c" })).toEqual({
      clientSecret: "",
      clientId: "c",
    });
    expect(decryptConfigCredentials("marketo", { clientId: "c" })).toEqual({ clientId: "c" });
  });

  it("assertEncryptionKeyValid accepts the configured key, rejects a malformed one", () => {
    // Dev/test run on the deterministic fallback key, so validation passes.
    expect(() => assertEncryptionKeyValid()).not.toThrow();

    const saved = process.env.CREDENTIAL_ENCRYPTION_KEY;
    try {
      // Wrong length (not 32 bytes once base64-decoded) must fail eagerly.
      process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
      expect(() => assertEncryptionKeyValid()).toThrow(/32 bytes/);
    } finally {
      if (saved === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      else process.env.CREDENTIAL_ENCRYPTION_KEY = saved;
    }
  });

  it("assertEncryptionKeyValid rejects a malformed previous (rotation) key", () => {
    withKeys(KEY_A, Buffer.from("too-short").toString("base64"), () => {
      expect(() => assertEncryptionKeyValid()).toThrow(/CREDENTIAL_ENCRYPTION_KEY_PREVIOUS.*32 bytes/);
    });
    // A valid previous key passes.
    withKeys(KEY_A, KEY_B, () => {
      expect(() => assertEncryptionKeyValid()).not.toThrow();
    });
  });
});

describe("key rotation", () => {
  it("decrypts ciphertext under the previous key via the active→previous fallback", () => {
    // Encrypted under the OLD key (active = KEY_B at write time)...
    let underOldKey = "";
    withKeys(KEY_B, undefined, () => {
      underOldKey = encryptCredential("rotate-me");
    });
    // ...is still readable after rotation (active = KEY_A, previous = KEY_B).
    withKeys(KEY_A, KEY_B, () => {
      expect(decryptCredential(underOldKey)).toBe("rotate-me");
    });
  });

  it("fails to decrypt old-key ciphertext once the previous key is removed", () => {
    let underOldKey = "";
    withKeys(KEY_B, undefined, () => {
      underOldKey = encryptCredential("rotate-me");
    });
    // No previous key set + active key can't decrypt → throws (steady state
    // before rotation completes proves the fallback is required).
    withKeys(KEY_A, undefined, () => {
      expect(() => decryptCredential(underOldKey)).toThrow();
    });
  });

  it("rotateCredential re-encrypts old-key values under the active key", () => {
    let underOldKey = "";
    withKeys(KEY_B, undefined, () => {
      underOldKey = encryptCredential("rotate-me");
    });

    withKeys(KEY_A, KEY_B, () => {
      const result = rotateCredential(underOldKey);
      expect(result.rotated).toBe(true);
      expect(result.value).not.toBe(underOldKey);
      // The rotated envelope decrypts with the active key ALONE.
      withKeys(KEY_A, undefined, () => {
        expect(decryptCredential(result.value)).toBe("rotate-me");
      });
    });
  });

  it("rotateCredential is a no-op for values already under the active key", () => {
    withKeys(KEY_A, KEY_B, () => {
      const underActive = encryptCredential("already-current");
      const result = rotateCredential(underActive);
      expect(result.rotated).toBe(false);
      expect(result.value).toBe(underActive);
    });
  });

  it("rotateCredential passes through empty / plaintext values", () => {
    withKeys(KEY_A, KEY_B, () => {
      expect(rotateCredential("")).toEqual({ value: "", rotated: false });
      expect(rotateCredential(null)).toEqual({ value: "", rotated: false });
      expect(rotateCredential(undefined)).toEqual({ value: "", rotated: false });
      expect(rotateCredential("legacy-plaintext")).toEqual({
        value: "legacy-plaintext",
        rotated: false,
      });
    });
  });

  it("rotateCredential throws when a value is undecryptable by either key", () => {
    let underOldKey = "";
    withKeys(KEY_B, undefined, () => {
      underOldKey = encryptCredential("rotate-me");
    });
    // Active = KEY_A, no previous key → can't decrypt the old-key value.
    withKeys(KEY_A, undefined, () => {
      expect(() => rotateCredential(underOldKey)).toThrow(/not decryptable/);
    });
  });

  it("rotateConfigCredentials rotates only old-key credential fields and is idempotent", () => {
    let oldConfig: Record<string, unknown> = {};
    withKeys(KEY_B, undefined, () => {
      oldConfig = encryptConfigCredentials("marketo", {
        munchkinId: "123-ABC",
        clientId: "cid",
        clientSecret: "the-secret",
      });
    });

    withKeys(KEY_A, KEY_B, () => {
      const first = rotateConfigCredentials("marketo", oldConfig);
      expect(first.rotated).toBe(1);
      // Non-credential fields untouched.
      expect(first.config.munchkinId).toBe("123-ABC");
      expect(first.config.clientId).toBe("cid");
      expect(first.config.clientSecret).not.toBe(oldConfig.clientSecret);

      // Re-running is a clean no-op (resumable / idempotent).
      const second = rotateConfigCredentials("marketo", first.config);
      expect(second.rotated).toBe(0);
      expect(second.config.clientSecret).toBe(first.config.clientSecret);

      // Rotated secret decrypts under the active key alone.
      withKeys(KEY_A, undefined, () => {
        expect(decryptConfigCredentials("marketo", first.config).clientSecret).toBe("the-secret");
      });
    });
  });
});
