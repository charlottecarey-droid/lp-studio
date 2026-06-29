/**
 * Legacy microsite-list gating (June 2026 regression fix).
 *
 * The landing-page generator must NOT let a tenant's LEGACY microsite block list
 * make the page outline AUTHORITATIVE. Only an explicitly authored `pageOutline`
 * (segment or brand) is authoritative; the legacy list survives only as a soft
 * PREFERRED BLOCK LIST prompt hint (the resolver's default behaviour).
 *
 * Regression context: a tenant with a saved `defaultMicrositeBlockList` (the
 * microsite surface's vocabulary) but NO authored `defaultPageOutline` saw its
 * non-DSO landing pages collapse into the microsite lineup, because the post-gen
 * reconcile ran on the adapted legacy list. The authoritative call site now
 * passes `honorLegacyBlockList: false`; these pure-helper tests pin that gate.
 *
 * No DB / no network.
 */
import { describe, it, expect } from "vitest";
import { resolveGenerationOutlineBlocks } from "./generate-page";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";
import type { PageOutline } from "@workspace/lp-template-engine";

const legacy = [{ type: "hero" }, { type: "feature-spotlight" }, { type: "cta-banner" }];
const canon = (t: string) => canonicalizeBlockType(t);

describe("resolveGenerationOutlineBlocks — legacy microsite-list gating", () => {
  it("IGNORES a legacy-only segment block list when honorLegacyBlockList is false (authoritative path)", () => {
    const out = resolveGenerationOutlineBlocks({
      segmentPageOutline: null,
      segmentLegacyBlockList: legacy,
      brandOutline: null,
      dsoFreeChoice: false,
      honorLegacyBlockList: false,
    });
    // No authored outline → free AI block choice (empty = reconcile is skipped).
    expect(out).toEqual([]);
  });

  it("KEEPS a legacy-only segment block list as a soft hint by default (flag omitted)", () => {
    const out = resolveGenerationOutlineBlocks({
      segmentPageOutline: null,
      segmentLegacyBlockList: legacy,
      brandOutline: null,
      dsoFreeChoice: false,
    });
    expect(out.map((b) => b.type)).toEqual([
      canon("hero"),
      canon("feature-spotlight"),
      canon("cta-banner"),
    ]);
  });

  it("still HONORS an authored segment pageOutline even when honorLegacyBlockList is false", () => {
    const segmentPageOutline: PageOutline = {
      steps: [
        { kind: "block", type: "hero" },
        { kind: "block", type: "cta-banner" },
      ],
    };
    const out = resolveGenerationOutlineBlocks({
      segmentPageOutline,
      segmentLegacyBlockList: legacy,
      brandOutline: null,
      dsoFreeChoice: false,
      honorLegacyBlockList: false,
    });
    expect(out.map((b) => b.type)).toEqual([canon("hero"), canon("cta-banner")]);
  });

  it("still HONORS an authored brand pageOutline with no segment (authoritative path)", () => {
    const brandOutline: PageOutline = {
      steps: [
        { kind: "block", type: "hero" },
        { kind: "block", type: "feature-spotlight" },
      ],
    };
    const out = resolveGenerationOutlineBlocks({
      segmentPageOutline: null,
      segmentLegacyBlockList: null,
      brandOutline,
      dsoFreeChoice: false,
      honorLegacyBlockList: false,
    });
    expect(out.map((b) => b.type)).toEqual([canon("hero"), canon("feature-spotlight")]);
  });
});
