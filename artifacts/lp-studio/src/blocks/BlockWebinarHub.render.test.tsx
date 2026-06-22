// @vitest-environment jsdom
/**
 * Render smoke test for the self-contained full-page "webinar-hub" block
 * (Task #1380). The block is a large, multi-section page renderer — this test
 * mounts it with the REAL catalog default props (via createBlock) and asserts
 * that the key sections render without throwing, then exercises the variants the
 * task calls out as the risk surface:
 *   - hero + final-CTA OPTIONAL background image + whole-percent overlay,
 *   - the OPTIONAL secondary CTA toggled onto nav / final-CTA / footer,
 *   - the three status states (upcoming / live / on-demand).
 *
 * The renderer is prop-driven (it takes `brand` as a prop, no brand context), so
 * no provider wrapper is needed. EmailCaptureModal / ChiliPiperModal only mount
 * behind modal state, so the default render never reaches them.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { BlockWebinarHub } from "@/blocks/BlockWebinarHub";
import { createBlock } from "@/lib/block-types/block-registry";
import type { WebinarHubBlockProps } from "@/lib/block-types";

function defaults(): WebinarHubBlockProps {
  return createBlock("webinar-hub").props;
}

afterEach(() => cleanup());

describe("BlockWebinarHub render", () => {
  it("renders all key sections with default props", () => {
    const props = defaults();
    const { container } = render(<BlockWebinarHub props={props} />);

    // Hero copy
    expect(screen.getByText(props.title)).toBeTruthy();
    // Agenda / speakers / faq headlines from defaults
    expect(screen.getByText(props.agendaHeadline!)).toBeTruthy();
    expect(screen.getByText(props.speakersHeadline!)).toBeTruthy();
    expect(screen.getByText(props.faqHeadline!)).toBeTruthy();
    // Speaker names render (also appears as an agenda speaker → may be multiple)
    expect(screen.getAllByText("Jordan Avery").length).toBeGreaterThanOrEqual(1);
    // No empty render
    expect(container.querySelector("section, header, footer, div")).toBeTruthy();
  });

  it("renders hero + final-CTA optional background image with whole-percent overlay", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      heroBackgroundImageUrl: "https://example.com/hero.jpg",
      heroOverlayOpacity: 70,
      finalCtaBackgroundImageUrl: "https://example.com/cta.jpg",
      finalCtaOverlayOpacity: 40,
    };
    const { container } = render(<BlockWebinarHub props={props} />);
    // jsdom's CSSOM strips the unquoted `background-image: url(...)`, so we can't
    // assert the URL in the markup. Instead assert the overlay <div> the
    // `heroBackgroundImageUrl && ...` / `finalCtaBackgroundImageUrl && ...`
    // branches render — its inline opacity is the whole-percent overlay ÷ 100.
    const opacities = Array.from(container.querySelectorAll<HTMLElement>("div"))
      .map((d) => d.style.opacity)
      .filter(Boolean);
    expect(opacities).toContain("0.7"); // hero overlay (70%)
    expect(opacities).toContain("0.4"); // final-CTA overlay (40%)
    // Title still renders (no crash on the image-overlay path).
    expect(screen.getByText(props.title)).toBeTruthy();
  });

  it("renders the optional secondary CTA on nav, final-CTA, and footer when toggled", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      secondaryCtaText: "Talk to sales",
      secondaryCtaAction: "url",
      secondaryCtaUrl: "https://example.com/sales",
      secondaryCtaInNav: true,
      secondaryCtaInFinalCta: true,
      secondaryCtaInFooter: true,
    };
    render(<BlockWebinarHub props={props} />);
    // All three placements (nav + final-CTA + footer) render independently, so
    // the label appears exactly three times.
    const hits = screen.getAllByText("Talk to sales");
    expect(hits.length).toBe(3);
  });

  it("renders the secondary CTA only on the single surface toggled on", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      secondaryCtaText: "Talk to sales",
      secondaryCtaAction: "url",
      secondaryCtaUrl: "https://example.com/sales",
      secondaryCtaInNav: true,
      secondaryCtaInFinalCta: false,
      secondaryCtaInFooter: false,
    };
    render(<BlockWebinarHub props={props} />);
    expect(screen.getAllByText("Talk to sales").length).toBe(1);
  });

  it("does NOT render the secondary CTA when its placements are off", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      secondaryCtaText: "Talk to sales",
      secondaryCtaInNav: false,
      secondaryCtaInFinalCta: false,
      secondaryCtaInFooter: false,
    };
    render(<BlockWebinarHub props={props} />);
    expect(screen.queryByText("Talk to sales")).toBeNull();
  });

  it.each(["upcoming", "live", "on-demand"] as const)(
    "renders status state %s without crashing",
    (status) => {
      const props: WebinarHubBlockProps = { ...defaults(), status };
      const { container } = render(<BlockWebinarHub props={props} />);
      expect(within(container).getByText(props.title)).toBeTruthy();
    },
  );
});
