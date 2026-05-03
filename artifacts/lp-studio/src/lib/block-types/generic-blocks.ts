import type { BackgroundStyle } from "../bg-styles";
import type {
  BlockSettings,
  CaseStudyItem,
  FormStep,
  NavHeaderLink,
  NavHeaderCta,
  FooterColumn,
  ZigzagFeatureRow,
  ProductShowcaseCard,
  RoiInputField,
  RoiOutputField,
} from "./common";

export interface HeroBlockProps {
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
  ctaAction?: "url" | "chilipiper";
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

export interface ComparisonBlockProps {
  headline: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
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

export interface BottomCtaBlockProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  ctaAction?: "url" | "chilipiper";
  chilipiperUrl?: string;
}

export interface VideoSectionBlockProps {
  layout: "full-width" | "split-left" | "split-right";
  headline: string;
  subheadline: string;
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
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

export type SchemaFieldType = "text" | "longText" | "number" | "color" | "image" | "url" | "boolean" | "select";

export interface SchemaFieldDef {
  id: string;
  label: string;
  type: SchemaFieldType;
  defaultValue?: string | number | boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  /** When true, the property panel marks this field as required. */
  required?: boolean;
}

export type SchemaFieldValue = string | number | boolean;

export interface CustomSchemaBlockProps {
  schema: SchemaFieldDef[];
  template: string;
  values: Record<string, SchemaFieldValue>;
  customBlockId?: number;
  customBlockName?: string;
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

export interface FullBleedHeroBlockProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
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

export interface RoiCalculatorBlockProps {
  headline: string;
  subheadline: string;
  inputFields: RoiInputField[];
  outputFields: RoiOutputField[];
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
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

export interface DandySiteHeaderBlockProps {
  logoUrl?: string;
  phoneNumber: string;
  phoneLabel: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
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

export interface DandySideImageV6BlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  bullets?: string[];
  ctaText?: string;
  ctaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
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
}

export interface DandyConversionPanel1Stat {
  value: string;
  label: string;
}

export interface DandyConversionPanel1BlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  style?: "teal" | "lime" | "medium" | "white";
  bgColor?: string;
  stats?: DandyConversionPanel1Stat[];
}

export interface DandyCtaBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
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

export interface MagazineHeroBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  ctaText: string;
  ctaUrl: string;
  /** Optional secondary CTA rendered as a text link next to the primary
   *  button. Useful for "Read the story →" style flows. */
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
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
}

/* ------------------------------------------------------------------------- */
/*  Bold Statement — brutalist full-bleed manifesto block. Massive typography,*/
/*  one accented word, optional small footer line. Built to make the page    */
/*  feel like a campaign, not a product page.                                */
/* ------------------------------------------------------------------------- */

export interface BoldStatementBlockProps {
  eyebrow?: string;
  /** Main statement. Use HTML <em>...</em> around the word(s) you want
   *  rendered in the accent color. */
  statement: string;
  /** Small line of copy under the statement (optional). */
  footnote?: string;
  ctaText?: string;
  ctaUrl?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
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
  caption?: string;
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
  /** Section background. Defaults to a deep luxury near-black. */
  bgColor?: string;
  /** Heading + caption color. Defaults to a warm cream. */
  textColor?: string;
  /** Accent / brand color for the caption underline, dot indicator,
   *  corner accents and prev/next button hover. */
  accentColor?: string;
  /** Border color for the prev/next buttons. */
  borderColor?: string;
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
