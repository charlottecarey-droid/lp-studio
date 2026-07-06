import type * as cheerio from "cheerio";

export type DimensionName =
  | "logos"
  | "colors"
  | "typography"
  | "buttons"
  | "photography"
  | "voice"
  | "content"
  | "structure";

export type DimensionStatus = "ok" | "partial" | "failed";
export type Confidence = "high" | "medium" | "low";

export interface DimensionResult<T> {
  status: DimensionStatus;
  data: T | null;
  confidence: Confidence;
  errors: string[];
}

export interface SalesConsoleValuePropPair {
  roles: string[];
  theme: string;
  pain: string;
  proof: string;
}

/**
 * Sales-console block returned by the content extractor. Powers the
 * Sales Console section of brand-settings — value-prop pairs the
 * outreach AI rotates per recipient role, plus three short AI-prompt
 * strings (brief blurb, naming rules, intro line) that get injected
 * into every cold-outreach generation.
 */
export interface SalesConsoleSeed {
  valuePropPairs: SalesConsoleValuePropPair[];
  briefBlurb: string;
  customerNameRules: string;
  salesIntroLine: string;
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
  /** The same sampled buckets as `sampledPalette` but in page-area frequency
   *  order (backgrounds/large surfaces first). `sampledPalette` is re-ranked
   *  by salience so vivid brand-accent candidates lead; the colors extractor
   *  presents BOTH orderings honestly to the LLM. Optional so existing test
   *  fixtures / cached shapes without it stay valid. */
  sampledPaletteFrequency?: string[];
  cssVarPaletteHints: { name: string; value: string }[];
  /** Color custom properties (+ a few literal bg/text declarations) harvested
   *  from dark-theme scopes in the fetched CSS — `@media (prefers-color-scheme:
   *  dark)` blocks and `[data-theme=dark]` / `.dark` / `:root.dark` rule sets
   *  (P0-2). Empty when the site ships no dark theme. */
  darkCssVarHints: { name: string; value: string }[];
  errors: string[];
}

export interface LogoCandidate {
  url: string;
  source: "header" | "footer" | "favicon" | "apple-touch-icon" | "og" | "svg-alt" | "header-svg-rendered";
  format: "svg" | "png" | "jpg" | "ico" | "webp" | "unknown";
  estimatedArea: number | null;
  transparent: boolean | null;
  score: number;
}

export interface LogosData {
  defaultLogoUrl: string;
  alternates: LogoCandidate[];
  /** Best favicon candidate (highest-scored `favicon`/`apple-touch-icon`
   *  source) from the source site's `<link rel="icon">` tags, or null when
   *  the site declared none. Surfaced separately from `defaultLogoUrl` so the
   *  importer can pre-fill the tenant's browser-tab favicon independently of
   *  the brand logo. */
  faviconUrl: string | null;
}

export interface ColorSlot {
  hex: string;
  confidence: Confidence;
  source: "css-var" | "pixel-sample" | "llm";
}

/** Design tokens harvested from CSS vars/rules (P1-5). All optional, additive. */
export interface DesignTokens {
  /** A representative primary gradient (linear/radial with stops). */
  primaryGradient?: string;
  /** Border-radius scale gathered from `--radius*` vars / common rules. */
  radiusScale?: { sm?: string; md?: string; lg?: string; full?: string };
  /** A representative box-shadow. */
  shadow?: string;
}

/** Dark-theme color slots (P0-2). All optional — populated only when the site
 *  actually ships a dark theme (a `prefers-color-scheme: dark` block or an
 *  explicit `[data-theme=dark]` / `.dark` rule set in the fetched CSS). When no
 *  dark theme is detected the whole `darkModePalette` field stays undefined and
 *  there is zero behaviour change. */
export interface DarkModePalette {
  primary?: string;
  accent?: string;
  pageBackground?: string;
  cardBackground?: string;
  text?: string;
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
  /** Dark-theme colors when the site ships a dark mode (P0-2). Undefined when
   *  no dark theme was detected. */
  darkModePalette?: DarkModePalette;
  /** Design tokens (gradient / radius scale / shadow) harvested from CSS so
   *  generated pages match design-system source sites (P1-5). Undefined when
   *  none were found. */
  designTokens?: DesignTokens;
}

