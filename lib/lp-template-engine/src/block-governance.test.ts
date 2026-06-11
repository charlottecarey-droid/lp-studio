// Unit tests for the shared block-governance precedence model (task #4). This
// is THE documented resolution order both the api-server generator and the
// lp-studio builder import, so the matrix here pins the cross-process contract:
// a change to availability / segment / AI-mode resolution breaks generation AND
// the builder in lock-step. Pure functions, no DB/DOM.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeAiMode,
  sanitizeGovernanceEntry,
  governanceMapFromRows,
  resolveBlockAvailable,
  resolveAiMode,
  resolveBlockSegments,
  isBlockApprovedForSegment,
  blocksApprovedForSegment,
  resolveAiEligible,
  DEFAULT_AI_MODE,
  type TenantBlockGovernanceEntry,
} from "./block-governance.ts";

describe("sanitizeAiMode", () => {
  it("passes through the three valid modes", () => {
    assert.equal(sanitizeAiMode("locked"), "locked");
    assert.equal(sanitizeAiMode("copy"), "copy");
    assert.equal(sanitizeAiMode("open"), "open");
  });
  it("falls open to 'open' on junk", () => {
    assert.equal(sanitizeAiMode("LOCKED"), DEFAULT_AI_MODE);
    assert.equal(sanitizeAiMode(undefined), "open");
    assert.equal(sanitizeAiMode(null), "open");
    assert.equal(sanitizeAiMode(42), "open");
  });
});

describe("sanitizeGovernanceEntry", () => {
  it("normalizes a full entry, deduping + trimming segments", () => {
    const e = sanitizeGovernanceEntry({
      blockType: "  hero  ",
      enabled: false,
      aiMode: "copy",
      segments: [" s1 ", "s1", "s2", "", 7],
    });
    assert.deepEqual(e, { blockType: "hero", enabled: false, aiMode: "copy", segments: ["s1", "s2"] });
  });
  it("defaults enabled to null (inherit) and aiMode to open", () => {
    const e = sanitizeGovernanceEntry({ blockType: "x" });
    assert.deepEqual(e, { blockType: "x", enabled: null, aiMode: "open", segments: [] });
  });
  it("treats a non-boolean enabled as inherit (null)", () => {
    assert.equal(sanitizeGovernanceEntry({ blockType: "x", enabled: "false" })?.enabled, null);
  });
  it("rejects rows with no/oversized blockType", () => {
    assert.equal(sanitizeGovernanceEntry({ enabled: true }), null);
    assert.equal(sanitizeGovernanceEntry({ blockType: "" }), null);
    assert.equal(sanitizeGovernanceEntry({ blockType: "a".repeat(201) }), null);
    assert.equal(sanitizeGovernanceEntry(null), null);
  });
});

describe("governanceMapFromRows", () => {
  it("builds a blockType→entry map and skips junk", () => {
    const m = governanceMapFromRows([
      { blockType: "hero", aiMode: "locked", segments: [] },
      null,
      { enabled: true },
      { blockType: "cta", enabled: false, aiMode: "open", segments: ["s1"] },
    ]);
    assert.equal(m.size, 2);
    assert.equal(m.get("hero")?.aiMode, "locked");
    assert.equal(m.get("cta")?.enabled, false);
  });
  it("returns an empty map for null/undefined/empty", () => {
    assert.equal(governanceMapFromRows(null).size, 0);
    assert.equal(governanceMapFromRows(undefined).size, 0);
    assert.equal(governanceMapFromRows([]).size, 0);
  });
});

