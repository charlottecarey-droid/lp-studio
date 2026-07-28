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

  it("the roster portrait scales with the column count", () => {
    // An account team is reference information, so the portrait tightens as
    // the columns get denser rather than every layout using one hero size.
    expect(renderProps({ teamColumns: 2 })).toContain("clamp(8rem, 14vw, 10.5rem)");
    expect(renderProps({})).toContain("clamp(7rem, 11vw, 9rem)");
    expect(renderProps({ teamColumns: 4 })).toContain("clamp(6rem, 9vw, 7.5rem)");
  });

  it("four-across is available and changes the grid, not just the size", () => {
    expect(renderProps({ teamColumns: 4 })).toContain("lg:grid-cols-4");
    expect(renderProps({})).toContain("lg:grid-cols-3");
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
    // Compact team drops the roster portrait entirely.
    expect(html).not.toContain("clamp(7rem, 11vw, 9rem)");
  });
});

/* ── section surfaces, spacing, and portrait shapes ────────────────────── */

describe("BlockEventAgenda — per-section backgrounds and spacing", () => {
  it("a section given a dark background inverts its own text", () => {
    const html = renderProps({ speakersBackgroundStyle: "dark" });
    // The speakers heading must not stay near-black on a dark surface. Grab
    // the section and assert it carries a light ink somewhere in its markup.
    const section = /<div id="speakers"[\s\S]*?<\/div>\s*<\/div>/.exec(html)?.[0] ?? "";
    expect(section).toMatch(/color:#(f|e|d)[0-9a-f]{5}/i);
    expect(section).not.toMatch(/color:#221E3F/i);
  });

  it("leaves the page background alone when no section background is set", () => {
    const html = renderProps({});
    // No inline background on the section wrapper — it inherits the page.
    expect(html).toMatch(/<div id="team"><div class="mx-auto/);
  });

  it("every body section carries padding on BOTH sides", () => {
    // The cut-off bug: sections had padding-top only, so the last item sat
    // flush against the next section.
    const html = renderProps({});
    for (const id of ["team", "speakers", "resources"]) {
      const idx = html.indexOf(`id="${id}"`);
      const slice = html.slice(idx, idx + 400);
      expect(slice).toMatch(/py-\d+/);
      expect(slice).not.toMatch(/\spt-16\b/);
    }
  });

  it("portrait shape square renders hard corners; circle stays round", () => {
    expect(renderProps({ teamPortraitShape: "square" })).toContain("border-radius:0px");
    expect(renderProps({ teamPortraitShape: "circle" })).toContain("border-radius:9999px");
  });

  it("rounded portraits follow the PAGE corner radius (regression)", () => {
    const squarePage = renderToStaticMarkup(
      createElement(
        StaticRenderContext.Provider,
        { value: true },
        createElement(BlockEventAgenda, {
          props: { ...EVENT_AGENDA_DEFAULT_PROPS, teamPortraitShape: "rounded" },
          brand: { ...DEFAULT_BRAND, cardRadius: "square" },
        }),
      ),
    );
    expect(squarePage).toContain("border-radius:0px");
  });
});

/* ── readability: clamping + optional per-session chrome ───────────────── */

describe("BlockEventAgenda — readability", () => {
  it("clamps session descriptions and bios by default", () => {
    const html = renderProps({});
    expect(html).toMatch(/-webkit-line-clamp:3/);
  });

  it("clamping HIDES text without REMOVING it — export and search keep the copy", () => {
    const full = renderProps({ descriptionLines: "full" });
    const clamped = renderProps({ descriptionLines: "2" });
    const sentence = "Where the platform is going and what&#x27;s shipping this year.";
    // Present either way; only the CSS differs.
    expect(full).toContain(sentence);
    expect(clamped).toContain(sentence);
    expect(full).not.toMatch(/-webkit-line-clamp:2/);
    expect(clamped).toMatch(/-webkit-line-clamp:2/);
  });

  it('"Show in full" turns the clamp off entirely', () => {
    const html = renderProps({ descriptionLines: "full", bioLines: "full" });
    expect(html).not.toMatch(/-webkit-line-clamp/);
  });

  it("the why-this-matters callout can be switched off", () => {
    const on = renderProps({});
    const off = renderProps({ showWhyAttend: false });
    expect(on).toContain("Why this matters for you");
    expect(off).not.toContain("Why this matters for you");
  });

  it("session type and track labels can be switched off — but never the reserved flag", () => {
    const on = renderProps({});
    const off = renderProps({ showSessionMeta: false });
    // "Breakout"/"Roundtable" are session types only — unlike "Keynote", which
    // also appears in the speakers section's kicker.
    expect(on).toContain("Breakout");
    expect(on).toContain("Roundtable");
    expect(off).not.toContain("Breakout");
    expect(off).not.toContain("Roundtable");
    // The personalization the page exists for always survives.
    expect(off).toContain("Reserved for you");
  });
});

describe("BlockEventAgenda — meta row does not leave a gap when emptied", () => {
  it("omits the meta row entirely for a session with no reserved flag", () => {
    const html = renderProps({
      showSessionMeta: false,
      days: [{ label: "Day one", sessions: [{ time: "9:00 AM", title: "A session", sessionType: "Breakout" }] }],
    });
    expect(html).not.toContain("gap-x-3 gap-y-1 text-[11px]");
  });

  it("keeps the row when the session IS reserved", () => {
    const html = renderProps({
      showSessionMeta: false,
      days: [{ label: "Day one", sessions: [{ time: "9:00 AM", title: "A session", isReserved: true }] }],
    });
    expect(html).toContain("Reserved for you");
  });
});

/* ── sponsor logo sizing + optional names ──────────────────────────────── */

describe("BlockEventAgenda — sponsors", () => {
  const withLogos = {
    sponsors: [
      { name: "Northwind", tier: "Founding partner", logoUrl: "https://x/nw.svg" },
      { name: "Acme", tier: "Founding partner" }, // no logo — name IS the mark
    ],
  };

  it("one size setting drives every sponsor mark", () => {
    expect(renderProps({ ...withLogos })).toContain("max-h-12");
    expect(renderProps({ ...withLogos, sponsorLogoSize: "xl" })).toContain("max-h-24");
    expect(renderProps({ ...withLogos, sponsorLogoSize: "sm" })).toContain("max-h-8");
  });

  it("the container grows with the mark so a bigger logo is never clipped", () => {
    // Cap must stay below its box: max-h-24 (6rem) inside h-32 (8rem).
    const xl = renderProps({ ...withLogos, sponsorLogoSize: "xl" });
    expect(xl).toContain("max-h-24");
    expect(xl).toContain("h-32");
  });

  it("names under logos are off by default and opt-in", () => {
    const off = renderProps({ ...withLogos });
    const on = renderProps({ ...withLogos, showSponsorNames: true });
    // "Northwind" has a logo, so by default only its <img alt> carries the name.
    expect(off).not.toContain("tracking-[0.16em]\">Northwind");
    expect(on).toContain("Northwind");
    expect(on).toContain("tracking-[0.16em]");
  });

  it("a sponsor with NO logo never prints its name twice", () => {
    const on = renderProps({ ...withLogos, showSponsorNames: true });
    // Acme is the wordmark fallback — exactly one occurrence of the name.
    expect(on.split("Acme").length - 1).toBe(1);
  });

  it("a dark sponsors background re-inks the tier labels (not page ink)", () => {
    const html = renderProps({ ...withLogos, sponsorsBackgroundStyle: "dark" });
    const section = /<div id="sponsors"[\s\S]*?<\/div>\s*<\/div>/.exec(html)?.[0] ?? "";
    expect(section).not.toMatch(/color:#1A1815/i);
  });
});

/* ── hero stat strip: per-stat hide, editable labels, deletable location ── */

describe("BlockEventAgenda — hero stats", () => {
  const strip = (html: string) => {
    const i = html.indexOf("<dl");
    return i === -1 ? "" : html.slice(i, html.indexOf("</dl>", i));
  };

  it("shows the computed counts by default", () => {
    const s = strip(renderProps({}));
    expect(s).toContain("sessions picked for you");
    expect(s).toContain("days");
    expect(s).toContain("reserved just for you");
    expect(s).toContain("Austin, TX");
  });

  it("each stat can be hidden independently", () => {
    expect(strip(renderProps({ showStatSessions: false }))).not.toContain("sessions picked for you");
    expect(strip(renderProps({ showStatReserved: false }))).not.toContain("reserved just for you");
    // Hiding one leaves the others standing.
    expect(strip(renderProps({ showStatReserved: false }))).toContain("sessions picked for you");
  });

  it("with EVERY stat off the location still shows — the point of the option", () => {
    const s = strip(renderProps({
      showStatSessions: false, showStatDays: false, showStatReserved: false,
    }));
    expect(s).toContain("Austin, TX");
    expect(s).toContain("Mar 10");
    expect(s).not.toContain("picked for you");
  });

  it("labels are overridable and used verbatim", () => {
    const s = strip(renderProps({ statSessionsLabel: "talks on your list" }));
    expect(s).toContain("talks on your list");
    expect(s).not.toContain("sessions picked for you");
  });

  it("clearing the location removes it — no phantom fallback copy", () => {
    const s = strip(renderProps({ eventLocation: "" }));
    expect(s).not.toContain("Austin");
    // The old hardcoded "on location" fallback must not resurface.
    expect(s).not.toContain("on location");
  });

  it("clearing the dates drops the sub-line rather than substituting for it", () => {
    const s = strip(renderProps({ eventDates: "" }));
    expect(s).toContain("Austin, TX");
    expect(s).not.toContain("on location");
  });

  it("everything off and nothing to say — the whole strip is gone", () => {
    const html = renderProps({
      showStatSessions: false, showStatDays: false, showStatReserved: false,
      eventLocation: "", eventDates: "",
    });
    expect(html).not.toContain("<dl");
  });
});

/* ── sticky day nav ─────────────────────────────────────────────────────── */

describe("BlockEventAgenda — day navigation", () => {
  const threeDays = {
    days: [
      { label: "Tue", sessions: [{ time: "9:00", title: "Day one session" }] },
      { label: "Wed", sessions: [{ time: "9:00", title: "Day two session" }] },
      { label: "Thu", sessions: [{ time: "9:00", title: "Day three session" }] },
    ],
  };

  it("is off by default — existing pages are untouched", () => {
    expect(renderProps(threeDays)).not.toContain('role="tablist"');
    expect(renderProps(threeDays)).not.toContain("sticky top-0");
  });

  it("anchors mode adds a sticky bar that is NOT a tablist", () => {
    const html = renderProps({ ...threeDays, dayNav: "anchors" });
    expect(html).toContain("sticky top-0");
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain('id="agenda-day-0"');
    expect(html).toContain('id="agenda-day-2"');
  });

  it("a single-day agenda never shows the bar, whatever the setting", () => {
    const html = renderProps({
      dayNav: "tabs",
      days: [{ label: "Tue", sessions: [{ time: "9:00", title: "Only session" }] }],
    });
    expect(html).not.toContain("sticky top-0");
  });

  it("TABS NEVER HIDE A DAY IN A STATIC RENDER — the export contract", () => {
    // A prerender never clicks. Tabbing a snapshot would ship days 2 and 3
    // invisible, which is the scroll-reveal export bug all over again.
    const html = renderProps({ ...threeDays, dayNav: "tabs" });
    expect(html).toContain("Day one session");
    expect(html).toContain("Day two session");
    expect(html).toContain("Day three session");
    // No day panel may carry `hidden` (`aria-hidden` on decorative chrome is
    // unrelated, so match the day wrapper specifically), and a static render
    // shouldn't be pretending to be a tab UI at all.
    expect(html).not.toMatch(/id="agenda-day-\d"[^>]*hidden/);
    expect(html).not.toContain('role="tabpanel"');
  });
});

/* ── hero secondary button ──────────────────────────────────────────────── */

describe("BlockEventAgenda — hero secondary button", () => {
  it("defaults to the calendar download", () => {
    expect(renderProps({})).toContain("Add all to calendar");
  });

  it("can play a video instead", () => {
    const html = renderProps({
      heroSecondaryAction: "video",
      heroSecondaryVideoUrl: "https://youtu.be/abc123",
    });
    expect(html).toContain("Watch the trailer");
    expect(html).not.toContain("Add all to calendar");
  });

  it("can link out, with a custom label", () => {
    const html = renderProps({
      heroSecondaryAction: "link",
      heroSecondaryUrl: "https://example.com/venue",
      heroSecondaryLabel: "Venue &amp; travel",
    });
    expect(html).toContain('href="https://example.com/venue"');
    expect(html).toContain("Venue");
  });

  it("a video action with no URL renders nothing rather than a dead button", () => {
    const html = renderProps({ heroSecondaryAction: "video" });
    expect(html).not.toContain("Watch the trailer");
  });

  it("can be switched off entirely", () => {
    const html = renderProps({ heroSecondaryAction: "none" });
    expect(html).not.toContain("Add all to calendar");
  });
});

/* ── special guest / musical act ────────────────────────────────────────── */

describe("BlockEventAgenda — special guest", () => {
  it("renders the billing as a poster, not another speaker row", () => {
    const html = renderProps({});
    expect(html).toContain("The Northern Sound");
    expect(html).toContain("Live from Nashville");
    expect(html).toContain("Wednesday, 8:00 PM");
    expect(sectionAt(html, "guest")).toBeGreaterThan(-1);
  });

  it("sits between the speakers and the schedule by default", () => {
    const html = renderProps({});
    expect(sectionAt(html, "guest")).toBeGreaterThan(sectionAt(html, "speakers"));
    expect(sectionAt(html, "guest")).toBeLessThan(sectionAt(html, "schedule"));
  });

  it("an image gets the scrimmed poster treatment; without one it's typographic", () => {
    const withImg = renderProps({ guestImageUrl: "https://x/band.jpg" });
    expect(withImg).toContain("band.jpg");
    expect(withImg).toContain("linear-gradient(to top, rgba(0,0,0,0.82)");
    expect(renderProps({})).not.toContain("linear-gradient(to top, rgba(0,0,0,0.82)");
  });

  it("no name means no section on a published page", () => {
    expect(sectionAt(renderProps({ guestName: "" }), "guest")).toBe(-1);
    expect(sectionAt(renderProps({ showGuest: false }), "guest")).toBe(-1);
  });

  it("is reorderable like every other body section", () => {
    const html = renderProps({ sectionOrder: ["guest", "note", "team"] });
    expect(sectionAt(html, "guest")).toBeLessThan(sectionAt(html, "note"));
  });
});

describe("BlockEventAgenda — the account team is a directory, not profiles", () => {
  const withBios = {
    team: [{ name: "Maya Chen", title: "AE", bio: "Fifteen years in dental ops.", email: "m@x.com" }],
    speakers: [{ name: "Alex Rivera", title: "CTO", bio: "Runs the platform group." }],
  };

  it("does not render a bio for the account team — the reader knows them", () => {
    const html = renderProps(withBios);
    expect(html).toContain("Maya Chen");
    expect(html).toContain("m@x.com");
    expect(html).not.toContain("Fifteen years in dental ops.");
  });

  it("keynote speakers DO keep their bios — that section is billing", () => {
    expect(renderProps(withBios)).toContain("Runs the platform group.");
  });

  it("holds for the compact team layout too", () => {
    const html = renderProps({ ...withBios, teamLayout: "compact" });
    expect(html).toContain("Maya Chen");
    expect(html).not.toContain("Fifteen years in dental ops.");
  });
});
