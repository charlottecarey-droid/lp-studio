import type { CSSProperties } from "react";
import { toFontFamilyValue } from "./font-catalog";
import type { BackgroundPresetLabels } from "./bg-styles";
import type { FormStyling } from "./form-styling";

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

/** Testimonial / quote pulled from a brand's marketing pages during URL
 *  brand-import. Used as evidence material for AI page generation when
 *  `aiStrictFactsMode` is on (only `approvedForAi !== false` rows pass
 *  through). Defaults match the import contract: a freshly scraped quote
 *  arrives with `approvedForAi: true` so the brand owner can immediately
 *  use it, then opt out per-row if it misquotes or misattributes. */
export interface ScrapedTestimonial {
  quote: string;
  author?: string;
  role?: string;
  approvedForAi?: boolean;
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

/**
 * Workstream A (May 2026) — coerce `BrandConfig.inspirationUrls` (union of
 * legacy `string` and current `{url, note}` shapes) into a clean object array.
 * Drops blank/invalid entries and caps at 5 so the brand-settings UI never
 * corrupts legacy data via object spread on a string.
 */
export function normalizeInspirationUrls(
  raw: BrandConfig["inspirationUrls"] | undefined,
): { url: string; note: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { url: string; note: string }[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const url = entry.trim();
      if (url) out.push({ url, note: "" });
    } else if (entry && typeof entry === "object") {
      const url = typeof entry.url === "string" ? entry.url.trim() : "";
      const note = typeof entry.note === "string" ? entry.note : "";
      out.push({ url, note });
    }
    if (out.length >= 5) break;
  }
  return out;
}

