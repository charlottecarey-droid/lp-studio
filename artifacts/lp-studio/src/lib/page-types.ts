import type { PageBlock } from "./block-types";

export interface BuilderPageResponse {
  pageType: "builder";
  id: number;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "pending_review" | "published";
  customCss?: string;
  animationsEnabled?: boolean;
  smoothScroll?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  /**
   * Task #494 — server-resolved `<meta name="robots">` content (e.g.
   * "noindex", "nofollow", "noindex,nofollow"). null/absent = fully allowed,
   * so the viewer emits NO robots tag (matching the prerendered static HTML,
   * which never writes a redundant index,follow).
   */
  robots?: string | null;
  accountNameApollo?: string;
  /**
   * Page-record variables (lp_pages.pageVariables jsonb). Includes the
   * reserved `__linkedFormStyle` key when the editor has configured per-page
   * colour overrides for the in-modal linked form. Use
   * `readLinkedFormStyle(pageVariables)` to parse it.
   */
  pageVariables?: Record<string, string>;
}

export function isBuilderPageResponse(value: unknown): value is BuilderPageResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "pageType" in value &&
    (value as { pageType: unknown }).pageType === "builder"
  );
}

export interface TrustBarItem {
  value: string;
  label: string;
}

export interface BenefitItem {
  icon: string;
  title: string;
  description: string;
}

export interface TestimonialConfig {
  enabled: boolean;
  quote: string;
  author: string;
  role: string;
  practiceName?: string;
}

export interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
}

export interface ProductGridItem {
  image: string;
  title: string;
  description: string;
}

export interface ExtendedVariantConfig {
  // ── Core (matches OpenAPI VariantConfig) ─────────────────────────────────
  heroType: "dandy-video" | "static-image" | "none";
  headline: string;
  subheadline?: string;
  ctaText: string;
  ctaColor?: string;
  ctaUrl?: string;
  layout: "centered" | "split" | "minimal";
  backgroundStyle: "white" | "dark" | "gradient";
  showSocialProof?: boolean;
  socialProofText?: string;

  // ── Template system ────────────────────────────────────────────────────
  templateId?: string;

  // ── Trust bar (stats row beneath hero) ────────────────────────────────
  trustBar?: {
    enabled: boolean;
    items: TrustBarItem[];
  };

  // ── Benefit/feature grid ───────────────────────────────────────────────
  benefits?: {
    enabled: boolean;
    headline?: string;
    columns?: 2 | 3;
    items: BenefitItem[];
  };

  // ── Testimonial block ──────────────────────────────────────────────────
  testimonial?: TestimonialConfig;

  // ── Pain/agitation section (PAS framework) ────────────────────────────
  painSection?: {
    enabled: boolean;
    headline: string;
    body: string;
    bullets?: string[];
  };

  // ── How it works steps ─────────────────────────────────────────────────
  howItWorks?: {
    enabled: boolean;
    headline?: string;
    steps: HowItWorksStep[];
  };

  // ── Bottom CTA band ────────────────────────────────────────────────────
  bottomCta?: {
    enabled: boolean;
    headline: string;
    subheadline?: string;
    ctaText?: string;
  };

  // ── Risk reversal / guarantee bar ─────────────────────────────────────
  guaranteeBar?: {
    enabled: boolean;
    text: string;
  };

  // ── Scrolling horizontal photo strip ─────────────────────────────────
  photoStrip?: {
    enabled: boolean;
    images: Array<{ src: string; alt: string }>;
  };

  // ── Old Way vs New Way comparison (meetdandy.com/labs/ style) ─────────
  comparisonSection?: {
    enabled: boolean;
    headline?: string;
    ctaText?: string;
    oldWay: {
      label: string;
      sublabel?: string;
      bullets: string[];
    };
    newWay: {
      label: string;
      sublabel?: string;
      bullets: string[];
    };
  };

  // ── Product/service image grid ────────────────────────────────────────
  productGrid?: {
    enabled: boolean;
    headline?: string;
    subheadline?: string;
    items: ProductGridItem[];
  };

  // ── Large stat callout ────────────────────────────────────────────────
  statCallout?: {
    enabled: boolean;
    stat: string;
    description: string;
    footnote?: string;
  };
}
