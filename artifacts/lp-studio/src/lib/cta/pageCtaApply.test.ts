/**
 * pageCtaApply — type-aware Page CTA application (July 2026 coverage fix).
 *
 * Pins the wrapper's three properties:
 *  1. TYPE FALLBACK — a registered block type receives the Page CTA on keys
 *     its registry defaultProps() declare even when this instance omitted
 *     them (the AI-generated-props gap).
 *  2. NO SPROUTING — gating stays with the caller (BlockRenderer checks
 *     instance presence via blockHasPrimaryCta); the wrapper itself never
 *     invents keys the Page CTA didn't set, and placeholders it added but
 *     didn't write are pruned.
 *  3. GRACEFUL UNKNOWNS — unregistered types (custom-schema, retired) behave
 *     exactly like the pure presence-based shim.
 */
import { describe, expect, it } from "vitest";

import { applyPageCtaToBlock, primaryCtaKeysForType } from "./pageCtaApply";
import { restorePrimaryCtaProps, type CtaConfig } from "./ctaConfig";

const PAGE_CTA: CtaConfig = { label: "Book a demo", action: "url", url: "/signup" };

describe("primaryCtaKeysForType", () => {
  it("derives the hero's CTA keys from its registry defaults", () => {
    const keys = primaryCtaKeysForType("hero");
    expect(keys).toContain("ctaText");
    expect(keys).toContain("ctaUrl");
  });

  it("returns no keys for unknown block types", () => {
    expect(primaryCtaKeysForType("custom-schema-nonexistent")).toEqual([]);
  });
});

describe("applyPageCtaToBlock — type fallback", () => {
  it("writes the label to a type-declared key the instance omitted", () => {
    // AI-generated hero that shipped with a URL but no label key: the pure
    // presence-based shim had nowhere to put the Page CTA's label.
    const out = applyPageCtaToBlock("hero", { ctaUrl: "/old", headline: "Hi" }, PAGE_CTA);
    expect(out.ctaText).toBe("Book a demo");
    expect(out.ctaUrl).toBe("/signup");
    expect(out.headline).toBe("Hi");
  });

  it("prunes placeholders the page CTA did not write", () => {
    const chilipiperCta: CtaConfig = { label: "Book", action: "chilipiper", chilipiper: "https://x" };
    const out = applyPageCtaToBlock("hero", { ctaUrl: "/old" }, chilipiperCta);
    // Every surviving key was either on the instance or actually written.
    for (const [k, v] of Object.entries(out)) {
      expect(v !== undefined, `key "${k}" survived as undefined`).toBe(true);
    }
  });

  it("unknown types degrade to presence-based behavior", () => {
    const out = applyPageCtaToBlock("custom-schema", { ctaUrl: "/old" }, PAGE_CTA);
    expect(out.ctaUrl).toBe("/signup");
    // No registry defaults → no label key to target → label has nowhere to go.
    expect(out.ctaText).toBeUndefined();
  });

  it("restore strips type-fallback keys so they are never persisted", () => {
    const original = { ctaUrl: "/old", headline: "Hi" };
    const rendered = applyPageCtaToBlock("hero", original, PAGE_CTA);
    expect(rendered.ctaText).toBe("Book a demo"); // injected via type fallback
    const restored = restorePrimaryCtaProps(rendered, original);
    expect(restored).toEqual(original);
  });
});

