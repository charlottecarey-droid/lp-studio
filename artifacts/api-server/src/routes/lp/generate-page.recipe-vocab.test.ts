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
  recipeSkeletonBlockTypes,
} from "../../lib/ai-prompts/page-recipes";

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

  it("both DSO prompts still contain the 'loose flow' marker the recipe injection replaces", () => {
    const markerRe = /A loose flow that works is [^\n]*? — but treat this as ONE option, never a fixed template you must follow\./;
    expect(buildDsoSystemPrompt({ isDandyTenant: false, brandName: "Acme" })).toMatch(markerRe);
    expect(buildDsoPracticesSystemPrompt({ isDandyTenant: false, brandName: "Acme" })).toMatch(markerRe);
    expect(buildDsoSystemPrompt({ isDandyTenant: true, brandName: "Dandy" })).toMatch(markerRe);
    expect(buildDsoPracticesSystemPrompt({ isDandyTenant: true, brandName: "Dandy" })).toMatch(markerRe);
  });
});
