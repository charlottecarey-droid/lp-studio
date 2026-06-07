/**
 * Strict-mode factual-integrity guard for the repeatable `sections[]` feature
 * on the `dso-case-study` block.
 *
 * `enforceApprovedCaseStudies` rebuilds case-study blocks from the tenant's
 * AI-approved pool. In strict mode it must blank every additive section's
 * long-form `body` and optional pull `quote` (unapproved AI prose) — exactly
 * like it already blanks the built-in challenge/solution bodies — while keeping
 * the structural `heading` and any `imageUrl`/`backgroundStyle` so the band
 * still renders. Non-strict generation leaves authored/template sections alone.
 *
 * These exercise the pure helper (no DB, no network).
 */
import { describe, it, expect } from "vitest";
import { enforceApprovedCaseStudies, type ApprovedCaseStudy } from "./generate-page";

const approved: ApprovedCaseStudy = {
  title: "How Acme scaled to 40 locations",
  categories: "DSO",
  url: "https://example.com/acme",
  quote: "Dandy paid for itself in a quarter.",
  author: "Jane Doe, COO",
  stat: "12.5%",
  statLabel: "revenue lift",
  image: "/acme.jpg",
  logoUrl: "/acme-logo.svg",
  locationCount: 40,
  segment: "dso",
};

function caseStudyBlock(sections: unknown) {
  return {
    type: "dso-case-study",
    props: {
      headline: "Invented headline",
      subheadline: "Invented subheadline",
      quote: "Invented quote",
      challenge: { heading: "The Challenge", body: "Invented challenge prose." },
      solution: { heading: "The Solution", body: "Invented solution prose." },
      sections,
    } as Record<string, unknown>,
  };
}

describe("enforceApprovedCaseStudies — dso-case-study sections[] (strict)", () => {
  it("blanks each section body and quote but keeps heading/imageUrl/bg (with approved pool)", () => {
    const block = caseStudyBlock([
      { heading: "Rollout", body: "Phased over 8 regions.", quote: "We loved it.", imageUrl: "/r.jpg", backgroundStyle: "dark" },
      { heading: "Outcome", body: "Saved $2M.", backgroundStyle: "white" },
    ]);
    enforceApprovedCaseStudies(block, [approved], { strict: true });

    expect(block.props.sections).toEqual([
      { heading: "Rollout", body: "", quote: "", imageUrl: "/r.jpg", backgroundStyle: "dark" },
      { heading: "Outcome", body: "", backgroundStyle: "white" },
    ]);
    // The real approved headline/quote still flow in.
    expect(block.props.headline).toBe(approved.title);
  });

  it("blanks section body and quote when there are NO approved case studies", () => {
    const block = caseStudyBlock([
      { heading: "Rollout", body: "Phased over 8 regions.", quote: "We loved it." },
    ]);
    enforceApprovedCaseStudies(block, [], { strict: true });

    expect(block.props.sections).toEqual([
      { heading: "Rollout", body: "", quote: "" },
    ]);
  });

  it("leaves sections untouched in non-strict mode", () => {
    const sections = [
      { heading: "Rollout", body: "Phased over 8 regions.", quote: "We loved it." },
    ];
    const block = caseStudyBlock(sections.map((s) => ({ ...s })));
    enforceApprovedCaseStudies(block, [approved], { strict: false });

    expect(block.props.sections).toEqual(sections);
  });

  it("tolerates a malformed sections entry without throwing", () => {
    const block = caseStudyBlock([null, "nope", { heading: "Real", body: "Invented." }]);
    expect(() => enforceApprovedCaseStudies(block, [], { strict: true })).not.toThrow();
    expect(block.props.sections).toEqual([null, "nope", { heading: "Real", body: "" }]);
  });
});
