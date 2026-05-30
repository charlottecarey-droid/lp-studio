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
import { generateCustomTemplatePdf, type CustomTemplatePdfBrandOpts } from "@workspace/one-pager-types/pdf";
import type { CustomTemplate, OverlayField } from "@workspace/one-pager-types";

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

// The custom-template generator historically hardcoded the Dandy white logo
// SVG, the meetdandy.com QR fallback, and a literal "dandy" wordmark. It now
// takes a CustomTemplatePdfBrandOpts thread (resolved per-tenant by the
// caller). For a non-Dandy tenant the generator must render that tenant's own
// brand — or nothing — but NEVER a Dandy asset/URL/wordmark.
function overlayField(partial: Partial<OverlayField> & Pick<OverlayField, "id" | "type">): OverlayField {
  return {
    label: partial.id,
    x: 10,
    y: 10,
    fontSize: 18,
    fontFamily: "helvetica",
    color: "#FFFFFF",
    bold: false,
    italic: false,
    defaultValue: "",
    ...partial,
  };
}

describe("Custom-template PDF — no Dandy logo/QR/wordmark leak for non-Dandy tenants", () => {
  const NON_DANDY_OPTS: CustomTemplatePdfBrandOpts = {
    // Royal has no brand-logo SVG → the legacy `dandy_logo` field must fall
    // back to the brand wordmark text, never the Dandy logo or a "dandy" string.
    brandLogoSvgUrl: "",
    brandWordmark: "royal",
    qrFallbackUrl: "https://royal.example.com",
  };

  function buildTemplate(): CustomTemplate {
    return {
      name: "Royal Custom",
      background_url: "",
      orientation: "portrait",
      fields: [
        overlayField({ id: "qr", type: "qr_code", x: 10, y: 10, qrSize: 12 }),
        overlayField({ id: "logo", type: "dandy_logo", x: 10, y: 40 }),
      ],
    };
  }

  async function spyQr(): Promise<{ seen: string[]; restore: () => void }> {
    const qrcode = await import("qrcode");
    const seen: string[] = [];
    const spy = vi
      .spyOn(qrcode.default, "toDataURL")
      .mockImplementation(async (text: string | qrcode.QRCodeSegment[]) => {
        if (typeof text === "string") seen.push(text);
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      });
    return { seen, restore: () => spy.mockRestore() };
  }

  it("renders the brand wordmark (never 'dandy') and the brand QR URL (never meetdandy.com) when the rep leaves QR/link empty", async () => {
    const { seen, restore } = await spyQr();
    let doc;
    try {
      // No per-field values at all (rep left QR/link empty) → generator must
      // resolve from brandOpts, not Dandy defaults.
      doc = await generateCustomTemplatePdf(buildTemplate(), {}, NON_DANDY_OPTS);
    } finally {
      restore();
    }
    const text = await extractPdfText(await pdfBytes(doc));
    expect(text, "custom-template PDF leaked the literal 'dandy' wordmark").not.toMatch(/\bdandy\b/i);
    expect(text, "brand wordmark was not rendered for the legacy dandy_logo field").toMatch(/royal/i);

    expect(seen.length, "QRCode.toDataURL was never invoked").toBeGreaterThan(0);
    for (const payload of seen) {
      expect(payload, `QR payload must not reference meetdandy.com (got "${payload}")`).not.toMatch(/meetdandy/i);
      expect(payload, `QR payload must resolve to the brand fallback (got "${payload}")`).toBe(
        "https://royal.example.com",
      );
    }
  }, 30_000);

  it("skips the QR and logo entirely (no Dandy fallback) when no brand logo/wordmark/QR URL is provided", async () => {
    const { seen, restore } = await spyQr();
    let doc;
    try {
      // Empty brandOpts → no QR fallback, no logo SVG, no wordmark. The
      // generator must skip both fields rather than emit a Dandy asset.
      doc = await generateCustomTemplatePdf(buildTemplate(), {}, {});
    } finally {
      restore();
    }
    const text = await extractPdfText(await pdfBytes(doc));
    expect(text, "custom-template PDF leaked a Dandy token with empty brandOpts").not.toMatch(/\bdandy\b/i);
    expect(text, "meetdandy.com leaked into the custom-template PDF").not.toMatch(/meetdandy\.com/i);
    expect(seen.length, "QR must be skipped when there is no URL at all").toBe(0);
  }, 30_000);
});
