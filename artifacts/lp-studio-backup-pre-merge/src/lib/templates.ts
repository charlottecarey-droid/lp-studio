import type { ExtendedVariantConfig } from "./page-types";

export interface LPTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  badge?: string;
  config: ExtendedVariantConfig;
}

// ─── Dandy brand constants ────────────────────────────────────────────────────
const LIME = "#C7E738";

// ─── Shared: trust bar ───────────────────────────────────────────────────────
const DANDY_TRUST_BAR = {
  enabled: true,
  items: [
    { value: "12,000+", label: "Dental Practices" },
    { value: "48 hrs", label: "Avg. Turnaround" },
    { value: "99.2%", label: "Perfect Fit Rate" },
    { value: "#1", label: "Rated Digital Lab" },
  ],
};

// ─── Shared: benefits ────────────────────────────────────────────────────────
const DANDY_BENEFITS = {
  enabled: true,
  headline: "Why 12,000+ dentists switched to Dandy",
  columns: 3 as const,
  items: [
    { icon: "Zap", title: "5-Day Crowns", description: "Same-day scans shipped overnight. Your patients stop waiting — and stop cancelling." },
    { icon: "ScanLine", title: "No More Impressions", description: "Digital scans sent directly from your iTero or 3Shape. No putty, no remakes, no mess." },
    { icon: "RefreshCcw", title: "Free Remakes", description: "If a case doesn't fit, we remake it for free. No questions, no arguments." },
    { icon: "HeadphonesIcon", title: "Dedicated Lab Tech", description: "A real person answers your calls. Your cases, your preferences, remembered every time." },
    { icon: "BarChart2", title: "Real-Time Case Tracking", description: "Know exactly where every case is — from scan to delivery — on your phone or desktop." },
    { icon: "DollarSign", title: "Transparent Pricing", description: "Flat per-unit pricing. No surprises, no hidden fees, no annual contracts." },
  ],
};

// ─── Shared: testimonial ─────────────────────────────────────────────────────
const TESTIMONIAL_SARAH: ExtendedVariantConfig["testimonial"] = {
  enabled: true,
  quote: "Switching to Dandy was the single best business decision I made last year. My remakes dropped from 11% to under 1%, and my patients actually compliment how fast their restorations arrive.",
  author: "Dr. Sarah Chen",
  role: "General Dentist",
  practiceName: "Bright Smile Family Dentistry, Austin TX",
};

