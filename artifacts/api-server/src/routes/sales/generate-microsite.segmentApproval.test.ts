import { describe, it, expect } from "vitest";
import { buildFreeformBlockGuide, buildDsoFreeformBlockGuide } from "./generate-microsite";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";

// `mega-menu-nav` is a real GENERAL block type that is NOT part of the microsite
// freeform OR DSO vocabularies and canonicalizes to itself — a clean stand-in
// for a superadmin-approved extra block.
const EXTRA = "mega-menu-nav";

function bulletTypes(guide: string): string[] {
  return [...guide.matchAll(/^- "([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

describe("segment-approval vocab union — microsite freeform guide", () => {
  it("lists the base freeform vocabulary with no extras", () => {
    const base = bulletTypes(buildFreeformBlockGuide());
    expect(base).toContain("hero");
    expect(base).toContain("benefits-grid");
    expect(base).toContain("footer");
    expect(base).not.toContain(canonicalizeBlockType(EXTRA));
  });

  it("unions an approved extra ON TOP of the base vocab (not a replace)", () => {
    const base = bulletTypes(buildFreeformBlockGuide());
    const expanded = bulletTypes(buildFreeformBlockGuide([EXTRA]));
    expect(expanded).toContain(canonicalizeBlockType(EXTRA));
    for (const t of base) expect(expanded).toContain(t);
    expect(expanded.length).toBe(base.length + 1);
    expect(new Set(expanded).size).toBe(expanded.length); // no duplicates
  });

  it("does not duplicate an extra already in the base vocab", () => {
    const base = bulletTypes(buildFreeformBlockGuide());
    const expanded = bulletTypes(buildFreeformBlockGuide(["hero", "footer"]));
    expect(expanded.length).toBe(base.length);
    expect(new Set(expanded).size).toBe(expanded.length);
  });
});

describe("segment-approval vocab union — microsite DSO freeform guide", () => {
  for (const mode of ["enterprise", "practices"] as const) {
    it(`unions an approved extra on top of the DSO ${mode} vocab`, () => {
      const base = bulletTypes(buildDsoFreeformBlockGuide(mode));
      const expanded = bulletTypes(buildDsoFreeformBlockGuide(mode, [EXTRA]));
      expect(base).not.toContain(canonicalizeBlockType(EXTRA));
      expect(expanded).toContain(canonicalizeBlockType(EXTRA));
      for (const t of base) expect(expanded).toContain(t);
      expect(expanded.length).toBe(base.length + 1);
    });
  }
});
