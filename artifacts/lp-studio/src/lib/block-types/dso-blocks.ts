import type React from "react";
import type { BackgroundStyle } from "../bg-styles";
import type { CtaMode } from "./common";

export interface DsoPracticeNavLink {
  label: string;
  anchor: string;
}

export interface DsoPracticeNavBlockProps {
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
  eyebrow?: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  primaryCtaMode?: CtaMode;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  backgroundStyle?: BackgroundStyle;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  layout?: "full-bleed" | "split" | "split-video" | "stacked-video";
  heroImageUrl?: string;
  heroImageSide?: "left" | "right";
  heroVideoUrl?: string;
  heroTopPadding?: number;
  heroMinHeight?: number;
  heroSidePadding?: number;
  disableScrollFade?: boolean;
  videoAutoplay?: boolean;
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
  backgroundStyle?: BackgroundStyle;
}

export interface DsoScrollStoryHeroBlockProps {
  eyebrow: string;
  chapters: DsoScrollStoryChapter[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
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

export interface DsoActivationStepsBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  steps: DsoActivationStep[];
  ctaText?: string;
  ctaUrl?: string;
  ctaMode?: CtaMode;
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

export interface DsoPracticeHeroBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  primaryCtaMode?: CtaMode;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  secondaryCtaMode?: CtaMode;
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

export interface DsoFinalCtaBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  primaryCtaMode?: CtaMode;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  backgroundStyle: BackgroundStyle;
  backgroundImage?: string;
  backgroundOverlay?: number;
  overlayColor?: string;
}

export interface DsoComparisonBlockProps {
  eyebrow: string;
  headline: string;
  subheadline: string;
  companyName: string;
  ctaText: string;
  ctaUrl: string;
  ctaMode?: CtaMode;
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
