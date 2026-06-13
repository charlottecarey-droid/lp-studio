import { describe, expect, it } from "vitest";

import {
  extractCtaConfig,
  applyCtaConfig,
  blockHasCta,
  propagateCtaToAll,
  countCtaTargets,
  findBlockById,
  type CtaConfig,
} from "./cta-propagation";
import type { PageBlock } from "@/lib/block-types";

/* Build a fake PageBlock with arbitrary props. The propagation util is
 * structurally typed over `props`, so the block `type` string is only used for
 * identity/recursion — we cast through unknown to keep the tests focused on the
 * shared CTA-field contract without importing every block's prop interface. */
function block(id: string, type: string, props: Record<string, unknown>, children?: PageBlock[]): PageBlock {
  return { id, type, props, ...(children ? { children } : {}) } as unknown as PageBlock;
}

/** A fully-loaded source block whose props exercise action + style + modal. */
function sourceProps() {
  return {
    // own copy — must NEVER be propagated
    headline: "Source headline",
    eyebrow: "Source eyebrow",
    // action
    ctaText: "Book a meeting",
    ctaUrl: "https://acme.com/book",
    ctaAction: "chilipiper",
    chilipiperUrl: "https://acme.chilipiper.com/router/abm",
    videoUrl: "",
    videoPosterUrl: "",
    // style
    ctaButtonColor: "#4B47E5",
    ctaButtonTextColor: "#FFFFFF",
    // modal
    modalFormSource: "marketo",
    modalHeadline: "Pick a time",
    modalShowPhone: true,
  };
}

describe("blockHasCta", () => {
  it("is true for blocks exposing a label / action / style field", () => {
    expect(blockHasCta("deal-room", { ctaText: "Go", ctaUrl: "#" })).toBe(true);
    expect(blockHasCta("pas-icon-grid", { ctaLabel: "Go", ctaUrl: "#" })).toBe(true);
    expect(blockHasCta("x", { ctaButtonColor: "#000" })).toBe(true);
    expect(blockHasCta("x", { ctaAction: "url" })).toBe(true);
  });

  it("is false for non-CTA blocks (only own copy / modal-only / non-objects)", () => {
    expect(blockHasCta("quote", { quote: "hi", author: "me" })).toBe(false);
    // modal* fields alone do not make a standalone CTA
    expect(blockHasCta("x", { modalHeadline: "hi" })).toBe(false);
    expect(blockHasCta("x", null)).toBe(false);
    expect(blockHasCta("x", undefined)).toBe(false);
  });
});

describe("extractCtaConfig", () => {
  it("pulls only the canonical CTA fields, not the block's own copy", () => {
    const cfg = extractCtaConfig(sourceProps());
    expect(cfg.ctaText).toBe("Book a meeting");
    expect(cfg.action).toEqual({
      ctaUrl: "https://acme.com/book",
      ctaAction: "chilipiper",
      chilipiperUrl: "https://acme.chilipiper.com/router/abm",
      videoUrl: "",
      videoPosterUrl: "",
    });
    expect(cfg.style).toEqual({ ctaButtonColor: "#4B47E5", ctaButtonTextColor: "#FFFFFF" });
    expect(cfg.modal).toEqual({ modalFormSource: "marketo", modalHeadline: "Pick a time", modalShowPhone: true });
    // own copy is absent everywhere
    const flat = { ...cfg.action, ...cfg.style, ...cfg.modal };
    expect(flat).not.toHaveProperty("headline");
    expect(flat).not.toHaveProperty("eyebrow");
  });

  it("reads the label from ctaLabel when ctaText is absent", () => {
    expect(extractCtaConfig({ ctaLabel: "Talk to us", ctaUrl: "#" }).ctaText).toBe("Talk to us");
  });

  it("only captures fields the block actually declares", () => {
    const cfg = extractCtaConfig({ ctaUrl: "#" });
    expect(cfg.action).toEqual({ ctaUrl: "#" });
    expect(cfg.style).toEqual({});
    expect(cfg.modal).toEqual({});
    expect(cfg.ctaText).toBeUndefined();
  });
});

