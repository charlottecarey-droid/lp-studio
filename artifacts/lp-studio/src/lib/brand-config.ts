import type { CSSProperties } from "react";
import { toFontFamilyValue, cleanFamilyName } from "./font-catalog";
import type { BackgroundPresetLabels, BackgroundPresetColors } from "./bg-styles";
import { BACKGROUND_STYLE_KEYS } from "./bg-styles";
import type { FormStyling } from "./form-styling";
import type { BrandPdfFonts, EmbeddedFontFaces } from "@workspace/one-pager-types/generators";
import { DEFAULT_HEAT_SCORING, type HeatScoringConfig } from "./heat-tier";
import type { PageOutline } from "@workspace/lp-template-engine";

export type { PageOutline };

export type { BackgroundPresetLabels, BackgroundPresetColors };

export type ButtonRadius = "pill" | "rounded" | "slight" | "square";
export type ButtonShadow = "none" | "sm" | "md" | "lg";
export type ButtonPaddingX = "compact" | "regular" | "spacious";
export type ButtonPaddingY = "compact" | "regular" | "spacious";
export type ButtonFontWeight = "normal" | "medium" | "semibold" | "bold";
export type ButtonTextCase = "uppercase" | "capitalize" | "normal";
export type ButtonLetterSpacing = "tight" | "normal" | "wide" | "wider";
/** Task #900 — design-density axis fed into AI page/microsite generation. */
export type DesignIntensity =
  | "editorial-dense"
  | "airy-minimal"
  | "energetic-visual"
  | "balanced";
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
  /** Task #3 — approved product imagery. Brand Settings is the single source of
   *  truth for a product's pictures: `cardImage` fills product-grid /
   *  product-showcase cards, `heroImage` fills product hero blocks, and
   *  `contentImages` is a pool rotated across content sections about this
   *  product (to reduce repeated photos). All optional — when unset the legacy
   *  Content-Library / image-fill behavior is preserved (no regression). */
  cardImage?: string;
  heroImage?: string;
  contentImages?: string[];
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

/**
 * One entry in a microsite block-list override. `type` is a registered
 * block type; `schemaHint` is the optional prop-shape hint string passed
 * to the AI (same format `BLOCK_PROP_SCHEMAS` uses on the server). When
 * `schemaHint` is omitted the generator falls back to the server's
 * registry default, then to a generic `{ ...fields }` placeholder.
 */