// ─── Shared: photo strip ─────────────────────────────────────────────────────
// Auto-scrolling horizontal gallery, inspired by meetdandy.com/labs/ hero strip
const DANDY_PHOTO_STRIP = {
  enabled: true,
  images: [
    { src: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&fit=crop", alt: "Dental restoration" },
    { src: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=600&fit=crop", alt: "Dental lab work" },
    { src: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=600&fit=crop", alt: "Digital dental scan" },
    { src: "https://images.unsplash.com/photo-1516914943479-89db7d9ae7f3?q=80&w=600&fit=crop", alt: "Dental care" },
    { src: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?q=80&w=600&fit=crop", alt: "Dental implant" },
    { src: "https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=600&fit=crop", alt: "Smile transformation" },
    { src: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=600&fit=crop", alt: "Lab technician" },
  ],
};

// ─── Shared: Old Way vs New Way ───────────────────────────────────────────────
const COMPARISON_SECTION = {
  enabled: true,
  headline: "A paradigm shift for your practice.",
  ctaText: "Get Started Free",
  oldWay: {
    label: "Traditional Lab",
    sublabel: "Old Way",
    bullets: [
      "Remake-prone analog workflows",
      "Annoying calls saying your scan is bad",
      "Cross your fingers the case looks right",
      "2–3 week waits for zirconia crowns",
      "4–6 appointments for dentures",
      "Multiple labs, none specializing",
    ],
  },
  newWay: {
    label: "Dandy",
    sublabel: "New Way",
    bullets: [
      "Scan for everything with fewer remakes",
      "Get scans reviewed with patient in chair",
      "3D design approval before manufacturing",
      "5-day zirconia crowns",
      "2-appointment dentures",
      "One lab for everything",
    ],
  },
};

// ─── Shared: product grid ────────────────────────────────────────────────────
// Inspired by meetdandy.com/labs/ "The better way to do lab work" section
const DANDY_PRODUCT_GRID = {
  enabled: true,
  headline: "The better way to do lab work.",
  subheadline: "Perfect fit. Fast turnarounds. One connected system that simplifies your workflow.",
  items: [
    {
      image: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?q=80&w=600&h=400&fit=crop",
      title: "Dentures",
      description: "2-appointment dentures using Dandy's streamlined digital workflow. Cases ready in under 10 days, starting at $199/arch.",
    },
    {
      image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&h=400&fit=crop",
      title: "Posterior Crowns",
      description: "AI-perfected posterior crowns in 5 days. Real-time prep analysis for precise, glove-fit margins. Backed by a 10-year warranty.",
    },
    {
      image: "https://images.unsplash.com/photo-1516914943479-89db7d9ae7f3?q=80&w=600&h=400&fit=crop",
      title: "Anterior Crowns",
      description: "Premium anterior crowns for stunning aesthetics at a fraction of traditional prices. Free 3D design approvals included.",
    },
    {
      image: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=600&h=400&fit=crop",
      title: "Implant Restorations",
      description: "Authentic FDA-approved implant parts, custom abutments milled in-house. Every approved system supported.",
    },
    {
      image: "https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=600&h=400&fit=crop",
      title: "Clear Aligners",
      description: "Doctor-directed clear aligners backed by digital treatment plans. Affordable, predictable results for your patients.",
    },
    {
      image: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=600&h=400&fit=crop",
      title: "Guided Implant Surgery",
      description: "Digital treatment plans and 3D-printed surgical guides. Reliable fit and precision for every procedure.",
    },
  ],
};

// ─── Shared: stat callout ─────────────────────────────────────────────────────
const STAT_CALLOUT_REMAKES = {
  enabled: true,
  stat: "89%",
  description: "Average reduction in remakes when partnering with Dandy",
  footnote: "Based on statistics from real dentists who switched from traditional labs.",
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — Video Hero (AIDA)
// ─────────────────────────────────────────────────────────────────────────────
export const templateVideoHero: LPTemplate = {
  id: "video-hero",
  name: "Video Hero",
  description: "Lead with the Dandy demo video, back it up with proof. Highest-converting structure for warm traffic.",
  framework: "AIDA",
  badge: "Most Popular",
  config: {
    templateId: "video-hero",
    heroType: "dandy-video",
    layout: "centered",
    backgroundStyle: "white",
    headline: "The Dental Lab Your Patients Will Thank You For",
    subheadline: "Dandy's digital-first lab delivers crowns, bridges, and implants in 5 days — with a fit rate your old lab never came close to.",
    ctaText: "Get Started Free",
    ctaColor: LIME,
    ctaUrl: "#",
    showSocialProof: true,
    socialProofText: "Trusted by 12,000+ dental practices across the US",
    trustBar: DANDY_TRUST_BAR,
    photoStrip: DANDY_PHOTO_STRIP,
    statCallout: STAT_CALLOUT_REMAKES,
    benefits: DANDY_BENEFITS,
    testimonial: TESTIMONIAL_SARAH,
    productGrid: DANDY_PRODUCT_GRID,
    bottomCta: {
      enabled: true,
      headline: "Ready to upgrade your lab — with zero risk?",
      subheadline: "No contracts. No setup fees. Free shipping both ways.",
      ctaText: "Get Started Free",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — Problem First (PAS)
// ─────────────────────────────────────────────────────────────────────────────
export const templateProblemFirst: LPTemplate = {
  id: "problem-first",
  name: "Problem First",
  description: "Open with the pain your audience already feels. Name it, then position Dandy as the obvious solution.",
  framework: "PAS (Problem → Agitate → Solution)",
  badge: "Best for Cold Traffic",
  config: {
    templateId: "problem-first",
    heroType: "dandy-video",
    layout: "centered",
    backgroundStyle: "white",
    headline: "Still Waiting 3 Weeks for Lab Work?",
    subheadline: "Most dental labs are slow, opaque, and impossible to reach. Your patients are rescheduling — and your revenue is suffering.",
    ctaText: "See How Dandy Is Different",
    ctaColor: LIME,
    ctaUrl: "#",
    showSocialProof: false,
    painSection: {
      enabled: true,
      headline: "Your lab is costing you more than money.",
      body: "Every remake is a missed appointment slot. Every three-week turnaround is a patient who calls to ask 'is it ready yet?' — and considers switching practices. You didn't go to dental school to manage a broken supply chain.",
      bullets: [
        "Remakes eating into your margins with no explanation",
        "No visibility — you call, they say 'still in production'",
        "Inconsistent fits that lead to chair-side adjustments",
        "3–4 week waits that frustrate your best patients",
      ],
    },
    comparisonSection: COMPARISON_SECTION,
    statCallout: STAT_CALLOUT_REMAKES,
    trustBar: DANDY_TRUST_BAR,
    benefits: {
      enabled: true,
      headline: "Dandy fixes every one of these problems",
      columns: 3,
      items: DANDY_BENEFITS.items,
    },
    testimonial: TESTIMONIAL_SARAH,
    bottomCta: {
      enabled: true,
      headline: "Switch to Dandy in less than 10 minutes.",
      subheadline: "No contracts. First case is on us.",
      ctaText: "Get Started Free",
    },
    guaranteeBar: {
      enabled: true,
      text: "Free remakes on every case, forever. If it doesn't fit, we fix it — at no cost to you.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — Social Proof Leader
// ─────────────────────────────────────────────────────────────────────────────
export const templateSocialProofLeader: LPTemplate = {
  id: "social-proof-leader",
  name: "Social Proof Leader",
  description: "Lead with a powerful dentist testimonial. Skeptics trust peers more than brands.",
  framework: "Social Proof → Benefits → CTA",
  config: {
    templateId: "social-proof-leader",
    heroType: "none",
    layout: "centered",
    backgroundStyle: "white",
    headline: '"My Remakes Dropped from 11% to Under 1%"',
    subheadline: "12,000 dentists made the switch to Dandy. Here's why they're not going back.",
    ctaText: "Join Them — Get Started Free",
    ctaColor: LIME,
    ctaUrl: "#",
    showSocialProof: true,
    socialProofText: "12,000+ practices · 4.9★ average rating",
    testimonial: {
      enabled: true,
      quote: "Switching to Dandy was the single best business decision I made last year. My remakes dropped from 11% to under 1%, and my patients actually compliment how fast their restorations arrive. I don't know why I waited so long.",
      author: "Dr. Sarah Chen",
      role: "General Dentist",
      practiceName: "Bright Smile Family Dentistry, Austin TX",
    },
    photoStrip: DANDY_PHOTO_STRIP,
    statCallout: STAT_CALLOUT_REMAKES,
    trustBar: DANDY_TRUST_BAR,
    benefits: DANDY_BENEFITS,
    bottomCta: {
      enabled: true,
      headline: "Join 12,000 practices who already made the switch.",
      subheadline: "No annual contracts. No setup fees. Cancel anytime.",
      ctaText: "Get Started Free",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — How It Works
// ─────────────────────────────────────────────────────────────────────────────
export const templateHowItWorks: LPTemplate = {
  id: "how-it-works",
  name: "How It Works",
  description: "Reduce anxiety by showing exactly how easy the switch is.",
  framework: "Clarity → Confidence → CTA",
  config: {
    templateId: "how-it-works",
    heroType: "dandy-video",
    layout: "centered",
    backgroundStyle: "white",
    headline: "Go Digital in 3 Simple Steps",
    subheadline: "Most practices are up and running with Dandy in under a week. Here's exactly how it works.",
    ctaText: "Start My Free Setup",
    ctaColor: LIME,
    ctaUrl: "#",
    showSocialProof: true,
    socialProofText: "Setup takes less than 10 minutes — and it's completely free",
    howItWorks: {
      enabled: true,
      headline: "Simple to start. Even simpler to stay.",
      steps: [
        { number: "01", title: "Scan & Send", description: "Take an intraoral scan with your existing scanner (iTero, 3Shape, Medit). Send it to Dandy in seconds — no new equipment needed." },
        { number: "02", title: "We Manufacture", description: "Your case enters Dandy's digital lab immediately. A dedicated tech reviews every scan. Crowns, bridges, and implants crafted to exact spec." },
        { number: "03", title: "Delivered to Your Door", description: "Your restoration arrives in 5 business days — tracked the whole way. Fits the first time, or we remake it free. No exceptions." },
      ],
    },
    trustBar: DANDY_TRUST_BAR,
    productGrid: DANDY_PRODUCT_GRID,
    benefits: {
      enabled: true,
      headline: "Everything your current lab should already be giving you",
      columns: 3,
      items: DANDY_BENEFITS.items,
    },
    testimonial: TESTIMONIAL_SARAH,
    bottomCta: {
      enabled: true,
      headline: "Your first Dandy case ships free.",
      subheadline: "No contracts, no commitments. Just better lab work.",
      ctaText: "Start My Free Setup",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 5 — Minimal CTA
// ─────────────────────────────────────────────────────────────────────────────
export const templateMinimalCta: LPTemplate = {
  id: "minimal-cta",
  name: "Minimal CTA",
  description: "No distractions. One message, one CTA. For high-intent traffic that already knows what it wants.",
  framework: "Single-Focus Conversion",
  badge: "Fastest Page",
  config: {
    templateId: "minimal-cta",
    heroType: "none",
    layout: "minimal",
    backgroundStyle: "white",
    headline: "Better Lab Work. Starting Today.",
    subheadline: "5-day turnaround. 99.2% fit rate. Free remakes, always. Join 12,000+ dental practices on Dandy.",
    ctaText: "Get Started Free →",
    ctaColor: LIME,
    ctaUrl: "#",
    showSocialProof: true,
    socialProofText: "No contracts · No setup fees · Free shipping",
    trustBar: {
      enabled: true,
      items: [
        { value: "12,000+", label: "Practices" },
        { value: "5 Days", label: "Turnaround" },
        { value: "99.2%", label: "Fit Rate" },
        { value: "Free", label: "Remakes" },
      ],
    },
    guaranteeBar: {
      enabled: true,
      text: "No contracts. Cancel anytime. Free remakes on every case — guaranteed.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// All templates
// ─────────────────────────────────────────────────────────────────────────────
export const LP_TEMPLATES: LPTemplate[] = [
  templateVideoHero,
  templateProblemFirst,
  templateSocialProofLeader,
  templateHowItWorks,
  templateMinimalCta,
];

export function getTemplateById(id: string): LPTemplate | undefined {
  return LP_TEMPLATES.find((t) => t.id === id);
}