export interface BrandConfig {
  /**
   * Dark-surface logo variant. When the brand logo doesn't render well via
   * SVG auto-recolor (multi-color marks, raster PNG/JPG, etc.), upload a
   * second logo file painted for dark backgrounds and we'll swap it in
   * automatically for nav headers / footers / any "onDark" surface.
   * Falls back to `logoUrl` when empty.
   */
  logoUrlDark?: string;
  /**
   * Workstream A (May 2026) — persistent "inspiration sites" for this brand.
   * Each is a URL (e.g. of a competitor or admired page) that should be
   * auto-included as a reference on every page generation. Capped at 5.
   * Optional per-URL note explains what to draw from that specific site.
   *
   * Type is a union to tolerate legacy `string[]` entries that may exist in
   * older tenant configs — UI must run `normalizeInspirationUrls` before
   * rendering or saving to coerce both shapes into `{url, note}` objects.
   */
  inspirationUrls?: Array<string | { url?: string; note?: string }>;
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
  /**
   * Heading color used on LIGHT block backgrounds (page bg, white, cream,
   * card surfaces). When unset, falls back to `primaryColor` if it has
   * adequate contrast on `pageBackground`, else `#0f172a`.
   * Blocks read this via the `--brand-heading-on-light` CSS variable or
   * via {@link resolveHeadingColor}.
   */
  headingOnLightColor?: string;
  /**
   * Heading color used on DARK block backgrounds (dark/black/gradient
   * sections, dark cards). When unset, falls back to `cardBackground` if
   * it's a light tint, else `#FFFFFF`.
   * Blocks read this via the `--brand-heading-on-dark` CSS variable or
   * via {@link resolveHeadingColor}.
   */
  headingOnDarkColor?: string;
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
  /** Font family used for big numeric values in stat-style blocks
   *  (TrustBar, StatCallout, DSO stat blocks). Falls back to `displayFont`
   *  when unset — tenants who never set it see no change. */
  numbersFont?: string;
  /** Optional override URL for the numbers font's stylesheet. */
  numbersFontUrl?: string;
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
  /** Stats pulled directly from the brand's marketing pages during URL
   *  brand-import (e.g. "10M+ patients served", "99.9% uptime"). Surfaced
   *  in Brand Settings under "Scraped facts" and fed into AI page
   *  generation as approved evidence. When `aiStrictFactsMode` is on,
   *  only entries with `approvedForAi !== false` reach the prompt. */
  scrapedStats?: SegmentStat[];
  /** Customer quotes / testimonials pulled from the brand's marketing
   *  pages during URL brand-import. Same approval contract as
   *  `scrapedStats` — strict mode filters to `approvedForAi !== false`. */
  scrapedTestimonials?: ScrapedTestimonial[];
  chilipiperUrl?: string;
  logoUrl?: string;
  logoAutoRecolor?: boolean;
  /** Banner image inserted at the top of templated emails (follow-up emails
   *  to form submitters, sales outreach drafts). When empty, the
   *  EmailWYSIWYGEditor + send paths fall back to the built-in Dandy banner.
   *  Tenants set this from Brand Settings → Logo & Identity. */
  emailBannerUrl?: string;
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
  /** Per-tenant Sales Console configuration. All sender identity, AI-prompt
   *  brand strings and value-prop pairs used by /api/sales/* routes live
   *  here so the Sales Console can be used by tenants other than Dandy
   *  without leaking Dandy-specific copy or sender addresses. See
   *  `artifacts/api-server/src/lib/salesBrandContext.ts` for the read path. */
  salesConsole?: SalesConsoleConfig;
  /**
   * Brand-default visual styling applied to every linked global form
   * and to the simple/linked form rendered inside the shared
   * EmailCaptureModal. Per-form `lp_forms.styling` and per-block
   * overrides win on a per-token basis (see `mergeFormStyling`).
   * Null/undefined preserves the legacy block-default behaviour so
   * existing tenants see zero visible change.
   */
  formStyling?: FormStyling | null;
  /**
   * Brand-default theme for CTA modals (EmailCaptureModal shell).
   * Per-block `props.modalTheme` overrides it; unset falls back to
   * "light". Null/undefined preserves legacy behaviour.
   */
  modalTheme?: "light" | "dark" | null;
  /** ── URL brand-importer (streaming orchestrator) additive fields ────
   *  All optional, all written by the from-url-stream importer's review
   *  flow. Existing tenants without an import never see these. */
  /** Ranked logo candidates beyond the picked `logoUrl`. Drives the logo
   *  alternates picker on the Brand Settings review page. */
  logoAlternates?: ImportedLogoCandidate[];
  /** Structured profile of the brand's homepage imagery: medium, palette
   *  temperature, lightness, subject, mood + a one-sentence summary. Used
   *  as a brief for the (future) AI image generator. */
  photographyProfile?: ImportedPhotographyProfile;
  /** Voice profile extracted from the importer (tone, formality, sentence
   *  length, vocab register, signature/forbidden phrases, summary). The
   *  existing `toneOfVoice` / `toneKeywords` / `avoidPhrases` fields are
   *  also written for backward compat. */
  voiceProfile?: ImportedVoiceProfile;
  /** Raw CSS-parsed primary-button style from the importer (radius px,
   *  padding, font-weight, background, shadow, raw declarations + vision
   *  agreement). Drives the "we observed" preview in Brand Settings. */
  buttonStyleRaw?: ImportedButtonStyle;
  /** Raw CSS-parsed card/surface style (radius, shadow, border). */
  surfaceStyle?: ImportedSurfaceStyle;
  /** Fonts the importer believes are loaded on the source site, so the
   *  rendering side can stylesheet-inject them without re-running font
   *  detection. */
  loadedFonts?: ImportedLoadedFont[];
}

export interface ImportedLogoCandidate {
  url: string;
  source: "header" | "footer" | "favicon" | "apple-touch-icon" | "og" | "svg-alt";
  format: "svg" | "png" | "jpg" | "ico" | "webp" | "unknown";
  estimatedArea: number | null;
  transparent: boolean | null;
  score: number;
}

export interface ImportedPhotographyProfile {
  profile: {
    medium: "photographic" | "illustrated" | "mixed" | "abstract" | "unknown";
    paletteTemperature: "warm" | "cool" | "neutral" | "unknown";
    lightness: "light" | "dark" | "mid" | "unknown";
    subject: "people" | "product" | "environment" | "abstract" | "mixed" | "unknown";
    mood: string;
    summary: string;
  };
  referenceImageUrls: string[];
}

export interface ImportedVoiceProfile {
  profile: {
    tone: string[];
    formality: 1 | 2 | 3 | 4 | 5;
    sentenceLengthAvg: "short" | "medium" | "long";
    vocabularyRegister: "everyday" | "industry" | "specialist";
    signaturePhrases: string[];
    forbiddenPhrases: string[];
    summary: string;
  };
  selfCheckScore: number | null;
  selfCheckSourceSentence: string | null;
  selfCheckRewrite: string | null;
}

