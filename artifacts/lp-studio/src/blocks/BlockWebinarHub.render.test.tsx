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
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
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

  it("renders a resource with a thumbnail and a working PDF download link", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      showResources: true,
      resourcesHeadline: "Featured Resources",
      resources: [
        { title: "Slide deck", format: "PDF", desc: "The full slides.", imageUrl: "https://example.com/thumb.jpg", url: "https://example.com/deck.pdf" },
        { title: "Read the recap", format: "Article", url: "https://example.com/recap" },
        { title: "No-link card", format: "Note" },
      ],
    };
    render(<BlockWebinarHub props={props} />);

    // PDF resource → anchor with download attr.
    const pdfLink = screen.getByText("Slide deck").closest("a");
    expect(pdfLink).toBeTruthy();
    expect(pdfLink!.getAttribute("href")).toBe("https://example.com/deck.pdf");
    expect(pdfLink!.hasAttribute("download")).toBe(true);
    // Thumbnail image renders.
    expect(pdfLink!.querySelector('img[src="https://example.com/thumb.jpg"]')).toBeTruthy();

    // Non-PDF URL → anchor, no download attr.
    const articleLink = screen.getByText("Read the recap").closest("a");
    expect(articleLink).toBeTruthy();
    expect(articleLink!.getAttribute("href")).toBe("https://example.com/recap");
    expect(articleLink!.hasAttribute("download")).toBe(false);

    // No url → non-interactive card (no anchor wrapper).
    expect(screen.getByText("No-link card").closest("a")).toBeNull();
  });

  it("plays a hero video (YouTube link → embed iframe) on click", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      heroVideoUrl: "https://www.youtube.com/watch?v=abc123",
    };
    const { container } = render(<BlockWebinarHub props={props} />);
    // A poster-less video shows a play button, not a player, until clicked.
    expect(container.querySelector("iframe")).toBeNull();
    const playBtn = screen.getByLabelText("Play video");
    fireEvent.click(playBtn);
    // Now the provider embed mounts with the parsed video id.
    expect(container.querySelector('iframe[src*="youtube.com/embed/abc123"]')).toBeTruthy();
  });

  it("plays a featured video and lists only linked resources beside it", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      status: "on-demand",
      featuredVideoUrl: "https://vimeo.com/123456",
      resources: [
        { title: "Slide deck", format: "PDF", url: "https://example.com/deck.pdf" },
        { title: "Unlinked note", format: "Note" },
      ],
    };
    const { container } = render(<BlockWebinarHub props={props} />);
    // The "Related materials" sidebar appears with the one linked resource.
    // (The heading sits in its own header wrapper <div>, so pin the sidebar
    // COLUMN — the `.wh-video-side` ancestor that also holds the resource list.)
    const sidebar = screen.getByText("Related materials").closest(".wh-video-side") as HTMLElement;
    expect(within(sidebar).getByText(/Slide deck/)).toBeTruthy();
    expect(within(sidebar).queryByText(/Unlinked note/)).toBeNull();
    // Play → Vimeo embed iframe.
    fireEvent.click(screen.getByLabelText("Play video"));
    expect(container.querySelector('iframe[src*="player.vimeo.com/video/123456"]')).toBeTruthy();
  });

  it("ignores an unsafe video URL — no player ever mounts", () => {
    const props: WebinarHubBlockProps = {
      ...defaults(),
      status: "on-demand",
      featuredVideoUrl: "javascript:alert(1)",
      featuredVideoPosterUrl: "https://example.com/poster.jpg",
    };
    const { container } = render(<BlockWebinarHub props={props} />);
    // The poster keeps the section visible, but the unsafe URL yields no play
    // affordance and no iframe/video element at all.
    expect(screen.queryByLabelText("Play video")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("hides the featured-video section entirely when there is nothing to show", () => {
    // Bare upcoming event: no video, no poster, no linked resources → no fake
    // player chrome anywhere on the published page.
    const { container } = render(<BlockWebinarHub props={defaults()} />);
    expect(screen.queryByLabelText("Play video")).toBeNull();
    expect(screen.queryByText("Related materials")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
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
