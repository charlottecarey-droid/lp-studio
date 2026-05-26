import type { BackgroundStyle } from "../bg-styles";
import type {
  BlockSettings,
  CaseStudyItem,
  CtaMode,
  CtaModalConfig,
  FormStep,
  NavHeaderLink,
  NavHeaderCta,
  FooterColumn,
  ZigzagFeatureRow,
  ProductShowcaseCard,
  RoiInputField,
  RoiOutputField,
} from "./common";

export interface HeroBlockProps extends CtaModalConfig {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  heroType: "dandy-video" | "static-image" | "none";
  layout: "centered" | "split" | "split-right" | "minimal";
  backgroundStyle: BackgroundStyle;
  showSocialProof: boolean;
  socialProofText: string;
  imageUrl: string;
  /** Optional alt text for the hero image (a11y + saved to JSON). */
  imageAlt?: string;
  /** Optional CSS object-position ("x% y%") for the hero image focal point. */
  imageFocal?: string;
  mediaUrl: string;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  imageShadow?: boolean;
  ctaTextColor?: string;
  buttonWidth?: "auto" | "full";
  /**
   * What happens when the CTA button is clicked.
   *  - "url"             → navigate to ctaUrl (default)
   *  - "chilipiper"      → open Chili Piper iframe popup with chilipiperUrl
   *  - "modal-form"      → open EmailCaptureModal in form mode (uses modal* config)
   *  - "modal-chilipiper" → open EmailCaptureModal in chilipiper mode (uses modalChilipiperUrl)
   */
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
}

export interface TrustBarBlockProps {
  items: Array<{ value: string; label: string }>;
  bgColor?: string;
  statColor?: string;
  labelColor?: string;
  borderColor?: string;
  countUpEnabled?: boolean;
}

export interface PasSectionBlockProps {
  headline: string;
  body: string;
  bullets: string[];
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export interface ComparisonBlockProps extends CtaModalConfig {
  headline: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: CtaMode;
  chilipiperUrl?: string;
  oldWayLabel: string;
  oldWayBullets: string[];
  newWayLabel: string;
  newWayBullets: string[];
  oldCardBg?: string;
  newCardBg?: string;
}

export interface StatCalloutBlockProps {
  stat: string;
  description: string;
  footnote: string;
  countUpEnabled?: boolean;
}

export interface BenefitsGridBlockProps {
  headline: string;
  columns: 2 | 3 | 4 | 5;
  items: Array<{ icon: string; title: string; description: string }>;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  hoverLift?: boolean;
}

export interface TestimonialBlockProps {
  quote: string;
  author: string;
  role: string;
  practiceName: string;
}

export interface HowItWorksBlockProps {
  headline: string;
  steps: Array<{ number: string; title: string; description: string }>;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  circleBg?: string;
  circleText?: string;
}

export interface ProductGridBlockProps {
  headline: string;
  subheadline: string;
  columns?: 2 | 3 | 4 | 5;
  items: Array<{ image: string; title: string; description: string }>;
  hoverLift?: boolean;
  hoverImageZoom?: boolean;
}

export interface PhotoStripBlockProps {
  images: Array<{ src: string; alt: string }>;
  imageSize?: "xs" | "sm" | "md" | "lg" | "xl";
  gap?: number;
  showGradient?: boolean;
  objectFit?: "cover" | "contain";
  speed?: "slow" | "normal" | "fast";
}

export interface BottomCtaBlockProps extends CtaModalConfig {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
}

export interface VideoSectionBlockProps extends CtaModalConfig {
  layout: "full-width" | "split-left" | "split-right";
  headline: string;
  subheadline: string;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
  videoUrl: string;
  aspectRatio: "16/9" | "4/3" | "1/1";
  backgroundStyle: BackgroundStyle;
  overlayHeadline?: string;
  overlaySubheadline?: string;
  overlayCtaText?: string;
  overlayCtaUrl?: string;
  overlayVAlign?: "top" | "center" | "bottom";
  overlayHAlign?: "left" | "center" | "right";
  overlayTextLight?: boolean;
  fillContainer?: boolean;
  videoAutoplay?: boolean;
  /** Poster image shown before play (matches the Dandy site's video thumbnail look). */
  posterUrl?: string;
  /** When true, clicking play opens the video in a fullscreen modal (Dandy site style). */
  playInModal?: boolean;
}

export interface CaseStudiesBlockProps {
  headline: string;
  subheadline: string;
  columns?: 2 | 3 | 4;
  items: CaseStudyItem[];
  backgroundStyle: BackgroundStyle;
  hoverLift?: boolean;
  hoverImageZoom?: boolean;
}

export interface ResourcesBlockProps {
  headline: string;
  subheadline: string;
  columns: 2 | 3 | 4 | 5;
  items: Array<{ image: string; title: string; description: string; category: string; url: string }>;
  backgroundStyle: BackgroundStyle;
}

export interface RichTextBlockProps {
  html: string;
}

export interface CustomHtmlBlockProps {
  html: string;
}

/* ── Grid pieces (task #120) ───────────────────────────────────────────── */

export interface GridImageBlockProps {
  imageUrl: string;
  alt: string;
  rounded: boolean;
  href?: string;
}

export interface GridHeadlineSubBlockProps {
  headline: string;
  subheadline: string;
  align: "left" | "center" | "right";
}

export interface GridParagraphBulletsBlockProps {
  paragraph: string;
  bullets: string[];
}

export interface GridHeadlineParagraphBlockProps {
  headline: string;
  paragraph: string;
  align: "left" | "center" | "right";
}

export interface GridIconFeatureBlockProps {
  icon: string;
  headline: string;
  paragraph: string;
}

export interface GridStatBlockProps {
  value: string;
  label: string;
  caption?: string;
}

export interface GridQuoteBlockProps {
  quote: string;
  attribution: string;
  role?: string;
}

export interface GridCtaTileBlockProps {
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  bgColor?: string;
  textColor?: string;
}

export interface GridLogoBlockProps {
  logoUrl: string;
  alt: string;
  href?: string;
}

export interface GridVideoBlockProps {
  videoUrl: string;
  posterUrl?: string;
  caption?: string;
}

/* ── Schema-driven custom blocks (task #120) ───────────────────────────── */

export type SchemaFieldType =
  | "text" | "longText" | "number" | "color" | "image" | "url" | "boolean" | "select"
  // Task #227 — array of objects with a scalar sub-schema. Renders via
  // {{#each list}}…{{/each}} in templates so editors can add/remove rows
  // for nav columns, social links, pricing tiers, etc.
  | "list";

/**
 * A single row inside a "list" field. Sub-fields are scalar or — for the
 * outermost list only — another array of rows (one level of nesting,
 * e.g. nav_columns → links).
 */
export type SchemaListItem = { [k: string]: string | number | boolean | SchemaListItem[] };

export interface SchemaFieldDef {
  id: string;
  label: string;
  type: SchemaFieldType;
  defaultValue?: string | number | boolean | SchemaListItem[];
  options?: string[];
  placeholder?: string;
  helpText?: string;
  /** When true, the property panel marks this field as required. */
  required?: boolean;
  /**
   * Only valid when `type === "list"`. Defines the sub-fields each row
   * exposes. Sub-fields are scalar or — at the outermost list only —
   * another "list" (one level of nesting).
   */
  itemSchema?: SchemaFieldDef[];
}

export type SchemaFieldValue = string | number | boolean | SchemaListItem[];

export interface CustomSchemaBlockProps {
  schema: SchemaFieldDef[];
  template: string;
  /**
   * Per-instance overrides. Any field in `values` wins over the master's
   * `sharedValues`; fields absent from `values` follow the master (task #198).
   */
  values: Record<string, SchemaFieldValue>;
  customBlockId?: number;
  customBlockName?: string;
  /**
   * Server-stamped at render time from the source's master values
   * (task #198). Not persisted on the page block itself.
   */
  sharedValues?: Record<string, SchemaFieldValue>;
}

export interface SpacerBlockProps {
  height: number;
  backgroundColor: string;
}

export interface FormBlockProps {
  headline: string;
  subheadline: string;
  multiStep: boolean;
  steps: FormStep[];
  submitButtonText: string;
  submitButtonColor?: string;
  submitButtonTextColor?: string;
  successMessage: string;
  redirectUrl: string;
  backgroundStyle: BackgroundStyle;
  formId?: number;
  /** Visual style for the form card. */
  cardStyle?: "elevated" | "flat" | "minimal";
  /** Override the form card background color. Defaults to white. */
  cardBgColor?: string;
  /** Border radius for the card and inputs. Defaults to "2xl". */
  cardRadius?: "lg" | "xl" | "2xl" | "3xl";
  /** Focus ring/border color for inputs. Defaults to brand primary. */
  inputAccentColor?: string;
  /** Label style. Defaults to "uppercase" (Dandy-style). */
  labelStyle?: "uppercase" | "default";

