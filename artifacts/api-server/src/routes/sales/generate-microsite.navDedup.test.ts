/**
 * Double-navbar fix (Task #1411) + neutral-hero upgrade guard.
 *
 * The neutral `hero` block bakes its OWN top nav. Two pure passes cooperate so a
 * non-Dandy microsite never ships two stacked navbars while still always getting
 * a strong, visual hero:
 *   - ensureMicrositeNavbar must NOT prepend a second `nav-header` when the page
 *     opens with a self-nav hero, and must strip a redundant standalone nav the
 *     model sometimes emits directly before one (→ exactly one navbar).
 *   - upgradeMicrositeHero must STILL upgrade a plain-white, text-only neutral
 *     `hero` (self-nav, but not dark-by-design), while leaving the premium DSO
 *     heroes (dark-by-design) untouched.
 */
import { describe, expect, it } from "vitest";
import { ensureMicrositeNavbar, upgradeMicrositeHero } from "./generate-microsite";

type Block = Record<string, unknown>;

describe("ensureMicrositeNavbar — neutral self-nav hero", () => {
  it("does not prepend a nav-header when the page opens with a self-nav `hero`", () => {
    const blocks: Block[] = [
      { id: "hero-0", type: "hero", props: {} },
      { id: "ben-1", type: "benefits-grid", props: { headline: "Benefits" } },
      { id: "footer-2", type: "footer", props: {} },
    ];
    let info: { prepended: boolean; navLinkCount: number } | null = null;
    const out = ensureMicrositeNavbar(blocks, { brandName: "Acme" }, (i) => {
      info = i;
    });
    expect(info!.prepended).toBe(false);
    expect(out.map((b) => b.type)).toEqual(["hero", "benefits-grid", "footer"]);
    expect(out.filter((b) => b.type === "nav-header")).toHaveLength(0);
  });

  it("strips a redundant standalone nav stacked before a self-nav `hero` (one navbar)", () => {
    const blocks: Block[] = [
      { id: "nav-0", type: "nav-header", props: {} },
      { id: "hero-1", type: "hero", props: {} },
      { id: "ben-2", type: "benefits-grid", props: { headline: "Benefits" } },
      { id: "footer-3", type: "footer", props: {} },
    ];
    const out = ensureMicrositeNavbar(blocks, { brandName: "Acme" });
    // The hero's own baked nav is the only navbar — the standalone one is gone.
    expect(out.map((b) => b.type)).toEqual(["hero", "benefits-grid", "footer"]);
    expect(out.filter((b) => b.type === "nav-header")).toHaveLength(0);
  });

  it("still prepends a nav-header when the opening block is NOT a self-nav hero and none exists", () => {
    const blocks: Block[] = [
      { id: "trust-0", type: "trust-bar", props: { headline: "Trusted" } },
      { id: "ben-1", type: "benefits-grid", props: { headline: "Benefits" } },
      { id: "footer-2", type: "footer", props: {} },
    ];
    let info: { prepended: boolean; navLinkCount: number } | null = null;
    const out = ensureMicrositeNavbar(blocks, { brandName: "Acme" }, (i) => {
      info = i;
    });
    expect(info!.prepended).toBe(true);
    expect(out[0].type).toBe("nav-header");
    expect(out.filter((b) => b.type === "nav-header")).toHaveLength(1);
  });
});

describe("upgradeMicrositeHero — neutral hero still upgrades, DSO heroes untouched", () => {
  it("upgrades a plain-white, text-only neutral `hero` to a dark/brand treatment", () => {
    const blocks: Block[] = [
      { id: "hero-0", type: "hero", props: { backgroundStyle: "white" } },
      { id: "ben-1", type: "benefits-grid", props: {} },
    ];
    let info: { upgraded: boolean; setBg?: string; attachedImageSlot?: boolean } | null = null;
    const out = upgradeMicrositeHero(blocks, {}, (i) => {
      info = i;
    });
    expect(info!.upgraded).toBe(true);
    const hero = out[0].props as Record<string, unknown>;
    expect(["dandy-green", "dark"]).toContain(hero.backgroundStyle);
  });

  it("leaves a dark-by-design DSO hero untouched even when it arrives white", () => {
    const blocks: Block[] = [
      { id: "hero-0", type: "dso-heartland-hero", props: { backgroundStyle: "white" } },
    ];
    let info: { upgraded: boolean } | null = null;
    const out = upgradeMicrositeHero(blocks, {}, (i) => {
      info = i;
    });
    expect(info!.upgraded).toBe(false);
    expect((out[0].props as Record<string, unknown>).backgroundStyle).toBe("white");
  });

  it("leaves a neutral `hero` that already carries a dark background untouched", () => {
    const blocks: Block[] = [
      { id: "hero-0", type: "hero", props: { backgroundStyle: "dandy-green" } },
    ];
    let info: { upgraded: boolean } | null = null;
    const out = upgradeMicrositeHero(blocks, {}, (i) => {
      info = i;
    });
    expect(info!.upgraded).toBe(false);
    expect((out[0].props as Record<string, unknown>).backgroundStyle).toBe("dandy-green");
  });
});
