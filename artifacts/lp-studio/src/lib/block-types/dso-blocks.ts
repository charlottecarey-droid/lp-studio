import type React from "react";
import type { BackgroundStyle } from "../bg-styles";
import type { CtaMode, CtaModalConfig } from "./common";

export interface DsoPracticeNavLink {
  label: string;
  anchor: string;
}

export interface DsoPracticeNavBlockProps extends CtaModalConfig {
  dsoName?: string;
  links: DsoPracticeNavLink[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
}

export interface DsoInsightsDashboardBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  practiceLabel: string;
  backgroundStyle: BackgroundStyle;
  dashboardVariant: "light" | "dark";
  /** URL string shown in the simulated browser address bar at the top of the
   *  dashboard chrome. Defaults to a generic "app/dashboard". */
  browserUrl?: string;
  videoUrl?: string;
  videoAutoplay?: boolean;
  videoPlayOnScroll?: boolean;
}

export interface DsoLabTourBlockProps {
  eyebrow: string;
  headline: string;
  body: string;
  quote: string;
  quoteAttribution: string;
  imageUrl: string;
  /** Alt text for the lab image. Falls back to empty string (decorative). */
  imageAlt?: string;
  /** Small uppercase label rendered above the caption (e.g. "Lab Tour"). */
  imageEyebrow?: string;
  /** Caption shown over the bottom of the image. Tenant-specific copy. */
  imageCaption?: string;
  videoUrl: string;
  ctaText: string;
  ctaUrl: string;
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
}

export interface DsoStatBarBlockProps {
  stats: { value: string; label: string }[];
  backgroundStyle: BackgroundStyle;
}

export interface DsoHeartlandHeroBlockProps {
  headline: string;
  companyName: string;
  /** Optional partner / co-branded company logo shown in the nav as `Dandy × [logo]`.
   *  When present, this replaces the text rendering of `companyName` in the
   *  hero nav (sticky header + fallback nav). */
  companyLogoUrl?: string;
  /** Alt text for the partner logo. Falls back to `companyName`. */
  companyLogoAlt?: string;
  eyebrow?: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  primaryCtaMode?: CtaMode;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  /** CTA presentation style. "buttons" (default) renders the primary/secondary
   *  pill buttons. "email-capture" renders an inline pill-shaped email field
   *  with a submit button — mirrors the meetdandy.com Crown & Bridge hero. */
  ctaStyle?: "buttons" | "email-capture";
  /** Placeholder for the email-capture input. Defaults to "Email address". */
  emailCapturePlaceholder?: string;
  /** Submit button label for the email-capture form. Defaults to the primary CTA text. */
  emailCaptureButtonText?: string;
  backgroundStyle?: BackgroundStyle;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  layout?: "full-bleed" | "split" | "split-video" | "stacked-video";
  heroImageUrl?: string;
  heroImageSide?: "left" | "right";
  /** How the hero image fits its column. `cover` crops to fill (good for photos);
   *  `contain` shows the whole image (good for product shots on transparent bg). */
  heroImageFit?: "cover" | "contain";
  /** Inner padding (px) around a `contain`-fit hero image so it doesn't touch the edges. */
  heroImagePadding?: number;
  /** Width (%) of the image column in split layout. Defaults to 45. */
  heroImageWidth?: number;
  /** CSS object-position for the hero image (e.g. "top left", "50% 50%", "20% 80%").
   *  Combined with `cover`, lets the image intentionally bleed off the opposite edges. */
  heroImagePosition?: string;
  /** Optional zoom multiplier for the hero image (1 = natural cover, 1.5 = 150%). */
  heroImageScale?: number;
  heroVideoUrl?: string;
  heroTopPadding?: number;
  heroMinHeight?: number;
  heroSidePadding?: number;
  heroHeadingSize?: number;
  heroVideoWidth?: number;
  disableScrollFade?: boolean;
  videoAutoplay?: boolean;
  stats: { value: string; label: string }[];
  showScrollIndicator?: boolean;
  /** When true, replaces the absolute nav with a premium sticky/blurring header. */
  stickyHeader?: boolean;
  /** Optional nav links (label + href) shown in the header. */
  navLinks?: { label: string; href: string }[];

