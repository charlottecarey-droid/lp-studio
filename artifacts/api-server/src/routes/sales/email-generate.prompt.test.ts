import { describe, expect, it } from "vitest";

import { buildGenerateEmailSystemPrompt } from "./email-generate";
import type { SalesBrandContext } from "../../lib/salesBrandContext";

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
  includesMicrositeLink = false,
): string {
  return buildGenerateEmailSystemPrompt({ brandCtx, includesMicrositeLink });
}

describe("buildGenerateEmailSystemPrompt — per-tenant brand framing", () => {
  it("frames a non-Dandy tenant (Royal Design) with its own brand and never leaks 'Dandy'", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 2,
        brandName: "Royal Design",
        briefBlurb: "a premium interior design studio",
      }),
    );

    // Intro line is derived from the tenant's own brand name + blurb.
    expect(prompt).toContain(
      "You are a sales email copywriter for Royal Design — a premium interior design studio.",
    );
    // Critical isolation guarantee: no Dandy framing leaks in.
    expect(prompt).not.toMatch(/dandy/i);
  });

  it("uses the brand name alone when no blurb is set", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 2,
        brandName: "Royal Design",
      }),
    );

    expect(prompt).toContain("You are a sales email copywriter for Royal Design.");
    expect(prompt).not.toMatch(/dandy/i);
  });

  it("honors a tenant's explicit salesIntroLine voice override", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 3,
        brandName: "Northwind Labs",
        briefBlurb: "an ignored blurb when an intro line is set",
        salesIntroLine: "You write crisp, technical sales emails for Northwind Labs engineers.",
      }),
    );

    expect(prompt).toContain(
      "You write crisp, technical sales emails for Northwind Labs engineers.",
    );
    // The explicit intro line wins — the blurb-derived framing is not emitted.
    expect(prompt).not.toContain("an ignored blurb when an intro line is set");
    expect(prompt).not.toMatch(/dandy/i);
  });

  it("preserves the original Dandy (tenant 1) framing", () => {
    const prompt = buildPrompt(
      makeBrandCtx({
        tenantId: 1,
        brandName: "Dandy",
        briefBlurb: "a dental lab and clinical performance platform for DSOs",
      }),
    );

    expect(prompt).toContain(
      "You are a sales email copywriter for Dandy — a dental lab and clinical performance platform for DSOs.",
    );
  });

  it("produces a coherent, brand-neutral prompt for a no-config tenant", () => {
    const prompt = buildPrompt(makeBrandCtx({ tenantId: 99 }));

    // No brand name → neutral "our team" framing in the intro line.
    expect(prompt).toContain("You are a sales email copywriter for our team.");
    // No other tenant's brand leaks into the neutral fallback.
    expect(prompt).not.toMatch(/dandy/i);
    // No dangling brand-name gaps from unfilled fields.
    expect(prompt).not.toContain("for  —");
    expect(prompt).not.toContain("copywriter for .");
    // The merge-variable braces are intentional ({{first_name}} etc.) — make
    // sure the brand framing itself introduced no empty {{}} gaps.
    expect(prompt).not.toContain("{{}}");
  });

  it("includes the microsite CTA instruction only when requested", () => {
    const withLink = buildPrompt(
      makeBrandCtx({ brandName: "Royal Design" }),
      true,
    );
    const withoutLink = buildPrompt(
      makeBrandCtx({ brandName: "Royal Design" }),
      false,
    );

    expect(withLink).toContain("Include a natural CTA linking to {{microsite_url}}");
    expect(withoutLink).not.toContain("Include a natural CTA linking to {{microsite_url}}");
  });
});
