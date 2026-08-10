import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * SSR smoke test for the "event-activations" full-page block (sponsored-event
 * presence page). Pins the render-guard contract: every section hides via its
 * toggle, the booking close switches between the big CTA button and the
 * embedded-form slot (dashed placeholder when unconfigured — parity with the
 * Premium Events Page), and hero layouts that need an image fail back to the
 * dark band instead of rendering a broken overlay.
 */
import {
  BlockEventActivations,
  EVENT_ACTIVATIONS_DEFAULT_PROPS,
  type EventActivationsBlockProps,
} from "./BlockEventActivations";
import { DEFAULT_BRAND } from "@/lib/brand-config";

function render(props: EventActivationsBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockEventActivations, { props, brand: DEFAULT_BRAND, pageId: 123 }),
  );
}

describe("BlockEventActivations — sections + guards", () => {
  it("renders hero, activations, and booking close from defaults", () => {
    const html = render(EVENT_ACTIVATIONS_DEFAULT_PROPS);
    expect(html).toContain("Visit us at");
    expect(html).toContain("Booth #21");
    expect(html).toContain("A look at the decade ahead");
    expect(html).toContain("Book a meeting at the show");
    expect(html).toContain("Book a meeting onsite");
    // Exactly one h1 (the hero).
    expect(html.match(/<h1/g)?.length ?? 0).toBe(1);
  });

  it("hides the activations band when toggled off", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      showIntroSection: false,
      showActivations: false,
    });
    expect(html).not.toContain("A look at the decade ahead");
    expect(html).not.toContain("Everything we're hosting on the floor");
  });

  it("hides the booking section when toggled off", () => {
    const html = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, showBookingSection: false });
    expect(html).not.toContain("Book a meeting at the show");
    expect(html).not.toContain("Book a meeting onsite");
  });

  it("shows the dashed form placeholder in form mode without a linked form", () => {
    const html = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, bookingMode: "form" });
    expect(html).toContain("Pick a form in the right panel");
    expect(html).not.toContain("Book a meeting onsite");
  });

  it("mounts the embedded form slot when a global form is linked", () => {
    const html = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, bookingMode: "form", formId: 7 });
    expect(html).toContain("evact-form-slot");
    expect(html).not.toContain("Pick a form in the right panel");
  });

  it("shows the Marketo hint in marketo mode without embed config", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      bookingMode: "form",
      formMode: "marketo",
    });
    expect(html).toContain("Munchkin ID");
  });

  it("renders the meeting-host lockup from defaults, in both booking modes", () => {
    const btn = render(EVENT_ACTIVATIONS_DEFAULT_PROPS);
    expect(btn).toContain("Alex Morgan");
    expect(btn).toContain("VP, Enterprise Partnerships");
    expect(btn).toContain("bring your hardest questions");
    const form = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, bookingMode: "form" });
    expect(form).toContain("Alex Morgan");
  });

  it("hides the host lockup when toggled off", () => {
    const html = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, showBookingHost: false });
    expect(html).not.toContain("Alex Morgan");
  });

  it("falls back to an initials disc when the host has no photo", () => {
    const html = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, hostImageUrl: undefined });
    expect(html).toContain(">AM<");
    expect(html).not.toContain("Headshot of your meeting host");
  });

  it("renders no host lockup when every host field is empty", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      hostImageUrl: undefined,
      hostName: undefined,
      hostTitle: undefined,
      hostBio: undefined,
    });
    expect(html).not.toContain(">AM<");
    // The booking CTA still renders under the heading.
    expect(html).toContain("Book a meeting onsite");
  });

  it("team layout renders each member with their own meeting link and hides the single host", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      bookingHostLayout: "team",
      bookingTeam: [
        { name: "Alex Morgan", title: "VP, Partnerships", linkText: "Book with Alex", linkUrl: "https://cal.example.com/alex" },
        { name: "Jamie Ruiz", title: "Enterprise AE", linkText: "Book with Jamie", linkUrl: "https://cal.example.com/jamie" },
      ],
    });
    expect(html).toContain("Alex Morgan");
    expect(html).toContain('href="https://cal.example.com/alex"');
    expect(html).toContain("Book with Jamie");
    // Initials disc for the photoless members (AM = Alex Morgan).
    expect(html).toContain("AM");
    // Flex-wrap + centered justification: a partial last row centers instead
    // of leaving a hole where "someone is missing".
    expect(html).toContain("justify-center");
    // The single-host lockup (default props carry a host bio) must NOT render.
    expect(html).not.toContain(EVENT_ACTIVATIONS_DEFAULT_PROPS.hostBio as string);
  });

  it("team grid caps at 8 people", () => {
    const team = Array.from({ length: 10 }, (_, i) => ({ name: `Person ${i + 1}` }));
    const html = render({ ...EVENT_ACTIVATIONS_DEFAULT_PROPS, bookingHostLayout: "team", bookingTeam: team });
    expect(html).toContain("Person 8");
    expect(html).not.toContain("Person 9");
  });

  it("headshot shape option drops the circle radius", () => {
    const base = {
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      bookingHostLayout: "team" as const,
      bookingTeam: [{ name: "Alex Morgan", imageUrl: "https://example.com/a.jpg" }],
    };
    expect(render({ ...base, bookingTeamHeadshotShape: "square" })).toContain("border-radius:0");
    expect(render({ ...base, bookingTeamHeadshotShape: "rounded" })).toContain("border-radius:16px");
    expect(render(base)).toContain("border-radius:9999");
  });

  it("re-inks the activations band when a dark preset background is chosen", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      activationsBackgroundStyle: "black",
    });
    // Section paints the preset (CSS-var chain with the black fallback)…
    expect(html).toContain("var(--lp-bg-black, #000000)");
    // …and the intro headline resolves to light ink, not the light-page navy.
    const h2 = html.match(/<h2[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(h2).toContain("color:#F6F7F9");
  });

  it("re-inks card text when a dark custom card background is set", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      cardBgColor: "#101828",
    });
    const card = html.match(/<article[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(card).toContain("background:#101828");
    const h3 = html.match(/<h3[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(h3).not.toContain("color:#101828");
  });

  it("honors explicit headline color overrides", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      bookingHeadlineColor: "#ba2525",
    });
    expect(html).toContain("color:#ba2525");
  });

  it("renders a poster + play button when a card has both image and video", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      activations: [
        {
          ...EVENT_ACTIVATIONS_DEFAULT_PROPS.activations![0],
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    });
    // Image stays as the poster; the player only mounts after the click.
    expect(html).toContain("Speaker on a conference stage");
    expect(html).toContain('aria-label="Play video"');
    expect(html).not.toContain("<iframe");
  });

  it("renders a play panel for a video-only card (no image)", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      activations: [
        {
          kicker: "Demo",
          title: "Video only",
          videoUrl: "https://vimeo.com/123456789",
        },
      ],
    });
    expect(html).toContain('aria-label="Play video"');
  });

  it("uses a direct video file as the full-bleed background loop", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      heroLayout: "image-overlay",
      heroVideoUrl: "https://cdn.example.com/sizzle.mp4",
    });
    expect(html).toContain("<video");
    expect(html).toContain("sizzle.mp4");
    // The hero image doubles as the poster.
    expect(html).toContain('poster="https://images.unsplash.com/photo-1496442226666');
  });

  it("offers the lightbox watch button when a full-bleed hero has an embed-link video", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      heroLayout: "image-overlay",
      heroVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(html).toContain("Watch the video");
    expect(html).not.toContain("<iframe");
  });

  it("shows the split-hero play overlay over the image when a hero video is set", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      heroVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(html).toContain('aria-label="Play video"');
    expect(html).not.toContain("Watch the video");
  });

  it("mounts the player immediately in autoplay mode, with no play button", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      activations: [
        {
          ...EVENT_ACTIVATIONS_DEFAULT_PROPS.activations![0],
          videoUrl: "https://vimeo.com/76979871",
          videoPlayMode: "autoplay",
        },
      ],
    });
    expect(html).toContain("player.vimeo.com/video/76979871");
    expect(html).not.toContain('aria-label="Play video"');
  });

  it("keeps the plain image (no overlay, no player) in hover mode until hovered", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      activations: [
        {
          ...EVENT_ACTIVATIONS_DEFAULT_PROPS.activations![0],
          videoUrl: "https://vimeo.com/76979871",
          videoPlayMode: "hover",
        },
      ],
    });
    expect(html).toContain("Speaker on a conference stage");
    expect(html).not.toContain('aria-label="Play video"');
    expect(html).not.toContain("<iframe");
  });

  it("renders a muted looping ambient player for an autoplay-mode native hero video", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      heroVideoUrl: "https://cdn.example.com/sizzle.mp4",
      heroVideoPlayMode: "autoplay",
    });
    const video = html.match(/<video[^>]*>/)?.[0] ?? "";
    expect(video).toContain("sizzle.mp4");
    expect(video).toContain("loop");
    expect(video).not.toContain("controls");
  });

  it("falls back to the dark band when a full-bleed layout has no image", () => {
    const html = render({
      ...EVENT_ACTIVATIONS_DEFAULT_PROPS,
      heroLayout: "image-overlay",
      heroImage: undefined,
    });
    // No hero <img> and no split-hero grid — the dark band renders copy only.
    // (The `.evact-hero-grid` CSS rule always ships in the <style> tag, so
    // assert on the class attribute, not the bare string.)
    expect(html).not.toContain('class="evact-hero-grid"');
    expect(html).not.toContain("Host-city skyline");
    expect(html).toContain("Visit us at");
  });
});