  /** What happens when the user submits the email-capture pill (ctaStyle === "email-capture").
   *  - "navigate" (default): redirect to primaryCtaUrl with ?email=…
   *  - "modal-form": open a modal with a customizable form (email pre-filled)
   *  - "modal-chilipiper": open a modal with a Chili Piper iframe (email pre-filled) */
  submitMode?: "navigate" | "modal-form" | "modal-chilipiper";
  modalChilipiperUrl?: string;
  modalHeadline?: string;
  modalSubheadline?: string;
  modalSubmitText?: string;
  modalSuccessMessage?: string;
  modalDisclaimer?: string;
  modalShowFirstName?: boolean;
  modalShowLastName?: boolean;
  modalShowPhone?: boolean;
  modalShowCompany?: boolean;
  /** Which form to render inside the modal when submitMode === "modal-form".
   *  - "simple" (default): hand-rolled fields driven by modalShow*
   *  - "linked": render a global form from the Forms library by id
   *  - "marketo": embed a Marketo form */
  modalFormSource?: "simple" | "linked" | "marketo";
  /** Linked global form id (when modalFormSource === "linked"). */
  modalFormId?: number;
  /** Marketo instance URL (when modalFormSource === "marketo"). */
  modalMarketoBaseUrl?: string;
  modalMarketoMunchkinId?: string;
  modalMarketoFormId?: number;
}

/**
 * Dandy Product Hero — pixel-faithful clone of the meetdandy.com Crown & Bridge
 * style hero. Dark green left half with eyebrow + serif headline + subheadline +
 * inline white email-capture pill (lime submit). Right half holds a product
 * image that intentionally bleeds off the bottom-right corner.
 */
export interface DandyProductHeroBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Pre-CTA disclaimer / fine-print under the email pill. */
  disclaimer?: string;
  /** Email field placeholder. Default: "Email address". */
  emailPlaceholder?: string;
  /** Submit button label. Default: "Get Started". */
  primaryCtaText?: string;
  /** Where to send the user on submit. Email is appended as ?email=…. */
  primaryCtaUrl?: string;
  /** "link" (redirect) or "chilipiper" (popup). */
  primaryCtaMode?: CtaMode;
  /** Hero product image (e.g. crown PNG). */
  imageUrl?: string;
  imageAlt?: string;
  /** When true (default), image is absolutely positioned and bleeds off the
   *  right edge of the section. When false, fills its grid cell normally. */
  imageBleed?: boolean;
  /** CSS object-position focal point. Default: "top left" (matches meetdandy). */
  imageAnchor?: string;
  /** Image zoom multiplier. Default: 1.35 — pushes the crown larger so it
   *  bleeds off the corners like the reference page. */
  imageScale?: number;
  /** When true, slowly rotates the product image (Hero 7 Style 3 effect). */
  spinImage?: boolean;
  /** Seconds for one full rotation. Default: 18. */
  spinDuration?: number;
  /** Spin direction. Default: "cw". */
  spinDirection?: "cw" | "ccw";
  /** Section min-height in vh. Default: 90. */
  minHeight?: number;
  /** Background color. Default: dandy-green #003a30. */
  backgroundColor?: string;
  /** Accent color (eyebrow + submit button). Default: dandy-lime #c7e738. */
  accentColor?: string;
  /** Text color. Default: white. */
  textColor?: string;

  /** Layout variant.
   *  - "split" (default): solid bg with image bleeding off the right edge (current Crowns hero look)
   *  - "card": light section bg with a grey card behind the copy + form on the left
   *  - "gradient": soft horizontal gradient between the bg color and the image side instead of a hard line */
  variant?: "split" | "card" | "gradient";
  /** Email input + button shape. "rounded" = pill (default), "square" = squared corners. */
  inputStyle?: "rounded" | "square";
  /** Submit button background color. Defaults to accentColor. */
  buttonColor?: string;
  /** Submit button hover background color. Defaults to a slightly darker shade of buttonColor. */
  buttonHoverColor?: string;
  /** Submit button text color. Defaults to backgroundColor (dark text on lime button). */
  buttonTextColor?: string;
  /** Left column flex ratio (grid fr). Default: 1.05. */
  leftColumnFr?: number;
  /** Right column flex ratio (grid fr). Default: 1. */
  rightColumnFr?: number;
  /** Background color of the grey card (variant === "card"). Default: #e8e6df. */
  cardColor?: string;
  /** Text color inside the grey card (variant === "card"). Default: #0a2b25. */
  cardTextColor?: string;
  /** Background color used for the image side in "card" and "gradient" variants. Default: #ffffff. */
  imageBackgroundColor?: string;

  /** What happens when the user submits the email pill.
   *  - "navigate" (default, current): redirect to primaryCtaUrl with ?email=…
   *  - "modal-form": open a modal with a customizable form (email pre-filled)
   *  - "modal-chilipiper": open a modal with a Chili Piper iframe (email pre-filled) */
  submitMode?: "navigate" | "modal-form" | "modal-chilipiper";
  /** Chili Piper booking URL used when submitMode === "modal-chilipiper". */
  modalChilipiperUrl?: string;
  /** Modal form headline. */
  modalHeadline?: string;
  /** Modal form subheadline. */
  modalSubheadline?: string;
  /** Modal form submit button label. */
  modalSubmitText?: string;
  /** Success message shown after the modal form is submitted. */
  modalSuccessMessage?: string;
  /** Fine-print disclaimer under the modal submit button. */
  modalDisclaimer?: string;
  /** Show first-name field in modal form. Default: true. */
  modalShowFirstName?: boolean;
  /** Show last-name field in modal form. Default: true. */
  modalShowLastName?: boolean;
  /** Show phone field in modal form. Default: true. */
  modalShowPhone?: boolean;
  /** Show company field in modal form. Default: false. */
  modalShowCompany?: boolean;
  /** Which form to render inside the modal when submitMode === "modal-form".
   *  - "simple" (default): hand-rolled fields driven by modalShow*
   *  - "linked": render a global form from the Forms library by id
   *  - "marketo": embed a Marketo form */
  modalFormSource?: "simple" | "linked" | "marketo";
  /** Linked global form id (when modalFormSource === "linked"). */
  modalFormId?: number;
  /** Marketo instance URL (when modalFormSource === "marketo"). */
  modalMarketoBaseUrl?: string;
  modalMarketoMunchkinId?: string;
  modalMarketoFormId?: number;
}

