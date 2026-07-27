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

/* ── section diversity + per-section controls ──────────────────────────── */

function renderProps(extra: Partial<typeof EVENT_AGENDA_DEFAULT_PROPS>): string {
  return renderToStaticMarkup(
    createElement(
      StaticRenderContext.Provider,
      { value: true },
      createElement(BlockEventAgenda, {
        props: { ...EVENT_AGENDA_DEFAULT_PROPS, ...extra },
        brand: DEFAULT_BRAND,
      }),
    ),
  );
}

describe("BlockEventAgenda — section diversity", () => {
  it("the team roster shows contact details under the name, not in pills", () => {
    const html = renderProps({});
    expect(html).toContain("maya.chen@example.com");
    expect(html).toContain("+1 (415) 555-0142");
    expect(html).toContain("mailto:maya.chen@example.com");
  });

  it("team portraits are far larger than the old avatar", () => {
    // The roster portrait is a clamp()-sized square/circle, not a 3.5rem avatar.
    expect(renderProps({})).toContain("clamp(8.5rem, 15vw, 11.5rem)");
  });

  it("team and speakers use DIFFERENT layouts by default", () => {
    const html = renderProps({});
    // Speakers default to alternating feature rows; the team does not.
    expect(html).toContain("sm:flex-row-reverse");
    // Speaker portraits are their own (larger, square) size.
    expect(html).toContain("clamp(9rem, 17vw, 13rem)");
  });

  it("sponsors default to a plain grouped wall — no plates", () => {
    const html = renderProps({});
    expect(html).toContain("Founding partner");
    // The plated variant's tile chrome must be absent by default.
    expect(html).not.toContain("flex h-24 items-center justify-center rounded-xl");
  });

  it("sponsors can opt into plates and drop the tinted band", () => {
    const html = renderProps({ sponsorsLayout: "plates", sponsorsBand: false });
    expect(html).toContain("flex h-24 items-center justify-center rounded-xl");
  });

  it("resources default to a numbered index with plain kind labels", () => {
    const html = renderProps({});
    expect(html).toContain("01");
    expect(html).toContain("PDF");
    // No pill/border chrome around the kind in index mode.
    expect(html).not.toContain("rounded-full px-3 py-1 text-[10px]");
  });

  it("headline alignment and size are per-section", () => {
    const centered = renderProps({ resourcesAlign: "center", resourcesHeadingSize: "xl" });
    expect(centered).toContain("clamp(2.4rem, 5vw, 3.75rem)");
    const small = renderProps({ resourcesHeadingSize: "sm" });
    expect(small).toContain("clamp(1.4rem, 2.4vw, 1.85rem)");
  });

  it("alternate layouts render without losing content", () => {
    const html = renderProps({
      teamLayout: "compact",
      speakersLayout: "grid",
      resourcesLayout: "cards",
    });
    expect(html).toContain("Maya Chen");
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Event guide");
    // Compact team drops the oversized roster portrait.
    expect(html).not.toContain("clamp(8.5rem, 15vw, 11.5rem)");
  });
});
