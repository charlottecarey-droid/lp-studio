/**
 * Unit test for embedding a tenant's exact brand fonts into PDF one-pagers.
 *
 * The shared generators override jsPDF's built-in faces with base64 TTF bytes
 * supplied on `brand.fonts` (resolved client-side from the /sales/brand-font
 * endpoint). This proves three things at the generator level:
 *
 *   1. With NO brand fonts, the ROI built-in (which is 100% helvetica — no
 *      Bagoss) renders with NO embedded font program (`/FontFile2`).
 *   2. With a real TTF supplied as the BODY font, the same render now carries an
 *      embedded `/FontFile2` — the brand font reached the document.
 *   3. A malformed base64 face is swallowed: generation still succeeds and is
 *      identical to the no-font render (graceful fallback to the built-in face).
 *
 * ROI is used because it never embeds Bagoss, so `/FontFile2` is a clean signal
 * of OUR body-font override rather than the pre-existing Bagoss headline font.
 *
 * A real TTF is needed for assertion (2). We reuse the vendored Bagoss Regular
 * font as a stand-in "brand font" by reading its base64 straight off disk —
 * offline and deterministic, no network dependency.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateROIOnePager } from "@workspace/one-pager-types/generators";
import type { jsPDF } from "jspdf";

const here = dirname(fileURLToPath(import.meta.url));
const bagossPath = resolve(
  here,
  "../../../../../lib/one-pager-types/src/fonts/bagoss-regular.ts",
);
// Pull the long base64 literal out of the vendored Bagoss module to use as a
// known-good TTF "brand font" in the embed assertion.
const REAL_TTF_B64 = (/"([A-Za-z0-9+/=]{200,})"/.exec(readFileSync(bagossPath, "utf8")) ?? [])[1];

function bytes(doc: jsPDF): string {
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

describe("PDF one-pager brand font embedding (ROI built-in, helvetica-only)", () => {
  it("has a known-good real TTF fixture to embed", () => {
    expect(typeof REAL_TTF_B64).toBe("string");
    expect((REAL_TTF_B64 ?? "").length).toBeGreaterThan(1000);
  });

  it("embeds NO font program when the brand carries no fonts", async () => {
    const doc = await generateROIOnePager("Acme Group", 100);
    expect(bytes(doc)).not.toContain("FontFile2");
  });

  it("embeds the brand BODY font (FontFile2 present) when one is supplied", async () => {
    const doc = await generateROIOnePager("Acme Group", 100, {
      brand: { fonts: { body: { family: "Acme Sans", normal: REAL_TTF_B64 } } },
    });
    expect(bytes(doc)).toContain("FontFile2");
  });

  it("falls back gracefully when a face's base64 is malformed (no throw)", async () => {
    const doc = await generateROIOnePager("Acme Group", 100, {
      brand: { fonts: { body: { family: "Broken", normal: "!!!not-valid-base64!!!" } } },
    });
    // Generation still succeeds and, because the bad face was dropped, no font
    // program is embedded — exactly the no-fonts behaviour.
    const out = bytes(doc);
    expect(out.startsWith("%PDF")).toBe(true);
    expect(out).not.toContain("FontFile2");
  });

  it("embeds the brand DISPLAY font under the Bagoss face when supplied", async () => {
    // ROI doesn't draw Bagoss, but registerBrandFonts still registers the
    // heading override; supplying it must embed a font program without throwing.
    const doc = await generateROIOnePager("Acme Group", 100, {
      brand: { fonts: { heading: { family: "Acme Display", normal: REAL_TTF_B64 } } },
    });
    expect(bytes(doc)).toContain("FontFile2");
  });

  it("forces bundled Bagoss for Dandy's main header (isDandy embeds FontFile2)", async () => {
    // Dandy ships no embeddable brand font, so it can't arrive via fonts.heading.
    // The isDandy flag must force the bundled Bagoss face onto the header title,
    // which embeds a font program even though no fonts were supplied.
    const doc = await generateROIOnePager("Acme Group", 100, {
      brand: { isDandy: true },
    });
    expect(bytes(doc)).toContain("FontFile2");
  });

  it("never leaks bundled Bagoss onto a NON-Dandy header with no display font", async () => {
    // A non-Dandy tenant without a resolvable display font must stay on the
    // built-in helvetica header — bundled Bagoss must not embed/leak.
    const doc = await generateROIOnePager("Acme Group", 100, {
      brand: { productName: "Acme", primaryColor: "#123456" },
    });
    expect(bytes(doc)).not.toContain("FontFile2");
  });
});
