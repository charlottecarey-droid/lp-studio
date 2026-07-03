/**
 * Recipe ↔ prompt-vocabulary drift guard (June 2026, page-variety workstream).
 *
 * Every block type named in a page recipe's skeleton MUST be advertised by the
 * corresponding prompt path's system prompt — invalid types would be silently
 * ignored by the model or break normalization. This cross-check pins the
 * recipes to the real vocabularies so neither can drift without failing CI.
 *
 * The DSO prompts are checked in their NARROWEST form (non-Dandy tenant, which
 * omits the Dandy-only insights blocks) so recipes never reference a block
 * that only some tenants can use.
 */
import { describe, it, expect } from "vitest";
import {
  buildGeneralSystemPrompt,
  buildDsoSystemPrompt,
  buildDsoPracticesSystemPrompt,
} from "./generate-page";
import {
  FREEFORM_RECIPES,
  DSO_RECIPES,
  DSO_PRACTICES_RECIPES,
  MICROSITE_RECIPES,
  recipeSkeletonBlockTypes,
} from "../../lib/ai-prompts/page-recipes";
import { advertisedBlockTypesForPath } from "../../lib/ai-prompts/recipe-block-vocab";

/** Every block schema bullet looks like `- "type": …`; collect the types. */
function advertisedTypes(prompt: string): Set<string> {
  const types = new Set<string>();
  for (const line of prompt.split("\n")) {
    const m = line.match(/^- "([a-z0-9-]+)":/);
    if (m) types.add(m[1]);
  }
  return types;
}

