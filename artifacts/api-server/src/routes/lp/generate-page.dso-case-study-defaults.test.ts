/**
 * Task #1136 — a freshly generated `dso-case-study` block must carry an explicit
 * value for every field it defines, so the React component never falls back to
 * its hardcoded DCA demo constants (45-site / 9,600-hours / $9.2M, etc.).
 *
 * `fillDsoCaseStudyNeutralDefaults` is the post-generation pass that guarantees
 * this: AI-extracted values are preserved verbatim; genuinely-missing fields are
 * filled with neutral/empty values (never the DCA defaults). These tests exercise
 * the pure helper (no DB, no network).
 */
import { describe, it, expect } from "vitest";
import { fillDsoCaseStudyNeutralDefaults } from "./generate-page";

describe("fillDsoCaseStudyNeutralDefaults", () => {
  it("fills every field with neutral values when the AI emitted an empty props block", () => {
    const block = { type: "dso-case-study", props: {} as Record<string, unknown> };
    fillDsoCaseStudyNeutralDefaults(block);

    const p = block.props;
    expect(p.eyebrow).toBe("Customer Story");
    expect(p.headline).toBe("");
    expect(p.subheadline).toBe("");
    expect(p.quote).toBe("");
    expect(p.stats).toEqual([]);
    expect(p.results).toEqual([]);
    expect(p.heroOnly).toBe(false);
    expect(p.challenge).toEqual({ heading: "The Challenge", body: "" });
    expect(p.solution).toEqual({ heading: "The Solution", body: "" });
    expect(p.whyItMatters).toEqual({ heading: "Why It Matters", body: "" });
  });

  it("never leaks the DCA demo numbers into a missing-field block", () => {
    const block = { type: "dso-case-study", props: {} as Record<string, unknown> };
    fillDsoCaseStudyNeutralDefaults(block);

    const serialized = JSON.stringify(block.props);
    // DCA-specific constants from BlockDsoCaseStudy's DEFAULT_* fallbacks.
    for (const dca of ["9,600", "$9.2M", "$2.5M", "45-site", "45 sites"]) {
      expect(serialized).not.toContain(dca);
    }
  });

  it("preserves AI-extracted values verbatim (URL-sourced facts are not overwritten)", () => {
    const props = {
      eyebrow: "Field Report",
      headline: "How Acme cut churn 30%",
      subheadline: "A 12-month rollout across 8 regions",
      quote: "We finally trust our pipeline.",
      stats: [{ value: "30%", label: "Churn reduction" }],
      results: [{ value: "8", label: "Regions live", description: "Rolled out in one year" }],
      challenge: { heading: "Their Problem", body: "Manual reconciliation everywhere." },
      solution: { heading: "What We Did", body: "Automated the pipeline." },
      whyItMatters: { heading: "The Payoff", body: "Faster, cheaper, trusted." },
      heroOnly: true,
    };
    const block = { type: "dso-case-study", props: { ...props } as Record<string, unknown> };
    fillDsoCaseStudyNeutralDefaults(block);

    expect(block.props).toEqual(props);
  });

  it("fills only the partially-missing fields, leaving present ones intact", () => {
    const block = {
      type: "dso-case-study",
      props: {
        headline: "Real headline",
        stats: [{ value: "12x", label: "ROI" }],
        // challenge has a body but no heading
        challenge: { body: "Only a body, no heading." },
      } as Record<string, unknown>,
    };
    fillDsoCaseStudyNeutralDefaults(block);

    const p = block.props;
    expect(p.headline).toBe("Real headline");
    expect(p.stats).toEqual([{ value: "12x", label: "ROI" }]);
    expect(p.challenge).toEqual({ heading: "The Challenge", body: "Only a body, no heading." });
    // The untouched-by-AI fields still get neutral fills.
    expect(p.subheadline).toBe("");
    expect(p.results).toEqual([]);
    expect(p.solution).toEqual({ heading: "The Solution", body: "" });
  });

  it("leaves a legacy block (no `sections`) without a sections array", () => {
    const block = { type: "dso-case-study", props: {} as Record<string, unknown> };
    fillDsoCaseStudyNeutralDefaults(block);
    // Additive feature: legacy blocks must stay exactly as before — no array.
    expect("sections" in block.props).toBe(false);
  });

  it("normalizes each extra section's heading/body to strings, preserving the rest", () => {
    const block = {
      type: "dso-case-study",
      props: {
        sections: [
          // A well-formed section keeps all its fields untouched.
          { heading: "Rollout", body: "Phased across 8 regions.", quote: "Loved it.", backgroundStyle: "dark", imageUrl: "/a.jpg" },
          // Missing heading/body get coerced to "", optional fields preserved.
          { quote: "No heading or body here." },
        ],
      } as Record<string, unknown>,
    };
    fillDsoCaseStudyNeutralDefaults(block);

    expect(block.props.sections).toEqual([
      { heading: "Rollout", body: "Phased across 8 regions.", quote: "Loved it.", backgroundStyle: "dark", imageUrl: "/a.jpg" },
      { heading: "", body: "", quote: "No heading or body here." },
    ]);
  });

  it("is a no-op for non dso-case-study blocks", () => {
    const block = { type: "hero", props: { headline: "Hi" } as Record<string, unknown> };
    fillDsoCaseStudyNeutralDefaults(block);
    expect(block.props).toEqual({ headline: "Hi" });
  });

  it("tolerates a block with no props", () => {
    const block = { type: "dso-case-study" } as { type?: string; props?: Record<string, unknown> };
    expect(() => fillDsoCaseStudyNeutralDefaults(block)).not.toThrow();
    expect(block.props).toBeUndefined();
  });
});
