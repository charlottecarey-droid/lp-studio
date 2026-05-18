// PDF-level non-leak validation for the shared one-pager generators (task #342).
//
// The Playwright spec `sales-console-no-dandy-leak.spec.ts` scans the rendered
// route innerText for forbidden Dandy/DSO/dental-lab/meetdandy.com tokens, but
// that scan only sees the HTML page chrome — it never inspects the actual
// bytes of the PDFs the sales generators produce. This vitest spec closes
// that gap: it runs each shared generator with a neutral, non-Dandy
// BrandContext (mirroring a Royal-tenant brand), extracts the text content
// of every page in the generated PDF via pdfjs-dist, and asserts that none
// of the forbidden strings appear.
//
// The same FORBIDDEN_PATTERNS list is intentionally aligned with the
// Playwright spec so the two assertions stay in lock-step.

import { describe, it, expect, vi } from "vitest";
import {
  generateAgreementSummaryOnePager,
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
  defaultAudienceContent,
  defaultAgreementSummaryContent,
  type BrandContext,
} from "@workspace/one-pager-types/generators";

const ROYAL_BRAND: BrandContext = {
  wordmark: "royal",
  productName: "Royal",
  industryLabel: "Group",
  labName: "Royal",
  footerUrl: "royal.example.com",
  qrFallbackUrl: "https://royal.example.com",
  agreementName: "Royal Practice Agreement",
  agreementUrl: "https://royal.example.com/agreement",
};

const FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: '"Dandy" brand name', pattern: /\bDandy\b/i },
  { label: '"DSO" acronym', pattern: /\bDSO\b/ },
  { label: '"dental lab" phrase', pattern: /\bdental\s+lab\b/i },
  { label: "meetdandy.com domain", pattern: /meetdandy\.com/i },
];

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // pdfjs-dist v5 ships a legacy build that runs cleanly in Node without
  // worker setup. We deliberately use that build so this test stays
  // self-contained and doesn't need a worker thread.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    // Disable the worker so the test can run in a plain Node vitest env.
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items as Array<{ str?: string }>) {
      if (typeof item.str === "string") parts.push(item.str);
    }
  }
  return parts.join(" ");
}

function assertNoLeaks(label: string, text: string): void {
  const hits: string[] = [];
  for (const { label: pl, pattern } of FORBIDDEN) {
    const m = text.match(pattern);
    if (m) {
      const idx = text.indexOf(m[0]);
      const ctx = text
        .slice(Math.max(0, idx - 40), Math.min(text.length, idx + m[0].length + 40))
        .replace(/\s+/g, " ")
        .trim();
      hits.push(`  • ${pl} → ${JSON.stringify(m[0])}\n      …${ctx}…`);
    }
  }
  if (hits.length > 0) {
    throw new Error(
      `Dandy/DSO/dental-lab leakage detected in ${label} PDF for a non-Dandy ` +
        `(Royal) tenant:\n${hits.join("\n")}\n\n` +
        `All tenant-facing strings in the shared generators must be routed ` +
        `through BrandContext / scrubBrand so non-Dandy tenants see neutral copy.`,
    );
  }
}

async function pdfBytes(doc: { output: (kind: "arraybuffer") => ArrayBuffer }): Promise<Uint8Array> {
  return new Uint8Array(doc.output("arraybuffer"));
}