describe("page-recipe skeletons reference only advertised block types", () => {
  it("FREEFORM recipes ⊆ GENERAL prompt vocabulary", () => {
    const vocab = advertisedTypes(buildGeneralSystemPrompt());
    for (const recipe of FREEFORM_RECIPES) {
      for (const type of recipeSkeletonBlockTypes(recipe)) {
        expect(vocab.has(type), `recipe "${recipe.id}" names unknown GENERAL block "${type}"`).toBe(true);
      }
    }
  });

  it("GENERAL prompt advertises the June-2026 modern block wave (logo-marquee stays excluded)", () => {
    const vocab = advertisedTypes(buildGeneralSystemPrompt());
    for (const type of [
      "launch-spotlight-hero",
      "bento-mosaic-hero",
      "kinetic-type-hero",
      "glass-bento-features",
      "feature-tabs-showcase",
      "stat-counter-band",
      "testimonial-wall",
      "glass-pricing-tiers",
      "aurora-cta-finale",
    ]) {
      expect(vocab.has(type), `GENERAL prompt is missing "${type}"`).toBe(true);
    }
    // logo-marquee carries tenant-supplied customer logos — deliberately NOT
    // part of the AI vocabulary (auto-fabricated customer logos = false proof).
    expect(vocab.has("logo-marquee")).toBe(false);
  });

  it("GENERAL prompt advertises the premium DSO content blocks, brand-neutrally", () => {
    const prompt = buildGeneralSystemPrompt();
    const vocab = advertisedTypes(prompt);
    for (const type of ["dso-stat-row", "dso-ai-feature", "dso-final-cta"]) {
      expect(vocab.has(type), `GENERAL prompt is missing "${type}"`).toBe(true);
    }
    // The general bullets stay neutral: no Dandy-only background preset and no
    // dental / "AI Scan Review" product framing leaks into the cross-tenant prompt.
    expect(prompt).not.toContain("dandy-green");
    expect(prompt).not.toContain("AI Scan Review");
  });

  it("DSO recipes ⊆ DSO prompt vocabulary (non-Dandy, narrowest form)", () => {
    const vocab = advertisedTypes(buildDsoSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" }));
    for (const recipe of DSO_RECIPES) {
      for (const type of recipeSkeletonBlockTypes(recipe)) {
        expect(vocab.has(type), `recipe "${recipe.id}" names unknown DSO block "${type}"`).toBe(true);
      }
    }
  });

  it("DSO-PRACTICES recipes ⊆ DSO Practices prompt vocabulary (non-Dandy)", () => {
    const vocab = advertisedTypes(
      buildDsoPracticesSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" }),
    );
    for (const recipe of DSO_PRACTICES_RECIPES) {
      for (const type of recipeSkeletonBlockTypes(recipe)) {
        expect(vocab.has(type), `recipe "${recipe.id}" names unknown DSO-Practices block "${type}"`).toBe(true);
      }
    }
  });

  it("MICROSITE recipes ⊆ microsite prompt vocabulary", () => {
    // The microsite vocabulary now equals the GENERAL landing-page block set
    // (parsed from its system prompt) UNIONED with a few microsite-only extras
    // (stats / rich-text / footer), resolved via the shared allow-set helper the
    // recipe builder uses — keeping recipe + generator in lockstep.
    const vocab = advertisedBlockTypesForPath("microsite");
    expect(vocab.size).toBeGreaterThan(0);
    for (const recipe of MICROSITE_RECIPES) {
      for (const type of recipeSkeletonBlockTypes(recipe)) {
        expect(vocab.has(type), `recipe "${recipe.id}" names unknown MICROSITE block "${type}"`).toBe(true);
      }
    }
  });

  it("both DSO prompts still contain the 'loose flow' marker the recipe injection replaces", () => {
    const markerRe = /A loose flow that works is [^\n]*? — but treat this as ONE option, never a fixed template you must follow\./;
    expect(buildDsoSystemPrompt({ isDandyTenant: false, brandName: "Acme" })).toMatch(markerRe);
    expect(buildDsoPracticesSystemPrompt({ isDandyTenant: false, brandName: "Acme" })).toMatch(markerRe);
    expect(buildDsoSystemPrompt({ isDandyTenant: true, brandName: "Dandy" })).toMatch(markerRe);
    expect(buildDsoPracticesSystemPrompt({ isDandyTenant: true, brandName: "Dandy" })).toMatch(markerRe);
  });
});

// July 2026 — recipe-selector expansion parity: the landing DSO paths inject
// recipe-referenced extra blocks as ADDITIONAL APPROVED BLOCKS. The wiring is
// route-level (recipePool -> injection union); this pins the building blocks
// it relies on: every dso/dso-practices recipe slot type is either already in
// the DSO prompt vocabulary or describable from the GENERAL library, so the
// injection can always advertise it with a real schema.
describe("recipe-selector expansion — every DSO recipe block is advertisable", () => {
  const general = buildGeneralSystemPrompt({
    includeContentSeries: true,
    includeWebinarHub: true,
    includeBlogSeries: true,
    includeStorefront: true,
  });
  const advertised = (prompt: string): Set<string> =>
    new Set([...prompt.matchAll(/^- "([a-z0-9-]+)":/gm)].map((m) => m[1]));

  it.each([
    ["dso", DSO_RECIPES, buildDsoSystemPrompt({ isDandyTenant: true, brandName: "Dandy" })],
    ["dso-practices", DSO_PRACTICES_RECIPES, buildDsoPracticesSystemPrompt({ isDandyTenant: true, brandName: "Dandy" })],
  ])("%s recipes are fully coverable by path vocab + GENERAL library", (_path, recipes, dsoPrompt) => {
    const dsoTypes = advertised(dsoPrompt);
    const generalTypes = advertised(general);
    for (const recipe of recipes) {
      for (const slot of recipe.skeleton) {
        for (const opt of slot.split(/\s+OR\s+/)) {
          const t = opt.trim();
          expect(
            dsoTypes.has(t) || generalTypes.has(t),
            `${recipe.id}: "${t}" is neither in the ${_path} vocab nor describable from the GENERAL library`,
          ).toBe(true);
        }
      }
    }
  });
});
