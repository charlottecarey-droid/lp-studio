/**
 * Unit test for non-Dandy ("Royal") one-pager PDF rebranding.
 *
 * This is the mirror of dandyGatedTemplates.integration.test.ts. That test
 * proves the *Dandy* path (gated built-ins are reachable, and the server blocks
 * non-Dandy tenants from cloning them). This test proves the rebranding path:
 * when a one-pager IS produced for a non-Dandy tenant, every Dandy token in the
 * copy must be scrubbed out and replaced with the tenant's brand.
 *
 * Why call the shared generators directly instead of driving the UI:
 *   - The Agreement Summary built-in is Dandy-gated (see DANDY_GATED_BUILTIN_IDS),
 *     so a Royal tenant can never reach it through the client picker. The PDF
 *     generator in @workspace/one-pager-types is therefore the only boundary
 *     where its rebranding can be exercised — there is no UI path to assert.
 *   - The generators are the single source of brand scrubbing (scrubBrandDeep)
 *     for every caller (client wrapper + server route), so a brand-leak
 *     regression shows up here first.
 *
 * How the assertions read the rendered PDF:
 *   jsPDF writes standard-font (helvetica) text as readable `(...) Tj` operators
 *   into uncompressed content streams, so the rendered text is recoverable by
 *   decoding doc.output("arraybuffer") as latin1. Custom-embedded font text
 *   (the Agreement headline uses "Bagoss") is encoded as glyph indices with no
 *   ToUnicode map and is NOT recoverable — so the headline is covered separately
 *   by asserting on the scrubbed content object directly (deterministic), while
 *   the ROI built-in is entirely helvetica and is fully covered at the PDF level.
 *
 * Each case also renders the SAME template with the default Dandy brand as a
 * positive control: the Dandy tokens must be PRESENT there, proving the Royal
 * assertions have teeth (absence is due to scrubbing, not to the tokens never
 * being drawn / never being searchable).
 */
import { describe, it, expect } from "vitest";
import {
  generateAgreementSummaryOnePager,
  generateROIOnePager,
  defaultAgreementSummaryContent,
  scrubBrandDeep,
  type BrandContext,
} from "@workspace/one-pager-types/generators";
import { DANDY_GATED_BUILTIN_IDS } from "@workspace/one-pager-types/constants";
import type { jsPDF } from "jspdf";

/** A non-Dandy tenant brand, mirroring the per-tenant BrandContext the client
 *  builds in sales-one-pager.tsx. The label "Royal" must end up in the PDF. */
const ROYAL_BRAND: BrandContext = {
  wordmark: "royal",
  productName: "Royal",
  industryLabel: "Group",
  labName: "Royal Dental Lab",
  footerUrl: "www.royaldental.com/group",
  qrFallbackUrl: "https://royaldental.com",
  agreementName: "Royal Practice Agreement",
  agreementUrl: "https://royaldental.com/practice-agreement",
};

const BRAND_LABEL = "Royal";

/** Tokens that must NEVER appear in a non-Dandy tenant's rendered copy. */
const DANDY_TOKENS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: '"Dandy"', re: /dandy/i },
  { name: '"DSO" (whole word)', re: /\bDSOs?\b/i },
  { name: '"meetdandy.com"', re: /meetdandy\.com/i },
];

/** Decode the searchable (standard-font) text streams from a rendered jsPDF. */
function searchableText(doc: jsPDF): string {
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

function expectNoDandyTokens(text: string): void {
  for (const token of DANDY_TOKENS) {
    expect(token.re.test(text), `rendered copy must not contain ${token.name}`).toBe(false);
  }
}

function expectHasDandyTokens(text: string): void {
  // Positive control: the un-rebranded (Dandy) render must contain Dandy copy,
  // otherwise the "no tokens" assertion above would pass vacuously.
  const found = DANDY_TOKENS.some((t) => t.re.test(text));
  expect(found, "Dandy-brand control render should contain Dandy tokens").toBe(true);
}

describe("non-Dandy one-pager rebranding — Agreement Summary (Dandy-gated built-in)", () => {
  it("is a gated built-in (reachable only via the generator, never the UI, for a non-Dandy tenant)", () => {
    expect(DANDY_GATED_BUILTIN_IDS).toContain("agreement-summary");
  });

  it("scrubs every Dandy token from the content and injects the tenant brand", () => {
    // Covers the headline too — it renders in the embedded Bagoss font and is
    // not recoverable from the PDF, so we assert on the scrubbed content here.
    const scrubbed = scrubBrandDeep(defaultAgreementSummaryContent, ROYAL_BRAND);
    const json = JSON.stringify(scrubbed);
    expectNoDandyTokens(json);
    expect(scrubbed.headline).toBe("Summary of Royal Agreement");
    expect(json).toMatch(/royal/i);
  });

  it("renders a PDF whose searchable copy is Dandy-free and carries the brand", async () => {
    const doc = await generateAgreementSummaryOnePager(defaultAgreementSummaryContent, {
      brand: ROYAL_BRAND,
    });
    const text = searchableText(doc);
    expectNoDandyTokens(text);
    expect(text).toMatch(new RegExp(BRAND_LABEL, "i"));
  });

  it("positive control: the same template rendered as Dandy DOES contain Dandy tokens", async () => {
    const doc = await generateAgreementSummaryOnePager(defaultAgreementSummaryContent);
    expectHasDandyTokens(searchableText(doc));
  });
});

describe("non-Dandy one-pager rebranding — ROI (non-gated built-in)", () => {
  it("is NOT a gated built-in (a non-Dandy tenant can generate it)", () => {
    expect(DANDY_GATED_BUILTIN_IDS).not.toContain("roi");
  });

  it("renders a PDF whose searchable copy is Dandy-free and carries the brand", async () => {
    const doc = await generateROIOnePager("Acme Group", 10, { brand: ROYAL_BRAND });
    const text = searchableText(doc);
    expectNoDandyTokens(text);
    expect(text).toMatch(new RegExp(BRAND_LABEL, "i"));
  });

  it("positive control: the same template rendered as Dandy DOES contain Dandy tokens", async () => {
    const doc = await generateROIOnePager("Acme Group", 10);
    expectHasDandyTokens(searchableText(doc));
  });
});