export interface ImportedButtonStyle {
  category: "pill" | "rounded" | "square" | "gradient-pill" | "outline" | "ghost";
  radiusPx: number | null;
  paddingX: string | null;
  paddingY: string | null;
  fontWeight: number | null;
  textTransform: string | null;
  background: { type: "solid" | "gradient" | "transparent"; value: string } | null;
  boxShadow: string | null;
  raw: Record<string, string>;
  visionAgreed: boolean;
  visionNotes: string;
}

export interface ImportedSurfaceStyle {
  radiusPx: number | null;
  boxShadow: string | null;
  border: string | null;
  raw: Record<string, string>;
}

export interface ImportedLoadedFont {
  family: string;
  url: string;
  role: "heading" | "body" | "mono";
}

export interface SalesConsoleValuePropPair {
  roles: string[];
  theme: string;
  pain: string;
  proof: string;
}

export interface SalesConsoleConfig {
  senderName?: string;
  senderLocalPart?: string;
  sendingDomain?: string;
  replyTo?: string;
  notificationsLocalPart?: string;
  emailSignature?: string;
  emailFooter?: string;
  salesIntroLine?: string;
  briefBlurb?: string;
  useBuiltInExemplars?: boolean;
  customerNameRules?: string;
  valuePropPairs?: SalesConsoleValuePropPair[];
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
  // Heading tokens left undefined so `resolveHeadingColor` can derive a
  // primary-aware default per tenant (falls back to slate-900 / white when
  // the tenant's primaryColor lacks contrast on pageBackground).
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
  // Brand-default form / modal styling — null preserves block defaults
  // for every tenant that hasn't opted in via Brand Settings.
  formStyling: null,
  modalTheme: null,
  // No default logo. Tenants set their own via Brand Settings → Logo. When
  // empty, BrandLogo falls back to a brandName text wordmark. The Dandy
  // dental tenants store `/dandy-logo.svg` explicitly in their brand_settings,
  // so this neutral default does not affect them.
  logoUrl: "",
  logoAutoRecolor: true,
  emailBannerUrl: "",
  // Strict facts default ON: new tenants get the safer "don't invent
  // numbers" behaviour by default. Existing tenants whose row was
  // written before this change still read `undefined` from DB → callsites
  // were updated to treat `aiStrictFactsMode !== false` as ON.
  aiStrictFactsMode: true,
  scrapedStats: [],
  scrapedTestimonials: [],
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

export function relativeLuminance(hex: string): number {
  if (!isValidHex(hex)) return 0;
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = ch(parseInt(hex.slice(1, 3), 16));
  const g = ch(parseInt(hex.slice(3, 5), 16));
  const b = ch(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Pick the brand heading CSS variable that contrasts with the given block
 * background hex. Use for blocks that expose a dynamic `bgColor` prop (the
 * tenant can flip a section dark/light), where a hard-coded
 * `--brand-heading-on-light` class would be illegible on a dark choice.
 *
 * Returns a `var(...)` expression suitable for `style={{ color: ... }}`.
 */
export function headingColorVarForBg(bg: string | undefined | null): string {
  const hex = bg && isValidHex(bg) ? bg : "#ffffff";
  return relativeLuminance(hex) < 0.4
    ? "var(--brand-heading-on-dark)"
    : "var(--brand-heading-on-light)";
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick the first color (the caller's preferred choice, then any fallbacks)
 * that meets a minimum WCAG contrast ratio against `bg`. If none qualify,
 * fall back to whichever of black/white contrasts better.
 *
 * Use this anywhere a brand color (primary, accent) is painted on top of
 * another brand color where the two might be visually similar — most
 * commonly: button text on accent buttons, eyebrows over dark sections,
 * inline links over branded backgrounds. Default threshold is WCAG AA for
 * normal text (4.5:1).
 */
export function pickContrastingColor(
  preferred: string | undefined | null,
  bg: string | undefined | null,
  fallbacks: (string | undefined | null)[] = [],
  minContrast = 4.5,
): string {
  const bgHex = bg && isValidHex(bg) ? bg : "#ffffff";
  const candidates = [preferred, ...fallbacks].filter(
    (c): c is string => !!c && isValidHex(c),
  );
  for (const c of candidates) {
    if (contrastRatio(c, bgHex) >= minContrast) return c;
  }
  // Last resort: whichever of black/white has the higher contrast.
  return contrastRatio("#000000", bgHex) >= contrastRatio("#ffffff", bgHex)
    ? "#000000"
    : "#ffffff";
}

/**
 * Resolve the bg + text colors a CTA button should use given the section
 * background it's sitting on. Guards against the "blue button on blue
 * section" failure mode where the AI sets `bgColor` to the brand primary
 * or accent and the button (hardcoded to `var(--brand-accent)`) becomes
 * invisible.
 *
 * Preference order for button bg:
 *   1. `brand.ctaBackground` (explicit tenant override) if it contrasts.
 *   2. `brand.accentColor` if it contrasts with the section.
 *   3. `brand.primaryColor` if it contrasts.
 *   4. Black/white — whichever contrasts better.
 *
 * Threshold 3.0 matches WCAG AA for non-text UI components; text on the
 * chosen bg is then resolved with the stricter 4.5 (AA normal text).
 */
export function pickCtaButtonColors(
  brand: BrandConfig,
  sectionBg: string | undefined | null,
): { bg: string; text: string } {
  const accent = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const ctaBgPref = isValidHex(brand.ctaBackground ?? "") ? (brand.ctaBackground as string) : accent;
  const bg = pickContrastingColor(ctaBgPref, sectionBg, [accent, primary], 3.0);
  const ctaTextPref = isValidHex(brand.ctaText ?? "") ? (brand.ctaText as string) : undefined;
  const text = pickContrastingColor(ctaTextPref, bg, [contrastTextColor(bg)], 4.5);
  return { bg, text };
}

/**
 * Resolve the border + text color an *outline* (secondary/ghost) button
 * should use given the section background it's sitting on. Outline buttons
 * have a transparent fill and draw their identity from a colored border and
 * matching text, so both must contrast with the section bg — otherwise a
 * `border-[var(--brand-primary)]` button vanishes the moment the AI sets the
 * section background to the brand primary color (the "blue outline on blue
 * section" failure mode, mirroring the filled-button issue solved by
 * {@link pickCtaButtonColors}).
 *
 * Preference order for the border/text color:
 *   1. `brand.primaryColor` if it contrasts with the section.
 *   2. `brand.accentColor` if it contrasts.
 *   3. Black/white — whichever contrasts better.
 *
 * Threshold 4.5 matches WCAG AA for normal text, since the same color is
 * used for both the border and the (text-sized) label.
 */
export function pickOutlineButtonColors(
  brand: BrandConfig,
  sectionBg: string | undefined | null,
): { border: string; text: string } {
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accent = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  const color = pickContrastingColor(primary, sectionBg, [accent], 4.5);
  return { border: color, text: color };
}

/**
 * Resolve the heading color a block should use for the given background
 * darkness. Honors explicit `headingOnLightColor` / `headingOnDarkColor`
 * brand tokens; otherwise derives a sensible default from the brand
 * palette with a WCAG contrast guard. Mirrors the runtime fallback used
 * for the `--brand-heading-on-light` / `--brand-heading-on-dark` CSS
 * variables emitted by {@link getBrandStyleVars}.
 *
 * Use this from blocks whose heading color is set via JS/inline style
 * (rather than a Tailwind arbitrary-value class) where it is awkward to
 * reach the CSS variable.
 */
export function resolveHeadingColor(brand: BrandConfig, isDark: boolean): string {
  if (isDark) {
    const explicit = brand.headingOnDarkColor;
    if (explicit && isValidHex(explicit)) return explicit;
    return "#ffffff";
  }
  const explicit = brand.headingOnLightColor;
  if (explicit && isValidHex(explicit)) return explicit;
  // Default: primaryColor when it has enough contrast on the page bg, else
  // a near-black ink. Threshold 4.5 matches WCAG AA for normal text.
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const pageBg = isValidHex(brand.pageBackground) ? brand.pageBackground : "#ffffff";
  if (contrastRatio(primary, pageBg) >= 4.5) return primary;
  return "#0f172a";
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
  const pageBg = isValidHex(brand.pageBackground) ? brand.pageBackground : "#ffffff";
  // Eyebrow + link tokens are a contrast-aware version of "brand primary".
  // On a light section the eyebrow wants brand-primary (rich, on-brand) but
  // we step it down to a near-black ink when primary ≈ page bg (a "blue on
  // blue" surface). On dark sections we promote to a light tint of accent so
  // it still reads.
  //
  // For the -on-dark variants we test against a *generic* dark surface
  // (#0a0a0a) rather than the brand primary, because dark section presets
  // (black, gradient, etc.) are not necessarily primary-colored — and if
  // the brand primary itself is light, picking a color that only contrasts
  // against primary will be illegible on a true-black section.
  const GENERIC_DARK = "#0a0a0a";
  const eyebrowOnLight = pickContrastingColor(primary, pageBg, [accent, "#0f172a"]);
  const eyebrowOnDark = pickContrastingColor(accent, GENERIC_DARK, [
    primary,
    "#e2e8f0", // slate-200
    "#ffffff",
  ]);
  const linkOnLight = pickContrastingColor(primary, pageBg, [accent, "#1d4ed8"]); // blue-700 default ink
  const linkOnDark = pickContrastingColor(accent, GENERIC_DARK, [
    primary,
    "#93c5fd", // blue-300, a soft link tint that reads on most dark brand colors
    "#ffffff",
  ]);

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
    // Heading tokens. Blocks should reference these for headings instead of
    // hard-coding `var(--brand-primary)` (which is a generic palette anchor,
    // not a guaranteed-legible text color).
    "--brand-heading-on-light": resolveHeadingColor(brand, false),
    "--brand-heading-on-dark": resolveHeadingColor(brand, true),
    // Eyebrow + link tokens — contrast-aware so a brand whose primary ≈ its
    // page bg (or whose accent ≈ its primary, like Zoom blue on Zoom blue)
    // does not render illegible labels and links.
    "--brand-eyebrow-on-light": eyebrowOnLight,
    "--brand-eyebrow-on-dark": eyebrowOnDark,
    "--brand-link-on-light": linkOnLight,
    "--brand-link-on-dark": linkOnDark,
    // Numeric heading weight so blocks that drive headings via inline
    // `style={{ fontWeight: ... }}` (instead of Tailwind classes) can still
    // inherit the tenant's chosen brand heading weight. Mirrors
    // HEADING_WEIGHT below: semibold=600, bold=700, extrabold=800, black=900.
    "--brand-heading-weight": (
      brand.headingWeight === "semibold" ? "600" :
      brand.headingWeight === "extrabold" ? "800" :
      brand.headingWeight === "black" ? "900" :
      "700"
    ),
  };
  // Brand fonts. Quote family names containing whitespace and chain a sensible
  // system fallback. The wrapped element re-points Tailwind's `--font-display`
  // / `--font-sans` tokens at these so every block inheriting `font-display`
  // / `font-sans` swaps automatically. Falls back to `--app-font-*` defaults
  // when the brand has no font set (preserves Dandy typography).
  const displayValue = toFontFamilyValue(brand.displayFont, "display");
  const bodyValue = toFontFamilyValue(brand.bodyFont, "sans");
  const numbersValue = toFontFamilyValue(brand.numbersFont, "display");
  if (displayValue) vars["--brand-font-display"] = displayValue;
  if (bodyValue) vars["--brand-font-body"] = bodyValue;
  if (numbersValue) vars["--brand-font-numbers"] = numbersValue;
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
    const strict = brand.aiStrictFactsMode !== false;
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
    const strict = brand.aiStrictFactsMode !== false;
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

export async function fetchBrandConfig(slug?: string | null): Promise<BrandConfig> {
  // 8 s hard timeout. iOS Safari has been observed leaving fetch() hanging
  // indefinitely across network transitions (Wi-Fi ↔ cellular, iCloud Private
  // Relay reconnects, Low Power Mode), and the landing page viewer gates its
  // render on this promise settling. Without a timeout, the spinner sticks
  // forever on otherwise-healthy iPad/iPhone Safari sessions.
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? (typeof window !== "undefined" ? window.setTimeout(() => controller.abort(), 8000) : null)
    : null;
  // When viewing a `/preview/:slug` page on the SaaS host (app.lpstudio.ai)
  // or any other host that doesn't map to a tenant microsite, the server
  // can't resolve the tenant from the host alone. Passing the slug lets the
  // server look up the page record and resolve the correct tenant brand,
  // so Dandy preview links render in Dandy colours instead of falling back
  // to the neutral DEFAULT_BRAND blue.
  const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  try {
    const res = await fetch(`${BASE}/api/lp/brand${qs}`, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return DEFAULT_BRAND;
    const data = await res.json();
    return { ...DEFAULT_BRAND, ...data };
  } catch {
    return DEFAULT_BRAND;
  } finally {
    if (timeoutId !== null && typeof window !== "undefined") window.clearTimeout(timeoutId);
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
