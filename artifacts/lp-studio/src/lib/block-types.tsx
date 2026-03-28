import type React from "react";
import type { BackgroundStyle } from "./bg-styles";

export type BlockCategory = "Layout" | "Content" | "Social Proof" | "CTA" | "Lead Capture" | "Engagement" | "Interactive" | "DSO" | "DSO Practices";

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

export interface BlockSettings {
  anchorId?: string;
  spacingTop?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  spacingBottom?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  textScale?: "75" | "85" | "90" | "100" | "110" | "125" | "150";
  paddingX?: "none" | "sm" | "md" | "lg" | "xl";
  minHeight?: "none" | "25" | "50" | "75" | "100";
  bgColor?: string;
  textColor?: string;
  headlineColor?: string;
  bodyColor?: string;
  cardBgColor?: string;
  animationStyle?: "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-in" | "none";
  animationDelay?: number;
  bgImageUrl?: string;
  bgImageParallax?: boolean;
  bgImageOpacity?: number;
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
}

export interface CaseStudyItem {
  image: string;
  logoUrl: string;
  title: string;
  categories: string;
  url: string;
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

export interface ResourceItem {
  image: string;
  title: string;
  description: string;
  category: string;
  url: string;
}

export interface ResourcesBlockProps {
  headline: string;
  subheadline: string;
  columns: 2 | 3 | 4 | 5;
  items: ResourceItem[];
  backgroundStyle: BackgroundStyle;
}

export interface RichTextBlockProps {
  html: string;
}

export interface CustomHtmlBlockProps {
  html: string;
}

export interface SpacerBlockProps {
  height: number;
  backgroundColor: string;
}

export interface DsoInsightsDashboardBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  practiceLabel: string;
  backgroundStyle: BackgroundStyle;
  dashboardVariant: "light" | "dark";
}

export interface DsoLabTourBlockProps {
  eyebrow: string;
  headline: string;
  body: string;
  quote: string;
  quoteAttribution: string;
  imageUrl: string;
  videoUrl: string;
  ctaText: string;
  ctaUrl: string;
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
}

export interface DsoStatBarBlockProps {
  stats: { value: string; label: string }[];
  backgroundStyle: BackgroundStyle;
}

export interface DsoHeartlandHeroBlockProps {
  headline: string;
  companyName: string;
  eyebrow?: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  backgroundImageUrl?: string;
  stats: { value: string; label: string }[];
  showScrollIndicator?: boolean;
}

export interface DsoSuccessStoriesBlockProps {
  eyebrow: string;
  headline: string;
  cases: { name: string; stat: string; label: string; quote: string; author: string; image?: string }[];
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
}

export interface DsoChallengesBlockProps {
  eyebrow: string;
  headline: string;
  backgroundStyle: BackgroundStyle;
  layout: "4-col" | "2-col";
  challenges: { title: string; desc: string }[];
  backgroundImage?: string;
  backgroundOverlay?: number;
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
}

export interface DsoAiFeatureBlockProps {
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  stats: { value: string; label: string }[];
  imageUrl: string;
}

export interface DsoStatShowcaseBlockProps {
  eyebrow: string;
  headline: string;
  stats: { value: string; label: string; description?: string }[];
}

export interface DsoScrollStoryChapter {
  headline: string;
  body: string;
  imageUrl: string;
}

export interface DsoScrollStoryBlockProps {
  eyebrow: string;
  chapters: DsoScrollStoryChapter[];
}

export interface DsoScrollStoryHeroBlockProps {
  eyebrow: string;
  chapters: DsoScrollStoryChapter[];
  ctaText?: string;
  ctaUrl?: string;
  imagePosition?: "left" | "right";
}

export interface DsoNetworkMapBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface DsoCaseFlowStage {
  number?: string;
  label: string;
  metric: string;
  metricLabel: string;
  body: string;
}

export interface DsoCaseFlowBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  stages?: DsoCaseFlowStage[];
}

export interface DsoLiveFeedBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  footerNote?: string;
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
}

export interface DsoFlowCanvasBlockProps {
  eyebrow?: string;
  quote?: string;
  attribution?: string;
  stat?: string;
  statLabel?: string;
  imageUrl?: string;
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
}

/* ─── DSO Practices Segment: 8 net-new blocks ─────────────────────────────── */

export interface DsoMeetTeamMember {
  name: string;
  role: string;
  photo?: string;
  email?: string;
  calendlyUrl?: string;
}

export interface DsoMeetTeamBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
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
}

export interface DsoActivationStep {
  step: string;
  title: string;
  desc: string;
}

export interface DsoActivationStepsBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  steps: DsoActivationStep[];
  ctaText?: string;
  ctaUrl?: string;
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
  backgroundStyle?: BackgroundStyle;
}

export interface DsoPracticeHeroBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  trustLine?: string;
  backgroundStyle?: BackgroundStyle;
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
  backgroundStyle?: BackgroundStyle;
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
  backgroundStyle?: BackgroundStyle;
}

export interface DsoSplitFeatureBlockProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  bullets?: string[];
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  imagePosition?: "left" | "right";
  backgroundStyle?: BackgroundStyle;
}

/* ─── end DSO Practices types ────────────────────────────────────────────── */

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
}

export interface DsoFinalCtaBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
}

export interface DsoComparisonBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  companyName: string;
  ctaText: string;
  ctaUrl: string;
  rows: { need: string; dandy: string; traditional: string }[];
  backgroundStyle: BackgroundStyle;
  tableNeedColor?: string;
  tableDandyColor?: string;
  tableTraditionalColor?: string;
  headerDandyColor?: string;
  backgroundImage?: string;
  backgroundOverlay?: number;
}

export type FormFieldType = "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "hidden";

/** Condition that controls whether a step or field is shown */
export interface StepCondition {
  /** The field ID whose value we check */
  fieldId: string;
  /** How to compare */
  operator: "equals" | "not_equals" | "contains" | "any_of";
  /** The value(s) to compare against. For "any_of", pipe-separated: "A|B|C" */
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  /** Static value or template variable for hidden fields (e.g. "{{utm_source}}", "Website") */
  defaultValue?: string;
  /** If set, this field is only visible when the condition is met */
  visibilityCondition?: StepCondition;
}

export interface FormStep {
  title: string;
  fields: FormField[];
  /** If set, this entire step is only shown when the condition is met */
  condition?: StepCondition;
}

export interface FormBlockProps {
  headline: string;
  subheadline: string;
  multiStep: boolean;
  steps: FormStep[];
  submitButtonText: string;
  submitButtonTextColor?: string;
  successMessage: string;
  redirectUrl: string;
  backgroundStyle: BackgroundStyle;
  formId?: number;
}

export interface ZigzagFeatureRow {
  tag: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
  chilipiperUrl?: string;
  imageUrl: string;
}