describe("Shared one-pager generators — no Dandy/DSO/dental-lab leaks for non-Dandy tenants", () => {
  it("Agreement Summary PDF (defaults) contains no Dandy/DSO/dental-lab tokens", async () => {
    const doc = await generateAgreementSummaryOnePager(defaultAgreementSummaryContent, {
      brand: ROYAL_BRAND,
    });
    const text = await extractPdfText(await pdfBytes(doc));
    assertNoLeaks("Agreement Summary", text);
  }, 30_000);

  it("Pilot one-pager PDF (executive, defaults) contains no leaks", async () => {
    const doc = await generatePilotOnePager(
      "Royal Group",
      "executive",
      [],
      "",
      null,
      { w: 0, h: 0 },
      defaultAudienceContent.executive,
      undefined,
      undefined,
      { brand: ROYAL_BRAND },
    );
    const text = await extractPdfText(await pdfBytes(doc));
    assertNoLeaks("Pilot (executive)", text);
  }, 30_000);

  it("Pilot one-pager PDF (practice-manager) contains no leaks", async () => {
    const doc = await generatePilotOnePager(
      "Royal Group",
      "practice-manager",
      [],
      "",
      null,
      { w: 0, h: 0 },
      defaultAudienceContent["practice-manager"],
      undefined,
      undefined,
      { brand: ROYAL_BRAND },
    );
    const text = await extractPdfText(await pdfBytes(doc));
    assertNoLeaks("Pilot (practice-manager)", text);
  }, 30_000);

  it("Comparison one-pager PDF (defaults) contains no leaks", async () => {
    const doc = await generateComparisonOnePager(
      "Royal Group",
      [],
      "",
      null,
      { w: 0, h: 0 },
      undefined,
      undefined,
      { brand: ROYAL_BRAND },
    );
    const text = await extractPdfText(await pdfBytes(doc));
    assertNoLeaks("Comparison", text);
  }, 30_000);

  it("New Partner one-pager PDF (defaults) contains no leaks", async () => {
    const doc = await generateNewPartnerOnePager(
      "Royal Group",
      null,
      { w: 0, h: 0 },
      "https://royal.example.com",
      undefined,
      { brand: ROYAL_BRAND },
    );
    const text = await extractPdfText(await pdfBytes(doc));
    assertNoLeaks("New Partner", text);
  }, 30_000);

  it("ROI one-pager PDF (defaults) contains no leaks", async () => {
    const doc = await generateROIOnePager("Royal Group", 50, { brand: ROYAL_BRAND });
    const text = await extractPdfText(await pdfBytes(doc));
    assertNoLeaks("ROI", text);
  }, 30_000);
});

// QR codes are embedded as images, so the text-extraction tests above cannot
// catch a meetdandy.com URL encoded inside the QR pixels. Instead we spy on
// QRCode.toDataURL — the only path the New Partner generator uses to render
// QR — and assert the URL it receives resolves to the tenant's brand fallback,
// never meetdandy, when the rep passes an empty qrUrl (matching the new
// editor/templates defaults).
describe("New Partner QR payload resolves from BrandContext for non-Dandy tenants", () => {
  it("encodes brand.qrFallbackUrl, not meetdandy.com, when caller passes empty qrUrl", async () => {
    const qrcode = await import("qrcode");
    const seen: string[] = [];
    const spy = vi
      .spyOn(qrcode.default, "toDataURL")
      .mockImplementation(async (text: string | qrcode.QRCodeSegment[]) => {
        if (typeof text === "string") seen.push(text);
        // Return a 1x1 transparent PNG data URL so jsPDF.addImage doesn't fail.
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      });
    try {
      await generateNewPartnerOnePager(
        "Royal Group",
        null,
        { w: 0, h: 0 },
        "", // rep left QR URL empty — generator must fall back to brand.qrFallbackUrl
        undefined,
        { brand: ROYAL_BRAND },
      );
    } finally {
      spy.mockRestore();
    }
    expect(seen.length, "QRCode.toDataURL was never invoked").toBeGreaterThan(0);
    for (const payload of seen) {
      expect(
        payload,
        `QR payload encoded for Royal tenant must not reference meetdandy.com (got "${payload}")`,
      ).not.toMatch(/meetdandy/i);
      expect(
        payload,
        `QR payload encoded for Royal tenant must resolve to brand.qrFallbackUrl (got "${payload}")`,
      ).toBe(ROYAL_BRAND.qrFallbackUrl);
    }
  }, 30_000);
});
