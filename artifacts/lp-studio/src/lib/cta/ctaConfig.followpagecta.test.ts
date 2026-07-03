import { describe, expect, it } from "vitest";

import {
  PRIMARY_CTA_KEYS,
  blockHasPrimaryCta,
  applyPageCtaToBlockProps,
  restorePrimaryCtaProps,
  type CtaConfig,
} from "./ctaConfig";

const PAGE_CTA: CtaConfig = {
  label: "Book a demo",
  action: "chilipiper",
  chilipiper: "https://acme.chilipiper.com/router/page",
};

describe("PRIMARY_CTA_KEYS — primary only, never secondary", () => {
  it("contains primary keys but no secondary keys", () => {
    expect(PRIMARY_CTA_KEYS).toContain("ctaText");
    expect(PRIMARY_CTA_KEYS).toContain("ctaUrl");
    expect(PRIMARY_CTA_KEYS).toContain("ctaAction");
    for (const k of PRIMARY_CTA_KEYS) {
      expect(k.toLowerCase()).not.toContain("secondary");
    }
  });
});

describe("blockHasPrimaryCta", () => {
  it("true when a label / url / action / chilipiper key is present", () => {
    expect(blockHasPrimaryCta({ ctaText: "Go" })).toBe(true);
    expect(blockHasPrimaryCta({ ctaUrl: "#" })).toBe(true);
    expect(blockHasPrimaryCta({ ctaAction: "url" })).toBe(true);
    expect(blockHasPrimaryCta({ chilipiperUrl: "https://x" })).toBe(true);
    expect(blockHasPrimaryCta({ primaryCtaText: "Buy" })).toBe(true);
  });

  it("false for blocks with no primary CTA fields", () => {
    expect(blockHasPrimaryCta({ heading: "Hello" })).toBe(false);
    expect(blockHasPrimaryCta({})).toBe(false);
    expect(blockHasPrimaryCta(null)).toBe(false);
    expect(blockHasPrimaryCta(undefined)).toBe(false);
  });

  it("ignores secondary-only CTA props", () => {
    expect(blockHasPrimaryCta({ ctaSecondaryText: "Learn more" })).toBe(false);
  });
});

describe("applyPageCtaToBlockProps", () => {
  it("overwrites the block's primary CTA from the page CTA (presence-based)", () => {
    const urlPageCta: CtaConfig = { label: "Get started", action: "url", url: "/signup" };
    const out = applyPageCtaToBlockProps("hero", { ctaText: "Old", ctaUrl: "/old" }, urlPageCta);
    expect(out.ctaText).toBe("Get started");
    expect(out.ctaUrl).toBe("/signup");
  });

  it("does not write a primary key the block never declared", () => {
    // page CTA is chilipiper-mode but the block has no chilipiperUrl key →
    // presence-based shim leaves it absent.
    const out = applyPageCtaToBlockProps("hero", { ctaText: "Old", ctaUrl: "/old" }, PAGE_CTA);
    expect(out.ctaText).toBe("Book a demo");
    expect(out.chilipiperUrl).toBeUndefined();
  });

  it("never touches secondary CTA props", () => {
    const out = applyPageCtaToBlockProps(
      "hero",
      { ctaText: "Old", ctaSecondaryText: "Learn more", ctaSecondaryUrl: "/learn" },
      PAGE_CTA,
    );
    expect(out.ctaSecondaryText).toBe("Learn more");
    expect(out.ctaSecondaryUrl).toBe("/learn");
  });

  it("leaves non-CTA props untouched", () => {
    const out = applyPageCtaToBlockProps("hero", { heading: "Hi", ctaText: "Old" }, PAGE_CTA);
    expect(out.heading).toBe("Hi");
  });

  it("returns the base props unchanged when the page CTA is empty", () => {
    const base = { ctaText: "Keep me", heading: "Hi" };
    expect(applyPageCtaToBlockProps("hero", base, null)).toBe(base);
    expect(applyPageCtaToBlockProps("hero", base, { label: "" })).toBe(base);
  });

  it("does not mutate the input props", () => {
    const base = { ctaText: "Old" };
    applyPageCtaToBlockProps("hero", base, PAGE_CTA);
    expect(base.ctaText).toBe("Old");
  });
});

