// Task #1448 — unit tests for the SFDC microsite-request poller's pure
// helpers plus the metadata state reader they depend on. No DB, no network.
import { describe, it, expect } from "vitest";
import {
  sanitizePrompt,
  resolveSegmentChoice,
  resolveTemplateChoice,
  truncateError,
} from "./sfdcMicrositeRequestPoller";
import { readMicrositeButtonState } from "./sfdcMicrositeButton";

describe("sanitizePrompt", () => {
  it("returns empty string for non-strings", () => {
    expect(sanitizePrompt(null)).toBe("");
    expect(sanitizePrompt(undefined)).toBe("");
    expect(sanitizePrompt(42)).toBe("");
    expect(sanitizePrompt({})).toBe("");
  });

  it("trims and preserves newlines/tabs while stripping other control chars", () => {
    expect(sanitizePrompt("  hello\nworld\tok  ")).toBe("hello\nworld\tok");
    expect(sanitizePrompt("a\u0000b\u0007c\u001Fd\u007Fe")).toBe("abcde");
  });

  it("caps at 2000 characters", () => {
    expect(sanitizePrompt("x".repeat(3000))).toHaveLength(2000);
  });
});

describe("resolveSegmentChoice", () => {
  const segments = [{ id: "dso" }, { id: "smb-dental" }];

  it("returns the id only on an exact match", () => {
    expect(resolveSegmentChoice("dso", segments)).toBe("dso");
    expect(resolveSegmentChoice(" smb-dental ", segments)).toBe("smb-dental");
  });

  it("falls back to null (Recommended) for blank/unknown/non-string", () => {
    expect(resolveSegmentChoice("", segments)).toBeNull();
    expect(resolveSegmentChoice("   ", segments)).toBeNull();
    expect(resolveSegmentChoice("enterprise", segments)).toBeNull();
    expect(resolveSegmentChoice(null, segments)).toBeNull();
    expect(resolveSegmentChoice(7, segments)).toBeNull();
  });
});

describe("resolveTemplateChoice", () => {
  const ids = new Set([12, 340]);

  it("parses numeric strings and validates against the eligible set", () => {
    expect(resolveTemplateChoice("12", ids)).toBe(12);
    expect(resolveTemplateChoice(" 340 ", ids)).toBe(340);
  });

  it("rejects unknown ids, non-numeric and injection-shaped values", () => {
    expect(resolveTemplateChoice("99", ids)).toBeNull();
    expect(resolveTemplateChoice("12; DROP TABLE", ids)).toBeNull();
    expect(resolveTemplateChoice("12.5", ids)).toBeNull();
    expect(resolveTemplateChoice("-12", ids)).toBeNull();
    expect(resolveTemplateChoice("", ids)).toBeNull();
    expect(resolveTemplateChoice(null, ids)).toBeNull();
    // Over 10 digits (overflow guard)
    expect(resolveTemplateChoice("99999999999", ids)).toBeNull();
  });
});

describe("truncateError", () => {
  it("caps at the SFDC text-field limit of 255", () => {
    expect(truncateError("short")).toBe("short");
    expect(truncateError("y".repeat(400))).toHaveLength(255);
  });
});

describe("readMicrositeButtonState", () => {
  it("returns safe defaults for missing/garbage metadata", () => {
    for (const raw of [null, undefined, "nope", 5, {}, { micrositeButton: "bad" }]) {
      const s = readMicrositeButtonState(raw);
      expect(s.enabled).toBe(false);
      expect(s.provisionStatus).toBe("unprovisioned");
      expect(s.provisionProblems).toEqual([]);
      expect(s.lastPollAt).toBeNull();
    }
  });

  it("only honors enabled === true (never truthy coercion)", () => {
    expect(readMicrositeButtonState({ micrositeButton: { enabled: true } }).enabled).toBe(true);
    expect(readMicrositeButtonState({ micrositeButton: { enabled: "yes" } }).enabled).toBe(false);
    expect(readMicrositeButtonState({ micrositeButton: { enabled: 1 } }).enabled).toBe(false);
  });

  it("filters non-string provision problems and unknown statuses", () => {
    const s = readMicrositeButtonState({
      micrositeButton: {
        enabled: true,
        provisionStatus: "weird",
        provisionProblems: ["a", 3, null, "b"],
      },
    });
    expect(s.provisionStatus).toBe("unprovisioned");
    expect(s.provisionProblems).toEqual(["a", "b"]);
  });
});
