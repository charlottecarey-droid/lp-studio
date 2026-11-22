// @vitest-environment jsdom
import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomAccountFields } from "./RoomAccountEditor";

/**
 * The hub's top-bar button: picking "A link, a form, Chili Piper or a video…"
 * while "Books with <rep>" was chosen must stay on that choice. It used to jump
 * straight back to the rep (the link was still theirs), so the form option
 * could never be reached.
 */
const ANA = "https://calendly.com/ana-rep";
const team = [{ title: "Your Dandy team", members: [{ name: "Ana Rep", role: "Account Executive", bookingUrl: ANA }] }];
const shows = (props: Record<string, unknown>) => {
  const { container, unmount } = render(createElement(RoomAccountFields, { props: { partnerName: "MB2", ...props }, update: () => {}, team } as never));
  const out = { custom: !!container.querySelector("[data-room-schedule-cta]"), text: container.textContent ?? "" };
  unmount();
  return out;
};

describe("the top-bar button choice", () => {
  it("shows the rep when the rep was picked", () => {
    const s = shows({ scheduleAction: "url", scheduleUrl: ANA, scheduleRep: "Ana Rep" });
    expect(s.custom).toBe(false);
    expect(s.text).toContain("Books with Ana Rep");
  });

  it("stays on 'A link, a form…' after picking it, even while the link is still the rep's", () => {
    expect(shows({ scheduleAction: "url", scheduleUrl: ANA, scheduleRep: "" }).custom).toBe(true);
    // …and once a form is chosen there.
    expect(shows({ scheduleAction: "modal-form", scheduleUrl: ANA, scheduleRep: "" }).custom).toBe(true);
  });

  it("reads a hub saved before the rep was remembered from its link", () => {
    expect(shows({ scheduleAction: "url", scheduleUrl: ANA }).custom).toBe(false);
    expect(shows({ scheduleAction: "url", scheduleUrl: "https://example.com/book" }).custom).toBe(true);
  });
});
