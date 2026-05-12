import type { CSSProperties } from "react";
import { toFontFamilyValue } from "./font-catalog";
import type { BackgroundPresetLabels } from "./bg-styles";

export type { BackgroundPresetLabels };

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

/** Task #253 — claims can be plain strings (legacy) or `{text, approvedForAi}`
 * objects. Helpers `getClaimText` / `isClaimApproved` normalize both shapes
 * so callers don't need to branch. New entries are written as objects. */
export type ClaimEntry = string | { text: string; approvedForAi?: boolean };

export function getClaimText(c: ClaimEntry): string {
  return typeof c === "string" ? c : (c?.text ?? "");
}

/** Defaults to true (approved) when missing or when entry is a legacy string,
 *  matching the rollout default of "no behaviour change for existing data". */
export function isClaimApproved(c: ClaimEntry): boolean {
  if (typeof c === "string") return true;
  return c?.approvedForAi !== false;
}

export interface ProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: ClaimEntry[];
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
  /** Task #253 — defaults to true on existing rows. When the brand has
   *  `aiStrictFactsMode` enabled, generation will only consider stats with
   *  `approvedForAi !== false`. */
  approvedForAi?: boolean;
  /** Task #256 — optional link to a row in the tenant's proof-point library.
   *  When set and the proof point is approved, the stat inherits the proof
   *  point's approval state and value (so a single approval flows through
   *  every segment that links to the same proof point). */
  linkProofPointId?: number;
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
  /** Optional override URL for the display font's stylesheet (advanced
   *  picker path — accepts any Google Fonts CSS URL or self-hosted CSS). */
  displayFontUrl?: string;
  /** Optional override URL for the body font's stylesheet. */
  bodyFontUrl?: string;
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
  logoAutoRecolor?: boolean;
  /** Task #253 — when true, AI generation is restricted to facts the brand
   *  has explicitly approved (segment stats with `approvedForAi`, product-line
   *  claims with `approvedForAi`, library case studies with `approved_for_ai`),
   *  and an explicit "do not invent statistics" instruction is appended. Off
   *  by default — existing tenants see no behaviour change. */
  aiStrictFactsMode?: boolean;
  /** Per-brand label overrides for the section background dropdown shown on
   *  hero/cta/popup/etc property panels. Unset keys fall back to auto-derived
   *  labels (brand-name interpolated). See `getBgOptions` in `bg-styles.ts`. */
  backgroundPresetLabels?: BackgroundPresetLabels;
}

export const DEFAULT_BRAND: BrandConfig = {
  // Neutral, brand-agnostic defaults so untouched (non-Dandy) tenants
  // never inherit the Dandy forest/lime palette by default. Dandy tenants
  // (id 1, 5) override these through their own lp_brand_settings rows.
  primaryColor: "#0f172a",      // slate-900 — neutral dark
  accentColor: "#3b82f6",       // blue-500  — neutral accent
  navBgColor: "#000000",
  navCtaText: "Get Started",
  navCtaUrl: "#",
  defaultCtaText: "Get Started",
  defaultCtaUrl: "#",
  copyrightName: "",
  socialUrls: {
    facebook: "",
    instagram: "",
    linkedin: "",
  },
  textColor: "#1a1a1a",
  ctaBackground: "#0f172a",
  ctaText: "#ffffff",
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
  // No default logo. Tenants set their own via Brand Settings → Logo. When
  // empty, BrandLogo falls back to a brandName text wordmark. The Dandy
  // dental tenants store `/dandy-logo.svg` explicitly in their brand_settings,
  // so this neutral default does not affect them.
  logoUrl: "",
  logoAutoRecolor: true,
};

/* ----------------------------------------------------------------------------
 * Brand-driven CSS variables
 *
 * Emit a set of CSS custom properties on a wrapper element so that any block
 * descendant can reference brand colors via Tailwind arbitrary value classes
 * (e.g. `bg-[var(--brand-primary)]`, `text-[var(--brand-accent)]`,
 * `bg-[rgb(var(--brand-primary-rgb)/0.1)]` for opacity variants).
 * -------------------------------------------------------------------------- */

