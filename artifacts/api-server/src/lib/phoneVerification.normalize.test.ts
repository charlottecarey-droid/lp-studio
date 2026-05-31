import { describe, expect, it } from "vitest";
import { normalizeE164Input } from "./phoneVerification";

describe("normalizeE164Input", () => {
  it("passes an already-valid E.164 number through unchanged", () => {
    expect(normalizeE164Input("+14155552671")).toBe("+14155552671");
  });

  it("strips spaces, dashes, dots, and parentheses", () => {
    expect(normalizeE164Input("+1 (415) 555-2671")).toBe("+14155552671");
    expect(normalizeE164Input("+1.415.555.2671")).toBe("+14155552671");
    expect(normalizeE164Input("+1-415-555-2671")).toBe("+14155552671");
    expect(normalizeE164Input("  +1 415 555 2671  ")).toBe("+14155552671");
    expect(normalizeE164Input("+44 (0) 20 7946 0958".replace("(0)", ""))).toBe(
      "+442079460958",
    );
  });

  it("normalizes every formatting variant of the same number to one E.164 key", () => {
    const variants = [
      "+14155552671",
      "+1 415 555 2671",
      "+1 (415) 555-2671",
      "+1.415.555.2671",
      "+1-415-555-2671",
    ];
    const normalized = variants.map((v) => normalizeE164Input(v));
    expect(new Set(normalized)).toEqual(new Set(["+14155552671"]));
  });

  it("accepts a 00 IDD prefix in place of +", () => {
    expect(normalizeE164Input("0014155552671")).toBe("+14155552671");
    expect(normalizeE164Input("00 44 20 7946 0958")).toBe("+442079460958");
  });

  it("rejects clearly non-phone input", () => {
    expect(normalizeE164Input("")).toBeNull();
    expect(normalizeE164Input("   ")).toBeNull();
    expect(normalizeE164Input("not a phone")).toBeNull();
    expect(normalizeE164Input("415-555-2671")).toBeNull(); // no country code / +
    expect(normalizeE164Input("+0123456789")).toBeNull(); // leading zero after +
    expect(normalizeE164Input("+123")).toBeNull(); // too short
    expect(normalizeE164Input("+1234567890123456")).toBeNull(); // too long
    expect(normalizeE164Input("+1-abc-555-2671")).toBeNull(); // contains letters
  });

  it("rejects non-string input", () => {
    expect(normalizeE164Input(null)).toBeNull();
    expect(normalizeE164Input(undefined)).toBeNull();
    expect(normalizeE164Input(14155552671)).toBeNull();
    expect(normalizeE164Input({})).toBeNull();
  });
});
