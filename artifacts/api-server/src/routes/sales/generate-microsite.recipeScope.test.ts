/**
 * Task #1411 — recipe-driven layout VARIETY is scoped to neutral-freeform ONLY.
 *
 * The route only resolves a `micrositeRecipe` on the neutral-freeform path, and
 * buildSystemPrompt only consumes it in the `useFreeform && !hasOutlineFixedList`
 * branch. The DSO-freeform and segment-pool branches return BEFORE it, and the
 * template/outline paths never enter the freeform branch. These tests lock that
 * scoping so a future change can't leak the recipe suggestion into DSO,
 * segment-pool, template, or outline generations (which must stay unchanged).
 *
 * Positional buildSystemPrompt args (mirrors the route call + sibling tests):
 *   segment, brand, templateBlockTypes, accountSegment, useFreeform,
 *   templateBlocks, dsoFreeformMode, segmentApprovedTypes, usePoolFreeform,
 *   outlineBlockList, selectedPersona, excludeTypes, micrositeRecipe
 */
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type BrandAudienceSegment } from "./generate-microsite";
import { MICROSITE_RECIPES } from "../../lib/ai-prompts/page-recipes";

const CORE: BrandAudienceSegment = { id: "core", name: "Core" };
const BRAND = { brandName: "Acme", segments: [] as BrandAudienceSegment[] };
const RECIPE = MICROSITE_RECIPES[0];
const GENERIC_FLOW = "Sequence sections as a logical narrative";

describe("buildSystemPrompt — microsite recipe injection scoping (Task #1411)", () => {
  it("injects the recipe's flow + art-direction on the neutral-freeform path", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ true, undefined, null, [], false, undefined, undefined, new Set(), RECIPE,
    );
    expect(prompt).toContain(`"${RECIPE.label}"`);
    expect(prompt).toContain("STARTING SUGGESTION");
    // The generic fallback narrative is replaced, not appended.
    expect(prompt).not.toContain(GENERIC_FLOW);
  });

  it("falls back to the generic narrative flow when no recipe resolves (freeform)", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ true, undefined, null, [], false, undefined, undefined, new Set(), null,
    );
    expect(prompt).toContain(GENERIC_FLOW);
    expect(prompt).not.toContain("STARTING SUGGESTION");
  });

  it("does NOT inject the recipe on the segment-pool path (usePoolFreeform)", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ false, undefined, null, ["hero", "benefits-grid", "bottom-cta", "footer"], /*usePoolFreeform*/ true, undefined, undefined, new Set(), RECIPE,
    );
    expect(prompt).not.toContain(`"${RECIPE.label}"`);
    expect(prompt).not.toContain("STARTING SUGGESTION");
  });

  it("does NOT inject the recipe on the DSO-freeform path", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ false, undefined, /*dsoFreeformMode*/ "practices", [], false, undefined, undefined, new Set(), RECIPE,
    );
    expect(prompt).not.toContain(`"${RECIPE.label}"`);
    expect(prompt).not.toContain("STARTING SUGGESTION");
  });

  it("does NOT inject the recipe on the fixed-list (template/curated) path", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ false, undefined, null, [], false, undefined, undefined, new Set(), RECIPE,
    );
    expect(prompt).not.toContain(`"${RECIPE.label}"`);
    expect(prompt).not.toContain("STARTING SUGGESTION");
  });

  it("does NOT inject the recipe when an outline fixes the block list, even with useFreeform", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ true, undefined, null, [], false, /*outlineBlockList*/ [{ type: "hero" }, { type: "footer" }], undefined, new Set(), RECIPE,
    );
    expect(prompt).not.toContain(`"${RECIPE.label}"`);
    expect(prompt).not.toContain("STARTING SUGGESTION");
  });
});