export interface DsoSuccessStoriesBlockProps {
  eyebrow: string;
  headline: string;
  cases: { name: string; stat: string; label: string; quote: string; author: string; image?: string }[];
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
}

export interface DsoChallengesBlockProps {
  eyebrow: string;
  headline: string;
  backgroundStyle: BackgroundStyle;
  layout: "4-col" | "2-col";
  challenges: { title: string; desc: string }[];
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
}

export type DsoProblemPanelIcon =
  | "alert-triangle" | "bar-chart" | "users" | "trending-down"
  | "clock" | "shield" | "microscope" | "layers" | "zap" | "target"
  | "dollar" | "network" | "activity" | "scale";

export interface DsoProblemBlockProps {
  eyebrow: string;
  headline: string;
  body: string;
  panels: { icon: DsoProblemPanelIcon; title: string; desc: string }[];
  imageUrls?: string[];
  statValue?: string;
  statLabel?: string;
  backgroundStyle?: BackgroundStyle;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
}

export interface DsoAiFeatureBlockProps {
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  stats: { value: string; label: string }[];
  imageUrl: string;
  videoUrl?: string;
  backgroundStyle?: BackgroundStyle;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
}

export interface DsoStatShowcaseBlockProps {
  eyebrow: string;
  headline: string;
  stats: { value: string; label: string; description?: string }[];
  backgroundStyle?: BackgroundStyle;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
}

export interface DsoScrollStoryChapter {
  headline: string;
  body: string;
  imageUrl: string;
}

export interface DsoScrollStoryBlockProps {
  eyebrow: string;
  chapters: DsoScrollStoryChapter[];
  /**
   * Section header rendered above the scroll story.
   * Made prop-driven so generic tenants can replace the previously-hardcoded
   * Dandy copy ("How Dandy transforms your lab strategy" /
   *  "Scroll to explore each pillar of the Dandy platform.").
   * Empty string hides the line entirely.
   */
  sectionHeading?: string;
  sectionSubheading?: string;
  backgroundStyle?: BackgroundStyle;
}

export interface DsoScrollStoryHeroBlockProps extends CtaModalConfig {
  eyebrow: string;
  chapters: DsoScrollStoryChapter[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaAction?: CtaMode;
  chilipiperUrl?: string;
  imagePosition?: "left" | "right";
  backgroundStyle?: BackgroundStyle;
  backgroundVideoUrl?: string;
}

export interface DsoNetworkMapBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  /**
   * Label rendered under the central hub in the SVG. Made prop-driven so
   * generic tenants can replace the previously-hardcoded "DANDY HUB" string.
   * Empty string hides the label entirely.
   */
  hubLabel?: string;
  backgroundStyle?: BackgroundStyle;
}

