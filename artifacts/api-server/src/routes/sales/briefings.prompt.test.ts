import { describe, expect, it } from "vitest";

import {
  buildAccountBriefingPrompt,
  type AccountBriefingPromptArgs,
} from "../../lib/briefing-service";
import type { SalesBrandContext } from "../../lib/salesBrandContext";

// ─── Fixtures ──────────────────────────────────────────────
// The prospect being researched (the BUYER). Only the fields the
// prompt builder reads need to be populated.
const PROSPECT: AccountBriefingPromptArgs["account"] = {
  name: "Rasta Holdings",
  domain: "rasta.example.com",
  industry: "Dental Services Organization",
  segment: "Mid-Market",
  city: "Miami",
  state: "FL",
  privateEquityFirm: null,
  numLocations: 24,
  dsoSize: "Large",
  brandCompanyDescription: null,
  brandTargetAudience: null,
  brandName: null,
};

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
    trustedResearchDomains: [],
    ...overrides,
  };
}

function buildSystem(
  brandCtx: SalesBrandContext,
  account: AccountBriefingPromptArgs["account"] = PROSPECT,
): string {
  const { systemPrompt } = buildAccountBriefingPrompt({
    account,
    brandCtx,
    researchText: "",
    websiteContent: "",
    sources: [],
  });
  return systemPrompt;
}

describe("buildAccountBriefingPrompt — seller→prospect direction", () => {
  it("positions the tenant (Televerde) as the seller and the account as the buyer", () => {
    const sys = buildSystem(
      makeBrandCtx({ brandName: "Televerde", briefBlurb: "(a B2B demand-generation partner)" }),
    );

    // Seller identity is the tenant, with its descriptor.
    expect(sys).toContain("Televerde — a B2B demand-generation partner");
    // Direction is stated explicitly: Televerde sells TO the prospect.
    expect(sys).toContain("how THE SELLER should sell ITS OWN products and services TO THE PROSPECT");
    // The prospect is named as the buyer.
    expect(sys).toContain("Rasta Holdings");
    // Field-level direction anchors the value prop to buying from the seller.
    expect(sys).toContain("why Rasta Holdings should buy from Televerde");
    // Recommended messages are spoken BY a Televerde rep TO the prospect.
    expect(sys).toContain("what a Televerde sales rep should say to that person at Rasta Holdings");
    // Page recommendations are for a page the SELLER shows the prospect.
    expect(sys).toContain("Televerde will show Rasta Holdings");
  });

  it("forbids the self-selling flip explicitly", () => {
    const sys = buildSystem(makeBrandCtx({ brandName: "Televerde" }));
    expect(sys).toContain(
      "NEVER describe how Rasta Holdings should sell to ITS OWN customers",
    );
    expect(sys).toContain("Rasta Holdings is the BUYER/prospect, not the seller");
  });

  it("includes the seller's value props as what the seller offers", () => {
    const sys = buildSystem(
      makeBrandCtx({
        brandName: "Televerde",
        salesIntroLine: "We turn pipeline gaps into booked meetings.",
        valuePropPairs: [
          { roles: ["VP Sales"], theme: "Predictable pipeline", pain: "Empty calendar", proof: "3x meetings in 90 days" },
        ],
      }),
    );
    expect(sys).toContain("What Televerde offers:");
    expect(sys).toContain("Positioning / voice: We turn pipeline gaps into booked meetings.");
    expect(sys).toContain("For VP Sales → Predictable pipeline");
    expect(sys).toContain("Proof: 3x meetings in 90 days");
  });

  it("falls back to a neutral seller when no brand identity is configured, without naming the prospect as seller", () => {
    const sys = buildSystem(makeBrandCtx());
    // Neutral seller fallback — never the prospect's name.
    expect(sys).toContain("how THE SELLER should sell ITS OWN products and services TO THE PROSPECT");
    expect(sys).toContain("why Rasta Holdings should buy from our company");
    // The SELLER block must resolve to the neutral fallback, not the prospect.
    expect(sys).toContain(
      "=== THE SELLER (your employer — the company doing the selling) ===\nour company",
    );
  });

  it("never frames the briefing from the prospect's selling point of view", () => {
    const sys = buildSystem(makeBrandCtx({ brandName: "Televerde" }));
    // The whole briefing is written from the seller's POV.
    expect(sys).toContain("Write the entire briefing from Televerde's point of view as the SELLER");
  });
});
