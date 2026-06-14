/**
 * Task #6 — Tenant page outline ("recipe") on the LANDING-PAGE generator.
 *
 * These tests exercise the pure prompt builder `buildSegmentSection` (no DB, no
 * network) and assert the outline precedence and graceful fallback:
 *   1. A segment's own outline drives the ordered PREFERRED BLOCK LIST, with
 *      category steps resolved against the segment's approved pool.
 *   2. When the segment has NO outline (or legacy list), the brand-default
 *      outline supplied by the caller is used instead.
 *   3. The segment outline always wins over the brand-default outline.
 *   4. A category step with no approved block in the pool degrades gracefully
 *      (role-default for chrome roles, otherwise skipped) rather than throwing.
 *   5. A configured outline is honored even on DSO paths (`dsoFreeChoice`); only
 *      a fully unconfigured segment falls through to the model's free choice.
 */
import { describe, it, expect } from "vitest";
import { buildSegmentSection } from "./generate-page";
import type { PageOutline } from "@workspace/lp-template-engine";

/**
 * Extract the ordered block types from the "PREFERRED BLOCK LIST" the segment
 * section advertises to the model ("- \"type\" — hint" lines after the header).
 * Returns [] when no preferred list is present (free-choice path).
 */
function preferredListTypes(section: string): string[] {
  const idx = section.indexOf("PREFERRED BLOCK LIST");
  if (idx === -1) return [];
  return [...section.slice(idx).matchAll(/^- "([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

describe("buildSegmentSection — page outline precedence (Task #6)", () => {
  it("resolves a segment category step from the approved pool, honoring order", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero", schemaHint: "network value prop" },
        { kind: "category", role: "social-proof" },
        { kind: "block", type: "bottom-cta" },
      ],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators", pageOutline: outline },
      // Only `testimonial` carries the social-proof role; `benefits-grid`
      // (features) must NOT be picked for the category step.
      { approvedPool: ["testimonial", "benefits-grid", "dso-heartland-hero"] },
    );
    expect(section).toContain("PREFERRED BLOCK LIST");
    expect(section).toContain('- "dso-heartland-hero" — network value prop');
    // The forced blocks are emitted verbatim and the category step resolved to
    // the one pooled block of that role — IN THE CONFIGURED ORDER.
    expect(preferredListTypes(section)).toEqual([
      "dso-heartland-hero",
      "testimonial",
      "bottom-cta",
    ]);
  });

  it("resolves a category step differently when the approved pool differs", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero" },
        { kind: "category", role: "social-proof" },
      ],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators", pageOutline: outline },
      // `trust-bar` is the only social-proof block in this pool.
      { approvedPool: ["trust-bar", "benefits-grid"] },
    );
    expect(preferredListTypes(section)).toEqual(["dso-heartland-hero", "trust-bar"]);
  });

  it("falls back to the brand-default outline when the segment has none", () => {
    const brandOutline: PageOutline = {
      steps: [{ kind: "block", type: "dso-insights-dashboard" }],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators" },
      { brandOutline, approvedPool: ["dso-insights-dashboard"] },
    );
    expect(section).toContain("PREFERRED BLOCK LIST");
    expect(section).toContain('- "dso-insights-dashboard"');
  });

  it("prefers the segment outline over the brand-default outline", () => {
    const segmentOutline: PageOutline = {
      steps: [{ kind: "block", type: "dso-problem" }],
    };
    const brandOutline: PageOutline = {
      steps: [{ kind: "block", type: "dso-insights-dashboard" }],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators", pageOutline: segmentOutline },
      { brandOutline },
    );
    expect(section).toContain('- "dso-problem"');
    expect(section).not.toContain('- "dso-insights-dashboard"');
  });

  it("degrades gracefully when a category has no neutral default and an empty pool", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-problem" },
        // `faq` has no neutral role default and the pool is empty → skipped.
        { kind: "category", role: "faq" },
      ],
    };
    expect(() =>
      buildSegmentSection(
        { name: "DSO Operators", pageOutline: outline },
        { approvedPool: [] },
      ),
    ).not.toThrow();
    const section = buildSegmentSection(
      { name: "DSO Operators", pageOutline: outline },
      { approvedPool: [] },
    );
    // The forced block still appears; the uncovered category is simply absent.
    expect(preferredListTypes(section)).toEqual(["dso-problem"]);
  });

  it("renders EVERY authored category step even with an empty pool (generic-tenant brand default)", () => {
    // Reproduces the reported bug: a category-only brand-default outline must
    // not collapse when the tenant has no approved pool — each role falls back
    // to a neutral default block.
    const brandOutline: PageOutline = {
      steps: [
        { kind: "category", role: "header" },
        { kind: "category", role: "hero" },
        { kind: "category", role: "social-proof" },
        { kind: "category", role: "content" },
        { kind: "category", role: "media" },
        { kind: "category", role: "features" },
        { kind: "category", role: "cta" },
        { kind: "category", role: "footer" },
      ],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators" },
      { brandOutline, approvedPool: [] },
    );
    expect(section).toContain("PREFERRED BLOCK LIST");
    const types = preferredListTypes(section);
    expect(types).toHaveLength(8);
    expect(types).toEqual(
      expect.arrayContaining(["hero", "testimonial", "bottom-cta", "footer"]),
    );
  });

  it("honors a configured outline even on DSO landing pages (dsoFreeChoice)", () => {
    const outline: PageOutline = {
      steps: [{ kind: "block", type: "dso-heartland-hero" }],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators", pageOutline: outline },
      { dsoFreeChoice: true, approvedPool: ["dso-heartland-hero"] },
    );
    expect(section).toContain("PREFERRED BLOCK LIST");
    expect(section).toContain('- "dso-heartland-hero"');
  });

  it("uses the model's free block choice when nothing is configured (no outline)", () => {
    const section = buildSegmentSection(
      { name: "DSO Operators" },
      { dsoFreeChoice: true },
    );
    expect(section).not.toContain("PREFERRED BLOCK LIST");
    expect(section).toContain("DSO Operators");
  });
});
