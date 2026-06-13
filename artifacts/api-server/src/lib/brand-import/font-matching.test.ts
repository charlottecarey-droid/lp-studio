import { describe, it, expect } from "vitest";
import { matchFont } from "./font-catalog";
import { assignRoles, parseTypeScale, type FontEvidence } from "./extractors/typography";

describe("matchFont — Adobe/Typekit hyphen-slug families", () => {
  it("maps the Typekit slug 'adelle-sans' to a loadable Google substitute", () => {
    // televerde.com's real brand font is Adobe 'adelle-sans'. Without a
    // fallback it imported with NO googleFontUrl → rendered as system Arial.
    const m = matchFont("adelle-sans");
    expect(m.fallbackFamily).toBe("Source Sans 3");
    expect(m.googleFontUrl).toBeTruthy();
    expect(m.googleFontUrl).toContain("Source+Sans+3");
    expect(m.flag).toBe("google-fallback");
  });

  it("de-hyphenates 'proxima-nova' → Montserrat", () => {
    const m = matchFont("proxima-nova");
    expect(m.fallbackFamily).toBe("Montserrat");
    expect(m.googleFontUrl).toContain("Montserrat");
  });

  it("matches a hyphen-slugged family that IS a Google font directly", () => {
    // 'work-sans' should resolve to the real Google family, not a fallback.
    const m = matchFont("work-sans");
    expect(m.flag).toBe("google-direct");
    expect(m.family.toLowerCase()).toBe("work sans");
    expect(m.fallbackFamily).toBeNull();
  });

  it("still resolves the spaced form 'Adelle Sans'", () => {
    const m = matchFont("Adelle Sans");
    expect(m.fallbackFamily).toBe("Source Sans 3");
  });
});

describe("assignRoles — decorative script fonts never win heading/body", () => {
  it("does not let an accent script font (Caveat) beat the real brand font", () => {
    // televerde.com loads Google 'Caveat' (weights 500/600/700) for a small
    // handwritten accent, alongside the weightless Typekit brand font. The old
    // weight->=600 heuristic crowned Caveat as the H1 face.
    const candidates: FontEvidence[] = [
      { family: "Caveat", weights: [500, 600, 700], source: "google-link" },
      { family: "adelle-sans", weights: [], source: "typekit-link" },
    ];
    const roles = assignRoles(candidates, { heading: null, body: null, mono: null });
    expect(roles.heading?.family).toBe("adelle-sans");
    expect(roles.body?.family).toBe("adelle-sans");
  });

  it("falls back to the script font only when it is the sole candidate", () => {
    const candidates: FontEvidence[] = [
      { family: "Pacifico", weights: [400], source: "google-link" },
    ];
    const roles = assignRoles(candidates, { heading: null, body: null, mono: null });
    // degenerate: nothing usable, so we surface the only font rather than fail
    expect(roles.heading?.family).toBe("Pacifico");
  });

  it("keeps a legit display serif as the heading", () => {
    const candidates: FontEvidence[] = [
      { family: "Playfair Display", weights: [600, 700], source: "google-link" },
      { family: "Inter", weights: [400, 500], source: "google-link" },
    ];
    const roles = assignRoles(candidates, { heading: null, body: null, mono: null });
    expect(roles.heading?.family).toBe("Playfair Display");
    expect(roles.body?.family).toBe("Inter");
  });
});

describe("parseTypeScale (P1-1)", () => {
  it("parses h1/h2/h3/body size/weight/line-height from bare element CSS rules", () => {
    const stylesheets = [{
      css: `
        h1 { font-size: 48px; font-weight: 700; line-height: 1.1; color: #000; }
        h2 { font-size: 32px; font-weight: 600; }
        h3 { font-size: 24px; }
        body { font-size: 16px; line-height: 1.5; font-weight: 400; }
        .card h1 { font-size: 99px; }
      `,
    }];
    const scale = parseTypeScale(null, stylesheets);
    expect(scale?.h1?.size).toBe("48px");
    expect(scale?.h1?.weight).toBe(700);
    expect(scale?.h1?.lineHeight).toBe("1.1");
    expect(scale?.h2?.size).toBe("32px");
    expect(scale?.h3?.size).toBe("24px");
    expect(scale?.body?.size).toBe("16px");
    expect(scale?.body?.lineHeight).toBe("1.5");
  });

  it("ignores scoped/class selectors so component overrides don't pollute the scale", () => {
    const stylesheets = [{ css: `.hero h1 { font-size: 88px; } #x h2 { font-size: 5px; }` }];
    // No bare element rules → nothing usable → undefined (fail-open).
    expect(parseTypeScale(null, stylesheets)).toBeUndefined();
  });

  it("returns undefined when no size/weight/line-height declarations exist", () => {
    const stylesheets = [{ css: `h1 { color: #333; } body { margin: 0; }` }];
    expect(parseTypeScale(null, stylesheets)).toBeUndefined();
  });
});
