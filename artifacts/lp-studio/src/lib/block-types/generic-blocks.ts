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
  submitButtonTextColor?: string;
  successMessage: string;
  redirectUrl: string;
  backgroundStyle: BackgroundStyle;
  formId?: number;
}

export interface ZigzagFeaturesBlockProps {
  rows: ZigzagFeatureRow[];
  headlineSize?: "sm" | "md" | "lg" | "xl" | "2xl";
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
