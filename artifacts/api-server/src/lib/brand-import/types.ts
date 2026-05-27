import type * as cheerio from "cheerio";

export type DimensionName =
  | "logos"
  | "colors"
  | "typography"
  | "buttons"
  | "photography"
  | "voice";

export type DimensionStatus = "ok" | "partial" | "failed";
export type Confidence = "high" | "medium" | "low";

export interface DimensionResult<T> {
  status: DimensionStatus;
  data: T | null;
  confidence: Confidence;
  errors: string[];
}

export interface ScrapedPage {
  url: string;
  markdown: string;
  rawHtml: string | null;
  screenshotUrl: string | null;
  fetchedAt: number;
}

export interface FetchedStylesheet {
  url: string;
  css: string;
  bytes: number;
}

export interface RobotsVerdict {
  allowed: Record<string, boolean>;
  source: string | null;
  userAgent: string;
}

export interface Evidence {
  homeUrl: string;
  pages: ScrapedPage[];
  stylesheets: FetchedStylesheet[];
  $home: cheerio.CheerioAPI | null;
  robots: RobotsVerdict;
  screenshotUrl: string | null;
  /** Inlined `data:image/...;base64,...` of the screenshot if we managed to
   *  fetch it; preferred over `screenshotUrl` for OpenAI vision calls because
   *  some firecrawl-hosted screenshot URLs throttle or 403 the fetcher. */
  screenshotDataUrl: string | null;
  sampledPalette: string[];
  cssVarPaletteHints: { name: string; value: string }[];
  errors: string[];
}

export interface LogoCandidate {
  url: string;
  source: "header" | "footer" | "favicon" | "apple-touch-icon" | "og" | "svg-alt";
  format: "svg" | "png" | "jpg" | "ico" | "webp" | "unknown";
  estimatedArea: number | null;
  transparent: boolean | null;
  score: number;
}

export interface LogosData {
  defaultLogoUrl: string;
  alternates: LogoCandidate[];
}

export interface ColorSlot {
  hex: string;
  confidence: Confidence;
  source: "css-var" | "pixel-sample" | "llm";
}

export interface ColorsData {
  primary: string;
  accent: string;
  pageBackground: string;
  cardBackground: string;
  text: string;
  textMuted: string;
  ctaBackground: string;
  ctaText: string;
  navBgColor: string;
  navText: string;
  borderColor: string;
  secondary: string[];
  swatches: ColorSlot[];
  rawCssVars: { name: string; value: string }[];
}

export interface TypographyFont {
  family: string;
  weights: number[];
  source: "google-link" | "typekit-link" | "fontface-custom" | "computed" | "llm";
  googleFontUrl: string | null;
  fallbackFamily: string | null;
  flag: "google-direct" | "google-fallback" | "custom-manual" | "unknown";
}

export interface TypographyData {
  heading: TypographyFont | null;
  body: TypographyFont | null;
  mono: TypographyFont | null;
}

export type ButtonCategory =
  | "pill"
  | "rounded"
  | "square"
  | "gradient-pill"
  | "outline"
  | "ghost";

export interface ButtonStyleData {
  category: ButtonCategory;
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

export interface SurfaceStyleData {
  radiusPx: number | null;
  boxShadow: string | null;
  border: string | null;
  raw: Record<string, string>;
}

export interface ButtonsData {
  primaryButton: ButtonStyleData | null;
  surface: SurfaceStyleData | null;
}

export interface PhotographyProfile {
  medium: "photographic" | "illustrated" | "mixed" | "abstract" | "unknown";
  paletteTemperature: "warm" | "cool" | "neutral" | "unknown";
  lightness: "light" | "dark" | "mid" | "unknown";
  subject: "people" | "product" | "environment" | "abstract" | "mixed" | "unknown";
  mood: string;
  summary: string;
}

export interface PhotographyData {
  profile: PhotographyProfile;
  referenceImageUrls: string[];
}

export interface VoiceProfile {
  tone: string[];
  formality: 1 | 2 | 3 | 4 | 5;
  sentenceLengthAvg: "short" | "medium" | "long";
  vocabularyRegister: "everyday" | "industry" | "specialist";
  signaturePhrases: string[];
  forbiddenPhrases: string[];
  summary: string;
}

export interface VoiceData {
  profile: VoiceProfile;
  selfCheckScore: number | null;
  selfCheckSourceSentence: string | null;
  selfCheckRewrite: string | null;
}

export interface OrchestratorPayload {
  sourceUrl: string;
  pagesScraped: string[];
  sampledPalette: string[];
  hasScreenshot: boolean;
  robots: RobotsVerdict;
  results: {
    logos: DimensionResult<LogosData>;
    colors: DimensionResult<ColorsData>;
    typography: DimensionResult<TypographyData>;
    buttons: DimensionResult<ButtonsData>;
    photography: DimensionResult<PhotographyData>;
    voice: DimensionResult<VoiceData>;
  };
  proposed: Record<string, unknown>;
  confidence: Record<string, Confidence>;
  unparsed: string[];
  durationMs: number;
  cached: boolean;
}

export type StreamEvent =
  | { event: "start"; sourceUrl: string; pagesScraped: string[]; hasScreenshot: boolean; sampledPalette: string[]; robots: RobotsVerdict }
  | { event: "dimension"; dimension: DimensionName; result: DimensionResult<unknown> }
  | { event: "done"; payload: OrchestratorPayload }
  | { event: "error"; error: string };

export const USER_AGENT = "LPStudio-BrandImport/1.0 (+https://lp-studio.replit.app)";
