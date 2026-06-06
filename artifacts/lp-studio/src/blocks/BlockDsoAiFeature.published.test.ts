import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Published-mode render regression guard for `dso-ai-feature`.
 *
 * LP blocks render the SAME field through DIFFERENT components depending on edit
 * vs published mode (`onFieldChange ? <InlineText…> : <Animated…>`). The builder
 * path (InlineText, HTML-aware) and the published path do not share rendering
 * behavior, so these two divergences are invisible until the page is published:
 *
 *  (a) When an editor recolors a stat with the inline color picker, the field
 *      value becomes HTML like `<span style="color:#FFFFFF">96%</span>`. The
 *      published stat renders through StatCounter, which must strip the tags,
 *      animate the number, and re-apply the chosen color — never dump the raw
 *      markup as literal text onto the page.
 *
 *  (b) The published headline renders through WordReveal, whose per-word framer
 *      `useTransform` interpolates between two colors and CANNOT interpolate a
 *      CSS variable. So `blockSettings.headlineColor` must reach WordReveal as a
 *      concrete hex via the `headlineColor` prop — not as a CSS var, and not
 *      silently dropped to the computed `fg` (which is derived from the
 *      backgroundStyle PROP and can disagree with the real rendered color).
 *
 * Published mode = no `onFieldChange`. Each case does a pure, node-safe SSR pass
 * (the same approach the sibling render tests use).
 *
 * WordReveal's per-word animation paints `dimColor` at scroll progress 0 under
 * SSR, so `brightColor` is not observable in the static markup. We therefore
 * mock WordReveal to capture the props BlockDsoAiFeature passes it — the only
 * reliable way to assert the concrete-hex contract for (b). StatCounter is left
 * REAL, because its HTML handling IS observable in the rendered markup for (a).
 */
const captured = vi.hoisted(() => ({
  calls: [] as Array<{ text: string; brightColor?: string }>,
}));

vi.mock("./WordReveal", () => ({
  WordReveal: (props: { text: string; brightColor?: string }) => {
    captured.calls.push({ text: props.text, brightColor: props.brightColor });
    return null;
  },
}));

import { BlockDsoAiFeature } from "./BlockDsoAiFeature";
import type { DsoAiFeatureBlockProps } from "@/lib/block-types";

function renderPublished(
  props: Partial<DsoAiFeatureBlockProps>,
  headlineColor?: string,
): string {
  return renderToStaticMarkup(
    createElement(BlockDsoAiFeature, {
      props: props as DsoAiFeatureBlockProps,
      headlineColor,
      // Omitting onFieldChange selects the published (read-only) render path.
    }),
  );
}

beforeEach(() => {
  captured.calls = [];
});

describe("BlockDsoAiFeature — published render regression", () => {
  it("(a) renders inline-recolored stat HTML as a styled number, not literal tags", () => {
    const markup = renderPublished({
      headline: "Rework is a tax.",
      body: "",
      bullets: [],
      stats: [
        {
          value: '<span style="color:#FFFFFF">96%</span>',
          label: "First-Time Right",
        },
      ],
    });

    // The raw <span> tags must never reach the page as escaped literal text —
    // that is exactly the "96% renders as code" published-page bug.
    expect(markup).not.toContain("&lt;span");
    expect(markup).not.toContain("&lt;");
    // The editor's chosen color is applied to the rendered stat.
    expect(markup).toContain("color:#FFFFFF");
    // The plain stat label still renders alongside it (no markup leakage).
    expect(markup).toContain("First-Time Right");
  });

  it("(b) passes the concrete headlineColor hex to WordReveal brightColor (not fg)", () => {
    const HEADLINE = "Rework is a tax. AI eliminates it.";
    renderPublished(
      { headline: HEADLINE, body: "", bullets: [], stats: [] },
      "#C7E738",
    );

    const headlineCall = captured.calls.find((c) => c.text === HEADLINE);
    expect(headlineCall, "headline should render via WordReveal").toBeDefined();
    // Exactly the blockSettings.headlineColor value, as a concrete hex...
    expect(headlineCall!.brightColor).toBe("#C7E738");
    // ...never a CSS variable (framer's useTransform cannot interpolate one).
    expect(headlineCall!.brightColor).not.toContain("var(");
  });

  it("(b) falls back to the computed fg when no headlineColor is set", () => {
    const HEADLINE = "Rework is a tax. AI eliminates it.";
    renderPublished({ headline: HEADLINE, body: "", bullets: [], stats: [] });

    const headlineCall = captured.calls.find((c) => c.text === HEADLINE);
    expect(headlineCall, "headline should render via WordReveal").toBeDefined();
    // Without an override the brightColor is the computed fg token (a CSS var),
    // proving headlineColor — when present — genuinely overrides fg.
    expect(headlineCall!.brightColor).toContain("var(--brand-heading-on-");
  });
});
