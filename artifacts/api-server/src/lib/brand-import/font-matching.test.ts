import { describe, it, expect } from "vitest";
import { matchFont } from "./font-catalog";
import { assignRoles, type FontEvidence } from "./extractors/typography";

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