export interface ZigzagFeaturesBlockProps {
  rows: ZigzagFeatureRow[];
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export interface ProductShowcaseCard {
  name: string;
  description: string;
  badge: string;
  image?: string;
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

export interface NavHeaderLink {
  label: string;
  url: string;
}

export interface NavHeaderCta {
  label: string;
  url: string;
}

export interface NavHeaderBlockProps {
  logoText: string;
  logoUrl: string;
  navLinks: NavHeaderLink[];
  phone: string;
  cta1: NavHeaderCta;
  cta2: NavHeaderCta;
}

export interface CtaButtonBlockProps {
  label: string;
  url: string;
  style: "primary" | "secondary" | "outline";
  size: "small" | "medium" | "large";
  alignment: "left" | "center" | "right";
  bgColor: string;
  ctaAction?: "url" | "chilipiper";
  chilipiperUrl?: string;
}

export interface FooterLink {
  label: string;
  url: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
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

export type PopupTrigger = "exit-intent" | "scroll-percent" | "time-delay" | "click";

export interface PopupBlockProps {
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  imageUrl: string;
  trigger: PopupTrigger;
  triggerValue: number;
  showOnce: boolean;
  overlayOpacity: number;
  position: "center" | "bottom-left" | "bottom-right";
  backgroundStyle: BackgroundStyle;
  // Chili Piper calendar CTA
  ctaType: "url" | "chilipiper";
  chilipiperUrl: string;
  chilipiperCaptureName: boolean;
}

export interface StickyBarBlockProps {
  text: string;
  ctaText: string;
  ctaUrl: string;
  ctaAction?: "url" | "chilipiper";
  chilipiperUrl?: string;
  ctaColor: string;
  position: "top" | "bottom";
  backgroundStyle: BackgroundStyle | "brand";
  showAfterScroll: number;
  dismissible: boolean;
}

export interface RoiInputField {
  id: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  inputType: "number" | "slider";
}

export interface RoiOutputField {
  id: string;
  label: string;
  formula: string;
  format: "currency" | "number" | "percent";
  decimals: number;
  highlight?: boolean;
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

type BlockVariant =
  | { type: "hero"; props: HeroBlockProps }
  | { type: "trust-bar"; props: TrustBarBlockProps }
  | { type: "pas-section"; props: PasSectionBlockProps }
  | { type: "comparison"; props: ComparisonBlockProps }
  | { type: "stat-callout"; props: StatCalloutBlockProps }
  | { type: "benefits-grid"; props: BenefitsGridBlockProps }
  | { type: "testimonial"; props: TestimonialBlockProps }
  | { type: "how-it-works"; props: HowItWorksBlockProps }
  | { type: "product-grid"; props: ProductGridBlockProps }
  | { type: "photo-strip"; props: PhotoStripBlockProps }
  | { type: "bottom-cta"; props: BottomCtaBlockProps }
  | { type: "video-section"; props: VideoSectionBlockProps }
  | { type: "case-studies"; props: CaseStudiesBlockProps }
  | { type: "resources"; props: ResourcesBlockProps }
  | { type: "rich-text"; props: RichTextBlockProps }
  | { type: "custom-html"; props: CustomHtmlBlockProps }
  | { type: "zigzag-features"; props: ZigzagFeaturesBlockProps }
  | { type: "product-showcase"; props: ProductShowcaseBlockProps }
  | { type: "nav-header"; props: NavHeaderBlockProps }
  | { type: "cta-button"; props: CtaButtonBlockProps }
  | { type: "full-bleed-hero"; props: FullBleedHeroBlockProps }
  | { type: "footer"; props: FooterBlockProps }
  | { type: "form"; props: FormBlockProps }
  | { type: "popup"; props: PopupBlockProps }
  | { type: "sticky-bar"; props: StickyBarBlockProps }
  | { type: "roi-calculator"; props: RoiCalculatorBlockProps }
  | { type: "spacer"; props: SpacerBlockProps }
  | { type: "dso-insights-dashboard"; props: DsoInsightsDashboardBlockProps }
  | { type: "dso-lab-tour"; props: DsoLabTourBlockProps }
  | { type: "dso-stat-bar"; props: DsoStatBarBlockProps }
  | { type: "dso-success-stories"; props: DsoSuccessStoriesBlockProps }
  | { type: "dso-challenges"; props: DsoChallengesBlockProps }
  | { type: "dso-pilot-steps"; props: DsoPilotStepsBlockProps }
  | { type: "dso-final-cta"; props: DsoFinalCtaBlockProps }
  | { type: "dso-comparison"; props: DsoComparisonBlockProps }
  | { type: "dso-heartland-hero"; props: DsoHeartlandHeroBlockProps }
  | { type: "dso-problem"; props: DsoProblemBlockProps }
  | { type: "dso-ai-feature"; props: DsoAiFeatureBlockProps }
  | { type: "dso-stat-showcase"; props: DsoStatShowcaseBlockProps }
  | { type: "dso-scroll-story"; props: DsoScrollStoryBlockProps }
  | { type: "dso-scroll-story-hero"; props: DsoScrollStoryHeroBlockProps }
  | { type: "dso-network-map"; props: DsoNetworkMapBlockProps }
  | { type: "dso-case-flow"; props: DsoCaseFlowBlockProps }
  | { type: "dso-live-feed"; props: DsoLiveFeedBlockProps }
  | { type: "dso-particle-mesh"; props: DsoParticleMeshBlockProps }
  | { type: "dso-flow-canvas"; props: DsoFlowCanvasBlockProps }
  | { type: "dso-bento-outcomes"; props: DsoBentoOutcomesBlockProps }
  | { type: "dso-cta-capture"; props: DsoCtaCaptureBlockProps }
  | { type: "dso-meet-team"; props: DsoMeetTeamBlockProps }
  | { type: "dso-paradigm-shift"; props: DsoParadigmShiftBlockProps }
  | { type: "dso-partnership-perks"; props: DsoPartnershipPerksBlockProps }
  | { type: "dso-products-grid"; props: DsoProductsGridBlockProps }
  | { type: "dso-promo-cards"; props: DsoPromoCardsBlockProps }
  | { type: "dso-activation-steps"; props: DsoActivationStepsBlockProps }
  | { type: "dso-promises"; props: DsoPromisesBlockProps }
  | { type: "dso-testimonials"; props: DsoTestimonialsBlockProps }
  | { type: "dso-practice-hero"; props: DsoPracticeHeroBlockProps }
  | { type: "dso-stat-row"; props: DsoStatRowBlockProps }
  | { type: "dso-faq"; props: DsoFaqBlockProps }
  | { type: "dso-split-feature"; props: DsoSplitFeatureBlockProps };

export type PageBlock = { id: string; blockSettings?: BlockSettings } & BlockVariant;

export type BlockType = PageBlock["type"];

export interface BlockDefinition {
  type: BlockType;
  label: string;
  category: BlockCategory;
  defaultProps: () => PageBlock["props"];
  thumbnail: () => React.ReactElement;
}

export const BLOCK_REGISTRY: BlockDefinition[] = [
  {
    type: "hero",
    label: "Hero",
    category: "Layout",
    defaultProps: (): HeroBlockProps => ({
      headline: "The Dental Lab Your Patients Will Thank You For",
      subheadline: "Dandy's digital-first lab delivers crowns, bridges, and implants in 5 days — with a fit rate your old lab never came close to.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
      ctaColor: "#C7E738",
      heroType: "static-image",
      layout: "centered",
      backgroundStyle: "white",
      showSocialProof: true,
      socialProofText: "Trusted by 12,000+ dental practices across the US",
      imageUrl: "",
      mediaUrl: "",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="20" y="14" width="80" height="8" rx="2" fill="#C7E738" opacity="0.9" />
        <rect x="30" y="26" width="60" height="4" rx="1" fill="white" opacity="0.5" />
        <rect x="35" y="34" width="50" height="4" rx="1" fill="white" opacity="0.3" />
        <rect x="42" y="44" width="36" height="10" rx="5" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "trust-bar",
    label: "Trust Bar",
    category: "Social Proof",
    defaultProps: (): TrustBarBlockProps => ({
      items: [
        { value: "12,000+", label: "Dental Practices" },
        { value: "48 hrs", label: "Avg. Turnaround" },
        { value: "99.2%", label: "Perfect Fit Rate" },
        { value: "#1", label: "Rated Digital Lab" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        {([0,1,2,3] as const).map(i => (
          <g key={i} transform={`translate(${8 + i * 28}, 20)`}>
            <rect width="22" height="7" rx="1" fill="#003A30" opacity="0.8" />
            <rect width="18" height="5" rx="1" fill="#94a3b8" opacity="0.5" y="11" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "pas-section",
    label: "PAS Section",
    category: "Content",
    defaultProps: (): PasSectionBlockProps => ({
      headline: "Your lab is costing you more than money.",
      body: "Every remake is a missed appointment slot. Every three-week turnaround is a patient who calls to ask 'is it ready yet?' — and considers switching practices.",
      bullets: [
        "Remakes eating into your margins with no explanation",
        "No visibility — you call, they say 'still in production'",
        "Inconsistent fits that lead to chair-side adjustments",
        "3–4 week waits that frustrate your best patients",
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="10" width="70" height="7" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="10" y="22" width="100" height="4" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="10" y="29" width="90" height="4" rx="1" fill="#94a3b8" opacity="0.4" />
        {([0,1,2,3] as const).map(i => (
          <g key={i} transform={`translate(10, ${40 + i * 8})`}>
            <circle cx="3" cy="3" r="2" fill="#C7E738" />
            <rect x="8" y="1" width="60" height="4" rx="1" fill="#94a3b8" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "comparison",
    label: "Comparison",
    category: "Content",
    defaultProps: (): ComparisonBlockProps => ({
      headline: "A paradigm shift for your practice.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
      oldWayLabel: "Traditional Lab",
      oldWayBullets: [
        "Remake-prone analog workflows",
        "Annoying calls saying your scan is bad",
        "2–3 week waits for zirconia crowns",
        "Multiple labs, none specializing",
      ],
      newWayLabel: "Dandy",
      newWayBullets: [
        "Scan for everything with fewer remakes",
        "Get scans reviewed with patient in chair",
        "5-day zirconia crowns",
        "One lab for everything",
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="50" height="54" rx="3" fill="#fee2e2" opacity="0.7" />
        <rect x="62" y="8" width="50" height="54" rx="3" fill="#dcfce7" opacity="0.7" />
        <rect x="14" y="16" width="38" height="4" rx="1" fill="#ef4444" opacity="0.6" />
        <rect x="68" y="16" width="38" height="4" rx="1" fill="#003A30" opacity="0.7" />
        {([0,1,2] as const).map(i => (
          <g key={i}>
            <rect x="14" y={26 + i * 10} width="32" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
            <rect x="68" y={26 + i * 10} width="32" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "stat-callout",
    label: "Stat Callout",
    category: "Social Proof",
    defaultProps: (): StatCalloutBlockProps => ({
      stat: "89%",
      description: "Average reduction in remakes when partnering with Dandy",
      footnote: "Based on statistics from real dentists who switched from traditional labs.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <text x="60" y="36" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#C7E738" fontFamily="sans-serif">89%</text>
        <rect x="25" y="44" width="70" height="4" rx="1" fill="white" opacity="0.4" />
        <rect x="35" y="52" width="50" height="3" rx="1" fill="white" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "benefits-grid",
    label: "Benefits Grid",
    category: "Content",
    defaultProps: (): BenefitsGridBlockProps => ({
      headline: "Why 12,000+ dentists switched to Dandy",
      columns: 3,
      items: [
        { icon: "Zap", title: "5-Day Crowns", description: "Same-day scans shipped overnight. Your patients stop waiting — and stop cancelling." },
        { icon: "ScanLine", title: "No More Impressions", description: "Digital scans sent directly from your iTero or 3Shape. No putty, no remakes, no mess." },
        { icon: "RefreshCcw", title: "Free Remakes", description: "If a case doesn't fit, we remake it for free. No questions, no arguments." },
        { icon: "HeadphonesIcon", title: "Dedicated Lab Tech", description: "A real person answers your calls. Your cases, your preferences, remembered every time." },
        { icon: "BarChart2", title: "Real-Time Case Tracking", description: "Know exactly where every case is — from scan to delivery — on your phone or desktop." },
        { icon: "DollarSign", title: "Transparent Pricing", description: "Flat per-unit pricing. No surprises, no hidden fees, no annual contracts." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="8" width="70" height="6" rx="2" fill="#003A30" opacity="0.7" />
        {([0,1,2,3,4,5] as const).map(i => (
          <g key={i} transform={`translate(${10 + (i % 3) * 36}, ${22 + Math.floor(i / 3) * 22})`}>
            <rect width="30" height="18" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <rect x="4" y="4" width="8" height="6" rx="1" fill="#C7E738" opacity="0.7" />
            <rect x="4" y="12" width="18" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "testimonial",
    label: "Testimonial",
    category: "Social Proof",
    defaultProps: (): TestimonialBlockProps => ({
      quote: "Switching to Dandy was the single best business decision I made last year. My remakes dropped from 11% to under 1%, and my patients actually compliment how fast their restorations arrive.",
      author: "Dr. Sarah Chen",
      role: "General Dentist",
      practiceName: "Bright Smile Family Dentistry, Austin TX",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f0fdf4" rx="4" />
        <text x="14" y="24" fontSize="28" fill="#003A30" opacity="0.5" fontFamily="serif">"</text>
        <rect x="22" y="14" width="86" height="4" rx="1" fill="#003A30" opacity="0.4" />
        <rect x="22" y="22" width="78" height="4" rx="1" fill="#003A30" opacity="0.3" />
        <rect x="22" y="30" width="60" height="4" rx="1" fill="#003A30" opacity="0.2" />
        <circle cx="20" cy="52" r="8" fill="#94a3b8" opacity="0.4" />
        <rect x="32" y="48" width="40" height="4" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="32" y="56" width="30" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
      </svg>
    ),
  },
  {
    type: "how-it-works",
    label: "How It Works",
    category: "Content",
    defaultProps: (): HowItWorksBlockProps => ({
      headline: "Simple to start. Even simpler to stay.",
      steps: [
        { number: "01", title: "Scan & Send", description: "Take an intraoral scan with your existing scanner. Send it to Dandy in seconds." },
        { number: "02", title: "We Manufacture", description: "Your case enters Dandy's digital lab immediately. A dedicated tech reviews every scan." },
        { number: "03", title: "Delivered to Your Door", description: "Your restoration arrives in 5 business days — tracked the whole way." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="8" width="70" height="6" rx="2" fill="#003A30" opacity="0.7" />
        {([0,1,2] as const).map(i => (
          <g key={i} transform={`translate(${10 + i * 36}, 22)`}>
            <circle cx="12" cy="12" r="12" fill="#003A30" opacity="0.15" />
            <text x="12" y="16" textAnchor="middle" fontSize="8" fill="#003A30" opacity="0.7" fontFamily="sans-serif" fontWeight="bold">0{i + 1}</text>
            <rect x="0" y="28" width="24" height="4" rx="1" fill="#003A30" opacity="0.5" />
            <rect x="0" y="36" width="20" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "product-grid",
    label: "Product Grid",
    category: "Content",
    defaultProps: (): ProductGridBlockProps => ({
      headline: "The better way to do lab work.",
      subheadline: "Perfect fit. Fast turnarounds. One connected system.",
      items: [
        { image: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?q=80&w=600&h=400&fit=crop", title: "Dentures", description: "2-appointment dentures using Dandy's streamlined digital workflow." },
        { image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&h=400&fit=crop", title: "Posterior Crowns", description: "AI-perfected posterior crowns in 5 days." },
        { image: "https://images.unsplash.com/photo-1516914943479-89db7d9ae7f3?q=80&w=600&h=400&fit=crop", title: "Anterior Crowns", description: "Premium anterior crowns for stunning aesthetics." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="30" y="8" width="60" height="5" rx="1" fill="#003A30" opacity="0.6" />
        {([0,1,2] as const).map(i => (
          <g key={i} transform={`translate(${8 + i * 36}, 18)`}>
            <rect width="28" height="20" rx="2" fill="#e2e8f0" />
            <rect width="28" height="8" rx="1" fill="#94a3b8" opacity="0.5" y="24" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "photo-strip",
    label: "Photo Strip",
    category: "Layout",
    defaultProps: (): PhotoStripBlockProps => ({
      images: [
        { src: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&fit=crop", alt: "Dental restoration" },
        { src: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=600&fit=crop", alt: "Dental lab work" },
        { src: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=600&fit=crop", alt: "Digital dental scan" },
        { src: "https://images.unsplash.com/photo-1516914943479-89db7d9ae7f3?q=80&w=600&fit=crop", alt: "Dental care" },
        { src: "https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=600&fit=crop", alt: "Smile transformation" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#1e293b" rx="4" />
        {([0,1,2,3,4] as const).map(i => (
          <rect key={i} x={4 + i * 23} y="8" width="20" height="54" rx="2" fill="#334155" />
        ))}
      </svg>
    ),
  },
  {
    type: "bottom-cta",
    label: "Bottom CTA",
    category: "CTA",
    defaultProps: (): BottomCtaBlockProps => ({
      headline: "Ready to upgrade your lab — with zero risk?",
      subheadline: "No contracts. No setup fees. Free shipping both ways.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="20" y="12" width="80" height="8" rx="2" fill="white" opacity="0.7" />
        <rect x="30" y="24" width="60" height="4" rx="1" fill="white" opacity="0.3" />
        <rect x="38" y="36" width="44" height="14" rx="7" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "video-section",
    label: "Video Section",
    category: "Content",
    defaultProps: (): VideoSectionBlockProps => ({
      layout: "full-width",
      headline: "",
      subheadline: "",
      ctaText: "",
      ctaUrl: "",
      videoUrl: "",
      aspectRatio: "16/9",
      backgroundStyle: "white",
      videoAutoplay: false,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f1f5f9" rx="4" />
        <rect x="15" y="10" width="90" height="50" rx="3" fill="#e2e8f0" />
        <polygon points="52,28 52,42 66,35" fill="#003A30" />
        <rect x="30" y="62" width="60" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "case-studies",
    label: "Case Studies",
    category: "Social Proof",
    defaultProps: (): CaseStudiesBlockProps => ({
      headline: "Customer Stories",
      subheadline: "",
      items: [
        { image: "", logoUrl: "", title: "How Acme unified operations across 10+ locations", categories: "SOFTWARE & TECHNOLOGY / ENTERPRISE", url: "#" },
        { image: "", logoUrl: "", title: "Beacon saves 100+ hours a month on compliance", categories: "PUBLIC SECTOR / MID-SIZE", url: "#" },
        { image: "", logoUrl: "", title: "From 2 months to 2 days: cutting audit timelines in half", categories: "HEALTHCARE & BIOTECH / ENTERPRISE", url: "#" },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="5" y="5" width="48" height="60" rx="3" fill="#e2e8f0" />
        <rect x="10" y="48" width="30" height="4" rx="1" fill="white" />
        <rect x="10" y="54" width="20" height="3" rx="1" fill="white" opacity="0.6" />
        <rect x="57" y="5" width="28" height="28" rx="3" fill="#e2e8f0" />
        <rect x="60" y="18" width="16" height="3" rx="1" fill="white" />
        <rect x="89" y="5" width="28" height="28" rx="3" fill="#e2e8f0" />
        <rect x="92" y="18" width="16" height="3" rx="1" fill="white" />
        <rect x="57" y="37" width="28" height="28" rx="3" fill="#e2e8f0" />
        <rect x="89" y="37" width="28" height="28" rx="3" fill="#e2e8f0" />
      </svg>
    ),
  },
  {
    type: "resources",
    label: "Resources",
    category: "Content",
    defaultProps: (): ResourcesBlockProps => ({
      headline: "Resources",
      subheadline: "Insights, guides, and articles to help you grow.",
      columns: 3,
      items: [
        { image: "", title: "Getting Started Guide", description: "Everything you need to know to hit the ground running.", category: "Guide", url: "#" },
        { image: "", title: "Best Practices for Growth", description: "Proven strategies from industry leaders.", category: "Article", url: "#" },
        { image: "", title: "2025 Industry Report", description: "Key trends and benchmarks for the year ahead.", category: "Report", url: "#" },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="5" y="5" width="33" height="22" rx="2" fill="#e2e8f0" />
        <rect x="5" y="30" width="28" height="3" rx="1" fill="#334155" />
        <rect x="5" y="35" width="33" height="2" rx="1" fill="#94a3b8" />
        <rect x="43" y="5" width="33" height="22" rx="2" fill="#e2e8f0" />
        <rect x="43" y="30" width="28" height="3" rx="1" fill="#334155" />
        <rect x="43" y="35" width="33" height="2" rx="1" fill="#94a3b8" />
        <rect x="82" y="5" width="33" height="22" rx="2" fill="#e2e8f0" />
        <rect x="82" y="30" width="28" height="3" rx="1" fill="#334155" />
        <rect x="82" y="35" width="33" height="2" rx="1" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: "rich-text",
    label: "Rich Text",
    category: "Content",
    defaultProps: (): RichTextBlockProps => ({
      html: "<p>Start writing your content here. Use the toolbar to format text with <strong>headings</strong>, <em>emphasis</em>, lists, and more.</p>",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="104" height="6" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="20" width="90" height="3" rx="1" fill="#94a3b8" opacity="0.6" />
        <rect x="8" y="27" width="100" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="8" y="34" width="80" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
        <circle cx="12" cy="45" r="2" fill="#C7E738" />
        <rect x="18" y="43" width="60" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
        <circle cx="12" cy="53" r="2" fill="#C7E738" />
        <rect x="18" y="51" width="50" height="3" rx="1" fill="#94a3b8" opacity="0.4" />
      </svg>
    ),
  },
  {
    type: "spacer",
    label: "Spacer",
    category: "Layout",
    defaultProps: (): SpacerBlockProps => ({ height: 64, backgroundColor: "transparent" }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <line x1="10" y1="20" x2="110" y2="20" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="10" y1="50" x2="110" y2="50" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="60" y="38" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">Spacer</text>
        <path d="M60 24 L60 28 M57 26 L60 23 L63 26" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
        <path d="M60 46 L60 42 M57 44 L60 47 L63 44" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "custom-html",
    label: "Custom HTML",
    category: "Content",
    defaultProps: (): CustomHtmlBlockProps => ({
      html: "",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#1e1e2e" rx="4" />
        <text x="8" y="22" fontSize="9" fontFamily="monospace" fill="#89b4fa">&lt;div</text>
        <text x="36" y="22" fontSize="9" fontFamily="monospace" fill="#a6e3a1"> class=</text>
        <text x="74" y="22" fontSize="9" fontFamily="monospace" fill="#f38ba8">"block"</text>
        <text x="104" y="22" fontSize="9" fontFamily="monospace" fill="#89b4fa">&gt;</text>
        <rect x="14" y="27" width="60" height="3" rx="1" fill="#cdd6f4" opacity="0.4" />
        <rect x="14" y="34" width="80" height="3" rx="1" fill="#cdd6f4" opacity="0.3" />
        <text x="8" y="48" fontSize="9" fontFamily="monospace" fill="#89b4fa">&lt;/div&gt;</text>
      </svg>
    ),
  },
  {
    type: "zigzag-features",
    label: "Zigzag Features",
    category: "Content",
    defaultProps: (): ZigzagFeaturesBlockProps => ({
      rows: [
        {
          tag: "SPEED",
          headline: "5-Day Turnarounds, Every Time",
          body: "Dandy's digital-first lab ships crowns, bridges, and implants in just 5 business days — tracked end-to-end so you always know where your case is.",
          ctaText: "Learn more",
          ctaUrl: "#",
          imageUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&h=600&fit=crop",
        },
        {
          tag: "ACCURACY",
          headline: "Perfect Fit, Guaranteed",
          body: "AI-powered scan analysis catches issues before manufacturing. If a case doesn't fit, we remake it free — no questions asked.",
          ctaText: "Learn more",
          ctaUrl: "#",
          imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=800&h=600&fit=crop",
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="6" y="8" width="48" height="22" rx="2" fill="#e2e8f0" />
        <rect x="62" y="8" width="52" height="5" rx="1" fill="#C7E738" opacity="0.7" />
        <rect x="62" y="17" width="48" height="3" rx="1" fill="#003A30" opacity="0.6" />
        <rect x="62" y="24" width="44" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="62" y="40" width="48" height="22" rx="2" fill="#e2e8f0" />
        <rect x="6" y="40" width="52" height="5" rx="1" fill="#C7E738" opacity="0.7" />
        <rect x="6" y="49" width="48" height="3" rx="1" fill="#003A30" opacity="0.6" />
        <rect x="6" y="56" width="44" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "product-showcase",
    label: "Product Showcase",
    category: "Content",
    defaultProps: (): ProductShowcaseBlockProps => ({
      headline: "Everything Your Practice Needs",
      subheadline: "One lab for all your restorations — delivered faster and with better fit.",
      columns: 3,
      cards: [
        { name: "Crowns & Bridges", description: "Zirconia, PFM, and full-cast options with 5-day turnaround.", badge: "FROM $69/UNIT" },
        { name: "Implant Restorations", description: "Custom abutments and crowns for all major implant systems.", badge: "FROM $149/UNIT" },
        { name: "Dentures", description: "Complete and partial dentures using a streamlined 2-appointment workflow.", badge: "FROM $299/UNIT" },
        { name: "Aligners", description: "Clear aligner therapy powered by Dandy's digital workflow.", badge: "FROM $99/CASE" },
        { name: "Night Guards", description: "Hard and soft night guards with same-week turnaround.", badge: "FROM $49/UNIT" },
        { name: "Veneers", description: "Premium feldspathic and pressed porcelain veneers.", badge: "FROM $99/UNIT" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="20" y="6" width="80" height="5" rx="1" fill="#003A30" opacity="0.7" />
        <rect x="25" y="14" width="70" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
        {([0,1,2] as const).map(i => (
          <g key={i} transform={`translate(${5 + i * 38}, 22)`}>
            <rect width="33" height="38" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <rect x="4" y="4" width="25" height="3" rx="1" fill="#003A30" opacity="0.7" />
            <rect x="4" y="10" width="22" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
            <rect x="4" y="14" width="22" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
            <rect x="4" y="22" width="25" height="8" rx="2" fill="#C7E738" opacity="0.6" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "nav-header",
    label: "Nav Header",
    category: "Layout",
    defaultProps: (): NavHeaderBlockProps => ({
      logoText: "Dandy",
      logoUrl: "",
      navLinks: [
        { label: "Products", url: "#" },
        { label: "How It Works", url: "#" },
        { label: "Pricing", url: "#" },
        { label: "Resources", url: "#" },
      ],
      phone: "1-800-DANDY-LAB",
      cta1: { label: "Log In", url: "#" },
      cta2: { label: "Get Started Free", url: "#" },
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect width="120" height="20" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="6" y="7" width="18" height="6" rx="1" fill="#003A30" opacity="0.8" />
        {([0,1,2,3] as const).map(i => (
          <rect key={i} x={34 + i * 14} y="9" width="10" height="3" rx="1" fill="#94a3b8" opacity="0.6" />
        ))}
        <rect x="80" y="6" width="16" height="8" rx="4" fill="#e2e8f0" />
        <rect x="99" y="6" width="16" height="8" rx="4" fill="#003A30" opacity="0.8" />
        <rect x="8" y="28" width="60" height="5" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="8" y="37" width="90" height="3" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="8" y="44" width="80" height="3" rx="1" fill="#94a3b8" opacity="0.25" />
      </svg>
    ),
  },
  {
    type: "cta-button",
    label: "CTA Button",
    category: "CTA",
    defaultProps: (): CtaButtonBlockProps => ({
      label: "Get Started Free",
      url: "#",
      style: "primary",
      size: "medium",
      alignment: "center",
      bgColor: "#C7E738",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="25" y="25" width="70" height="20" rx="10" fill="#C7E738" />
        <rect x="35" y="31" width="50" height="8" rx="2" fill="#003A30" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "footer",
    label: "Footer",
    category: "Layout",
    defaultProps: (): FooterBlockProps => ({
      backgroundColor: "#003A30",
      accentColor: "#C7E738",
      copyrightText: `© ${new Date().getFullYear()} Dandy. All rights reserved.`,
      showSocialLinks: false,
      facebookUrl: "",
      instagramUrl: "",
      linkedinUrl: "",
      columns: [
        {
          title: "Dandy",
          links: [
            { label: "Home", url: "https://www.meetdandy.com/" },
            { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
            { label: "Get in touch", url: "https://www.meetdandy.com/get-in-touch/" },
            { label: "Dandy Reviews", url: "https://www.meetdandy.com/reviews/" },
            { label: "Careers", url: "https://www.meetdandy.com/careers/" },
          ],
        },
        {
          title: "Products & Technology",
          links: [
            { label: "Lab Services", url: "https://www.meetdandy.com/lab-services/" },
            { label: "Posterior Crown and Bridge", url: "https://www.meetdandy.com/posterior-crown-and-bridge/" },
            { label: "Digital Dentures", url: "https://www.meetdandy.com/digital-dentures/" },
            { label: "Implant Solutions", url: "https://www.meetdandy.com/implant-solutions/" },
            { label: "Clear Aligners", url: "https://www.meetdandy.com/clear-aligners/" },
          ],
        },
        {
          title: "Practices",
          links: [
            { label: "Private Practice", url: "https://www.meetdandy.com/solutions/private-practice/" },
            { label: "Group Practice", url: "https://www.meetdandy.com/solutions/group-practice/" },
            { label: "DSO", url: "https://www.meetdandy.com/solutions/dso/" },
            { label: "Login", url: "https://app.meetdandy.com/" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Learning Center", url: "https://www.meetdandy.com/learning-center/" },
            { label: "Articles", url: "https://www.meetdandy.com/articles/" },
            { label: "Webinars", url: "https://www.meetdandy.com/webinars/" },
            { label: "Newsroom", url: "https://www.meetdandy.com/newsroom/" },
          ],
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="8" y="10" width="20" height="5" rx="1" fill="white" opacity="0.7" />
        {([0,1,2,3] as const).map(i => (
          <g key={i} transform={`translate(${8 + i * 28}, 22)`}>
            <rect width="16" height="3" rx="1" fill="#C7E738" opacity="0.8" />
            <rect width="22" height="2" rx="1" fill="white" opacity="0.3" y="6" />
            <rect width="18" height="2" rx="1" fill="white" opacity="0.3" y="11" />
            <rect width="20" height="2" rx="1" fill="white" opacity="0.3" y="16" />
          </g>
        ))}
        <rect x="8" y="58" width="50" height="2" rx="1" fill="white" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "full-bleed-hero",
    label: "Full Bleed Hero",
    category: "Layout",
    defaultProps: (): FullBleedHeroBlockProps => ({
      headline: "The Dental Lab Your Patients Will Thank You For",
      subheadline: "Dandy's digital-first lab delivers crowns, bridges, and implants in 5 days — with a fit rate your old lab never came close to.",
      ctaText: "Get Started Free",
      ctaUrl: "#",
      secondaryCtaText: "See How It Works",
      secondaryCtaUrl: "#",
      backgroundType: "image",
      backgroundImageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=1920&h=1080&fit=crop",
      backgroundVideoUrl: "",
      videoAutoplay: true,
      overlayOpacity: 55,
      minHeight: "full",
      contentAlignment: "left",
      logoImageUrl: "",
      logoUrl: "#",
      navLinks: [
        { label: "Products", url: "#" },
        { label: "How It Works", url: "#" },
        { label: "Pricing", url: "#" },
      ],
      headerCtaText: "Get Started Free",
      headerCtaUrl: "#",
      headerScrolledBg: "#003A30",
      showSocialProof: true,
      socialProofText: "Trusted by 12,000+ dental practices across the US",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="fbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#003A30" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#001a16" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="120" height="70" fill="url(#fbg)" rx="4" />
        <rect width="120" height="12" fill="rgba(0,0,0,0)" rx="0" />
        <rect x="6" y="4" width="14" height="4" rx="1" fill="white" opacity="0.8" />
        <rect x="38" y="5" width="8" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="50" y="5" width="8" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="62" y="5" width="8" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="90" y="3" width="24" height="7" rx="3.5" fill="#C7E738" />
        <rect x="8" y="22" width="72" height="8" rx="2" fill="white" opacity="0.95" />
        <rect x="8" y="34" width="60" height="6" rx="1.5" fill="white" opacity="0.55" />
        <rect x="8" y="44" width="28" height="10" rx="5" fill="#C7E738" />
        <rect x="40" y="44" width="28" height="10" rx="5" fill="rgba(255,255,255,0.15)" />
      </svg>
    ),
  },
  {
    type: "form",
    label: "Lead Capture Form",
    category: "Lead Capture",
    defaultProps: (): FormBlockProps => ({
      headline: "Get in Touch",
      subheadline: "Fill out the form below and we'll get back to you shortly.",
      multiStep: false,
      steps: [
        {
          title: "Your Information",
          fields: [
            { id: "field-name", type: "text", label: "Full Name", placeholder: "Jane Smith", required: true },
            { id: "field-email", type: "email", label: "Email Address", placeholder: "jane@example.com", required: true },
            { id: "field-phone", type: "phone", label: "Phone Number", placeholder: "(555) 000-0000", required: false },
            { id: "field-message", type: "textarea", label: "Message", placeholder: "How can we help?", required: false },
          ],
        },
      ],
      submitButtonText: "Submit",
      successMessage: "Thank you! We'll be in touch soon.",
      redirectUrl: "",
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="8" width="60" height="6" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="10" y="18" width="100" height="7" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="28" width="100" height="7" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="38" width="100" height="12" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="54" width="36" height="10" rx="5" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "popup",
    label: "Popup",
    category: "Engagement",
    defaultProps: (): PopupBlockProps => ({
      headline: "Special Offer Inside",
      body: "Get 20% off your first order when you sign up today.",
      ctaText: "Claim Offer",
      ctaUrl: "#",
      ctaColor: "#C7E738",
      imageUrl: "",
      trigger: "time-delay",
      triggerValue: 5,
      showOnce: true,
      overlayOpacity: 50,
      position: "center",
      backgroundStyle: "white",
      ctaType: "url",
      chilipiperUrl: "",
      chilipiperCaptureName: false,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="20" y="10" width="80" height="50" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="30" y="18" width="60" height="6" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="30" y="28" width="60" height="4" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="30" y="35" width="60" height="4" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="40" y="45" width="40" height="8" rx="4" fill="#C7E738" />
        <rect x="15" y="5" width="4" height="60" fill="#000000" opacity="0.2" />
        <rect x="15" y="5" width="90" height="4" fill="#000000" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "sticky-bar",
    label: "Sticky Bar",
    category: "Engagement",
    defaultProps: (): StickyBarBlockProps => ({
      text: "Limited time: Get 20% off your first purchase",
      ctaText: "Shop Now",
      ctaUrl: "#",
      ctaColor: "#C7E738",
      position: "top",
      backgroundStyle: "dark",
      showAfterScroll: 0,
      dismissible: true,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="10" y="15" width="100" height="10" rx="2" fill="#003A30" />
        <rect x="15" y="19" width="60" height="3" rx="1" fill="white" opacity="0.7" />
        <rect x="80" y="17" width="25" height="6" rx="3" fill="#C7E738" />
        <circle cx="110" cy="20" r="2" fill="white" opacity="0.7" />
        <rect x="10" y="32" width="100" height="25" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="20" y="40" width="60" height="3" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="20" y="47" width="50" height="3" rx="1" fill="#94a3b8" opacity="0.3" />
      </svg>
    ),
  },
  {
    type: "roi-calculator",
    label: "ROI Calculator",
    category: "Interactive",
    defaultProps: (): RoiCalculatorBlockProps => ({
      headline: "Calculate Your Hidden Cost of Inaction",
      subheadline: "Estimate the cost of remakes and lost chair time across your practice.",
      backgroundStyle: "white",
      resultsPanelLabel: "Your Results",
      disclaimer: "Calculations based on per-practice estimates. Actual results may vary.",
      ctaEnabled: true,
      ctaText: "Book a Demo",
      ctaUrl: "#",
      ctaAction: "url",
      chilipiperUrl: "",
      inputFields: [
        { id: "practices", label: "Number of Practices", defaultValue: 1, min: 1, max: 2000, step: 1, inputType: "number" },
        { id: "restoCases", label: "Fixed Resto Cases / Month", defaultValue: 250, min: 1, max: 9999, step: 1, inputType: "number" },
        { id: "avgCaseValue", label: "Average Case Value", defaultValue: 1500, min: 100, max: 10000, step: 50, prefix: "$", inputType: "number" },
        { id: "currentRemakeRate", label: "Current Remake Rate (%)", defaultValue: 5, min: 0.5, max: 20, step: 0.5, suffix: "%", inputType: "slider" },
        { id: "improvedRemakeRate", label: "Improved Remake Rate (%)", defaultValue: 2, min: 0, max: 20, step: 0.5, suffix: "%", inputType: "slider" },
        { id: "prodPerHour", label: "Avg Production / Hour", defaultValue: 500, min: 50, max: 5000, step: 50, prefix: "$", inputType: "number" },
        { id: "dentureCases", label: "Denture Cases / Month", defaultValue: 150, min: 0, max: 9999, step: 1, inputType: "number" },
        { id: "apptsSaved", label: "Appointments Saved per Case", defaultValue: 1.5, min: 0.5, max: 5, step: 0.5, inputType: "slider" },
        { id: "avgMinPerAppt", label: "Avg Minutes / Appointment", defaultValue: 30, min: 5, max: 120, step: 5, inputType: "number" },
        { id: "workingDays", label: "Working Days / Month", defaultValue: 20, min: 1, max: 31, step: 1, inputType: "number" },
      ],
      outputFields: [
        { id: "remakesAvoided", label: "Remakes Avoided / Month", formula: "restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)", format: "number", decimals: 1 },
        { id: "recoveredProdYear", label: "Recovered Production / Year", formula: "(restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)) * avgCaseValue * 12", format: "currency", decimals: 0 },
        { id: "dentureChairHrs", label: "Chair Hours Freed / Month", formula: "dentureCases * apptsSaved * avgMinPerAppt / 60", format: "number", decimals: 1 },
        { id: "dentureProdYear", label: "Denture Production Gain / Year", formula: "dentureCases * apptsSaved * avgMinPerAppt / 60 * prodPerHour * 12", format: "currency", decimals: 0 },
        { id: "totalAnnualUpside", label: "Total Annual Upside", formula: "((restoCases * (currentRemakeRate / 100) - restoCases * (improvedRemakeRate / 100)) * avgCaseValue * 12 + dentureCases * apptsSaved * avgMinPerAppt / 60 * prodPerHour * 12) * practices", format: "currency", decimals: 0, highlight: true },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="65" height="5" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="8" y="17" width="60" height="4" rx="1.5" fill="#e2e8f0" />
        <rect x="8" y="17" width="36" height="4" rx="1.5" fill="#003A30" opacity="0.5" />
        <rect x="8" y="25" width="60" height="4" rx="1.5" fill="#e2e8f0" />
        <rect x="8" y="25" width="50" height="4" rx="1.5" fill="#003A30" opacity="0.4" />
        <rect x="8" y="33" width="60" height="4" rx="1.5" fill="#e2e8f0" />
        <rect x="8" y="33" width="20" height="4" rx="1.5" fill="#003A30" opacity="0.4" />
        <rect x="78" y="8" width="34" height="54" rx="4" fill="#003A30" />
        <rect x="82" y="14" width="26" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="82" y="21" width="26" height="5" rx="1.5" fill="white" opacity="0.15" />
        <rect x="82" y="30" width="26" height="3" rx="1" fill="white" opacity="0.4" />
        <rect x="82" y="37" width="26" height="5" rx="1.5" fill="white" opacity="0.15" />
        <rect x="82" y="48" width="26" height="7" rx="3.5" fill="#C7E738" />
        <rect x="8" y="52" width="48" height="6" rx="3" fill="#C7E738" />
      </svg>
    ),
  },
  {
    type: "dso-insights-dashboard" as const,
    label: "DSO Insights Dashboard",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoInsightsDashboardBlockProps => ({
      eyebrow: "Dandy Hub & Insights",
      headline: "One dashboard for every location.",
      subheadline: "Dandy Insights gives {company_name} leaders actionable data — not just reports. Know where to intervene before problems scale, manage by exception, and maintain control as complexity increases.",
      practiceLabel: "practices",
      backgroundStyle: "muted",
      dashboardVariant: "light",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f0faf4" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="16" width="80" height="3" rx="1.5" fill="#94a3b8" opacity="0.5" />
        <rect x="8" y="24" width="104" height="38" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="26" width="20" height="6" rx="1.5" fill="#003A30" opacity="0.1" />
        <rect x="32" y="26" width="20" height="6" rx="1.5" fill="transparent" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="54" y="26" width="20" height="6" rx="1.5" fill="transparent" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="10" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="12" y="38" width="10" height="3" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="12" y="43" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="36" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="38" y="38" width="10" height="3" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="38" y="43" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="62" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="64" y="38" width="10" height="3" rx="1" fill="#003A30" opacity="0.5" />
        <rect x="64" y="43" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
        <rect x="88" y="36" width="22" height="12" rx="2" fill="#f0faf4" />
        <rect x="90" y="38" width="10" height="3" rx="1" fill="#C7E738" opacity="0.8" />
        <rect x="10" y="52" width="100" height="8" rx="2" fill="#e2e8f0" opacity="0.5" />
        <rect x="10" y="52" width="40" height="8" rx="2" fill="#C7E738" opacity="0.5" />
      </svg>
    ),
  },
  {
    type: "dso-lab-tour" as const,
    label: "DSO Lab Tour",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoLabTourBlockProps => ({
      eyebrow: "Built in the USA",
      headline: "See vertical integration in action.",
      body: "Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery. U.S.-based facilities, AI quality control, and expert technicians deliver a 96% first-time right rate at enterprise scale.",
      quote: "Dandy is a true partner, not just a vendor. They value education, technology, and people — that's what makes the difference.",
      quoteAttribution: "DSO Clinical Operations Officer",
      imageUrl: "https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=1400&fit=crop",
      videoUrl: "",
      ctaText: "Request a Lab Tour",
      ctaUrl: "#",
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="52" height="38" rx="3" fill="#e2e8f0" />
        <rect x="8" y="8" width="52" height="38" rx="3" fill="#003A30" opacity="0.15" />
        <circle cx="34" cy="27" r="8" fill="white" opacity="0.6" />
        <polygon points="32,24 38,27 32,30" fill="#003A30" opacity="0.7" />
        <rect x="68" y="8" width="44" height="5" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="68" y="17" width="44" height="3" rx="1.5" fill="#94a3b8" opacity="0.5" />
        <rect x="68" y="22" width="36" height="3" rx="1.5" fill="#94a3b8" opacity="0.3" />
        <rect x="68" y="31" width="44" height="8" rx="2" fill="#f0faf4" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="71" y="34" width="30" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="68" y="44" width="30" height="6" rx="3" fill="#003A30" />
        <rect x="8" y="52" width="52" height="4" rx="2" fill="#94a3b8" opacity="0.2" />
      </svg>
    ),
  },
  {
    type: "dso-stat-bar" as const,
    label: "DSO Stats Bar",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoStatBarBlockProps => ({
      stats: [
        { value: "30%", label: "Avg case acceptance lift" },
        { value: "96%", label: "First-time right rate" },
        { value: "50%", label: "Denture appointments saved" },
        { value: "$0", label: "CAPEX to get started" },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#fff" rx="4" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={10 + i*28} y="20" width="22" height="6" rx="2" fill="#003A30" opacity="0.8" />
            <rect x={10 + i*28} y="30" width="18" height="3" rx="1.5" fill="#94a3b8" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-success-stories" as const,
    label: "DSO Success Stories",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoSuccessStoriesBlockProps => ({
      eyebrow: "Proven Results",
      headline: "DSOs that switched and never looked back.",
      backgroundStyle: "dandy-green",
      cases: [
        { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann, Founder", image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=800&h=480&fit=crop" },
        { name: "Smile Brands", stat: "2–3 min", label: "saved per crown appointment", quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.", author: "VP of Clinical Operations", image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&h=480&fit=crop" },
        { name: "Tend", stat: "40%", label: "faster lab turnaround", quote: "Speed matters when you're growing fast. Dandy keeps pace with our expansion without sacrificing quality.", author: "Head of Operations", image: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=800&h=480&fit=crop" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="8" y="8" width="32" height="4" rx="2" fill="white" opacity="0.7" />
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={8 + i*38} y="18" width="32" height="44" rx="3" fill="white" opacity="0.07" />
            <rect x={12 + i*38} y="22" width="14" height="6" rx="2" fill="#C7E738" opacity="0.7" />
            <rect x={12 + i*38} y="32" width="20" height="2" rx="1" fill="white" opacity="0.4" />
            <rect x={12 + i*38} y="37" width="20" height="2" rx="1" fill="white" opacity="0.3" />
            <rect x={12 + i*38} y="42" width="16" height="2" rx="1" fill="white" opacity="0.2" />
            <rect x={12 + i*38} y="53" width="12" height="2" rx="1" fill="#C7E738" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-challenges" as const,
    label: "DSO Challenges",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoChallengesBlockProps => ({
      eyebrow: "The Hidden Cost",
      headline: "At scale — even small inefficiencies compound fast.",
      backgroundStyle: "muted",
      layout: "4-col",
      challenges: [
        { title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
        { title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
        { title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
        { title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#faf9f7" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="16" width="36" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.4" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={8 + i*29} y="24" width="24" height="38" rx="3" fill="white"
              style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.07))" }} />
            <rect x={8 + i*29} y="24" width="24" height="2" rx="1" fill="#003A30" />
            <rect x={11 + i*29} y="30" width="8" height="4" rx="1.5" fill="#003A30" opacity="0.1" />
            <rect x={11 + i*29} y="38" width="16" height="2" rx="1" fill="#94a3b8" opacity="0.5" />
            <rect x={11 + i*29} y="43" width="12" height="2" rx="1" fill="#94a3b8" opacity="0.3" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-pilot-steps" as const,
    label: "DSO Pilot Steps",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoPilotStepsBlockProps => ({
      eyebrow: "How It Works",
      headline: "Start small. Prove it out. Then scale.",
      subheadline: "Growth should be proven before it's scaled. Dandy helps validate impact with a small number of locations and then scale with confidence.",
      backgroundStyle: "muted",
      steps: [
        {
          title: "Launch a Pilot",
          subtitle: "Start with 5–10 offices",
          desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.",
          details: [
            "Premium hardware included for every operatory",
            "Dedicated field team manages change management",
            "Doctors trained and scanning within days",
          ],
        },
        {
          title: "Validate Impact",
          subtitle: "Measure results in 60–90 days",
          desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.",
          details: [
            "Live dashboard tracks pilot KPIs",
            "Compare pilot offices vs. control group",
            "Executive-ready reporting for leadership review",
          ],
        },
        {
          title: "Scale With Confidence",
          subtitle: "Roll out across the network",
          desc: "Expand across your entire network with the same standard, same playbook, and same results — predictable execution at enterprise scale.",
          details: [
            "Consistent onboarding across all locations",
            "One standard across every office and brand",
            "MSA ensures network-wide alignment at scale",
          ],
        },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#faf9f7" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <line x1="24" y1="20" x2="24" y2="62" stroke="#003A30" strokeWidth="1" opacity="0.2" />
        {[0,1,2].map(i => (
          <g key={i}>
            <circle cx="24" cy={22 + i*18} r="5" fill="#003A30" />
            <rect x="34" y={18 + i*18} width="30" height="3" rx="1.5" fill="#003A30" opacity="0.7" />
            <rect x="34" y={24 + i*18} width="50" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-final-cta" as const,
    label: "DSO Final CTA",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoFinalCtaBlockProps => ({
      eyebrow: "Next Steps",
      headline: "Prove ROI. Then scale.",
      subheadline: "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time.",
      primaryCtaText: "Get Pricing",
      primaryCtaUrl: "#",
      secondaryCtaText: "Calculate ROI",
      secondaryCtaUrl: "#",
      backgroundStyle: "dandy-green",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <circle cx="30" cy="15" r="30" fill="#C7E738" opacity="0.06" />
        <circle cx="90" cy="60" r="25" fill="#2a5240" opacity="0.5" />
        <rect x="35" y="12" width="50" height="5" rx="2.5" fill="white" opacity="0.8" />
        <rect x="25" y="22" width="70" height="3" rx="1.5" fill="white" opacity="0.4" />
        <rect x="30" y="28" width="60" height="2.5" rx="1.25" fill="white" opacity="0.3" />
        <rect x="28" y="38" width="28" height="10" rx="5" fill="#C7E738" />
        <rect x="64" y="38" width="28" height="10" rx="5" fill="transparent" stroke="white" strokeWidth="1" opacity="0.3" />
      </svg>
    ),
  },
  {
    type: "dso-comparison" as const,
    label: "DSO Comparison",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoComparisonBlockProps => ({
      eyebrow: "The Dandy Difference",
      headline: "Built for DSO scale.\nDesigned for provider trust.",
      subheadline: "Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights.",
      companyName: "Your DSO",
      ctaText: "Request a Demo",
      ctaUrl: "#",
      rows: [],
      backgroundStyle: "muted",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#faf9f7" rx="4" />
        <rect x="8" y="8" width="50" height="4" rx="2" fill="#003A30" opacity="0.8" />
        <rect x="8" y="18" width="104" height="7" rx="2" fill="#003A30" />
        <rect x="10" y="19.5" width="30" height="4" rx="1" fill="white" opacity="0.3" />
        <rect x="46" y="19.5" width="20" height="4" rx="1" fill="#C7E738" opacity="0.7" />
        <rect x="72" y="19.5" width="20" height="4" rx="1" fill="white" opacity="0.2" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x="8" y={28 + i*9} width="104" height="8" rx="1" fill={i%2===0?"#fff":"#faf9f7"} stroke="#e2e8f0" strokeWidth="0.5" />
            <rect x="10" y={31 + i*9} width="25" height="2" rx="1" fill="#003A30" opacity="0.6" />
            <rect x="46" y={31 + i*9} width="20" height="2" rx="1" fill="#003A30" opacity="0.4" />
            <rect x="72" y={31 + i*9} width="20" height="2" rx="1" fill="#94a3b8" opacity="0.3" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-heartland-hero" as const,
    label: "DSO Heartland Hero",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoHeartlandHeroBlockProps => ({
      headline: "Built for {company}.",
      companyName: "{company}",
      eyebrow: "The Dandy Difference",
      subheadline: "The lab partner built to match your DSO's scale — precision manufacturing, AI quality control, and network-wide visibility.",
      primaryCtaText: "Schedule a Conversation",
      primaryCtaUrl: "#",
      secondaryCtaText: "See the ROI",
      secondaryCtaUrl: "#calculator",
      backgroundImageUrl: "",
      stats: [
        { value: "30%", label: "Avg case acceptance lift" },
        { value: "96%", label: "First-time right rate" },
        { value: "4.2 days", label: "Avg turnaround" },
        { value: "$0", label: "CAPEX to start" },
      ],
      showScrollIndicator: true,
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(192,30%,5%)" rx="4" />
        <rect x="20" y="10" width="80" height="6" rx="3" fill="white" opacity="0.8" />
        <rect x="35" y="10" width="50" height="6" rx="3" fill="hsl(72,55%,48%)" opacity="0.5" />
        <rect x="30" y="20" width="60" height="3" rx="1.5" fill="white" opacity="0.3" />
        <rect x="38" y="27" width="20" height="5" rx="2.5" fill="hsl(72,55%,48%)" />
        <rect x="62" y="27" width="20" height="5" rx="2.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
        <rect x="0" y="55" width="120" height="15" rx="0" fill="hsl(192,28%,4%)" />
        {[0, 1, 2, 3].map(i => (
          <g key={i}>
            <rect x={8 + i * 28} y="57" width="14" height="3" rx="1.5" fill="hsl(72,55%,48%)" opacity="0.8" />
            <rect x={6 + i * 28} y="62" width="18" height="2" rx="1" fill="white" opacity="0.2" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-ai-feature" as const,
    label: "DSO AI Feature (Scan Review)",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoAiFeatureBlockProps => ({
      eyebrow: "Waste Prevention",
      headline: "Remakes are a tax. AI eliminates them.",
      body: "AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.",
      bullets: [
        "AI reviews every scan for clinical accuracy",
        "Real-time feedback before case submission",
        "Eliminates remakes at the source",
      ],
      stats: [
        { value: "96%",  label: "First-Time Right" },
        { value: "<30s", label: "Scan Review" },
        { value: "100%", label: "AI-Screened" },
      ],
      imageUrl: "/dso-ai-scan.jpg",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(152,32%,7%)" rx="4" />
        <rect x="6" y="10" width="28" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="6" y="16" width="44" height="5" rx="2" fill="white" opacity="0.9" />
        <rect x="6" y="23" width="44" height="2" rx="1" fill="white" opacity="0.4" />
        {[0,1,2].map(i => (
          <g key={i}>
            <circle cx="11" cy={30 + i*7} r="3" fill="hsl(68,60%,52%)" opacity="0.25" />
            <rect x="17" cy={30 + i*7} width="28" height="2" rx="1" fill="white" opacity="0.4" y={29 + i*7} />
          </g>
        ))}
        <rect x="62" y="8" width="52" height="54" rx="6" fill="hsl(152,30%,12%)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <ellipse cx="88" cy="35" rx="18" ry="22" fill="hsl(152,40%,22%)" opacity="0.7" />
        <circle cx="88" cy="30" r="5" fill="hsl(290,70%,55%)" opacity="0.7" />
      </svg>
    ),
  },
  {
    type: "dso-problem" as const,
    label: "DSO Problem (4-panel grid)",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoProblemBlockProps => ({
      eyebrow: "The Problem",
      headline: "Lab consolidation shouldn't mean compromise.",
      body: "",
      panels: [
        { icon: "alert-triangle", title: "Fragmented Networks",  desc: "No centralized visibility or control across your lab relationships." },
        { icon: "bar-chart",      title: "Scattered Data",       desc: "Performance tracking impossible across disconnected systems." },
        { icon: "users",          title: "Provider Resistance",  desc: "Inconsistent quality erodes provider confidence and slows adoption." },
        { icon: "trending-down",  title: "Revenue Leakage",      desc: "Remakes, wasted chair time, and inefficiency drain profitability silently." },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(0,0%,98%)" rx="4" />
        <rect x="30" y="8" width="60" height="4" rx="2" fill="hsl(192,30%,10%)" opacity="0.7" />
        <rect x="40" y="14" width="40" height="2" rx="1" fill="hsl(192,10%,55%)" opacity="0.5" />
        {[0, 1, 2, 3].map(i => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 8 + col * 57;
          const y = 22 + row * 23;
          return (
            <g key={i}>
              <rect x={x} y={y} width="52" height="19" rx="3" fill="white" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
              <rect x={x + 4} y={y + 4} width="6" height="6" rx="1.5" fill="hsl(72,55%,48%)" opacity="0.15" />
              <rect x={x + 4} y={y + 12} width="22" height="2" rx="1" fill="hsl(192,30%,10%)" opacity="0.5" />
              <rect x={x + 4} y={y + 15} width="38" height="1.5" rx="0.75" fill="hsl(192,10%,55%)" opacity="0.35" />
            </g>
          );
        })}
      </svg>
    ),
  },
  {
    type: "dso-stat-showcase" as const,
    label: "DSO Stat Showcase",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoStatShowcaseBlockProps => ({
      eyebrow: "By the Numbers",
      headline: "Results that compound at scale.",
      stats: [
        { value: "96%",     label: "First-time right rate",  description: "Industry-leading precision at enterprise scale" },
        { value: "12,000+", label: "Dental practices",       description: "Trust Dandy for their lab work" },
        { value: "4.2 days", label: "Average turnaround",   description: "Including AI review and quality control" },
        { value: "$0",      label: "CAPEX to start",         description: "All hardware included at no upfront cost" },
        { value: "30%",     label: "Case acceptance lift",   description: "On average across DSO partner networks" },
        { value: "100%",    label: "AI quality screened",    description: "Every scan reviewed before it leaves the chair" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="hsl(152,42%,12%)" rx="4" />
        <rect x="30" y="8" width="60" height="4" rx="2" fill="hsl(68,60%,52%)" opacity="0.7" />
        <rect x="35" y="16" width="50" height="3" rx="1.5" fill="white" opacity="0.35" />
        {[0,1,2,3,4,5].map(i => (
          <g key={i}>
            <rect x={8 + (i%3)*38} y={26 + Math.floor(i/3)*22} width="32" height="3" rx="1.5" fill="white" opacity="0.8" />
            <rect x={8 + (i%3)*38} y={31 + Math.floor(i/3)*22} width="16" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
            <rect x={8 + (i%3)*38} y={35 + Math.floor(i/3)*22} width="28" height="1.5" rx="0.75" fill="white" opacity="0.25" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-scroll-story" as const,
    label: "DSO Scroll Story",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoScrollStoryBlockProps => ({
      eyebrow: "The Dandy Advantage",
      chapters: [
        { headline: "One lab relationship across every location.", body: "Fragmented lab networks create inconsistency, data silos, and zero negotiating leverage. Dandy becomes your single lab partner — standardizing quality, pricing, and reporting across every practice in your network.", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&h=700&fit=crop" },
        { headline: "AI that catches problems before they become remakes.", body: "Dandy's AI Scan Review validates every case in real time — before it ever leaves the chair. The result: a 96% first-time right rate and dramatically fewer costly remakes across your entire footprint.", imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=900&h=700&fit=crop" },
        { headline: "Executive visibility into every practice, instantly.", body: "The Dandy Insights dashboard gives DSO leadership a real-time view of remake rates, case volumes, and turnaround times — by location, by region, by brand. Manage by exception, not by spreadsheet.", imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=900&h=700&fit=crop" },
        { headline: "Prove ROI at 10 offices. Scale to 500.", body: "Dandy's Pilot Program validates impact at a small number of locations first — measuring same-store revenue lift, remake reduction, and chair time recovered — before you commit to a full rollout.", imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=900&h=700&fit=crop" },
      ],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="46" height="54" rx="3" fill="#e2e8f0" />
        <rect x="8" y="8" width="46" height="54" rx="3" fill="#003A30" opacity="0.15" />
        <rect x="62" y="8" width="22" height="2.5" rx="1.25" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="62" y="14" width="50" height="4" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="62" y="22" width="44" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.4" />
        <rect x="62" y="27" width="44" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.3" />
        <rect x="62" y="32" width="36" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.2" />
        {[0,1,2,3].map(i => (
          <rect key={i} x={62 + i*11} y="43" width={i===0?14:8} height="2" rx="1" fill={i===0?"hsl(68,60%,52%)":"#e2e8f0"} />
        ))}
      </svg>
    ),
  },
  {
    type: "dso-scroll-story-hero" as const,
    label: "DSO Hero Story",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoScrollStoryHeroBlockProps => ({
      eyebrow: "The Dandy Advantage",
      chapters: [
        { headline: "One lab partner. Every location.", body: "Dandy becomes your single lab relationship — standardizing quality, pricing, and reporting across every practice in your network. One contract. Zero silos.", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1400&h=1000&fit=crop" },
        { headline: "AI that catches problems before they happen.", body: "AI Scan Review validates every case in real time — before it leaves the chair. The result: a 96% first-time right rate and fewer costly remakes across your entire footprint.", imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=1400&h=1000&fit=crop" },
        { headline: "Executive visibility into every practice.", body: "Real-time dashboards give DSO leadership insight into remake rates, case volumes, and turnaround times — by location, region, and brand. Manage by exception, not by spreadsheet.", imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1400&h=1000&fit=crop" },
        { headline: "Prove ROI at 10 offices. Scale to 500.", body: "Our Pilot Program validates impact at a small number of locations first — measuring revenue lift, remake reduction, and chair time recovered — before you commit to a full rollout.", imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=1400&h=1000&fit=crop" },
      ],
      ctaText: "Request a Custom Demo",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="0" y="0" width="52" height="70" fill="#003A30" />
        <rect x="52" y="0" width="68" height="70" fill="#1a4a3a" />
        <rect x="8" y="12" width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.9" />
        <rect x="8" y="18" width="36" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.9" />
        <rect x="8" y="26" width="36" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.4" />
        <rect x="8" y="30" width="30" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.3" />
        {[0,1,2,3].map(i => (
          <rect key={i} x={8 + i*10} y="40" width={i===0?16:6} height="2" rx="1" fill={i===0?"hsl(68,60%,52%)":"rgba(255,255,255,0.2)"} />
        ))}
        <rect x="8" y="52" width="26" height="8" rx="2" fill="hsl(68,60%,52%)" />
        <rect x="58" y="10" width="54" height="50" rx="3" fill="#2d6b56" opacity="0.6" />
      </svg>
    ),
  },
  {
    type: "dso-network-map" as const,
    label: "DSO Network Map",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoNetworkMapBlockProps => ({
      eyebrow: "Dandy Network",
      headline: "One platform.\nEvery practice.",
      body: "Dandy connects your entire DSO into a single lab ecosystem — routing cases, surfacing insights, and standardizing outcomes across every location in real time.",
      ctaText: "See the Live Network",
      ctaUrl: "#",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        {/* Left text column */}
        <rect x="6" y="10" width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.9" />
        <rect x="6" y="16" width="38" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.8" />
        <rect x="6" y="24" width="34" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.35" />
        <rect x="6" y="28" width="28" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.25" />
        <rect x="6" y="36" width="32" height="8" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.8" />
        {/* Right SVG network */}
        {/* Center node */}
        <circle cx={84} cy={35} r={6} fill="#003A30" stroke="hsl(68,60%,52%)" strokeWidth="1.2" />
        <circle cx={84} cy={35} r={10} fill="none" stroke="hsl(68,60%,52%)" strokeWidth="0.5" strokeOpacity="0.3" />
        {/* Spokes */}
        {[0, 60, 120, 180, 240, 300].map((a, i) => {
          const rad = a * Math.PI / 180;
          const nx = 84 + Math.cos(rad) * 20;
          const ny = 35 + Math.sin(rad) * 18;
          return (
            <g key={i}>
              <line x1={84} y1={35} x2={nx} y2={ny} stroke="hsl(68,60%,52%)" strokeWidth="0.5" strokeOpacity="0.35" strokeDasharray="2 2" />
              <circle cx={nx} cy={ny} r={2.5} fill="#003A30" stroke="hsl(68,60%,52%)" strokeWidth="0.8" />
            </g>
          );
        })}
      </svg>
    ),
  },
  {
    type: "dso-case-flow" as const,
    label: "DSO Case Flow",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoCaseFlowBlockProps => ({
      eyebrow: "How Dandy Works",
      headline: "From scan to seat in under 4 days.",
      subheadline: "Every Dandy case follows the same precise, AI-validated workflow — regardless of which location submits it.",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        {/* Eyebrow + headline */}
        <rect x="6" y="7" width="16" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.85" />
        <rect x="6" y="12" width="42" height="4.5" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.8" />
        {/* Pipeline row */}
        {[0, 1, 2, 3].map(i => {
          const x = 8 + i * 28;
          const cx = x + 7;
          return (
            <g key={i}>
              {/* Connector line between cards */}
              {i < 3 && (
                <line x1={x + 14} y1={30} x2={x + 28} y2={30} stroke="hsl(68,60%,52%)" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 1.5" />
              )}
              {/* Stage card */}
              <rect x={x} y="22" width="14" height="30" rx="2" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              {/* Top lime bar */}
              <rect x={x} y="22" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.7" />
              {/* Stage number */}
              <rect x={x + 2} y="25" width="4" height="1.5" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.7" />
              {/* Metric */}
              <rect x={x + 2} y="29" width="10" height="3" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
              {/* Body text lines */}
              <rect x={x + 2} y="34" width="9" height="1" rx="0.5" fill="rgba(255,255,255,0.2)" />
              <rect x={x + 2} y="36.5" width="7" height="1" rx="0.5" fill="rgba(255,255,255,0.15)" />
              <rect x={x + 2} y="39" width="8" height="1" rx="0.5" fill="rgba(255,255,255,0.12)" />
            </g>
          );
        })}
        {/* Travelling packet */}
        <circle cx="50" cy="30" r="1.5" fill="hsl(68,60%,52%)" opacity="0.9" />
      </svg>
    ),
  },
  {
    type: "dso-live-feed" as const,
    label: "DSO Live Feed",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoLiveFeedBlockProps => ({
      eyebrow: "Platform Intelligence",
      headline: "Dandy sees everything.\nYour team acts on what matters.",
      body: "Every metric from every location, streaming in real time. The Dandy dashboard transforms raw case data into executive-ready intelligence — automatically.",
      footerNote: "Live data from 127 DSO locations across 14 states",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        {/* Left text column */}
        <rect x="5" y="8" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.85" />
        <rect x="5" y="13" width="32" height="4" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="19" width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.2)" />
        <rect x="5" y="22" width="24" height="1.5" rx="0.5" fill="rgba(255,255,255,0.15)" />
        <rect x="5" y="25" width="26" height="1.5" rx="0.5" fill="rgba(255,255,255,0.15)" />
        {/* Live dot */}
        <circle cx="7" cy="34" r="2" fill="hsl(68,60%,52%)" opacity="0.9" />
        <rect x="11" y="32.5" width="12" height="1.5" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.7" />
        {/* Terminal panel */}
        <rect x="47" y="5" width="68" height="60" rx="3" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        {/* Terminal header */}
        <rect x="47" y="5" width="68" height="8" rx="3" fill="rgba(0,0,0,0.2)" />
        {[50, 54, 58].map((x, i) => (
          <circle key={i} cx={x} cy="9" r="1.5" fill={["#B45309", "#6B7280", "hsl(68,60%,52%)"][i]} opacity="0.7" />
        ))}
        {/* Metric rows */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <g key={i}>
            <line x1="47" y1={17 + i * 8} x2="115" y2={17 + i * 8} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <rect x="50" y={18.5 + i * 8} width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.25)" />
            <rect x="90" y={18.5 + i * 8} width="12" height="1.5" rx="0.5" fill={i % 2 === 0 ? "hsl(68,60%,52%)" : "hsl(48,100%,96%)"} opacity="0.7" />
            {/* Arrow indicator */}
            <rect x="105" y={18.5 + i * 8} width="4" height="1.5" rx="0.5" fill={i % 3 === 1 ? "hsl(4,80%,60%)" : "hsl(68,60%,52%)"} opacity="0.8" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-particle-mesh" as const,
    label: "DSO Particle Mesh",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoParticleMeshBlockProps => ({
      eyebrow: "AI-Driven Intelligence",
      headline: "Every case,\nconnected.",
      body: "Dandy's neural lab infrastructure routes, validates, and delivers with machine precision — connecting every practice, every provider, every outcome.",
      stat1Value: "500+", stat1Label: "Locations",
      stat2Value: "96%",  stat2Label: "First-Time Right",
      stat3Value: "< 4d", stat3Label: "Avg Turnaround",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/8fc1187a-7e5a-46b1-8314-f8edffef941a",
      imagePosition: "right",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        {/* Particle network illustration */}
        {([
          [22,14],[60,8],[98,20],[15,36],[45,30],[80,35],[100,52],[55,55],[30,58],[72,18],[40,48],[88,12],
        ] as [number,number][]).map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r={1.2} fill="hsl(68,60%,52%)" opacity="0.7" />
        ))}
        {/* Connections */}
        {[
          [22,14,60,8],[60,8,98,20],[22,14,45,30],[60,8,80,35],[98,20,80,35],
          [45,30,80,35],[45,30,55,55],[80,35,100,52],[55,55,100,52],[30,58,55,55],
          [15,36,45,30],[72,18,60,8],[88,12,98,20],
        ].map(([x1,y1,x2,y2],i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(68,60%,52%)" strokeWidth="0.5" strokeOpacity="0.3" />
        ))}
        {/* Text overlay */}
        <rect x="5" y="42" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="47" width="40" height="5" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="55" width="32" height="1.5" rx="0.5" fill="rgba(255,255,255,0.25)" />
        <rect x="5" y="58.5" width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.18)" />
        {/* Glow center */}
        <circle cx="60" cy="35" r="18" fill="none" stroke="hsl(68,60%,52%)" strokeOpacity="0.06" strokeWidth="12" />
      </svg>
    ),
  },
  {
    type: "dso-flow-canvas" as const,
    label: "DSO Flow Canvas",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoFlowCanvasBlockProps => ({
      eyebrow: "The Dandy Standard",
      quote: "We didn't just digitize the lab workflow.\nWe rebuilt it from the ground up.",
      attribution: "Dandy Engineering Team",
      stat: "99.2%",
      statLabel: "First-Time Fit Rate — Network-Wide",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/8fc1187a-7e5a-46b1-8314-f8edffef941a",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#000e09" rx="4" />
        {/* Aurora blobs */}
        <ellipse cx="30" cy="25" rx="38" ry="28" fill="rgba(0,58,36,0.5)" />
        <ellipse cx="90" cy="48" rx="34" ry="24" fill="rgba(30,90,22,0.45)" />
        <ellipse cx="60" cy="60" rx="28" ry="20" fill="rgba(70,120,10,0.35)" />
        <ellipse cx="88" cy="14" rx="26" ry="18" fill="rgba(8,70,38,0.4)" />
        {/* Centered stat text */}
        <rect x="38" y="18" width="44" height="14" rx="3" fill="rgba(0,14,9,0.45)" />
        <rect x="44" y="22" width="32" height="8" rx="2" fill="hsl(68,60%,52%)" opacity="0.85" />
        {/* Quote line */}
        <rect x="22" y="38" width="76" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
        <rect x="30" y="43" width="60" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.4" />
        {/* Attribution */}
        <rect x="45" y="51" width="30" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)" />
      </svg>
    ),
  },
  {
    type: "dso-bento-outcomes" as const,
    label: "DSO Bento Outcomes",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoBentoOutcomesBlockProps => ({
      eyebrow: "Why Dandy",
      headline: "Every metric that matters. All in one platform.",
      tiles: [],
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="8" y="8" width="40" height="4" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="8" y="18" width="22" height="22" rx="3" fill="#003A30" />
        <rect x="11" y="24" width="12" height="4" rx="1.5" fill="#C7E738" opacity="0.9" />
        <rect x="11" y="30" width="16" height="2" rx="1" fill="white" opacity="0.5" />
        <rect x="33" y="18" width="38" height="22" rx="3" fill="#e2e8f0" />
        <rect x="75" y="18" width="37" height="22" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="78" y="26" width="18" height="3" rx="1.5" fill="#003A30" opacity="0.7" />
        <rect x="78" y="32" width="24" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="8" y="44" width="36" height="18" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="8" y="44" width="36" height="2" rx="0" fill="#C7E738" opacity="0.6" />
        <rect x="11" y="50" width="26" height="2" rx="1" fill="#94a3b8" opacity="0.4" />
        <rect x="11" y="55" width="22" height="2" rx="1" fill="#94a3b8" opacity="0.3" />
        <rect x="48" y="44" width="22" height="18" rx="3" fill="#003A30" />
        <rect x="51" y="51" width="10" height="3" rx="1.5" fill="#C7E738" opacity="0.9" />
        <rect x="74" y="44" width="38" height="18" rx="3" fill="#e2e8f0" />
      </svg>
    ),
  },
  {
    type: "dso-meet-team" as const,
    label: "DSO Meet the Team",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoMeetTeamBlockProps => ({
      eyebrow: "Your Dedicated Team",
      headline: "The team behind your partnership.",
      subheadline: "Every practice gets a dedicated Dandy rep who knows your workflow, not a generic help desk.",
      ctaText: "Book a Meeting",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      members: [
        { name: "Asad Ahmed", role: "Enterprise AE", email: "asad.ahmed@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/asad-ahmed" },
        { name: "Dan MacAdam", role: "Strategic AE", email: "dan.macadam@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/dan-macadam" },
        { name: "Matt Gorski", role: "Large Enterprise AE", email: "matt.gorski@meetdandy.com", calendlyUrl: "https://meetdandy.chilipiper.com/book/me/Matt-Gorski" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="6" width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="11" width="40" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="19" width="30" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x={5 + i * 38} y="30" width="32" height="35" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <circle cx={21 + i * 38} cy="43" r="7" fill="rgba(255,255,255,0.12)" />
            <rect x={8 + i * 38} y="53" width="24" height="2" rx="1" fill="rgba(255,255,255,0.55)" />
            <rect x={10 + i * 38} y="57" width="18" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.6" />
            <rect x={8 + i * 38} y="60" width="26" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.25" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-paradigm-shift" as const,
    label: "DSO Paradigm Shift",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoParadigmShiftBlockProps => ({
      eyebrow: "The New Standard",
      headline: "From fragmented labs to one unified partner.",
      subheadline: "Dandy replaces the old model with a fully integrated lab platform — built for how modern practices operate.",
      oldWayLabel: "The Old Way",
      newWayLabel: "The Dandy Way",
      oldWayItems: [
        "Multiple disconnected lab vendors",
        "Inconsistent quality across locations",
        "Remake costs absorbed by the practice",
        "No visibility into case performance",
        "Expensive scanner CAPEX per operatory",
      ],
      newWayItems: [
        "One unified lab partner across all locations",
        "AI Scan Review catches issues before they happen",
        "96% first-time fit rate — guaranteed",
        "Real-time dashboard across every practice",
        "Premium scanners included at $0 CAPEX",
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        <rect x="5" y="6" width="16" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="36" height="4" rx="1.5" fill="hsl(48,100%,96%)" opacity="0.75" />
        <rect x="5" y="20" width="52" height="44" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <rect x="65" y="20" width="52" height="44" rx="3" fill="rgba(194,229,58,0.08)" stroke="hsl(68,60%,52%)" strokeWidth="0.5" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <circle cx="12" cy={27 + i * 8} r="1.5" fill="rgba(255,100,100,0.7)" />
            <rect x="17" y={26 + i * 8} width="34" height="1.5" rx="0.75" fill="rgba(255,255,255,0.3)" />
            <circle cx="72" cy={27 + i * 8} r="1.5" fill="hsl(68,60%,52%)" opacity="0.9" />
            <rect x="77" y={26 + i * 8} width="34" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-partnership-perks" as const,
    label: "DSO Partnership Perks",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPartnershipPerksBlockProps => ({
      eyebrow: "Partnership Benefits",
      headline: "Perks that come with every Dandy partnership.",
      subheadline: "From day one, your practices get dedicated support, premium hardware, and exclusive incentives.",
      perks: [
        { icon: "gift", title: "$100 UberEats Gift Card", desc: "Book a lunch-and-learn for your team — we'll bring the food and walk you through going digital with Dandy." },
        { icon: "star", title: "Dedicated DSO Support", desc: "Your own account team that knows your group's workflow. Direct line, same-day response." },
        { icon: "shield", title: "Free CE Credits", desc: "Accredited courses on digital dentistry, scan technique, and restorative workflows." },
        { icon: "sparkles", title: "$1,500 Lab Credit", desc: "New practices get $1,500 toward their first cases — experience Dandy quality risk-free from day one." },
        { icon: "zap", title: "AI Scan Review", desc: "Real-time AI flags margin issues while your patient is still in the chair — fewer remakes, faster seats." },
        { icon: "users", title: "Live Clinical Collaboration", desc: "Chat directly with Dandy lab technicians in real time to dial in your preps." },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="6" width="22" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="11" width="44" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[[5,24],[44,24],[83,24],[5,47],[44,47],[83,47]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width="34" height="20" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <circle cx={x+7} cy={y+7} r="4" fill="hsl(68,60%,52%)" opacity="0.3" />
            <rect x={x+14} y={y+4} width="16" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
            <rect x={x+3} y={y+14} width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-products-grid" as const,
    label: "DSO Products Grid",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoProductsGridBlockProps => ({
      eyebrow: "The Full Platform",
      headline: "One lab for everything your practice needs.",
      subheadline: "Perfect fit. Fast turnarounds. One connected system that simplifies your entire restorative workflow.",
      products: [
        { icon: "crown",       imageKey: "posterior-crowns", name: "Posterior Crowns",     detail: "AI-perfected, 5-day turnaround",        price: "From $99/unit" },
        { icon: "smile",       imageKey: "anterior-crowns",  name: "Anterior Crowns",      detail: "Stunning aesthetics, free 3D approvals", price: "Premium materials" },
        { icon: "stethoscope", imageKey: "dentures",         name: "Dentures",             detail: "2-appointment digital workflow",         price: "From $199/arch" },
        { icon: "target",      imageKey: "implants",         name: "Implant Restorations", detail: "FDA-approved, custom abutments",         price: "All systems supported" },
        { icon: "scan",        imageKey: "guided-surgery",   name: "Guided Surgery",       detail: "3D-printed surgical guides",             price: "$109/site" },
        { icon: "sparkles",    imageKey: "aligners",         name: "Clear Aligners",       detail: "Doctor-directed, 3D simulations",        price: "Flexible plans" },
        { icon: "moon",        imageKey: "guards",           name: "Night Guards & TMJ",   detail: "Digital heatmaps, 3D-printed",           price: "From $59 bundled" },
        { icon: "shield",      imageKey: "sleep",            name: "Sleep Appliances",     detail: "MAD devices for OSA patients",           price: "Medical billing support" },
      ],
      backgroundStyle: "muted",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f1f5f2" rx="4" />
        <rect x="5" y="5" width="18" height="1.5" rx="0.75" fill="#003A30" opacity="0.6" />
        <rect x="5" y="10" width="40" height="4" rx="2" fill="#003A30" opacity="0.85" />
        {[[5,20],[43,20],[81,20],[5,44],[43,44],[81,44]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width="34" height="22" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
            <rect x={x} y={y} width="34" height="6" rx="3" fill="#003A30" opacity="0.08" />
            <rect x={x+3} y={y+9} width="20" height="2" rx="1" fill="#003A30" opacity="0.7" />
            <rect x={x+3} y={y+14} width="26" height="1.5" rx="0.75" fill="#94a3b8" opacity="0.5" />
            <rect x={x+3} y={y+18} width="12" height="1.5" rx="0.75" fill="#C7E738" opacity="0.9" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-promo-cards" as const,
    label: "DSO Promo Cards",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPromoCardsBlockProps => ({
      eyebrow: "Limited-Time Offers",
      headline: "Exclusive promotions for DSO partners.",
      subheadline: "Activate your practices and take advantage of offers available only through your group partnership.",
      cards: [
        { title: "$1,500 Lab Credit", desc: "Activate your practice and get $1,500 toward your first cases — experience our 96% fit rate with zero risk.", badge: "CREDIT", ctaText: "Claim my credit" },
        { title: "$1,000 Lab Credit", desc: "Sign up within 90 days and put $1,000 toward crowns, bridges, or dentures — on us.", badge: "CREDIT", ctaText: "Get started" },
        { title: "Free Scanner + Cart", desc: "Your practice gets a premium intraoral scanner and all-in-one operatory cart at zero cost — included with your DSO partnership.", badge: "FREE", ctaText: "Reserve yours" },
        { title: "Free Laptop + Cart", desc: "Full digital setup for your operatory — scanner, laptop, and cart delivered and installed at no charge.", badge: "FREE", ctaText: "Reserve yours" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        <rect x="5" y="5" width="20" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="42" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[[5,20],[63,20],[5,46],[63,46]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width="54" height="22" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <rect x={x+3} y={y+3} width="14" height="5" rx="2.5" fill={i % 2 === 0 ? "hsl(68,60%,52%)" : "hsl(48,100%,96%)"} opacity="0.8" />
            <rect x={x+3} y={y+11} width="34" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.6" />
            <rect x={x+3} y={y+15} width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <rect x={x+3} y={y+19} width="18" height="2" rx="1" fill="hsl(68,60%,52%)" opacity="0.4" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-activation-steps" as const,
    label: "DSO Activation Steps",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoActivationStepsBlockProps => ({
      eyebrow: "Getting Started",
      headline: "Four steps to going live with Dandy.",
      subheadline: "Our onboarding team handles every detail — from scanner delivery to your first case.",
      steps: [
        { step: "1", title: "Schedule Your Kickoff", desc: "Meet your dedicated team and align on rollout timeline." },
        { step: "2", title: "Equipment Setup", desc: "We ship and install scanners — fully configured." },
        { step: "3", title: "Team Training", desc: "Hands-on training for doctors and staff." },
        { step: "4", title: "Go Live", desc: "Submit your first cases and experience the difference." },
      ],
      ctaText: "Book Your Activation Call",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="6" width="20" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="11" width="42" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[0,1,2].map(i => (
          <g key={i}>
            <line x1="18" y1={25 + i * 14} x2="18" y2={i < 2 ? 36 + i * 14 : 33 + i * 14} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <circle cx="18" cy={23 + i * 14} r="5" fill="hsl(68,60%,52%)" opacity="0.2" stroke="hsl(68,60%,52%)" strokeWidth="0.7" />
            <rect x="16.5" y={22 + i * 14} width="3" height="2" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.9" />
            <rect x="28" y={21 + i * 14} width="28" height="2" rx="1" fill="hsl(48,100%,96%)" opacity="0.7" />
            <rect x="28" y={25 + i * 14} width="42" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <rect x="28" y={28.5 + i * 14} width="34" height="1.5" rx="0.75" fill="rgba(255,255,255,0.15)" />
          </g>
        ))}
        <rect x="5" y="63" width="42" height="5" rx="2.5" fill="hsl(68,60%,52%)" opacity="0.85" />
      </svg>
    ),
  },
  {
    type: "dso-promises" as const,
    label: "DSO Promises",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPromisesBlockProps => ({
      eyebrow: "Our Guarantees",
      headline: "Built on trust. Backed by guarantees.",
      subheadline: "We stand behind every case — because your reputation depends on it.",
      promises: [
        { icon: "ban",         title: "Zero Long-Term Contracts", desc: "Simple, transparent pricing. No lock-ins, no hidden fees. Stay because you want to, not because you have to." },
        { icon: "rotate",      title: "Free No-Hassle Remakes",   desc: "If it doesn't fit, we'll make it right — no questions asked, no finger-pointing. Every single time." },
        { icon: "shieldCheck", title: "10-Year Warranty",          desc: "Every crown, bridge, and restoration is backed by a 10-year warranty. Your patients are covered for years to come." },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#001a13" rx="4" />
        <rect x="5" y="5" width="18" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="38" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[[5,22],[65,22],[5,46],[65,46]].map(([x,y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="52" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <circle cx={x+10} cy={y+10} r="6" fill="rgba(194,229,58,0.15)" stroke="hsl(68,60%,52%)" strokeWidth="0.5" />
            <rect x={x+20} y={y+5} width="26" height="2.5" rx="1" fill="hsl(48,100%,96%)" opacity="0.7" />
            <rect x={x+20} y={y+10} width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <rect x={x+20} y={y+14} width="22" height="1.5" rx="0.75" fill="rgba(255,255,255,0.18)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-testimonials" as const,
    label: "DSO Testimonials",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoTestimonialsBlockProps => ({
      eyebrow: "What Our Partners Say",
      headline: "Practices that switched and never looked back.",
      subheadline: "Hear from DSO leaders across the country who've made Dandy their lab partner.",
      testimonials: [
        { quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann", location: "Founder, APEX Dental Partners" },
        { quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", author: "Clinical Director", location: "Open & Affordable Dental" },
        { quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", author: "Dr. Trey Mueller", location: "Chief Clinical Officer, Dental Care Alliance" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="5" width="20" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="10" width="44" height="4" rx="2" fill="hsl(48,100%,96%)" opacity="0.75" />
        {[5,42,79].map((x,i) => (
          <g key={i}>
            <rect x={x} y="20" width="34" height="44" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
            <rect x={x+3} y="25" width="4" height="3" rx="0.5" fill="hsl(68,60%,52%)" opacity="0.7" />
            <rect x={x+3} y="31" width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
            <rect x={x+3} y="35" width="26" height="1.5" rx="0.75" fill="rgba(255,255,255,0.35)" />
            <rect x={x+3} y="39" width="22" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
            <line x1={x+3} y1="47" x2={x+31} y2="47" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <circle cx={x+8} cy="53" r="4" fill="rgba(255,255,255,0.12)" />
            <rect x={x+15} y="51" width="16" height="1.5" rx="0.75" fill="rgba(255,255,255,0.5)" />
            <rect x={x+15} y="55" width="14" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.5" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-practice-hero" as const,
    label: "DSO Practice Hero",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoPracticeHeroBlockProps => ({
      eyebrow: "Heartland Dental × Dandy",
      headline: "Your practice. Elevated by Dandy.",
      subheadline: "As a Heartland partner, your practice gets dedicated support, premium scanners at no cost, and a lab that backs every case with a first-time fit guarantee.",
      primaryCtaText: "Start your first case",
      primaryCtaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      secondaryCtaText: "See how it works",
      secondaryCtaUrl: "#",
      trustLine: "Join 200+ practices in your network already using Dandy",
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <radialGradient id="pg-hero-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="hsl(68,60%,52%)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <rect width="120" height="70" fill="url(#pg-hero-glow)" rx="4" />
        <rect x="30" y="10" width="60" height="5" rx="10" fill="rgba(199,231,56,0.2)" stroke="rgba(199,231,56,0.3)" strokeWidth="0.5" />
        <rect x="18" y="20" width="84" height="9" rx="3" fill="rgba(255,255,255,0.75)" />
        <rect x="25" y="32" width="70" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
        <rect x="30" y="37" width="60" height="2.5" rx="1.25" fill="rgba(255,255,255,0.2)" />
        <rect x="26" y="46" width="30" height="9" rx="4" fill="hsl(68,60%,52%)" />
        <rect x="62" y="46" width="30" height="9" rx="4" fill="transparent" stroke="rgba(255,255,255,0.25)" strokeWidth="0.75" />
        <rect x="35" y="60" width="50" height="1.5" rx="0.75" fill="rgba(255,255,255,0.15)" />
      </svg>
    ),
  },
  {
    type: "dso-stat-row" as const,
    label: "DSO Stat Row",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoStatRowBlockProps => ({
      eyebrow: "By the numbers",
      headline: "Results that speak for themselves.",
      items: [
        { value: "96%", label: "First-time fit rate", detail: "Industry average is 78%" },
        { value: "50%", label: "Fewer remakes", detail: "Compared to traditional labs" },
        { value: "2x", label: "Faster turnaround", detail: "Same-day delivery available" },
        { value: "12K+", label: "Active practices", detail: "Across DSO networks nationwide" },
      ],
      backgroundStyle: "dark",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#003A30" rx="4" />
        <rect x="5" y="8" width="18" height="1.5" rx="0.75" fill="hsl(68,60%,52%)" opacity="0.8" />
        <rect x="5" y="13" width="36" height="3.5" rx="1.5" fill="rgba(255,255,255,0.65)" />
        {[5,33,61,89].map((x, i) => (
          <g key={i}>
            <rect x={x} y="25" width="26" height="38" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <rect x={x+3} y="30" width="18" height="8" rx="2" fill="hsl(68,60%,52%)" opacity="0.5" />
            <rect x={x+3} y="42" width="20" height="2" rx="1" fill="rgba(255,255,255,0.5)" />
            <rect x={x+3} y="47" width="16" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-faq" as const,
    label: "DSO FAQ",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoFaqBlockProps => ({
      eyebrow: "Common questions",
      headline: "Everything you're wondering about switching.",
      subheadline: "We know change feels risky. Here's what practices ask us most.",
      items: [
        { question: "Will switching labs disrupt my current workflow?", answer: "No. We design the transition around your schedule. An on-site Dandy trainer comes to your practice, walks your team through the scanner and workflow, and you're up and running in days — not weeks. Most practices see zero disruption to active cases." },
        { question: "What if my first case doesn't come back right?", answer: "We back every case with our first-time fit guarantee. If a crown or restoration doesn't seat on the first try, we remake it at no cost and send your dedicated rep to troubleshoot the scan. No runaround, no charge." },
        { question: "Does my DSO have a special pricing arrangement with Dandy?", answer: "Yes — your network has negotiated preferred pricing and an exclusive onboarding incentive for member practices. Your first $1,500 in cases is credited to your account, plus you get a $100 UberEats card for hosting a lunch-and-learn." },
        { question: "How does the Dandy scanner work, and is it hard to learn?", answer: "The Dandy scanner is an iTero-compatible intraoral scanner included at $0 CAPEX. Your team typically gets comfortable in one or two cases. Our AI Scan Review flags any issues while the patient is still in the chair — so you fix it before submitting, not after." },
        { question: "What products does Dandy offer?", answer: "Dandy covers the full restorative range — posterior and anterior crowns, veneers, implant restorations, dentures, sleep appliances, night guards, and clear aligners. All cases flow through one portal, one account team, one bill." },
      ],
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="20" y="6" width="30" height="1.5" rx="0.75" fill="#003A30" opacity="0.4" />
        <rect x="10" y="11" width="60" height="4" rx="2" fill="#003A30" opacity="0.7" />
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <rect x="10" y={21 + i * 10} width="100" height="8" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="0.5" />
            <rect x="14" y={24 + i * 10} width="56" height="2" rx="1" fill="#374151" opacity="0.5" />
            <path d={`M 104 ${25 + i * 10} l -3 3 l -3 -3`} stroke="#003A30" strokeWidth="1" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    type: "dso-split-feature" as const,
    label: "DSO Split Feature",
    category: "DSO Practices" as BlockCategory,
    defaultProps: (): DsoSplitFeatureBlockProps => ({
      eyebrow: "AI-powered quality control",
      headline: "Catch scan issues before the patient leaves the chair.",
      body: "AI Scan Review analyzes every impression in real time — flagging margin gaps, prep angles, and tissue interference while you still have the patient seated. It's like having a master ceramist review every scan instantly.",
      bullets: [
        "Margin errors caught before submission — not after",
        "Real-time feedback with visual callouts",
        "Fewer remakes means more productive chair time",
        "No extra software — built into the Dandy workflow",
      ],
      ctaText: "See AI Scan Review in action",
      ctaUrl: "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call",
      imageUrl: "",
      imagePosition: "right",
      backgroundStyle: "white",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#f8fafc" rx="4" />
        <rect x="5" y="10" width="52" height="50" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="0.5" />
        <rect x="9" y="16" width="14" height="1.5" rx="0.75" fill="#003A30" opacity="0.5" />
        <rect x="9" y="21" width="40" height="5" rx="2" fill="#003A30" opacity="0.7" />
        <rect x="9" y="29" width="38" height="2" rx="1" fill="#6b7280" opacity="0.4" />
        <rect x="9" y="33" width="34" height="2" rx="1" fill="#6b7280" opacity="0.3" />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <circle cx="12" cy={41 + i * 5} r="1.5" fill="#003A30" opacity="0.5" />
            <rect x="16" y={40 + i * 5} width="28" height="1.5" rx="0.75" fill="#374151" opacity="0.4" />
          </g>
        ))}
        <rect x="62" y="10" width="52" height="50" rx="8" fill="#003A3010" stroke="#003A3018" strokeWidth="0.5" />
        <circle cx="88" cy="35" r="14" fill="#003A30" opacity="0.12" />
        <path d="M80 35 C80 28 96 28 96 35" stroke="hsl(68,60%,52%)" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      </svg>
    ),
  },
  {
    type: "dso-cta-capture" as const,
    label: "DSO CTA Capture",
    category: "DSO" as BlockCategory,
    defaultProps: (): DsoCtaCaptureBlockProps => ({
      eyebrow: "Get Started Today",
      headline: "See what Dandy can\ndo for your group.",
      body: "Join DSO leaders already running smarter, faster dental operations. Setup takes one call.",
      inputLabel: "Work email",
      inputPlaceholder: "yourname@dsogroup.com",
      ctaLabel: "Request a Demo",
      trust1: "1,200+ DSO locations",
      trust2: "No long-term contract",
      trust3: "Live in 30 days",
      imageUrl: "https://meetdandy-lp.com/api/storage/objects/uploads/8fc1187a-7e5a-46b1-8314-f8edffef941a",
      imagePosition: "right",
    }),
    thumbnail: () => (
      <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="70" fill="#050e08" rx="4" />
        {/* Image half */}
        <rect x="60" y="0" width="60" height="70" fill="#0a2018" />
        <rect x="60" y="0" width="60" height="70" fill="url(#ctaFade)" />
        <defs>
          <linearGradient id="ctaFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#050e08" />
            <stop offset="60%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Eyebrow dot */}
        <circle cx="10" cy="16" r="2" fill="hsl(68,60%,52%)" />
        <rect x="15" y="14" width="22" height="3" rx="1.5" fill="hsl(68,60%,52%)" opacity="0.8" />
        {/* Headline lines */}
        <rect x="10" y="23" width="44" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.9" />
        <rect x="10" y="31" width="36" height="5" rx="2" fill="hsl(48,100%,96%)" opacity="0.7" />
        {/* Body */}
        <rect x="10" y="41" width="42" height="2" rx="1" fill="white" opacity="0.3" />
        <rect x="10" y="45" width="36" height="2" rx="1" fill="white" opacity="0.2" />
        {/* Pill input */}
        <rect x="10" y="53" width="46" height="10" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(199,231,56,0.3)" strokeWidth="0.7" />
        <rect x="36" y="55" width="18" height="6" rx="3" fill="hsl(68,60%,52%)" />
      </svg>
    ),
  },
];

export function getBlockDef(type: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY.find(b => b.type === type);
}

function makeId(type: BlockType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlock(type: "hero"): Extract<PageBlock, { type: "hero" }>;
export function createBlock(type: "trust-bar"): Extract<PageBlock, { type: "trust-bar" }>;
export function createBlock(type: "pas-section"): Extract<PageBlock, { type: "pas-section" }>;
export function createBlock(type: "comparison"): Extract<PageBlock, { type: "comparison" }>;
export function createBlock(type: "stat-callout"): Extract<PageBlock, { type: "stat-callout" }>;
export function createBlock(type: "benefits-grid"): Extract<PageBlock, { type: "benefits-grid" }>;
export function createBlock(type: "testimonial"): Extract<PageBlock, { type: "testimonial" }>;
export function createBlock(type: "how-it-works"): Extract<PageBlock, { type: "how-it-works" }>;
export function createBlock(type: "product-grid"): Extract<PageBlock, { type: "product-grid" }>;
export function createBlock(type: "photo-strip"): Extract<PageBlock, { type: "photo-strip" }>;
export function createBlock(type: "bottom-cta"): Extract<PageBlock, { type: "bottom-cta" }>;
export function createBlock(type: "video-section"): Extract<PageBlock, { type: "video-section" }>;
export function createBlock(type: "case-studies"): Extract<PageBlock, { type: "case-studies" }>;
export function createBlock(type: "resources"): Extract<PageBlock, { type: "resources" }>;
export function createBlock(type: "rich-text"): Extract<PageBlock, { type: "rich-text" }>;
export function createBlock(type: "custom-html"): Extract<PageBlock, { type: "custom-html" }>;
export function createBlock(type: "zigzag-features"): Extract<PageBlock, { type: "zigzag-features" }>;
export function createBlock(type: "product-showcase"): Extract<PageBlock, { type: "product-showcase" }>;
export function createBlock(type: "nav-header"): Extract<PageBlock, { type: "nav-header" }>;
export function createBlock(type: "cta-button"): Extract<PageBlock, { type: "cta-button" }>;
export function createBlock(type: "full-bleed-hero"): Extract<PageBlock, { type: "full-bleed-hero" }>;
export function createBlock(type: "footer"): Extract<PageBlock, { type: "footer" }>;
export function createBlock(type: "form"): Extract<PageBlock, { type: "form" }>;
export function createBlock(type: "popup"): Extract<PageBlock, { type: "popup" }>;
export function createBlock(type: "sticky-bar"): Extract<PageBlock, { type: "sticky-bar" }>;
export function createBlock(type: "roi-calculator"): Extract<PageBlock, { type: "roi-calculator" }>;
export function createBlock(type: "spacer"): Extract<PageBlock, { type: "spacer" }>;
export function createBlock(type: "dso-insights-dashboard"): Extract<PageBlock, { type: "dso-insights-dashboard" }>;
export function createBlock(type: "dso-lab-tour"): Extract<PageBlock, { type: "dso-lab-tour" }>;
export function createBlock(type: "dso-stat-bar"): Extract<PageBlock, { type: "dso-stat-bar" }>;
export function createBlock(type: "dso-success-stories"): Extract<PageBlock, { type: "dso-success-stories" }>;
export function createBlock(type: "dso-challenges"): Extract<PageBlock, { type: "dso-challenges" }>;
export function createBlock(type: "dso-pilot-steps"): Extract<PageBlock, { type: "dso-pilot-steps" }>;
export function createBlock(type: "dso-final-cta"): Extract<PageBlock, { type: "dso-final-cta" }>;
export function createBlock(type: "dso-comparison"): Extract<PageBlock, { type: "dso-comparison" }>;
export function createBlock(type: "dso-heartland-hero"): Extract<PageBlock, { type: "dso-heartland-hero" }>;
export function createBlock(type: "dso-problem"): Extract<PageBlock, { type: "dso-problem" }>;
export function createBlock(type: "dso-ai-feature"): Extract<PageBlock, { type: "dso-ai-feature" }>;
export function createBlock(type: "dso-stat-showcase"): Extract<PageBlock, { type: "dso-stat-showcase" }>;
export function createBlock(type: "dso-scroll-story"): Extract<PageBlock, { type: "dso-scroll-story" }>;
export function createBlock(type: "dso-scroll-story-hero"): Extract<PageBlock, { type: "dso-scroll-story-hero" }>;
export function createBlock(type: "dso-network-map"): Extract<PageBlock, { type: "dso-network-map" }>;
export function createBlock(type: "dso-case-flow"): Extract<PageBlock, { type: "dso-case-flow" }>;
export function createBlock(type: "dso-live-feed"): Extract<PageBlock, { type: "dso-live-feed" }>;
export function createBlock(type: "dso-particle-mesh"): Extract<PageBlock, { type: "dso-particle-mesh" }>;
export function createBlock(type: "dso-flow-canvas"): Extract<PageBlock, { type: "dso-flow-canvas" }>;
export function createBlock(type: "dso-bento-outcomes"): Extract<PageBlock, { type: "dso-bento-outcomes" }>;
export function createBlock(type: "dso-cta-capture"): Extract<PageBlock, { type: "dso-cta-capture" }>;
export function createBlock(type: "dso-meet-team"): Extract<PageBlock, { type: "dso-meet-team" }>;
export function createBlock(type: "dso-paradigm-shift"): Extract<PageBlock, { type: "dso-paradigm-shift" }>;
export function createBlock(type: "dso-partnership-perks"): Extract<PageBlock, { type: "dso-partnership-perks" }>;
export function createBlock(type: "dso-products-grid"): Extract<PageBlock, { type: "dso-products-grid" }>;
export function createBlock(type: "dso-promo-cards"): Extract<PageBlock, { type: "dso-promo-cards" }>;
export function createBlock(type: "dso-activation-steps"): Extract<PageBlock, { type: "dso-activation-steps" }>;
export function createBlock(type: "dso-promises"): Extract<PageBlock, { type: "dso-promises" }>;
export function createBlock(type: "dso-testimonials"): Extract<PageBlock, { type: "dso-testimonials" }>;
export function createBlock(type: "dso-practice-hero"): Extract<PageBlock, { type: "dso-practice-hero" }>;
export function createBlock(type: "dso-stat-row"): Extract<PageBlock, { type: "dso-stat-row" }>;
export function createBlock(type: "dso-faq"): Extract<PageBlock, { type: "dso-faq" }>;
export function createBlock(type: "dso-split-feature"): Extract<PageBlock, { type: "dso-split-feature" }>;
export function createBlock(type: BlockType): PageBlock;
export function createBlock(type: BlockType): PageBlock {
  const def = getBlockDef(type);
  if (!def) throw new Error(`Unknown block type: ${type}`);
  const id = makeId(type);
  const props = def.defaultProps();
  switch (type) {
    case "hero": return { id, type: "hero", props: props as HeroBlockProps };
    case "trust-bar": return { id, type: "trust-bar", props: props as TrustBarBlockProps };
    case "pas-section": return { id, type: "pas-section", props: props as PasSectionBlockProps };
    case "comparison": return { id, type: "comparison", props: props as ComparisonBlockProps };
    case "stat-callout": return { id, type: "stat-callout", props: props as StatCalloutBlockProps };
    case "benefits-grid": return { id, type: "benefits-grid", props: props as BenefitsGridBlockProps };
    case "testimonial": return { id, type: "testimonial", props: props as TestimonialBlockProps };
    case "how-it-works": return { id, type: "how-it-works", props: props as HowItWorksBlockProps };
    case "product-grid": return { id, type: "product-grid", props: props as ProductGridBlockProps };
    case "photo-strip": return { id, type: "photo-strip", props: props as PhotoStripBlockProps };
    case "bottom-cta": return { id, type: "bottom-cta", props: props as BottomCtaBlockProps };
    case "video-section": return { id, type: "video-section", props: props as VideoSectionBlockProps };
    case "case-studies": return { id, type: "case-studies", props: props as CaseStudiesBlockProps };
    case "resources": return { id, type: "resources", props: props as ResourcesBlockProps };
    case "rich-text": return { id, type: "rich-text", props: props as RichTextBlockProps };
    case "custom-html": return { id, type: "custom-html", props: props as CustomHtmlBlockProps };
    case "zigzag-features": return { id, type: "zigzag-features", props: props as ZigzagFeaturesBlockProps };
    case "product-showcase": return { id, type: "product-showcase", props: props as ProductShowcaseBlockProps };
    case "nav-header": return { id, type: "nav-header", props: props as NavHeaderBlockProps };
    case "cta-button": return { id, type: "cta-button", props: props as CtaButtonBlockProps };
    case "full-bleed-hero": return { id, type: "full-bleed-hero", props: props as FullBleedHeroBlockProps };
    case "footer": return { id, type: "footer", props: props as FooterBlockProps };
    case "form": return { id, type: "form", props: props as FormBlockProps };
    case "popup": return { id, type: "popup", props: props as PopupBlockProps };
    case "sticky-bar": return { id, type: "sticky-bar", props: props as StickyBarBlockProps };
    case "roi-calculator": return { id, type: "roi-calculator", props: props as RoiCalculatorBlockProps };
    case "spacer": return { id, type: "spacer", props: props as SpacerBlockProps };
    case "dso-insights-dashboard": return { id, type: "dso-insights-dashboard", props: props as DsoInsightsDashboardBlockProps };
    case "dso-lab-tour": return { id, type: "dso-lab-tour", props: props as DsoLabTourBlockProps };
    case "dso-stat-bar": return { id, type: "dso-stat-bar", props: props as DsoStatBarBlockProps };
    case "dso-success-stories": return { id, type: "dso-success-stories", props: props as DsoSuccessStoriesBlockProps };
    case "dso-challenges": return { id, type: "dso-challenges", props: props as DsoChallengesBlockProps };
    case "dso-pilot-steps": return { id, type: "dso-pilot-steps", props: props as DsoPilotStepsBlockProps };
    case "dso-final-cta": return { id, type: "dso-final-cta", props: props as DsoFinalCtaBlockProps };
    case "dso-comparison": return { id, type: "dso-comparison", props: props as DsoComparisonBlockProps };
    case "dso-heartland-hero": return { id, type: "dso-heartland-hero", props: props as DsoHeartlandHeroBlockProps };
    case "dso-problem": return { id, type: "dso-problem", props: props as DsoProblemBlockProps };
    case "dso-ai-feature": return { id, type: "dso-ai-feature", props: props as DsoAiFeatureBlockProps };
    case "dso-stat-showcase": return { id, type: "dso-stat-showcase", props: props as DsoStatShowcaseBlockProps };
    case "dso-scroll-story": return { id, type: "dso-scroll-story", props: props as DsoScrollStoryBlockProps };
    case "dso-scroll-story-hero": return { id, type: "dso-scroll-story-hero", props: props as DsoScrollStoryHeroBlockProps };
    case "dso-network-map": return { id, type: "dso-network-map", props: props as DsoNetworkMapBlockProps };
    case "dso-case-flow": return { id, type: "dso-case-flow", props: props as DsoCaseFlowBlockProps };
    case "dso-live-feed": return { id, type: "dso-live-feed", props: props as DsoLiveFeedBlockProps };
    case "dso-particle-mesh": return { id, type: "dso-particle-mesh", props: props as DsoParticleMeshBlockProps };
    case "dso-flow-canvas": return { id, type: "dso-flow-canvas", props: props as DsoFlowCanvasBlockProps };
    case "dso-bento-outcomes": return { id, type: "dso-bento-outcomes", props: props as DsoBentoOutcomesBlockProps };
    case "dso-cta-capture": return { id, type: "dso-cta-capture", props: props as DsoCtaCaptureBlockProps };
    case "dso-meet-team": return { id, type: "dso-meet-team", props: props as DsoMeetTeamBlockProps };
    case "dso-paradigm-shift": return { id, type: "dso-paradigm-shift", props: props as DsoParadigmShiftBlockProps };
    case "dso-partnership-perks": return { id, type: "dso-partnership-perks", props: props as DsoPartnershipPerksBlockProps };
    case "dso-products-grid": return { id, type: "dso-products-grid", props: props as DsoProductsGridBlockProps };
    case "dso-promo-cards": return { id, type: "dso-promo-cards", props: props as DsoPromoCardsBlockProps };
    case "dso-activation-steps": return { id, type: "dso-activation-steps", props: props as DsoActivationStepsBlockProps };
    case "dso-promises": return { id, type: "dso-promises", props: props as DsoPromisesBlockProps };
    case "dso-testimonials": return { id, type: "dso-testimonials", props: props as DsoTestimonialsBlockProps };
    case "dso-practice-hero": return { id, type: "dso-practice-hero", props: props as DsoPracticeHeroBlockProps };
    case "dso-stat-row": return { id, type: "dso-stat-row", props: props as DsoStatRowBlockProps };
    case "dso-faq": return { id, type: "dso-faq", props: props as DsoFaqBlockProps };
    case "dso-split-feature": return { id, type: "dso-split-feature", props: props as DsoSplitFeatureBlockProps };
  }
}

export function templateToBlocks(templateId: string): PageBlock[] {
  const templates: Record<string, BlockType[]> = {
    "video-hero": ["hero", "video-section", "trust-bar", "photo-strip", "stat-callout", "benefits-grid", "testimonial", "product-grid", "bottom-cta"],
    "problem-first": ["hero", "pas-section", "comparison", "stat-callout", "trust-bar", "benefits-grid", "testimonial", "bottom-cta"],
    "social-proof-leader": ["hero", "testimonial", "photo-strip", "stat-callout", "trust-bar", "benefits-grid", "bottom-cta"],
    "how-it-works": ["hero", "how-it-works", "trust-bar", "product-grid", "benefits-grid", "testimonial", "bottom-cta"],
    "minimal-cta": ["hero", "trust-bar"],
  };
  const types = templates[templateId] ?? [];
  return types.map(t => createBlock(t));
}
