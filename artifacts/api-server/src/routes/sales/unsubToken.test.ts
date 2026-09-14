/**
 * Unsubscribe token round-trip.
 *
 * The token is the only place the campaign is still known by the time someone
 * clicks "unsubscribe" from their inbox — the request arrives as a bare GET
 * with no session and no referrer. Carrying campaignId inside the HMAC is what
 * makes per-campaign unsubscribe counts possible at all, so this covers both
 * that the new field survives the round trip AND that widening the format did
 * not invalidate links already sitting in people's inboxes.
 *
 * UNSUB_SECRET is captured at module import time, so it is set before the
 * dynamic import below.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-unsub-secret-do-not-use-in-prod";
let makeUnsubToken: (t: number, c: number, campaignId?: number | null) => string;
let verifyUnsubToken: (token: string) => { tenantId: number | null; contactId: number; campaignId: number | null } | null;

beforeAll(async () => {
  process.env.UNSUB_SECRET = SECRET;
  const mod = await import("./campaigns");
  makeUnsubToken = mod.makeUnsubToken;
  verifyUnsubToken = mod.verifyUnsubToken;
});

/** Mint an old-format token the way the pre-0140 code did. */
function legacyToken(parts: string[]): string {
  const mac = createHmac("sha256", SECRET).update(parts.join(".")).digest("hex");
  return Buffer.from([...parts, mac].join(".")).toString("base64url");
}

const future = () => String(Math.floor(Date.now() / 1000) + 3600);
const past = () => String(Math.floor(Date.now() / 1000) - 3600);

describe("unsubscribe token", () => {
  it("round-trips tenant, contact and campaign", () => {
    const v = verifyUnsubToken(makeUnsubToken(7, 123, 456));
    expect(v).toEqual({ tenantId: 7, contactId: 123, campaignId: 456 });
  });

  it("reports no campaign for a one-off send", () => {
    // /send-email and /send-test-email have no campaign; 0 encodes "none".
    const v = verifyUnsubToken(makeUnsubToken(7, 123));
    expect(v).toEqual({ tenantId: 7, contactId: 123, campaignId: null });
  });

  it("still accepts 4-part tokens already in inboxes", () => {
    const v = verifyUnsubToken(legacyToken(["7", "123", future()]));
    expect(v).toEqual({ tenantId: 7, contactId: 123, campaignId: null });
  });

  it("still accepts 3-part legacy tokens", () => {
    const v = verifyUnsubToken(legacyToken(["123", future()]));
    expect(v).toEqual({ tenantId: null, contactId: 123, campaignId: null });
  });

  it("rejects a token whose campaign id was tampered with", () => {
    // The campaign is inside the HMAC, so it cannot be edited to shift an
    // unsubscribe onto someone else's campaign.
    const token = makeUnsubToken(7, 123, 456);
    const parts = Buffer.from(token, "base64url").toString("utf8").split(".");
    parts[2] = "999";
    const forged = Buffer.from(parts.join(".")).toString("base64url");
    expect(verifyUnsubToken(forged)).toBeNull();
  });

  it("rejects a tampered contact id", () => {
    const token = makeUnsubToken(7, 123, 456);
    const parts = Buffer.from(token, "base64url").toString("utf8").split(".");
    parts[1] = "999";
    expect(verifyUnsubToken(Buffer.from(parts.join(".")).toString("base64url"))).toBeNull();
  });

  it("rejects an expired token", () => {
    const mac = createHmac("sha256", SECRET).update(`7.123.456.${past()}`).digest("hex");
    const expired = Buffer.from(`7.123.456.${past()}.${mac}`).toString("base64url");
    expect(verifyUnsubToken(expired)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyUnsubToken("not-a-token")).toBeNull();
    expect(verifyUnsubToken("")).toBeNull();
  });
});
