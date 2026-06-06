/**
 * Regression guard for the NO_REVEAL exclusion set.
 *
 * Full-page specialty blocks own their own scroll-driven internals (sticky
 * navs, scroll-progress reveals, parallax). Wrapping them in the scroll-reveal
 * motion wrapper breaks position:sticky and shifts layout measurements, so they
 * MUST be excluded from reveal animation. content-series established this; the
 * blog-series and storefront full-page blocks must follow the same treatment.
 */
import { describe, it, expect } from "vitest";
import { NO_REVEAL } from "./BlockRenderer";

describe("NO_REVEAL — full-page specialty blocks", () => {
  it.each(["content-series", "blog-series", "storefront"])(
    "excludes the full-page block %s from reveal wrapping",
    (type) => {
      expect(NO_REVEAL.has(type)).toBe(true);
    },
  );
});

describe("NO_REVEAL — internally-sticky blocks", () => {
  // Blocks that own an internal `position: sticky` panel break when wrapped in
  // the reveal motion.div: a transformed ancestor becomes the containing block,
  // so sticky stops working (stranded panel / whitespace gap) on published
  // pages while looking fine in the builder. dandy-switchback is the tall
  // 100vh*N scroll variant and must also stay covered.
  it.each([
    "dandy-vertical-tabs",
    "dandy-switchback",
    "roi-calculator",
    "dso-practice-nav",
  ])("excludes the internally-sticky block %s from reveal wrapping", (type) => {
    expect(NO_REVEAL.has(type)).toBe(true);
  });
});