describe("applyPageCtaToBlock — capability rules (July 2026 field bug)", () => {
  // The Page CTA editor stores the unused url slot as "" — that empty string
  // is exactly what used to clobber ctaUrl on chilipiper-in-url blocks.
  const CHILI_PAGE_CTA: CtaConfig = {
    label: "Book a demo",
    action: "chilipiper",
    chilipiper: "https://acme.chilipiper.com/round-robin/demo",
    url: "",
  };

  it("routes a chilipiper Page CTA into ctaUrl for blocks without a chilipiper key", () => {
    // dso-split-feature's renderer opens ChiliPiperButton with url={ctaUrl};
    // it declares no chilipiperUrl key. The old behavior wrote "" into ctaUrl
    // and the scheduler URL into a key the block doesn't have → dead button.
    const out = applyPageCtaToBlock(
      "dso-split-feature",
      { ctaText: "", ctaUrl: "https://old.example.com", ctaMode: "link" },
      CHILI_PAGE_CTA,
    );
    expect(out.ctaText).toBe("Book a demo");
    expect(out.ctaUrl).toBe("https://acme.chilipiper.com/round-robin/demo");
    expect(out.ctaMode).toBe("chilipiper");
  });

  it("modal-chilipiper degrades to plain chilipiper on the same targets", () => {
    const out = applyPageCtaToBlock(
      "dso-split-feature",
      { ctaText: "x", ctaUrl: "", ctaMode: "link" },
      { ...CHILI_PAGE_CTA, action: "modal-chilipiper" },
    );
    expect(out.ctaUrl).toBe("https://acme.chilipiper.com/round-robin/demo");
    expect(out.ctaMode).toBe("chilipiper");
  });

  it("still writes the dedicated chilipiper key when the block declares one", () => {
    const out = applyPageCtaToBlock(
      "custom-schema",
      { ctaText: "x", ctaUrl: "https://own", chilipiperUrl: "" },
      CHILI_PAGE_CTA,
    );
    expect(out.chilipiperUrl).toBe("https://acme.chilipiper.com/round-robin/demo");
  });

  it("never touches wistiaUrl — it is not a CTA alias", () => {
    const out = applyPageCtaToBlock(
      "dso-split-feature",
      { ctaText: "", ctaUrl: "", wistiaUrl: "https://fast.wistia.net/embed/iframe/abc12345" },
      CHILI_PAGE_CTA,
    );
    expect(out.wistiaUrl).toBe("https://fast.wistia.net/embed/iframe/abc12345");
  });

  it("gates modal-form off blocks without modal keys — the block keeps its own button", () => {
    const base = { ctaText: "Own", ctaUrl: "https://own", ctaMode: "link" };
    const out = applyPageCtaToBlock("dso-split-feature", base, {
      label: "Page",
      action: "modal-form",
      modalFormId: 5,
    } as CtaConfig);
    expect(out).toBe(base);
  });

  it("gates video-modal off blocks without a video CTA key", () => {
    const base = { ctaText: "Own", ctaUrl: "https://own" };
    const out = applyPageCtaToBlock("dso-split-feature", base, {
      label: "Page",
      action: "video-modal",
      videoUrl: "https://youtu.be/x",
    });
    expect(out).toBe(base);
  });

  it("gates a url Page CTA off label-only blocks", () => {
    const base = { ctaText: "Own" };
    expect(applyPageCtaToBlock("custom-schema", base, PAGE_CTA)).toBe(base);
  });
});

describe("applyPageCtaToBlock — modal-chilipiper field bug (July 2026)", () => {
  // The REAL config shape the Page CTA panel produces for "Open email →
  // Chili Piper modal": the scheduler URL lives in modalChilipiperUrl (a
  // CTA_MODAL_KEYS field carried verbatim), and `chilipiper` stays empty.
  // The old fallback only read cfg.chilipiper → every such Page CTA wrote
  // ctaAction "modal-chilipiper" with no modal URL — a dead button.
  const MODAL_CHILI_PAGE_CTA = {
    label: "Book a demo",
    action: "modal-chilipiper",
    chilipiper: "",
    url: "",
    modalChilipiperUrl: "https://acme.chilipiper.com/round-robin/demo",
  } as CtaConfig;

  it("degrades to a plain chilipiper popup on blocks without modal keys (url-key family)", () => {
    const out = applyPageCtaToBlock(
      "dso-split-feature",
      { ctaText: "x", ctaUrl: "", ctaMode: "link" },
      MODAL_CHILI_PAGE_CTA,
    );
    expect(out.ctaUrl).toBe("https://acme.chilipiper.com/round-robin/demo");
    expect(out.ctaMode).toBe("chilipiper");
  });

  it("prefers the dedicated chilipiper key when the block declares one", () => {
    const out = applyPageCtaToBlock(
      "custom-schema",
      { ctaText: "x", ctaUrl: "https://own", chilipiperUrl: "", ctaAction: "url" },
      MODAL_CHILI_PAGE_CTA,
    );
    expect(out.chilipiperUrl).toBe("https://acme.chilipiper.com/round-robin/demo");
    expect(out.ctaAction).toBe("chilipiper");
    // Same as the plain-chilipiper flavor: the Page CTA's empty url slot lands
    // in ctaUrl (render-only, unread when the action is chilipiper).
    expect(out.ctaUrl).toBe("");
  });

  it("keeps the real modal on blocks that declare modal keys", () => {
    const out = applyPageCtaToBlock(
      "custom-schema",
      { ctaText: "x", ctaUrl: "", ctaAction: "url", modalChilipiperUrl: "" },
      MODAL_CHILI_PAGE_CTA,
    );
    expect(out.ctaAction).toBe("modal-chilipiper");
    expect(out.modalChilipiperUrl).toBe("https://acme.chilipiper.com/round-robin/demo");
  });

  it("gates off entirely when the modal CTA has no scheduler URL anywhere", () => {
    const base = { ctaText: "Own", ctaUrl: "https://own", ctaMode: "link" };
    const out = applyPageCtaToBlock("dso-split-feature", base, {
      label: "Page",
      action: "modal-chilipiper",
      chilipiper: "",
      url: "",
    } as CtaConfig);
    expect(out).toBe(base);
  });
});
