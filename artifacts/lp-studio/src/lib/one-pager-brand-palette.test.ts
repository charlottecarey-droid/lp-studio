// Brand-palette resolution tests for the shared one-pager generators.
//
// The one-pager generators thread tenant brand colors through resolvePalette.
// Dandy (and every legacy caller that supplies no brand colors) must keep
// receiving the exact, byte-identical Dandy palette so existing Dandy PDFs
// never shift a single pixel of color. Non-Dandy tenants must derive a
// contrast-safe palette from their own primary/accent colors. These tests
// lock both guarantees in place against future palette tweaks.

import { describe, it, expect } from "vitest";
import {
  resolvePalette,
  DANDY_PALETTE,
  type BrandContext,
} from "@workspace/one-pager-types/generators";

describe("resolvePalette — Dandy byte-identical guarantee", () => {
  it("returns the exact Dandy palette when called with no brand context", () => {
    expect(resolvePalette(undefined)).toEqual(DANDY_PALETTE);
  });

  it("returns the exact Dandy palette when brand has no primary/accent colors", () => {
    const brand: BrandContext = { productName: "Dandy" };
    expect(resolvePalette(brand)).toEqual(DANDY_PALETTE);
  });

  it("treats empty / whitespace-only brand colors as 'no colors' (Dandy palette)", () => {
    expect(resolvePalette({ primaryColor: "", accentColor: "" })).toEqual(DANDY_PALETTE);
    expect(resolvePalette({ primaryColor: "   ", accentColor: "  " })).toEqual(DANDY_PALETTE);
  });
});

describe("resolvePalette — non-Dandy tenants derive from their brand colors", () => {
  it("derives the brand band/accent fills from the supplied colors", () => {
    const pal = resolvePalette({ primaryColor: "#1D4ED8", accentColor: "#F59E0B" });
    // Primary/accent fills mirror the supplied colors exactly …
    expect(pal.primary).toEqual([29, 78, 216]);
    expect(pal.accent).toEqual([245, 158, 11]);
    // … and the palette is NOT the Dandy one.
    expect(pal).not.toEqual(DANDY_PALETTE);
  });

  it("produces a deterministic, contrast-safe palette snapshot for a non-Dandy brand", () => {
    const pal = resolvePalette({ primaryColor: "#1D4ED8", accentColor: "#F59E0B" });
    expect(pal).toMatchInlineSnapshot(`
      {
        "accent": [
          245,
          158,
          11,
        ],
        "accentBorder": [
          245,
          158,
          11,
        ],
        "accentOnDark": [
          245,
          158,
          11,
        ],
        "checkColor": [
          29,
          78,
          216,
        ],
        "onPrimaryMuted": [
          192,
          205,
          244,
        ],
        "onPrimaryMuted2": [
          210,
          220,
          247,
        ],
        "primary": [
          29,
          78,
          216,
        ],
        "primaryAlt": [
          52,
          96,
          220,
        ],
        "primaryDeep": [
          25,
          66,
          184,
        ],
        "primaryMid": [
          56,
          99,
          221,
        ],
        "primaryOnLight": [
          29,
          78,
          216,
        ],
      }
    `);
  });
});