export interface MicrositeBlockListEntry {
  type: string;
  schemaHint?: string;
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
  /**
   * Optional per-segment block-list override for the microsite generator.
   * When empty/unset, the generator falls back to the brand's
   * `defaultMicrositeBlockList`, then to a built-in neutral set.
   */
  micrositeBlockList?: MicrositeBlockListEntry[];
  /**
   * Task #6 — optional ordered page outline ("recipe") for this segment. Each
   * step is either a CATEGORY/role (brand-matched from the segment's approved
   * pool at generation) or a SPECIFIC block (forced). Supersedes
   * `micrositeBlockList`: when present, it is THE structure config for both
   * landing pages and microsites; when absent, the legacy block list (then free
   * AI choice) applies.
   */
  pageOutline?: PageOutline;
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
  /**
   * Server-computed (read-only) flag: true only for protected Dandy tenants,
   * resolved from the immutable tenant slug by the `/lp/brand` API — never from
   * the editable `brandName`. Used to gate Dandy-only asset fallbacks (e.g. the
   * one-pager header logo) so renaming a brand to "Dandy" cannot leak Dandy
   * assets. Not persisted: `saveBrandConfig` strips it before writing.
   */
  isDandy?: boolean;
  /**
   * Task #999 — tenant-level fallback share-card metadata, served read-only by
   * `/lp/brand` from the `tenants.default_og_*` columns (NOT the brand_settings
   * JSONB; `saveBrandConfig` strips them before writing). These drive the SPA's
   * document.title / OG baseline on tenant/Dandy hosts, replacing the old
   * hardcoded per-host index.html overrides. `defaultOgTitle` may contain a
   * `{{page_title}}` token; for the app-shell baseline there is no page, so
   * callers substitute the brand name. Empty string when unset.
   */
  defaultOgTitle?: string;
  defaultOgDescription?: string;
  defaultOgImageUrl?: string;
  companyDescription: string;
  taglines: string[];
  messagingPillars: MessagingPillar[];
  toneOfVoice: string;
  toneKeywords: string[];
  /** Task #900 — design-density axis fed into AI page/microsite generation.
   *  Inferred server-side from tone keywords today (no UI control yet — that's
   *  a follow-up); typed here for type-safety and the future picker. Defaults
   *  to "balanced" when unset. */
  designIntensity?: DesignIntensity;
  avoidPhrases: string[];
  targetAudience: string;
  copyExamples: string[];
  copyInstructions: string;
  productLines: ProductLine[];
  segments: AudienceSegment[];
  /**
   * Default microsite block list used when the selected segment has no
   * `micrositeBlockList` of its own. When this is also unset, the
   * generator uses a built-in neutral set (`hero`, `trust-bar`,
   * `benefits-grid`, `testimonial`, `how-it-works`, `comparison`,
   * `bottom-cta`) — the same one the legacy "independent" branch used,
   * which doesn't mention DSOs or dentistry.
   */
  defaultMicrositeBlockList?: MicrositeBlockListEntry[];
  /**
   * Task #6 — brand-default page outline used when the selected segment has no
   * `pageOutline` of its own. Same step model as the per-segment outline;
   * supersedes `defaultMicrositeBlockList`. When both this and the segment
   * outline are unset, generation falls back to the legacy block lists and then
   * to today's free AI choice.
   */
  defaultPageOutline?: PageOutline;
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
  /** Tenant favicon (the small browser-tab icon). A single uploaded image is
   *  used for both `rel="icon"` and `rel="apple-touch-icon"` on published
   *  tenant landing pages / microsites (live SPA view + static R2 snapshot).
   *  When empty/unset, pages fall back to the default LP Studio favicon. The
   *  LP Studio admin shell + marketing site always keep the LP Studio icon —
   *  only tenant landing-page output reads this. Stored in the brand_settings
   *  JSONB; no dedicated DB column. */
  faviconUrl?: string;
  logoAutoRecolor?: boolean;
  /** The brand's public website URL (e.g. "https://acme.com"). Used as the
   *  link target when `logoLinkEnabled` is on, so the logo in nav/hero/footer
   *  blocks links back to the brand home page. Empty/unset → logo stays
   *  unlinked even if `logoLinkEnabled` is true. */
  websiteUrl?: string;
  /** Opt-in: when true AND `websiteUrl` is set, the brand logo in nav, hero,
   *  and footer blocks is wrapped in an `<a>` pointing to `websiteUrl`
   *  (opens in a new tab). Defaults to OFF for existing tenants (standard
   *  falsy default — read as truthy, not `!== false`). */
  logoLinkEnabled?: boolean;
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
  /** Per-brand color overrides for the section background presets. Hex per key;
   *  unset keys keep the preset's historical default. Emitted as `--lp-bg-<key>`
   *  CSS variables by `getBrandStyleVars` so they cascade to every rendered
   *  section. See `bg-styles.ts`. */
  backgroundPresetColors?: BackgroundPresetColors;
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
  /** `/api/storage/...` URL of the homepage screenshot captured the last
   *  time the brand was imported from a URL. Re-hosted per-tenant by the
   *  importer's asset mirror and shown as a preview in Brand Settings so
   *  the user can see what their site looked like at import time. Replaced
   *  on every rebrand / brand refresh that re-scrapes the site. */
  homepageScreenshotUrl?: string;
  /** Dark-theme palette captured by the URL importer when the source site
   *  ships a dark mode (`prefers-color-scheme: dark` / `[data-theme=dark]`).
   *  Additive + optional — unset when the source site has no dark theme. */
  darkModePalette?: ImportedDarkModePalette;
  /** Type scale (h1/h2/h3/body size + weight + line-height) parsed by the URL
   *  importer from the source site's CSS. Additive + optional — unset when the
   *  importer could not derive a scale. */
  typeScale?: ImportedTypeScale;
  /** Design tokens (primary gradient, border-radius scale, representative
   *  shadow) harvested by the URL importer from CSS vars/rules so generated
   *  pages match design-system source sites. Additive + optional. */
  designTokens?: ImportedDesignTokens;
  /**
   * Per-workspace account heat-scoring configuration (points per signal type
   * + Warm/Hot thresholds), edited in Settings → Lead scoring. Drives the
   * Hot / Warm / Warming Up tier shown on the sales dashboard and Accounts
   * page. Unset → the neutral `DEFAULT_HEAT_SCORING` defaults apply.
   */
  heatScoring?: HeatScoringConfig;
}

/** Dark-theme palette captured by the URL importer (P0-2). All optional. */
export interface ImportedDarkModePalette {
  primary?: string;
  accent?: string;
  pageBackground?: string;
  cardBackground?: string;
  text?: string;
}

/** A single type-scale step: size/weight/line-height as declared in source CSS. */
export interface ImportedTypeScaleStep {
  size?: string;
  weight?: number;
  lineHeight?: string;
}

/** Type scale parsed by the URL importer (P1-1). All steps optional. */
export interface ImportedTypeScale {
  h1?: ImportedTypeScaleStep;
  h2?: ImportedTypeScaleStep;
  h3?: ImportedTypeScaleStep;
  body?: ImportedTypeScaleStep;
}

