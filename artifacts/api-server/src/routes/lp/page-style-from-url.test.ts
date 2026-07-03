/**
 * pickPageStyleOverrides — the server-side filter that turns a brand-import
 * `proposed` map into a page style override payload. Pins the contract the FE
 * merge gate (lp-studio/src/lib/page-style-overrides.ts) relies on: visual
 * tokens pass, identity/copy/logo/voice proposals never do.
 */
import { describe, it, expect } from "vitest";
import { pickPageStyleOverrides } from "./page-style-from-url";

describe("pickPageStyleOverrides", () => {
  it("keeps visual tokens and drops identity/copy proposals", () => {
    const out = pickPageStyleOverrides({
      // visual — kept
      primaryColor: "#112233",
      ctaBackground: "#445566",
      displayFont: "Fraunces",
      buttonRadius: "pill",
      buttonStyleRaw: { category: "pill", radiusPx: 999, raw: {} },
      cardRadius: "soft",
      cardShadow: "sm",
      layoutDensity: "spacious",
      // identity / copy / assets — dropped
      brandName: "Acme",
      logoUrl: "https://acme.com/logo.svg",
      taglines: ["Do more"],
      voiceProfile: { profile: {} },
      scrapedStats: [{ text: "10M users" }],
      salesConsole: {},
      copyInstructions: "Write casually.",
      homepageScreenshotUrl: "https://x/shot.png",
    });
    expect(out).toEqual({
      primaryColor: "#112233",
      ctaBackground: "#445566",
      displayFont: "Fraunces",
      buttonRadius: "pill",
      buttonStyleRaw: { category: "pill", radiusPx: 999, raw: {} },
      cardRadius: "soft",
      cardShadow: "sm",
      layoutDensity: "spacious",
    });
  });

  it("drops empty and nullish values", () => {
    const out = pickPageStyleOverrides({
      primaryColor: "",
      accentColor: "   ",
      textColor: null,
      bodyFont: undefined,
      cardRadius: "rounded",
    });
    expect(out).toEqual({ cardRadius: "rounded" });
  });

  it("returns an empty object for an empty proposal", () => {
    expect(pickPageStyleOverrides({})).toEqual({});
  });
});
