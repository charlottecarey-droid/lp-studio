import { describe, expect, it } from "vitest";

import {
  buildDraftEmailPrompt,
  spaceOutEmailSections,
  type DraftEmailPromptArgs,
  type DraftEmailContactFields,
  type DraftEmailAccountFields,
  type DraftEmailResearch,
} from "./draft-email";
import type { SalesBrandContext } from "../../lib/salesBrandContext";

// ─── Fixtures ──────────────────────────────────────────────
// Minimal contact/account/research inputs — only the fields the
// prompt builder reads need to be populated.
const CONTACT: DraftEmailContactFields = {
  firstName: "Jordan",
  lastName: "Avery",
  title: "VP of Operations",
  titleLevel: "VP",
  contactRole: "Operations",
  department: "Operations",
  linkedinUrl: "",
  buyerPersona: "Economic Buyer",
  contactTier: "Tier 1",
};

const ACCOUNT: DraftEmailAccountFields = {
  accountName: "Summit Dental Group",
  domain: "summitdental.com",
  industry: "Dental",
  segment: "Mid-Market",
  dsoSize: "Medium",
  privateEquityFirm: "",
  numLocations: 12,
  abmTier: "Tier 1",
  abmStage: "",
  practiceSegment: "",
  msaSigned: "",
  enterprisePilot: "",
  city: "Austin",
  state: "TX",
  accountNotes: "",
};

const RESEARCH: DraftEmailResearch = {
  person: "",
  company: "",
  linkedin: "",
  site: "",
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

function buildPrompt(
  brandCtx: SalesBrandContext,
  overrides: Partial<DraftEmailPromptArgs> = {},
): string {
  const { prompt } = buildDraftEmailPrompt({
    brandCtx,
    contact: CONTACT,
    account: ACCOUNT,
    briefing: null,
    research: RESEARCH,
    hasMicrosite: false,
    // Pin the date so recency-rule lines are deterministic across runs.
    now: new Date("2026-06-02T00:00:00Z"),
    ...overrides,
  });
  return prompt;
}

describe("buildDraftEmailPrompt — per-tenant brand framing", () => {
  it("frames a non-Dandy tenant (Royal Design) with its own brand and never leaks 'Dandy'", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 2,
        brandName: "Royal Design",
        briefBlurb: "a premium interior design studio",
        valuePropPairs: [
          {
            roles: ["Operations"],
            theme: "Project margins leak in handoffs",
            pain: "Design rework eats project profit",
            proof: "Studios cut rework 30% with shared specs",
          },
        ],
      }),
    );

    // Intro line is derived from the tenant's own brand name + blurb.
    expect(prompt).toContain(
      "You write short, human cold emails for Royal Design — a premium interior design studio.",
    );
    // The "don't over-explain" rule names the tenant's brand, not Dandy.
    expect(prompt).toContain("Don't over-explain Royal Design");
    // The tenant's value-prop pair drives the THEME OPTIONS section.
    expect(prompt).toContain('Theme: "Project margins leak in handoffs"');
    expect(prompt).toContain("Pain: Design rework eats project profit");
    // Critical isolation guarantee: no Dandy framing leaks in.
    expect(prompt).not.toMatch(/dandy/i);
  });

  it("honors a tenant's explicit salesIntroLine voice override", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 3,
        brandName: "Northwind Labs",
        salesIntroLine: "You write crisp, technical cold emails for Northwind Labs engineers.",
      }),
    );

    expect(prompt).toContain(
      "You write crisp, technical cold emails for Northwind Labs engineers.",
    );
    expect(prompt).toContain("Don't over-explain Northwind Labs");
    expect(prompt).not.toMatch(/dandy/i);
  });

  it("preserves the original Dandy (tenant 1) framing", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 1,
        brandName: "Dandy",
        briefBlurb: "a dental lab and clinical performance platform for DSOs",
        valuePropPairs: [
          {
            roles: ["Operations"],
            theme: "Remakes are silently destroying margin",
            pain: "Remakes erode lab spend and chair time",
            proof: "DSOs cut remakes 40% with Dandy",
          },
        ],
      }),
    );

    expect(prompt).toContain(
      "You write short, human cold emails for Dandy — a dental lab and clinical performance platform for DSOs.",
    );
    expect(prompt).toContain("Don't over-explain Dandy");
    expect(prompt).toContain('Theme: "Remakes are silently destroying margin"');
  });

  it("injects per-tenant customerNameRules verbatim as a mandatory phrasing rule", () => {
    const rule =
      'NEVER write that DCA consolidated practices "down to one"; always say "through a strategic partnership with Dandy".';
    const prompt = buildPrompt(
      makeBrandCtx({ tenantId: 1, brandName: "Dandy", customerNameRules: rule }),
    );

    expect(prompt).toContain("CUSTOMER NAMING & PHRASING RULES");
    expect(prompt).toContain(rule);
  });

  it("omits the phrasing-rules section entirely when customerNameRules is empty", () => {
    const prompt = buildPrompt(makeBrandCtx({ tenantId: 2, brandName: "Royal Design" }));
    expect(prompt).not.toContain("CUSTOMER NAMING & PHRASING RULES");
  });

  it("produces a coherent, brand-neutral prompt for a no-config tenant", () => {
    const prompt = buildPrompt(makeBrandCtx({ tenantId: 99 }));

    // No brand name → neutral "our team" framing in the intro line.
    expect(prompt).toContain("You write short, human cold emails for our team.");
    expect(prompt).toContain("Don't over-explain our team");
    // No value-prop pairs → the generic THEME GUIDANCE fallback, which
    // explicitly forbids inventing customer names/stats.
    expect(prompt).toContain("THEME GUIDANCE:");
    expect(prompt).toContain("Do NOT invent customer names, statistics, or case studies.");
    // No other tenant's brand leaks into the neutral fallback.
    expect(prompt).not.toMatch(/dandy/i);
    // No dangling template gaps from unfilled brand fields.
    expect(prompt).not.toContain("{{");
    expect(prompt).not.toContain("}}");
    // No stray "for  —" (empty brand name) or "for ." artifacts.
    expect(prompt).not.toContain("emails for  —");
    expect(prompt).not.toContain("emails for .");
  });
});

describe("spaceOutEmailSections", () => {
  it("inserts a blank line between sentences that arrived on consecutive lines", () => {
    const raw = "Hi Jason,\n\nProblem sentence.\nProof sentence.\nAsk sentence?\nBest,";
    expect(spaceOutEmailSections(raw)).toBe(
      "Hi Jason,\n\nProblem sentence.\n\nProof sentence.\n\nAsk sentence?\n\nBest,",
    );
  });

  it("collapses runs of blank lines and trailing whitespace to a single blank line", () => {
    const raw = "Hi Jason,   \n\n\n\nProblem.\n   \nProof.\n\n";
    expect(spaceOutEmailSections(raw)).toBe("Hi Jason,\n\nProblem.\n\nProof.");
  });
});