export interface DsoCaseFlowStage {
  number?: string;
  label: string;
  metric: string;
  metricLabel: string;
  body: string;
  icon?: React.ReactNode;
}

export interface DsoCaseFlowBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  stages?: DsoCaseFlowStage[];
  backgroundStyle?: BackgroundStyle;
}

export interface DsoLiveFeedBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  footerNote?: string;
  /** Label shown in the terminal header bar. Defaults to a neutral "Live Insights". */
  terminalLabel?: string;
  backgroundStyle?: BackgroundStyle;
}

export interface DsoParticleMeshBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  stat1Value?: string;
  stat1Label?: string;
  stat2Value?: string;
  stat2Label?: string;
  stat3Value?: string;
  stat3Label?: string;
  imageUrl?: string;
  imagePosition?: "left" | "right";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoFlowCanvasBlockProps {
  eyebrow?: string;
  quote?: string;
  attribution?: string;
  stat?: string;
  statLabel?: string;
  imageUrl?: string;
  backgroundStyle?: BackgroundStyle;
}

export type DsoBentoTile =
  | { type: "stat"; value: string; label: string; description?: string }
  | { type: "photo"; imageUrl: string; caption: string }
  | { type: "feature"; headline: string; body: string }
  | { type: "quote"; quote: string; author: string };

export interface DsoBentoOutcomesBlockProps {
  eyebrow: string;
  headline: string;
  tiles: DsoBentoTile[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoCtaCaptureBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  ctaLabel?: string;
  trust1?: string;
  trust2?: string;
  trust3?: string;
  imageUrl?: string;
  imagePosition?: "left" | "right";
  chilipiperUrl?: string;
  successHeadline?: string;
  successBody?: string;
  backgroundStyle?: BackgroundStyle;
}

// DSO Practices segment: 8 net-new blocks

export interface DsoMeetTeamMember {
  name: string;
  role: string;
  photo?: string;
  email?: string;
  chilipiperUrl?: string;
}

export interface DsoMeetTeamBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  members: DsoMeetTeamMember[];
  backgroundStyle?: BackgroundStyle;
}