/** Design tokens harvested by the URL importer (P1-5). All optional. */
export interface ImportedDesignTokens {
  /** A representative primary gradient (`linear-gradient(...)` / `radial-...`). */
  primaryGradient?: string;
  /** Border-radius scale (sm/md/lg/full px or token values), as declared. */
  radiusScale?: { sm?: string; md?: string; lg?: string; full?: string };
  /** A representative box-shadow. */
  shadow?: string;
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
  textColor: string | null;
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

/**
 * A tenant-authored microsite reference page used as a few-shot style example
 * in the AI microsite generator. `content` is free-form — the tenant pastes the
 * copy from a microsite they're proud of, or describes a great reference page in
 * detail. These are the generic, white-label path: any tenant can add their own
 * exemplars without relying on the built-in (Dandy) sample pages.
 */
export interface SalesConsoleMicrositeExemplar {
  /** Short scenario/audience label shown in the prompt header. */
  label: string;
  /** The example microsite copy or a detailed description of a great page. */
  content: string;
}

export interface SalesConsoleConfig {
  senderName?: string;
  senderLocalPart?: string;
  sendingDomain?: string;
  /**
   * Resend domain id for the tenant's own custom sending domain, registered
   * via the self-serve email-domain wizard (Enterprise `customEmailDomain`
   * feature). Persisted alongside `sendingDomain` so the wizard can poll
   * verification status by id. Routing still fails closed: the resolver only
   * sends from this domain once Resend reports it verified. Cleared on remove.
   */
  customEmailDomainId?: string;
  /**
   * Tier 2 auto-provisioned branded sending subdomain (Growth/Scale
   * `brandedEmailSubdomain` feature), e.g. `mail.<slug>.lpstudio.ai`. Unlike
   * the custom domain (Tier 3), its DNS is published into the platform's own
   * Cloudflare zone automatically — the tenant does no DNS work. Routing fails
   * closed: the resolver only sends from it once Resend reports it verified.
   * These three fields are managed exclusively by the branded-subdomain route;
   * the UI never edits them directly.
   */
  brandedEmailSubdomain?: string;
  /** Resend domain id for the branded subdomain, used to poll status by id. */
  brandedEmailSubdomainId?: string;
  /** Cloudflare DNS record ids we created, so removal deletes exactly those. */
  brandedEmailSubdomainDnsRecordIds?: string[];
  replyTo?: string;
  notificationsLocalPart?: string;
  emailSignature?: string;
  emailFooter?: string;
  salesIntroLine?: string;
  briefBlurb?: string;
  useBuiltInExemplars?: boolean;
  /**
   * Tenant-authored microsite reference pages fed to the AI generator as
   * few-shot style examples. Always applied (not gated by useBuiltInExemplars)
   * since they're the tenant's own content — the generic, white-label path that
   * lets any tenant supply exemplars without the built-in sample pages.
   */
  customMicrositeExemplars?: SalesConsoleMicrositeExemplar[];
  customerNameRules?: string;
  valuePropPairs?: SalesConsoleValuePropPair[];
  /**
   * Tenant-curated list of trusted research domains (e.g. their industry's
   * trade journals). Biases prospect-research citation ranking toward sources
   * the tenant trusts. Stored as bare hostnames; empty/unset keeps the
   * vertical-neutral default behavior.
   */
  trustedResearchDomains?: string[];
  /**
   * One-pager generator header images, keyed by audience. Used as the banner
   * image at the top of each generated one-pager PDF / web one-pager for the
   * matching audience. When a key is empty/unset, the one-pager renders a
   * neutral generated header (brand-color block + wordmark) — it must NEVER
   * fall back to a Dandy bitmap. Dandy's own values are populated by
   * `scripts/src/seed-dandy-one-pager-assets.ts` so Dandy output is unchanged.
   */
  onePagerHeaderImages?: {
    executive?: string;
    clinical?: string;
    practiceManager?: string;
  };
  /**
   * Product screenshot used inside the one-pager body (e.g. the scanner /
   * platform shot in the 90-Day Pilot template). Empty/unset → omitted or a
   * neutral placeholder, never the Dandy scanner image.
   */
  onePagerProductScreenshot?: string;
  /**
   * Logo variant painted for the dark one-pager header surface. Empty/unset →
   * the one-pager draws the brand wordmark instead of any bitmap logo (and
   * never the bundled Dandy white logo). Distinct from `BrandConfig.logoUrl` /
   * `logoUrlDark` so the sales one-pager can carry a header-specific mark.
   */
  onePagerLogoUrl?: string;
  /**
   * Workspace-default one-pager colors. When set, these override the brand's
   * own palette tokens for every generated one-pager (hero band, blocks,
   * sheet background) via `resolveOnePagerColors`. Empty/unset → the one-pager
   * inherits the matching brand color, so existing tenants see no change.
   * Edited from Brand Settings → Sales Console → One-pager defaults.
   */
  onePagerPrimaryColor?: string;
  onePagerAccentColor?: string;
  onePagerTextColor?: string;
  onePagerCardColor?: string;
  onePagerBackgroundColor?: string;
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
  defaultOgTitle: "",
  defaultOgDescription: "",
  defaultOgImageUrl: "",
  heatScoring: DEFAULT_HEAT_SCORING,
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
  // No default favicon. When empty, published tenant pages keep the default
  // LP Studio favicon (served from the base index.html). Tenants set their
  // own via Brand Settings → Logo & Identity.
  faviconUrl: "",
  logoAutoRecolor: true,
  // Logo→website link is opt-in. Off by default so existing tenants see no
  // behaviour change; tenants enable it in Brand Settings → Logo & Identity.
  websiteUrl: "",
  logoLinkEnabled: false,
  emailBannerUrl: "",
  // Strict facts default OFF: it's opt-in. Tenants enable it from Brand
  // Settings when they want AI generation restricted to approved stats /
  // claims / quotes. Existing tenants whose row predates this read
  // `undefined` from DB → callsites treat `aiStrictFactsMode === true` as
  // ON, so unset always means OFF.
  aiStrictFactsMode: false,
  scrapedStats: [],
  scrapedTestimonials: [],
};

/**
 * Resolve the URL the brand logo should link to, or null when it should not
 * be a link. Returns the trimmed `websiteUrl` only when the tenant has opted
 * in via `logoLinkEnabled` AND a non-empty URL is configured. Blocks wrap
 * their `BrandLogo` in an `<a target="_blank" rel="noopener noreferrer">`
 * when this returns a string.
 */
export function getLogoLinkUrl(brand: BrandConfig): string | null {
  if (!brand.logoLinkEnabled) return null;
  const url = brand.websiteUrl?.trim();
  return url ? url : null;
}

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
/**
 * Resolve a stored color value to a concrete CSS color that can be applied
 * directly (e.g. as a `backgroundColor`) without relying on CSS custom-property
 * inheritance at the render scope.
 *
 * The AI / templates sometimes store a brand color as a CSS-variable *string*
 * (`var(--brand-primary)`). Applied raw, that string only works if the
 * `--brand-*` custom property happens to be defined in that element's render
 * scope — when it isn't (the well-known builder-vs-published render
 * divergence), the property silently collapses to `transparent`/initial. This
 * resolves brand `var(...)` strings to their concrete hex via the SAME source
 * blocks render from ({@link getBrandStyleVars}), and falls back to a supplied
 * safe color so the result can never collapse to transparent.
 */
export function resolveBrandColor(
  brand: BrandConfig,
  value: string | undefined | null,
  fallback: string,
): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  // Keywords that would defeat the "never collapse to transparent" guarantee.
  if (/^(transparent|none|initial|inherit|unset|currentcolor)$/i.test(raw)) {
    return fallback;
  }
  // Already a concrete hex — apply as-is (preserving any alpha).
  if (isValidHex(raw)) return raw;
  // Brand CSS variable — resolve through the same source blocks render from.
  const match = raw.match(/var\(\s*(--[a-zA-Z0-9-]+)/);
  if (match) {
    const vars = getBrandStyleVars(brand) as Record<string, string | number>;
    const resolved = vars[match[1]];
    if (typeof resolved === "string" && resolved.trim()) return resolved.trim();
    return fallback;
  }
  // Some other CSS color (named, rgb(...), hsl(...), etc.) — keep as-is.
  return raw;
}

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

