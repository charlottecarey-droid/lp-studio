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
