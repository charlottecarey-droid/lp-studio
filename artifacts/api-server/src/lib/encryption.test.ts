import { describe, it, expect } from "vitest";
import {
  encryptCredential,
  decryptCredential,
  encryptConfigCredentials,
  decryptConfigCredentials,
  isCredentialField,
  assertEncryptionKeyValid,
} from "./encryption";

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
});
