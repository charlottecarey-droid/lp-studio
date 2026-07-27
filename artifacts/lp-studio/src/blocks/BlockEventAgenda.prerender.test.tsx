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
import { BlockEventAgenda, EVENT_AGENDA_DEFAULT_PROPS, type EvaSectionId } from "./BlockEventAgenda";

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

/* ── new sections + reordering ─────────────────────────────────────────── */

const unescapeHtml = (h: string) =>
  h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const sectionAt = (html: string, id: string) => html.indexOf(`id="${id}"`);

function renderOrdered(order?: EvaSectionId[]): string {
  return renderToStaticMarkup(
    createElement(
      StaticRenderContext.Provider,
      { value: true },
      createElement(BlockEventAgenda, {
        props: {
          ...EVENT_AGENDA_DEFAULT_PROPS,
          showRsvp: true,
          ...(order ? { sectionOrder: order } : {}),
        },
        brand: DEFAULT_BRAND,
      }),
    ),
  );
}

describe("BlockEventAgenda — team / speakers / sponsors / resources", () => {
  it("each new section renders its headline AND subheadline", () => {
    const html = unescapeHtml(renderOrdered());
    for (const heading of [
      "The people looking after you",
      "Who you'll hear from",
      "Who's making it happen",
      "Take the week with you",
    ]) {
      expect(html).toContain(heading);
    }
    for (const sub of [
      "Find any of us during the event",
      "worth your leadership team's time",
      "running hands-on stations",
      "in one place",
    ]) {
      expect(html).toContain(sub);
    }
  });

  it("defaults to team + speakers BEFORE the schedule and sponsors + resources after", () => {
    const html = renderOrdered();
    expect(sectionAt(html, "team")).toBeLessThan(sectionAt(html, "schedule"));
    expect(sectionAt(html, "speakers")).toBeLessThan(sectionAt(html, "schedule"));
    expect(sectionAt(html, "sponsors")).toBeGreaterThan(sectionAt(html, "schedule"));
    expect(sectionAt(html, "resources")).toBeGreaterThan(sectionAt(html, "schedule"));
  });

  it("sectionOrder rearranges the body", () => {
    const html = renderOrdered(["schedule", "note", "sponsors", "team", "speakers", "resources", "rsvp"]);
    expect(sectionAt(html, "schedule")).toBeLessThan(sectionAt(html, "note"));
    expect(sectionAt(html, "sponsors")).toBeLessThan(sectionAt(html, "team"));
  });

  it("a PARTIAL order still renders every section (nothing silently hidden)", () => {
    const html = renderOrdered(["resources"]);
    for (const id of ["note", "team", "speakers", "schedule", "sponsors", "resources", "rsvp"]) {
      expect(sectionAt(html, id)).toBeGreaterThan(-1);
    }
    expect(sectionAt(html, "resources")).toBeLessThan(sectionAt(html, "note"));
  });

  it("unknown section ids are ignored rather than breaking the page", () => {
    const html = renderOrdered(["bogus" as EvaSectionId, "team"]);
    expect(sectionAt(html, "team")).toBeGreaterThan(-1);
    expect(sectionAt(html, "schedule")).toBeGreaterThan(-1);
  });

  it("an emptied section is omitted on a published page", () => {
    const html = renderToStaticMarkup(
      createElement(
        StaticRenderContext.Provider,
        { value: true },
        createElement(BlockEventAgenda, {
          props: { ...EVENT_AGENDA_DEFAULT_PROPS, team: [], sponsors: [] },
          brand: DEFAULT_BRAND,
        }),
      ),
    );
    expect(sectionAt(html, "team")).toBe(-1);
    expect(sectionAt(html, "sponsors")).toBe(-1);
    expect(sectionAt(html, "speakers")).toBeGreaterThan(-1);
  });
});
