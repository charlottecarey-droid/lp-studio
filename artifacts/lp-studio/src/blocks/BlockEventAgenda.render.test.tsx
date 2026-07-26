import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * SSR smoke test for the agenda-builder phase-3 block additions (July 2026):
 * the "Add to calendar" (.ics) hero button must only appear when machine
 * schedule data exists (fail-closed — never a dead button), and the inline
 * RSVP capture is opt-in via showRsvp (publish route sets it; hand-authored
 * pages default off).
 */
import { BlockEventAgenda, EVENT_AGENDA_DEFAULT_PROPS, type EventAgendaBlockProps } from "./BlockEventAgenda";
import { DEFAULT_BRAND } from "@/lib/brand-config";

function render(props: EventAgendaBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockEventAgenda, { props, brand: DEFAULT_BRAND, pageId: 123 }),
  );
}

describe("BlockEventAgenda — add-to-calendar + RSVP guards", () => {
  it("shows the calendar button when defaults carry machine dates/times", () => {
    const html = render(EVENT_AGENDA_DEFAULT_PROPS);
    expect(html).toContain("Add to calendar");
  });

  it("hides the calendar button when no session has machine schedule data", () => {
    const html = render({
      ...EVENT_AGENDA_DEFAULT_PROPS,
      days: [
        { label: "Day one", sessions: [{ time: "9:00 AM", title: "Editorial only" }] },
      ],
    });
    expect(html).not.toContain("Add to calendar");
  });

  it("hides the calendar button when toggled off", () => {
    const html = render({ ...EVENT_AGENDA_DEFAULT_PROPS, showAddToCalendar: false });
    expect(html).not.toContain("Add to calendar");
  });

  it("renders no RSVP form by default (hand-authored pages opt in)", () => {
    const html = render(EVENT_AGENDA_DEFAULT_PROPS);
    expect(html).not.toContain("Confirm my RSVP");
    expect(html).not.toContain("Work email");
  });

  it("renders the RSVP form when showRsvp is on, with the standard fields", () => {
    const html = render({ ...EVENT_AGENDA_DEFAULT_PROPS, showRsvp: true });
    expect(html).toContain("Confirm your spot");
    expect(html).toContain("First name");
    expect(html).toContain("Work email");
    expect(html).toContain("Confirm my RSVP");
    // Honeypot field ships hidden from assistive tech and tab order.
    expect(html).toContain('aria-hidden="true"');
  });
});