export interface TypographyFont {
  family: string;
  weights: number[];
  source: "google-link" | "typekit-link" | "fontface-custom" | "computed" | "llm";
  googleFontUrl: string | null;
  fallbackFamily: string | null;
  flag: "google-direct" | "google-fallback" | "custom-manual" | "unknown";
}

/** One step of the type scale (P1-1): declared size/weight/line-height. */
export interface TypeScaleStep {
  size?: string;
  weight?: number;
  lineHeight?: string;
}

/** Type scale parsed from declared CSS / inline styles (P1-1). All optional. */
export interface TypeScale {
  h1?: TypeScaleStep;
  h2?: TypeScaleStep;
  h3?: TypeScaleStep;
  body?: TypeScaleStep;
}

export interface TypographyData {
  heading: TypographyFont | null;
  body: TypographyFont | null;
  mono: TypographyFont | null;
  /** Declared size/weight/line-height for h1/h2/h3/body (P1-1). Undefined when
   *  no usable scale could be parsed. */
  typeScale?: TypeScale;
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
  textColor: string | null;
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

/** A harvested content image with its alt/caption context (P1-2). `url` is the
 *  absolute image URL; `alt` is the `<img alt>`; `caption` is the nearest
 *  `<figcaption>` / adjacent caption text; `context` is a short snippet of
 *  surrounding copy. All optional beyond `url` — fail-open. */
export interface ImageRef {
  url: string;
  alt?: string;
  caption?: string;
  context?: string;
}

export interface PhotographyData {
  profile: PhotographyProfile;
  referenceImageUrls: string[];
  /** Per-image alt/caption context for the selected reference images, in the
   *  same order as `referenceImageUrls`. Threaded into the vision prompt and
   *  persisted so the alt text can flow downstream into mirrored lp_media rows
   *  for later alt-text reuse. */
  imageRefs?: ImageRef[];
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
  /** Downsampled `data:image/jpeg;base64,...` preview of the homepage
   *  screenshot taken during evidence build (NOT the full-res copy the vision
   *  extractors use — that stays on `Evidence.screenshotDataUrl`). Shrunk via
   *  `buildScreenshotPreviewDataUrl` so it fits under the asset-mirror's 5MB
   *  cap and is cheap to cache. Carried on the payload so `applyAssetMirror`
   *  can re-host it per-tenant into object storage and surface it as a
   *  previewable `homepageScreenshotUrl` in the brand-settings review. Cached
   *  alongside the rest of the payload so cache-hit imports (incl. cross-tenant
   *  — homepage snapshots are public site content) can still mirror it. Null
   *  when the scrape produced no screenshot. */
  screenshotDataUrl: string | null;
  robots: RobotsVerdict;
  results: {
    logos: DimensionResult<LogosData>;
    colors: DimensionResult<ColorsData>;
    typography: DimensionResult<TypographyData>;
    buttons: DimensionResult<ButtonsData>;
    photography: DimensionResult<PhotographyData>;
    voice: DimensionResult<VoiceData>;
    /** Brand identity + messaging fields parsed from markdown corpus +
     *  HTML meta hints. Populates brandName, companyDescription,
     *  taglines, messagingPillars, targetAudience, copyExamples. See
     *  extractors/content.ts. */
    content: DimensionResult<import("./extractors/content").ContentData>;
    /** Product / segment SHELL extraction from same-origin nav links +
     *  pricing/about markdown. Shells only — claims/stats/personas/
     *  comparison rows left empty so aiStrictFactsMode stays meaningful.
     *  See extractors/structure.ts. */
    structure: DimensionResult<import("./extractors/structure").StructureData>;
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
  | { event: "error"; error: string }
  // Emitted by the stream route (not the orchestrator) while the evidence
  // build runs — the phase before the first orchestrator event, which can
  // take 40–75s on slow sites. Keeps bytes flowing so LB/proxy idle-response
  // timeouts (commonly 60s) don't kill the connection, and gives the client
  // something honest to show. Clients that don't know the event ignore it.
  | { event: "phase"; phase: "scraping" };

export const USER_AGENT = "LPStudio-BrandImport/1.0 (+https://lp-studio.replit.app)";
