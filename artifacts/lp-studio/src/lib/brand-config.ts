export type ButtonRadius = "pill" | "rounded" | "slight" | "square";
export type ButtonShadow = "none" | "sm" | "md" | "lg";
export type ButtonPaddingX = "compact" | "regular" | "spacious";
export type ButtonPaddingY = "compact" | "regular" | "spacious";
export type ButtonFontWeight = "normal" | "medium" | "semibold" | "bold";
export type ButtonTextCase = "uppercase" | "capitalize" | "normal";
export type ButtonLetterSpacing = "tight" | "normal" | "wide" | "wider";
export type SectionPadding = "compact" | "comfortable" | "spacious";
export type HeadingWeight = "semibold" | "bold" | "extrabold" | "black";
export type HeadingLetterSpacing = "tight" | "normal" | "wide";
export type BodyTextSize = "sm" | "md" | "lg";
export type HeadlineSize = "sm" | "md" | "lg" | "xl" | "2xl";
export type EyebrowStyle = "uppercase" | "normal";
export type SecondaryButtonStyle = "outline" | "ghost" | "filled";

export interface MessagingPillar {
  label: string;
  description: string;
}

export interface ProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: string[];
  keywords: string[];
}

export interface SegmentPersona {
  role: string;
  painPoints: string[];
}

export interface SegmentChallenge {
  title: string;
  desc: string;
}

export interface SegmentStat {
  value: string;
  label: string;
}

export interface SegmentComparisonRow {
  need: string;
  us: string;
  them: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  messagingAngle: string;
  uniqueContext: string;
  valueProps: string[];
  segmentProducts: string[];
  personas: SegmentPersona[];
  challenges: SegmentChallenge[];
  stats: SegmentStat[];
  comparisonRows: SegmentComparisonRow[];
}

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
  textColor: string;
  ctaBackground: string;
  ctaText: string;
  pageBackground: string;
  cardBackground: string;
  navText: string;
  borderColor: string;
  secondary1: string;
  secondary2: string;
  secondary3: string;
  secondary4: string;
  secondary5: string;
  buttonRadius: ButtonRadius;
  buttonShadow: ButtonShadow;
  buttonPaddingX: ButtonPaddingX;
  buttonPaddingY: ButtonPaddingY;
  buttonFontWeight: ButtonFontWeight;
  buttonTextCase: ButtonTextCase;
  buttonLetterSpacing: ButtonLetterSpacing;
  secondaryButtonStyle: SecondaryButtonStyle;
  sectionPadding: SectionPadding;
  displayFont: string;
  bodyFont: string;
  h1Size: HeadlineSize;
  h2Size: HeadlineSize;
  h3Size: HeadlineSize;
  headingWeight: HeadingWeight;
  headingLetterSpacing: HeadingLetterSpacing;
  bodyTextSize: BodyTextSize;
  eyebrowStyle: EyebrowStyle;
  brandName: string;
  companyDescription: string;
  taglines: string[];
  messagingPillars: MessagingPillar[];
  toneOfVoice: string;
  toneKeywords: string[];
  avoidPhrases: string[];
  targetAudience: string;
  copyExamples: string[];
  copyInstructions: string;
  productLines: ProductLine[];
  segments: AudienceSegment[];
  chilipiperUrl?: string;
  logoUrl?: string;
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
  textColor: "#1a1a1a",
  ctaBackground: "#C7E738",
  ctaText: "#003A30",
  pageBackground: "#ffffff",
  cardBackground: "#ffffff",
  navText: "#ffffff",
  borderColor: "#e2e8f0",
  secondary1: "",
  secondary2: "",
  secondary3: "",
  secondary4: "",
  secondary5: "",
  buttonRadius: "pill",
  buttonShadow: "none",
  buttonPaddingX: "regular",
  buttonPaddingY: "regular",
  buttonFontWeight: "normal",
  buttonTextCase: "uppercase",
  buttonLetterSpacing: "wider",
  secondaryButtonStyle: "outline",
  sectionPadding: "comfortable",
  displayFont: "",
  bodyFont: "",
  h1Size: "xl",
  h2Size: "lg",
  h3Size: "md",
  headingWeight: "bold",
  headingLetterSpacing: "tight",
  bodyTextSize: "md",
  eyebrowStyle: "uppercase",
  brandName: "",
  companyDescription: "",
  taglines: [],
  messagingPillars: [],
  toneOfVoice: "",
  toneKeywords: [],
  avoidPhrases: [],
  targetAudience: "",
  copyExamples: [],
  copyInstructions: "",
  productLines: [],
  segments: [],
  logoUrl: "",
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

