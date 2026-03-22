export interface TrustBarItem {
  value: string;
  label: string;
}

export interface BenefitItem {
  icon: string; // lucide icon name
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
}