export interface DsoParadigmShiftBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  oldWayLabel?: string;
  newWayLabel?: string;
  oldWayItems: string[];
  newWayItems: string[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoPartnershipPerk {
  icon: string;
  title: string;
  desc: string;
}

export interface DsoPartnershipPerksBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  perks: DsoPartnershipPerk[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoProductItem {
  name: string;
  detail: string;
  price: string;
  icon?: string;
  imageKey?: string;
  imageUrl?: string;
}

export interface DsoProductsGridBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  products: DsoProductItem[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoPromoCard {
  title: string;
  desc: string;
  badge?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface DsoPromoCardsBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  cards: DsoPromoCard[];
  backgroundStyle?: BackgroundStyle;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
}

export interface DsoActivationStep {
  step: string;
  title: string;
  desc: string;
}

export interface DsoActivationStepsBlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  steps: DsoActivationStep[];
  ctaText?: string;
  ctaUrl?: string;
  /** Legacy field kept for back-compat: "link" | "chilipiper" | "modal-form" | "modal-chilipiper". */
  ctaMode?: CtaMode;
  /** Used when ctaMode === "chilipiper". */
  chilipiperUrl?: string;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoPromise {
  icon: string;
  title: string;
  desc: string;
}

export interface DsoPromisesBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  promises: DsoPromise[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoTestimonialItem {
  quote: string;
  author: string;
  location?: string;
}

export interface DsoTestimonialsBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  testimonials: DsoTestimonialItem[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoPracticeHeroBlockProps extends CtaModalConfig {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  primaryCtaMode?: CtaMode;
  primaryCtaAction?: CtaMode;
  primaryChilipiperUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  secondaryCtaMode?: CtaMode;
  secondaryCtaAction?: CtaMode;
  secondaryChilipiperUrl?: string;
  trustLine?: string;
  backgroundStyle?: BackgroundStyle;
  layout?: "centered" | "split" | "bg-image";
  imageUrl?: string;
  imageAlt?: string;
  imageShadow?: boolean;
  heroHeight?: "compact" | "default" | "large" | "full";
  imageAspect?: "16/9" | "4/3" | "1/1" | "3/4";
}

export interface DsoStatRowItem {
  value: string;
  label: string;
  detail?: string;
}

export interface DsoStatRowBlockProps {
  eyebrow?: string;
  headline?: string;
  items: DsoStatRowItem[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
  animateNumbers?: boolean;
}

export interface DsoFaqItem {
  question: string;
  answer: string;
}

export interface DsoFaqBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  items: DsoFaqItem[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoSplitFeatureBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  bullets?: string[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "link";
  imageUrl?: string;
  imagePosition?: "left" | "right";
  backgroundStyle?: BackgroundStyle;
}

export interface DsoSoftwareShowcaseBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoAutoplay?: boolean;
  videoPlayOnScroll?: boolean;
  hideBrowserFrame?: boolean;
  features?: { icon?: string; label: string }[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  backgroundStyle?: BackgroundStyle;
  layout?: "centered" | "split";
}

export interface DsoPilotStep {
  title: string;
  subtitle: string;
  desc: string;
  details: string[];
}

export interface DsoPilotStepsBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  backgroundStyle: BackgroundStyle;
  steps?: DsoPilotStep[];
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
}

export interface DsoFinalCtaBlockProps extends CtaModalConfig {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  primaryCtaMode?: CtaMode;
  /** Chili Piper URL when primaryCtaMode === "chilipiper". */
  primaryChilipiperUrl?: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
}

export interface DsoComparisonBlockProps extends CtaModalConfig {
  eyebrow: string;
  headline: string;
  subheadline: string;
  companyName: string;
  /**
   * Label for the "modern" comparison column. Defaults to a neutral
   * "Our Platform" if not provided. Previously the column was hardcoded
   * to "Dandy" inside the component.
   */
  providerLabel?: string;
  /** Label for the legacy/traditional column (defaults to "Traditional"). */
  traditionalLabel?: string;
  ctaText: string;
  ctaUrl: string;
  ctaMode?: CtaMode;
  ctaAction?: CtaMode;
  chilipiperUrl?: string;
  rows: { need: string; dandy: string; traditional: string }[];
  backgroundStyle: BackgroundStyle;
  tableNeedColor?: string;
  tableDandyColor?: string;
  tableTraditionalColor?: string;
  headerDandyColor?: string;
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
}

export interface DsoCaseStudyBodySection {
  heading: string;
  body: string;
  imageUrl?: string;
}

export interface DsoCaseStudyResultItem {
  value: string;
  label: string;
  description: string;
}

export interface DsoCaseStudyBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  stats?: { value: string; label: string }[];
  heroOnly?: boolean;
  challenge?: DsoCaseStudyBodySection;
  solution?: DsoCaseStudyBodySection;
  quote?: string;
  results?: DsoCaseStudyResultItem[];
  resultsImageUrl?: string;
  heroBackgroundStyle?: BackgroundStyle;
  bodyBackgroundStyle?: BackgroundStyle;
  resultsBackgroundStyle?: BackgroundStyle;
  whyItMatters?: DsoCaseStudyBodySection;
  backgroundStyle?: BackgroundStyle;
  ctaText?: string;
  ctaUrl?: string;
  ctaVariant?: "primary" | "secondary" | "link";
  ctaMode?: CtaMode;
}

export interface DsoInsightsVideoBlockProps {
  /** Small uppercase label rendered above the title (e.g. "Insights" or
   *  "{Brand} Insights"). Falls back to "Insights" when omitted. */
  eyebrow?: string;
  /** URL of the chrome address bar shown in the simulated browser frame.
   *  Tenant-specific. Falls back to a generic "/dashboard" string. */
  browserUrl?: string;
  /** Alt-text prefix for the rotating dashboard screenshots. Defaults to
   *  "Insights". A tenant might want e.g. "Acme Insights — Remake Rates". */
  screensAltPrefix?: string;
  /** Alt text for the scan-thickness GIF. Defaults to a neutral description. */
  scanGifAlt?: string;
  /** Title attribute for the embedded video iframe (accessibility). */
  videoTitle?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  callouts?: Array<{ label: string; desc: string }>;
  showScanGif?: boolean;
  callout1Label?: string;
  callout1Desc?: string;
  callout2Label?: string;
  callout2Desc?: string;
  callout3Label?: string;
  callout3Desc?: string;
  callout4Label?: string;
  callout4Desc?: string;
  quote?: string;
  quoteAttribution?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
  ctaVariant?: "primary" | "secondary" | "outline" | "link";
  backgroundStyle?: BackgroundStyle;
  imageUrl?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
  videoUrl?: string;
  videoAutoplay?: boolean;
  videoPlayOnScroll?: boolean;
  hideBrowserFrame?: boolean;
  chilipiperUrl?: string;
}

export interface OnePagerHeroBlockProps {
  partnerName: string;
  headline?: string;
  subtitle?: string;
  tagline?: string;
  sideImageUrl?: string;
  phone?: string;
  accentColor?: string;
  panelVariant?: "solid" | "diagonal" | "mesh";
}

export interface EventPageAgendaDay {
  day: string;
  title: string;
  description: string;
  highlight: string;
}

export interface EventPagePhoto {
  src: string;
  alt: string;
  caption: string;
}

export interface EventPageDetail {
  label: string;
  value: string;
  sub: string;
}

export interface EventPageNavLink {
  label: string;
  href: string;
}

export interface EventPageTheme {
  /** Page background */
  bg?: string;
  /** Secondary panel / card background (used in Details section) */
  cardBg?: string;
  /** Primary body / foreground text color */
  fg?: string;
  /** Heading text color (h1/h2/h3). Falls back to fg when blank. */
  headingColor?: string;
  /** Accent color used for eyebrows, buttons, hover states, dividers */
  primary?: string;
  /** Muted secondary text color (subtitles, captions, helper text) */
  muted?: string;
  /** Border color used for inputs, dividers, photo button outlines */
  border?: string;
  /** Sticky nav background color (hex). Combined with navBgOpacity. */
  navBg?: string;
  /** Sticky nav background opacity 0–1 */
  navBgOpacity?: number;
  /** Nav link / nav CTA text color */
  navText?: string;
  /** Google Font family used for headings (display) */
  displayFontFamily?: string;
  /** Google Font family used for body / UI text */
  bodyFontFamily?: string;
}

export interface EventPageBlockProps {
  eventName: string;
  eventSubtitle: string;
  logoUrl?: string;
  navLinks: EventPageNavLink[];
  navCtaText: string;
  navCtaUrl: string;
  heroEyebrow: string;
  heroImageUrl: string;
  heroTagline: string;
  heroLocation: string;
  heroCtaText: string;
  agendaEyebrow: string;
  agendaHeadline: string;
  agendaSubtitle: string;
  agendaValueProps: string[];
  agendaDays: EventPageAgendaDay[];
  photos: EventPagePhoto[];
  detailsEyebrow: string;
  detailsHeadline: string;
  detailsSubtitle: string;
  details: EventPageDetail[];
  rsvpEyebrow: string;
  rsvpHeadline: string;
  rsvpSubtitle: string;
  formSteps: import("./common").FormStep[];
  formSubmitUrl?: string;
  footerText: string;
  /** Optional visual theme overrides. Falls back to dark luxury defaults when unset. */
  theme?: EventPageTheme;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPATIAL TOUR — Inside Dandy Spatial Lab Tour landing page
// ─────────────────────────────────────────────────────────────────────────────

export interface SpatialTourNavLink {
  label: string;
  href: string;
}

export interface SpatialTourMarqueeItem {
  value: string;
  label: string;
}

export interface SpatialTourStation {
  number: string;
  label: string;
  imageUrl: string;
  /** CSS object-position for the station photo */
  objectPosition?: string;
  headline: string;
  body: string;
  /** Inset card duration label, e.g. "0:48" */
  insetDuration: string;
  /** Inset card detail copy */
  insetDetail: string;
}

export interface SpatialTourCalloutPoint {
  title: string;
  body: string;
}

export interface SpatialTourWay {
  number: string;
  label: string;
  eyebrow: string;
  body: string;
  ctaText: string;
  imageUrl: string;
  objectPosition?: string;
}

export interface SpatialTourDate {
  date: string;
  city: string;
  event: string;
  /** "Filling fast" | "Open" | "Limited" | "Always open" */
  status: string;
}

export interface SpatialTourBlockProps {
  // Nav
  navBrand: string;
  navLinks: SpatialTourNavLink[];
  navCtaText: string;
  navCtaUrl: string;
  // Optional brand wordmark overrides — when set, the nav + footer
  // wordmarks render the tenant's logo instead of the bundled Dandy
  // SVG fallback. `logoUrlDark` is preferred on dark chrome.
  logoUrl?: string;
  logoUrlDark?: string;
  logoAlt?: string;

  // Hero
  heroEyebrow: string;
  heroHeadlineLine1: string;
  heroHeadlineLine2: string;
  heroHeadlineEmphasis: string;
  heroHeadlineLine3: string;
  heroBody: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImageUrl: string;
  /** Optional looping video URL (e.g. "/videos/dandy-lab-video.mp4"). When set,
   *  the hero swaps the static parallax for an autoplaying muted video stage
   *  with a vignette, REC indicator, and scroll-ducking. The `heroImageUrl`
   *  doubles as the poster + reduced-motion fallback. Leave blank to use the
   *  classic static hero. */
  heroVideoUrl?: string;
  /** Optional URL of a separate trailer video shown in a modal when the
   *  user clicks the secondary CTA ("Watch the trailer"). When omitted,
   *  the modal falls back to `heroVideoUrl`. Supports native video files
   *  (.mp4/.webm/.mov) and YouTube/Vimeo/Loom share URLs. */
  heroTrailerUrl?: string;
  heroVisionChipText: string;
  heroScrollLabel: string;

  // Marquee
  marqueeItems: SpatialTourMarqueeItem[];

  // Manifesto
  manifestoEyebrow: string;
  manifestoHeadlineLine1: string;
  manifestoHeadlineEmphasis: string;
  manifestoBody1: string;
  manifestoBody2: string;
  manifestoImageUrl: string;
  manifestoCaption: string;

  // Tour intro + stations
  tourEyebrow: string;
  tourHeadlineLine1: string;
  tourHeadlineEmphasis: string;
  tourHeadlineLine3: string;
  tourBody: string;
  tourStations: SpatialTourStation[];

  // Spatial callout
  calloutEyebrow: string;
  calloutHeadlineLine1: string;
  calloutHeadlineLine2: string;
  calloutHeadlineEmphasis: string;
  calloutPoints: SpatialTourCalloutPoint[];

  // Four ways
  waysEyebrow: string;
  waysHeadlineLine1: string;
  waysHeadlineEmphasis: string;
  ways: SpatialTourWay[];

  // Calendar / RSVP
  calendarEyebrow: string;
  calendarHeadlineLine1: string;
  calendarHeadlineEmphasis: string;
  calendarBody: string;
  calendarPrimaryCta: string;
  calendarSecondaryCta: string;
  calendarUrlText: string;
  calendarPanelTitle: string;
  calendarPanelEyebrow: string;
  calendarDates: SpatialTourDate[];

  // Typography
  headlineEmphasisItalic?: boolean;

  // Footer
  footerBrand: string;
  footerEyebrow: string;
  footerInfo: string;
}

/**
 * Full-bleed cinematic event landing hero — modeled on
 * `meetdandy.com/learning-center/events/after-hours-new-york`. Pairs with the
 * tenant's existing nav-header (separate block); this block is just the hero
 * canvas.
 *
 * All colors derive from the tenant brand via CSS vars (`--brand-primary`,
 * `--brand-accent`) and the `brand` prop passed by `BlockRenderer`, so Dandy
 * tenants get dark-green / lime parity while other tenants get their own
 * palette without any prop edits.
 */
export interface EventLandingHeroBlockProps {
  /** Full-bleed background image (city skyline, venue exterior, etc). */
  backgroundImage: string;
  /** Optional alt text — purely decorative by default. */
  backgroundImageAlt?: string;
  /** Focal point of the bg image as `"x% y%"` (CSS object-position). Default `"50% 50%"`. */
  backgroundFocalPoint?: string;
  /** 0–1 dark overlay on top of the image. Default 0.5. */
  backgroundOverlay?: number;
  /** Overlay color. Default `#000000`. */
  overlayColor?: string;
  /** Optional small eyebrow above the headline (e.g. "*Limited spots*"). */
  eyebrow?: string;
  /** When true (default), the eyebrow renders in italic. Set false for a
   *  straight, non-italic eyebrow. */
  eyebrowItalic?: boolean;
  /** Main headline (e.g. "Dandy After Hours: New York"). */
  headline: string;
  /** Date / location subtext shown under the headline. */
  dateText?: string;
  /** Optional secondary line under the date (e.g. venue name). */
  locationText?: string;
  /** Primary CTA pill button label. Hidden when empty. */
  ctaText?: string;
  ctaUrl?: string;
  /** CTA pill background color (resting). Defaults to the tenant's brand
   *  primary color. */
  ctaBgColor?: string;
  /** CTA pill text color (resting). Defaults to a readable foreground on
   *  the resting background. */
  ctaTextColor?: string;
  /** CTA pill background color on hover. Defaults to the tenant's brand
   *  accent color. */
  ctaHoverBgColor?: string;
  /** CTA pill text color on hover. Defaults to a readable foreground on
   *  the hover background. */
  ctaHoverTextColor?: string;
  /** When true, the CTA button gets a stronger drop shadow to lift it off
   *  the background. Default false (subtle shadow only). */
  ctaDropShadow?: boolean;
  /** Color of the CTA drop shadow. Defaults to `#000000`. Applies whether
   *  or not `ctaDropShadow` is on (the toggle controls the layered "premium"
   *  shape; this controls the tint of those shadows). */
  ctaDropShadowColor?: string;
  /** Multiplier on the shadow alpha. 1 = original look, 0 = no shadow,
   *  values up to 2 boost it. Defaults to 1. */
  ctaDropShadowIntensity?: number;
  /** When true, the CTA button gets an animated "shine" sweep across its
   *  surface every few seconds to draw the eye. Default false. */
  ctaShine?: boolean;
  /** Tint color of the animated shine sweep. Defaults to `#ffffff`. */
  ctaShineColor?: string;
  /** Opacity multiplier on the shine sweep, 0–1. Defaults to 1. */
  ctaShineIntensity?: number;
  /** Show the "SCROLL DOWN" indicator at the bottom. Default true. */
  showScrollIndicator?: boolean;
  /** Label rendered above the scroll-down chevron. Default "SCROLL DOWN". */
  scrollLabel?: string;
  /** Optional anchor id (without `#`) to smooth-scroll into when the indicator
   *  is clicked. When unset, falls back to scrolling one viewport down. */
  scrollTargetId?: string;
  /** Min hero height. Default `100vh`. */
  minHeight?: string;
  /** Content alignment. Default `center`. */
  align?: "center" | "left";
  /** Headline max-width in characters (ch). Default 18. */
  headlineMaxWidthCh?: number;
  /** Headline font-size multiplier (1 = default). Range ~0.6–1.6. */
  headlineFontScale?: number;
  /** Date subtext font-size multiplier (1 = default). Range ~0.6–1.6. */
  dateFontScale?: number;

  /** When true, render the second details/RSVP section under the hero. */
  showDetailsSection?: boolean;
  /** Background style for the details section. Default `"light-gray"`. */
  detailsBackgroundStyle?: "white" | "light-gray" | "muted" | "dark" | "dandy-green" | "black";
  /** Anchor id for the details section (for scroll-down target). Default `"rsvp"`. */
  detailsAnchorId?: string;

  /** Left column: "What to expect" heading. */
  whatToExpectHeading?: string;
  /** Left column: "What to expect" body paragraph. */
  whatToExpectBody?: string;
  /** Left column: "Event Details" heading. */
  eventDetailsHeading?: string;
  /** Left column: "Event Details" body paragraph (shown above bullets). */
  eventDetailsBody?: string;
  /** Left column: bullet list under "Event Details". */
  eventDetailsBullets?: string[];

  /** Right column: form heading shown above the embedded form. */
  formHeading?: string;
  /** Right column: short subheading shown under `formHeading`. */
  formSubheading?: string;
  /** Right column: id of a global form (from /api/lp/forms) to embed. */
  formId?: number;

  /** Form mode. "native" (default) uses the global form picked via `formId`;
   *  "marketo" embeds a Marketo form using the marketo* fields below. */
  formMode?: "native" | "marketo";
  /** Marketo instance base URL, e.g. "//app-XXX.marketo.com". */
  marketoBaseUrl?: string;
  /** Munchkin ID, e.g. "123-ABC-456". */
  marketoMunchkinId?: string;
  /** Numeric Marketo form ID. */
  marketoFormId?: number;

  /** Optional top padding (rem) on the left column to vertically align with the
   *  right column when the form is taller. Default 0. */
  leftColumnTopPadding?: number;
  /** Optional top padding (rem) on the right column to align with the left
   *  column when the copy is taller. Default 0. */
  rightColumnTopPadding?: number;

  /** Width ratio (fr) for the copy column relative to the form column. Default
   *  1.05. Range ~0.5–2.5. (Form column is fixed at 1fr.) */
  copyColumnWidth?: number;
  /** When true, the form column appears on the LEFT and the copy column on
   *  the RIGHT. Default false (copy left, form right). */
  swapColumns?: boolean;

  /** Optional third section under the existing two left-column sections, for
   *  additional details (e.g. parking, dress code, sponsors). Hidden when
   *  both heading and body are empty. */
  extraSectionHeading?: string;
  extraSectionBody?: string;
}