describe("applyCtaConfig", () => {
  const cfg = extractCtaConfig(sourceProps());

  it("round-trips: extract then apply onto an identical shape reproduces the CTA fields", () => {
    const target = sourceProps();
    // wipe CTA fields then re-apply
    const blank = { ...target, ctaText: "", ctaUrl: "", ctaAction: "url", chilipiperUrl: "", ctaButtonColor: "", ctaButtonTextColor: "", modalFormSource: "simple", modalHeadline: "", modalShowPhone: false };
    const applied = applyCtaConfig(blank, cfg, "all");
    const re = extractCtaConfig(applied);
    expect(re.ctaText).toBe(cfg.ctaText);
    expect(re.action).toEqual(cfg.action);
    expect(re.style).toEqual(cfg.style);
    expect(re.modal).toEqual(cfg.modal);
  });

  it("overwrites CTA fields but leaves the target's own copy untouched", () => {
    const target = { headline: "Target headline", body: "keep me", ctaText: "old", ctaUrl: "old", ctaButtonColor: "#000" };
    const out = applyCtaConfig(target, cfg, "all");
    expect(out.headline).toBe("Target headline");
    expect(out.body).toBe("keep me");
    expect(out.ctaText).toBe("Book a meeting");
    expect(out.ctaUrl).toBe("https://acme.com/book");
    expect(out.ctaButtonColor).toBe("#4B47E5");
  });

  it("only writes fields the TARGET declares (no pollution)", () => {
    const target = { ctaUrl: "old" }; // no label, no style, no modal keys
    const out = applyCtaConfig(target, cfg, "all");
    expect(out).toEqual({ ctaUrl: "https://acme.com/book" });
    expect(out).not.toHaveProperty("ctaText");
    expect(out).not.toHaveProperty("ctaButtonColor");
    expect(out).not.toHaveProperty("modalFormSource");
  });

  it("writes the label to ctaLabel when that's the target's alias", () => {
    const target = { ctaLabel: "old", ctaUrl: "old" };
    const out = applyCtaConfig(target, cfg, "all");
    expect(out.ctaLabel).toBe("Book a meeting");
    expect(out).not.toHaveProperty("ctaText");
  });

  it('"style" mode copies only style overrides, leaving action + modal alone', () => {
    const target = { ctaText: "Keep my text", ctaUrl: "keep", ctaAction: "url", ctaButtonColor: "#000", ctaButtonTextColor: "#000", modalHeadline: "keep modal" };
    const out = applyCtaConfig(target, cfg, "style");
    expect(out.ctaButtonColor).toBe("#4B47E5");
    expect(out.ctaButtonTextColor).toBe("#FFFFFF");
    // action + modal preserved
    expect(out.ctaText).toBe("Keep my text");
    expect(out.ctaUrl).toBe("keep");
    expect(out.ctaAction).toBe("url");
    expect(out.modalHeadline).toBe("keep modal");
  });

  it("does not mutate the input props object", () => {
    const target = { ctaText: "old", ctaUrl: "old" };
    const snapshot = { ...target };
    applyCtaConfig(target, cfg, "all");
    expect(target).toEqual(snapshot);
  });
});

