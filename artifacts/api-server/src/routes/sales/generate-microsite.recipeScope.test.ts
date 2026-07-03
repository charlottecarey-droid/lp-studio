/**
 * Recipe-driven layout VARIETY is scoped to the FREEFORM paths.
 *
 * The route resolves a `micrositeRecipe` on the neutral-freeform path (the
 * "microsite" recipe group) AND on the DSO-freeform path (the "dso" /
 * "dso-practices" groups, the same ones the landing pages rotate).
 * buildSystemPrompt consumes it in both the `useFreeform` branch and the
 * `dsoFreeformMode` branch. The segment-pool, template, and outline paths never
 * inject it. These tests lock that scoping so a future change can't (a) leak the
 * recipe suggestion into segment-pool / template / outline generations, nor
 * (b) silently DROP it from the DSO path.
 *
 * Positional buildSystemPrompt args (mirrors the route call + sibling tests):
 *   segment, brand, templateBlockTypes, accountSegment, useFreeform,
 *   templateBlocks, dsoFreeformMode, segmentApprovedTypes, usePoolFreeform,
 *   outlineBlockList, selectedPersona, excludeTypes, micrositeRecipe
 */
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type BrandAudienceSegment,
  BLOCK_PROP_SCHEMAS,
} from "./generate-microsite";
import { MICROSITE_RECIPES, DSO_RECIPES, DSO_PRACTICES_RECIPES } from "../../lib/ai-prompts/page-recipes";

const CORE: BrandAudienceSegment = { id: "core", name: "Core" };
const BRAND = { brandName: "Acme", segments: [] as BrandAudienceSegment[] };
const RECIPE = MICROSITE_RECIPES[0];
const GENERIC_FLOW = "Sequence sections as a logical narrative";
const FREESTYLE_MARKER = "WHEN THE SUGGESTED RECIPE / FLOW DOES NOT FIT";

describe("buildSystemPrompt — microsite recipe injection scoping (Task #1411)", () => {
  it("injects the recipe's flow + art-direction on the neutral-freeform path", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ true, undefined, null, [], false, undefined, undefined, new Set(), RECIPE,
    );
    expect(prompt).toContain(`"${RECIPE.label}"`);
    expect(prompt).toContain("STARTING SUGGESTION");
    // Off-topic requests are told to discard the recipe and freestyle.
    expect(prompt).toContain(FREESTYLE_MARKER);
    // The proof/metrics/CTA requirement is conditional, not absolute, so an
    // off-topic page isn't forced into a sales structure.
    expect(prompt).toContain("does NOT apply when the freestyle rule below takes over");
    // The generic fallback narrative is replaced, not appended.
    expect(prompt).not.toContain(GENERIC_FLOW);
  });

  it("falls back to the generic narrative flow when no recipe resolves (freeform)", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ true, undefined, null, [], false, undefined, undefined, new Set(), null,
    );
    expect(prompt).toContain(GENERIC_FLOW);
    expect(prompt).not.toContain("STARTING SUGGESTION");
    // The freestyle override still applies even without a resolved recipe.
    expect(prompt).toContain(FREESTYLE_MARKER);
  });

  it("does NOT inject the recipe on the segment-pool path (usePoolFreeform)", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ false, undefined, null, ["hero", "benefits-grid", "bottom-cta", "footer"], /*usePoolFreeform*/ true, undefined, undefined, new Set(), RECIPE,
    );
    expect(prompt).not.toContain(`"${RECIPE.label}"`);
    expect(prompt).not.toContain("STARTING SUGGESTION");
    // Freestyle override is scoped to neutral-freeform; not the segment-pool path.
    expect(prompt).not.toContain(FREESTYLE_MARKER);
  });

  it("injects the recipe's suggested flow on the DSO-freeform path", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ false, undefined, /*dsoFreeformMode*/ "practices", [], false, undefined, undefined, new Set(), RECIPE,
    );
    // DSO microsites now rotate the same DSO recipe groups as the landing pages,
    // injected as an adaptable suggestion within the DSO hero-first /
    // dso-final-cta-last rules.
    expect(prompt).toContain(`"${RECIPE.label}"`);
    expect(prompt).toContain("STARTING SUGGESTION");
    // The neutral-freeform freestyle override stays scoped to neutral-freeform.
    expect(prompt).not.toContain(FREESTYLE_MARKER);
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

// July 2026 — recipe-selector vocabulary expansion: block types referenced by
// the path's recipe pool (beyond the fixed dso-* vocabulary) must be offered
// to the model on the DSO paths, with their real prop schemas, so recipes
// authored in the recipe maker can use them.
describe("buildSystemPrompt — recipe-selector vocabulary expansion (DSO paths)", () => {
  it("advertises recipe-referenced extra blocks on the DSO enterprise path", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ false, undefined, /*dsoFreeformMode*/ "enterprise",
      /*segmentApprovedTypes*/ [], false, undefined, undefined, new Set(), null,
      /*recipeExtraTypes*/ ["zigzag-features"],
    );
    expect(prompt).toContain('"zigzag-features"');
  });

  it("does not advertise extras it wasn't given", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, false, undefined, "enterprise",
      [], false, undefined, undefined, new Set(), null,
    );
    expect(prompt).not.toContain('"zigzag-features"');
  });

  it("advertises recipe-referenced extras on the NEUTRAL freeform path too", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, /*useFreeform*/ true, undefined, null,
      [], false, undefined, undefined, new Set(), null,
      /*recipeExtraTypes*/ ["dso-stat-row"],
    );
    expect(prompt).toContain('"dso-stat-row"');
  });

  it("governance excludeTypes still strips a recipe-referenced extra", () => {
    const prompt = buildSystemPrompt(
      CORE, BRAND, undefined, null, false, undefined, "enterprise",
      [], false, undefined, undefined, new Set(["zigzag-features"]), null,
      ["zigzag-features"],
    );
    expect(prompt).not.toContain('"zigzag-features"');
  });
});

// July 2026 — every block referenced by the BUILT-IN recipe pools must have a
// real microsite prop schema, or the vocabulary expansion silently skips it
// (the "recipe-referenced types without a microsite schema skipped" log from
// the first full eval run named ten such gaps; this pins them closed).
describe("built-in recipe pools are fully schema-covered on microsites", () => {
  it.each([
    ["dso", DSO_RECIPES],
    ["dso-practices", DSO_PRACTICES_RECIPES],
    ["microsite", MICROSITE_RECIPES],
  ])("%s pool", (_path, recipes) => {
    for (const recipe of recipes) {
      for (const slot of recipe.skeleton) {
        for (const opt of slot.split(/\s+OR\s+/)) {
          const t = opt.trim();
          expect(
            BLOCK_PROP_SCHEMAS[t],
            `${recipe.id}: "${t}" has no microsite prop schema — it would be silently skipped`,
          ).toBeTruthy();
        }
      }
    }
  });
});
