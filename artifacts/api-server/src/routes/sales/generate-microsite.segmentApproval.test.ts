import { describe, it, expect } from "vitest";
import { buildFreeformBlockGuide, buildDsoFreeformBlockGuide } from "./generate-microsite";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";

// A "superadmin-approved extra" must be a real block type that canonicalizes to
// itself and is NOT already in the path's base vocabulary:
//   • The microsite FREEFORM base now equals the landing-page (general) block
//     set + a few microsite-only extras, so general nav variants — and the
//     premium dso-* blocks the general prompt advertises (e.g. dso-heartland-hero)
//     — ARE in it. So pick a DSO block the general prompt does NOT advertise.
//     `dso-final-cta` joined the base vocab in 00cde020a ("Update microsite
//     generation to use DSOs' specific content and recipes"), so the stand-in is
//     now `dso-stat-bar`, which remains gated out of the freeform vocab.
//   • The DSO base is the dso-* vocabulary, so a general block (`mega-menu-nav`)
//     is the clean stand-in there.
const FREEFORM_EXTRA = "dso-stat-bar";
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
    expect(base).not.toContain(canonicalizeBlockType(FREEFORM_EXTRA));
  });

  it("unions an approved extra ON TOP of the base vocab (not a replace)", () => {
    const base = bulletTypes(buildFreeformBlockGuide());
    const expanded = bulletTypes(buildFreeformBlockGuide([FREEFORM_EXTRA]));
    expect(expanded).toContain(canonicalizeBlockType(FREEFORM_EXTRA));
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
