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
