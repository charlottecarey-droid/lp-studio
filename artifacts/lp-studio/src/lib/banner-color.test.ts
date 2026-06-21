import { describe, it, expect } from "vitest";
import {
  bannerInk,
  isHexColor,
  normalizeBannerBg,
  BANNER_DEFAULT_BG,
} from "./banner-color";

const INK = "#1A1815";
const CREAM = "#F6F2E9";

describe("isHexColor", () => {
  it("accepts 6-digit hex (either case)", () => {
    expect(isHexColor("#4F46E5")).toBe(true);
    expect(isHexColor("#abcdef")).toBe(true);
  });
  it("rejects names, short hex, and junk", () => {
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#abc")).toBe(false);
    expect(isHexColor("4F46E5")).toBe(false);
    expect(isHexColor("")).toBe(false);
  });
});

describe("normalizeBannerBg", () => {
  it("keeps a valid hex value", () => {
    expect(normalizeBannerBg("#4F46E5")).toBe("#4F46E5");
  });
  it("falls back to the default on anything invalid", () => {
    expect(normalizeBannerBg("red")).toBe(BANNER_DEFAULT_BG);
    expect(normalizeBannerBg("")).toBe(BANNER_DEFAULT_BG);
    expect(normalizeBannerBg(null)).toBe(BANNER_DEFAULT_BG);
    expect(normalizeBannerBg(undefined)).toBe(BANNER_DEFAULT_BG);
  });
});

describe("bannerInk picks the higher-contrast text color", () => {
  const cases: [string, string][] = [
    ["#1A1815", CREAM], // ink → cream
    ["#000000", CREAM], // black → cream
    ["#4F46E5", CREAM], // indigo → cream
    ["#0E7C66", CREAM], // forest green → cream
    ["#334155", CREAM], // slate → cream
    ["#F6F2E9", INK], // cream → ink
    ["#FFFFFF", INK], // white → ink
    ["#FFD400", INK], // bright yellow → ink
    ["#E2603F", INK], // coral (bright) → ink reads higher-contrast
  ];
  it.each(cases)("%s → text %s", (bg, expected) => {
    expect(bannerInk(bg).text).toBe(expected);
  });

  it("derives the soft underline color from the chosen text color", () => {
    expect(bannerInk("#000000").textSoft).toContain("246,242,233"); // cream-based
    expect(bannerInk("#FFFFFF").textSoft).toContain("26,24,21"); // ink-based
  });

  it("never throws on a malformed value (falls back to default bg)", () => {
    expect(bannerInk("not-a-color").text).toBe(CREAM); // default bg is dark ink
  });
});
