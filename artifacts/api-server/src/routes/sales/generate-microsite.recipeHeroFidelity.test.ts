/**
 * Recipe hero fidelity (issue #1443, July 2026).
 *
 * The seeded recipe rotation resolves each microsite's hero slot to ONE
 * specific type (resolveRecipeSkeletonSlots), but the recipe is prompt-level
 * guidance, so the model sometimes opens with the generic `hero` anyway — and
 * the required-role backfill can inject the same generic hero when the model
 * shipped none. enforceRecipeHeroFidelity is the post-generation lock: a
 * generic lead `hero` is swapped to the recipe's resolved hero type (copy
 * props carried over); everything else is left exactly as the model built it.
 */
import { describe, expect, it } from "vitest";
import { enforceRecipeHeroFidelity } from "./generate-microsite";

type Blocks = Parameters<typeof enforceRecipeHeroFidelity>[0];

const BRAND = { name: "Acme", tagline: "", valuePropPairs: [] };

const page = (heroType: string): Blocks =>
  [
    {
      id: "hero-0",
      type: heroType,
      props: {
        headline: "Acme for Northwind",
        subheadline: "A better way to run intake",
        ctaText: "Book a demo",
        ctaUrl: "#",
      },
    },
    { id: "ben-1", type: "benefits-grid", props: { headline: "Benefits", items: [] } },
    { id: "cta-2", type: "bottom-cta", props: { headline: "Ready?" } },
  ] as unknown as Blocks;

describe("enforceRecipeHeroFidelity", () => {
  it("swaps a generic lead `hero` to the recipe's resolved hero type, keeping the copy", () => {
    let info: { swapped: boolean; to?: string } | null = null;
    const out = enforceRecipeHeroFidelity(page("hero"), "full-bleed-hero", BRAND, (i) => {
      info = i;
    });
    expect(info).toEqual({ swapped: true, to: "full-bleed-hero" });
    expect(out[0].type).toBe("full-bleed-hero");
    const props = out[0].props as Record<string, unknown>;
    expect(props.headline).toBe("Acme for Northwind");
    expect(props.subheadline).toBe("A better way to run intake");
    expect(props.ctaText).toBe("Book a demo");
    // Rest of the page untouched.
    expect(out.slice(1).map((b) => b.type)).toEqual(["benefits-grid", "bottom-cta"]);
  });

  it("never overrides a premium hero the model deliberately chose", () => {
    const blocks = page("dso-heartland-hero");
    const out = enforceRecipeHeroFidelity(blocks, "full-bleed-hero", BRAND);
    expect(out).toBe(blocks); // same reference — untouched
    expect(out[0].type).toBe("dso-heartland-hero");
  });

  it("no-op when the recipe resolved to the generic `hero` itself", () => {
    const blocks = page("hero");
    const out = enforceRecipeHeroFidelity(blocks, "hero", BRAND);
    expect(out).toBe(blocks);
    expect(out[0].type).toBe("hero");
  });

  it("no-op when the resolved slot is not a microsite hero type (custom recipe opening with a non-hero)", () => {
    const blocks = page("hero");
    const out = enforceRecipeHeroFidelity(blocks, "benefits-grid", BRAND);
    expect(out).toBe(blocks);
    expect(out[0].type).toBe("hero");
  });

  it("no-op when the slot is unresolved/blank or the page has no hero", () => {
    const noHero = [
      { id: "ben-0", type: "benefits-grid", props: { headline: "B", items: [] } },
    ] as unknown as Blocks;
    expect(enforceRecipeHeroFidelity(noHero, "full-bleed-hero", BRAND)).toBe(noHero);
    const blocks = page("hero");
    expect(enforceRecipeHeroFidelity(blocks, "", BRAND)).toBe(blocks);
    expect(enforceRecipeHeroFidelity(blocks, null, BRAND)).toBe(blocks);
    expect(enforceRecipeHeroFidelity([] as unknown as Blocks, "full-bleed-hero", BRAND)).toEqual([]);
  });

  it("also corrects a generic hero the required-role backfill placed after a nav", () => {
    const blocks = [
      { id: "nav-0", type: "nav-header", props: {} },
      { id: "hero-1", type: "hero", props: { headline: "H" } },
      { id: "cta-2", type: "bottom-cta", props: {} },
    ] as unknown as Blocks;
    const out = enforceRecipeHeroFidelity(blocks, "ai-scan-hero", BRAND);
    expect(out.map((b) => b.type)).toEqual(["nav-header", "ai-scan-hero", "bottom-cta"]);
    expect((out[1].props as Record<string, unknown>).headline).toBe("H");
  });
});
