/**
 * Task #14 — End-to-end regression that the tenant page outline ("recipe",
 * task #6) actually drives the MICROSITE generator's output order/types, not
 * just the pure resolver.
 *
 * The lib resolver (`resolvePageOutline`) and the source-precedence selector
 * (`resolveMicrositeBlockSource`) are unit-tested elsewhere. This file pins the
 * FULL generator wiring: it mirrors the route's resolution chain
 * (effectiveOutline → resolveMicrositeBlockSource → resolvePageOutline) and
 * then feeds the result through the real `buildSystemPrompt`, asserting that the
 * fixed "AVAILABLE BLOCKS (use only these, in this order)" list the model is
 * told to emit matches the configured outline — across the segment-outline,
 * brand-default, segment-over-brand, graceful-fallback, and unconfigured
 * (free-choice) paths. A sibling file covers the landing-page generator.
 */
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, resolveMicrositeBlockSource } from "./generate-microsite";
import {
  effectiveOutline,
  normalizePageOutline,
  outlineHasSteps,
  resolvePageOutline,
  resolveBlockTags,
  type PageOutline,
} from "@workspace/lp-template-engine";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";

interface BlockListEntry {
  type?: string;
  schemaHint?: string;
}
interface Segment {
  id?: string;
  name?: string;
  pageOutline?: PageOutline;
  micrositeBlockList?: BlockListEntry[];
}
interface Brand {
  brandName?: string;
  defaultPageOutline?: PageOutline;
  defaultMicrositeBlockList?: BlockListEntry[];
}

/**
 * Faithfully mirror the production resolution chain in
 * `POST /accounts/:id/generate-microsite` (no DB / no network): pick the
 * effective outline, decide the block source, resolve category steps against
 * the approved pool, then build the real system prompt. Returns the decision +
 * the prompt the model would actually receive.
 */
function runOutline(input: {
  segment: Segment;
  brand: Brand;
  pool?: string[];
}): { source: string; orderedTypes: string[]; systemPrompt: string } {
  const { segment, brand } = input;
  const pool = input.pool ?? [];

  const segmentOutline = effectiveOutline({
    outline: normalizePageOutline(segment.pageOutline),
    legacyBlockList: (segment.micrositeBlockList ?? []).map((e) => ({
      type: e.type ?? "",
      schemaHint: e.schemaHint,
    })),
  });
  const brandOutline = effectiveOutline({
    outline: normalizePageOutline(brand.defaultPageOutline),
    legacyBlockList: (brand.defaultMicrositeBlockList ?? []).map((e) => ({
      type: e.type ?? "",
      schemaHint: e.schemaHint,
    })),
  });

  const source = resolveMicrositeBlockSource({
    hasTemplate: false,
    dsoFreeformMode: null,
    hasSegmentOutline: outlineHasSteps(segmentOutline),
    hasSegmentPool: pool.length > 0,
    hasBrandOutline: outlineHasSteps(brandOutline),
  });

  const activeOutline =
    source === "segment-outline" ? segmentOutline
    : source === "brand-outline" ? brandOutline
    : null;

  const outlineBlockList: BlockListEntry[] | undefined = activeOutline
    ? resolvePageOutline(activeOutline, {
        pool,
        rolesOf: (t) => resolveBlockTags(t),
        roleDefaults: { hero: "hero", cta: "bottom-cta", footer: "footer" },
        canonicalize: (t) => canonicalizeBlockType(t),
      }).map((r) => ({ type: r.type, schemaHint: r.schemaHint }))
    : undefined;

  const systemPrompt = buildSystemPrompt(
    segment,
    brand as unknown as Record<string, unknown>,
    undefined, // templateBlockTypes
    segment.name ?? null, // accountSegment
    source === "neutral-freeform", // useFreeform
    undefined, // templateBlocks
    null, // dsoFreeformMode
    pool, // segmentApprovedTypes
    source === "segment-pool", // usePoolFreeform
    outlineBlockList,
  );

  return { source, orderedTypes: fixedListTypes(systemPrompt), systemPrompt };
}

/**
 * Extract the ordered block types from the prompt's fixed list ("AVAILABLE
 * BLOCKS (use only these, in this order):\n1. \"type\": …"). Returns [] when the
 * prompt has no fixed list (i.e. a free-choice / freeform layout).
 */