  /** Form mode. "native" (default) renders our own fields; "marketo" embeds a Marketo form. */
  formMode?: "native" | "marketo";
  /** Marketo instance base URL, e.g. "//app-XXX.marketo.com". */
  marketoBaseUrl?: string;
  /** Munchkin ID, e.g. "123-ABC-456". */
  marketoMunchkinId?: string;
  /** Numeric Marketo form ID. */
  marketoFormId?: number;
}

export interface ZigzagFeaturesBlockProps {
  rows: ZigzagFeatureRow[];
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Optional section heading shown above the rows. */
  headline?: string;
  /** Optional supporting copy beneath the section headline. */
  subheadline?: string;
  /** Alignment for the optional section heading. */
  headlineAlign?: "left" | "center";
}

export interface ProductShowcaseBlockProps {
  headline: string;
  subheadline: string;
  columns: 2 | 3 | 4 | 5;
  cards: ProductShowcaseCard[];
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  hoverLift?: boolean;
  hoverImageZoom?: boolean;
}

export interface FooterBlockProps {
  backgroundColor: string;
  accentColor: string;
  copyrightText: string;
  showSocialLinks: boolean;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  columns: FooterColumn[];
}

export interface FullBleedHeroBlockProps extends CtaModalConfig {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  backgroundType: "image" | "video";
  backgroundImageUrl: string;
  backgroundVideoUrl?: string;
  videoAutoplay?: boolean;
  overlayOpacity: number;
  overlayColor?: string;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  headlineColor?: string;
  subheadlineColor?: string;
  minHeight: "full" | "large" | "medium";
  contentAlignment: "left" | "center" | "right";
  logoImageUrl?: string;
  logoUrl?: string;
  navLinks: NavHeaderLink[];
  headerCtaText?: string;
  headerCtaUrl?: string;
  headerScrolledBg?: string;
  showSocialProof?: boolean;
  socialProofText?: string;
}

export interface ParallaxImageHeroBlockProps {
  imageUrl: string;
  /** Optional looping background video (mp4/webm). When set, replaces the
   *  parallax image with a parallax-translated <video>. The image still
   *  acts as a poster + reduced-motion fallback. */
  videoUrl?: string;
  videoAutoplay?: boolean;
  eyebrow: string;
  referenceLabel: string;
  headline: string;
  headlineAccentWord?: string;
  accentColor?: string;
  ctaText: string;
  ctaUrl: string;
  brandMark: string;
  brandMarkLogoUrl?: string;
  overlayOpacity: number;
  overlayColor?: string;
  parallaxStrength: number;
  /** Section height preset. Expanded beyond the original full/large pair
   *  so the block can read as a strip inside a larger section instead of
   *  always occupying a full viewport. Maps to vh values in the renderer:
   *  full=100, large=85, medium=70, compact=55, small=40, slim=28. */
  minHeight: "full" | "large" | "medium" | "compact" | "small" | "slim";
  textColor?: string;
  /** Edge gradient that fades the section into a solid color along the
   *  top, bottom, or both edges — used to visually stitch the parallax
   *  strip into the section above and/or below so it doesn't read as
   *  its own standalone section. "none" (default) disables the fade. */
  edgeFade?: "none" | "top" | "bottom" | "both";
  /** Solid color the edge fade resolves to. Should match the bg of the
   *  adjacent section for a seamless blend. Defaults to the section's
   *  own dark fallback (#0a0a0a). */
  edgeFadeColor?: string;
  /** Percent of section height covered by each edge fade (0–60). Larger
   *  values give a longer, softer blend. Default 25. */
  edgeFadeSize?: number;
  /** Visual scale of the background image / video inside the section.
   *  1.0 (default) = "cover" — media fills the section the same as
   *  before. Values < 1 shrink the media toward the centre and let the
   *  section's fallback background show around it; values > 1 zoom in.
   *  Clamped to [0.3, 1.5]. */
  mediaScale?: number;
}

export interface RoiCalculatorBlockProps extends CtaModalConfig {
  headline: string;
  subheadline: string;
  inputFields: RoiInputField[];
  outputFields: RoiOutputField[];
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
  ctaEnabled: boolean;
  backgroundStyle: BackgroundStyle;
  accentColor?: string;
  resultsPanelLabel?: string;
  disclaimer?: string;
}

export interface DandyVersusBlockProps {
  eyebrow?: string;
  headline: string;
  leftLabel: string;
  leftTitle: string;
  leftDesc: string;
  leftBullets: string[];
  leftCtaText: string;
  leftCtaUrl: string;
  rightLabel: string;
  rightTitle: string;
  rightDesc: string;
  rightBullets: string[];
  rightCtaText: string;
  rightCtaUrl: string;
  bgColor?: string;
  /** Optional override for the right (Dandy) card background/gradient base.
   *  Falls back to `var(--brand-primary)` when unset. */
  rightBg?: string;
  /** Optional override for the eyebrow color (top + right-card labels).
   *  Falls back to `var(--brand-accent)` when unset. */
  eyebrowColor?: string;
}

export interface DandyColumnsV2Item {
  imageUrl: string;
  title: string;
  description: string;
  bullets: string[];
  ctaText: string;
  ctaUrl: string;
}

export interface DandyColumnsV2BlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Background color for each column card. Defaults to transparent. */
  cardBgColor?: string;
  items: DandyColumnsV2Item[];
}

export interface DandyColumnsV3Item {
  imageUrl: string;
  title: string;
  description: string;
}

export interface DandyColumnsV3BlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Horizontal alignment of the eyebrow / headline / subheadline block
   *  above the columns. Defaults to "left" to preserve the original layout. */
  headerAlign?: "left" | "center";
  /** Show the leading "01.", "02.", … numbers next to each item title.
   *  Defaults to true to preserve the original layout. */
  showNumbers?: boolean;
  /** Color of the leading number. Defaults to var(--brand-accent). */
  numberColor?: string;
  /** Horizontal gap between the number and the adjacent title. */
  numberGap?: "tight" | "normal" | "loose";
  items: DandyColumnsV3Item[];
}

export interface DandyVerticalTabItem {
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
}

export interface DandyVerticalTabsBlockProps {
  headline: string;
  subheadline?: string;
  tabs: DandyVerticalTabItem[];
  headlineAlign?: "left" | "center";
}

export interface DandySwitchbackItem {
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
}

export interface DandySwitchbackBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: DandySwitchbackItem[];
  headlineAlign?: "left" | "center";
}

export interface DandySiteHeaderNavLink {
  label: string;
  url: string;
}

export interface DandySiteHeaderBlockProps extends CtaModalConfig {
  logoUrl?: string;
  phoneNumber: string;
  phoneLabel: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  /** How the primary CTA behaves on click. Defaults to "url". */
  primaryCtaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  /** How the secondary CTA behaves on click. Defaults to "url". */
  secondaryCtaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  navLinks: DandySiteHeaderNavLink[];
  /** Optional CSS background color for the header bar. Falls back to the
   *  brand primary color when unset. Accepts any CSS color (`#hex`,
   *  `rgb()`, `var(--brand-…)`). */
  backgroundColor?: string;
  /** Optional background image URL layered behind the bar contents. Sized
   *  with `cover` and centered. Combine with `backgroundOverlay` to dim. */
  backgroundImage?: string;
  /** 0–1 dark overlay applied on top of `backgroundImage` so logo + text
   *  remain legible. Default 0 (no overlay). */
  backgroundOverlay?: number;
  /** Override for header text/logo color. When unset, falls back to white
   *  (the historical look on the brand-primary background). */
  textColor?: string;
  /** Optional CSS `font-family` stack applied to header text (logo wordmark,
   *  nav links, CTAs). Accepts any valid CSS font stack. When unset,
   *  inherits from the page. */
  fontFamily?: string;
}

