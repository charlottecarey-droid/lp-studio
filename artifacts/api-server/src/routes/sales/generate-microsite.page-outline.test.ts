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
import { buildSystemPrompt, resolveMicrositeBlockSource, reconcileBlocksToOutline } from "./generate-microsite";
import {
  effectiveOutline,
  normalizePageOutline,
  outlineHasSteps,
  resolvePageOutline,
  resolveBlockTags,
  NEUTRAL_ROLE_DEFAULT_BLOCKS,
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
  dsoFreeformMode?: "enterprise" | "practices" | null;
}): { source: string; orderedTypes: string[]; systemPrompt: string } {
  const { segment, brand } = input;
  const pool = input.pool ?? [];
  const dsoFreeformMode = input.dsoFreeformMode ?? null;

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
    dsoFreeformMode,
    hasSegmentOutline: outlineHasSteps(normalizePageOutline(segment.pageOutline)),
    hasSegmentPool: pool.length > 0,
    hasBrandOutline: outlineHasSteps(normalizePageOutline(brand.defaultPageOutline)),
    hasSegmentLegacyOutline: outlineHasSteps(segmentOutline),
    hasBrandLegacyOutline: outlineHasSteps(brandOutline),
  });

  const activeOutline =
    source === "segment-outline" ? segmentOutline
    : source === "brand-outline" ? brandOutline
    : null;

  const outlineBlockList: BlockListEntry[] | undefined = activeOutline
    ? resolvePageOutline(activeOutline, {
        pool,
        rolesOf: (t) => resolveBlockTags(t),
        roleDefaults: NEUTRAL_ROLE_DEFAULT_BLOCKS,
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
    dsoFreeformMode, // dsoFreeformMode
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

  // July 2026 precedence revision: a legacy micrositeBlockList must NOT freeze
  // the lineup when a recipe-driven path applies — that re-created the exact
  // "every Dandy microsite is identical" convergence dso-freeform was built to
  // escape. Explicit outlines still beat everything but templates.
  it("legacy list LOSES to dso-freeform (recipes drive Dandy microsites again)", () => {
    const { source } = runOutline({
      segment: {
        ...SEGMENT,
        micrositeBlockList: [{ type: "hero" }, { type: "testimonial" }, { type: "footer" }],
      },
      brand: { brandName: "Acme" },
      dsoFreeformMode: "enterprise",
    });
    expect(source).toBe("dso-freeform");
  });

  it("legacy list LOSES to the segment pool", () => {
    const { source } = runOutline({
      segment: {
        ...SEGMENT,
        micrositeBlockList: [{ type: "hero" }, { type: "testimonial" }, { type: "footer" }],
      },
      brand: { brandName: "Acme" },
      pool: ["benefits-grid", "testimonial"],
    });
    expect(source).toBe("segment-pool");
  });

  it("an EXPLICIT segment pageOutline still beats dso-freeform", () => {
    const { source } = runOutline({
      segment: {
        ...SEGMENT,
        pageOutline: { steps: [{ kind: "block", type: "hero" }, { kind: "block", type: "footer" }] },
      },
      brand: { brandName: "Acme" },
      dsoFreeformMode: "enterprise",
    });
    expect(source).toBe("segment-outline");
  });

  it("degrades gracefully: a category with no neutral default and empty pool is dropped; covered roles fall back", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero" },
        // `faq` has no neutral role default and the pool is empty → skipped.
        { kind: "category", role: "faq" },
        // `cta` IS covered by the neutral defaults, so it falls back even
        // though the pool is empty.
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
    // The forced hero survives; the uncovered faq category is absent; the cta
    // category resolved to its neutral default.
    expect(result.orderedTypes).toEqual(["dso-heartland-hero", "bottom-cta"]);
  });

  it("renders EVERY authored category step even with an empty approved pool (generic-tenant brand default)", () => {
    // Reproduces the reported bug: a brand-default outline made of category
    // steps must NOT collapse to just hero/cta/footer when the tenant has no
    // curated/approved pool. Every role falls back to a neutral default block.
    const { source, orderedTypes } = runOutline({
      segment: { ...SEGMENT },
      brand: {
        brandName: "Acme",
        defaultPageOutline: {
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
        },
      },
      pool: [],
    });
    expect(source).toBe("brand-outline");
    // All eight authored steps survive (previously collapsed to ~3).
    expect(orderedTypes).toHaveLength(8);
    expect(orderedTypes).toEqual(
      expect.arrayContaining(["hero", "testimonial", "bottom-cta", "footer"]),
    );
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

  it("still emits the fixed outline list when the segment carries a DSO vocabulary (Defect B)", () => {
    // A Dandy/DSO segment can have BOTH a configured outline AND a DSO
    // vocabulary (dsoFreeformMode). The outline must win: buildSystemPrompt must
    // emit the fixed ordered list — not the DSO "vary the mix" freeform
    // vocabulary — or the configured order is silently dropped on DSO segments.
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "dso-heartland-hero" },
        { kind: "block", type: "dso-success-stories" },
        { kind: "block", type: "dso-final-cta" },
      ],
    };
    const { source, orderedTypes, systemPrompt } = runOutline({
      segment: { ...SEGMENT, pageOutline: outline },
      brand: { brandName: "Acme" },
      dsoFreeformMode: "enterprise",
    });
    expect(source).toBe("segment-outline");
    expect(orderedTypes).toEqual([
      "dso-heartland-hero",
      "dso-success-stories",
      "dso-final-cta",
    ]);
    // The fixed-list marker is present; the freeform "choose from these" marker
    // (used by the DSO / pool / neutral branches) is not.
    expect(systemPrompt).toContain("AVAILABLE BLOCKS (use only these, in this order):");
    expect(systemPrompt).not.toContain("AVAILABLE BLOCKS (choose from these");
  });
});

