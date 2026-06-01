import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  platformFromAddress,
  platformReplyTo,
  PLATFORM_FROM_FALLBACK,
  PLATFORM_REPLY_TO_FALLBACK,
} from "./platformSender";

// These helpers read process.env at call time, so each test sets/clears the
// relevant var and the original environment is restored afterwards to keep the
// suite hermetic regardless of the ambient shell.
const ORIGINAL_FROM = process.env["RESEND_FROM_EMAIL"];
const ORIGINAL_REPLY_TO = process.env["RESEND_REPLY_TO"];

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  delete process.env["RESEND_FROM_EMAIL"];
  delete process.env["RESEND_REPLY_TO"];
});

afterEach(() => {
  restore("RESEND_FROM_EMAIL", ORIGINAL_FROM);
  restore("RESEND_REPLY_TO", ORIGINAL_REPLY_TO);
});

describe("platformFromAddress", () => {
  it("falls back to the verified platform default when unset", () => {
    expect(platformFromAddress()).toBe(PLATFORM_FROM_FALLBACK);
  });

  it("falls back to the default when set to a blank/whitespace string", () => {
    process.env["RESEND_FROM_EMAIL"] = "   ";
    expect(platformFromAddress()).toBe(PLATFORM_FROM_FALLBACK);
  });

  it("uses RESEND_FROM_EMAIL when set", () => {
    process.env["RESEND_FROM_EMAIL"] = "Ops <ops@example.com>";
    expect(platformFromAddress()).toBe("Ops <ops@example.com>");
  });

  it("trims surrounding whitespace from RESEND_FROM_EMAIL", () => {
    process.env["RESEND_FROM_EMAIL"] = "  Ops <ops@example.com>  ";
    expect(platformFromAddress()).toBe("Ops <ops@example.com>");
  });
});

describe("platformReplyTo", () => {
  it("falls back to the monitored default when unset", () => {
    expect(platformReplyTo()).toBe(PLATFORM_REPLY_TO_FALLBACK);
  });

  it("uses RESEND_REPLY_TO when set to a non-blank value", () => {
    process.env["RESEND_REPLY_TO"] = "support@example.com";
    expect(platformReplyTo()).toBe("support@example.com");
  });

  it("trims surrounding whitespace from a non-blank RESEND_REPLY_TO", () => {
    process.env["RESEND_REPLY_TO"] = "  support@example.com  ";
    expect(platformReplyTo()).toBe("support@example.com");
  });

  it("disables reply-to (returns undefined) when set to an explicit empty string", () => {
    process.env["RESEND_REPLY_TO"] = "";
    expect(platformReplyTo()).toBeUndefined();
  });

  it("disables reply-to when set to a whitespace-only string", () => {
    process.env["RESEND_REPLY_TO"] = "   ";
    expect(platformReplyTo()).toBeUndefined();
  });
});