const HEADING_WEIGHT: Record<HeadingWeight, string> = {
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
};

const HEADING_LETTER_SPACING: Record<HeadingLetterSpacing, string> = {
  tight: "tracking-tight",
  normal: "tracking-normal",
  wide: "tracking-wide",
};

const BODY_TEXT_SIZE: Record<BodyTextSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
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
    "text-sm transition-all",
    extra,
  ].filter(Boolean).join(" ");
}

export function getSecondaryButtonClasses(brand: BrandConfig): string {
  const base = [
    BUTTON_RADIUS[brand.buttonRadius],
    BUTTON_PX[brand.buttonPaddingX],
    BUTTON_PY[brand.buttonPaddingY],
    BUTTON_WEIGHT[brand.buttonFontWeight],
    BUTTON_CASE[brand.buttonTextCase],
    BUTTON_SPACING[brand.buttonLetterSpacing],
    "text-sm transition-all",
  ].filter(Boolean).join(" ");

  const style = brand.secondaryButtonStyle ?? "outline";
  if (style === "outline") return `${base} border-2`;
  if (style === "ghost") return `${base} bg-transparent`;
  return base;
}

export function getHeadingWeightClass(brand: BrandConfig): string {
  return HEADING_WEIGHT[brand.headingWeight ?? "bold"];
}

export function getHeadingLetterSpacingClass(brand: BrandConfig): string {
  return HEADING_LETTER_SPACING[brand.headingLetterSpacing ?? "tight"];
}

export function getBodySizeClass(brand: BrandConfig): string {
  return BODY_TEXT_SIZE[brand.bodyTextSize ?? "md"];
}

export function buildCopySystemPrompt(brand: BrandConfig): string {
  const parts: string[] = [];
  if (brand.brandName) {
    parts.push(`You are writing copy for ${brand.brandName}.`);
  }
  if (brand.companyDescription) {
    parts.push(`Company context: ${brand.companyDescription}`);
  }
  if (brand.toneOfVoice) {
    parts.push(`Tone: ${brand.toneOfVoice}.`);
  }
  if (brand.messagingPillars?.length > 0) {
    const themes = brand.messagingPillars.map((p) => `${p.label}: ${p.description}`).join("; ");
    parts.push(`Always reflect one of these themes: ${themes}.`);
  }
  if (brand.copyExamples?.length > 0) {
    parts.push(`Style reference headlines: ${brand.copyExamples.join(" | ")}.`);
  }
  if (brand.toneKeywords?.length > 0) {
    parts.push(`Style keywords: ${brand.toneKeywords.join(", ")}.`);
  }
  if (brand.avoidPhrases?.length > 0) {
    parts.push(`Never use: ${brand.avoidPhrases.join(", ")}.`);
  }
  if (brand.targetAudience) {
    parts.push(`Audience: ${brand.targetAudience}.`);
  }
  if (brand.copyInstructions?.trim()) {
    parts.push(brand.copyInstructions.trim());
  }
  if (brand.productLines?.length > 0) {
    const productInfo = brand.productLines
      .filter((p) => p.name)
      .map((p) => {
        const bits = [`- ${p.name}`];
        if (p.description) bits.push(`  ${p.description}`);
        if (p.valueProps?.length) bits.push(`  Value props: ${p.valueProps.join(", ")}`);
        if (p.claims?.length) bits.push(`  Claims: ${p.claims.join(", ")}`);
        if (p.keywords?.length) bits.push(`  Keywords: ${p.keywords.join(", ")}`);
        return bits.join("\n");
      }).join("\n");
    parts.push(`Product lines:\n${productInfo}`);
  }
  return parts.join("\n");
}

export function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
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
