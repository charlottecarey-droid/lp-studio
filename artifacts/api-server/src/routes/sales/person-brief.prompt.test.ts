import { describe, expect, it } from "vitest";

import {
  buildContactBriefPrompt,
  type ContactBriefPromptArgs,
} from "./person-brief";
import type { SalesBrandContext } from "../../lib/salesBrandContext";

// ─── Fixtures ──────────────────────────────────────────────
// Minimal contact/account rows — only the fields the prompt
// builder reads need to be populated. We cast to the table
// row types so the builder's strict typing is satisfied
// without depending on a live DB row shape.
const CONTACT = {
  firstName: "Jordan",
  lastName: "Avery",
  title: "VP of Operations",
  titleLevel: "VP",
  contactRole: "Operations",
  role: "Economic Buyer",
} as ContactBriefPromptArgs["contact"];

const ACCOUNT = {
  name: "Summit Dental Group",
  domain: "summitdental.com",
  segment: "Mid-Market",
  numLocations: 12,
  privateEquityFirm: "",
  industry: "Dental",
  dsoSize: "Medium",
  abmTier: "Tier 1",
  city: "Austin",
  state: "TX",
} as ContactBriefPromptArgs["account"];

function makeBrandCtx(overrides: Partial<SalesBrandContext> = {}): SalesBrandContext {
  return {
    tenantId: 1,
    brandName: "",
    tagline: "",
    taglines: [],
    defaultCtaUrl: "",
    chilipiperUrl: "",
    senderName: "",
    senderLocalPart: "",
    sendingDomain: "",
    brandedEmailSubdomain: "",
    replyTo: "",
    notificationsLocalPart: "notifications",
    emailSignature: "",
    emailFooter: "",
    salesIntroLine: "",
    briefBlurb: "",
    useBuiltInExemplars: false,
    customerNameRules: "",
    valuePropPairs: [],
    ...overrides,
  };
}

function buildPrompt(brandCtx: SalesBrandContext): string {
  const { prompt } = buildContactBriefPrompt({
    contact: CONTACT,
    account: ACCOUNT,
    briefing: null,
    brandCtx,
  });
  return prompt;
}

describe("buildContactBriefPrompt — per-tenant brand framing", () => {
  it("frames a non-Dandy tenant (Royal Design) with its own brand name and never leaks 'Dandy'", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 2,
        brandName: "Royal Design",
        briefBlurb: "(a premium interior design studio)",
      }),
    );

    // Intro framing uses the tenant's brand name + blurb.
    expect(prompt).toContain(
      "a B2B sales rep at Royal Design (a premium interior design studio)",
    );
    // Angle header is brand-specific.
    expect(prompt).toContain("**ROYAL DESIGN ANGLE**");
    // The possessive subject in the angle body uses the brand name too.
    expect(prompt).toContain("the single best Royal Design messaging pillar");
    // Critical isolation guarantee: no Dandy framing leaks in.
    expect(prompt).not.toMatch(/dandy/i);
  });

  it("preserves the original Dandy (tenant 1) framing byte-for-byte", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 1,
        brandName: "Dandy",
        briefBlurb: "(a dental lab and clinical performance platform for DSOs)",
      }),
    );

    expect(prompt).toContain(
      "a B2B sales rep at Dandy (a dental lab and clinical performance platform for DSOs)",
    );
    expect(prompt).toContain("**DANDY ANGLE**");
    expect(prompt).toContain("the single best Dandy messaging pillar");
  });

  it("produces a coherent, brand-neutral prompt for a no-config tenant", () => {
    const prompt = buildPrompt(makeBrandCtx({ tenantId: 99 }));

    // No brand name → neutral framing, neutral angle header.
    expect(prompt).toContain("a B2B sales rep at our company");
    expect(prompt).toContain("**RECOMMENDED ANGLE**");
    // The possessive subject collapses cleanly with no brand name.
    expect(prompt).toContain("the single best messaging pillar");
    // No other tenant's brand leaks into the neutral fallback.
    expect(prompt).not.toMatch(/dandy/i);
    // No dangling template gaps from unfilled brand fields.
    expect(prompt).not.toContain("{{");
    expect(prompt).not.toContain("}}");
    expect(prompt).not.toMatch(/at\s+\(/); // e.g. "rep at (blurb)" with no name
  });
});
