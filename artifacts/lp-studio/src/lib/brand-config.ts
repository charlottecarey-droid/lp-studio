export type ButtonRadius = "pill" | "rounded" | "slight" | "square";
export type ButtonShadow = "none" | "sm" | "md" | "lg";
export type ButtonPaddingX = "compact" | "regular" | "spacious";
export type ButtonPaddingY = "compact" | "regular" | "spacious";
export type ButtonFontWeight = "normal" | "medium" | "semibold" | "bold";
export type ButtonTextCase = "uppercase" | "capitalize" | "normal";
export type ButtonLetterSpacing = "tight" | "normal" | "wide" | "wider";
export type SectionPadding = "compact" | "comfortable" | "spacious";

export interface BrandConfig {
  primaryColor: string;
  accentColor: string;
  navBgColor: string;
  navCtaText: string;
  navCtaUrl: string;
  defaultCtaText: string;
  defaultCtaUrl: string;
  copyrightName: string;
  socialUrls: {
    facebook: string;
    instagram: string;
    linkedin: string;
  };
  buttonRadius: ButtonRadius;
  buttonShadow: ButtonShadow;
  buttonPaddingX: ButtonPaddingX;
  buttonPaddingY: ButtonPaddingY;
  buttonFontWeight: ButtonFontWeight;
  buttonTextCase: ButtonTextCase;
  buttonLetterSpacing: ButtonLetterSpacing;
  sectionPadding: SectionPadding;
}

export const DEFAULT_BRAND: BrandConfig = {
  primaryColor: "#003A30",
  accentColor: "#C7E738",
  navBgColor: "#000000",
  navCtaText: "Get Pricing",
  navCtaUrl: "https://www.meetdandy.com/get-started/",
  defaultCtaText: "Get Started Free",
  defaultCtaUrl: "https://www.meetdandy.com/get-started/",
  copyrightName: "Dandy",
  socialUrls: {
    facebook: "https://www.facebook.com/meetdandy/",
    instagram: "https://www.instagram.com/meetdandy/",
    linkedin: "https://www.linkedin.com/company/meetdandy/",
  },
  buttonRadius: "pill",
  buttonShadow: "none",
  buttonPaddingX: "regular",
  buttonPaddingY: "regular",
  buttonFontWeight: "normal",
  buttonTextCase: "uppercase",
  buttonLetterSpacing: "wider",
  sectionPadding: "comfortable",
};

const BUTTON_RADIUS: Record<ButtonRadius, string> = {
  pill: "rounded-full",
  rounded: "rounded-xl",
  slight: "rounded-lg",
  square: "rounded-none",
};

const BUTTON_SHADOW: Record<ButtonShadow, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg shadow-black/20",
};

const BUTTON_PX: Record<ButtonPaddingX, string> = {
  compact: "px-4",
  regular: "px-5",
  spacious: "px-8",
};

const BUTTON_PY: Record<ButtonPaddingY, string> = {
  compact: "py-2",
  regular: "py-3",
  spacious: "py-4",
};

const BUTTON_WEIGHT: Record<ButtonFontWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const BUTTON_CASE: Record<ButtonTextCase, string> = {
  uppercase: "uppercase",
  capitalize: "capitalize",
  normal: "normal-case",
};

const BUTTON_SPACING: Record<ButtonLetterSpacing, string> = {
  tight: "tracking-tight",
  normal: "tracking-normal",
  wide: "tracking-wide",
  wider: "tracking-wider",
};

export const SECTION_PY: Record<SectionPadding, string> = {
  compact: "py-12",
  comfortable: "py-20",
  spacious: "py-32",
};

export function getButtonClasses(brand: BrandConfig, extra = ""): string {
  return [
    BUTTON_RADIUS[brand.buttonRadius],
    BUTTON_SHADOW[brand.buttonShadow],
    BUTTON_PX[brand.buttonPaddingX],
    BUTTON_PY[brand.buttonPaddingY],
    BUTTON_WEIGHT[brand.buttonFontWeight],
    BUTTON_CASE[brand.buttonTextCase],
    BUTTON_SPACING[brand.buttonLetterSpacing],
    "text-sm transition-transform hover:scale-105 active:scale-95",
    extra,
  ].filter(Boolean).join(" ");
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export async function fetchBrandConfig(): Promise<BrandConfig> {
  try {
    const res = await fetch(`${BASE}/api/lp/brand`);
    if (!res.ok) return DEFAULT_BRAND;
    const data = await res.json();
    return { ...DEFAULT_BRAND, ...data };
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function saveBrandConfig(config: BrandConfig): Promise<void> {
  const res = await fetch(`${BASE}/api/lp/brand`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to save brand config");
}
