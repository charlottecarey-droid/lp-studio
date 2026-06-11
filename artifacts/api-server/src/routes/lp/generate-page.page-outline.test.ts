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

describe("buildSegmentSection — page outline precedence (Task #6)", () => {
  it("resolves a segment category step from the approved pool, honoring order", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero", schemaHint: "network value prop" },
        { kind: "category", role: "social-proof" },
      ],
    };
    const section = buildSegmentSection(
      { name: "DSO Operators", pageOutline: outline },
      { approvedPool: ["testimonial", "dso-heartland-hero"] },
    );
    expect(section).toContain("PREFERRED BLOCK LIST");
    expect(section).toContain('- "dso-heartland-hero" — network value prop');
    // The category step resolved to a pooled block of that role.
    expect(section).toContain('"testimonial"');
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

  it("degrades gracefully when a category has no approved block", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-problem" },
        // No block of this role exists in the (empty) pool.
        { kind: "category", role: "social-proof" },
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
    // The forced block still appears; the unmatched category is simply absent.
    expect(section).toContain('- "dso-problem"');
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