export interface DandySiteFooterLinkGroup {
  heading: string;
  links: Array<{ label: string; url: string }>;
}

export interface DandySiteFooterBlockProps {
  logoUrl?: string;
  disclaimer?: string;
  linkGroups: DandySiteFooterLinkGroup[];
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  copyrightText?: string;
}

export interface DandyVideoTestimonialItem {
  imageUrl: string;
  name: string;
  practiceName: string;
  /** Wistia hashed ID (legacy / external playback). */
  videoId?: string;
  /** Direct video URL (e.g. local /videos/foo.mp4) — opens in lightbox on click. */
  videoSrc?: string;
}

export interface DandyVideoTestimonialsBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: DandyVideoTestimonialItem[];
}

export interface DandySideImageV6BlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  bullets?: string[];
  ctaText?: string;
  ctaUrl?: string;
  /** Behavior of the primary CTA. Defaults to "url" (open URL). */
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  /** Used when ctaAction === "chilipiper". */
  chilipiperUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  /** Behavior of the secondary CTA. Defaults to "url". */
  secondaryCtaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  /** Used when secondaryCtaAction === "chilipiper". */
  secondaryChilipiperUrl?: string;
  imageUrl?: string;
  badgeText?: string;
  imagePosition?: "left" | "right";
  bgColor?: string;
}

export interface DandyHeroV7S3TrustItem {
  value: string;
  label: string;
}

export interface DandyHeroV7S3BlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  inputPlaceholder?: string;
  ctaText?: string;
  formAction?: string;
  formDisclaimer?: string;
  chilipiperUrl?: string;
  backgroundImageUrl?: string;
  bgColor?: string;
  bgImageOpacity?: number;
  trustItems?: DandyHeroV7S3TrustItem[];
}

export interface DandyFormRightAltBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  bullets?: string[];
  trustNote?: string;
  formHeadline?: string;
  formSubheadline?: string;
  submitText?: string;
  formAction?: string;
  formDisclaimer?: string;
  successMessage?: string;
  chilipiperUrl?: string;
  bgColor?: string;

  /** Form mode. "native" (default) renders our own fields; "marketo" embeds a Marketo form. */
  formMode?: "native" | "marketo";
  marketoBaseUrl?: string;
  marketoMunchkinId?: string;
  marketoFormId?: number;

  /** Left column content. "bullets" (default) shows the checkmark list;
   *  "image" shows an editorial image instead. */
  leftMode?: "bullets" | "image";
  /** Image shown when `leftMode === "image"`. */
  imageUrl?: string;
  imageAlt?: string;
  /** Aspect ratio for the left image. Defaults to "portrait". */
  imageAspect?: "portrait" | "square" | "landscape" | "wide";
  /** Whether to render a soft drop shadow under the left image. Defaults to true
   *  for back-compat with existing pages. */
  imageShadow?: boolean;

  /** Where the headline + subheadline render.
   *  - "default" (current): headline group lives in the left column above the
   *    bullets / image.
   *  - "centered-over-block": a centered headline group spans the full width
   *    above the two-column grid (left content + form card sit underneath). */
  headlineLayout?: "default" | "centered-over-block";

  /** Optional link to a global form (managed in /forms). When set, the card
   *  renders the global form's fields/steps and routes submissions through
   *  the form's Chili Piper handoff config (if any) — same wiring as the
   *  shared `form` block. Leave undefined to use the built-in
   *  firstName / lastName / email / phone fields. */
  formId?: number;
}

export interface DandyConversionPanel1Stat {
  value: string;
  label: string;
}

export interface DandyConversionPanel1BlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  primaryCtaAction?: CtaMode;
  primaryChilipiperUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  secondaryCtaAction?: CtaMode;
  secondaryChilipiperUrl?: string;
  style?: "teal" | "lime" | "medium" | "white";
  bgColor?: string;
  stats?: DandyConversionPanel1Stat[];
}

export interface DandyCtaBlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  primaryCtaAction?: CtaMode;
  primaryChilipiperUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  secondaryCtaAction?: CtaMode;
  secondaryChilipiperUrl?: string;
  disclaimer?: string;
  alignment?: "left" | "center" | "right";
  bgColor?: string;
}

export type ScrollAssemblyPieceKind = "text-display" | "text-headline" | "text-body" | "image" | "shape";
export type ScrollAssemblyDirection = "left" | "right" | "top" | "bottom" | "scale" | "fade";

export interface ScrollAssemblyPiece {
  kind: ScrollAssemblyPieceKind;
  /** Either text content (for text-* kinds) or an image URL (for image kind). */
  content: string;
  /** Direction the piece flies in from. Defaults to "fade". */
  from?: ScrollAssemblyDirection;
  /** Optional override (0..1) for when in the scroll progress this piece resolves. */
  revealAt?: number;
  /** Optional color override (text or shape). */
  color?: string;
}

export type ScrollAssemblyDecor = "minimal" | "orbs" | "grid" | "all";

/* ------------------------------------------------------------------------- */
/*  Shared email-capture / modal config                                      */
/*  Used by Scroll Assembly, Horizontal Showcase, and Sticky Stack so all    */
/*  three blocks support the same global form / Marketo / Chili Piper modal  */
/*  flow as BlockDandyProductHero.                                           */
/* ------------------------------------------------------------------------- */

export type BlockSubmitMode = "navigate" | "modal-form" | "modal-chilipiper";
export type BlockModalFormSource = "simple" | "linked" | "marketo";

export interface EmailCaptureConfig {
  /** What happens when the inline email pill is submitted. Defaults to navigate. */
  submitMode?: BlockSubmitMode;
  /** Chili Piper booking URL (when submitMode === "modal-chilipiper"). */
  modalChilipiperUrl?: string;
  /** Which form source the modal uses (when submitMode === "modal-form"). */
  modalFormSource?: BlockModalFormSource;
  /** Linked global form id (when modalFormSource === "linked"). */
  modalFormId?: number;
  /** Marketo config (when modalFormSource === "marketo"). */
  modalMarketoBaseUrl?: string;
  modalMarketoMunchkinId?: string;
  modalMarketoFormId?: number;
  /** Optional Chili Piper hand-off applied after Marketo modal submit. */
  modalChiliPiperHandoffUrl?: string;
  modalChiliPiperHandoffMode?: "modal" | "redirect";
  /** Optional Marketo→Chili Piper field map (parity with Global Forms). */
  modalChiliPiperHandoffFieldMap?: Record<string, string>;
  /** Optional copy overrides for the modal. */
  modalHeadline?: string;
  modalSubheadline?: string;
  modalSubmitText?: string;
  modalSuccessMessage?: string;
  modalDisclaimer?: string;
  /** Field visibility toggles for the simple form variant. */
  modalShowFirstName?: boolean;
  modalShowLastName?: boolean;
  modalShowPhone?: boolean;
  modalShowCompany?: boolean;
}

export interface ScrollAssemblyBlockProps {
  eyebrow?: string;
  pieces: ScrollAssemblyPiece[];
  ctaText?: string;
  ctaUrl?: string;
  /** Background color for the whole pinned section. */
  bgColor?: string;
  /** Total scroll length (in vh) per piece. Higher = slower assembly. Default 100. */
  scrollLengthVh?: number;
  /** Image URLs that drift past in the background as parallax layers. */
  floatingImages?: string[];
  /** Pill tags that ticker across the bottom of the section. */
  marqueeTags?: string[];
  /** Ambient decoration style. Default "all". */
  decor?: ScrollAssemblyDecor;
  /** Accent color for orbs / highlights. Defaults to brand accent. */
  accentColor?: string;
  /** Whether to overlay subtle film grain. Default true. */
  grain?: boolean;
  /** Overall text color (light/dark). Auto-derived from bg if omitted. */
  theme?: "light" | "dark";