function fixedListTypes(prompt: string): string[] {
  const marker = "AVAILABLE BLOCKS (use only these, in this order):";
  const idx = prompt.indexOf(marker);
  if (idx === -1) return [];
  const after = prompt.slice(idx + marker.length);
  return [...after.matchAll(/^\d+\.\s+"([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

const SEGMENT = { id: "ortho", name: "Orthodontists" } as const;

describe("generate-microsite — page outline drives output order (Task #14)", () => {
  it("forces block steps and resolves category steps from the approved pool, in order", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero", schemaHint: "network value prop" },
        { kind: "category", role: "social-proof" },
        { kind: "block", type: "bottom-cta" },
      ],
    };
    const { source, orderedTypes, systemPrompt } = runOutline({
      segment: { ...SEGMENT, pageOutline: outline },
      brand: { brandName: "Acme" },
      // Only `testimonial` carries the social-proof role; `benefits-grid` (features) must not be picked.
      pool: ["testimonial", "benefits-grid"],
    });
    expect(source).toBe("segment-outline");
    // Specific blocks forced exactly; the category resolved to the pooled
    // social-proof block; order is preserved end to end.
    expect(orderedTypes).toEqual(["dso-heartland-hero", "testimonial", "bottom-cta"]);
    // The forced block's schema hint reached the prompt.
    expect(systemPrompt).toContain("network value prop");
  });

  it("resolves a category step differently when the approved pool differs", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero" },
        { kind: "category", role: "social-proof" },
      ],
    };
    const { orderedTypes } = runOutline({
      segment: { ...SEGMENT, pageOutline: outline },
      brand: { brandName: "Acme" },
      // `trust-bar` is the only social-proof block in this pool.
      pool: ["trust-bar", "benefits-grid"],
    });
    expect(orderedTypes).toEqual(["dso-heartland-hero", "trust-bar"]);
  });

  it("falls back to the brand-default outline when the segment has none", () => {
    const { source, orderedTypes } = runOutline({
      segment: { ...SEGMENT },
      brand: {
        brandName: "Acme",
        defaultPageOutline: {
          steps: [
            { kind: "block", type: "hero" },
            { kind: "block", type: "benefits-grid" },
            { kind: "block", type: "footer" },
          ],
        },
      },
      pool: ["testimonial"],
    });
    expect(source).toBe("brand-outline");
    expect(orderedTypes).toEqual(["hero", "benefits-grid", "footer"]);
  });

  it("prefers the segment outline over the brand-default outline", () => {
    const { source, orderedTypes } = runOutline({
      segment: {
        ...SEGMENT,
        pageOutline: { steps: [{ kind: "block", type: "dso-heartland-hero" }] },
      },
      brand: {
        brandName: "Acme",
        defaultPageOutline: { steps: [{ kind: "block", type: "benefits-grid" }] },
      },
    });
    expect(source).toBe("segment-outline");
    expect(orderedTypes).toEqual(["dso-heartland-hero"]);
    expect(orderedTypes).not.toContain("benefits-grid");
  });

  it("adapts a legacy micrositeBlockList into a forced outline (no new outline set)", () => {
    const { source, orderedTypes } = runOutline({
      segment: {
        ...SEGMENT,
        micrositeBlockList: [{ type: "hero" }, { type: "testimonial" }, { type: "footer" }],
      },
      brand: { brandName: "Acme" },
    });
    expect(source).toBe("segment-outline");
    expect(orderedTypes).toEqual(["hero", "testimonial", "footer"]);
  });

  it("degrades gracefully: required chrome category falls back, unmatched body category is dropped", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero" },
        // No social-proof block in the (empty) pool and no role default → skipped.
        { kind: "category", role: "social-proof" },
        // Required cta with empty pool falls back to the structural default.
        { kind: "category", role: "cta" },
      ],
    };
    let result!: ReturnType<typeof runOutline>;
    expect(() => {
      result = runOutline({
        segment: { ...SEGMENT, pageOutline: outline },
        brand: { brandName: "Acme" },
        pool: [],
      });
    }).not.toThrow();
    // The forced hero survives; the unmatched social-proof category is absent;
    // the required cta resolved to its structural default.
    expect(result.orderedTypes).toEqual(["dso-heartland-hero", "bottom-cta"]);
  });

  it("uses the model's free block choice when nothing is configured (no outline, no pool)", () => {
    const { source, orderedTypes, systemPrompt } = runOutline({
      segment: { ...SEGMENT },
      brand: { brandName: "Acme" },
    });
    expect(source).toBe("neutral-freeform");
    // No fixed list — the model freely composes the layout.
    expect(orderedTypes).toEqual([]);
    expect(systemPrompt).not.toContain("AVAILABLE BLOCKS (use only these, in this order):");
    expect(systemPrompt).toContain(
      "AVAILABLE BLOCKS (choose from these — you decide which and in what order):",
    );
  });
});