  // Background preset color overrides. For each preset the tenant has recolored,
  // emit `--lp-bg-<key>` (the background) plus `--lp-bg-<key>-fg` (a contrast-
  // safe text color derived from the chosen background). These cascade from the
  // page root so every section using getBgStyle picks them up with no per-block
  // changes; unset presets fall back to their historical defaults in the MAP.
  const presetColors = brand.backgroundPresetColors ?? {};
  for (const key of BACKGROUND_STYLE_KEYS) {
    const hex = presetColors[key];
    if (hex && isValidHex(hex)) {
      vars[`--lp-bg-${key}`] = hex;
      // The gradient preset overrides only the *first* stop; it always fades
      // into fixed dark stops (#001a14 → #000), so its text must stay white
      // regardless of the chosen first-stop color — never derive -fg from it.
      if (key !== "gradient") {
        vars[`--lp-bg-${key}-fg`] = contrastTextColor(hex);
      }
    }
  }
  // The "dandy-green" (Brand color) preset resolves its background through
  // --brand-primary, but its foreground var historically fell back to #fff —
  // correct for Dandy's forest green, ILLEGIBLE for a tenant whose primary is
  // pale (white-on-pastel body text). Always emit a contrast-derived -fg from
  // the color the preset actually paints, unless the tenant explicitly
  // recolored the preset (handled above).
  if (!(presetColors["dandy-green"] && isValidHex(presetColors["dandy-green"]))) {
    vars["--lp-bg-dandy-green-fg"] = contrastTextColor(primary);
  }
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

export function getButtonClasses(
  brand: BrandConfig,
  extra = "",
  opts: { imported?: boolean } = {},
): string {
  return [
    BUTTON_RADIUS[brand.buttonRadius],
    BUTTON_SHADOW[brand.buttonShadow],
    BUTTON_PX[brand.buttonPaddingX],
    BUTTON_PY[brand.buttonPaddingY],
    BUTTON_WEIGHT[brand.buttonFontWeight],
    BUTTON_CASE[brand.buttonTextCase],
    BUTTON_SPACING[brand.buttonLetterSpacing],
    "text-sm transition-all",
    // Stable hook so the imported "Primary button CSS" (buttonStyleRaw) can be
    // applied page-wide via a single injected stylesheet (see getBrandButtonCss).
    // Only primary CTAs get this class — pass { imported: false } for
    // outline/secondary buttons that happen to reuse this helper for sizing.
    opts.imported === false ? "" : "lp-brand-btn",
    extra,
  ].filter(Boolean).join(" ");
}

/**
 * Reject CSS values that could break out of a declaration or the surrounding
 * <style> element. buttonStyleRaw is populated by the URL importer (scraped
 * from untrusted external sites) and editable by tenants, so any value baked
 * into a published <style> must be sanitized. Returns the trimmed value when
 * safe, or null to skip the declaration entirely.
 */
function sanitizeCssValue(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/[<>{}\\;@]/.test(t)) return null;
  if (t.includes("/*") || t.includes("*/")) return null;
  return t;
}

