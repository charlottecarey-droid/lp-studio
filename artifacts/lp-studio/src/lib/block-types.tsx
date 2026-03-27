import type React from "react";

export type BlockCategory = "Layout" | "Content" | "Social Proof" | "CTA" | "Lead Capture" | "Engagement" | "Interactive" | "DSO";

export interface HeroBlockProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  heroType: "dandy-video" | "static-image" | "none";
  layout: "centered" | "split" | "split-right" | "minimal";
  backgroundStyle: "white" | "dark";
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
  backgroundStyle: "white" | "dark" | "light-gray";
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
  backgroundStyle: "white" | "light-gray";
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
  backgroundStyle: "white" | "light-gray" | "dark";
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
  backgroundStyle: "light" | "muted" | "dark";
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
  backgroundStyle: "white" | "light-gray" | "dark";
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
  backgroundStyle: "white" | "dark";
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
  backgroundStyle: "white" | "dark" | "brand";
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
  backgroundStyle: "white" | "dark" | "light-gray";
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
  | { type: "dso-lab-tour"; props: DsoLabTourBlockProps };

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
