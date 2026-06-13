/**
 * Unit tests for the page-recipe rotation + block-sequence repeat guard
 * (June 2026, page-variety workstream). Pure logic only — no DB, no network.
 *
 * The cross-check that every recipe skeleton block type exists in the
 * corresponding prompt path's advertised vocabulary lives in
 * routes/lp/generate-page.recipe-vocab.test.ts (it needs the prompt builders).
 */
import { describe, it, expect } from "vitest";
import {
  FREEFORM_RECIPES,
  DSO_RECIPES,
  DSO_PRACTICES_RECIPES,
  recipesForPath,
  recipeSkeletonBlockTypes,
  pickRecipe,
  buildRecipeDirective,
  injectRecipeIntoBlockSelection,
  blockSequenceHash,
  shouldRetryForRepeatedSequence,
  buildRepeatCorrectiveMessage,
  SEQUENCE_STRUCTURAL_TYPES,
  type PageRecipe,
} from "./page-recipes";

describe("recipe sets", () => {
  it("has 4-5 freeform recipes and 3 per DSO path, all with unique ids and non-empty skeletons", () => {
    expect(FREEFORM_RECIPES.length).toBeGreaterThanOrEqual(4);
    expect(FREEFORM_RECIPES.length).toBeLessThanOrEqual(5);
    expect(DSO_RECIPES).toHaveLength(3);
    expect(DSO_PRACTICES_RECIPES).toHaveLength(3);
    const all = [...FREEFORM_RECIPES, ...DSO_RECIPES, ...DSO_PRACTICES_RECIPES];
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const r of all) {
      expect(r.skeleton.length).toBeGreaterThanOrEqual(4);
      expect(r.styleNotes.length).toBeGreaterThan(20);
      expect(recipeSkeletonBlockTypes(r).every((t) => /^[a-z0-9-]+$/.test(t))).toBe(true);
    }
  });

  it("recipesForPath routes to the right set", () => {
    expect(recipesForPath("freeform")).toBe(FREEFORM_RECIPES);
    expect(recipesForPath("dso")).toBe(DSO_RECIPES);
    expect(recipesForPath("dso-practices")).toBe(DSO_PRACTICES_RECIPES);
  });

  it("recipeSkeletonBlockTypes splits OR-alternatives into individual types", () => {
    const recipe: PageRecipe = {
      id: "x",
      label: "x",
      description: "x",
      skeleton: ["a OR b", "c", "d OR e OR f"],
      styleNotes: "x",
    };
    expect(recipeSkeletonBlockTypes(recipe)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("pickRecipe — least-recently-used with random fallback", () => {
  const recipes = FREEFORM_RECIPES;

  it("picks the recipe NOT present in recent history (never-used beats used)", () => {
    // Everything except freeform-data-led was used recently.
    const recent = recipes.map((r) => r.id).filter((id) => id !== "freeform-data-led");
    const picked = pickRecipe(recipes, recent, () => 0);
    expect(picked?.id).toBe("freeform-data-led");
  });

  it("picks the least-recently-used recipe when all have been used", () => {
    // Most-recent-first history covering every recipe: the LAST entry is stalest.
    const recent = recipes.map((r) => r.id);
    const stalest = recent[recent.length - 1];
    const picked = pickRecipe(recipes, recent, () => 0);
    expect(picked?.id).toBe(stalest);
  });

  it("ignores duplicate later mentions — recency is the FIRST (most recent) occurrence", () => {
    const [a, b, c, d, e] = recipes.map((r) => r.id);
    // b is stalest: a,c,d,e all used more recently; b only appears at the end.
    const recent = [a, c, d, e, b];
    expect(pickRecipe(recipes, recent, () => 0)?.id).toBe(b);
  });

  it("falls back to random among never-used candidates (empty history)", () => {
    const first = pickRecipe(recipes, [], () => 0);
    const last = pickRecipe(recipes, [], () => 0.999);
    expect(first?.id).toBe(recipes[0].id);
    expect(last?.id).toBe(recipes[recipes.length - 1].id);
  });

  it("returns null for an empty recipe set", () => {
    expect(pickRecipe([], [])).toBeNull();
  });

  describe("excludeRecipeIds — 'Shuffle layout' exclusions", () => {
    it("removes excluded ids from the candidate pool BEFORE LRU selection", () => {
      // freeform-data-led is the lone never-used recipe and would win the LRU
      // pick — excluding it must hand the win to the stalest USED recipe.
      const recent = recipes.map((r) => r.id).filter((id) => id !== "freeform-data-led");
      const withoutExclusion = pickRecipe(recipes, recent, () => 0);
      expect(withoutExclusion?.id).toBe("freeform-data-led");
      const picked = pickRecipe(recipes, recent, () => 0, ["freeform-data-led"]);
      expect(picked).not.toBeNull();
      expect(picked?.id).toBe(recent[recent.length - 1]); // stalest of the rest
    });

    it("guarantees a different recipe than the single excluded one (shuffle contract)", () => {
      for (const r of recipes) {
        for (const tie of [0, 0.5, 0.999]) {
          expect(pickRecipe(recipes, [], () => tie, [r.id])?.id).not.toBe(r.id);
        }
      }
    });

    it("falls back to the full pool minus the FIRST excluded id when exclusion empties the pool", () => {
      const allIds = recipes.map((r) => r.id);
      const picked = pickRecipe(recipes, [], () => 0, allIds);
      expect(picked).not.toBeNull();
      expect(picked?.id).not.toBe(allIds[0]);
    });

    it("never fails even when a single-recipe pool is fully excluded", () => {
      const only = [recipes[0]];
      expect(pickRecipe(only, [], () => 0, [recipes[0].id])?.id).toBe(recipes[0].id);
    });

    it("ignores an empty exclusion list (behavior identical to the 3-arg call)", () => {
      const recent = recipes.map((r) => r.id);
      expect(pickRecipe(recipes, recent, () => 0, [])?.id).toBe(
        pickRecipe(recipes, recent, () => 0)?.id,
      );
    });

    it("ignores unknown ids — they exclude nothing", () => {
      const recent = recipes.map((r) => r.id).filter((id) => id !== "freeform-data-led");
      const picked = pickRecipe(recipes, recent, () => 0, ["nope", "not-a-recipe"]);
      expect(picked?.id).toBe("freeform-data-led");
    });
  });
});

describe("buildRecipeDirective / injectRecipeIntoBlockSelection", () => {
  const recipe = DSO_RECIPES[0];

  it("directive frames the recipe as adaptable and user-request-overridable", () => {
    const text = buildRecipeDirective(recipe);
    expect(text).toContain("RECIPE FOR THIS GENERATION");
    expect(text).toContain(recipe.label);
    expect(text).toContain("NOT a mandatory template");
    expect(text).toMatch(/EXPLICIT USER REQUESTS ALWAYS OVERRIDE/);
    for (const entry of recipe.skeleton) expect(text).toContain(entry);
  });

  it("replaces the 'loose flow that works' example sentence with the recipe", () => {
    const prompt = [
      "5. BLOCK SELECTION — vary the mix.",
      "A loose flow that works is hero → problem → stat-showcase → cta — but treat this as ONE option, never a fixed template you must follow.",
      "EXPLICIT REQUESTS OVERRIDE VARIETY.",
    ].join(" ");
    const { prompt: out, injected } = injectRecipeIntoBlockSelection(prompt, recipe);
    expect(injected).toBe(true);
    expect(out).not.toContain("A loose flow that works is");
    expect(out).toContain("RECIPE FOR THIS GENERATION");
    expect(out).toContain(recipe.skeleton.join(" → "));
    // Surrounding rule text is preserved.
    expect(out).toContain("EXPLICIT REQUESTS OVERRIDE VARIETY.");
  });

  it("returns the prompt unchanged when the marker sentence is absent", () => {
    const prompt = "RULES: no loose flow example here.";
    const { prompt: out, injected } = injectRecipeIntoBlockSelection(prompt, recipe);
    expect(injected).toBe(false);
    expect(out).toBe(prompt);
  });
});

describe("blockSequenceHash", () => {
  it("is stable for the same sequence", () => {
    const types = ["hero", "benefits-grid", "comparison", "bottom-cta"];
    expect(blockSequenceHash(types)).toBe(blockSequenceHash([...types]));
    expect(blockSequenceHash(types)).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is order-sensitive", () => {
    expect(blockSequenceHash(["hero", "comparison", "benefits-grid"])).not.toBe(
      blockSequenceHash(["hero", "benefits-grid", "comparison"]),
    );
  });

  it("ignores purely structural blocks (nav/footer/spacer/divider)", () => {
    const core = ["hero", "benefits-grid", "bottom-cta"];
    const withChrome = ["nav-header", "hero", "spacer", "benefits-grid", "divider", "bottom-cta", "footer"];
    expect(blockSequenceHash(withChrome)).toBe(blockSequenceHash(core));
    for (const t of ["spacer", "divider", "nav-header", "footer"]) {
      expect(SEQUENCE_STRUCTURAL_TYPES.has(t)).toBe(true);
    }
  });

  it("ignores empty/non-string entries", () => {
    expect(blockSequenceHash(["hero", "", "benefits-grid"])).toBe(
      blockSequenceHash(["hero", "benefits-grid"]),
    );
  });
});

describe("shouldRetryForRepeatedSequence — repeat-guard trigger", () => {
  const h = (s: string) => blockSequenceHash(s.split(","));

  it("triggers on a collision within the last 3 hashes", () => {
    const recent = [h("a,b,c"), h("d,e,f"), h("g,h,i"), h("j,k,l")];
    expect(shouldRetryForRepeatedSequence(h("a,b,c"), recent)).toBe(true);
    expect(shouldRetryForRepeatedSequence(h("g,h,i"), recent)).toBe(true);
  });

  it("does NOT trigger for a hash only seen beyond the window", () => {
    const recent = [h("a,b,c"), h("d,e,f"), h("g,h,i"), h("j,k,l")];
    expect(shouldRetryForRepeatedSequence(h("j,k,l"), recent)).toBe(false);
  });

  it("does NOT trigger on a fresh sequence or empty history", () => {
    expect(shouldRetryForRepeatedSequence(h("x,y,z"), [h("a,b,c")])).toBe(false);
    expect(shouldRetryForRepeatedSequence(h("x,y,z"), [])).toBe(false);
    expect(shouldRetryForRepeatedSequence("", [h("a,b,c")])).toBe(false);
  });
});

describe("buildRepeatCorrectiveMessage", () => {
  it("names the repeated sequence and demands a different hero + 2 sections, keeping user requests", () => {
    const msg = buildRepeatCorrectiveMessage(["nav-header", "hero", "benefits-grid", "comparison", "footer"]);
    expect(msg).toContain("hero → benefits-grid → comparison"); // chrome stripped
    expect(msg).not.toContain("nav-header");
    expect(msg).toMatch(/change the hero block type and at least 2 other sections/i);
    expect(msg).toMatch(/explicit user requests still override/i);
  });
});
