// @vitest-environment jsdom
/**
 * Renderer-level regression guard for the Page CTA feature's core promise:
 *
 *   "byte-identical when off  /  never baked in when on"
 *
 * A page with the Page CTA turned off (no `pageCta`, or one with no usable
 * value) must render EXACTLY as it did before the feature existed — i.e. straight
 * from each block's own props. And when a block IS following an active Page CTA,
 * editing the block must never persist the injected Page CTA values back into the
 * block's saved props (the restore guard).
 *
 * These rules live as inline wiring inside `BlockRenderer` (the `followsPageCta`
 * gate, `applyPageCtaToBlockProps`, and the `onBlockChange` restore wrap), not in
 * a single exported helper, so they're verified here by rendering through the
 * REAL `BlockRenderer`. The underlying pure helpers have their own unit coverage
 * in `@/lib/cta/ctaConfig.followpagecta.test.ts`; this file locks the component
 * that stitches them together.
 *
 * `BlockHero` is mocked with a deterministic leaf that surfaces the props it
 * receives (so the rendered markup is a clean, stable reflection of the block's
 * effective CTA) and captures its `onFieldChange` (so an edit can be driven for
 * the restore-guard case). Mocking it also sidesteps the hero's window-touching
 * builder/modal internals, which are irrelevant to this wiring.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const heroCapture = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  onFieldChange: null as ((updated: Record<string, unknown>) => void) | null,
}));

vi.mock("./BlockHero", () => ({
  BlockHero: (p: {
    props: Record<string, unknown>;
    onFieldChange?: (updated: Record<string, unknown>) => void;
  }) => {
    heroCapture.props = p.props;
    heroCapture.onFieldChange = p.onFieldChange ?? null;
    return createElement("div", {
      "data-testid": "hero",
      "data-cta-text": (p.props?.ctaText as string) ?? "",
      "data-cta-url": (p.props?.ctaUrl as string) ?? "",
      "data-headline": (p.props?.headline as string) ?? "",
    });
  },
}));

import { BlockRenderer } from "./BlockRenderer";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { CtaConfig } from "@/lib/cta/ctaConfig";
import type { PageBlock } from "@/lib/block-types";

/** A page-level CTA that supplies a real value (a non-empty label). */
const PAGE_CTA: CtaConfig = { label: "Book a demo", action: "url", url: "/demo" };

/** Representative block: a hero that declares its OWN primary CTA. */
function heroWithOwnCta(): PageBlock {
  return {
    id: "hero-1",
    type: "hero",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: { headline: "Welcome", ctaText: "Own CTA", ctaUrl: "/own" } as any,
  } as PageBlock;
}

function renderBlock(block: PageBlock, pageCta: CtaConfig | null | undefined): string {
  return renderToStaticMarkup(
    createElement(BlockRenderer, { block, brand: DEFAULT_BRAND, pageCta }),
  );
}

beforeEach(() => {
  heroCapture.props = null;
  heroCapture.onFieldChange = null;
});
afterEach(() => cleanup());

describe("Page CTA off — output is unchanged from the block's own props", () => {
  it("renders the block's own CTA verbatim and injects nothing when there is no page CTA", () => {
    const markup = renderBlock(heroWithOwnCta(), null);
    expect(markup).toContain('data-cta-text="Own CTA"');
    expect(markup).toContain('data-cta-url="/own"');
    // The page CTA value must be nowhere in the output.
    expect(markup).not.toContain("Book a demo");
    expect(markup).not.toContain("/demo");
  });

  it("is byte-identical whether the page CTA is absent, null, or present-but-empty", () => {
    const block = heroWithOwnCta();
    const undefinedCta = renderBlock(block, undefined);
    const nullCta = renderBlock(block, null);
    const emptyCta = renderBlock(block, { label: "" });
    // An empty / value-less page CTA must not perturb a single byte of output.
    expect(nullCta).toBe(undefinedCta);
    expect(emptyCta).toBe(undefinedCta);
  });

  it("a block that opts out (useCustomCta) is byte-identical with or without an active page CTA", () => {
    const optOut: PageBlock = {
      ...heroWithOwnCta(),
      blockSettings: { useCustomCta: true },
    } as PageBlock;
    const withoutPageCta = renderBlock(optOut, null);
    const withActivePageCta = renderBlock(optOut, PAGE_CTA);
    expect(withActivePageCta).toBe(withoutPageCta);
    // It keeps its own CTA; the page CTA never leaks in.
    expect(withActivePageCta).toContain('data-cta-text="Own CTA"');
    expect(withActivePageCta).not.toContain("Book a demo");
  });

  it("a block with no primary CTA is byte-identical with or without an active page CTA", () => {
    const noCta: PageBlock = {
      id: "hero-2",
      type: "hero",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { headline: "No CTA here" } as any,
    } as PageBlock;
    expect(renderBlock(noCta, PAGE_CTA)).toBe(renderBlock(noCta, null));
  });

  it("PROVES the gate is live: an active page CTA DOES inject into a following block", () => {
    // Without this counter-test the byte-identical assertions above could pass
    // simply because the feature is dead. This confirms it genuinely injects.
    const markup = renderBlock(heroWithOwnCta(), PAGE_CTA);
    expect(markup).toContain('data-cta-text="Book a demo"');
    expect(markup).toContain('data-cta-url="/demo"');
    expect(markup).not.toContain("Own CTA");
  });
});

describe("Page CTA on — editing a following block does not bake in the page CTA", () => {
  it("restores the block's original primary CTA before the edit flows back", () => {
    const block = heroWithOwnCta();
    const rawOnBlockChange = vi.fn();

    render(
      createElement(BlockRenderer, {
        block,
        brand: DEFAULT_BRAND,
        pageCta: PAGE_CTA,
        onBlockChange: rawOnBlockChange,
        isBuilder: true,
      }),
    );

    // The hero is following the page CTA → it received the INJECTED primary CTA.
    expect(heroCapture.props?.ctaText).toBe("Book a demo");
    expect(heroCapture.props?.ctaUrl).toBe("/demo");
    expect(heroCapture.onFieldChange).toBeTypeOf("function");

    // Simulate an editor changing a NON-CTA field. The block component rebuilds
    // its update from the props it was handed — which carry the injected CTA.
    act(() => {
      heroCapture.onFieldChange!({ ...heroCapture.props!, headline: "Edited headline" });
    });

    expect(rawOnBlockChange).toHaveBeenCalledTimes(1);
    const saved = rawOnBlockChange.mock.calls[0][0] as PageBlock;
    const savedProps = saved.props as Record<string, unknown>;

    // The genuine edit is preserved...
    expect(savedProps.headline).toBe("Edited headline");
    // ...but the injected page CTA was stripped back to the block's own values,
    // so it is never persisted into the saved block.
    expect(savedProps.ctaText).toBe("Own CTA");
    expect(savedProps.ctaUrl).toBe("/own");
  });
});