  /** When true, renders an inline email pill in place of the CTA button at
   *  the end of the assembly. Submitting routes through the section's modal
   *  config below (or appends ?email=… to ctaUrl when submitMode is "navigate"). */
  showEmailCapture?: boolean;
  /** Placeholder for the inline email input. Default "Email address". */
  emailPlaceholder?: string;
  /** Email-capture / modal config (Chili Piper, Marketo, simple, linked global form). */
  email?: EmailCaptureConfig;
}

/* ------------------------------------------------------------------------- */
/*  Horizontal Showcase                                                      */
/* ------------------------------------------------------------------------- */

export interface HorizontalShowcasePanel {
  title: string;
  body?: string;
  tag?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  alignment?: "left" | "center" | "right";
  /** Background color of the panel itself (shows through if no image). */
  bgColor?: string;
  /** Color of the gradient overlay applied over the image. */
  overlayColor?: string;
  /** Accent color used for the tag pill and CTA button. */
  accentColor?: string;
  /** When true, renders an inline email capture pill instead of the CTA button. */
  showEmailCapture?: boolean;
  /** Placeholder for the email input. Default "Email address". */
  emailPlaceholder?: string;
}

export interface HorizontalShowcaseBlockProps {
  eyebrow?: string;
  headline?: string;
  panels: HorizontalShowcasePanel[];
  /** Background color of the section frame. */
  bgColor?: string;
  /** Approximate vh of vertical scroll consumed per panel. Default 90. */
  panelHeightVh?: number;
  /** Section-level email-capture / modal config. Shared by every panel that
   *  has showEmailCapture enabled (or a panel whose ctaUrl uses the modal flow). */
  email?: EmailCaptureConfig;
}

/* ------------------------------------------------------------------------- */
/*  Sticky Stack                                                             */
/* ------------------------------------------------------------------------- */

export interface StickyStackCard {
  title: string;
  body?: string;
  tag?: string;
  imageUrl?: string;
  imageSide?: "left" | "right";
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Optional CTA shown under the card body. */
  ctaText?: string;
  ctaUrl?: string;
  /** When true, renders an inline email capture pill instead of the CTA button. */
  showEmailCapture?: boolean;
  /** Placeholder for the email input. Default "Email address". */
  emailPlaceholder?: string;
}

export interface StickyStackBlockProps {
  eyebrow?: string;
  headline?: string;
  cards: StickyStackCard[];
  bgColor?: string;
  /** vh of scroll consumed per card (default 110). */
  cardScrollVh?: number;
  /** Section-level email-capture / modal config shared by every card. */
  email?: EmailCaptureConfig;
}

/* ------------------------------------------------------------------------- */
/*  Magazine Hero — editorial-style hero with serif display type, asymmetric  */
/*  photo, eyebrow tag and byline. Designed to look like a print magazine    */
/*  feature article, not a SaaS landing.                                     */
/* ------------------------------------------------------------------------- */

export interface MagazineHeroBlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: CtaMode;
  chilipiperUrl?: string;
  /** Optional secondary CTA rendered as a text link next to the primary
   *  button. Useful for "Read the story →" style flows. */
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryAction?: CtaMode;
  secondaryChilipiperUrl?: string;
  bylineLabel?: string;
  bylineValue?: string;
  imageUrl?: string;
  /** Accent color for the eyebrow rule, divider, and decorative orb. */
  accentColor?: string;
  /** Surface color (page background). */
  bgColor?: string;
  /** Text color for headline + body. */
  textColor?: string;
  /** Layout variant. Defaults to "split" (current behavior). */
  layout?: "split" | "stacked" | "cover";
  /** Aspect ratio of the hero image. */
  imageAspect?: "portrait" | "square" | "landscape" | "wide";
  /** Serif typeface used for the headline.
   *  - modern: Instrument Serif (light, editorial — Apple-marketing vibe)
   *  - editorial: Fraunces (warm, contemporary)
   *  - classic: Playfair Display (the original, more traditional) */
  serifStyle?: "modern" | "editorial" | "classic";
  /** Headline weight. Light feels more premium, bold feels more punchy. */
  headlineWeight?: "light" | "regular" | "bold";
  /** Optional small rotation on the hero image (degrees). Defaults to 0. */
  imageRotation?: number;
  /** Show a thin top + bottom rule for an editorial framed feel. */
  showRule?: boolean;
  /** Optional metadata strip rendered above the eyebrow, e.g.
   *  "Issue 04 — Spring 2026". */
  issueLabel?: string;
  /** Cover layout only: how dark to scrim the image so overlay text reads. */
  coverScrim?: number;
  /** Optional per-block override for the headline font family. When set,
   *  overrides the `serifStyle` preset. Pick from the curated FONT_CATALOG
   *  via the FontSelect control. Leave undefined to inherit the brand's
   *  display font (e.g. Bagoss for Dandy) when one is configured, or fall
   *  back to the chosen serif preset. */
  headlineFont?: string;
  /** Optional per-block override for the body/eyebrow/byline font. Defaults
   *  to the brand's body font when set, else system sans-serif. */
  bodyFont?: string;
}

/* ------------------------------------------------------------------------- */
/*  Bold Statement — brutalist full-bleed manifesto block. Massive typography,*/
/*  one accented word, optional small footer line. Built to make the page    */
/*  feel like a campaign, not a product page.                                */
/* ------------------------------------------------------------------------- */