/**
 * Best-effort conversion of a CSS color value (hex, rgb/rgba, common named
 * color, or the first stop of a gradient) into a `#rrggbb` hex so it can be
 * fed to the contrast helpers. Returns null when no concrete color can be
 * derived (e.g. a `var(...)` reference).
 */
function cssColorToHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (/gradient/.test(v)) {
    const stop = v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/);
    return stop ? cssColorToHex(stop[0]) : null;
  }
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  m = v.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return `#${m[1]}`;
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) {
    const to2 = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${to2(parseFloat(m[1]))}${to2(parseFloat(m[2]))}${to2(parseFloat(m[3]))}`;
  }
  const named: Record<string, string> = { white: "#ffffff", black: "#000000" };
  return named[v] ?? null;
}

/**
 * Resolve the label color for an imported primary button. Prefers the text
 * color scraped from the source's primary CTA rule; when none was captured (or
 * it's a non-color keyword), derives a guaranteed-legible color that contrasts
 * the resolved button background. Returns null only when neither a scraped
 * color nor a parseable background is available (block default then applies).
 */
function resolveImportedButtonLabelColor(raw: ImportedButtonStyle): string | null {
  const scraped = raw.textColor ? sanitizeCssValue(raw.textColor) : null;
  // Only trust a scraped color that resolves to a concrete value here. Tokenized
  // forms (var(...), color-mix(...)) depend on custom properties that the source
  // site defined but our landing page does not, so they'd silently collapse and
  // could leave the label illegible — fall through to the contrast fallback.
  if (
    scraped
    && !/^(transparent|inherit|initial|unset|currentcolor|none)$/i.test(scraped)
    && !/\bvar\(|\bcolor-mix\(/i.test(scraped)
  ) {
    return scraped;
  }
  const bgHex = raw.background?.value ? cssColorToHex(raw.background.value) : null;
  if (bgHex) return contrastTextColor(bgHex);
  return null;
}

/**
 * A scraped button background is only usable as a real CTA fill when it's a
 * visible color/gradient — NOT "none"/transparent and NOT a near-white wash.
 * The URL importer regularly lands on a light card/surface/utility element
 * instead of the real primary CTA (e.g. rasta scraped `rgb(241,241,241)`),
 * which — emitted with `!important` — makes every CTA invisible. Returns the
 * sanitized value when usable, or null so the block's own brand fill applies.
 */
/**
 * A scraped box-shadow only "defines" a button (lets a near-white fill read as a
 * real CTA) when it's an actual shadow — `"none"`/`"transparent"` are truthy
 * strings but draw nothing, so they must NOT count.
 */
function hasDefiningShadow(boxShadow: string | null | undefined): boolean {
  if (!boxShadow) return false;
  const v = boxShadow.trim().toLowerCase();
  return v !== "" && v !== "none" && v !== "transparent";
}

function usableImportedBg(
  value: string | null | undefined,
  hasShadow: boolean,
): string | null {
  if (!value) return null;
  const safe = sanitizeCssValue(value);
  if (!safe) return null;
  const v = safe.toLowerCase();
  if (/gradient/.test(v)) return safe; // gradients are always real fills
  if (/\b(none|transparent|currentcolor|inherit|initial|unset)\b/.test(v)) return null;
  if (/rgba?\([^)]*,\s*0(?:\.0+)?\s*\)/.test(v)) return null; // rgba(...,0)
  if (/\/\s*0(?:\.0+)?%?\s*\)/.test(v)) return null; // modern rgb(.. / 0) / hsl(.. / 0%)
  if (/^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/.test(v)) return null; // hex alpha-0 (#rgb0 / #rrggbb00)
  const hex = cssColorToHex(v);
  if (hex && !hasShadow) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // A near-white fill with no shadow to define its edge is almost never a real
    // CTA — it's the importer landing on a flat light surface/utility element
    // (rasta: rgb(241,241,241)). A white *pill with a shadow* is legitimate, so
    // only reject near-white when there's nothing giving the button definition.
    if (r >= 235 && g >= 235 && b >= 235) return null;
  }
  return safe;
}

/**
 * A scraped padding value is only usable as a CTA override when it's a single
 * POSITIVE CSS length. Rejects "0"/"0px" (collapses the button to no padding —
 * rasta's bug) and multi-value shorthands like "16px 88px" (invalid for
 * padding-left/padding-top so the browser drops them anyway). When unusable we
 * emit nothing and the brand's own buttonPaddingX/Y utility classes own the
 * padding, so every CTA keeps a real, sane hit area.
 */
function usableImportedPadding(value: string | null | undefined): string | null {
  if (!value) return null;
  const safe = sanitizeCssValue(value);
  if (!safe) return null;
  const m = safe.match(/^(\d*\.?\d+)\s*(px|rem|em)$/i);
  if (!m) return null;
  return parseFloat(m[1]) > 0 ? safe : null;
}

/**
 * Inline-style form of the imported "Primary button CSS" (buttonStyleRaw).
 * Used for the Brand Settings live preview, where a React style object wins
 * over the utility classes from getButtonClasses. Only emits properties that
 * are actually present AND usable so an empty/garbage import leaves buttons
 * with their normal brand styling.
 */
export function getImportedButtonInlineStyle(brand: BrandConfig): CSSProperties {
  const raw = brand.buttonStyleRaw;
  if (!raw) return {};
  const s: CSSProperties = {};
  const bg = usableImportedBg(raw.background?.value, hasDefiningShadow(raw.boxShadow));
  if (bg) s.background = bg;
  if (raw.boxShadow) s.boxShadow = raw.boxShadow;
  if (typeof raw.radiusPx === "number") s.borderRadius = `${raw.radiusPx}px`;
  const px = usableImportedPadding(raw.paddingX);
  if (px) { s.paddingLeft = px; s.paddingRight = px; }
  const py = usableImportedPadding(raw.paddingY);
  if (py) { s.paddingTop = py; s.paddingBottom = py; }
  if (typeof raw.fontWeight === "number") s.fontWeight = raw.fontWeight;
  if (raw.textTransform) s.textTransform = raw.textTransform as CSSProperties["textTransform"];
  // Only force a label color when we're also forcing a (usable) fill — deriving
  // contrast against a rejected near-white background would mis-color the label
  // on the block's real brand fill.
  const labelColor = bg ? resolveImportedButtonLabelColor(raw) : null;
  if (labelColor) s.color = labelColor;
  return s;
}

/**
 * Stylesheet form of the imported "Primary button CSS". Returns a single
 * `.lp-brand-btn { … }` rule (with !important so it overrides each block's
 * inline backgroundColor/utility classes) or "" when nothing is imported.
 * Inject once per rendered landing page (preview + prerender) so every
 * primary CTA picks up the brand's real button styling.
 */
export function getBrandButtonCss(brand: BrandConfig): string {
  const raw = brand.buttonStyleRaw;
  if (!raw) return "";
  const decls: string[] = [];
  const bg = usableImportedBg(raw.background?.value, hasDefiningShadow(raw.boxShadow));
  if (bg) decls.push(`background:${bg} !important`);
  const shadow = raw.boxShadow ? sanitizeCssValue(raw.boxShadow) : null;
  if (shadow) decls.push(`box-shadow:${shadow} !important`);
  if (typeof raw.radiusPx === "number" && Number.isFinite(raw.radiusPx)) {
    decls.push(`border-radius:${raw.radiusPx}px !important`);
  }
  const px = usableImportedPadding(raw.paddingX);
  if (px) decls.push(`padding-left:${px} !important`, `padding-right:${px} !important`);
  const py = usableImportedPadding(raw.paddingY);
  if (py) decls.push(`padding-top:${py} !important`, `padding-bottom:${py} !important`);
  if (typeof raw.fontWeight === "number" && Number.isFinite(raw.fontWeight)) {
    decls.push(`font-weight:${raw.fontWeight} !important`);
  }
  const tt = raw.textTransform ? sanitizeCssValue(raw.textTransform) : null;
  if (tt) decls.push(`text-transform:${tt} !important`);
  // Only force a label color when we're also forcing a (usable) fill — deriving
  // contrast against a rejected near-white background would mis-color the label
  // on the block's real brand fill.
  const labelColor = bg ? resolveImportedButtonLabelColor(raw) : null;
  const col = labelColor ? sanitizeCssValue(labelColor) : null;
  if (col) decls.push(`color:${col} !important`);
  if (decls.length === 0) return "";
  return `.lp-brand-btn{${decls.join(";")}}`;
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
  "STRICT FACTS MODE: This restriction applies ONLY to specific figures and " +
  "attributed proof — exact statistics, percentages, customer counts, dollar " +
  "amounts, named case studies, and customer quotes. Use ONLY the ones " +
  "explicitly listed in this brief: do NOT invent, extrapolate, round, or " +
  "paraphrase a number, and do NOT attribute a quote or case study that is not " +
  "provided. If a slot would require a stat or number that is not provided, " +
  "write \"X\"; if it would require a case study or quote that is not provided, " +
  "write \"Add a quote in brand settings\". For EVERYTHING ELSE — headlines, " +
  "value propositions, benefits, explanations, and all persuasive body copy — " +
  "write full, specific, substantive copy in the brand's voice; never leave a " +
  "section thin, vague, or generic just because it has no hard number to cite.";

export function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/**
 * Resolved one-pager generator assets for the active tenant, read from
 * `salesConsole.onePager*` brand config. Every URL is normalized against the
 * app base path so root-relative seeded paths (e.g. `/one-pager/foo.jpg`,
 * `/dandy-logo-white.svg`) resolve inside the artifact mount under a non-root
 * BASE_URL. A `null` value means "unset" — the one-pager generator must then
 * render a NEUTRAL fallback (brand-color block + wordmark) and NEVER a Dandy
 * bitmap. Dandy's own values come from the seed script so its output is
 * unchanged.
 */
export interface OnePagerAssets {
  headerImages: Record<"executive" | "clinical" | "practice-manager", string | null>;
  productScreenshot: string | null;
  logoUrl: string | null;
}

/** Prefix a root-relative asset URL with the app base path; pass through
 *  absolute/data/blob URLs and empty values (→ null). */
function withAppBase(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  if (u.startsWith("/")) return `${BASE}${u}`;
  return u;
}

export function resolveOnePagerAssets(brand: BrandConfig): OnePagerAssets {
  const sc = brand.salesConsole ?? {};
  const headers = sc.onePagerHeaderImages ?? {};
  // Dandy fallbacks: when a Dandy tenant has no explicit value for a one-pager
  // asset, restore the bundled Dandy default so existing Dandy instances keep
  // their logo, their per-audience pilot header images, AND the agreement-
  // summary scanner image (these used to be hardcoded before de-branding and
  // existing Dandy tenants were never seeded). Each fallback is gated on the
  // server-authoritative `isDandy` flag (resolved from the immutable protected
  // tenant slug, NOT the editable brandName) so a non-Dandy tenant can NEVER
  // receive a Dandy asset — even by renaming its brand to "Dandy". Any tenant
  // (Dandy included) overrides these via the matching salesConsole.onePager*
  // fields. Paths mirror scripts/src/seed-dandy-one-pager-assets.ts.
  const isDandy = brand.isDandy === true;
  const dandyFallback = (explicit: string | null | undefined, defaultPath: string): string =>
    (explicit ?? "").trim() || (isDandy ? defaultPath : "");
  return {
    headerImages: {
      executive: withAppBase(dandyFallback(headers.executive, "/one-pager/ai-scan-review-news.jpg")),
      clinical: withAppBase(dandyFallback(headers.clinical, "/one-pager/ai-scan-review-clinical.png")),
      "practice-manager": withAppBase(dandyFallback(headers.practiceManager, "/one-pager/dandy-dso-enterprise-data.webp")),
    },
    productScreenshot: withAppBase(dandyFallback(sc.onePagerProductScreenshot, "/one-pager/dandy-scanner-transparent.png")),
    // One-pager header logo. Dandy keeps its bundled white wordmark. For every
    // other tenant, fall back to the Brand Settings logo when no one-pager-
    // specific logo is set — preferring the dark-surface variant since the logo
    // sits on the dark brand band — so brand logos actually appear on one-pagers
    // instead of the generator drawing a plain text wordmark.
    logoUrl: withAppBase(
      isDandy
        ? dandyFallback(sc.onePagerLogoUrl, "/dandy-logo-white.svg")
        : ((sc.onePagerLogoUrl ?? "").trim()
          || (brand.logoUrlDark ?? "").trim()
          || (brand.logoUrl ?? "").trim()),
    ),
  };
}

/**
 * Apply the workspace-default one-pager color overrides
 * (`salesConsole.onePager*Color`) on top of a brand config, returning a new
 * BrandConfig whose palette tokens reflect those overrides. Only the color
 * fields are touched and only when a valid hex override is set — every other
 * field (fonts, logos, copy) passes through unchanged, and tenants who set no
 * one-pager colors get the original brand back untouched.
 *
 * Used by the landing-page viewer for one-pager pages so the override flows to
 * BOTH the CSS-var layer (`getBrandStyleVars`) and any block reading the
 * `brand` prop directly (e.g. the one-pager hero gradient).
 */
export function resolveOnePagerColors(brand: BrandConfig): BrandConfig {
  const sc = brand.salesConsole ?? {};
  const pick = (override: string | undefined, current: string): string => {
    const v = (override ?? "").trim();
    return isValidHex(v) ? v : current;
  };
  return {
    ...brand,
    primaryColor: pick(sc.onePagerPrimaryColor, brand.primaryColor),
    accentColor: pick(sc.onePagerAccentColor, brand.accentColor),
    textColor: pick(sc.onePagerTextColor, brand.textColor),
    cardBackground: pick(sc.onePagerCardColor, brand.cardBackground),
    pageBackground: pick(sc.onePagerBackgroundColor, brand.pageBackground),
  };
}

// Fetch one font family's embeddable TTF faces from the server-side resolver.
// Returns null on any failure or when the family isn't resolvable, so callers
// fall back to jsPDF's built-in faces. Never throws.
async function fetchBrandFontFaces(family: string): Promise<EmbeddedFontFaces | null> {
  try {
    const res = await fetch(
      `${BASE}/api/sales/brand-font?family=${encodeURIComponent(family)}`,
      { credentials: "include" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { family?: string; faces?: Partial<Record<string, string>> };
    const faces = data.faces ?? {};
    if (!faces.normal && !faces.bold && !faces.italic && !faces.bolditalic) return null;
    return {
      family,
      normal: faces.normal,
      bold: faces.bold,
      italic: faces.italic,
      bolditalic: faces.bolditalic,
    };
  } catch {
    return null;
  }
}

// Resolve the tenant's DISPLAY (heading) and BODY fonts to embeddable base64
// TTF faces so the shared PDF generators can embed the exact brand fonts. The
// web one-pager already gets fonts via CSS; only client-side PDF generation
// needs this. Best-effort: any font that can't be resolved is simply omitted
// and the generator falls back to its built-in face. Never throws.
export async function resolveBrandPdfFonts(brand: BrandConfig): Promise<BrandPdfFonts | undefined> {
  const heading = cleanFamilyName(brand.displayFont);
  const body = cleanFamilyName(brand.bodyFont);
  const families = Array.from(new Set([heading, body].filter((f): f is string => !!f)));
  if (families.length === 0) return undefined;

  const resolved = await Promise.all(
    families.map(async (f) => [f, await fetchBrandFontFaces(f)] as const),
  );
  const byFamily = new Map(resolved);

  const out: BrandPdfFonts = {};
  const headingFaces = heading ? byFamily.get(heading) : null;
  const bodyFaces = body ? byFamily.get(body) : null;
  if (headingFaces) out.heading = headingFaces;
  if (bodyFaces) out.body = bodyFaces;
  return out.heading || out.body ? out : undefined;
}

export async function fetchBrandConfig(
  slug?: string | null,
  previewTenantId?: number | null,
  reviewToken?: string | null,
): Promise<BrandConfig> {
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
  // PREVIEW-AS-BRAND (superadmin only). When the builder is editing a global
  // template / block-catalog scratch page (owned by the neutral system tenant),
  // it passes the tenant id to preview AS. The server honours this only for
  // superadmins; for everyone else it's ignored. Display-only — never saved.
  const params = new URLSearchParams();
  if (slug) params.set("slug", slug);
  if (previewTenantId != null) params.set("previewTenantId", String(previewTenantId));
  // A review-share token authorizes the server's slug→tenant brand lookup for
  // /preview/:slug?reviewToken=… links so a shared draft renders in the real
  // brand instead of falling back to the neutral DEFAULT_BRAND blue.
  if (reviewToken) params.set("reviewToken", reviewToken);
  const qsStr = params.toString();
  const qs = qsStr ? `?${qsStr}` : "";
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
  // `isDandy` is a read-only, server-computed flag — never persist it into the
  // tenant's brand_settings JSONB (the GET route recomputes it authoritatively).
  const { isDandy: _isDandy, ...persistable } = config;
  const res = await fetch(`${BASE}/api/lp/brand`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(persistable),
  });
  if (!res.ok) throw new Error("Failed to save brand config");
}