describe("restorePrimaryCtaProps — prevents baking the page CTA", () => {
  it("restores primary keys present in the original", () => {
    const original = { ctaText: "Mine", heading: "Hi" };
    const rendered = applyPageCtaToBlockProps("hero", original, PAGE_CTA);
    // simulate a non-CTA edit flowing back through the render-time transform
    const edited = { ...rendered, heading: "Changed" };
    const restored = restorePrimaryCtaProps(edited, original);
    expect(restored.ctaText).toBe("Mine");
    expect(restored.heading).toBe("Changed");
  });

  it("deletes primary keys the original did not have", () => {
    const original = { heading: "Hi" };
    const rendered = applyPageCtaToBlockProps("hero", original, PAGE_CTA);
    const restored = restorePrimaryCtaProps(rendered, original);
    for (const k of PRIMARY_CTA_KEYS) {
      expect(restored[k]).toBeUndefined();
    }
    expect(restored.heading).toBe("Hi");
  });

  it("preserves secondary-key edits verbatim", () => {
    const original = { ctaText: "Mine", ctaSecondaryText: "Old secondary" };
    const edited = { ...original, ctaSecondaryText: "New secondary" };
    const restored = restorePrimaryCtaProps(edited, original);
    expect(restored.ctaSecondaryText).toBe("New secondary");
    expect(restored.ctaText).toBe("Mine");
  });

  it("round-trips to byte-identical when nothing else changed", () => {
    const original = { ctaText: "Mine", ctaUrl: "/x", heading: "Hi" };
    const rendered = applyPageCtaToBlockProps("hero", original, PAGE_CTA);
    const restored = restorePrimaryCtaProps(rendered, original);
    expect(restored).toEqual(original);
  });
});

// ── July 2026 coverage fix: the alias families follow the Page CTA too ──────

describe("alias-family coverage (July 2026 fix)", () => {
  const urlPageCta: CtaConfig = { label: "Get started", action: "url", url: "/signup" };

  it("BenefitsCtaConfig family (ctaPrimaryLabel/ctaPrimaryUrl) follows the page CTA", () => {
    const props = { ctaPrimaryLabel: "Old", ctaPrimaryUrl: "/old", ctaHeading: "Why us" };
    expect(blockHasPrimaryCta(props)).toBe(true);
    const out = applyPageCtaToBlockProps("benefits-alternating-rows", props, urlPageCta);
    expect(out.ctaPrimaryLabel).toBe("Get started");
    expect(out.ctaPrimaryUrl).toBe("/signup");
    expect(out.ctaHeading).toBe("Why us");
    // The canonical keys are NOT polluted onto the alias block.
    expect(out.ctaText).toBeUndefined();
    expect(out.ctaUrl).toBeUndefined();
  });

  it("BusinessCase family (heroPrimaryCtaText/heroPrimaryCtaUrl) follows, secondary twin untouched", () => {
    const props = {
      heroPrimaryCtaText: "Old", heroPrimaryCtaUrl: "/old",
      heroSecondaryCtaText: "Tour", heroSecondaryCtaUrl: "/tour",
    };
    const out = applyPageCtaToBlockProps("business-case-centered", props, urlPageCta);
    expect(out.heroPrimaryCtaText).toBe("Get started");
    expect(out.heroPrimaryCtaUrl).toBe("/signup");
    expect(out.heroSecondaryCtaText).toBe("Tour");
    expect(out.heroSecondaryCtaUrl).toBe("/tour");
  });

  it("id-* dual-CTA family: cta1 follows (incl. action + chilipiper), cta2 never touched", () => {
    const props = {
      cta1Text: "Old", cta1Url: "/old", cta1Action: "url", cta1ChilipiperUrl: "",
      cta2Text: "Directions", cta2Url: "/map", cta2Action: "url",
    };
    const out = applyPageCtaToBlockProps("id-hero", props, PAGE_CTA);
    expect(out.cta1Text).toBe("Book a demo");
    expect(out.cta1Action).toBe("chilipiper");
    expect(out.cta1ChilipiperUrl).toBe("https://acme.chilipiper.com/router/page");
    expect(out.cta2Text).toBe("Directions");
    expect(out.cta2Url).toBe("/map");
    expect(out.cta2Action).toBe("url");
  });

  it("secondary alias keys are excluded from PRIMARY_CTA_KEYS", () => {
    for (const k of ["ctaSecondaryLabel", "heroSecondaryCtaText", "heroSecondaryCtaUrl", "cta2Text", "cta2Url", "cta2Action"]) {
      expect(PRIMARY_CTA_KEYS).not.toContain(k);
    }
  });

  it("restore round-trips the alias families to byte-identical", () => {
    const original = { ctaPrimaryLabel: "Mine", ctaPrimaryUrl: "/x", ctaSecondaryLabel: "Sec" };
    const rendered = applyPageCtaToBlockProps("benefits-bento", original, PAGE_CTA);
    const restored = restorePrimaryCtaProps(rendered, original);
    expect(restored).toEqual(original);
  });
});
