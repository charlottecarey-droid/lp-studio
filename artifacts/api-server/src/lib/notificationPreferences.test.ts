import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "./notificationPreferences";

// These tests cover ONLY the stateless, host-bound HMAC unsubscribe token —
// no DB access — locking in the host-binding contract the one-click route relies
// on. A real signing secret is required (no guessable hardcoded fallback), so we
// set one for the duration of the suite.
beforeEach(() => {
  process.env["NOTIFICATION_PREFS_SECRET"] = "unit-test-secret";
});

describe("unsubscribe token", () => {
  it("round-trips for a dotted hostname (the format that previously broke)", () => {
    const host = "acme.lpstudio.ai";
    const token = makeUnsubscribeToken(42, 7, host);
    expect(verifyUnsubscribeToken(token, host)).toEqual({ appUserId: 42, tenantId: 7 });
  });

  it("round-trips for a custom domain with multiple dots", () => {
    const host = "ent.meetdandy.com";
    const token = makeUnsubscribeToken(1, 2, host);
    expect(verifyUnsubscribeToken(token, host)).toEqual({ appUserId: 1, tenantId: 2 });
  });

  it("verifies regardless of a port on the request host", () => {
    const token = makeUnsubscribeToken(5, 9, "acme.lpstudio.ai");
    expect(verifyUnsubscribeToken(token, "acme.lpstudio.ai:443")).toEqual({
      appUserId: 5,
      tenantId: 9,
    });
  });

  it("rejects a token presented on a different host (no cross-host replay)", () => {
    const token = makeUnsubscribeToken(42, 7, "acme.lpstudio.ai");
    expect(verifyUnsubscribeToken(token, "evil.lpstudio.ai")).toBeNull();
  });

  it("rejects a tampered MAC", () => {
    const token = makeUnsubscribeToken(42, 7, "acme.lpstudio.ai");
    const tampered = token.slice(0, -2) + (token.endsWith("00") ? "11" : "00");
    expect(verifyUnsubscribeToken(tampered, "acme.lpstudio.ai")).toBeNull();
  });

  it("rejects a tampered payload (swapped user id) since the MAC no longer matches", () => {
    const token = makeUnsubscribeToken(42, 7, "acme.lpstudio.ai");
    const sig = token.split(".")[1]!;
    const forgedBody = Buffer.from(
      JSON.stringify({ u: 9999, t: 7, h: "acme.lpstudio.ai", e: 9999999999 }),
      "utf8",
    ).toString("base64url");
    expect(verifyUnsubscribeToken(`${forgedBody}.${sig}`, "acme.lpstudio.ai")).toBeNull();
  });

  it("rejects garbage / malformed input", () => {
    expect(verifyUnsubscribeToken("garbage", "acme.lpstudio.ai")).toBeNull();
    expect(verifyUnsubscribeToken("", "acme.lpstudio.ai")).toBeNull();
    expect(verifyUnsubscribeToken(".", "acme.lpstudio.ai")).toBeNull();
  });

  describe("expiry", () => {
    afterEach(() => vi.useRealTimers());

    it("rejects an expired token (past the 90-day TTL)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const token = makeUnsubscribeToken(42, 7, "acme.lpstudio.ai");
      // Advance beyond the 90-day window.
      vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
      expect(verifyUnsubscribeToken(token, "acme.lpstudio.ai")).toBeNull();
    });

    it("still verifies inside the TTL window", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const token = makeUnsubscribeToken(42, 7, "acme.lpstudio.ai");
      vi.setSystemTime(new Date("2026-02-01T00:00:00Z")); // 31 days later
      expect(verifyUnsubscribeToken(token, "acme.lpstudio.ai")).toEqual({
        appUserId: 42,
        tenantId: 7,
      });
    });
  });
});
