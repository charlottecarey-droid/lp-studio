import { describe, expect, it } from "vitest";

import {
  formatSalesBrandSetupSummary,
  summarizeSalesBrandSetup,
  type SalesBrandContext,
  type ValuePropPair,
} from "./salesBrandContext";

function makeCtx(overrides: Partial<SalesBrandContext> = {}): SalesBrandContext {
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

const HAPPY_PAIR: ValuePropPair = {
  roles: ["Founder"],
  theme: "Speed to value",
  pain: "Slow onboarding",
  proof: "Live in a week",
};

describe("summarizeSalesBrandSetup", () => {
  it("reports nothing configured for a completely empty config", () => {
    const checklist = summarizeSalesBrandSetup(makeCtx());
    expect(checklist).toEqual({
      hasSendingDomain: false,
      hasReplyTo: false,
      hasSenderName: false,
      hasSenderLocalPart: false,
      hasValuePropPairs: false,
      isReadyToSend: false,
    });
    expect(formatSalesBrandSetupSummary(checklist)).toBe(
      "sender name, sender local part, sending domain, reply-to, value-prop pairs",
    );
  });

  it("flags missing pieces when sender identity is only partially filled", () => {
    const checklist = summarizeSalesBrandSetup(
      makeCtx({
        senderName: "Ada Lovelace",
        senderLocalPart: "ada",
        // sendingDomain intentionally whitespace-only — must not pass.
        sendingDomain: "   ",
        replyTo: "",
        valuePropPairs: [HAPPY_PAIR],
      }),
    );
    expect(checklist).toEqual({
      hasSenderName: true,
      hasSenderLocalPart: true,
      hasSendingDomain: false,
      hasReplyTo: false,
      hasValuePropPairs: true,
      isReadyToSend: false,
    });
    expect(formatSalesBrandSetupSummary(checklist)).toBe(
      "sending domain, reply-to",
    );
  });

  it("does not count value-prop pairs whose themes are empty or whitespace", () => {
    const checklist = summarizeSalesBrandSetup(
      makeCtx({
        senderName: "Ada",
        senderLocalPart: "ada",
        sendingDomain: "mail.example.com",
        replyTo: "replies@example.com",
        valuePropPairs: [
          { roles: ["Founder"], theme: "", pain: "x", proof: "y" },
          { roles: ["VP Sales"], theme: "   ", pain: "x", proof: "y" },
        ],
      }),
    );
    expect(checklist).toEqual({
      hasSenderName: true,
      hasSenderLocalPart: true,
      hasSendingDomain: true,
      hasReplyTo: true,
      hasValuePropPairs: false,
      // Envelope fields are all set, so sending is still allowed even
      // though value-prop pairs are missing — value-props gate copy
      // quality, not send permission.
      isReadyToSend: true,
    });
    expect(formatSalesBrandSetupSummary(checklist)).toBe("value-prop pairs");
  });

  it("reports a fully-configured happy path as ready to send", () => {
    const checklist = summarizeSalesBrandSetup(
      makeCtx({
        senderName: "Ada Lovelace",
        senderLocalPart: "ada",
        sendingDomain: "mail.example.com",
        replyTo: "replies@example.com",
        valuePropPairs: [HAPPY_PAIR],
      }),
    );
    expect(checklist).toEqual({
      hasSenderName: true,
      hasSenderLocalPart: true,
      hasSendingDomain: true,
      hasReplyTo: true,
      hasValuePropPairs: true,
      isReadyToSend: true,
    });
    expect(formatSalesBrandSetupSummary(checklist)).toBe("all essentials saved");
  });
});
