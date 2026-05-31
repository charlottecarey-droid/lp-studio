// Render-level color guard for the shared one-pager generators (Dandy default).
//
// The unit test `one-pager-brand-palette.test.ts` proves that resolvePalette
// returns the Dandy palette for a brand-less (Dandy) context. But that only
// guards the palette *resolver* — it never proves the generators actually draw
// with those colors, nor that the colors survive into the rendered PDF bytes.
// A future tweak to a `setFillColor` call (or to the Dandy palette constants)
// could silently shift the on-page green/lime fills while every existing test
// kept passing.
//
// This spec closes that gap at the render level: it runs each shared generator
// with a brand-less (Dandy) context, reads the raw PDF content stream, and
// asserts the exact jsPDF fill-color operators for Dandy's brand green and lime
// are baked into the bytes.
//
// IMPORTANT — why the expected operators are HARDCODED literals (not derived
// from DANDY_PALETTE): if we built the expected operator from DANDY_PALETTE,
// then a change to the palette constant would move BOTH the expectation and the
// rendered bytes together and the test would keep passing — defeating its
// purpose. Instead we pin the *known-good Dandy brand RGB values* as literals
// here. If anyone changes the generators' fills (or the palette constants),
// the rendered bytes diverge from these literals and the test fails.
//
// jsPDF encodes a fill color as an `r g b rg` operator with each channel
// normalized to 0–1 at 2-decimal precision with trailing zeros stripped (e.g.
// 0 → "0.", 40/255 → "0.16"). `pdfFillOp` reproduces that exact formatting; it
// is validated implicitly by the assertions below (the strings must literally
// appear in the bytes jsPDF produced).

import { describe, it, expect } from "vitest";
import {
  generateAgreementSummaryOnePager,
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
  defaultAudienceContent,
  defaultAgreementSummaryContent,
  DANDY_PALETTE,
} from "@workspace/one-pager-types/generators";

// Known-good Dandy brand fill colors (0–255 RGB). These are intentionally
// duplicated as literals so the test fails if the generators' rendered fills
// drift away from them — see the file header for the rationale.
const DANDY_GREEN: [number, number, number] = [0, 40, 32]; // dark brand band fill (pal.primary)
const DANDY_LIME: [number, number, number] = [163, 190, 60]; // bright accent fill (pal.accent)
const DANDY_ACCENT_BORDER: [number, number, number] = [180, 200, 60]; // accent card border fill (pal.accentBorder)

// Reproduce jsPDF's fill-color operator encoding: each channel → value/255 at
// 2-decimal precision with trailing zeros stripped, joined by spaces, then the
// `rg` (fill) operator.
function pdfFillOp(rgb: [number, number, number]): string {
  return rgb.map((c) => (c / 255).toFixed(2).replace(/0+$/, "")).join(" ") + " rg";
}

const GREEN_OP = pdfFillOp(DANDY_GREEN);
const LIME_OP = pdfFillOp(DANDY_LIME);
const ACCENT_BORDER_OP = pdfFillOp(DANDY_ACCENT_BORDER);

async function pdfStream(doc: { output: (kind: "arraybuffer") => ArrayBuffer }): Promise<string> {
  // jsPDF leaves content streams uncompressed by default, so the fill-color
  // operators appear as plain text in the latin1-decoded bytes.
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

function expectFill(label: string, stream: string, op: string, colorName: string): void {
  expect(
    stream.includes(op),
    `${label} PDF must bake the Dandy ${colorName} fill operator ${JSON.stringify(op)} ` +
      `into its bytes. If this failed after a deliberate palette/render change, update ` +
      `the hardcoded Dandy brand RGB literals in this test to match.`,
  ).toBe(true);
}

// Sanity cross-check: the hardcoded literals above must still match the live
// Dandy palette. If someone changes the palette constants, this points them
// straight here so they update both the palette and the byte-level expectations
// deliberately, rather than letting a silent color shift slip through.
describe("Dandy palette constants match the render guard's hardcoded literals", () => {
  it("DANDY_PALETTE still equals the literals this test pins", () => {
    expect(DANDY_PALETTE.primary).toEqual(DANDY_GREEN);
    expect(DANDY_PALETTE.accent).toEqual(DANDY_LIME);
    expect(DANDY_PALETTE.accentBorder).toEqual(DANDY_ACCENT_BORDER);
  });
});

describe("Dandy one-pager PDFs bake the exact Dandy green/lime fills", () => {
  it("Agreement Summary draws the Dandy green band fill", async () => {
    const doc = await generateAgreementSummaryOnePager(defaultAgreementSummaryContent, {});
    expectFill("Agreement Summary", await pdfStream(doc), GREEN_OP, "green (primary band)");
  }, 30_000);

  it("Pilot (executive) draws the Dandy green band fill", async () => {
    const doc = await generatePilotOnePager(
      "Dandy Group",
      "executive",
      [],
      "",
      null,
      { w: 0, h: 0 },
      defaultAudienceContent.executive,
      undefined,
      undefined,
      {},
    );
    expectFill("Pilot (executive)", await pdfStream(doc), GREEN_OP, "green (primary band)");
  }, 30_000);

  it("Comparison draws BOTH the Dandy green band and lime accent fills", async () => {
    const doc = await generateComparisonOnePager(
      "Dandy Group",
      [],
      "",
      null,
      { w: 0, h: 0 },
      undefined,
      undefined,
      {},
    );
    const stream = await pdfStream(doc);
    expectFill("Comparison", stream, GREEN_OP, "green (primary band)");
    expectFill("Comparison", stream, LIME_OP, "lime (accent)");
  }, 30_000);

  it("New Partner draws the Dandy green band and lime accent-border fills", async () => {
    const doc = await generateNewPartnerOnePager(
      "Dandy Group",
      null,
      { w: 0, h: 0 },
      "https://meetdandy.com",
      undefined,
      {},
    );
    const stream = await pdfStream(doc);
    expectFill("New Partner", stream, GREEN_OP, "green (primary band)");
    expectFill("New Partner", stream, ACCENT_BORDER_OP, "lime (accent border)");
  }, 30_000);

  it("ROI draws BOTH the Dandy green band and lime accent fills", async () => {
    const doc = await generateROIOnePager("Dandy Group", 50, {});
    const stream = await pdfStream(doc);
    expectFill("ROI", stream, GREEN_OP, "green (primary band)");
    expectFill("ROI", stream, LIME_OP, "lime (accent)");
  }, 30_000);
});