describe("reconcileBlocksToOutline — hard order authority (pure)", () => {
  const BRAND = {
    name: "Acme",
    tagline: "",
    valuePropPairs: [] as { theme: string; proof: string }[],
  };

  it("reorders scrambled AI blocks into the outline order, preserving props + id", () => {
    const outline = [
      { type: "hero" },
      { type: "testimonial" },
      { type: "bottom-cta" },
      { type: "footer" },
    ];
    const aiBlocks = [
      { type: "footer", id: "f1", props: { note: "foot" } },
      { type: "bottom-cta", id: "c1", props: {} },
      { type: "hero", id: "h1", props: { headline: "Hi" } },
      { type: "testimonial", id: "t1", props: {} },
    ];
    const result = reconcileBlocksToOutline(aiBlocks, outline, BRAND);
    expect(result.map((b) => b.type)).toEqual([
      "hero",
      "testimonial",
      "bottom-cta",
      "footer",
    ]);
    // The model contributes copy; the outline contributes order — so the hero
    // keeps the AI's id + headline.
    expect(result[0].id).toBe("h1");
    expect((result[0].props as { headline?: string }).headline).toBe("Hi");
    expect(result[3].id).toBe("f1");
  });

  it("drops AI blocks whose type is not in the outline", () => {
    const outline = [{ type: "hero" }, { type: "footer" }];
    const aiBlocks = [
      { type: "hero", id: "h1", props: {} },
      { type: "pricing", id: "p1", props: {} },
      { type: "footer", id: "f1", props: {} },
    ];
    const result = reconcileBlocksToOutline(aiBlocks, outline, BRAND);
    expect(result.map((b) => b.type)).toEqual(["hero", "footer"]);
    expect(result.some((b) => b.type === "pricing")).toBe(false);
  });

  it("synthesizes a default block for an outline slot the AI omitted", () => {
    const outline = [{ type: "hero" }, { type: "testimonial" }, { type: "footer" }];
    const aiBlocks = [
      { type: "hero", id: "h1", props: { headline: "H" } },
      { type: "footer", id: "f1", props: {} },
    ];
    const result = reconcileBlocksToOutline(aiBlocks, outline, BRAND);
    expect(result.map((b) => b.type)).toEqual(["hero", "testimonial", "footer"]);
    // The omitted testimonial slot still exists, synthesized with a props object.
    expect(result[1].type).toBe("testimonial");
    expect(typeof result[1].props).toBe("object");
    expect(result[1].props).not.toBeNull();
  });
});
