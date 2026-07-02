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
  ctaColor?: string;
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
  /**
   * `image` is optional per-item logo/photo imagery surfaced by microsite
   * generation. When present the renderer shows it in place of the stat value
   * (logo-style item); when absent the numeric value is shown as before.
   */
  items: Array<{ value: string; label: string; image?: string; imageAlt?: string }>;
  bgColor?: string;
  statColor?: string;
  labelColor?: string;
  borderColor?: string;
  countUpEnabled?: boolean;
  /**
   * Global display height for per-item images (logo/photo trust items). Applies
   * to every image in the bar so the row stays visually even. Defaults to "md"
   * (the original `h-12 md:h-14` band). Larger sizes are useful for partner
   * logos or product shots that read better at scale.
   */
  imageSize?: "sm" | "md" | "lg" | "xl";
  /**
   * How each item's image is shown: a compact inline "icon" (default, sized by
   * {@link imageSize}) or a larger, centered "logo" treatment so real company
   * logos read at a legible size. Mirrors the Case Study — Logo Results Row
   * block's display toggle. Absent === "icon" so existing pages are unchanged.
   */
  displayMode?: "icon" | "logo";
}

export interface PasSectionBlockProps {
  headline: string;
  body: string;
  bullets: string[];
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Optional small-caps kicker above the headline. Empty hides it. */
  eyebrow?: string;
  /** Optional closing "solve" line rendered in a visually distinct
   *  accent-tinted panel after the pain points. Empty hides the panel. */
  solutionText?: string;
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
  /**
   * Block-level opt-in for per-card photos. Defaults to icon-only (false /
   * undefined): the server only fills `items[].image` when this is explicitly
   * `true`. Set true for visual / consumer brands or concrete, showable
   * benefits; leave unset for clean B2B / SaaS / abstract benefits where icons
   * read sharper. Applies to the whole block (all cards photo, or all icon-only).
   */
  useItemPhotos?: boolean;
  /**
   * `image` is optional per-item photo imagery surfaced by microsite
   * generation. When present the card shows it (with the icon overlaid as a
   * badge); when absent the lucide icon is shown on its own as before.
   */
  items: Array<{ icon: string; title: string; description: string; image?: string; imageAlt?: string }>;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  hoverLift?: boolean;
}

export interface TestimonialBlockProps {
  quote: string;
  author: string;
  role: string;
  practiceName: string;
  /** Optional section background preset. When unset the block keeps its
   *  historical near-white tint (#F0F7F4); when set it resolves through
   *  getBgStyle so the deterministic background-rhythm passes can vary it. */
  backgroundStyle?: BackgroundStyle;
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
  grayscale?: boolean;
  revealColorOnHover?: boolean;
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

/* ------------------------------------------------------------------------- */
/*  Media blocks — video showcase sections graduated from mockup-sandbox.     */
/*  FeatureReel: poster + play → video, with feature captions. LoopingShow-   */
/*  case: autoplay/muted/looping background video with overlaid copy. Video   */
/*  URLs are user-supplied (never auto-filled); posters fill from the library. */
/* ------------------------------------------------------------------------- */

export interface MediaFeatureReelFeature {
  /** Lucide icon name (e.g. "Sparkles", "Zap", "Shield"). */
  icon: string;
  title: string;
  desc: string;
}

export interface MediaFeatureReelBlockProps {
  backgroundStyle?: BackgroundStyle;
  heading: string;
  /** Video shown in the framed player; the poster image is shown until play. */
  videoUrl: string;
  /** Poster / preview image for the video card. */
  posterUrl: string;
  features: MediaFeatureReelFeature[];
  /** Optional label shown in the player's glass chrome bar (e.g. a film title
   *  or "yourproduct.com/reel"). Unset → the bar shows no text. Additive —
   *  June 2026 premium redesign. */
  frameLabel?: string;
  /** Optional primary CTA. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Optional secondary CTA link. */
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/* ====================================================================== *
 *  Graduated "value pillars" + "feature" section blocks (Task #1436).
 *  Nine sibling blocks that share ONE contract via SectionBlockBase so they
 *  read consistently and edit the same way. Rendering helpers live in
 *  src/blocks/shared/section-kit.tsx.
 * ====================================================================== */

/** Content alignment for a graduated section block. Default "center". */
export type SectionAlign = "left" | "center" | "right";

/** Corner-radius scale for cards / icon tiles / images. Maps to rounded-*. */
export type SectionRadius = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/**
 * Icon / image size for the icon-led section blocks. Unset keeps each block's
 * built-in default; "sm"/"md"/"lg" scale the per-item visual up or down.
 */
export type SectionMediaSize = "sm" | "md" | "lg";

/**
 * Desktop column count for the FeatureCardGrid. Tablet is always two-up and
 * mobile one-up; this only picks the desktop (lg) columns. Unset = four-up.
 */
export type SectionGridColumns = 3 | 4;

/** Button render style for a section CTA: filled / outline / text link. */
export type SectionCtaVariant = "primary" | "secondary" | "link";

/**
 * One icon-or-image led item shared by every graduated section block.
 * `icon` holds EITHER a Lucide icon name (e.g. "Sparkles") OR an image URL /
 * data-URI. The AI generator only ever writes Lucide names; a human author may
 * pick an image, which renders LARGER than an icon.
 */
export interface SectionFeatureItem {
  /** Lucide icon name OR image URL (dual field). */
  icon?: string;
  /**
   * Optional PHOTO for the image-led section blocks (color-block-cards,
   * headline-badge, photo-cards, card-grid, big-features). When present the
   * block renders this photo; the `icon` still drives the Lucide glyph shown
   * alongside it (e.g. the icon tile / colored badge). When absent the block
   * degrades to a premium accent-tinted panel with the icon — so AI-generated
   * pages (icon-led, never an image URL) never show an empty image box.
   */
  image?: string;
  title?: string;
  description?: string;
  /** Small secondary label shown under a feature's CTA (big-features). */
  note?: string;
  /**
   * Optional per-card "Learn more →" link label. Shown on the carded section
   * blocks that carried a per-card link in their mockups (color-block-cards,
   * outlined-cards, divided-columns, card-columns, photo-cards). Empty = no link.
   */
  linkLabel?: string;
  /** Optional per-card link URL. When set the label renders as a real <a>. */
  linkUrl?: string;
}

/**
 * Shared base for the nine graduated section blocks. Carries the common
 * header, alignment, color, radius, items, and CTA contract so the blocks stay
 * consistent. The CTA keys are the canonical ones BlockRenderer uses for
 * page-CTA inheritance (ctaText / ctaUrl / ctaAction / chilipiperUrl).
 */
export interface SectionBlockBase extends CtaModalConfig {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  /** Content alignment. Defaults to "center". */
  align?: SectionAlign;
  /** Background preset (white / light / muted / dark / brand / gradient). */
  backgroundStyle?: BackgroundStyle;
  /** Legacy custom background hex, used when backgroundStyle is unset. */
  bgColor?: string;
  /** Heading + per-card title ink (shared type style). */
  headingColor?: string;
  /** Subhead + per-card body ink. */
  bodyColor?: string;
  /** Card surface color for carded variants. */
  cardBgColor?: string;
  /** Accent color for icons + eyebrow. Defaults to the brand accent. */
  accentColor?: string;
  /** Corner radius for cards / icon tiles / images. Defaults to "2xl". */
  cardRadius?: SectionRadius;
  /**
   * Icon / image size for the icon-led blocks (scales the per-item icon
   * visual). Unset keeps the block default.
   */
  mediaSize?: SectionMediaSize;
  items: SectionFeatureItem[];

  /** Primary CTA. Inherits the page CTA when left at its canonical defaults. */
  ctaText?: string;
  ctaUrl?: string;
  ctaAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  chilipiperUrl?: string;
  /** Primary button style: Button / Outline / Link. Defaults to "primary". */
  ctaVariant?: SectionCtaVariant;