function hexToRgbTriplet(hex: string): string {
  if (!isValidHex(hex)) return "0 0 0";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Returns a contrast text color (black or white) for a given background hex,
 * using simple WCAG-style luminance.
 */
export function contrastTextColor(hex: string): "#000000" | "#ffffff" {
  if (!isValidHex(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? "#000000" : "#ffffff";
}

/**
 * Build the inline style object that emits all brand CSS variables on a wrapper
 * element. Apply at the top of the page-viewer and the builder canvas.
 */
export function getBrandStyleVars(brand: BrandConfig): CSSProperties {
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accent = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  const text = isValidHex(brand.textColor) ? brand.textColor : DEFAULT_BRAND.textColor;
  const onPrimary = contrastTextColor(primary);
  const onAccent = contrastTextColor(accent);
  const vars: Record<string, string> = {
    "--brand-primary": primary,
    "--brand-primary-rgb": hexToRgbTriplet(primary),
    "--brand-accent": accent,
    "--brand-accent-rgb": hexToRgbTriplet(accent),
    "--brand-on-primary": onPrimary,
    "--brand-on-accent": onAccent,
    "--brand-text": text,
    "--brand-text-rgb": hexToRgbTriplet(text),
    "--brand-page-bg": brand.pageBackground || "#ffffff",
    "--brand-card-bg": brand.cardBackground || "#ffffff",
    "--brand-nav-bg": brand.navBgColor || "#000000",
    "--brand-nav-text": brand.navText || "#ffffff",
    "--brand-border": brand.borderColor || "#e2e8f0",
    "--brand-cta-bg": brand.ctaBackground || accent,
    "--brand-cta-text": brand.ctaText || onAccent,
  };
  // Brand fonts. Quote family names containing whitespace and chain a sensible
  // system fallback. The wrapped element re-points Tailwind's `--font-display`
  // / `--font-sans` tokens at these so every block inheriting `font-display`
  // / `font-sans` swaps automatically. Falls back to `--app-font-*` defaults
  // when the brand has no font set (preserves Dandy typography).
  const displayValue = toFontFamilyValue(brand.displayFont, "display");
  const bodyValue = toFontFamilyValue(brand.bodyFont, "sans");
  if (displayValue) vars["--brand-font-display"] = displayValue;
  if (bodyValue) vars["--brand-font-body"] = bodyValue;
  return vars as CSSProperties;
}

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
    const strict = brand.aiStrictFactsMode === true;
    const productInfo = brand.productLines
      .filter((p) => p.name)
      .map((p) => {
        const bits = [`- ${p.name}`];
        if (p.description) bits.push(`  ${p.description}`);
        if (p.valueProps?.length) bits.push(`  Value props: ${p.valueProps.join(", ")}`);
        const claimsList = (p.claims ?? [])
          .filter((c) => (strict ? isClaimApproved(c) : true))
          .map(getClaimText)
          .filter(Boolean);
        if (claimsList.length) bits.push(`  Claims: ${claimsList.join(", ")}`);
        if (p.keywords?.length) bits.push(`  Keywords: ${p.keywords.join(", ")}`);
        return bits.join("\n");
      }).join("\n");
    parts.push(`Product lines:\n${productInfo}`);
  }
  // Task #253 — surface approved segment stats in the copy system prompt so
  // copy generated outside the page-level flow (ad copy, single-block
  // regenerations, etc.) is also bound to the approved pool. In strict mode
  // we filter to approved entries; otherwise we list everything for context.
  if (brand.segments?.length) {
    const strict = brand.aiStrictFactsMode === true;
    const segLines: string[] = [];
    for (const seg of brand.segments) {
      const stats = (seg.stats ?? []).filter((s) => s.value || s.label);
      const filtered = strict ? stats.filter((s) => s.approvedForAi !== false) : stats;
      if (filtered.length === 0) continue;
      const lines = filtered.map((s) => `  - ${s.value} ${s.label}`.trim()).join("\n");
      segLines.push(`${seg.name || "Segment"}:\n${lines}`);
    }
    if (segLines.length) {
      parts.push(
        strict
          ? `APPROVED SEGMENT STATS (use ONLY these — do not invent percentages or counts):\n${segLines.join("\n")}`
          : `Segment stats:\n${segLines.join("\n")}`,
      );
    }
    // Strict mode + no approved stats → omit the section entirely. The
    // STRICT_FACTS_INSTRUCTION block appended below already tells the model
    // to emit the placeholder for any stat slot it can't fill.
  }
  if (brand.aiStrictFactsMode) {
    parts.push(STRICT_FACTS_INSTRUCTION);
  }
  return parts.join("\n");
}

/** Task #253 — instruction appended to every AI prompt when strict mode is on.
 *  Kept short and assertive so it survives token budgets. */
export const STRICT_FACTS_INSTRUCTION =
  "STRICT FACTS MODE: Use ONLY the statistics, percentages, customer counts, " +
  "claims, and case studies explicitly listed in this brief. Do NOT invent, " +
  "extrapolate, round, or paraphrase numbers. If a slot would require a stat " +
  "or proof point that is not provided, write the placeholder \u2014 add a stat in Brand Settings \u2014 instead.";

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