describe("resolveBlockAvailable — precedence layers", () => {
  const gov = (p: Partial<TenantBlockGovernanceEntry>): TenantBlockGovernanceEntry => ({
    blockType: "hero",
    enabled: null,
    aiMode: "open",
    segments: [],
    ...p,
  });

  it("fail-open: no inputs at all ⇒ available", () => {
    assert.equal(resolveBlockAvailable({ blockType: "hero" }), true);
  });
  it("layer 1: superadmin kill-switch is absolute (even if governance enables)", () => {
    assert.equal(
      resolveBlockAvailable({ blockType: "hero", catalogEnabled: false, governance: gov({ enabled: true }) }),
      false,
    );
  });
  it("layer 2: tenant governance enabled:false hides", () => {
    assert.equal(resolveBlockAvailable({ blockType: "hero", governance: gov({ enabled: false }) }), false);
  });
  it("layer 2: enabled:null inherits (available)", () => {
    assert.equal(resolveBlockAvailable({ blockType: "hero", governance: gov({ enabled: null }) }), true);
  });
  it("layer 3: cosmetic hidden list (Set and array) hides", () => {
    assert.equal(resolveBlockAvailable({ blockType: "hero", hiddenBlockTypes: new Set(["hero"]) }), false);
    assert.equal(resolveBlockAvailable({ blockType: "hero", hiddenBlockTypes: ["hero"] }), false);
    assert.equal(resolveBlockAvailable({ blockType: "hero", hiddenBlockTypes: ["other"] }), true);
  });
});

describe("AI mode + segments", () => {
  const entry: TenantBlockGovernanceEntry = {
    blockType: "hero",
    enabled: null,
    aiMode: "copy",
    segments: ["s1", "s2"],
  };
  it("resolveAiMode reads the entry, defaults open when absent", () => {
    assert.equal(resolveAiMode(entry), "copy");
    assert.equal(resolveAiMode(undefined), "open");
  });
  it("resolveBlockSegments returns the segment ids (empty when absent)", () => {
    assert.deepEqual(resolveBlockSegments(entry), ["s1", "s2"]);
    assert.deepEqual(resolveBlockSegments(undefined), []);
  });
  it("isBlockApprovedForSegment matches membership", () => {
    assert.equal(isBlockApprovedForSegment(entry, "s1"), true);
    assert.equal(isBlockApprovedForSegment(entry, "s9"), false);
    assert.equal(isBlockApprovedForSegment(undefined, "s1"), false);
    assert.equal(isBlockApprovedForSegment(entry, ""), false);
  });
});

describe("resolveAiEligible", () => {
  it("eligible by default (fail-open)", () => {
    assert.equal(resolveAiEligible({ blockType: "hero" }), true);
  });
  it("not eligible when unavailable (layer 1/2)", () => {
    assert.equal(resolveAiEligible({ blockType: "hero", catalogEnabled: false }), false);
    assert.equal(
      resolveAiEligible({
        blockType: "hero",
        governance: { blockType: "hero", enabled: false, aiMode: "open", segments: [] },
      }),
      false,
    );
  });
  it("not eligible when superadmin ai_enabled:false even if available", () => {
    assert.equal(resolveAiEligible({ blockType: "hero", catalogAiEnabled: false }), false);
  });
});

describe("blocksApprovedForSegment — the segment-generation pool (task #5)", () => {
  const map = governanceMapFromRows([
    { blockType: "hero", enabled: null, aiMode: "open", segments: ["s1", "s2"] },
    { blockType: "benefits-grid", enabled: true, aiMode: "open", segments: ["s1"] },
    // tenant-DISABLED block — must NEVER enter the pool even when approved.
    { blockType: "faq", enabled: false, aiMode: "open", segments: ["s1"] },
    // approved for a different segment only.
    { blockType: "pricing", enabled: null, aiMode: "open", segments: ["s2"] },
  ]);

  it("returns the approved, non-disabled block types for the segment", () => {
    const pool = blocksApprovedForSegment(map, "s1").sort();
    assert.deepEqual(pool, ["benefits-grid", "hero"]);
  });

  it("excludes tenant-disabled blocks even when they are segment-approved", () => {
    assert.equal(blocksApprovedForSegment(map, "s1").includes("faq"), false);
  });

  it("scopes strictly to the requested segment", () => {
    assert.deepEqual(blocksApprovedForSegment(map, "s2").sort(), ["hero", "pricing"]);
    assert.deepEqual(blocksApprovedForSegment(map, "s9"), []);
  });

  it("fails open to [] on a blank segment id or empty map", () => {
    assert.deepEqual(blocksApprovedForSegment(map, ""), []);
    assert.deepEqual(blocksApprovedForSegment(map, "   "), []);
    assert.deepEqual(blocksApprovedForSegment(new Map(), "s1"), []);
  });
});