export interface BoldStatementBlockProps extends CtaModalConfig {
  eyebrow?: string;
  /** Main statement. Use HTML <em>...</em> around the word(s) you want
   *  rendered in the accent color. */
  statement: string;
  /** Small line of copy under the statement (optional). */
  footnote?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaAction?: CtaMode;
  chilipiperUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** When true, the statement renders dim by default and lights up word-by-word
   *  as the visitor scrolls into the section (same effect used by the AI
   *  feature block). Defaults to false to preserve existing pages. */
  scrollReveal?: boolean;
  /** Dim/un-revealed color used when `scrollReveal` is enabled. Defaults to
   *  the text color at 20% alpha. */
  dimColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Bento Showcase — asymmetric grid of mixed-content tiles (image, stat,    */
/*  quote, feature). Visually distinct from benefits-grid / product-grid     */
/*  because each tile can be its own size and background.                    */
/* ------------------------------------------------------------------------- */

export type BentoTileKind = "image" | "stat" | "quote" | "feature";
export type BentoTileSize = "sm" | "md" | "lg" | "xl";

export interface BentoShowcaseTile {
  kind: BentoTileKind;
  size: BentoTileSize;
  /** image kind: image url. stat kind: the big number. quote kind: the
   *  quote body. feature kind: the headline. */
  primary: string;
  /** Supporting text below `primary` (label/caption/byline/description). */
  secondary?: string;
  /** Tertiary line (used for quote attribution or feature subtitle). */
  tertiary?: string;
  /** Tile background color. Defaults to the section background. */
  bgColor?: string;
  /** Text color override for the tile. */
  textColor?: string;
  /** Lucide icon name shown above feature-kind tiles. */
  icon?: string;
  /** Image-tile only: alt text (saved to JSON). */
  imageAlt?: string;
  /** Image-tile only: CSS object-position focal point (e.g. "50% 30%"). */
  imageFocal?: string;
}

export interface BentoShowcaseBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  tiles: BentoShowcaseTile[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Editorial Carousel — animated, draggable photo carousel extracted from   */
/*  the Inside Dandy event page. Dark luxury treatment with letter-spaced    */
/*  uppercase captions, hover zoom, animated underline, corner accents, and  */
/*  optional auto-advance. Designed as a stand-alone showcase block.         */
/* ------------------------------------------------------------------------- */

export interface EditorialCarouselSlide {
  src: string;
  alt: string;
  /** Small uppercase caption shown on the slide in image-carousel mode. */
  caption?: string;
  /** Case-study mode: large headline rendered on the slide. */
  headline?: string;
  /** Case-study mode: supporting copy under the headline. */
  subheadline?: string;
  /** Case-study mode: optional CTA chip label rendered on the slide. */
  ctaText?: string;
  /** Optional URL the entire slide links to. When set, the slide becomes a
   *  clickable anchor (live view only — editor stays non-navigating so the
   *  author can edit inline text). */
  linkUrl?: string;
}

export interface EditorialCarouselBlockProps {
  /** Optional eyebrow rendered above the headline. */
  eyebrow?: string;
  /** Optional headline shown above the carousel. Leave blank for a
   *  carousel-only section. */
  headline?: string;
  /** Optional subheadline body copy under the headline. */
  subheadline?: string;
  slides: EditorialCarouselSlide[];
  /** Section background. Defaults to the brand primary color. */
  bgColor?: string;
  /** Heading + caption color. Defaults to a warm cream so it reads on
   *  the dark default background; override to follow brand text color. */
  textColor?: string;
  /** Accent / brand color for the caption underline, dot indicator,
   *  corner accents and prev/next button hover. Defaults to brand accent. */
  accentColor?: string;
  /** Border color for the prev/next buttons. Defaults to brand border. */
  borderColor?: string;
  /** Headline font family. Leave blank to inherit the brand display font
   *  (falls back to Instrument Serif). */
  headlineFont?: string;
  /** Body font family for eyebrow / subheadline / captions. Leave blank
   *  to inherit the brand body font (falls back to Inter). */
  bodyFont?: string;
  /** Aspect ratio of each slide. */
  aspect?: "16/9" | "4/3" | "3/2" | "1/1";
  /** Width each slide takes up on desktop, as a percentage. Smaller
   *  values reveal more of the neighbours. */
  slideWidthPct?: number;
  /** Whether the carousel auto-advances. */
  autoplay?: boolean;
  /** Auto-advance interval in milliseconds. */
  autoplayInterval?: number;
  /** Round slide corners. */
  rounded?: boolean;
  /** Slide content mode.
   *  - "image"      : original image-with-caption treatment (default).
   *  - "case-study" : per-slide headline / subheadline / CTA + clickable
   *                   slide, suitable for a premium case-study carousel. */
  mode?: "image" | "case-study";
  /** Layout for case-study slides.
   *  - "overlay"        : full-bleed image with text overlaid directly
   *                       (use when the image is dark/quiet enough).
   *  - "overlay-scrim"  : full-bleed image with a dark gradient scrim
   *                       behind the text for legibility (default).
   *  - "split"          : image on one half, text on a solid card on the
   *                       other half. Use when the image is too busy. */
  layout?: "overlay" | "overlay-scrim" | "split";
  /** Per-slide headline font size in rem (case-study mode). */
  headlineSize?: number;
  /** Per-slide subheadline font size in rem (case-study mode). */
  subheadlineSize?: number;
  /** Background color for the text card in `split` layout. Defaults to a
   *  slightly raised version of the section background. */
  cardBgColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Gradient Pricing — dark-mode pricing tiers with a gradient backdrop and  */
/*  a featured (raised) middle card. Designed for SaaS landings.             */
/* ------------------------------------------------------------------------- */

export interface GradientPricingTier {
  name: string;
  price: string;
  /** Period appended after the price (e.g. "/mo", "/seat"). */
  period?: string;
  description?: string;
  features: string[];
  ctaText: string;
  ctaUrl: string;
  /** When true, this card is rendered raised, with a glow border and the
   *  accent color as its CTA. Use exactly one. */
  featured?: boolean;
  /** Pill label rendered above featured cards (e.g. "Most popular"). */
  badge?: string;
}

export interface GradientPricingBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  tiers: GradientPricingTier[];
  /** Two colors used in the section gradient. */
  gradientFrom?: string;
  gradientTo?: string;
  /** Accent color for featured card border, badge, and CTA. */
  accentColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Menu Section — restaurant menu with grouped courses, dish name +         */
/*  description + price + optional dietary tags. Editorial typography.       */
/* ------------------------------------------------------------------------- */

export interface MenuSectionDish {
  name: string;
  description?: string;
  price: string;
  /** Optional dietary tags, e.g. "GF", "V", "Spicy". */
  tags?: string[];
}

export interface MenuSectionCourse {
  title: string;
  description?: string;
  dishes: MenuSectionDish[];
}

export interface MenuSectionBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  courses: MenuSectionCourse[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Optional small footnote rendered under the menu (allergens etc.). */
  footnote?: string;
}

/* ------------------------------------------------------------------------- */
/*  Hours & Location — operating hours table + address card with optional    */
/*  Google Maps embed URL. Designed for restaurants & local services.        */
/* ------------------------------------------------------------------------- */

export interface HoursLocationDayHours {
  day: string;
  hours: string;
  /** Visually mark this row (e.g. "Today"). */
  highlight?: boolean;
}

export interface HoursLocationBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Operating hours rows. */
  hours: HoursLocationDayHours[];
  /** Business name shown above the address. */
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  /** Optional Google Maps embed src. When present a 16:9 map is rendered. */
  mapEmbedUrl?: string;
  /** Optional CTA (e.g. "Get directions"). */
  ctaText?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Before / After Gallery — paired before+after images with captions.       */
/*  Designed for local services (renovation, lawncare, cleaning, etc.).     */
/* ------------------------------------------------------------------------- */

export interface BeforeAfterPair {
  beforeSrc: string;
  beforeAlt: string;
  afterSrc: string;
  afterAlt: string;
  caption?: string;
}

export interface BeforeAfterGalleryBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  pairs: BeforeAfterPair[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Label for the "before" tile pill. Default "Before". */
  beforeLabel?: string;
  /** Label for the "after" tile pill. Default "After". */
  afterLabel?: string;
}

/* ------------------------------------------------------------------------- */
/*  Speaker Grid — event speakers / presenters / hosts. Photo + name +       */
/*  role + optional bio + social links. Designed for event landings.         */
/* ------------------------------------------------------------------------- */

export interface SpeakerGridSpeaker {
  name: string;
  role: string;
  /** Company / org. Optional secondary line. */
  company?: string;
  photoUrl: string;
  bio?: string;
  /** Optional social handle URL (twitter/x, linkedin). */
  socialUrl?: string;
  socialLabel?: string;
}

export interface SpeakerGridBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  speakers: SpeakerGridSpeaker[];
  /** Cards per row at md+ breakpoint. */
  columns?: 2 | 3 | 4;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Content Series — a premium full-page block for recurring content like    */
/*  podcasts, webinar series, and thought-leadership shows. Includes a hero  */
/*  for the featured/latest episode, a sortable episode library, guest/      */
/*  speaker cards, an "about the series" section, and flexible CTAs.         */
/* ------------------------------------------------------------------------- */

export interface ContentSeriesTheme {
  bg?: string;
  cardBg?: string;
  fg?: string;
  headingColor?: string;
  primary?: string;
  muted?: string;
  border?: string;
  navBg?: string;
  navBgOpacity?: number;
  navText?: string;
  displayFontFamily?: string;
  bodyFontFamily?: string;
}

export type EpisodeStatus = "upcoming" | "live" | "on-demand";

export interface ContentSeriesEpisode {
  title: string;
  guestName?: string;
  guestTitle?: string;
  guestCompany?: string;
  description: string;
  publishDate: string;
  thumbnailUrl?: string;
  ctaUrl: string;
  ctaText?: string;
  applePodcastsUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  /** Set when this episode was imported from an RSS feed; used as the merge key on re-sync. */
  rssGuid?: string;
  /** When true this episode is pinned/featured at the top of the library. */
  isFeatured?: boolean;
  /** When true this episode is pinned as the hero — overrides auto-newest behavior. */
  pinHero?: boolean;
  /** When true the episode is hidden from the public library (still editable in panel). */
  hidden?: boolean;
  /** Episode availability status. Defaults to "on-demand". */
  status?: EpisodeStatus;
}

export interface ContentSeriesHost {
  name: string;
  title: string;
  company?: string;
  photoUrl?: string;
  bio?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
}

export interface ContentSeriesCta {
  label: string;
  url: string;
  /** "primary" renders solid accent; "outline" renders bordered ghost. */
  variant?: "primary" | "outline";
}

export interface ContentSeriesNavLink {
  label: string;
  href: string;
}

export interface ContentSeriesBlockProps {
  /** "podcast" | "webinar" | "series" — drives default copy (e.g. "Listen Now" vs "Register"). */
  seriesType: "podcast" | "webinar" | "series";
  seriesTitle: string;
  seriesSubtitle?: string;
  logoUrl?: string;

  /** Sticky nav links (anchors to sections within the page). */
  navLinks?: ContentSeriesNavLink[];
  navCtaText?: string;
  navCtaUrl?: string;
  /** Optional secondary nav CTA — renders as an outline pill before the primary CTA. */
  navSecondaryCtaText?: string;
  navSecondaryCtaUrl?: string;

  /** Section visibility toggles — all default to true when absent. */
  showNav?: boolean;
  showHero?: boolean;
  showEpisodes?: boolean;
  showHosts?: boolean;
  showAbout?: boolean;
  showForm?: boolean;
  showCta?: boolean;

  /** Hero layout: "full-bleed" = immersive bg image, "half-bleed" = split text/image, "text-only" = no image. */
  heroLayout?: "full-bleed" | "half-bleed" | "text-only";
  /** Overlay opacity for full-bleed hero (0–1). Controls how much the background image shows through. */
  heroOverlayOpacity?: number;
  /** Dedicated full-bleed hero background image. When set (and heroLayout === "full-bleed"),
   *  this image is used as the immersive bg INSTEAD of the featured episode's thumbnail, and
   *  the featured episode card is hidden so the hero shows only the series title/subtitle. */
  heroBackgroundImageUrl?: string;
  /** "auto" = newest episode populates hero; "manual" = hero fields are edited independently. */
  heroSourceMode?: "auto" | "manual";
  /** Hero / featured episode section. */
  heroEyebrow?: string;
  heroImageUrl?: string;
  heroEpisodeTitle: string;
  heroEpisodeDescription?: string;
  heroGuestName?: string;
  heroGuestTitle?: string;
  heroCtaText?: string;
  heroCtaUrl?: string;

  /** Episode library. */
  episodes: ContentSeriesEpisode[];

  /** Guest / speaker spotlight cards (optional — for recurring guests or hosts). */
  hosts?: ContentSeriesHost[];

  /** About the series. */
  aboutHeadline?: string;
  aboutDescription?: string;
  aboutAudience?: string;
  aboutTopics?: string[];

  /** Flexible CTA section at the bottom. */
  ctaSectionHeadline?: string;
  ctaSectionSubheadline?: string;
  ctas?: ContentSeriesCta[];

  /** Guest application / contact form — matches the event-page FormStep pattern.
   *  The form opens in a modal triggered by a button in the form section. */
  formEyebrow?: string;
  formHeadline?: string;
  formSubheadline?: string;
  formSteps?: import("./common").FormStep[];
  formSubmitUrl?: string;
  formSuccessMessage?: string;
  /** Label of the button that opens the application form modal. */
  formButtonLabel?: string;

  /** Optional Google Sheets-backed recording-slot picker rendered as the
   *  FINAL step of the guest application form. When `availabilitySheetId` is
   *  set, the form fetches /api/lp/podcast-availability?sheetId=…&tab=… and
   *  shows date cards that expand into 1-hour slot buttons. The chosen slot
   *  is saved on the lead under field id `preferred_slot`. */
  availabilitySheetId?: string;
  /** Sheet tab to scan (defaults to "Scheduled"). */
  availabilitySheetTab?: string;
  /** Helper copy shown above the date cards. */
  availabilityHelperText?: string;
  /** Step title (small uppercase label above the picker). */
  availabilityStepTitle?: string;

  /** Inline email subscribe input rendered in the sticky nav (and optionally
   *  in the bottom CTA section when subscribeShowInCta is true). Submitting
   *  the inline input opens the dedicated Subscribe modal below with the
   *  email pre-filled. */
  subscribeEnabled?: boolean;
  subscribePlaceholder?: string;
  subscribeButtonLabel?: string;
  subscribeSuccessMessage?: string;
  /** Where the subscribe email is POSTed. Falls back to subscribeFormSubmitUrl,
   *  then formSubmitUrl, then /api/lp/leads. */
  subscribeSubmitUrl?: string;
  /** When true, also render the inline subscribe input inside the bottom CTA
   *  section (in addition to the nav). Defaults to false — the input lives in
   *  the nav by default. */
  subscribeShowInCta?: boolean;

  /** Subscribe modal — separate from the guest application form so it can have
   *  its own headline/subheadline/fields (typically just email + name). When
   *  subscribeFormSteps is empty/missing, the modal falls back to a single
   *  email-only step. */
  subscribeFormEyebrow?: string;
  subscribeFormHeadline?: string;
  subscribeFormSubheadline?: string;
  subscribeFormSteps?: import("./common").FormStep[];
  /** Optional custom POST endpoint for the subscribe modal. Falls back to
   *  subscribeSubmitUrl chain. */
  subscribeFormSubmitUrl?: string;

  /** Optional RSS feed URL. When set, the panel "Sync from RSS" button can pull episodes;
   *  if rssAutoSync is also true, the published page also fetches the feed on render and
   *  merges newly published items into the displayed list (manual edits win on conflicts). */
  rssFeedUrl?: string;
  /** When true, the published landing page calls /api/lp/rss/parse on mount and merges any
   *  new episodes from the feed into the displayed list. Manual episodes always remain. */
  rssAutoSync?: boolean;
  /** ISO timestamp of the last manual sync via the panel — informational only. */
  rssLastSyncedAt?: string;

  /** Visual theme overrides. When absent, colors/fonts fall back to tenant brand settings. */
  theme?: ContentSeriesTheme;
}

/* ------------------------------------------------------------------------- */
/*  Inside Dandy block family — `id-*`. Cinematic teal/citron Dandy lab     */
/*  page broken into reusable text/image-editable sections.                 */
/* ------------------------------------------------------------------------- */

/** Action mode supported by Inside Dandy CTA buttons. Mirrors CtaActionMode
 *  but adds "video-modal" so the secondary "Watch the film" CTA can open an
 *  in-page video overlay instead of a form. */
export type IdCtaAction =
  | "url"
  | "chilipiper"
  | "modal-form"
  | "modal-chilipiper"
  | "video-modal";

export interface IdHeroBlockProps extends CtaModalConfig {
  eyebrow?: string;
  /** First headline line (plain text). */
  line1?: string;
  /** Second headline line. */
  line2?: string;
  /** Third headline line. Wrap accent words in <em>…</em>. */
  line3?: string;
  lead?: string;
  cta1Text?: string;
  cta1Url?: string;
  cta1Action?: IdCtaAction;
  cta1ChilipiperUrl?: string;
  cta1VideoUrl?: string;
  cta2Text?: string;
  cta2Url?: string;
  cta2Action?: IdCtaAction;
  cta2ChilipiperUrl?: string;
  cta2VideoUrl?: string;
  bgImage?: string;
  /** Brightness multiplier applied to the background image filter.
   *  1.0 = original. Range 0.3–1.5. Defaults to 0.88 when unset. */
  bgBrightness?: number;
  /** Horizontal alignment of the hero content. Defaults to "center". */
  align?: "center" | "left";
  /** Multiplier applied to the headline font-size, 0.5..1.5. Defaults to 1.
   *  Use this to shrink the headline so long words don't get clipped. */
  headlineScale?: number;
  /** Enable a soft gradient fade at the top of the hero so the section
   *  blends into the page or app chrome above it. Defaults to false. */
  fadeTop?: boolean;
  /** Color the top fade resolves into. Defaults to "#000000". Use the
   *  background color of the section above (or "transparent") to blend
   *  seamlessly. */
  fadeTopColor?: string;
  /** Height of the top fade in px. 40–400 reads well. Defaults to 160. */
  fadeTopHeight?: number;
  /** Enable a soft gradient fade at the bottom of the hero so the section
   *  blends into the block below it. Defaults to false. */
  fadeBottom?: boolean;
  /** Color the bottom fade resolves into. Defaults to "#000000". Use the
   *  background color of the section below (or "transparent") to blend
   *  seamlessly. */
  fadeBottomColor?: string;
  /** Height of the bottom fade in px. 40–400 reads well. Defaults to 200. */
  fadeBottomHeight?: number;
  /** Show a small pulsing citron dot before the eyebrow text — a live
   *  status microdetail (Linear/Vercel style). Defaults to false. */
  eyebrowLive?: boolean;
  /** Prepend a small ▶ play glyph to the ghost (cta2) button so it reads
   *  as a video trigger instead of a plain link. Defaults to false. */
  playGlyph?: boolean;
  /** Override the text color on the primary (cta1) button. Use a dark
   *  brand color like "#001814" on a citron fill for a more restrained,
   *  premium look (vs. the default near-black). */
  primaryCtaTextColor?: string;
  /** Visual theme applied to the in-page modal opened by either CTA when
   *  it's configured as "modal-form" / "modal-chilipiper". "dark" matches
   *  dark cinematic templates (Inside Dandy) so the outer modal shell
   *  blends with the inner form card. Defaults to "light" so existing
   *  usages on other templates are unchanged. */
  modalTheme?: "light" | "dark";
}

export interface IdMarqueeBlockProps {
  /** List of strings shown in the scrolling marquee. Wrap accent words in <em>…</em>. */
  items: string[];
  /** Animation duration in seconds (one full loop). Defaults to 40. */
  durationSec?: number;
}

export interface IdIntroBlockProps {
  eyebrow?: string;
  /** Big manifesto statement. Wrap accent words in <em>…</em>. */
  statement: string;
  /** Per-letter scroll-driven light-up animation. Defaults to true. When
   *  false, the statement renders fully lit with no animation. */
  letterReveal?: boolean;
  /** Speed multiplier for the letter-by-letter reveal. 1.0 = default,
   *  values > 1 light letters faster (less scroll needed), values < 1
   *  slow it down. Clamped to [0.25, 4]. Defaults to 1. */
  letterRevealSpeed?: number;
  /** When true, removes the section's bottom padding so the block ends
   *  flush with the bottom of its text. Useful for visually merging
   *  this intro with the block immediately below (e.g. a parallax hero
   *  sharing the same dark teal background). Defaults to false. */
  flushBottom?: boolean;
}

export interface IdCinemaPillar {
  number: string;
  label: string;
  headline: string;
  body: string;
  /** Decorative SVG/CSS art kit. One of: scan | design | rail | bars | video. */
  art: string;
  /** When `art` is "video", the URL of the looping background clip
   *  (mp4/webm). Plays muted + autoplays + loops + playsinline so it works
   *  on iOS without a user gesture. Ignored for other art types. */
  videoSrc?: string;
  /** CSS object-position for the video (e.g. "center", "top", "30% 20%").
   *  Defaults to "center". */
  videoPosition?: string;
}

export interface IdCinemaPillarsBlockProps {
  pillars: IdCinemaPillar[];
  /** Scroll length each pillar is held on-screen, in viewport heights.
   *  Defaults to 1.5. Higher values = each step lingers longer on scroll. */
  pillarHoldVh?: number;
  /** When true (default), pillars use the cinematic sticky/stacked scroll
   *  effect where each step holds the viewport. When false, pillars render
   *  as plain stacked sections that scroll normally. */
  pillarStackedScroll?: boolean;
}

export interface IdShowcaseFrame {
  imageUrl: string;
  label: string;
  headline: string;
  where: string;
  /** CSS background-position for the frame image (e.g. "center", "top",
   *  "bottom right", "30% 20%"). Defaults to "center". Use this when the
   *  important part of the photo is being cropped out. */
  imagePosition?: string;
}

export interface IdParallaxShowcaseBlockProps {
  eyebrow?: string;
  headline: string;
  blurb?: string;
  frames: IdShowcaseFrame[];
  /** Strength of the on-enter parallax zoom, 0..1. Defaults to 0.5.
   *  0 = no zoom, 1 = strong zoom (scale 1.16 → 1). */
  parallaxStrength?: number;
  /** Cut the section's bottom padding to 0 so the next block (e.g. a
   *  video showcase on the same dark background) reads as a visual
   *  continuation rather than a separate section. */
  flushBottom?: boolean;
  /** Overlay each frame with a spatial-computing-style HUD: four
   *  citron L-brackets in the corners and a center reticle with a
   *  crosshair. Mirrors the look of an Apple Vision Pro target.
   *  Defaults to true. */
  spatialOverlay?: boolean;
  /** Opacity of the spatial overlay (0..1). Defaults to 1. */
  spatialOverlayOpacity?: number;
}

/** A single field inside an Inside Dandy form block. */
export interface IdFormField {
  /** Form field name (becomes the POST key). Kebab/snake recommended. */
  name: string;
  /** Visible label above the input. */
  label: string;
  /** Input type. `textarea` and `select` render their specific controls. */
  type: "text" | "email" | "tel" | "url" | "textarea" | "select";
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Make the field span the full width of the two-column grid. */
  fullWidth?: boolean;
  /** Rows for textarea. Defaults to 4. */
  rows?: number;
  /** Options for `select`. */
  options?: { label: string; value?: string }[];
}

/** Optional left-column meta item (e.g. "RESPONSE TIME — Under 1 business day"). */
export interface IdFormMetaItem {
  label: string;
  /** HTML allowed — use <em> for accent color. */
  value: string;
}

/** A premium, Inside-Dandy-themed lead/contact form block with full color
 *  control so it can fit any page on the site, light or dark. */
export interface IdFormBlockProps {
  eyebrow?: string;
  /** HTML allowed — use <em> for the accent-colored phrase. */
  headline?: string;
  /** HTML allowed. */
  subheadline?: string;
  /** Optional small left-column meta items (response time, locations, etc). */
  metaItems?: IdFormMetaItem[];
  /** Form fields (rendered in a 2-column grid on desktop). */
  fields: IdFormField[];
  /** Submit button label. Defaults to "Submit". */
  submitText?: string;
  /** Label shown while the form is submitting. Defaults to "Sending…". */
  submittingText?: string;
  /** Optional URL to POST the form data as JSON. Leave blank for demo mode
   *  (just shows success state). */
  submitUrl?: string;
  /** Success state headline. */
  successHeadline?: string;
  /** Success state body (HTML allowed). */
  successBody?: string;
  /** Fine print under the submit button (HTML allowed). */
  legal?: string;
  // ─── color overrides (all optional, default to the Inside Dandy palette) ──
  backgroundColor?: string;
  accent?: string;
  headlineColor?: string;
  subheadlineColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  labelColor?: string;
  inputBg?: string;
  inputBorder?: string;
  inputText?: string;
  buttonBg?: string;
  buttonText?: string;
}

export interface IdSystemFlowStation {
  /** Timestamp shown above the label, e.g. "00:24". Free text so it can be
   *  used for cycle counts or step counts too. */
  timestamp?: string;
  /** Italic serif step name, e.g. "Design". */
  label: string;
  /** Tiny uppercase tag under the label, e.g. "AI STUDIO". */
  tag?: string;
  /** Tiny uppercase eyebrow above the bottom block title, e.g. "STUDIO". */
  category?: string;
  /** Bottom-block title with optional <em> for the lime accent, e.g.
   *  "AI <em>Design</em>". */
  title: string;
  /** One-line description shown under the bottom-block title. */
  description?: string;
  /** Optional case-id chip shown on the rail when this station is active,
   *  e.g. "CASE № D-4472 · CROWN #19". Only rendered on the active
   *  station; leave blank to omit. */
  activeCaseId?: string;
}

export interface IdSystemFlowBlockProps {
  /** Top-left eyebrow shown with a citron dot, e.g. "SECTION 01 · THE SYSTEM". */
  eyebrow?: string;
  /** Two-line headline. Wrap accent words in <em>…</em> for italic citron. */
  headline: string;
  /** Right-side metric label above the value, e.g. "STATIONS". */
  metricLabel?: string;
  /** Right-side metric value, e.g. "5 · end to end". <em> supported. */
  metricValue?: string;
  /** The stations on the rail. 3–6 read best; the circles auto-number 01–N. */
  stations: IdSystemFlowStation[];
  /** Zero-based index of the active station — filled citron + case chip. */
  activeIndex?: number;
  /** Footer pill on the bottom-left, e.g. "ONE SYSTEM". */
  footerBadge?: string;
  /** Footer paragraph, <em> supported. */
  footerBody?: string;
  /** Footer right metric label, e.g. "MEDIAN TAT". */
  footerMetricLabel?: string;
  /** Footer right metric value (italic), e.g. "3.2 days". */
  footerMetricValue?: string;
  /** Footer CTA text, e.g. "Tour the system". */
  ctaText?: string;
  /** Footer CTA href. */
  ctaUrl?: string;
  /** Top padding in px. Overrides the responsive default (~96–140px). */
  paddingTop?: number;
  /** Bottom padding in px. Overrides the responsive default (~96–140px). */
  paddingBottom?: number;
  /** Horizontal (left & right) padding in px. Overrides the responsive
   *  default (~24–56px). */
  paddingX?: number;
  /** Max content width in px. Caps how wide the rail + grid stretch
   *  inside the section. Defaults to 1280. Try 1440–1680 for a wider
   *  feel on big screens. */
  maxWidth?: number;
  /** Hide the eyebrow + headline + right-side metric and start the section
   *  directly at the timestamp/rail. Useful when the previous block
   *  already provides the title. */
  hideHeader?: boolean;
  /** Hide the radial citron wash at the top so the section fades into a
   *  matching dark block above it seamlessly. */
  hideHeaderGlow?: boolean;
}

export interface IdSpotlightResult {
  /** Tone color for the leading dot. One of: alert | warn | ok | info. */
  tone: string;
  title: string;
  body: string;
  /** Optional action link shown beneath body, e.g. "Review in Undercut tool". */
  actionText?: string;
  actionUrl?: string;
}

export interface IdSpotlightStep {
  /** Short uppercase label, e.g. "ALERTS". */
  label: string;
}

export interface IdSpotlightBlockProps {
  eyebrow?: string;
  /** Use <em> tags for the lime-accent words. */
  headline: string;
  body?: string;
  /** Primary background asset. */
  videoSrc?: string;
  /** Static fallback poster (also shown if no videoSrc). */
  posterUrl?: string;
  /** CSS object-position for video/poster. Defaults to "center". */
  videoPosition?: string;
  /** Floating overlay card title (e.g. "AI Scan Review"). */
  cardTitle?: string;
  /** Optional second-line label inside the card (e.g. "Results"). */
  cardSubtitle?: string;
  /** List items inside the floating card. */
  results: IdSpotlightResult[];
  /** Right-edge vertical stepper labels. The first one renders active. */
  steps: IdSpotlightStep[];
  /** Index (0-based) of the step that should render highlighted. */
  activeStep?: number;
}

export interface IdStatItem {
  value: string;
  label: string;
  description: string;
}

export interface IdStatsBlockProps {
  stats: IdStatItem[];
}

export interface IdInvitationMeta {
  heading: string;
  text: string;
}

export interface IdGridCard {
  /** Small uppercase eyebrow line, e.g. "IN PERSON · PROVO". */
  eyebrow?: string;
  /** Card headline. Wrap accent words in <em>…</em> for citron highlight. */
  headline: string;
  /** Body paragraph. */
  body?: string;
  /** Optional CTA link label. */
  ctaText?: string;
  /** Optional CTA href. */
  ctaUrl?: string;
  /** Optional availability / status chip shown next to the eyebrow, e.g.
   *  "Available now", "By request", "2 dates · 24 seats". Telegraphs
   *  exclusivity / scarcity. Defaults to none. */
  chip?: string;
}

export interface IdGridBlockProps {
  eyebrow?: string;
  /** Centered heading. Wrap accent words in <em>…</em>. */
  headline: string;
  /** Centered subheading paragraph. */
  subheading?: string;
  /** Exactly four cards rendered in a 2x2 grid (numbered 01–04). */
  cards: IdGridCard[];
  /** When true, removes the block's bottom padding so the next block sits
   *  flush against the grid's bottom border. Defaults to false. */
  flushBottom?: boolean;
}

export interface IdInvitationBlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline: string;
  blurb?: string;
  cta1Text?: string;
  cta1Url?: string;
  cta1Action?: IdCtaAction;
  cta1ChilipiperUrl?: string;
  cta1VideoUrl?: string;
  cta2Text?: string;
  cta2Url?: string;
  cta2Action?: IdCtaAction;
  cta2ChilipiperUrl?: string;
  cta2VideoUrl?: string;
  meta?: IdInvitationMeta[];
}

export interface IdReservationPassMeta {
  /** Tiny uppercase label, e.g. "DATE". */
  label: string;
  /** Display value, set in serif, e.g. "July 14 – 16, 2026". */
  value: string;
}

export interface IdReservationPassBlockProps extends CtaModalConfig {
  /** Top-left ordinal mark set in serif italic, e.g. "№ 001". */
  ordinal?: string;
  /** Top-right status line, rendered with a pulsing mint dot. */
  status?: string;
  /** Eyebrow tag above the headline. */
  eyebrow?: string;
  /** Display headline. Wrap accent words in <em>…</em> for italic citron. */
  headline: string;
  /** Lede / body paragraph below the headline. */
  body?: string;
  /** Optional "12 of 24 seats remaining" pill — leave blank to hide. */
  seatsRemainingText?: string;
  /** Top label printed on the pass card, e.g. "DANDY · INSIDE PASS". */
  passLabel?: string;
  /** Pass serial line shown right-aligned in the top of the card. */
  passSerial?: string;
  /** Three meta rows printed on the pass (date · location · duration). */
  meta: IdReservationPassMeta[];
  /** Primary CTA on the pass. */
  primaryCtaText: string;
  primaryCtaUrl?: string;
  primaryCtaAction?: IdCtaAction;
  /** Used when primaryCtaAction === "chilipiper". */
  chilipiperUrl?: string;
  /** Used when primaryCtaAction === "video-modal" — opens a video lightbox. */
  videoUrl?: string;
  /** Optional secondary ghost link rendered alongside the primary CTA. */
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  secondaryCtaAction?: IdCtaAction;
  /** Used when secondaryCtaAction === "chilipiper". */
  secondaryChilipiperUrl?: string;
  /** Used when secondaryCtaAction === "video-modal". */
  secondaryVideoUrl?: string;
  /** Optional background photo behind the orbs (kept low-opacity). */
  backgroundImageUrl?: string;
  /** Opacity of the background photo, 0–1. Defaults to 0.16 so the photo
   *  sits quietly behind the cinematic orbs/grid; raise it to make the
   *  photo more prominent or lower it to fade it further. */
  backgroundImageOpacity?: number;
  /** Edge fade gradient direction. Adds a top and/or bottom linear-gradient
   *  overlay that resolves to a solid color, so the block blends invisibly
   *  into the section above/below. Mirrors the parallax-hero edge fade. */
  edgeFade?: "none" | "top" | "bottom" | "both";
  /** Color the edge fade resolves to. Pick the bg color of the section
   *  above/below for a seamless blend. Defaults to the pass's dark teal. */
  edgeFadeColor?: string;
  /** Size of the fade band as a percentage of section height (0–60).
   *  Defaults to 25 to match the parallax hero. */
  edgeFadeSize?: number;
  /** Tiny tertiary footer line, e.g. ["PRESS", "INVESTORS", "BOOTH 412"]. */
  footerNotes?: string[];
  /** Accent color override (defaults to brand citron). */
  accentColor?: string;
}
