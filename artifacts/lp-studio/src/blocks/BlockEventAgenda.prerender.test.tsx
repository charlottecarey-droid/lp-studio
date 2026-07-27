import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * The published snapshot (served to scrapers, and the source of the "Export
 * HTML" download) is captured by Playwright WITHOUT SCROLLING. Any section
 * that reveals on framer's `whileInView` therefore keeps its `initial` state —
 * inline `opacity: 0` — and the copy ships present-but-invisible. That's the
 * "export has no content past the nav" bug.
 *
 * The viewer now enters StaticRenderContext when `?prerender=1` is on the URL.
 * These tests pin the mechanism that fix depends on: under a static render the
 * agenda's sections must carry NO zero-opacity initial state, while a normal
 * visitor still gets the entrance animation.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BlockEventAgenda, EVENT_AGENDA_DEFAULT_PROPS } from "./BlockEventAgenda";

function render(staticRender: boolean): string {
  return renderToStaticMarkup(
    createElement(
      StaticRenderContext.Provider,
      { value: staticRender },
      createElement(BlockEventAgenda, {
        props: { ...EVENT_AGENDA_DEFAULT_PROPS, showRsvp: true },
        brand: DEFAULT_BRAND,
      }),
    ),
  );
}

/** `opacity:0` exactly — not the `opacity:0.5` decorative aurora orbs, whose
 *  partial transparency is deliberate and unrelated to reveals. */
const ZERO_OPACITY = /opacity:0(?![.\d])/;

describe("BlockEventAgenda — prerender/export visibility", () => {
  it("a normal visitor still gets the entrance animation (opacity:0 initial)", () => {
    expect(render(false)).toMatch(ZERO_OPACITY);
  });

  it("under a static render NOTHING is left at zero opacity", () => {
    expect(render(true)).not.toMatch(ZERO_OPACITY);
  });

  it("the schedule copy is present and visible in the static render", () => {
    const html = render(true);
    // Section headings + real session content — the copy that went missing.
    expect(html).toContain("Day by day");
    expect(html).toContain("Opening keynote: the year ahead");
    expect(html).toContain("Welcome dinner with your account team");
    // The personal note and the close, which sit far below the fold.
    expect(html).toContain("A note from your account team");
    expect(html).toContain("Questions before the event?");
  });

  it("the RSVP section survives the static render too", () => {
    const html = render(true);
    expect(html).toContain("Confirm your spot");
    expect(html).toContain("Work email");
  });
});