  /** Optional secondary CTA. */
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryAction?: "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  secondaryChilipiperUrl?: string;
  /** Secondary button style. Defaults to "secondary" (outline). */
  ctaSecondaryVariant?: SectionCtaVariant;
}

export type ValuePillarsIconTrioBlockProps = SectionBlockBase;

export interface ValuePillarsOutlinedCardsBlockProps extends SectionBlockBase {
  /** Card outline color. Defaults to a brand-tinted hairline. Set "" for brand default. */
  cardBorderColor?: string;
  /** Card outline width in px (0 = no outline). Defaults to 1. */
  cardBorderWidth?: number;
}

export type ValuePillarsColorBlockCardsBlockProps = SectionBlockBase;

export interface ValuePillarsDividedColumnsBlockProps extends SectionBlockBase {
  /** Divider line color. Defaults to a brand-tinted hairline. Set "" for brand default. */
  dividerColor?: string;
  /** Divider line width in px (0 = no divider). Defaults to 1. */
  dividerWidth?: number;
}

export type ValuePillarsHeadlineBadgeBlockProps = SectionBlockBase;
export type ValuePillarsCardColumnsBlockProps = SectionBlockBase;
export type FeaturePhotoCardsBlockProps = SectionBlockBase;

export interface FeatureCardGridBlockProps extends SectionBlockBase {
  /**
   * Desktop column count (4 or 3). Tablet is always two-up and mobile one-up.
   * Unset = four-up.
   */
  columns?: SectionGridColumns;
}

export interface FeatureBigFeaturesBlockProps extends SectionBlockBase {
  /** "blended" = screenshots blend into the section (no card chrome);
   *  "card" = each feature sits in a contained, shadowed card. Default "card". */
  imageTreatment?: "blended" | "card";
  /**
   * Which side the photo sits on within each big-feature row.
   *  - "alternate" (default): sides flip down the stack (image right, then
   *    left, then right …) — the historical zig-zag behavior.
   *  - "left" / "right": the image is pinned to that side on EVERY card so the
   *    layout reads consistently instead of alternating.
   */
  imageSide?: "alternate" | "left" | "right";
}

/**
 * Canonical CTA defaults for every graduated section block. Seeds the keys the
 * BlockRenderer page-CTA shim reads (label / url / action / chilipiper) so a
 * section inherits the page CTA by default, plus the style + secondary knobs so
 * the shared panel edits every block identically. (Modal keys are intentionally
 * NOT seeded — JSON.stringify drops `undefined` and no block in the registry
 * seeds them; modal page CTAs flow through the resolver, matching convention.)
 */
export function sectionCtaDefaults(): Pick<
  SectionBlockBase,
  | "ctaText"
  | "ctaUrl"
  | "ctaAction"
  | "chilipiperUrl"
  | "ctaVariant"
  | "ctaSecondaryText"
  | "ctaSecondaryUrl"
  | "ctaSecondaryAction"
  | "secondaryChilipiperUrl"
  | "ctaSecondaryVariant"
> {
  return {
    ctaText: "Get started",
    ctaUrl: "#",
    ctaAction: "url",
    chilipiperUrl: "",
    ctaVariant: "primary",
    ctaSecondaryText: "",
    ctaSecondaryUrl: "",
    ctaSecondaryAction: "url",
    secondaryChilipiperUrl: "",
    ctaSecondaryVariant: "secondary",
  };
}

export interface MediaLoopingShowcaseBlockProps {
  backgroundStyle?: BackgroundStyle;
  heading: string;
  subheading?: string;
  /** Autoplaying, muted, looping background video. */
  videoUrl: string;
  /** Poster / fallback image shown before the video loads. */
  posterUrl: string;
  /** Optional primary CTA. */
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Muted/secondary text color for the subheading. */
  mutedColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single video card in a media-thumbnail-grid. Each card has its own video
 *  (user-supplied, never auto-filled) and a poster image (library auto-filled). */
export interface MediaThumbnailGridItem {
  id: string;
  /** Video opened in the lightbox when the card is clicked. */
  videoUrl: string;
  /** Poster / thumbnail image shown in the card. */
  posterUrl: string;
  title: string;
  /** Duration badge text (e.g. "4:12"). */
  duration: string;
}

export interface MediaThumbnailGridBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  /** Grid of video thumbnail cards. */
  videos: MediaThumbnailGridItem[];
  /** Optional CTA link. */
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

export interface MediaVideoSplitBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  description?: string;
  /** Checklist of feature bullet strings. */
  features?: string[];
  /** Video shown beside the copy; the poster image is shown until play. */
  videoUrl: string;
  /** Poster / preview image for the video. */
  posterUrl: string;
  /** Optional primary CTA. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Optional secondary CTA link. */
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  /** Which side the video sits on at desktop widths. Default "right"
   *  (matches the original layout). Additive — June 2026 premium redesign. */
  mediaSide?: "left" | "right";
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
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

export interface ResourceLinkListGroup {
  title: string;
  links: Array<{ label: string; url: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface ResourceLinkListBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  groups: ResourceLinkListGroup[];
  columns?: 2 | 3 | 4;
  backgroundStyle?: BackgroundStyle;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
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
  /** Override for the primary CTA button background (the filled header button
   *  and the main hero button). Defaults to the brand-derived CTA color when
   *  unset. The label color is auto-derived for legibility against the fill. */
  ctaButtonColor?: string;
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

export interface ParallaxImageHeroBlockProps extends CtaModalConfig {
  imageUrl: string;
  /** Optional looping background video (mp4/webm). When set, replaces the
   *  parallax image with a parallax-translated <video>. The image still
   *  acts as a poster + reduced-motion fallback. */
  videoUrl?: string;
  videoAutoplay?: boolean;
  /** Optional top-row eyebrow (top-left). Hidden by default — only renders
   *  when set, or in the editor. Previously always shown. */
  eyebrow?: string;
  /** Optional top-row reference label (top-right). Hidden by default — only
   *  renders when set, or in the editor. Previously always shown. */
  referenceLabel?: string;
  headline: string;
  /** Optional supporting line rendered below the headline. On-brand body
   *  (Inter). Only renders when set (or in the editor). */
  subheadline?: string;
  headlineAccentWord?: string;
  accentColor?: string;
  ctaText: string;
  ctaUrl: string;
  /** Direct CTA action mode. "link" (default) just opens ctaUrl; "chilipiper"
   *  hands off to the viewer's Chili Piper opener; "modal-form" /
   *  "modal-chilipiper" open the shared EmailCaptureModal. Mirrors the
   *  Heartland hero's primaryCtaMode. */
  ctaMode?: CtaMode;
  /** CTA presentation style.
   *  - "link" (default / legacy): underlined arrow text link — preserves
   *    existing placed pages.
   *  - "inline": text link with a trailing arrow, no underline (a cleaner
   *    inline affordance). Renders identically to "link"'s inline arrow.
   *  - "buttons": a filled pill button.
   *  - "email-capture": an inline pill-shaped email field with a submit
   *    button (mirrors the Heartland hero). */
  ctaStyle?: "link" | "inline" | "buttons" | "email-capture";
  /** Placeholder for the email-capture input. Defaults to "Email address". */
  emailCapturePlaceholder?: string;
  /** Submit button label for the email-capture form. Defaults to the CTA text. */
  emailCaptureButtonText?: string;
  /** Override for the pill / email-capture button background. Defaults to accent. */
  ctaButtonColor?: string;
  /** Override for the pill / email-capture button text color. Auto-derived for legibility. */
  ctaButtonTextColor?: string;
  /** What happens when the email-capture pill is submitted (ctaStyle === "email-capture").
   *  - "navigate" (default): redirect to ctaUrl with ?email=…
   *  - "modal-form": open the shared modal with a customizable form
   *  - "modal-chilipiper": open the shared modal with a Chili Piper iframe */
  submitMode?: "navigate" | "modal-form" | "modal-chilipiper";
  /** Optional bottom-right brand mark (text). Hidden by default — only
   *  renders when set, or in the editor. Never a hardcoded brand wordmark. */
  brandMark?: string;
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
  /** Optional section background preset. When unset the block keeps its
   *  historical near-white tint (#FDFCFA); when set it resolves through
   *  getBgStyle so the deterministic background-rhythm passes can vary it. */
  backgroundStyle?: BackgroundStyle;
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
  backgroundStyle?: BackgroundStyle;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

export interface DandyHeroV7S3TrustItem {
  value: string;
  label: string;
}

export interface DandyHeroV7S3BlockProps extends CtaModalConfig {
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
  /**
   * What happens when the CTA is clicked.
   *  - "inline-form" (default): renders the existing inline email pill + Chili Piper after submit
   *  - "url"             → navigates to ctaUrl
   *  - "chilipiper"      → opens Chili Piper iframe popup with chilipiperUrl
   *  - "modal-form"      → opens EmailCaptureModal in form mode (uses modal* config)
   *  - "modal-chilipiper"→ opens EmailCaptureModal in chilipiper mode (uses modalChilipiperUrl)
   */
  ctaAction?: "inline-form" | "url" | "chilipiper" | "modal-form" | "modal-chilipiper";
  /** Destination URL when ctaAction === "url". */
  ctaUrl?: string;
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
  /** Background preset (white / dark / brand / gradient / …). When set it takes
   *  precedence over the legacy `bgColor` via resolveSectionSurface. */
  backgroundStyle?: BackgroundStyle;
  /** Optional text color override for the left copy. Falls back to a
   *  surface-derived heading color when unset. */
  textColor?: string;
  /** Optional accent color override (eyebrow + bullet checkmarks). Falls back to
   *  the brand accent/primary when unset. */
  accentColor?: string;
  /** Optional heading font override. Falls back to the brand display font. */
  headlineFont?: string;
  /** Optional body font override. Falls back to the brand body font. */
  bodyFont?: string;

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
  ctaSecondaryAction?: HeroCtaActionMode;
  secondaryChilipiperUrl?: string;
  /** Used when ctaSecondaryAction === "video-modal". */
  secondaryVideoUrl?: string;
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
  /** Show the gradient fade painted over the bottom of each image-mode
   *  slide (keeps captions readable). Default true; set false for clean,
   *  un-tinted photos. Read as `!== false` so legacy rows stay ON. */
  showScrim?: boolean;
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
   *                       other half. Use when the image is too busy.
   *  - "overlay-card"   : full-bleed image with a floating solid card on one
   *                       side holding an eyebrow, headline, subheadline and a
   *                       "learn more" arrow link pinned to the bottom;
   *                       neighbouring slides dim so the active card stands out. */
  layout?: "overlay" | "overlay-scrim" | "split" | "overlay-card";
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
/*  CTA section blocks — focused call-to-action sections (centered surface    */
/*  card, gradient banner) with a primary + secondary CtaButton. Decorative   */
/*  only (no imagery).                                                        */
/* ------------------------------------------------------------------------- */

/** CTA — Centered Minimal: an eyebrow + headline + subheading centered on a
 *  rounded surface card, with a primary + secondary button row below. */
export interface CtaCenteredMinimalBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  /** Outer page background behind the surface card. */
  bgColor?: string;
  /** The rounded surface card background. */
  surfaceColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
  /** Optional reassurance microcopy under the buttons,
   *  e.g. "No credit card required / Cancel anytime". Empty hides the row. */
  reassuranceText?: string;
}

/** CTA — Gradient Banner: a headline + subheading centered on an accent-colored
 *  gradient banner (linear-gradient from the accent color), with a primary +
 *  secondary button row below. */
export interface CtaGradientBannerBlockProps {
  backgroundStyle?: BackgroundStyle;
  heading: string;
  subheading?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  /** Outer page background behind the gradient banner. */
  bgColor?: string;
  /** On-gradient text color (the banner's foreground). */
  textColor?: string;
  /** Gradient base color (the banner fill). */
  accentColor?: string;
  /** Second duotone gradient stop. Defaults to a brand-primary-derived deep
   *  tone so the banner reads as a crafted two-hue gradient, not a single
   *  washed accent. */
  gradientEndColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** CTA — Split Image: a two-column call-to-action pairing a large rounded
 *  product image on one side with eyebrow + heading + subheading copy and a
 *  primary + secondary button row on the other. */
export interface CtaSplitImageBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  /** The large feature image shown beside the copy. */
  imageUrl?: string;
  imageAlt?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single value+label metric in the CTA — Stat Backed block. */
export interface CtaStat {
  value: string;
  label: string;
}

/** CTA — Stat Backed: a call-to-action pairing heading + subheading + a
 *  primary + secondary button row on one side with a column of big-number
 *  stat cards (value + label) on the other. */
export interface CtaStatBackedBlockProps {
  backgroundStyle?: BackgroundStyle;
  heading: string;
  subheading?: string;
  stats: CtaStat[];
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  /** Outer page background. */
  bgColor?: string;
  /** The stat card background. */
  surfaceColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/* ------------------------------------------------------------------------- */
/*  Case Study blocks — social-proof sections built from customer stories,    */
/*  logos, and headline result metrics.                                       */
/* ------------------------------------------------------------------------- */

/** A single customer story card in the Case Study — Card Grid block. */
export interface CaseStudyCard {
  /** Customer / company name. */
  company: string;
  /** Company logo or photo shown in the card header (library/AI-filled). */
  imageUrl: string;
  /** Optional alt text for the logo/photo. */
  imageAlt?: string;
  /** The outcome / quote describing what the customer achieved. */
  result: string;
  /** The headline metric value (e.g. "85%", "2.5x", "$12M"). */
  metricValue: string;
  /** The metric label (e.g. "Reduction in manual sync tasks"). */
  metricLabel: string;
  /** Optional link to the full story. */
  linkUrl?: string;
  /** Featured card: spans two grid columns on desktop and gets an
   *  accent-tinted surface treatment. Default false (regular card). */
  featured?: boolean;
}

/** Case Study — Card Grid: a grid of customer-story cards, each with a logo,
 *  result quote, and a headline metric, plus an optional closing CTA. */
export interface CaseStudyCardGridBlockProps {
  backgroundStyle?: BackgroundStyle;
  heading: string;
  subheading?: string;
  cards: CaseStudyCard[];
  /** How each card's image is shown: a small inline "icon" (default) next to
   *  the company name, or a larger "logo" centered above it. Mirrors the
   *  Case Study — Logo Results Row block. Absent === "icon" (no page change). */
  displayMode?: "icon" | "logo";
  /** Optional link/CTA below the grid. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Outer page background. */
  bgColor?: string;
  /** The card surface background. */
  surfaceColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single customer outcome in the Case Study — Logo Results Row block. */
export interface CaseStudyResult {
  /** Customer / company name. */
  company: string;
  /** Company logo image (library/AI-filled). */
  logoUrl: string;
  /** Optional alt text for the logo. */
  logoAlt?: string;
  /** Short description of the outcome the customer achieved. */
  outcome: string;
  /** The headline metric (e.g. "99.99% uptime", "3x faster"). */
  metricValue: string;
}

/** Case Study — Logo Results Row: a row of customer logos paired with a
 *  headline result metric + outcome, plus an optional CTA. */
export interface CaseStudyLogoResultsRowBlockProps {
  backgroundStyle?: BackgroundStyle;
  heading?: string;
  results: CaseStudyResult[];
  /** How each item's image is shown: a small inline "icon" (default) or a
   *  larger "logo" centered above the company name. */
  displayMode?: "icon" | "logo";
  /** Optional CTA below the row. */
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single headline metric in the Case Study — Metric Triptych block. */
export interface CaseStudyMetric {
  /** The big numeric value (e.g. "10x", "$2.4M", "45%"). */
  value: string;
  /** The supporting label describing the metric. */
  label: string;
}

/** Case Study — Metric Triptych: a centered, text-only proof section that pairs
 *  three big headline metrics with a customer pull-quote, attribution, and an
 *  optional closing CTA. No images — a pure stats + quote social-proof band. */
export interface CaseStudyMetricTriptychBlockProps {
  backgroundStyle?: BackgroundStyle;
  /** "plain" renders metrics directly on the section surface; "panel" wraps
   *  the whole composition in an accent-tinted rounded panel. Default "plain". */
  variant?: "plain" | "panel";
  /** Customer / company name shown above the metrics. */
  company: string;
  /** Exactly three (1–3) headline metrics. */
  metrics: CaseStudyMetric[];
  /** The customer pull-quote. */
  quote: string;
  /** Quote author name. */
  author: string;
  /** Quote author role/title. */
  role: string;
  /** Optional link/CTA below the quote. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Outer page background. */
  bgColor?: string;
  /** The logo-badge surface background. */
  surfaceColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** Case Study — Spotlight Feature: a featured customer story rendered as a
 *  two-column split — Challenge/Solution/Result narrative + a headline metric +
 *  CTA on one side, and a prominent hero photo on the other. */
export interface CaseStudySpotlightFeatureBlockProps {
  backgroundStyle?: BackgroundStyle;
  /** Small uppercase label above the story (e.g. "Featured Case Study"). */
  eyebrow?: string;
  /** Customer / company name. */
  company: string;
  /** The story headline. */
  headline: string;
  /** What the customer struggled with. */
  challenge: string;
  /** How the product solved it. */
  solution: string;
  /** The outcome they achieved. */
  result: string;
  /** The headline metric value (e.g. "300%"). */
  metricValue: string;
  /** The metric label. */
  metricLabel: string;
  /** The prominent feature photo (library/AI-filled). */
  imageUrl: string;
  /** Optional alt text for the photo. */
  imageAlt?: string;
  /** Optional focal point as `"x% y%"` (CSS object-position) for the photo. */
  imageFocal?: string;
  /** Optional customer pull-quote rendered as a magazine-style callout. */
  quote?: string;
  /** Optional customer logo badge overlaid on the photo (tenant-supplied). */
  logoUrl?: string;
  /** Alt text for the customer logo badge. */
  logoAlt?: string;
  /** Wrap the spotlight in an accent-tinted background panel. Default false. */
  tintedPanel?: boolean;
  /** Optional link/CTA below the narrative. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Outer page background. */
  bgColor?: string;
  /** The metric-card surface background. */
  surfaceColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/* ------------------------------------------------------------------------- */
/*  Photo Gallery blocks — horizontal carousel + filmstrip of captioned      */
/*  images. Image-led media sections for product tours, events, portfolios.  */
/* ------------------------------------------------------------------------- */

export interface GalleryImage {
  id: string;
  src: string;
  caption: string;
  /** Optional alt text for accessibility; falls back to caption. */
  alt?: string;
  /** Optional Tailwind aspect-ratio class (e.g. "aspect-[4/3]") for masonry layouts. */
  aspect?: string;
}

export interface GalleryCarouselSpotlightBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  images: GalleryImage[];
  /** Optional CTA button below the carousel. */
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

export interface GalleryFilmstripBlockProps {
  backgroundStyle?: BackgroundStyle;
  headline: string;
  images: GalleryImage[];
  /** Optional CTA link beside the heading. */
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

export interface GalleryMasonryBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Each image carries an optional `aspect` Tailwind class for the masonry columns. */
  images: GalleryImage[];
  /** Optional CTA button below the grid. */
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

export interface GallerySplitFeatureBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** The large hero image filling the left of the gallery grid. */
  imageUrl: string;
  /** Two smaller images stacked beside the hero. */
  images: GalleryImage[];
  /** Optional primary CTA. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Optional secondary CTA link. */
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
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
  /**
   * Stable URL-safe identifier used to target this episode from an ad/email.
   * When set, visitors landing on `?episode=<slug>` or `?utm_content=<slug>`
   * see this episode pinned in the hero, overriding pinHero/newest logic.
   * If omitted, a slug is auto-derived from `title`.
   */
  slug?: string;
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

  /** Source for the Subscribe modal form. "simple" (default) uses the built-in
   *  subscribeFormSteps; "linked" embeds a global form by id; "marketo" embeds a
   *  Marketo form. Only the built-in source captures local subscribers that can
   *  be notified about new episodes — linked/Marketo subscribers live in those
   *  systems. */
  subscribeFormSource?: "simple" | "linked" | "marketo";
  /** Linked global form id (required when subscribeFormSource === "linked"). */
  subscribeLinkedFormId?: number;
  /** Marketo embed config (required when subscribeFormSource === "marketo"). */
  subscribeMarketoBaseUrl?: string;
  subscribeMarketoMunchkinId?: string;
  subscribeMarketoFormId?: number;

  /** When true, publishing the page automatically emails built-in subscribers
   *  about any newly added episodes (at most once per episode per subscriber).
   *  Defaults to false — episode notifications are opt-in. */
  subscribeNotifyAutoSend?: boolean;

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
/*  Webinar Hub block — `webinar-hub`. A self-contained, brand-aware,        */
/*  full-page event landing surface (its own nav AND footer). Cinematic      */
/*  editorial layout: hero + registration form, email-sequence timeline,     */
/*  agenda, featured video, speakers, resources, FAQ,                         */
/*  final CTA, footer. Status drives copy + accent (upcoming/live/on-demand).*/
/* ------------------------------------------------------------------------- */

/** Event availability state. Drives copy, accent, and which sections show. */
export type WebinarStatus = "upcoming" | "live" | "on-demand";

/** Action a webinar-hub button performs. "scroll-to-form" jumps to the hero
 *  registration form; the rest mirror the unified CTA logical actions. */
export type WebinarCtaAction = "scroll-to-form" | "url" | "open-form" | "chilipiper";

export interface WebinarSpeaker {
  /** URL-safe id used to highlight this speaker via `?speaker=<id>`. */
  id?: string;
  name: string;
  role?: string;
  bio?: string;
  /** Editable headshot (media library). When absent, an initials avatar shows. */
  imageUrl?: string;
  /** Fallback initials for the avatar when no photo is set. */
  initials?: string;
  linkedinUrl?: string;
}

export interface WebinarAgendaItem {
  time: string;
  title: string;
  desc?: string;
  speaker?: string;
}

export interface WebinarEmailStep {
  when: string;
  label: string;
  desc?: string;
}

export interface WebinarResource {
  title: string;
  format?: string;
  desc?: string;
  /** Optional thumbnail image (media library URL). Renders above the card body. */
  imageUrl?: string;
  /** Optional link/download target. When set the card becomes a working link;
   *  PDF URLs render with a `download` attribute. Absent = non-interactive card
   *  (legacy behavior). */
  url?: string;
}

export interface WebinarFaq {
  q: string;
  a: string;
}

export interface WebinarHubBlockProps {
  /** Event state — drives default copy + accent. Defaults to "upcoming". */
  status?: WebinarStatus;

  /** Brand wordmark shown in nav/footer. Falls back to tenant brand name. */
  brandName?: string;
  /** Optional logo (media library). When absent the wordmark text renders. */
  logoUrl?: string;

  /** Section visibility toggles — all default to true when absent. */
  showNav?: boolean;
  showHero?: boolean;
  showWorkflow?: boolean;
  showAgenda?: boolean;
  showVideo?: boolean;
  showSpeakers?: boolean;
  showResources?: boolean;
  showFaq?: boolean;
  showFinalCta?: boolean;
  showFooter?: boolean;
  /** Show the in-hero registration form card. Defaults to true. */
  showForm?: boolean;

  /** Sticky-nav anchor links. */
  navLinks?: string[];

  /** Hero. */
  editionLabel?: string;
  title: string;
  subtitle?: string;
  date?: string;
  time?: string;
  timezone?: string;
  /** Social-proof registration count shown in hero/final CTA. */
  registrations?: number;
  /** Optional immersive hero background image (media library). */
  heroBackgroundImageUrl?: string;
  /** Hero overlay darkness as a whole-number percent (0–100). Defaults to 55. */
  heroOverlayOpacity?: number;
  /** Hero video — a YouTube/Vimeo/Loom link or an uploaded video file. When set,
   *  the hero card plays it; otherwise the card shows the poster image only. */
  heroVideoUrl?: string;
  /** Poster image for the hero video card (media library). */
  heroVideoPosterUrl?: string;

  /** Registration / access form (mirrors the event-page FormStep pattern). */
  formSteps?: import("./common").FormStep[];
  formSubmitUrl?: string;
  formSuccessMessage?: string;

  /** Email-sequence ("workflow") timeline. */
  workflowEyebrow?: string;
  workflowHeadline?: string;
  workflowDescription?: string;
  emailSequence?: WebinarEmailStep[];

  /** Agenda. */
  agendaEyebrow?: string;
  agendaHeadline?: string;
  agenda?: WebinarAgendaItem[];

  /** Featured video / live broadcast (hidden when status === "upcoming"). */
  videoEyebrow?: string;
  videoHeadline?: string;
  /** Featured video — a YouTube/Vimeo/Loom link or an uploaded video file. When
   *  set, the stream player plays it; otherwise it shows the poster image only. */
  featuredVideoUrl?: string;
  /** Poster image for the featured stream player (media library). */
  featuredVideoPosterUrl?: string;

  /** Speakers. */
  speakersEyebrow?: string;
  speakersHeadline?: string;
  speakersDescription?: string;
  speakers?: WebinarSpeaker[];

  /** Resources. */
  resourcesEyebrow?: string;
  resourcesHeadline?: string;
  resources?: WebinarResource[];

  /** FAQ. */
  faqEyebrow?: string;
  faqHeadline?: string;
  faqs?: WebinarFaq[];

  /** Final CTA band. */
  finalCtaKicker?: string;
  finalCtaHeadline?: string;
  finalCtaSubtitle?: string;
  /** Optional background image for the final-CTA band (media library). */
  finalCtaBackgroundImageUrl?: string;
  /** Final-CTA overlay darkness as a whole-number percent (0–100). Defaults to 55. */
  finalCtaOverlayOpacity?: number;

  /** Footer. */
  footerTagline?: string;
  footerCopyright?: string;

  /** Primary CTA — the register/watch button reused on nav, final CTA, and
   *  footer. Label defaults from status when blank. */
  primaryCtaText?: string;
  primaryCtaAction?: WebinarCtaAction;
  primaryCtaUrl?: string;
  primaryChilipiperUrl?: string;

  /** Optional SECONDARY CTA — independently toggleable on each of the three
   *  button surfaces (nav / final CTA / footer). Renders as an outline button
   *  before the primary. Supports link / form / Chili Piper actions. */
  secondaryCtaText?: string;
  secondaryCtaAction?: WebinarCtaAction;
  secondaryCtaUrl?: string;
  secondaryChilipiperUrl?: string;
  /** Modal form opened when secondaryCtaAction === "open-form". Uses the
   *  shared simple-form capture (name/email/phone/company); only the copy
   *  fields below are customisable. */
  secondaryFormHeadline?: string;
  secondaryFormSubheadline?: string;
  secondaryFormSuccessMessage?: string;
  /** Per-surface secondary-CTA visibility (all default false). */
  secondaryCtaInNav?: boolean;
  secondaryCtaInFinalCta?: boolean;
  secondaryCtaInFooter?: boolean;

  /** Optional accent overrides. When blank, upcoming/on-demand fall back to the
   *  tenant brand color and "live" uses a semantic broadcast red. */
  accentColor?: string;
  liveAccentColor?: string;
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

/* ------------------------------------------------------------------------- */
/*  Blog Series block family — premium editorial archive ("The Margin").     */
/*  Cream/ink palette, terracotta accent, Fraunces + Inter. Models on        */
/*  content-series; fully prop-driven, manually editable + AI copy-rewrite.   */
/* ------------------------------------------------------------------------- */

export interface BlogSeriesNavLink {
  label: string;
  href: string;
}

export interface BlogSeriesTopic {
  label: string;
  count?: number;
  href?: string;
}

export interface BlogSeriesArticle {
  category?: string;
  title: string;
  excerpt?: string;
  author?: string;
  avatarUrl?: string;
  imageUrl?: string;
  date?: string;
  readTime?: string;
  href?: string;
  hidden?: boolean;
}

export interface BlogSeriesAuthor {
  name: string;
  role?: string;
  bio?: string;
  avatarUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
}

export interface BlogSeriesFooterLink {
  label: string;
  href?: string;
}

export interface BlogSeriesFooterColumn {
  heading: string;
  links: BlogSeriesFooterLink[];
}

export interface BlogSeriesTheme {
  paper?: string;
  paper2?: string;
  ink?: string;
  inkSoft?: string;
  muted?: string;
  line?: string;
  accent?: string;
  accentSoft?: string;
  displayFontFamily?: string;
  bodyFontFamily?: string;
}

export interface BlogSeriesBlockProps {
  // Branding / nav
  wordmark?: string;
  logoUrl?: string;
  navLinks?: BlogSeriesNavLink[];
  navCtaText?: string;
  navCtaUrl?: string;

  // Hero
  heroEyebrow?: string;
  heroHeadline?: string;
  heroHeadlineAccent?: string; // rendered italic on its own line
  heroDeck?: string;
  heroCtaText?: string;
  heroCtaUrl?: string;
  heroMetaLeft?: string;
  heroMetaRight?: string;
  heroImageUrl?: string;
  heroCaptionLabel?: string;
  heroCaptionText?: string;

  // Article archive
  archiveEyebrow?: string;
  archiveLinkText?: string;
  archiveLinkUrl?: string;
  featuredBadge?: string;
  featuredArticle?: BlogSeriesArticle;
  articles?: BlogSeriesArticle[];

  // Topics
  topicsEyebrow?: string;
  topicsHeadline?: string;
  topicsDescription?: string;
  topics?: BlogSeriesTopic[];

  // Contributors
  contributorsEyebrow?: string;
  contributors?: BlogSeriesAuthor[];

  // Subscribe
  subscribeEyebrow?: string;
  subscribeHeadline?: string;
  subscribeHeadlineAccent?: string;
  subscribeDescription?: string;
  subscribePlaceholder?: string;
  subscribeButtonLabel?: string;
  subscribeDisclaimer?: string;
  subscribeSubmitUrl?: string;
  subscribeSuccessMessage?: string;

  // Footer
  footerTagline?: string;
  footerColumns?: BlogSeriesFooterColumn[];
  footerCopyright?: string;
  footerLegalLinks?: BlogSeriesFooterLink[];

  // Section visibility (default ON via `!== false`)
  showNav?: boolean;
  showHero?: boolean;
  showArchive?: boolean;
  showTopics?: boolean;
  showContributors?: boolean;
  showSubscribe?: boolean;
  showFooter?: boolean;

  // Theme override
  theme?: BlogSeriesTheme;
}

/* ------------------------------------------------------------------------- */
/*  Storefront block family — premium DTC e-commerce ("Meridian Coffee Co"). */
/*  Terracotta-on-cream, Fraunces + Inter. Models on content-series.         */
/* ------------------------------------------------------------------------- */

export interface StorefrontTheme {
  bg?: string;
  altBg?: string;
  cardBg?: string;
  darkBg?: string;
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

export interface StorefrontNavLink {
  label: string;
  href: string;
}

/** Small icon + text item (hero trust badges, bundle guarantees).
 *  `icon` is a key into the block's icon map: leaf | returns | truck | coffee | shield | star. */
export interface StorefrontIconItem {
  icon?: string;
  text: string;
}

/** A selectable hero variant option (e.g. grind type). */
export interface StorefrontVariant {
  label: string;
}

export interface StorefrontValueProp {
  icon?: string;
  title: string;
  description?: string;
}

export interface StorefrontProduct {
  imageUrl?: string;
  name: string;
  category?: string;
  price: string;
  comparePrice?: string;
  rating?: number;
  reviewCount?: number;
  tag?: string;
  href?: string;
}

export interface StorefrontCollection {
  imageUrl?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  variant?: "dark" | "accent";
}

export interface StorefrontReview {
  avatarUrl?: string;
  name: string;
  location?: string;
  quote: string;
  rating?: number;
}

export interface StorefrontFooterColumn {
  heading: string;
  links: StorefrontNavLink[];
}

export interface StorefrontBlockProps {
  brandName?: string;
  logoUrl?: string;

  // Section visibility — default ON when absent
  showAnnouncement?: boolean;
  showNav?: boolean;
  showHero?: boolean;
  showValueProps?: boolean;
  showCollections?: boolean;
  showSocialProof?: boolean;
  showClosingCta?: boolean;
  showFooter?: boolean;
  showNewsletter?: boolean;

  // Announcement bar
  announcementText?: string;
  announcementSecondaryText?: string;

  // Sticky nav
  navLinks?: StorefrontNavLink[];
  navCtaText?: string;
  navCtaUrl?: string;
  cartCount?: number;

  // Product hero (flagship product)
  heroEyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroRating?: number;
  heroReviewCount?: number;
  heroPrice?: string;
  heroComparePrice?: string;
  heroImageUrl?: string;
  heroVariantLabel?: string;
  heroVariants?: StorefrontVariant[];
  heroAddToCartLabel?: string;
  heroAddToCartUrl?: string;
  heroBuyNowLabel?: string;
  heroBuyNowUrl?: string;
  heroCardLabel?: string;
  heroCardValue?: string;
  heroTrustBadges?: StorefrontIconItem[];

  // Value-props row
  valueProps?: StorefrontValueProp[];

  // Collection banners
  collections?: StorefrontCollection[];

  // Product grid
  products?: StorefrontProduct[];
  productFilters?: string[];
  productsEyebrow?: string;
  productsHeadline?: string;
  productAddToCartLabel?: string;

  // Social proof
  pressLogos?: string[];
  reviews?: StorefrontReview[];
  reviewsAggregateRating?: number;
  reviewsSummaryText?: string;
  reviewsHeadline?: string;

  // Closing CTA / bundle
  bundleEyebrow?: string;
  bundleTitle?: string;
  bundleDescription?: string;
  bundlePrice?: string;
  bundleComparePrice?: string;
  bundleSaveLabel?: string;
  bundleCtaLabel?: string;
  bundleCtaUrl?: string;
  bundleImageUrl?: string;
  bundleGuarantees?: StorefrontIconItem[];

  // Footer
  footerColumns?: StorefrontFooterColumn[];
  footerTagline?: string;
  footerCopyright?: string;
  paymentIcons?: string[];
  footerLegalLinks?: StorefrontNavLink[];

  // Footer newsletter (inline POST to /api/lp/leads)
  newsletterHeading?: string;
  newsletterSubtext?: string;
  newsletterPlaceholder?: string;
  newsletterButtonLabel?: string;
  newsletterSubmitUrl?: string;
  newsletterSuccessMessage?: string;

  // Visual theme overrides
  theme?: StorefrontTheme;
}

/* ===========================================================================
 * Generic graduated heroes (cinematic-video / aurora-gradient / editorial-split
 * / parallax-layers / spotlight-glow). All five are brand-swappable: colors and
 * fonts resolve from brand CSS vars (var(--brand-accent) / var(--brand-primary)
 * / var(--brand-font-display) / var(--brand-font-body)) with optional per-block
 * overrides below. Each renders its OWN integrated top nav that can be hidden
 * via `showNav`, and a full CTA suite (url / chilipiper / modal-form /
 * modal-chilipiper / video-modal + inline email-capture pill) like the real
 * dso-heartland / magazine heroes.
 * ===========================================================================*/

/** CTA action vocabulary shared by the graduated heroes — matches CtaButton. */
export type HeroCtaActionMode =
  | "url"
  | "chilipiper"
  | "modal-form"
  | "modal-chilipiper"
  | "video-modal";

/** Integrated top-nav config shared by every graduated hero. The whole bar is
 *  hidden when `showNav === false`. */
export interface HeroNavConfig {
  /** Render the integrated top nav bar. Defaults to true. Set false to hide
   *  the entire nav (logo + links + CTA). */
  showNav?: boolean;
  /** Brand wordmark text in the nav. Falls back to the brand name. */
  logoText?: string;
  /** Optional image logo (overrides `logoText` when set). */
  logoImageUrl?: string;
  /** Nav links. `#` anchors smooth-scroll. */
  navLinks?: NavHeaderLink[];
  /** Optional ghost "Sign in"-style link shown before the nav CTA. */
  navSignInText?: string;
  navSignInUrl?: string;
  /** Primary nav button. */
  navCtaText?: string;
  navCtaUrl?: string;
}

/** Full CTA suite shared by every graduated hero (mirrors CtaButton + the
 *  inline email-capture pill used by dso-heartland / parallax-image heroes). */
export interface HeroCtaConfig {
  ctaText: string;
  ctaUrl: string;
  /** Primary CTA behavior. Defaults to "url". */
  ctaAction?: HeroCtaActionMode;
  /** Used when ctaAction === "chilipiper". */
  chilipiperUrl?: string;
  /** Used when ctaAction === "video-modal" (opens an in-page video overlay). */
  videoUrl?: string;
  /** Presentation of the primary CTA:
   *  - "buttons" (default): a normal button (+ optional secondary).
   *  - "email-capture": an inline email pill that collects a lead, then
   *    navigates / opens a modal per `submitMode`. */
  ctaStyle?: "buttons" | "email-capture";
  emailCapturePlaceholder?: string;
  emailCaptureButtonText?: string;
  /** What the email-capture pill does after capturing the email. */
  submitMode?: "navigate" | "modal-form" | "modal-chilipiper";
  /** Optional per-block fill/label overrides for the primary CTA. When unset,
   *  the surface-aware brand fill (pickCtaButtonColors) is used. */
  ctaButtonColor?: string;
  ctaButtonTextColor?: string;
  /** Optional secondary CTA (rendered next to the primary). */
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryAction?: HeroCtaActionMode;
  secondaryChilipiperUrl?: string;
  /** Used when ctaSecondaryAction === "video-modal". */
  secondaryVideoUrl?: string;
}

/** Optional brand-color / font overrides shared by every graduated hero. When
 *  omitted the hero reads the tenant brand CSS vars. */
export interface HeroBrandStyleConfig {
  /** Surface / background color override. */
  bgColor?: string;
  /** Primary text color override. */
  textColor?: string;
  /** Accent color override (defaults to var(--brand-accent)). */
  accentColor?: string;
  /** Per-block headline font (FontSelect). Defaults to the brand display font. */
  headlineFont?: string;
  /** Per-block body font (FontSelect). Defaults to the brand body font. */
  bodyFont?: string;
}

/** A polished, brand-aware hero built from the AI scan review panel: an
 *  oversized headline on the left, body + CTAs on the right, and a full-bleed
 *  image or looping muted-autoplay video flush to the bottom edge. The primary
 *  and secondary CTAs carry the full standard action suite (link / Chili Piper /
 *  form modal / form → Chili Piper / video modal) via HeroCtaConfig +
 *  CtaModalConfig. Manual-insert only (not part of AI page generation). */
export interface AiScanHeroBlockProps
  extends CtaModalConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  /** Small uppercase label above the headline (rendered with an accent dot). */
  eyebrow?: string;
  /** Main headline. Uses the brand display font unless headlineFont is set. */
  headline: string;
  /** Supporting paragraph shown on the right. Hidden when blank. */
  body?: string;
  /** Headline size multiplier over the responsive clamp (1 = default). */
  headlineScale?: number;
  /** Full-bleed image (fallback shown when no backgroundVideoUrl is set). */
  imageUrl?: string;
  imageAlt?: string;
  /** Full-bleed hero media video — always looping, muted, autoplay. Takes
   *  priority over imageUrl. Distinct from the CTA's video-modal `videoUrl`. */
  backgroundVideoUrl?: string;
  /** Optional background preset. A custom bgColor overrides it; both omitted =
   *  a warm editorial default surface. */
  backgroundStyle?: BackgroundStyle;
}

/** A floating glass info chip used by the aurora-gradient hero. */
export interface AuroraHeroChip {
  /** lucide icon name (e.g. "Sparkles"). */
  icon?: string;
  title: string;
  subtitle?: string;
}

/** A sidebar feature item in the spotlight-glow bento preview. */
export interface SpotlightSidebarItem {
  /** lucide icon name. */
  icon?: string;
  label: string;
}

/** 1. Cinematic, full-bleed looping background video with a glass nav, a large
 *  headline + sub, a primary CTA and a "Watch Film" video-modal CTA, plus a
 *  scroll cue. Dark/glass aesthetic. */
export interface CinematicVideoHeroBlockProps
  extends CtaModalConfig,
    HeroNavConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  headline: string;
  subheadline?: string;
  /** Optional small kicker above the headline. */
  eyebrow?: string;
  /** Looping background video (mp4/webm). Falls back to a brand gradient when
   *  empty. */
  backgroundVideoUrl?: string;
  /** Poster / reduced-motion fallback image (also shown while the video loads). */
  backgroundImageUrl?: string;
  /** Scrim darkness over the video, 0-1. Defaults to ~0.55. */
  overlayOpacity?: number;
  /** Label for the bottom scroll cue. Empty hides it. */
  scrollCueLabel?: string;
  /** Content placement: classic centered title card, or a film-style
   *  lower-third (copy pinned bottom-left over a deeper scrim).
   *  Default "centered". */
  layout?: "centered" | "lower-third";
}

/** 2. Animated aurora-blob gradient background, a badge with an inline link, a
 *  gradient-word headline, two CTAs and two floating glass info chips. */
export interface AuroraGradientHeroBlockProps
  extends CtaModalConfig,
    HeroNavConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  /** Pill badge above the headline. */
  badgeText?: string;
  /** Optional inline link inside/after the badge. */
  badgeLinkText?: string;
  badgeLinkUrl?: string;
  headline: string;
  subheadline?: string;
  /** Floating glass chips (defaults provided). */
  chips?: AuroraHeroChip[];
  /** Optional full-bleed background image rendered behind the aurora effect. */
  backgroundImageUrl?: string;
  /** Color overlay drawn over the background image for text legibility. */
  overlayColor?: string;
  /** Overlay opacity as a 0–100 percent. */
  overlayOpacity?: number;
}

/** 3. Light editorial split — eyebrow, large Playfair-style headline, a sub, a
 *  single CTA, and an image on one side. */
export interface EditorialSplitHeroBlockProps
  extends CtaModalConfig,
    HeroNavConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Which side the image sits on. Defaults to "right". */
  imageSide?: "left" | "right";
}

/** 4. Dark parallax hero — three drifting shape images, a badge, headline + sub,
 *  two CTAs and an optional marquee logo band. */
export interface ParallaxLayersHeroBlockProps
  extends CtaModalConfig,
    HeroNavConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  badgeText?: string;
  headline: string;
  subheadline?: string;
  /** Three parallax decoration images (graceful gradient fallback when empty). */
  shapeImage1Url?: string;
  shapeImage2Url?: string;
  shapeImage3Url?: string;
  /** Parallax intensity multiplier, 0-1. Defaults to ~0.5. */
  parallaxStrength?: number;
  /** Marquee logo band below the hero. */
  showMarquee?: boolean;
  marqueeLabel?: string;
  /** Text logos for the marquee band. */
  marqueeLogos?: string[];
}

/** 5. Dark spotlight hero — cursor-follow glow over a grid, a badge, a
 *  gradient-word headline, two CTAs and a bento preview (dashboard image + code
 *  snippet + sidebar feature list). */
export interface SpotlightGlowHeroBlockProps
  extends CtaModalConfig,
    HeroNavConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  badgeText?: string;
  headline: string;
  /** Portion of the headline rendered with the accent gradient. */
  headlineGradientWord?: string;
  subheadline?: string;
  /** Show the bento preview panel. Defaults to true. */
  showPreview?: boolean;
  /** Dashboard image inside the bento preview. */
  previewImageUrl?: string;
  previewImageAlt?: string;
  /** Optional code-snippet card content. */
  codeFileName?: string;
  codeSnippet?: string;
  /** Sidebar feature items in the bento preview (defaults provided). */
  sidebarItems?: SpotlightSidebarItem[];
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Graduated generic SOCIAL-PROOF bars (logo-wall / logo-marquee / rating-badges
 * / avatar-social-proof). These are brand-swappable, light-surface social-proof
 * bands distinct from the metrics-only `trust-bar`. They carry logos / avatars /
 * ratings / testimonials the TENANT supplies — they are deliberately NOT part of
 * the AI page-generation prompt (auto-fabricating customer logos / ratings /
 * testimonials would be false proof). Each extends HeroBrandStyleConfig for
 * optional brand color / font overrides; left unset they read the tenant brand.
 * ──────────────────────────────────────────────────────────────────────────── */

/** A generic, brand-swappable logo entry shared by the logo-wall and
 *  logo-marquee bands. When `imageUrl` is set the real logo is shown; otherwise
 *  a neutral letter-mark derived from `name` renders, so the block reads cleanly
 *  before a tenant uploads their customer logos. */
export interface SocialProofLogo {
  name: string;
  imageUrl?: string;
  /** Optional click-through URL — renders the logo as a focusable link
   *  (logo-marquee). Purely additive; bands that don't link ignore it. */
  href?: string;
}

/** 6. Logo Wall — a calm, editorial "trusted by" logo cloud on a light surface;
 *  a static row/grid of monochrome client marks. */
export interface LogoWallBlockProps extends HeroBrandStyleConfig {
  backgroundStyle?: BackgroundStyle;
  /** Small kicker above the logos, e.g. "Trusted by teams at". */
  eyebrow?: string;
  logos: SocialProofLogo[];
  /** Render logos in muted greyscale (classic logo-cloud look). Default true. */
  grayscale?: boolean;
}

/** 7. Logo Marquee — infinite auto-scrolling logo ribbon(s) with edge fade masks.
 *  Communicates momentum / volume. */
export interface LogoMarqueeBlockProps extends HeroBrandStyleConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  logos: SocialProofLogo[];
  /** Two opposing rows (true) vs a single row. Default true. */
  twoRows?: boolean;
  /** Scroll speed. Default "medium". */
  speed?: "slow" | "medium" | "fast";
  /** Render logos in muted greyscale. Default true. */
  grayscale?: boolean;
  /** Pause the scroll while the ribbon is hovered. Default true. */
  pauseOnHover?: boolean;
}

/** A single third-party review-platform badge for the rating-badges band. */
export interface RatingBadge {
  platform: string;
  /** Numeric score, e.g. 4.9. Stars are derived from this against `ratingMax`. */
  rating: number;
  /** Free-text review count, e.g. "842 reviews". */
  reviewCount?: string;
  /** Optional award / recognition pill, e.g. "High Performer". */
  award?: string;
  /** Visually emphasise this card (dark, accent-tinted). */
  featured?: boolean;
}

/** 8. Rating Badges — a row of review-platform badge cards (third-party
 *  validation): platform name, star score, review count and an award pill. */
export interface RatingBadgesBlockProps extends HeroBrandStyleConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  /** Max stars (denominator). Default 5. */
  ratingMax?: number;
  badges: RatingBadge[];
}

/** A single avatar in the avatar-social-proof stack. */
export interface SocialProofAvatar {
  /** 1-3 char initials shown when no image is supplied. */
  initials?: string;
  imageUrl?: string;
}

/** 9. Avatar Social Proof — overlapping avatar stack + bold volume line + inline
 *  star rating + a short testimonial. Human / community angle. */
export interface AvatarSocialProofBlockProps extends HeroBrandStyleConfig {
  backgroundStyle?: BackgroundStyle;
  avatars: SocialProofAvatar[];
  /** Trailing "+N" chip after the stack, e.g. "+2k". Empty hides it. */
  extraCountLabel?: string;
  headline: string;
  /** Numeric average, e.g. 4.9. Drives the inline stars. */
  rating?: number;
  ratingMax?: number;
  /** Suffix after the score, e.g. "average from 2,400+ reviews". */
  reviewSummary?: string;
  testimonialQuote?: string;
  testimonialAuthor?: string;
}

/** A single person on an About Us team block. People are authored inline on the
 *  block (real photos uploaded by the tenant — never AI-filled). All fields
 *  except name are optional so a solo founder or a small roster both read well. */
export interface AboutTeamMember {
  name: string;
  role?: string;
  /** Uploaded headshot URL. Empty renders an initials placeholder. */
  photo?: string;
  location?: string;
  /** Short "focus area" line shown next to the location. */
  focus?: string;
  bio?: string;
  linkedinUrl?: string;
  email?: string;
}

/** About Us — Team. A standalone tenant landing-page block: an editorial
 *  founder-style spotlight for the selected person plus a clickable roster of
 *  the team. Colors, fonts and corner radius default to the tenant brand and
 *  are overridable. People are authored inline (real photos only). */
export interface AboutTeamBlockProps extends HeroBrandStyleConfig {
  backgroundStyle?: BackgroundStyle;
  /** Show the eyebrow/headline/subheadline header. Defaults on for 2+ people. */
  showHeader?: boolean;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  members: AboutTeamMember[];
  /** Roster avatar diameter in px. Default 72. */
  avatarSize?: number;
  /** Roster avatar shape. Default "circle". */
  avatarShape?: "circle" | "rounded" | "square";
  /** Main portrait shape. Default "rounded". */
  mainImageShape?: "circle" | "rounded" | "square";
  /** Corner radius (px) used when a shape is "rounded". Default 24. */
  cornerRadius?: number;
}

/* ------------------------------------------------------------------------- */
/*  Benefits family (graduated from mockup-sandbox) — four section layouts:   */
/*  alternating rows, bento grid, icon grid, and stat-led columns. Each       */
/*  carries an optional link-style CTA suite (eyebrow/heading/subheading +     */
/*  primary & secondary buttons) and brand-aware bg/text/accent styling.      */
/* ------------------------------------------------------------------------- */

/** Shared optional CTA suite appended below each benefits section. */
export interface BenefitsCtaConfig {
  /** Shared section-background preset (white/dark/brand/gradient/…). When unset
   *  the block falls back to its custom `bgColor` hex. */
  backgroundStyle?: BackgroundStyle;
  /** Hide the trailing CTA band entirely. Default true (shown). */
  showCta?: boolean;
  ctaEyebrow?: string;
  ctaHeading?: string;
  ctaSubheading?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
}

/** A single alternating row: icon + title + description + feature checklist. */
export interface BenefitsAlternatingRow {
  /** Lucide icon name (see ICON_MAP in the block component). */
  icon: string;
  /** Optional short uppercase kicker rendered above the row title,
   *  e.g. "Speed" or "01 — Workflow". Hidden when blank. */
  kicker?: string;
  title: string;
  description: string;
  features: string[];
  /** Optional inline "learn more" link below the checklist. */
  linkLabel?: string;
  linkUrl?: string;
  /** Optional real image shown on the row's visual side. When empty, a
   *  decorative CSS mockup is rendered instead. */
  image?: string;
  /** Alt text for the row image (accessibility). */
  imageAlt?: string;
  /** Focal point as `"x% y%"` (CSS object-position) for the row image. */
  imageFocal?: string;
}

/** Benefits — Alternating Rows: header + alternating text/visual rows, each
 *  with an icon, feature checklist, and inline link, plus an optional CTA. */
export interface BenefitsAlternatingRowsBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  rows: BenefitsAlternatingRow[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single step in the alternating "how it works" showcase: icon + title +
 *  description + feature checklist beside a real product/feature image. */
export interface HowItWorksAlternatingStep {
  /** Lucide icon name (see ICON_MAP in the block component). */
  icon: string;
  title: string;
  description: string;
  features: string[];
  /** Real product/feature image shown on the step's visual side. Empty renders
   *  a neutral image placeholder; the AI image-fill pipeline populates it. */
  image?: string;
  /** Optional alt text for the step image (accessibility). */
  imageAlt?: string;
  /** Optional focal point as `"x% y%"` (CSS object-position) for the image. */
  imageFocal?: string;
}

/** How It Works — Alternating Showcase: header + alternating left/right rows,
 *  each numbered with an icon, copy, and a feature checklist beside a real
 *  product/feature image, plus an optional trailing CTA band. */
export interface HowItWorksAlternatingBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  steps: HowItWorksAlternatingStep[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single step in the numbered-bento "how it works": icon + title +
 *  description. Rendered inside an oversized-number bento tile. */
export interface HowItWorksNumberedBentoStep {
  /** Lucide icon name (see ICON_MAP in the block component). */
  icon: string;
  title: string;
  description: string;
}

/** How It Works — Numbered Bento: header + an asymmetric bento grid of numbered
 *  steps (oversized background numerals, the last tile accent-colored), a
 *  centered primary button, and an optional trailing CTA band. Decorative only
 *  (no real imagery). */
export interface HowItWorksNumberedBentoBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  steps: HowItWorksNumberedBentoStep[];
  /** Optional image tile mixed into the bento grid (rendered after the first
   *  step tile). Empty/unset hides the tile on published pages. */
  imageUrl?: string;
  /** Alt text for the optional image tile. */
  imageAlt?: string;
  /** Focal point as `"x% y%"` (CSS object-position) for the image tile. */
  imageFocal?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single step in the vertical-timeline "how it works": icon + title +
 *  description. Rendered as a node on a vertical connecting rail. */
export interface HowItWorksVerticalTimelineStep {
  /** Lucide icon name (see ICON_MAP in the block component). */
  icon: string;
  title: string;
  description: string;
}

/** How It Works — Vertical Timeline: header + a vertical numbered timeline
 *  (connecting rail with node circles, each step icon + title + description),
 *  a primary + secondary button row, and an optional trailing CTA band.
 *  Decorative only (no real imagery). */
export interface HowItWorksVerticalTimelineBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  steps: HowItWorksVerticalTimelineStep[];
  primaryButtonLabel?: string;
  primaryButtonUrl?: string;
  secondaryButtonLabel?: string;
  secondaryButtonUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single step in the horizontal stepper: icon + title + description. */
export interface HowItWorksHorizontalStep {
  /** Lucide icon name (see ICON_MAP in the block component). */
  icon: string;
  title: string;
  description: string;
}

/** How It Works — Horizontal Stepper: header (with an optional header CTA
 *  button) + a horizontal row of numbered steps over a progress rail, a
 *  trust-badge row, and an optional trailing CTA band. The steps row is a
 *  horizontal scroll-snap container on narrow screens. */
export interface HowItWorksHorizontalStepperBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Optional inline CTA button rendered in the section header. */
  headerCtaLabel?: string;
  headerCtaUrl?: string;
  steps: HowItWorksHorizontalStep[];
  /** Trailing trust badges (e.g. "No credit card required"). */
  trustItems?: string[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single bento tile. The first tile renders large; the last renders as a
 *  dark accent panel — layout spans are derived by index in the component. */
export interface BenefitsBentoTile {
  icon: string;
  title: string;
  description: string;
}

/** Benefits — Bento Grid: asymmetric 5-tile bento (large hero tile + small
 *  tiles + a dark accent tile) with an optional CTA. */
export interface BenefitsBentoBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  tiles: BenefitsBentoTile[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single bento-showcase tile: icon + title + description. The first tile
 *  renders large (2×2 hero) and embeds a builder-canvas mockup; the remaining
 *  tiles render compact with their own decorative mini-mockups keyed by index. */
export interface FeaturesBentoShowcaseTile {
  icon: string;
  title: string;
  description: string;
  /** Optional real image shown in the tile's visual area. When empty, a
   *  decorative CSS mini-mockup is rendered instead. */
  image?: string;
  /** Alt text for the tile image (accessibility). */
  imageAlt?: string;
  /** Focal point as `"x% y%"` (CSS object-position) for the tile image. */
  imageFocal?: string;
}

/** Features — Bento Showcase: an asymmetric 6-tile bento grid (large flagship
 *  tile + supporting tiles) with decorative product mockups and an optional CTA. */
export interface FeaturesBentoShowcaseBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  tiles: FeaturesBentoShowcaseTile[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single supporting feature card in the spotlight-cards grid. */
export interface FeaturesSpotlightCardsSecondaryFeature {
  icon: string;
  title: string;
  description: string;
  /** Optional image rendered as the card's media area (replaces the large
   *  icon area when set). */
  image?: string;
  /** Alt text for the card image (accessibility). */
  imageAlt?: string;
  /** Focal point as `"x% y%"` (CSS object-position) for the card image. */
  imageFocal?: string;
  /** Visually emphasise this card (accent-tinted surface + stronger ring). */
  featured?: boolean;
}

/** Features — Spotlight Cards: a large flagship "spotlight" card (icon + title +
 *  description + inline button + builder mockup) above a row of compact
 *  supporting feature cards, with an optional trailing CTA band. */
export interface FeaturesSpotlightCardsBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  /** Lucide icon name for the spotlight feature (see ICON_MAP in the component). */
  spotlightIcon: string;
  spotlightTitle: string;
  spotlightDescription: string;
  /** Inline button rendered inside the spotlight card. Hidden when blank. */
  spotlightButtonLabel?: string;
  spotlightButtonUrl?: string;
  /** Optional real image shown beside the spotlight feature. When empty, a
   *  decorative builder-canvas mockup is rendered instead. */
  spotlightImage?: string;
  /** Alt text for the spotlight image (accessibility). */
  spotlightImageAlt?: string;
  /** Focal point as `"x% y%"` (CSS object-position) for the spotlight image. */
  spotlightImageFocal?: string;
  secondaryFeatures: FeaturesSpotlightCardsSecondaryFeature[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single feature listed inside a tabbed category. */
export interface FeaturesTabbedCategoriesFeature {
  icon: string;
  title: string;
  description: string;
}

/** A single category tab: label + icon + per-tab heading/subheading + features.
 *  Each tab renders a decorative product mockup keyed by index in the component. */
export interface FeaturesTabbedCategoriesCategory {
  /** Stable id used to track the active tab. */
  id: string;
  label: string;
  /** Lucide icon name shown in the tab button (see ICON_MAP in the component). */
  icon: string;
  heading: string;
  subheading: string;
  features: FeaturesTabbedCategoriesFeature[];
  /** Optional real image shown in the active tab's visual column. When empty, a
   *  decorative CSS mockup is rendered instead. */
  image?: string;
  /** Alt text for the tab image (accessibility). */
  imageAlt?: string;
  /** Focal point as `"x% y%"` (CSS object-position) for the tab image. */
  imageFocal?: string;
}

/** Features — Tabbed Categories: a header + a row of category tabs that swap an
 *  active panel (heading/subheading + feature list + decorative mockup), with an
 *  optional trailing CTA band. Keeps client-side active-tab state. */
export interface FeaturesTabbedCategoriesBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  categories: FeaturesTabbedCategoriesCategory[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single comparison-checklist feature row: icon + name + description. */
export interface FeaturesComparisonChecklistFeature {
  icon: string;
  name: string;
  description: string;
  /** "Us vs them" mode only — whether the competitor column also has this
   *  feature. Default false (renders a cross chip). Ignored unless
   *  `showCompetitorColumn` is enabled on the block. */
  themIncluded?: boolean;
}

/** A grouped category of comparison-checklist features. */
export interface FeaturesComparisonChecklistCategory {
  title: string;
  features: FeaturesComparisonChecklistFeature[];
}

/** Features — Comparison Checklist: a grouped feature table with included
 *  checkmarks, a bespoke "need something custom?" card, and an optional CTA. */
export interface FeaturesComparisonChecklistBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Left column header label (e.g. "Feature & Description"). */
  featureColumnLabel?: string;
  /** Right column header label (e.g. "Included"). */
  includedColumnLabel?: string;
  /** Render a second "them" column for a premium us-vs-them comparison
   *  (brand-accent check chips vs muted cross chips). Default false —
   *  existing pages keep the single "Included" column. */
  showCompetitorColumn?: boolean;
  /** "Us" column header in us-vs-them mode (defaults to the brand name). */
  usColumnLabel?: string;
  /** "Them" column header in us-vs-them mode. Default "Others". */
  themColumnLabel?: string;
  /** Keep the column-header row pinned while the table scrolls under it.
   *  Default false. */
  stickyHeader?: boolean;
  categories: FeaturesComparisonChecklistCategory[];
  /** Show the trailing bespoke/custom card above the CTA band. Default true. */
  showBespokeCard?: boolean;
  bespokeHeading?: string;
  bespokeSubheading?: string;
  bespokeButtonLabel?: string;
  bespokeButtonUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single icon-grid item: icon + title + description. */
export interface BenefitsIconGridItem {
  icon: string;
  title: string;
  description: string;
}

/** Benefits — Icon Grid: a 2- or 3-column grid of icon + title + description
 *  cards with an optional CTA. */
export interface BenefitsIconGridBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  items: BenefitsIconGridItem[];
  /** Cards per row at lg+. Default 3. */
  columns?: 2 | 3;
  /** Render hairline dividers between items instead of open whitespace —
   *  a crisper, denser editorial look. Default false (open grid). */
  divided?: boolean;
  /** Icon chip treatment. "tint" (default) = soft accent-tinted chip with a
   *  saturation floor so pale brand accents still register; "filled" = solid
   *  accent chip with a contrasting icon — recommended for pastel palettes. */
  iconStyle?: "tint" | "filled";
  /** Header composition. "stacked" (default) = eyebrow/headline/subheadline in
   *  a single left column; "split" = eyebrow + headline left, subheadline as a
   *  right-hand column on lg, filling the header's top-right whitespace. */
  headerLayout?: "stacked" | "split";
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/** A single stat column: big stat number + icon + title + description. */
export interface BenefitsStatLedItem {
  /** The big display value, e.g. "3.5x", "+42%", "15h". */
  stat: string;
  title: string;
  description: string;
  icon: string;
}

/** Benefits — Stat-Led: 3 oversized stat columns (stat + icon + title +
 *  description) with an optional CTA. */
export interface BenefitsStatLedBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  headingAlign?: "left" | "center";
  /** Animate the big numerals counting up when scrolled into view (static
   *  under prefers-reduced-motion and inside the builder). Default true. */
  countUp?: boolean;
  stats: BenefitsStatLedItem[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

/* ------------------------------------------------------------------------- */
/*  Quotes / Testimonials family (graduated from mockup-sandbox) — three      */
/*  social-proof section layouts: a single-quote carousel, a masonry "wall    */
/*  of love" library, and a single large quote paired with a portrait image.  */
/*  Each carries an optional link-style CTA suite and brand-aware styling.     */
/* ------------------------------------------------------------------------- */

/** A single testimonial shown in the quote carousel. */
export interface QuoteCarouselTestimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  /** Optional star rating (1–5). */
  rating?: number;
  /** Initials fallback shown when no avatar image is set. */
  avatarInitials?: string;
  /** Optional avatar image URL. */
  avatarImage?: string;
}

/** Quotes — Carousel: one large testimonial at a time with prev/next + dot
 *  controls and an optional CTA band. */
export interface QuoteCarouselBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  testimonials: QuoteCarouselTestimonial[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Auto-advance the carousel (pauses on hover/focus; disabled entirely
   *  under prefers-reduced-motion and in the builder). Default false. */
  autoAdvance?: boolean;
  /** Auto-advance interval in milliseconds. Default 6000. */
  autoAdvanceMs?: number;
  /** Quote card surface: "auto" derives a card that contrasts with the
   *  section background; "light"/"dark" force it. Default "auto". */
  cardTheme?: "auto" | "light" | "dark";
  /** Optional override for the quote card background color (hex or CSS var).
   *  When set and valid it wins over `cardTheme`; card text/muted/border are
   *  auto-derived from it for contrast. When unset, `cardTheme` behavior is
   *  unchanged. */
  cardBgColor?: string;
}

/** A single testimonial card in the quote library masonry grid. */
export interface QuoteLibraryTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  /** Optional star rating (1–5). */
  rating?: number;
  /** Initials shown in the avatar bubble. */
  avatarInitials?: string;
  /** Optional avatar photo URL; falls back to the initials bubble. */
  avatarUrl?: string;
  /** Featured card: larger quote type + accent treatment. When unset, the
   *  first card is featured automatically. */
  featured?: boolean;
  /** Force (true) or suppress (false) the soft accent-tinted card wash.
   *  When unset, the tint is auto-varied by position for a mixed wall. */
  tinted?: boolean;
}

/** Quotes — Library: a masonry "wall of love" of testimonial cards with an
 *  optional CTA band. */
export interface QuoteLibraryBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  testimonials: QuoteLibraryTestimonial[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Optional override for the testimonial card background color (hex or CSS
   *  var). When unset, the card surface auto-derives to contrast with the
   *  section background; when set, card text/muted/border derive from it. */
  cardBgColor?: string;
}

/** Quotes — With Image: a single large quote paired with a portrait image,
 *  star rating, and an optional CTA band. */
export interface QuoteWithImageBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  /** Portrait / customer image URL. */
  imageUrl?: string;
  /** Alt text for the portrait image. */
  imageAlt?: string;
  /** Side the image sits on at lg+. Default "left". */
  imageSide?: "left" | "right";
  /** CSS object-position focal point for the image, e.g. "50% 30%". */
  imageFocal?: string;
  /** Number of filled stars to show (0 hides the rating). Default 5. */
  rating?: number;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Optional override for the quote card background color (hex or CSS var).
   *  When unset, the card surface auto-derives to contrast with the section
   *  background; when set, card text/muted/border derive from it. */
  cardBgColor?: string;
}

/** Quotes — Single: one cinematic, centered testimonial with a large quote
 *  mark, avatar-initials bubble, and an optional CTA band. */
export interface SingleQuoteBlockProps extends BenefitsCtaConfig {
  quote: string;
  author: string;
  role: string;
  company: string;
  /** Initials shown in the avatar bubble. */
  avatarInitials?: string;
  /** Optional avatar photo URL; falls back to the initials bubble. */
  avatarUrl?: string;
  /** Optional small company logo rendered beside the attribution. */
  companyLogoUrl?: string;
  /** "centered" = statement layout (default); "split" = oversized quote on
   *  the left with an attribution rail on the right at lg+. */
  layout?: "centered" | "split";
  /** Wrap the quote in a soft accent-tinted panel instead of floating
   *  directly on the section background. Default false. */
  tintPanel?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Optional override for the quote panel background color (hex or CSS var).
   *  When set it forces the quote into a solid card (even if `tintPanel` is
   *  false) and derives the quote/attribution ink from it for contrast. When
   *  unset, the `tintPanel` behavior is unchanged. */
  cardBgColor?: string;
}

/** A single testimonial card shown in the testimonial grid. */
export interface TestimonialGridItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  /** Optional star rating (1–5). */
  rating?: number;
  /** Initials shown in the avatar bubble. */
  avatarInitials?: string;
  /** Optional avatar photo URL; falls back to the initials bubble. */
  avatarUrl?: string;
  /** Featured card: spans 2 columns at md+ with larger quote type and an
   *  accent treatment. Default false. */
  featured?: boolean;
}

/** Testimonials — Grid: a header plus a responsive grid of testimonial cards
 *  (stars + quote + author) with an optional CTA band. */
export interface TestimonialGridBlockProps extends BenefitsCtaConfig {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  testimonials: TestimonialGridItem[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineColor?: string;
  /** Optional override for the testimonial card background color. When unset,
   *  the card surface is auto-derived to contrast with the section background
   *  (white on light sections, dark slate on dark sections). */
  cardBgColor?: string;
  /** Optional CTA button style overrides. When unset, the renderer derives
   *  contrast-aware defaults from the CTA band background so the buttons
   *  stay legible. Kept on this block (not BenefitsCtaConfig) so the ~17
   *  other blocks sharing the CTA band are unaffected. */
  ctaPrimaryBgColor?: string;
  ctaPrimaryTextColor?: string;
  ctaSecondaryTextColor?: string;
  ctaSecondaryBorderColor?: string;
}

// ── New section blocks batch (navbars / layout rows / PAS / final CTAs) ──────

/** A single nav link (label + destination URL). */
export interface SectionNavLink {
  label: string;
  url: string;
}

/** A grouped column of links inside a mega-menu dropdown. */
export interface MegaMenuGroup {
  /** Group heading shown above the column of links. */
  title: string;
  links: SectionNavLink[];
}

/**
 * Navbar — Centered Logo: brand mark centered, nav links split to the left and
 * right of it, with an optional CTA button. Brand-var themed; chrome block.
 */
export interface CenteredLogoNavBlockProps extends CtaModalConfig {
  logoUrl?: string;
  /** Wordmark text fallback when no logo image is set. */
  logoText?: string;
  leftLinks: SectionNavLink[];
  rightLinks: SectionNavLink[];
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Navbar — Mega Menu: logo + top-level links, where one link opens a grouped
 * dropdown of sub-links with an optional featured image/card. Optional CTA.
 */
export interface MegaMenuNavBlockProps extends CtaModalConfig {
  logoUrl?: string;
  logoText?: string;
  /** Simple top-level links shown inline. */
  links: SectionNavLink[];
  /** Label of the link that opens the mega-menu dropdown. */
  menuLabel?: string;
  /** Grouped columns shown inside the dropdown. */
  menuGroups: MegaMenuGroup[];
  /** Optional featured image inside the dropdown. */
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  /** Optional icon for the featured card — a Lucide icon name OR an image URL. */
  featuredIcon?: string;
  /** Optional background color for the featured card. Unset = transparent. */
  featuredBgColor?: string;
  featuredTitle?: string;
  featuredText?: string;
  /** Optional link for the featured card — set to make the whole card clickable. */
  featuredUrl?: string;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Navbar — Minimal: logo + a single primary CTA only. Low-detail header.
 */
export interface MinimalNavBlockProps extends CtaModalConfig {
  logoUrl?: string;
  logoText?: string;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Navbar — Transparent Overlay: sits transparently over a full-bleed hero and
 * solidifies on scroll. Optional announcement strip above the bar.
 */
export interface TransparentOverlayNavBlockProps extends CtaModalConfig {
  logoUrl?: string;
  logoText?: string;
  links: SectionNavLink[];
  /** Optional announcement strip text shown above the bar (blank to hide). */
  announcementText?: string;
  announcementUrl?: string;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  /** Solid background color applied once the bar is scrolled (over the hero). */
  scrolledBgColor?: string;
  /** Text color while transparent over the hero (usually light). */
  overlayTextColor?: string;
  /** Text color once solidified. */
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

// ── Family B: Flexible column / row layout sections ──────────────────────────

/**
 * Layout — Split media row: 50/50 text + standalone image with a left/right
 * toggle, optional eyebrow, bullet list and CTA.
 */
export interface SplitMediaRowBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  body?: string;
  bullets?: string[];
  imageUrl?: string;
  imageAlt?: string;
  /** Which side the image sits on. */
  mediaSide?: "left" | "right";
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Layout — Full-bleed split: text on a colored half, an edge-to-edge image on
 * the other half. Optional CTA.
 */
export interface FullBleedSplitBlockProps extends CtaModalConfig {
  eyebrow?: string;
  heading: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Which side the edge-to-edge image sits on. */
  mediaSide?: "left" | "right";
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  /** Background color of the text panel half. */
  panelBgColor?: string;
  /** Text color on the colored panel. */
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single icon + title + text item in an icon row. */
export interface IconRowItem {
  /** Lucide icon name (resolved by name; falls back to a default). */
  icon?: string;
  title: string;
  text?: string;
}

/**
 * Layout — Icon row: a flexible 2–4 column row of icon + title + short text.
 * No image; low detail.
 */
export interface IconRowBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  items: IconRowItem[];
  /** Column count (2–4). */
  columns?: 2 | 3 | 4;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single media card (image + heading + text + link). */
export interface MediaRowCard {
  imageUrl?: string;
  imageAlt?: string;
  heading: string;
  text?: string;
  linkLabel?: string;
  linkUrl?: string;
}

/**
 * Layout — Media cards row: 2–3 cards each with an image, heading, text and
 * optional link.
 */
export interface MediaCardsRowBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  cards: MediaRowCard[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single big-number stat with a label. */
export interface StatRowItem {
  value: string;
  label: string;
}

/**
 * Layout — Stat row: a flexible row of 2–4 big-number stats with labels.
 * No image.
 */
export interface StatRowBlockProps {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading?: string;
  stats: StatRowItem[];
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single pain-point card in a PAS icon grid. */
export interface PasIconGridItem {
  icon?: string;
  title: string;
  text?: string;
}

/**
 * PAS — Icon grid: problem statement, a grid of pain-point cards (agitate),
 * then a solution statement + optional CTA.
 */
export interface PasIconGridBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  problemHeading: string;
  problemBody?: string;
  items: PasIconGridItem[];
  solutionHeading?: string;
  solutionBody?: string;
  columns?: 2 | 3 | 4;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * PAS — Split image: problem + agitation copy on one side, image on the other,
 * then a solution statement + optional CTA.
 */
export interface PasSplitImageBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  problemHeading: string;
  problemBody?: string;
  agitateBody?: string;
  solutionHeading?: string;
  solutionBody?: string;
  imageUrl?: string;
  imageAlt?: string;
  mediaSide?: "left" | "right";
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single agitating stat in a PAS stat-agitate block. */
export interface PasAgitateStat {
  value: string;
  label: string;
}

/**
 * PAS — Stat agitate: problem statement, a row of alarming/agitating stats,
 * then a solution statement + optional CTA.
 */
export interface PasStatAgitateBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  problemHeading: string;
  problemBody?: string;
  stats: PasAgitateStat[];
  solutionHeading?: string;
  solutionBody?: string;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/** A single before/after contrast row. */
export interface PasBeforeAfterRow {
  before: string;
  after: string;
}

/**
 * PAS — Before/after: a two-column contrast of the painful "before" against the
 * improved "after", with an optional CTA.
 */
export interface PasBeforeAfterBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  beforeTitle?: string;
  afterTitle?: string;
  /** Optional image atop the "before" panel (rendered desaturated/muted). */
  beforeImageUrl?: string;
  beforeImageAlt?: string;
  /** Optional image atop the "after" panel (rendered full-color/elevated). */
  afterImageUrl?: string;
  afterImageAlt?: string;
  rows: PasBeforeAfterRow[];
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Final CTA — Full bleed: a single full-width call-to-action over a solid color
 * or background image, with primary + optional secondary CTA.
 */
export interface FullBleedFinalCtaBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  backgroundImageUrl?: string;
  overlayOpacity?: number;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Final CTA — Split form: persuasive copy on one side, an inline email-capture
 * form on the other.
 */
export interface SplitFormFinalCtaBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  bullets?: string[];
  formTitle?: string;
  formButtonLabel?: string;
  successMessage?: string;
  /**
   * Submit-button behavior. Defaults to "url", where the on-page email field is
   * the conversion and the lead is captured inline. Other modes (chilipiper /
   * modal-form / modal-chilipiper / video-modal) route through the shared
   * CtaButton suite like every other final-CTA block.
   */
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Final CTA — Stat backed: a final CTA reinforced by a row of proof stats.
 */
export interface StatBackedFinalCtaBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  stats: StatRowItem[];
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Final CTA — Social urgency: a final CTA with social-proof avatars/logos and an
 * urgency line (limited time / spots).
 */
export interface SocialUrgencyFinalCtaBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  urgencyText?: string;
  avatarUrls?: string[];
  proofText?: string;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/**
 * Final CTA — Gradient glow: a centered final CTA over an animated/elevated
 * gradient-glow backdrop.
 */
export interface GradientGlowFinalCtaBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  gradientStart?: string;
  gradientEnd?: string;
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * June-2026 modern block wave (launch heroes / glass features / testimonial
 * wall / glass pricing / aurora CTA finale). Their props interfaces live in the
 * component files (each block is a self-contained registration manifest) and
 * are RE-EXPORTED here, type-only, so the PageBlock union, registry, and every
 * other consumer keeps importing from "@/lib/block-types" as usual. The
 * re-exports are erased at compile time — no runtime lib→blocks dependency.
 * ──────────────────────────────────────────────────────────────────────────── */
export type { LaunchSpotlightHeroBlockProps } from "@/blocks/BlockLaunchSpotlightHero";
export type { BentoMosaicHeroBlockProps } from "@/blocks/BlockBentoMosaicHero";
export type { KineticTypeHeroBlockProps } from "@/blocks/BlockKineticTypeHero";
export type {
  GlassBentoFeaturesBlockProps,
  GlassBentoCard,
  GlassBentoCardSpan,
} from "@/blocks/BlockGlassBentoFeatures";
export type {
  FeatureTabsShowcaseBlockProps,
  FeatureTabItem,
} from "@/blocks/BlockFeatureTabsShowcase";
export type {
  StatCounterBandBlockProps,
  StatCounterItem,
  StatCounterBackground,
} from "@/blocks/BlockStatCounterBand";
export type {
  TestimonialWallBlockProps,
  TestimonialWallItem,
} from "@/blocks/BlockTestimonialWall";
export type {
  GlassPricingTiersBlockProps,
  GlassPricingTier,
} from "@/blocks/BlockGlassPricingTiers";
export type {
  AuroraCtaFinaleBlockProps,
  AuroraCtaReassurance,
} from "@/blocks/BlockAuroraCtaFinale";
export type {
  StorybrandJourneyBlockProps,
  StorybrandProblemCard,
  StorybrandStatChip,
  StorybrandLogo,
  StorybrandTestimonial,
  StorybrandPlanStep,
  StorybrandSuccessItem,
} from "@/blocks/BlockStorybrandJourney";
export type {
  ExecDecisionBriefBlockProps,
  ExecPainRow,
  ExecMetric,
  ExecCriterionRow,
  ExecLineItem,
  ExecProcessStep,
} from "@/blocks/BlockExecDecisionBrief";
export type {
  ChallengerInsightBlockProps,
  ChallengerCostStat,
  ChallengerStakeholder,
  ChallengerTestimonial,
  ChallengerLogo,
  ChallengerPlanStep,
} from "@/blocks/BlockChallengerInsight";
export type {
  DealRoomBlockProps,
  DealRoomStepStatus,
  DealRoomMapStep,
  DealRoomLineItem,
  DealRoomStakeholder,
  DealRoomCaseStudy,
  DealRoomLogo,
  DealRoomResource,
  DealRoomFaq,
} from "@/blocks/BlockDealRoom";
export type {
  AccountMicrositeBlockProps,
  AccountMicrositeStepStatus,
  AccountMicrositeBriefItem,
  AccountMicrositeReason,
  AccountMicrositePhase,
  AccountMicrositeUseCase,
  AccountMicrositePersonaValue,
  AccountMicrositeCaseStudy,
  AccountMicrositeLogo,
  AccountMicrositeResource,
  AccountMicrositePlanStep,
  AccountMicrositeTeamMember,
} from "@/blocks/BlockAccountMicrosite";
export type {
  OnboardingHubBlockProps,
  OnboardingPhaseStatus,
  OnboardingPhase,
  OnboardingContact,
  OnboardingChecklistItem,
  OnboardingResourceKind,
  OnboardingResource,
  OnboardingResourceGroup,
  OnboardingMetric,
} from "@/blocks/BlockOnboardingHub";
export type {
  ValueRenewalReviewBlockProps,
  VrrMetric,
  VrrMilestone,
  VrrWin,
  VrrExpansionItem,
  VrrTermRow,
} from "@/blocks/BlockValueRenewalReview";

/**
 * Final CTA — Video background: a final CTA over a looping background video
 * (user-supplied URL) with a poster fallback image.
 */
export interface VideoBackgroundFinalCtaBlockProps extends CtaModalConfig {
  backgroundStyle?: BackgroundStyle;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  /** Looping background video URL (user-supplied; not auto-filled). */
  backgroundVideoUrl?: string;
  /** Poster/fallback image shown before the video loads. */
  posterUrl?: string;
  overlayOpacity?: number;
  /** Solid color for the video dimming overlay. Defaults to the section's
   *  dark slate (#0F172A) so existing pages are unchanged. */
  overlayColor?: string;
  /** Turns the flat overlay tint into a vertical gradient.
   *  - "none" (default): flat solid tint (legacy behavior).
   *  - "top": darkest at the top, fading to clear at the bottom.
   *  - "bottom": darkest at the bottom, fading to clear at the top.
   *  - "both": darkest at both edges, clearest through the middle. */
  overlayGradient?: "none" | "top" | "bottom" | "both";
  ctaLabel?: string;
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  /** Override for the CTA button background. Defaults to the accent color. */
  ctaButtonColor?: string;
  /** Override for the CTA button label color. Auto-derived for legibility when unset. */
  ctaButtonTextColor?: string;
  headlineFont?: string;
  bodyFont?: string;
  /** Edge gradient that fades the section into a solid color along the top,
   *  bottom, or both edges so it blends into adjacent sections. "none"
   *  (default) disables it. Mirrors the parallax image hero. */
  edgeFade?: "none" | "top" | "bottom" | "both";
  /** Solid color the edge fade resolves to — match the adjacent section's bg.
   *  Defaults to a dark fallback (#0a0a0a). */
  edgeFadeColor?: string;
  /** Percent of section height each edge fade covers (0–60). Default 25. */
  edgeFadeSize?: number;
}
