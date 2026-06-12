import { describe, expect, it } from "vitest";

import {
  resolveSectionInk,
  ensureAccentRegisters,
  contrastRatio,
  mixHex,
} from "./section-ink";
import { resolveSectionSurface } from "./bg-styles";
import { DEFAULT_BRAND, getBrandStyleVars } from "./brand-config";

/** The pale-pink fashion-tenant palette from the production bug report. */
const PALE_PINK = "#F4C2D7";

describe("resolveSectionInk — contrast-guaranteed section inks", () => {
  it("white surface → dark ink, muted ink still ≥ 4.5:1 (WCAG AA)", () => {
    const ink = resolveSectionInk({}, { base: "#ffffff" });
    expect(contrastRatio(ink.text, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.muted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    // muted is softer than (or equal to) the primary ink, never harsher
    expect(contrastRatio(ink.muted, "#ffffff")).toBeLessThanOrEqual(
      contrastRatio(ink.text, "#ffffff"),
    );
  });

  it("dark surface → light ink, muted ≥ 4.5:1", () => {
    const ink = resolveSectionInk({}, { base: "#0f172a" });
    expect(contrastRatio(ink.text, "#0f172a")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.muted, "#0f172a")).toBeGreaterThanOrEqual(4.5);
  });

  it("pale pastel surface (the pale-pink-tenant bug) → muted body ink ≥ 4.5:1", () => {
    const ink = resolveSectionInk({}, { base: PALE_PINK });
    expect(contrastRatio(ink.text, PALE_PINK)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.muted, PALE_PINK)).toBeGreaterThanOrEqual(4.5);
  });

  it("respects an explicit textColor when it is readable", () => {
    const ink = resolveSectionInk({ textColor: "#333333" }, { base: "#ffffff" });
    expect(ink.text).toBe("#333333");
  });

  it("overrides an explicit textColor that is unreadable on the surface", () => {
    const ink = resolveSectionInk({ textColor: PALE_PINK }, { base: "#ffffff" });
    expect(ink.text).not.toBe(PALE_PINK);
    expect(contrastRatio(ink.text, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.muted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("never emits a sub-AA muted on mid-tone surfaces (hardens up to full ink)", () => {
    const midGray = "#9ca3af";
    const ink = resolveSectionInk({}, { base: midGray });
    expect(contrastRatio(ink.muted, midGray)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ensureAccentRegisters — chip saturation floor", () => {
  it("deepens a pale accent that vanishes on a white surface", () => {
    const blushPink = "#F9DEE9"; // near-white blush — invisible as a 14% tint
    expect(contrastRatio(blushPink, "#ffffff")).toBeLessThan(1.4);
    const fixed = ensureAccentRegisters(blushPink, { base: "#ffffff" });
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(1.4);
    expect(fixed).not.toBe(blushPink);
  });

  it("leaves an already-registering accent untouched", () => {
    expect(ensureAccentRegisters("#3B82F6", { base: "#ffffff" })).toBe("#3B82F6");
    expect(ensureAccentRegisters("#93c5fd", { base: "#0f172a" })).toBe("#93c5fd");
  });
});

describe("resolveSectionSurface — brand-aware preset darkness", () => {
  it('the "Brand color" preset resolves LIGHT for a pale-primary brand (the root-cause regression)', () => {
    const surface = resolveSectionSurface(
      { backgroundStyle: "dandy-green" },
      "#ffffff",
      { primaryColor: PALE_PINK },
    );
    expect(surface.isDark).toBe(false);
    expect(surface.base.toLowerCase()).toBe(PALE_PINK.toLowerCase());
    // ...and the derived inks stay readable on that real surface
    const ink = resolveSectionInk({}, surface);
    expect(contrastRatio(ink.muted, surface.base)).toBeGreaterThanOrEqual(4.5);
  });

  it('the "Brand color" preset stays dark for a dark-primary brand', () => {
    const surface = resolveSectionSurface(
      { backgroundStyle: "dandy-green" },
      "#ffffff",
      { primaryColor: "#003A30" },
    );
    expect(surface.isDark).toBe(true);
    expect(surface.base.toLowerCase()).toBe("#003a30");
  });

  it("a tenant preset recolor flips darkness by its actual color", () => {
    const surface = resolveSectionSurface(
      { backgroundStyle: "light-gray" },
      "#ffffff",
      { primaryColor: "#003A30", backgroundPresetColors: { "light-gray": "#111827" } },
    );
    expect(surface.isDark).toBe(true);
    expect(surface.base.toLowerCase()).toBe("#111827");
  });

  it("gradient preset is always treated as dark (fixed dark stops)", () => {
    const surface = resolveSectionSurface(
      { backgroundStyle: "gradient" },
      "#ffffff",
      { primaryColor: PALE_PINK },
    );
    expect(surface.isDark).toBe(true);
  });

  it("legacy callers (no brand) keep key-based behavior unchanged", () => {
    const surface = resolveSectionSurface({ backgroundStyle: "dandy-green" }, "#ffffff");
    expect(surface.isDark).toBe(true);
    expect(surface.base).toBe("#0f172a");
  });
});

describe("getBrandStyleVars — brand-color preset foreground leak", () => {
  it("always emits a contrast-derived --lp-bg-dandy-green-fg (dark ink for a pale primary)", () => {
    const vars = getBrandStyleVars({ ...DEFAULT_BRAND, primaryColor: PALE_PINK }) as Record<string, string>;
    expect(vars["--lp-bg-dandy-green-fg"]).toBe("#000000");
  });

  it("keeps white foreground for a dark primary", () => {
    const vars = getBrandStyleVars({ ...DEFAULT_BRAND, primaryColor: "#003A30" }) as Record<string, string>;
    expect(vars["--lp-bg-dandy-green-fg"]).toBe("#ffffff");
  });
});

describe("mixHex", () => {
  it("mixes toward the second color as the share drops", () => {
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