describe("propagateCtaToAll", () => {
  function page(): PageBlock[] {
    return [
      block("hero", "deal-room", sourceProps()),
      block("mid", "pas-icon-grid", {
        problemHeading: "Mid copy", // own copy
        ctaLabel: "old label",
        ctaUrl: "old-url",
        ctaAction: "url",
        ctaButtonColor: "#999999",
        modalHeadline: "old modal",
      }),
      block("quote", "quote", { quote: "no cta here", author: "x" }),
      block("foot", "full-bleed-final-cta", {
        heading: "Foot copy",
        ctaLabel: "another",
        ctaUrl: "another-url",
        ctaButtonColor: "#111111",
        ctaButtonTextColor: "#222222",
      }),
    ];
  }

  it("applies action+style to every other CTA block (alias-aware), not the source or non-CTA blocks", () => {
    const blocks = page();
    const out = propagateCtaToAll(blocks, "hero", { fields: "all" });
    const mid = out[1].props as Record<string, unknown>;
    const quote = out[2].props as Record<string, unknown>;
    const foot = out[3].props as Record<string, unknown>;

    // mid received label (via ctaLabel alias) + url + action + style + modal
    expect(mid.ctaLabel).toBe("Book a meeting");
    expect(mid.ctaUrl).toBe("https://acme.com/book");
    expect(mid.ctaAction).toBe("chilipiper");
    expect(mid.ctaButtonColor).toBe("#4B47E5");
    expect(mid.modalHeadline).toBe("Pick a time");
    // mid keeps its own copy
    expect(mid.problemHeading).toBe("Mid copy");
    // mid had no chilipiperUrl/ctaText/textColor keys → not added
    expect(mid).not.toHaveProperty("chilipiperUrl");
    expect(mid).not.toHaveProperty("ctaText");

    // foot received both style fields + label/url
    expect(foot.ctaLabel).toBe("Book a meeting");
    expect(foot.ctaButtonColor).toBe("#4B47E5");
    expect(foot.ctaButtonTextColor).toBe("#FFFFFF");
    expect(foot.heading).toBe("Foot copy");

    // non-CTA quote block untouched (same reference)
    expect(out[2]).toBe(blocks[2]);
    expect(quote).toEqual({ quote: "no cta here", author: "x" });
  });

  it("leaves the SOURCE block completely unchanged (same reference)", () => {
    const blocks = page();
    const out = propagateCtaToAll(blocks, "hero", { fields: "all" });
    expect(out[0]).toBe(blocks[0]);
    expect(out[0].props).toEqual(sourceProps());
  });

  it('"style" mode copies only styling to targets', () => {
    const out = propagateCtaToAll(page(), "hero", { fields: "style" });
    const mid = out[1].props as Record<string, unknown>;
    expect(mid.ctaButtonColor).toBe("#4B47E5"); // style copied
    expect(mid.ctaLabel).toBe("old label"); // action/label untouched
    expect(mid.ctaUrl).toBe("old-url");
    expect(mid.ctaAction).toBe("url");
    expect(mid.modalHeadline).toBe("old modal");
  });

  it("defaults to fields: 'all' when no opts given", () => {
    const out = propagateCtaToAll(page(), "hero");
    expect((out[1].props as Record<string, unknown>).ctaUrl).toBe("https://acme.com/book");
  });

  it("recurses into container children", () => {
    const blocks: PageBlock[] = [
      block("hero", "deal-room", sourceProps()),
      block("section", "section", { padding: "lg" }, [
        block("nested-cta", "split-media-row", { heading: "Nested copy", ctaLabel: "x", ctaUrl: "y" }),
      ]),
    ];
    const out = propagateCtaToAll(blocks, "hero", { fields: "all" });
    const nested = (out[1] as PageBlock & { children: PageBlock[] }).children[0].props as Record<string, unknown>;
    expect(nested.ctaLabel).toBe("Book a meeting");
    expect(nested.ctaUrl).toBe("https://acme.com/book");
    expect(nested.heading).toBe("Nested copy");
  });

  it("returns the original array unchanged when there are no other CTA blocks", () => {
    const blocks: PageBlock[] = [
      block("hero", "deal-room", sourceProps()),
      block("quote", "quote", { quote: "x", author: "y" }),
    ];
    const out = propagateCtaToAll(blocks, "hero", { fields: "all" });
    expect(out).toBe(blocks);
  });

  it("returns the original array unchanged when the source has no CTA", () => {
    const blocks: PageBlock[] = [
      block("quote", "quote", { quote: "x", author: "y" }),
      block("foot", "full-bleed-final-cta", { ctaLabel: "a", ctaUrl: "b" }),
    ];
    const out = propagateCtaToAll(blocks, "quote", { fields: "all" });
    expect(out).toBe(blocks);
  });

  it("returns the original array unchanged for an unknown source id", () => {
    const blocks = page();
    expect(propagateCtaToAll(blocks, "does-not-exist")).toBe(blocks);
  });

  it("preserves reference identity for blocks whose CTA already matches the source", () => {
    const blocks: PageBlock[] = [
      block("hero", "deal-room", { ctaText: "Go", ctaUrl: "#u", ctaButtonColor: "#abc" }),
      block("twin", "deal-room", { ctaText: "Go", ctaUrl: "#u", ctaButtonColor: "#abc", headline: "twin" }),
      block("diff", "deal-room", { ctaText: "Old", ctaUrl: "#old", ctaButtonColor: "#000" }),
    ];
    const out = propagateCtaToAll(blocks, "hero", { fields: "all" });
    expect(out[1]).toBe(blocks[1]); // twin unchanged → same ref
    expect(out[2]).not.toBe(blocks[2]); // diff changed → new ref
  });
});

describe("countCtaTargets", () => {
  it("counts other CTA blocks (recursing children), excluding the source and non-CTA blocks", () => {
    const blocks: PageBlock[] = [
      block("hero", "deal-room", sourceProps()),
      block("foot", "full-bleed-final-cta", { ctaLabel: "a", ctaUrl: "b" }),
      block("quote", "quote", { quote: "x", author: "y" }),
      block("section", "section", { p: 1 }, [
        block("nested", "split-media-row", { ctaLabel: "n", ctaUrl: "u" }),
      ]),
    ];
    expect(countCtaTargets(blocks, "hero")).toBe(2);
  });

  it("is 0 when no other CTA blocks exist", () => {
    expect(countCtaTargets([block("hero", "deal-room", sourceProps())], "hero")).toBe(0);
  });
});

describe("findBlockById", () => {
  it("finds top-level and nested blocks, returns null when absent", () => {
    const blocks: PageBlock[] = [
      block("a", "x", {}),
      block("b", "section", {}, [block("c", "y", {})]),
    ];
    expect(findBlockById(blocks, "a")?.id).toBe("a");
    expect(findBlockById(blocks, "c")?.id).toBe("c");
    expect(findBlockById(blocks, "z")).toBeNull();
  });
});

/* keep CtaConfig referenced for the type-only import to avoid unused warnings */
const _typecheck: CtaConfig = { action: {}, style: {}, modal: {} };
void _typecheck;
