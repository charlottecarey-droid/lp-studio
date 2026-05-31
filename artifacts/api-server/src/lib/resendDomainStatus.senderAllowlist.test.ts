/**
 * Unit tests for the verified sending-domain allowlist (Task #597).
 *
 * These cover the helpers that back both the save-time guard (PATCH on the
 * notification-template editor) and the editor's live from-address warning:
 *   - extractAddressDomain: parses bare + display-name from-addresses.
 *   - getAllowedSenderDomains: verified domains PLUS the platform default.
 *   - checkSenderDomain: blocks unverified domains, but FAILS OPEN when the
 *     verified list can't be determined (no RESEND_API_KEY / API down) so a
 *     keyless dev/CI env never wedges template saves.
 *
 * The Resend /domains call is stubbed via vi.stubGlobal("fetch", ...). The
 * global verified-list cache is cleared between cases so stubs don't bleed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  extractAddressDomain,
  getAllowedSenderDomains,
  checkSenderDomain,
  listVerifiedSendingDomains,
  _clearResendDomainStatusCache,
} from "./resendDomainStatus";

const ORIGINAL_KEY = process.env["RESEND_API_KEY"];
const ORIGINAL_FROM = process.env["RESEND_FROM_EMAIL"];

function stubDomainsResponse(domains: Array<{ name: string; status: string }>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: domains }),
    }) as unknown as Response),
  );
}

beforeEach(() => {
  _clearResendDomainStatusCache();
  process.env["RESEND_FROM_EMAIL"] = "LP Studio <noreply@lpstudio.ai>";
});

afterEach(() => {
  vi.unstubAllGlobals();
  _clearResendDomainStatusCache();
  if (ORIGINAL_KEY === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = ORIGINAL_KEY;
  if (ORIGINAL_FROM === undefined) delete process.env["RESEND_FROM_EMAIL"];
  else process.env["RESEND_FROM_EMAIL"] = ORIGINAL_FROM;
});

describe("extractAddressDomain", () => {
  it("parses a bare address", () => {
    expect(extractAddressDomain("hello@acme.com")).toBe("acme.com");
  });

  it("parses a display-name address and lowercases the domain", () => {
    expect(extractAddressDomain("Acme Team <Hello@Acme.COM>")).toBe("acme.com");
  });

  it("returns null for a value with no parseable address", () => {
    expect(extractAddressDomain("not an email")).toBeNull();
    expect(extractAddressDomain("")).toBeNull();
  });
});

describe("getAllowedSenderDomains", () => {
  it("includes verified domains plus the platform default domain", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    stubDomainsResponse([
      { name: "acme.com", status: "verified" },
      { name: "pending.com", status: "pending" },
    ]);

    const { domains, available } = await getAllowedSenderDomains({ force: true });
    expect(available).toBe(true);
    expect(domains).toContain("acme.com");
    expect(domains).toContain("lpstudio.ai"); // platform default
    expect(domains).not.toContain("pending.com"); // not verified
  });

  it("reports available:false (fails open) when no RESEND_API_KEY is set", async () => {
    delete process.env["RESEND_API_KEY"];
    const { available } = await getAllowedSenderDomains({ force: true });
    expect(available).toBe(false);
  });
});

describe("listVerifiedSendingDomains", () => {
  it("returns available:false when the Resend API errors", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response),
    );
    const { domains, available } = await listVerifiedSendingDomains({ force: true });
    expect(available).toBe(false);
    expect(domains).toEqual([]);
  });
});

describe("checkSenderDomain", () => {
  it("allows an address on a verified domain", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    stubDomainsResponse([{ name: "acme.com", status: "verified" }]);
    const check = await checkSenderDomain("Acme <hello@acme.com>");
    expect(check.allowed).toBe(true);
    expect(check.domain).toBe("acme.com");
    expect(check.available).toBe(true);
  });

  it("allows the platform default domain even when not in the verified list", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    stubDomainsResponse([{ name: "acme.com", status: "verified" }]);
    const check = await checkSenderDomain("noreply@lpstudio.ai");
    expect(check.allowed).toBe(true);
  });

  it("blocks an address on an unverified domain when the list is known", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    stubDomainsResponse([{ name: "acme.com", status: "verified" }]);
    const check = await checkSenderDomain("hello@evil.com");
    expect(check.allowed).toBe(false);
    expect(check.domain).toBe("evil.com");
    expect(check.available).toBe(true);
    expect(check.allowedDomains).toContain("acme.com");
  });

  it("fails open (allows) when the verified list can't be determined", async () => {
    delete process.env["RESEND_API_KEY"];
    const check = await checkSenderDomain("hello@evil.com");
    expect(check.allowed).toBe(true);
    expect(check.available).toBe(false);
  });
});
