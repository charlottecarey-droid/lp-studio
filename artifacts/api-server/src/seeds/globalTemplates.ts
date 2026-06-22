// Idempotent seed for global landing-page templates that any tenant in the
// matching industry can clone from.
//
// These rows live in `lp_pages` with is_template=true and is_global=true. The
// owning tenant_id is irrelevant for visibility (the GET /lp/templates filter
// pulls all globals regardless of owner) but the FK still has to point at a
// real tenant row, so every global is owned by the dedicated system tenant
// (slug `__system-templates`) resolved via `ensureSystemTenant()` — a single
// neutral home that keeps the library out of any real customer workspace.
//
// Block JSON shapes match the props expected by `BlockRenderer` and the
// per-type defaults in `BLOCK_REGISTRY`. Anything missing falls back to those
// defaults inside the renderer / builder.

/** Coarse intent bucket for all-in-one templates (June 2026). Drives the
 *  AI generation route's intent selector (lib/ai-prompts/template-intent.ts).
 *  "customer-story-hub" / "case-study" are reserved for templates that don't
 *  exist yet (follow-up PRs). Templates without a category behave as
 *  "generic" — never intent-matched. */
export type TemplateCategory =
  | "storefront"
  | "content-series" // podcast / video / newsletter
  | "blog"
  | "business-case"
  | "customer-story-hub" // future
  | "case-study" // future
  | "event"
  | "restaurant"
  | "portfolio"
  | "services"
  | "saas-launch"
  | "generic";

/** ABM funnel stage (June 2026). An ADDITIVE, OPTIONAL grouping tag for the
 *  all-in-one framework / microsite templates so the create-microsite modal can
 *  group them by sales intent. Omitted = ungrouped (fail-open). Not persisted to
 *  a DB column — derived/grouped client-side from the seed (and, where the seed
 *  isn't available, from slug/category). */
export type TemplateFunnelStage =
  | "first-meeting"
  | "deal-acceleration"
  | "onboarding"
  | "expansion-renewal";

export interface GlobalTemplateSeed {
  slug: string;
  title: string;
  templateLabel: string;
  templateDescription: string;
  /** Marketplace thumbnail URL. Stored on lp_pages.og_image. */
  ogImage: string;
  /** Industry tag, free-form. Built-in starters use values like "dental",
   *  "generic", "saas", "restaurant", "events", "agency", "creator",
   *  "local-services". Null means "universal / no tag". */
  industry: string | null;
  blocks: { id: string; type: string; props: Record<string, unknown> }[];
  /** Marketplace ordering rank. Lower = ranked higher in "Featured".
   *  Flagship premium templates: 1-10. Distinctive premium: 20.
   *  Generic starters: 50. Industry starters: 100. Tenant templates: omit. */
  premiumRank?: number;
  /** Intent bucket (June 2026). Stored on lp_pages.category. Only set on
   *  all-in-one templates; omitted = generic / never intent-matched. */
  category?: TemplateCategory;
  /** Intent phrases the AI generation route matches against the user's
   *  prompt (whole-word / phrase matching — see template-intent.ts). Stored
   *  on lp_pages.keywords as jsonb. Only set on all-in-one templates. */
  keywords?: string[];
  /** True for monolithic single-block templates AND curated multi-block
   *  recipes whose structure must NOT gain extra blocks. Only isAllInOne
   *  templates enter the intent selector's candidate set. Stored on
   *  lp_pages.is_all_in_one. */
  isAllInOne?: boolean;
  /** ABM funnel-stage grouping tag (June 2026). Optional + fail-open: the
   *  microsite modal groups all-in-one templates by this when present and falls
   *  back to slug/category-derived grouping otherwise. PRIMARY funnel stage;
   *  persisted to lp_pages.funnel_stage (June 2026 eligibility work). */
  funnelStage?: TemplateFunnelStage;
  /** Template eligibility (June 2026). DECLARE where the template may be
   *  AUTO-recommended. All three are ADDITIVE + FAIL-OPEN: omitted/empty = ANY
   *  (no restriction), so a template that declares nothing stays eligible
   *  everywhere. Persisted to lp_pages.eligible_* jsonb. Manual selection is
   *  never gated by these.
   *    eligibleSegments     — segment names/ids the template may be used for.
   *    eligiblePersonas     — personas it's appropriate for.
   *    eligibleFunnelStages — funnel stages it fits (the ALLOWED set, vs.
   *                           funnelStage the PRIMARY). Defaults at backfill to
   *                           [funnelStage] when only the singular is known. */
  eligibleSegments?: string[];
  eligiblePersonas?: string[];
  /** Free-form stage labels (a superset of TemplateFunnelStage — e.g. a bare
   *  "renewal" alias alongside "expansion-renewal"). */
  eligibleFunnelStages?: string[];
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const ACCENT_BLUE = "#2563EB"; // Generic, brand-neutral accent for starter templates
const FOOTER_DARK = "#0F172A";

const blockId = (type: string, n: number) => `seed-${type}-${n}`;

function genericFooter(brand: string, n: number) {
  return {
    id: blockId("footer", n),
    type: "footer",
    props: {
      backgroundColor: FOOTER_DARK,
      accentColor: ACCENT_BLUE,
      copyrightText: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
      showSocialLinks: true,
      facebookUrl: "#",
      instagramUrl: "#",
      linkedinUrl: "#",
      columns: [
        {
          title: "Product",
          links: [
            { label: "Features", url: "#features" },
            { label: "Pricing", url: "#pricing" },
            { label: "Integrations", url: "#" },
            { label: "Changelog", url: "#" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", url: "#" },
            { label: "Customers", url: "#" },
            { label: "Careers", url: "#" },
            { label: "Contact", url: "#contact" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Blog", url: "#" },
            { label: "Help Center", url: "#" },
            { label: "Privacy", url: "#" },
            { label: "Terms", url: "#" },
          ],
        },
      ],
    },
  };
}

function genericNav(brand: string, n: number) {
  return {
    id: blockId("nav-header", n),
    type: "nav-header",
    props: {
      logoText: brand,
      logoUrl: "",
      navLinks: [
        { label: "Features", url: "#features" },
        { label: "Pricing", url: "#pricing" },
        { label: "Customers", url: "#customers" },
        { label: "About", url: "#" },
      ],
      phone: "",
      cta1: { label: "Sign in", url: "#" },
      cta2: { label: "Get started", url: "#cta" },
    },
  };
}

// ─── Templates ───────────────────────────────────────────────────────────────

import { INDUSTRY_TEMPLATE_SEEDS } from "./industryTemplates";

const GENERIC_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  // 1. SaaS Product Landing
  {
    slug: "global-saas-landing",
    title: "SaaS Product Landing",
    templateLabel: "SaaS Product Landing",
    templateDescription:
      "Hero, social proof, alternating feature rows, testimonial, and a closing CTA. The classic high-converting structure for B2B SaaS.",
    ogImage:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Northstar", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Ship faster with the modern operations platform",
          subheadline:
            "Northstar replaces five disconnected tools with one unified workspace your whole team will actually use. Free for the first 14 days.",
          ctaText: "Start free trial",
          ctaUrl: "#cta",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by 4,000+ teams at companies you know",
          imageUrl:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "4,000+", label: "Customers" },
            { value: "99.99%", label: "Uptime SLA" },
            { value: "SOC 2", label: "Type II Certified" },
            { value: "4.9★", label: "G2 Rating" },
          ],
        },
      },
      {
        id: blockId("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "Everything your team needs in one place",
          subheadline: "Built for fast-moving teams that hate context switching.",
          headlineAlign: "center",
          rows: [
            {
              tag: "AUTOMATIONS",
              headline: "Replace your spreadsheets with workflows that run themselves",
              body: "Trigger any action from any event. Connect to 200+ apps in a click. No code, no engineering tickets, no waiting.",
              ctaText: "See automations",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "ANALYTICS",
              headline: "Real metrics, not vanity dashboards",
              body: "See exactly what's moving the needle, share live views with stakeholders, and stop exporting CSVs to Excel forever.",
              ctaText: "Explore analytics",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "COLLABORATION",
              headline: "Bring every team into the same workspace",
              body: "Granular permissions, threaded comments, and audit logs out of the box. Built for companies of every size.",
              ctaText: "How it works",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: blockId("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "We replaced six tools with Northstar in our first quarter. Everyone got faster, our reports got cleaner, and the engineering team finally got their nights back.",
          author: "Maya Patel",
          role: "VP Operations",
          practiceName: "Aperture Logistics",
        },
      },
      {
        id: blockId("bottom-cta", 6),
        type: "bottom-cta",
        props: {
          headline: "Ready to see what your team could do?",
          subheadline: "Free for 14 days. No credit card required. Cancel anytime.",
          ctaText: "Start free trial",
          ctaUrl: "#",
        },
      },
      genericFooter("Northstar", 7),
    ],
  },

  // 2. Lead Generation / Gated Content
  {
    slug: "global-lead-gen",
    title: "Lead Generation Page",
    templateLabel: "Lead Generation Page",
    templateDescription:
      "Hero, value props, and a lead capture form designed for paid traffic and gated downloads. High-intent, single-focus.",
    ogImage:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: blockId("hero", 1),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "The 2026 B2B Buyer Report",
          subheadline:
            "Two hundred pages of original research on how today's buyers evaluate software. Free download, no fluff.",
          ctaText: "Get the report",
          ctaUrl: "#form",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Downloaded by teams at Stripe, Notion, Linear, Figma, and 800+ more",
          imageUrl:
            "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 2),
        type: "trust-bar",
        props: {
          items: [
            { value: "200+", label: "Pages of Research" },
            { value: "1,200", label: "Buyers Surveyed" },
            { value: "12", label: "Industry Segments" },
            { value: "Free", label: "Forever" },
          ],
        },
      },
      {
        id: blockId("benefits-grid", 3),
        type: "benefits-grid",
        props: {
          headline: "What's inside",
          columns: 3,
          items: [
            {
              icon: "BarChart2",
              title: "Buyer behavior",
              description:
                "How decisions actually get made today — by role, region, and company size.",
            },
            {
              icon: "Activity",
              title: "Channel benchmarks",
              description:
                "What's working in 2026, with hard CAC and conversion numbers by segment.",
            },
            {
              icon: "Zap",
              title: "AI-era playbooks",
              description:
                "Templates and worksheets you can apply with your team this week.",
            },
            {
              icon: "Users",
              title: "Buying committee maps",
              description:
                "Who's actually in the room — and how to pitch each one.",
            },
            {
              icon: "DollarSign",
              title: "Pricing & packaging data",
              description:
                "How peer companies structure tiers, trials, and contract terms.",
            },
            {
              icon: "Clipboard",
              title: "Forecasting models",
              description:
                "Spreadsheet templates for pipeline coverage, win-rate, and ramp.",
            },
          ],
        },
      },
      {
        id: blockId("form", 4),
        type: "form",
        props: {
          headline: "Get instant access",
          subheadline:
            "Tell us where to send the report. We'll never share your details.",
          multiStep: false,
          steps: [
            {
              title: "Your info",
              fields: [
                {
                  id: "email",
                  type: "email",
                  label: "Work email",
                  placeholder: "you@company.com",
                  required: true,
                },
                {
                  id: "name",
                  type: "text",
                  label: "Full name",
                  placeholder: "Jane Smith",
                  required: true,
                },
                {
                  id: "company",
                  type: "text",
                  label: "Company",
                  placeholder: "Acme Inc.",
                  required: true,
                },
                {
                  id: "role",
                  type: "text",
                  label: "Job title",
                  placeholder: "Head of Marketing",
                  required: false,
                },
              ],
            },
          ],
          submitButtonText: "Send me the report",
          submitButtonColor: ACCENT_BLUE,
          successMessage: "Thanks! Check your inbox — the report is on its way.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      genericFooter("Buyer Report", 5),
    ],
  },

  // 3. Webinar / Event Registration
  {
    slug: "global-webinar-registration",
    title: "Webinar Registration",
    templateLabel: "Webinar Registration",
    templateDescription:
      "Full-bleed hero, what-you'll-learn steps, speaker testimonial, and a streamlined registration form.",
    ogImage:
      "https://images.unsplash.com/photo-1591115765373-5207764f72e7?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: blockId("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headlineSize: "lg",
          headline: "Live: How modern teams ship 3× faster in 2026",
          subheadline:
            "A 45-minute live session with operators from Linear, Vercel, and Ramp. Free to attend, recording sent to all registrants.",
          ctaText: "Save my seat",
          ctaUrl: "#form",
          secondaryCtaText: "View agenda",
          secondaryCtaUrl: "#agenda",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1591115765373-5207764f72e7?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 60,
          minHeight: "large",
          contentAlignment: "left",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Agenda", url: "#agenda" },
            { label: "Speakers", url: "#speakers" },
            { label: "FAQ", url: "#faq" },
          ],
        },
      },
      {
        id: blockId("trust-bar", 2),
        type: "trust-bar",
        props: {
          items: [
            { value: "45 min", label: "Live + Q&A" },
            { value: "Thu Mar 14", label: "11am PT / 2pm ET" },
            { value: "3 Speakers", label: "From top teams" },
            { value: "Free", label: "Recording included" },
          ],
        },
      },
      {
        id: blockId("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "What you'll walk away with",
          steps: [
            {
              number: "01",
              title: "A repeatable shipping cadence",
              description:
                "The exact weekly rhythms top teams use to keep everyone aligned without endless meetings.",
            },
            {
              number: "02",
              title: "An AI-augmented planning loop",
              description:
                "How to use AI for spec drafting, code review, and changelog writing without losing quality.",
            },
            {
              number: "03",
              title: "Templates you can use Monday",
              description:
                "Notion docs, Linear views, and meeting agendas you can copy directly into your team.",
            },
          ],
        },
      },
      {
        id: blockId("testimonial", 4),
        type: "testimonial",
        props: {
          quote:
            "I've been to a lot of these webinars. This one actually changed how we run our weekly planning. Worth blocking an hour for.",
          author: "Daniel Wu",
          role: "Director of Engineering",
          practiceName: "Hexagon Health",
        },
      },
      {
        id: blockId("form", 5),
        type: "form",
        props: {
          headline: "Save your seat",
          subheadline: "Spots are capped — register now to lock yours in.",
          multiStep: false,
          steps: [
            {
              title: "Register",
              fields: [
                {
                  id: "email",
                  type: "email",
                  label: "Work email",
                  placeholder: "you@company.com",
                  required: true,
                },
                {
                  id: "name",
                  type: "text",
                  label: "Full name",
                  placeholder: "Jane Smith",
                  required: true,
                },
                {
                  id: "company",
                  type: "text",
                  label: "Company",
                  placeholder: "Acme Inc.",
                  required: false,
                },
              ],
            },
          ],
          submitButtonText: "Register free",
          submitButtonColor: ACCENT_BLUE,
          successMessage: "You're in! We'll email you the calendar invite shortly.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      genericFooter("Webinar Series", 6),
    ],
  },

  // 4. Product Launch / Coming Soon
  {
    slug: "global-product-launch",
    title: "Product Launch",
    templateLabel: "Product Launch",
    templateDescription:
      "Cinematic full-bleed hero, photo strip showcase, alternating feature rows, big stat, and a closing CTA. Built for launch day.",
    ogImage:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: blockId("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headlineSize: "lg",
          headline: "Introducing Halo",
          subheadline:
            "The first device built around how you actually use one. Three years in the making. Available to order today.",
          ctaText: "Pre-order — $299",
          ctaUrl: "#cta",
          secondaryCtaText: "Watch the launch film",
          secondaryCtaUrl: "#video",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 30,
          minHeight: "full",
          contentAlignment: "center",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Specs", url: "#specs" },
            { label: "Story", url: "#story" },
            { label: "Pre-order", url: "#cta" },
          ],
        },
      },
      {
        id: blockId("trust-bar", 2),
        type: "trust-bar",
        props: {
          items: [
            { value: "$299", label: "Starting Price" },
            { value: "Apr 22", label: "Ships" },
            { value: "Free", label: "Worldwide Shipping" },
            { value: "30 Day", label: "Trial" },
          ],
        },
      },
      {
        id: blockId("photo-strip", 3),
        type: "photo-strip",
        props: {
          images: [
            {
              src: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?q=80&w=900&fit=crop",
              alt: "Product detail",
            },
            {
              src: "https://images.unsplash.com/photo-1606229365485-93a3b8ee0385?q=80&w=900&fit=crop",
              alt: "Product in use",
            },
            {
              src: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?q=80&w=900&fit=crop",
              alt: "Product close-up",
            },
            {
              src: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=900&fit=crop",
              alt: "Lifestyle shot",
            },
            {
              src: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=900&fit=crop",
              alt: "Workspace shot",
            },
          ],
        },
      },
      {
        id: blockId("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "Built for the way you actually work",
          headlineAlign: "center",
          rows: [
            {
              tag: "DESIGN",
              headline: "Aerospace-grade aluminum, machined to 0.05mm tolerance",
              body: "Every Halo is CNC-cut from a single billet, hand-finished, and assembled in our California facility. No parts feel like plastic, because none of them are.",
              ctaText: "See the materials",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "BATTERY",
              headline: "32 hours of real-world use, charges in 18 minutes",
              body: "Our solid-state cell delivers more than three full days between charges, and a fast-charge top-up gets you back to a full day in less time than your morning coffee.",
              ctaText: "Tech specs",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: blockId("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "32 hrs",
          description: "Real-world battery life — more than 3× the previous generation",
          footnote: "Tested by independent reviewers under typical daily use conditions.",
        },
      },
      {
        id: blockId("bottom-cta", 6),
        type: "bottom-cta",
        props: {
          headline: "Be one of the first to own a Halo",
          subheadline: "Pre-orders ship in launch order. Lock in your spot today.",
          ctaText: "Pre-order — $299",
          ctaUrl: "#",
        },
      },
      genericFooter("Halo", 7),
    ],
  },

  // 5. Agency / Services Pitch
  {
    slug: "global-agency-services",
    title: "Agency Services",
    templateLabel: "Agency Services",
    templateDescription:
      "Confident hero, services grid, recent case studies, and a contact form. Built for studios pitching real work to serious clients.",
    ogImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Atelier", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Brand and product design that actually moves the metric",
          subheadline:
            "Atelier is a 12-person studio that partners with growth-stage companies on naming, identity, and product UX. Selectively. For about 8 clients a year.",
          ctaText: "Book an intro call",
          ctaUrl: "#contact",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by founders at Notion, Linear, Stripe, Mercury, and 60+ more",
          imageUrl:
            "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "60+", label: "Brands Launched" },
            { value: "12", label: "Senior Designers" },
            { value: "8", label: "Clients per Year" },
            { value: "10 yrs", label: "Studio History" },
          ],
        },
      },
      {
        id: blockId("product-grid", 4),
        type: "product-grid",
        props: {
          headline: "How we work with you",
          subheadline:
            "Pick a single sprint, or partner with us across the full year. We scope every engagement to outcomes, not hours.",
          items: [
            {
              image:
                "https://images.unsplash.com/photo-1559028012-481c04fa702d?q=80&w=900&h=600&fit=crop",
              title: "Brand Identity",
              description:
                "Naming, logo, type system, voice, and a guideline doc your team can actually use. 6–8 weeks.",
            },
            {
              image:
                "https://images.unsplash.com/photo-1559028006-448665bd7c7f?q=80&w=900&h=600&fit=crop",
              title: "Product UX",
              description:
                "Research, IA, prototype, and test. We work alongside your engineers, not over the wall. 8–12 weeks.",
            },
            {
              image:
                "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=900&h=600&fit=crop",
              title: "Marketing Site",
              description:
                "Strategy, copy, design, and a production-ready build. Hand-built, not templated. 6–10 weeks.",
            },
          ],
        },
      },
      {
        id: blockId("case-studies", 5),
        type: "case-studies",
        props: {
          headline: "Recent work",
          subheadline: "A small selection from the last 12 months.",
          items: [
            {
              image:
                "https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "How a 30-person fintech tripled trial conversion in 90 days",
              categories: "FINTECH / SERIES B",
              url: "#",
            },
            {
              image:
                "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "A modern brand identity for a 40-year-old logistics company",
              categories: "INDUSTRIAL / REBRAND",
              url: "#",
            },
            {
              image:
                "https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Cutting onboarding time in half for a healthcare SaaS",
              categories: "HEALTHCARE / PRODUCT",
              url: "#",
            },
          ],
          backgroundStyle: "light-gray",
        },
      },
      {
        id: blockId("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "Atelier is the rare studio that thinks like operators. They didn't just hand us a brand book — they helped us land a positioning that we still use in every board deck.",
          author: "Priya Shah",
          role: "Co-Founder & CEO",
          practiceName: "Pendulum",
        },
      },
      {
        id: blockId("form", 7),
        type: "form",
        props: {
          headline: "Tell us about your project",
          subheadline:
            "We respond to every inquiry within two business days. No discovery deck required.",
          multiStep: false,
          steps: [
            {
              title: "Your project",
              fields: [
                {
                  id: "name",
                  type: "text",
                  label: "Your name",
                  placeholder: "Jane Smith",
                  required: true,
                },
                {
                  id: "email",
                  type: "email",
                  label: "Email",
                  placeholder: "you@company.com",
                  required: true,
                },
                {
                  id: "company",
                  type: "text",
                  label: "Company",
                  placeholder: "Acme Inc.",
                  required: true,
                },
                {
                  id: "budget",
                  type: "text",
                  label: "Approximate budget",
                  placeholder: "$50k – $150k",
                  required: false,
                },
                {
                  id: "message",
                  type: "textarea",
                  label: "What are you working on?",
                  placeholder: "A few sentences is plenty.",
                  required: true,
                },
              ],
            },
          ],
          submitButtonText: "Send inquiry",
          submitButtonColor: ACCENT_BLUE,
          successMessage: "Got it. We'll be in touch within two business days.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      genericFooter("Atelier", 8),
    ],
  },

  // 6. Local Business
  {
    slug: "global-local-business",
    title: "Local Business",
    templateLabel: "Local Business",
    templateDescription:
      "A welcoming hero, what-makes-us-different grid, photo gallery, and a contact form. Perfect starting point for restaurants, salons, and shops.",
    ogImage:
      "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: blockId("hero", 1),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Wood-fired pizza, made the way it's supposed to be",
          subheadline:
            "Family-owned since 2008. 72-hour fermented dough, San Marzano tomatoes, and a 900° oven. Open seven nights a week in the Mission.",
          ctaText: "Reserve a table",
          ctaUrl: "#reserve",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "muted",
          showSocialProof: true,
          socialProofText: "★★★★★  4.8 average across 2,400+ Google reviews",
          imageUrl:
            "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 2),
        type: "trust-bar",
        props: {
          items: [
            { value: "Since 2008", label: "Family Owned" },
            { value: "★ 4.8", label: "Google Reviews" },
            { value: "7 Nights", label: "Open a Week" },
            { value: "$$", label: "Mission District" },
          ],
        },
      },
      {
        id: blockId("benefits-grid", 3),
        type: "benefits-grid",
        props: {
          headline: "What makes us different",
          columns: 3,
          items: [
            {
              icon: "Zap",
              title: "900° wood-fired oven",
              description:
                "Imported from Naples and seasoned for two years before we ever cooked in it. Every pizza in 90 seconds.",
            },
            {
              icon: "Star",
              title: "72-hour fermented dough",
              description:
                "Made fresh every morning with a starter we've kept alive since the day we opened.",
            },
            {
              icon: "Package",
              title: "Local, seasonal toppings",
              description:
                "Our menu changes with the farmers market. Whatever's on tonight is the best version of itself.",
            },
            {
              icon: "BookOpen",
              title: "Curated wine list",
              description:
                "30 bottles, all under $80, all selected to pair with our menu. Every glass under $14.",
            },
            {
              icon: "Users",
              title: "Family-owned",
              description:
                "We've been in the same spot for 17 years. The same family answers the phone today as on opening night.",
            },
            {
              icon: "CheckCircle",
              title: "Walk-ins welcome",
              description:
                "Reservations strongly recommended on weekends, but we save half the bar for walk-ins every night.",
            },
          ],
        },
      },
      {
        id: blockId("photo-strip", 4),
        type: "photo-strip",
        props: {
          images: [
            {
              src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=900&fit=crop",
              alt: "Margherita pizza fresh from the oven",
            },
            {
              src: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=900&fit=crop",
              alt: "Pizza on a wooden board",
            },
            {
              src: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=900&fit=crop",
              alt: "Hand-tossing dough",
            },
            {
              src: "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?q=80&w=900&fit=crop",
              alt: "Restaurant interior",
            },
            {
              src: "https://images.unsplash.com/photo-1542367592-8849eb950fd8?q=80&w=900&fit=crop",
              alt: "Wine and antipasti",
            },
          ],
        },
      },
      {
        id: blockId("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "Best pizza in the city. I take every visiting friend here, and not one has been disappointed. Get the Margherita and the burrata, trust me.",
          author: "Tom Reilly",
          role: "Mission resident, regular since 2012",
          practiceName: "",
        },
      },
      {
        id: blockId("form", 6),
        type: "form",
        props: {
          headline: "Reserve a table",
          subheadline:
            "Or call us at (415) 555-0140. We confirm reservations within an hour.",
          multiStep: false,
          steps: [
            {
              title: "Reservation",
              fields: [
                {
                  id: "name",
                  type: "text",
                  label: "Your name",
                  placeholder: "Jane Smith",
                  required: true,
                },
                {
                  id: "phone",
                  type: "phone",
                  label: "Phone",
                  placeholder: "(555) 555-0140",
                  required: true,
                },
                {
                  id: "email",
                  type: "email",
                  label: "Email",
                  placeholder: "you@email.com",
                  required: true,
                },
                {
                  id: "party",
                  type: "text",
                  label: "Party size",
                  placeholder: "4",
                  required: true,
                },
                {
                  id: "notes",
                  type: "textarea",
                  label: "Any special requests?",
                  placeholder: "Anniversary dinner, allergies, high chair, etc.",
                  required: false,
                },
              ],
            },
          ],
          submitButtonText: "Request reservation",
          submitButtonColor: ACCENT_BLUE,
          successMessage:
            "Thanks! We'll confirm your reservation within an hour during business hours.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      genericFooter("Forno", 7),
    ],
  },

  // 7. Newsletter / Community Signup
  {
    slug: "global-newsletter-signup",
    title: "Newsletter Signup",
    templateLabel: "Newsletter Signup",
    templateDescription:
      "Editorial hero, social proof, a few featured issues, and a streamlined signup form. For writers, creators, and indie publications.",
    ogImage:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: blockId("hero", 1),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "A weekly read for people building things on the internet",
          subheadline:
            "One essay every Sunday, written by the founders, designers, and engineers actually doing the work. No ads, no sponsors, no recycled hot takes.",
          ctaText: "Subscribe free",
          ctaUrl: "#form",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Join 38,000+ readers from Stripe, Vercel, Linear, Notion, and beyond",
          imageUrl:
            "https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 2),
        type: "trust-bar",
        props: {
          items: [
            { value: "38,000+", label: "Subscribers" },
            { value: "Weekly", label: "Every Sunday" },
            { value: "Free", label: "Always" },
            { value: "0", label: "Sponsored Posts" },
          ],
        },
      },
      {
        id: blockId("stat-callout", 3),
        type: "stat-callout",
        props: {
          stat: "67%",
          description: "Open rate — among the highest of any tech newsletter",
          footnote:
            "Industry average is 21%. We attribute the difference to ruthlessly editing every issue.",
        },
      },
      {
        id: blockId("testimonial", 4),
        type: "testimonial",
        props: {
          quote:
            "The only newsletter I read every single week. It's the rare publication that respects your time and assumes you're smart.",
          author: "Anya Schmidt",
          role: "Founder",
          practiceName: "Slipstream",
        },
      },
      {
        id: blockId("form", 5),
        type: "form",
        props: {
          headline: "Get the next issue in your inbox",
          subheadline: "One email a week. Unsubscribe with one click. Always free.",
          multiStep: false,
          steps: [
            {
              title: "Subscribe",
              fields: [
                {
                  id: "email",
                  type: "email",
                  label: "Email address",
                  placeholder: "you@email.com",
                  required: true,
                },
              ],
            },
          ],
          submitButtonText: "Subscribe",
          submitButtonColor: ACCENT_BLUE,
          successMessage: "Welcome aboard. The next issue lands in your inbox on Sunday.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "minimal",
          labelStyle: "default",
          formMode: "native",
        },
      },
      genericFooter("The Sunday Read", 6),
    ],
  },

  // 8. Social Proof Heavy
  {
    slug: "global-social-proof",
    title: "Social Proof Heavy",
    templateLabel: "Social Proof Heavy",
    templateDescription:
      "Testimonial-led hero, trust bar, customer photo strip, big stat, case studies, and a closing CTA. For brands with results to flex.",
    ogImage:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Vantage", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline:
            '"We replaced four tools and saved $80k in the first quarter."',
          subheadline:
            "Vantage is the operations platform 4,000+ teams use to run faster, cheaper, and with fewer meetings. See why they switched.",
          ctaText: "Read customer stories",
          ctaUrl: "#stories",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "★★★★★  4.9 on G2 — #1 in Operations Platforms, 2026",
          imageUrl:
            "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "4,000+", label: "Customer Teams" },
            { value: "★ 4.9", label: "G2 Rating" },
            { value: "98%", label: "Renewal Rate" },
            { value: "$80k", label: "Avg. Saved Year One" },
          ],
        },
      },
      {
        id: blockId("testimonial", 4),
        type: "testimonial",
        props: {
          quote:
            "We replaced four separate tools with Vantage in six weeks. Saved $80k in year one and got our Wednesday afternoons back. I cannot recommend it more highly.",
          author: "Maya Patel",
          role: "VP Operations",
          practiceName: "Aperture Logistics",
        },
      },
      {
        id: blockId("photo-strip", 5),
        type: "photo-strip",
        props: {
          images: [
            {
              src: "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?q=80&w=900&fit=crop",
              alt: "Customer team",
            },
            {
              src: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=900&fit=crop",
              alt: "Office workspace",
            },
            {
              src: "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=900&fit=crop",
              alt: "Team meeting",
            },
            {
              src: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=900&fit=crop",
              alt: "Collaborative work",
            },
            {
              src: "https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=900&fit=crop",
              alt: "Modern office",
            },
          ],
        },
      },
      {
        id: blockId("stat-callout", 6),
        type: "stat-callout",
        props: {
          stat: "98%",
          description: "Of customers renew at the end of year one",
          footnote: "Across 4,000+ paying teams. Industry average is 73%.",
        },
      },
      {
        id: blockId("case-studies", 7),
        type: "case-studies",
        props: {
          headline: "How customers actually use Vantage",
          subheadline: "Three quick reads from teams in different industries.",
          items: [
            {
              image:
                "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "How a 30-person fintech cut their close cycle from 12 days to 3",
              categories: "FINTECH / SERIES B",
              url: "#",
            },
            {
              image:
                "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "A logistics firm replaced six tools and saved 200 hours a month",
              categories: "LOGISTICS / MID-SIZE",
              url: "#",
            },
            {
              image:
                "https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Healthcare SaaS used Vantage to scale ops to 10× more customers",
              categories: "HEALTHCARE / SCALE",
              url: "#",
            },
          ],
          backgroundStyle: "light-gray",
        },
      },
      {
        id: blockId("bottom-cta", 8),
        type: "bottom-cta",
        props: {
          headline: "See what Vantage could do for your team",
          subheadline:
            "Free for 14 days. No credit card required. Most teams see results in week two.",
          ctaText: "Start free trial",
          ctaUrl: "#",
        },
      },
      genericFooter("Vantage", 9),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Atelier Studio — Premium Brand Hero (mirrors the "Video Hero" /
  //    Crowns flagship layout: hero → trust-bar → photo-strip → stat-callout
  //    → benefits-grid → product-grid → testimonial → bottom-cta)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-premium-brand-hero",
    title: "Premium Brand Hero",
    templateLabel: "Premium Brand Hero",
    templateDescription:
      "Editorial, gallery-led layout for premium brands. Big hero, social-proof bar, scrolling photo strip, hero stat, six-up benefits, product grid, and a closing testimonial.",
    ogImage:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Atelier", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Crafted with care. Delivered with confidence.",
          subheadline:
            "Atelier is a small studio with an outsized obsession for detail. We design and ship work the world's most discerning brands trust in front of their best customers.",
          ctaText: "Start a project",
          ctaUrl: "#cta",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Featured work for global brands across 14 countries",
          imageUrl:
            "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "120+", label: "Brands Shipped" },
            { value: "4.9★", label: "Client Satisfaction" },
            { value: "14", label: "Countries Served" },
            { value: "10 yrs", label: "In Practice" },
          ],
        },
      },
      {
        id: blockId("photo-strip", 4),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1493612276216-ee3925520721?q=80&w=600&fit=crop", alt: "Editorial brand identity" },
            { src: "https://images.unsplash.com/photo-1481487196290-c152efe083f5?q=80&w=600&fit=crop", alt: "Print collateral" },
            { src: "https://images.unsplash.com/photo-1542744095-291d1f67b221?q=80&w=600&fit=crop", alt: "Studio workspace" },
            { src: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=600&fit=crop", alt: "Design in progress" },
            { src: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?q=80&w=600&fit=crop", alt: "Color study" },
            { src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600&fit=crop", alt: "Product photography" },
            { src: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?q=80&w=600&fit=crop", alt: "Brand portrait" },
          ],
        },
      },
      {
        id: blockId("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "98%",
          description: "of Atelier clients rebook us for their next launch",
          footnote: "Across the last three years of engagements — measured by signed renewals.",
        },
      },
      {
        id: blockId("benefits-grid", 6),
        type: "benefits-grid",
        props: {
          headline: "Why teams keep coming back",
          columns: 3,
          items: [
            { icon: "Sparkles", title: "Editorial-grade craft", description: "Every line, type weight, and pixel is considered. Work that holds up next to the best in the world." },
            { icon: "Clock", title: "Honest timelines", description: "We commit to dates and we hit them. No surprise scope creep, no quiet weekends to recover lost ground." },
            { icon: "Users", title: "A senior team, every meeting", description: "You work with the people doing the work — never a junior handoff after the kickoff call." },
            { icon: "Layers", title: "Systems, not one-offs", description: "Identity, web, and product designed as a coherent system that scales as your team grows." },
            { icon: "ShieldCheck", title: "Confident delivery", description: "Production files, brand guidelines, and developer-ready specs handed off in formats your team actually uses." },
            { icon: "MessageCircle", title: "A real partnership", description: "Direct Slack channels, weekly demos, and honest feedback from people invested in your success." },
          ],
        },
      },
      {
        id: blockId("product-grid", 7),
        type: "product-grid",
        props: {
          headline: "What we make",
          subheadline: "Three practices, woven into one studio. Engaged together or à la carte.",
          items: [
            { image: "https://images.unsplash.com/photo-1561070791-2526d30994b8?q=80&w=600&h=400&fit=crop", title: "Brand identity", description: "Naming, logo systems, type, color, and the foundational story — built to outlast a quarterly refresh." },
            { image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?q=80&w=600&h=400&fit=crop", title: "Marketing site", description: "Editorial, conversion-focused websites with the polish of a magazine and the metrics of a growth team." },
            { image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?q=80&w=600&h=400&fit=crop", title: "Product design", description: "Native, web, and embedded experiences designed alongside your engineers — shipped, not just specced." },
            { image: "https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&h=400&fit=crop", title: "Campaigns", description: "Launch films, social systems, and OOH that turn a moment into a movement." },
            { image: "https://images.unsplash.com/photo-1483058712412-4245e9b90334?q=80&w=600&h=400&fit=crop", title: "Editorial & content", description: "Magazines, reports, and long-form pieces with the typographic care most teams reserve for their logo." },
            { image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=600&h=400&fit=crop", title: "Workshops & strategy", description: "Two-day intensives that align leadership on positioning, messaging, and what to do on Monday morning." },
          ],
        },
      },
      {
        id: blockId("testimonial", 8),
        type: "testimonial",
        props: {
          quote:
            "Atelier shipped the most polished work our company has ever put into the world. They held the bar when we were ready to lower it — and the launch was the best in our history.",
          author: "Camille Okafor",
          role: "Chief Marketing Officer",
          practiceName: "Northwind & Co.",
        },
      },
      {
        id: blockId("bottom-cta", 9),
        type: "bottom-cta",
        props: {
          headline: "Have something worth doing properly?",
          subheadline: "We take on a small number of projects each quarter. Tell us about yours.",
          ctaText: "Start a project",
          ctaUrl: "#",
        },
      },
      genericFooter("Atelier", 10),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Forge — Old Way vs New Way Pitch (mirrors the "Problem First" /
  //     Crowns layout: hero → comparison → stat-callout → trust-bar →
  //     benefits-grid → testimonial → bottom-cta)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-old-way-new-way",
    title: "Old Way vs New Way Pitch",
    templateLabel: "Old Way vs New Way Pitch",
    templateDescription:
      "Side-by-side comparison framework. Hero, a punchy old-way / new-way grid, headline stat, trust bar, benefits, customer quote, and CTA. Best for category-creating products.",
    ogImage:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Forge", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Stop running your business on duct tape and goodwill.",
          subheadline:
            "Forge replaces the spreadsheets, email threads, and one-off tools your operations team has been quietly holding together — with a single platform that finally fits how you actually work.",
          ctaText: "See the difference",
          ctaUrl: "#comparison",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by ops teams at 800+ growing companies",
          imageUrl:
            "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("comparison", 3),
        type: "comparison",
        props: {
          headline: "A different way to run operations.",
          ctaText: "Start free trial",
          ctaUrl: "#",
          oldWayLabel: "The Old Way",
          oldWayBullets: [
            "A dozen tools that don't talk to each other",
            "Reports rebuilt by hand every Monday morning",
            "Approvals lost in email threads for days",
            "No shared source of truth across teams",
            "Quarterly audits that take three weeks of nights",
            "Custom integrations that break every release",
          ],
          newWayLabel: "Forge",
          newWayBullets: [
            "One workspace for every operational workflow",
            "Live dashboards that update themselves",
            "Approvals routed in seconds with a full audit trail",
            "A single source of truth, shared by every team",
            "Audit-ready reports generated in one click",
            "200+ pre-built integrations maintained for you",
          ],
        },
      },
      {
        id: blockId("stat-callout", 4),
        type: "stat-callout",
        props: {
          stat: "11x",
          description: "faster monthly close for teams in their first 90 days on Forge",
          footnote: "Median across 240 customers who switched from a patchwork of tools in 2025.",
        },
      },
      {
        id: blockId("trust-bar", 5),
        type: "trust-bar",
        props: {
          items: [
            { value: "800+", label: "Operating Teams" },
            { value: "$28B", label: "Processed Annually" },
            { value: "SOC 2", label: "Type II Certified" },
            { value: "99.99%", label: "Uptime SLA" },
          ],
        },
      },
      {
        id: blockId("benefits-grid", 6),
        type: "benefits-grid",
        props: {
          headline: "Built for how operations teams actually work",
          columns: 3,
          items: [
            { icon: "Workflow", title: "Workflows you can change yourself", description: "Drag-and-drop logic, no engineering tickets. Your ops team owns the system instead of waiting on it." },
            { icon: "BarChart3", title: "Reporting that's never stale", description: "Live, drillable dashboards with real metrics — not screenshots pasted into a slide deck the night before." },
            { icon: "ShieldCheck", title: "Audit-ready by default", description: "Every change is logged, attributed, and exportable. Pass SOC, HIPAA, and finance audits without scrambling." },
            { icon: "Plug", title: "200+ integrations, maintained", description: "Connect to your stack in clicks — and stop maintaining brittle scripts on top of vendor APIs that change weekly." },
            { icon: "Lock", title: "Permissions you can trust", description: "Granular roles, SSO, and SCIM provisioning out of the box. Built for the way enterprise security teams actually work." },
            { icon: "Clock", title: "10-minute setup", description: "Sign up, import your data, and have a real workflow running before lunch. No 6-week implementations." },
          ],
        },
      },
      {
        id: blockId("testimonial", 7),
        type: "testimonial",
        props: {
          quote:
            "We replaced six tools, two contractors, and a weekly meeting that nobody enjoyed. Our month-end close went from 11 days to under 2, and the team finally has time to do real strategy work.",
          author: "Diego Marín",
          role: "Director of Operations",
          practiceName: "Quanta Logistics, Inc.",
        },
      },
      {
        id: blockId("bottom-cta", 8),
        type: "bottom-cta",
        props: {
          headline: "Ready to leave the patchwork behind?",
          subheadline: "Free for 14 days. White-glove migration included on every annual plan.",
          ctaText: "Start free trial",
          ctaUrl: "#",
        },
      },
      genericFooter("Forge", 9),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Lighthouse — Trusted Partner (mirrors the "How It Works" / Crowns
  //     layout: hero → how-it-works → trust-bar → product-grid →
  //     benefits-grid → testimonial → bottom-cta)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-trusted-partner",
    title: "Trusted Partner — How It Works",
    templateLabel: "Trusted Partner — How It Works",
    templateDescription:
      "Calm, confidence-building layout for high-consideration services. Hero, three-step process, social proof, service grid, benefits, and a real customer story. Great for finance, legal, and consulting.",
    ogImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Lighthouse", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "A steadier way through complex decisions.",
          subheadline:
            "Lighthouse is the partner founders, finance leaders, and family offices call when the stakes are high and the answer needs to be right. Quiet, careful work — done together.",
          ctaText: "Schedule a consultation",
          ctaUrl: "#cta",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Advising 200+ companies and families across three continents",
          imageUrl:
            "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "How we work together",
          steps: [
            { number: "01", title: "Listen", description: "We start with a no-obligation conversation. Tell us what's keeping you up. We'll tell you honestly whether we're the right partner — and if we're not, we'll point you to who is." },
            { number: "02", title: "Diagnose", description: "A two-week deep dive: data, interviews, and a clear written assessment. You'll walk away with a sharper picture of the situation, even if you choose to stop there." },
            { number: "03", title: "Execute, together", description: "If we move forward, you get a senior team embedded in your decisions. Weekly check-ins, transparent fees, and an exit plan from day one." },
          ],
        },
      },
      {
        id: blockId("trust-bar", 4),
        type: "trust-bar",
        props: {
          items: [
            { value: "200+", label: "Active Engagements" },
            { value: "$4.2B", label: "Advised in 2025" },
            { value: "26 yrs", label: "Median Partner Experience" },
            { value: "Direct", label: "Senior Access, Always" },
          ],
        },
      },
      {
        id: blockId("product-grid", 5),
        type: "product-grid",
        props: {
          headline: "Where we help",
          subheadline: "Five practices, one team. Engaged à la carte or in combination.",
          items: [
            { image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=600&h=400&fit=crop", title: "Strategic finance", description: "Forecasting, scenario planning, and capital strategy for teams between Series B and IPO." },
            { image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=600&h=400&fit=crop", title: "Operating partner support", description: "An embedded operator on your leadership team for 90, 180, or 365 days — no full-time hire required." },
            { image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=600&h=400&fit=crop", title: "Board & governance advisory", description: "Independent perspective for founders, audit committees, and family principals navigating sensitive decisions." },
            { image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=600&h=400&fit=crop", title: "M&A & succession", description: "Sell-side preparation, succession planning, and post-close integration handled with the discretion the work demands." },
            { image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=600&h=400&fit=crop", title: "Crisis & turnaround", description: "When the path forward isn't obvious, we sit beside your leadership team and help you find it — quickly and without drama." },
            { image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=600&h=400&fit=crop", title: "Family enterprise", description: "Multi-generational planning, governance design, and the quiet conversations that protect both the family and the business." },
          ],
        },
      },
      {
        id: blockId("benefits-grid", 6),
        type: "benefits-grid",
        props: {
          headline: "What it's like to work with us",
          columns: 3,
          items: [
            { icon: "Users", title: "Senior, every meeting", description: "Our partners do the work. You'll never be passed to a junior analyst after the kickoff call." },
            { icon: "Lock", title: "Discretion, always", description: "We work under NDA by default and decline engagements that conflict with our existing clients. Your information stays inside the room." },
            { icon: "ScrollText", title: "Transparent fees", description: "Flat retainers and clear scopes. No surprise invoices, no nickel-and-diming for emails or weekend calls." },
            { icon: "Compass", title: "Independent counsel", description: "We don't sell products and we don't take referral fees. Our only incentive is the quality of our advice." },
            { icon: "Clock", title: "Built-in exit", description: "Every engagement has a defined end. We measure success by your independence — not by how long we stay." },
            { icon: "MessageCircle", title: "Direct access", description: "Your partner's mobile, weekly working sessions, and async updates between. No client portal required." },
          ],
        },
      },
      {
        id: blockId("testimonial", 7),
        type: "testimonial",
        props: {
          quote:
            "Lighthouse helped us through the hardest year in our company's history with a steadiness I haven't found anywhere else. They told us what we needed to hear, not what was easy — and the business is here today because of it.",
          author: "Aarav Joshi",
          role: "Chief Executive Officer",
          practiceName: "Helia Industries",
        },
      },
      {
        id: blockId("bottom-cta", 8),
        type: "bottom-cta",
        props: {
          headline: "Have something worth talking through?",
          subheadline: "First conversations are confidential and free. We'll tell you honestly whether we can help.",
          ctaText: "Schedule a consultation",
          ctaUrl: "#",
        },
      },
      genericFooter("Lighthouse", 9),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Halo Insights — Data Visibility Platform (visibility-inspired:
  //     tight hero → trust-bar → "by the numbers" stat → product-grid of
  //     dashboards → benefits → testimonial → bottom-cta)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-data-platform",
    title: "Data Visibility Platform",
    templateLabel: "Data Visibility Platform",
    templateDescription:
      "Editorial layout for analytics, observability, and BI products. Tight hero, by-the-numbers stat strip, dashboard product grid, benefits, customer quote, and CTA.",
    ogImage:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Halo Insights", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Finally see what's actually happening across your business.",
          subheadline:
            "Halo unifies the metrics buried in your warehouse, your CRM, and your billing system into one live picture every team can act on. No more screenshots in Slack.",
          ctaText: "See a live demo",
          ctaUrl: "#cta",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by data teams at 1,200+ growing companies",
          imageUrl:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "1,200+", label: "Companies" },
            { value: "240B", label: "Events Indexed Daily" },
            { value: "<2s", label: "Median Query Time" },
            { value: "SOC 2", label: "Type II Certified" },
          ],
        },
      },
      {
        id: blockId("stat-callout", 4),
        type: "stat-callout",
        props: {
          stat: "By the numbers",
          description: "Teams switching to Halo cut weekly reporting time by an average of 14 hours and answer 3× more ad-hoc questions in the first quarter.",
          footnote: "Median across 380 customers surveyed in their first 90 days, 2025.",
        },
      },
      {
        id: blockId("product-grid", 5),
        type: "product-grid",
        props: {
          headline: "One platform. Every view your team needs.",
          subheadline: "Pre-built for the metrics modern operating teams actually live in — and fully customizable for the ones you'll invent next.",
          items: [
            { image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop", title: "Revenue intelligence", description: "Pipeline, win-rate, and cohort views that update in real time as deals move through your CRM." },
            { image: "https://images.unsplash.com/photo-1543286386-713bdd548da4?q=80&w=600&h=400&fit=crop", title: "Product analytics", description: "Funnels, retention, and feature adoption — without the eight-week instrumentation project." },
            { image: "https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=600&h=400&fit=crop", title: "Operations dashboards", description: "SLAs, throughput, and queue health for every team that runs on tickets, calls, or shifts." },
            { image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=600&h=400&fit=crop", title: "Financial close", description: "Live P&L, burn, and runway pulled straight from your ledger — never a quarter behind again." },
            { image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600&h=400&fit=crop", title: "Executive briefings", description: "Auto-generated weekly snapshots delivered to Slack, email, or your boardroom on the morning you need them." },
            { image: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?q=80&w=600&h=400&fit=crop", title: "Custom workspaces", description: "Build any view with drag-and-drop. Save it, share it, and let your team riff on it without breaking the source." },
          ],
        },
      },
      {
        id: blockId("benefits-grid", 6),
        type: "benefits-grid",
        props: {
          headline: "Why teams pick Halo over the legacy stack",
          columns: 3,
          items: [
            { icon: "Zap", title: "Live, not lagged", description: "Streaming refresh on every chart. No more dashboards that explain what was true 36 hours ago." },
            { icon: "Layers", title: "Connect everything", description: "200+ native sources — warehouses, SaaS apps, files, APIs — wired up in minutes by anyone, no SQL required." },
            { icon: "ShieldCheck", title: "Trust by default", description: "Row-level permissions, full audit trail, and a single semantic layer so two charts never disagree on the same number." },
            { icon: "Sparkles", title: "AI that actually helps", description: "Ask a question in plain English and get back the chart, the SQL, and the citation. Edit either if you don't trust it yet." },
            { icon: "Workflow", title: "Embed anywhere", description: "Drop any Halo view into your product, your CRM, or your wiki — with the same permissions visitors already have." },
            { icon: "Users", title: "Built for the whole team", description: "Analysts get the depth they need. Operators get the buttons they want. Executives get the picture they trust." },
          ],
        },
      },
      {
        id: blockId("testimonial", 7),
        type: "testimonial",
        props: {
          quote:
            "We replaced three BI tools and a quarterly snapshot deck nobody read. Now leadership opens Halo before standup — and the conversations have changed completely.",
          author: "Renata Suzuki",
          role: "VP Data & Analytics",
          practiceName: "Northpath Logistics",
        },
      },
      {
        id: blockId("bottom-cta", 8),
        type: "bottom-cta",
        props: {
          headline: "Stop guessing. Start seeing.",
          subheadline: "30-minute walkthrough on your own data. No slideware, no procurement. Just a working environment by the end of the call.",
          ctaText: "See a live demo",
          ctaUrl: "#",
        },
      },
      genericFooter("Halo Insights", 9),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Aperture — Modern Product Launch (sizzle-inspired: full-bleed
  //     hero → photo-strip → benefits → comparison → stat → CTA)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-modern-launch",
    title: "Modern Product Launch",
    templateLabel: "Modern Product Launch",
    templateDescription:
      "Cinematic launch page for new products. Full-bleed hero, scrolling photo strip, benefits row, side-by-side comparison, headline stat, and a single decisive CTA.",
    ogImage:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Aperture", 1),
      {
        id: blockId("full-bleed-hero", 2),
        type: "full-bleed-hero",
        props: {
          headlineSize: "lg",
          headline: "A camera that thinks the way photographers do.",
          subheadline:
            "Three years in the lab. One sensor that finally reads light the way your eye does. Pre-orders open today — first 5,000 ship before the holidays.",
          ctaText: "Reserve yours — $1,499",
          ctaUrl: "#cta",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1920&h=1080&fit=crop",
          overlayOpacity: 45,
        },
      },
      {
        id: blockId("photo-strip", 3),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?q=80&w=600&fit=crop", alt: "Camera body close-up" },
            { src: "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?q=80&w=600&fit=crop", alt: "Sensor detail" },
            { src: "https://images.unsplash.com/photo-1500051638674-ff996a0ec29e?q=80&w=600&fit=crop", alt: "Field photography" },
            { src: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=600&fit=crop", alt: "Studio shot" },
            { src: "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?q=80&w=600&fit=crop", alt: "Behind the scenes" },
            { src: "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?q=80&w=600&fit=crop", alt: "Lifestyle shot" },
            { src: "https://images.unsplash.com/photo-1452457436173-5cf72d65d6f3?q=80&w=600&fit=crop", alt: "Architecture frame" },
          ],
        },
      },
      {
        id: blockId("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "Designed for the moments you don't get a second take at.",
          columns: 3,
          items: [
            { icon: "Camera", title: "47 megapixels, full frame", description: "A sensor built around dynamic range, not just headline numbers. The shadows hold detail. The highlights don't blow out." },
            { icon: "Zap", title: "Instant on", description: "From shoulder strap to first frame in under 200ms. The shot you almost missed is the one you actually take." },
            { icon: "Eye", title: "Subject-aware autofocus", description: "On-chip neural focus tracks eyes, animals, and vehicles across the frame at 30 fps without breaking a sweat." },
            { icon: "Battery", title: "All-day stamina", description: "1,800 shots per charge. Two USB-C ports so you can shoot tethered while you keep filling up." },
            { icon: "Move", title: "In-body stabilization", description: "Eight stops. Hand-holdable at one second. The tripod stays in the bag more often than you'd think." },
            { icon: "Sliders", title: "Color you'll trust", description: "A color science built with cinematographers, not committees. The skin tones come out of the box looking right." },
          ],
        },
      },
      {
        id: blockId("comparison", 5),
        type: "comparison",
        props: {
          headline: "What changes when the camera works with you.",
          ctaText: "Reserve yours",
          ctaUrl: "#",
          oldWayLabel: "The Old Way",
          oldWayBullets: [
            "Menus that take 14 taps to change one setting",
            "Autofocus that hunts, especially indoors",
            "Battery that taps out before lunch",
            "RAW files that need an hour of color work",
            "Firmware that ages out within a single body",
          ],
          newWayLabel: "Aperture",
          newWayBullets: [
            "Customizable shortcuts on every dial and button",
            "Subject-aware focus that locks before you do",
            "1,800 frames per charge — and a hot-swap door",
            "Color profiles that ship-ready straight out of camera",
            "Quarterly firmware updates for the life of the body",
          ],
        },
      },
      {
        id: blockId("stat-callout", 6),
        type: "stat-callout",
        props: {
          stat: "5,000",
          description: "first-edition bodies hand-numbered and shipping before the holidays",
          footnote: "Reservations open globally today. Production scales to standard supply in Q2.",
        },
      },
      {
        id: blockId("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "The first 5,000 ship before the holidays.",
          subheadline: "Reserve with $99. Charged in full only when your body ships. Cancel any time before then.",
          ctaText: "Reserve yours — $1,499",
          ctaUrl: "#",
        },
      },
      genericFooter("Aperture", 8),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 14. Loomwell — Quality Operating System (lab-inspired: hero →
  //     how-it-works → comparison → product-grid → testimonial → CTA)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-quality-os",
    title: "Quality Operating System",
    templateLabel: "Quality Operating System",
    templateDescription:
      "Sophisticated layout for AI, quality, and platform products. Hero, three-step how-it-works, old-way / new-way comparison, capability grid, customer quote, and CTA.",
    ogImage:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Loomwell", 1),
      {
        id: blockId("hero", 2),
        type: "hero",
        props: {
          headlineSize: "lg",
          headline: "Ship the quality bar your customers expect — without slowing the team down.",
          subheadline:
            "Loomwell is the quality OS modern engineering teams run on. Eval suites, regression checks, and human review woven through your delivery pipeline so nothing ships that shouldn't.",
          ctaText: "Book a working session",
          ctaUrl: "#cta",
          ctaColor: ACCENT_BLUE,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Powering quality at 600+ engineering teams",
          imageUrl:
            "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      {
        id: blockId("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "Quality, woven through every release",
          steps: [
            { number: "01", title: "Define what good looks like", description: "Capture the rubric your team already argues about — accuracy, tone, latency, safety — into versioned eval suites you can actually run." },
            { number: "02", title: "Run it on every change", description: "Loomwell wires into your CI and your model gateway. Every PR, every deploy, every prompt change is graded automatically before it merges." },
            { number: "03", title: "Close the loop with humans", description: "Edge cases route to the right reviewer with full context. Their decisions feed back into the suite, so the bar gets sharper every week." },
          ],
        },
      },
      {
        id: blockId("comparison", 4),
        type: "comparison",
        props: {
          headline: "A different relationship with quality.",
          ctaText: "Book a working session",
          ctaUrl: "#",
          oldWayLabel: "The Old Way",
          oldWayBullets: [
            "Spot-checks in a Google Sheet nobody trusts",
            "Regressions discovered by customers, not engineers",
            "Eval scripts that rot a week after the launch",
            "Reviewers staring at JSON in a side window",
            "No way to prove the model actually got better",
          ],
          newWayLabel: "Loomwell",
          newWayBullets: [
            "Versioned eval suites tied to every prompt and model",
            "Regressions caught in CI before the PR merges",
            "Suites maintained by the platform, not your interns",
            "Reviewers see the prompt, the response, and the diff",
            "Every release ships with a quality report you can show the board",
          ],
        },
      },
      {
        id: blockId("product-grid", 5),
        type: "product-grid",
        props: {
          headline: "Everything you'd build yourself, finally in one place.",
          subheadline: "Open standards, your data stays yours, and a clean exit any time. Built by people who've shipped this stuff at scale.",
          items: [
            { image: "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=600&h=400&fit=crop", title: "Eval suites", description: "Versioned, sharable, and runnable from your laptop or your CI. Mix human, model-graded, and rule-based scorers in one harness." },
            { image: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&h=400&fit=crop", title: "Regression guard", description: "Block any PR that drops a tracked metric. Wire it up in 10 minutes — every major CI provider supported out of the box." },
            { image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=600&h=400&fit=crop", title: "Trace explorer", description: "Search, filter, and replay every production trace. Click any span to see the prompt, the response, the timing, and the cost." },
            { image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&h=400&fit=crop", title: "Human review queues", description: "Route the cases your evals are uncertain about to the right person, with the right context, and an SLA you actually hit." },
            { image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&h=400&fit=crop", title: "Prompt registry", description: "Source-controlled prompts with diffs, A/B routing, and one-click rollback. Stop pasting them from Notion at 11pm on a Friday." },
            { image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=600&h=400&fit=crop", title: "Quality reports", description: "Auto-generated release notes that answer the only question that matters: is this version actually better than the last one?" },
          ],
        },
      },
      {
        id: blockId("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "Loomwell turned quality from a quarterly fire drill into a habit. Our regression rate dropped 70% in the first month, and our launch reviews went from two-hour debates to a five-minute readout.",
          author: "Priya Vasanth",
          role: "Head of Engineering",
          practiceName: "Cardinal AI",
        },
      },
      {
        id: blockId("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Make quality a system, not a hope.",
          subheadline: "Working session with one of our engineers. We'll wire Loomwell into one repo and leave you with a working setup before the call ends.",
          ctaText: "Book a working session",
          ctaUrl: "#",
        },
      },
      genericFooter("Loomwell", 8),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 15. Pasture & Stone — Craft Consumer Experience (ice-cream-inspired:
  //     full-bleed photo hero → trust-bar → photo-strip → stat → benefits
  //     → testimonial → bottom-cta)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "global-craft-experience",
    title: "Craft Consumer Experience",
    templateLabel: "Craft Consumer Experience",
    templateDescription:
      "Warm, photo-led layout for craft consumer brands — food, beauty, hospitality, retail. Full-bleed hero, social proof bar, scrolling gallery, hero stat, story benefits, customer quote, and CTA.",
    ogImage:
      "https://images.unsplash.com/photo-1488900128323-21503983a07e?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      genericNav("Pasture & Stone", 1),
      {
        id: blockId("full-bleed-hero", 2),
        type: "full-bleed-hero",
        props: {
          headlineSize: "lg",
          headline: "Ice cream, made the way it used to be.",
          subheadline:
            "Hand-churned in small batches with milk from a single farm two valleys over. Twelve flavors, rotated weekly, served in two shops and a roaming cart you'll find by following your nose.",
          ctaText: "Find this week's flavors",
          ctaUrl: "#cta",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1488900128323-21503983a07e?q=80&w=1920&h=1080&fit=crop",
          overlayOpacity: 40,
        },
      },
      {
        id: blockId("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "Est. 2014", label: "Family Owned" },
            { value: "1 Farm", label: "Single Source Dairy" },
            { value: "12", label: "Flavors Weekly" },
            { value: "★★★★★", label: "Two Bib Gourmand Mentions" },
          ],
        },
      },
      {
        id: blockId("photo-strip", 4),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1576506295286-5cda18df43e7?q=80&w=600&fit=crop", alt: "Hand-scooped cone" },
            { src: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?q=80&w=600&fit=crop", alt: "Strawberry sorbet" },
            { src: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=600&fit=crop", alt: "Pistachio pint" },
            { src: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=600&fit=crop", alt: "Counter scene" },
            { src: "https://images.unsplash.com/photo-1472552944129-b035e9ea3744?q=80&w=600&fit=crop", alt: "Chocolate swirl" },
            { src: "https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?q=80&w=600&fit=crop", alt: "Sundae plate" },
            { src: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?q=80&w=600&fit=crop", alt: "Cone in hand at sunset" },
          ],
        },
      },
      {
        id: blockId("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "48 hours",
          description: "from the morning milking to the first scoop you'll taste at the counter",
          footnote: "Single-herd dairy from Vesper Hill Farm, churned the same afternoon it arrives.",
        },
      },
      {
        id: blockId("benefits-grid", 6),
        type: "benefits-grid",
        props: {
          headline: "What goes in. What stays out.",
          columns: 3,
          items: [
            { icon: "Heart", title: "One farm, one herd", description: "Every pint starts with milk from the same 60 cows in Vesper Hill — pasture-raised, hand-milked, never blended with anyone else's." },
            { icon: "Sun", title: "Real fruit, in season", description: "Strawberries in June. Stone fruit in August. Persimmons in November. If it's not in season, it's not on the menu that week." },
            { icon: "Wheat", title: "Five ingredients or fewer", description: "Cream, sugar, eggs, salt, and whatever it's flavored with. No stabilizers, no gums, no shelf-life chemistry." },
            { icon: "Leaf", title: "Local everything", description: "Vanilla from a co-op in Madagascar we've worked with since 2016. Honey from two beekeepers down the road. Salt from the bay outside the window." },
            { icon: "Clock", title: "Made this morning", description: "Each batch is churned by hand the day before it sells. What's left at close goes home with the staff. Nothing waits." },
            { icon: "Users", title: "Family-run, on purpose", description: "Started by two sisters in a converted dairy. Still made by them, their kids, and a small crew that knows your order." },
          ],
        },
      },
      {
        id: blockId("testimonial", 7),
        type: "testimonial",
        props: {
          quote:
            "I have driven across three counties for an ice cream cone exactly once in my life — and that was the day I found Pasture & Stone. The strawberry tasted like a strawberry. I had forgotten that was allowed.",
          author: "Jordan Whitfield",
          role: "Food Critic",
          practiceName: "The Valley Review",
        },
      },
      {
        id: blockId("bottom-cta", 8),
        type: "bottom-cta",
        props: {
          headline: "This week's flavors are up.",
          subheadline: "Twelve rotating flavors, two shops, and a roaming cart on weekends. Come early — the good ones go before lunch.",
          ctaText: "Find this week's flavors",
          ctaUrl: "#",
        },
      },
      genericFooter("Pasture & Stone", 9),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Crowns flagship trio — brand-aware (colors driven by tenant brand vars)
  //
  // Three templates that mirror the Dandy Crowns flagship section order
  // (hero → trust-bar → photo-strip → stat-callout → benefits-grid →
  //  product-grid → testimonial → bottom-cta) but with generic copy for
  // B2B SaaS, Professional Services, and Marketing Agency verticals.
  //
  // Color props are intentionally omitted on the hero/CTA so blocks fall
  // back to `brand.accentColor` (BlockHero.tsx line 25) and the footer
  // omits backgroundColor / accentColor so it picks up `var(--brand-primary)`
  // and `var(--brand-accent)` from the tenant's brand config.
  // ─────────────────────────────────────────────────────────────────────────
  ...((): GlobalTemplateSeed[] => {
    function brandFooter(brand: string, n: number) {
      return {
        id: blockId("footer", n),
        type: "footer",
        props: {
          // backgroundColor omitted -> falls back to var(--brand-primary)
          // accentColor omitted     -> falls back to var(--brand-accent)
          copyrightText: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
          showSocialLinks: true,
          facebookUrl: "#",
          instagramUrl: "#",
          linkedinUrl: "#",
          columns: [
            {
              title: "Product",
              links: [
                { label: "Features", url: "#features" },
                { label: "Pricing", url: "#pricing" },
                { label: "Integrations", url: "#" },
                { label: "Changelog", url: "#" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About", url: "#" },
                { label: "Customers", url: "#" },
                { label: "Careers", url: "#" },
                { label: "Contact", url: "#contact" },
              ],
            },
            {
              title: "Resources",
              links: [
                { label: "Blog", url: "#" },
                { label: "Help Center", url: "#" },
                { label: "Privacy", url: "#" },
                { label: "Terms", url: "#" },
              ],
            },
          ],
        },
      };
    }

    // ── 1. B2B SaaS — Northstream ────────────────────────────────────────
    const saas: GlobalTemplateSeed = {
      slug: "global-crowns-b2b-saas",
      title: "B2B SaaS — Crowns Flagship",
      templateLabel: "B2B SaaS Flagship",
      templateDescription:
        "Crowns-style flagship layout for B2B SaaS. Hero, social-proof bar, product gallery strip, hero stat, six-up benefits, product grid, customer quote, closing CTA. Brand-aware colors.",
      ogImage:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=630&fit=crop",
      industry: "generic",
      blocks: [
        genericNav("Northstream", 1),
        {
          id: blockId("hero", 2),
          type: "hero",
          props: {
            headlineSize: "lg",
            headline: "The platform your operations team will actually use.",
            subheadline:
              "Northstream replaces the dozen tools, brittle scripts, and spreadsheet exports your team has been holding together — with one workspace built for the way modern operators actually work.",
            ctaText: "Start free trial",
            ctaUrl: "#cta",
            // ctaColor omitted -> uses brand.accentColor
            heroType: "static-image",
            layout: "centered",
            backgroundStyle: "white",
            showSocialProof: true,
            socialProofText: "Trusted by operations teams at 1,400+ growing companies",
            imageUrl:
              "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&h=900&fit=crop",
            mediaUrl: "",
          },
        },
        {
          id: blockId("trust-bar", 3),
          type: "trust-bar",
          props: {
            items: [
              { value: "1,400+", label: "Companies" },
              { value: "99.99%", label: "Uptime SLA" },
              { value: "200+", label: "Integrations" },
              { value: "4.8★", label: "G2 Rating" },
            ],
          },
        },
        {
          id: blockId("photo-strip", 4),
          type: "photo-strip",
          props: {
            images: [
              { src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600&fit=crop", alt: "Analytics dashboard" },
              { src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&fit=crop", alt: "Team workspace" },
              { src: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600&fit=crop", alt: "Workflow automation" },
              { src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=600&fit=crop", alt: "Operations review" },
              { src: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=600&fit=crop", alt: "Engineering team" },
              { src: "https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?q=80&w=600&fit=crop", alt: "Product strategy" },
              { src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=600&fit=crop", alt: "Cross-functional sync" },
            ],
          },
        },
        {
          id: blockId("stat-callout", 5),
          type: "stat-callout",
          props: {
            stat: "62%",
            description: "less time spent on manual reporting in the first quarter on Northstream",
            footnote: "Average across 200+ customers measured 90 days post-onboarding.",
          },
        },
        {
          id: blockId("benefits-grid", 6),
          type: "benefits-grid",
          props: {
            headline: "Why operations teams switch to Northstream",
            columns: 3,
            items: [
              { icon: "Zap", title: "Ship workflows in hours", description: "Drag-and-drop automation that replaces brittle scripts. New workflows go live the same day, not the same quarter." },
              { icon: "Layers", title: "One source of truth", description: "Customers, deals, accounts, and tickets unified in a single workspace your whole company can read from." },
              { icon: "ShieldCheck", title: "SOC 2 + HIPAA ready", description: "Audit-grade logging, granular roles, and SSO included on every plan — no enterprise upgrade required." },
              { icon: "Clock", title: "Live, not stale", description: "Dashboards refresh in seconds. No more rebuilding the same Monday-morning report by hand every week." },
              { icon: "Users", title: "Built for teams of teams", description: "Org-wide visibility with team-level permissions. Finance, RevOps, and CX work in the same system without stepping on each other." },
              { icon: "MessageCircle", title: "Real humans in the loop", description: "Dedicated implementation managers, weekly office hours, and a Slack channel staffed by people who built the product." },
            ],
          },
        },
        {
          id: blockId("product-grid", 7),
          type: "product-grid",
          props: {
            headline: "One platform. Every operational workflow.",
            subheadline: "Modules designed to work together — adopt one, layer in the rest as you grow.",
            items: [
              { image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600&h=400&fit=crop", title: "Workflow Automation", description: "Visual builder, 200+ pre-built integrations, and a runtime that handles millions of events per day." },
              { image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop", title: "Live Dashboards", description: "Self-updating reports your CFO can actually trust. Schedule, share, and embed in seconds." },
              { image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600&h=400&fit=crop", title: "Approvals & Routing", description: "Multi-step approvals with full audit trails. Route by amount, region, or any field — without engineering." },
              { image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=600&h=400&fit=crop", title: "Customer 360", description: "A unified record across every system. Built-in deduping and identity resolution out of the box." },
              { image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=600&h=400&fit=crop", title: "Audit & Compliance", description: "Immutable logs, automated evidence collection, and SOC 2 / HIPAA control mapping ready for your auditor." },
              { image: "https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?q=80&w=600&h=400&fit=crop", title: "AI Copilot", description: "Natural-language queries over your operational data. Ask a question, get a chart and a saved workflow." },
            ],
          },
        },
        {
          id: blockId("testimonial", 8),
          type: "testimonial",
          props: {
            quote:
              "Northstream replaced four separate tools and a stack of spreadsheets in our first 90 days. Our ops team now ships in hours what used to take a sprint, and finance trusts the numbers for the first time in years.",
            author: "Priya Anand",
            role: "VP of Revenue Operations",
            practiceName: "Latitude Software",
          },
        },
        {
          id: blockId("bottom-cta", 9),
          type: "bottom-cta",
          props: {
            headline: "Ready to retire the spreadsheets?",
            subheadline: "Free 14-day trial. No credit card. White-glove onboarding included.",
            ctaText: "Start free trial",
            ctaUrl: "#",
          },
        },
        brandFooter("Northstream", 10),
      ],
    };

    // ── 2. Professional Services — Meridian Partners ────────────────────
    const services: GlobalTemplateSeed = {
      slug: "global-crowns-professional-services",
      title: "Professional Services — Crowns Flagship",
      templateLabel: "Professional Services Flagship",
      templateDescription:
        "Crowns-style flagship layout for advisory and professional services firms. Authoritative hero, credibility bar, gallery, headline stat, six-up advantages, practice areas, client quote, and a clear CTA. Brand-aware colors.",
      ogImage:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&h=630&fit=crop",
      industry: "generic",
      blocks: [
        genericNav("Meridian Partners", 1),
        {
          id: blockId("hero", 2),
          type: "hero",
          props: {
            headlineSize: "lg",
            headline: "Senior advisors. Decisive answers. Measurable outcomes.",
            subheadline:
              "Meridian Partners is a boutique advisory firm helping operators, founders, and executive teams make the consequential decisions — with the rigor of a top-tier firm and the responsiveness of a small one.",
            ctaText: "Request a consultation",
            ctaUrl: "#cta",
            // ctaColor omitted -> uses brand.accentColor
            heroType: "static-image",
            layout: "centered",
            backgroundStyle: "white",
            showSocialProof: true,
            socialProofText: "Trusted advisor to 300+ leadership teams across North America and EMEA",
            imageUrl:
              "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&h=900&fit=crop",
            mediaUrl: "",
          },
        },
        {
          id: blockId("trust-bar", 3),
          type: "trust-bar",
          props: {
            items: [
              { value: "300+", label: "Engagements" },
              { value: "22 yrs", label: "In Practice" },
              { value: "$14B", label: "Capital Advised" },
              { value: "96%", label: "Client Retention" },
            ],
          },
        },
        {
          id: blockId("photo-strip", 4),
          type: "photo-strip",
          props: {
            images: [
              { src: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&fit=crop", alt: "Boardroom strategy session" },
              { src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=600&fit=crop", alt: "Leadership working session" },
              { src: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=600&fit=crop", alt: "Client meeting" },
              { src: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=600&fit=crop", alt: "Strategy whiteboard" },
              { src: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&fit=crop", alt: "Executive portrait" },
              { src: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?q=80&w=600&fit=crop", alt: "Office environment" },
              { src: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=600&fit=crop", alt: "Team review" },
            ],
          },
        },
        {
          id: blockId("stat-callout", 5),
          type: "stat-callout",
          props: {
            stat: "3.4×",
            description: "average return on engagement value, measured 12 months after delivery",
            footnote: "Independent client survey of 180 engagements completed between 2021 and 2024.",
          },
        },
        {
          id: blockId("benefits-grid", 6),
          type: "benefits-grid",
          props: {
            headline: "Why leadership teams choose Meridian",
            columns: 3,
            items: [
              { icon: "Users", title: "Partner-led, every engagement", description: "You work directly with the partner who scoped the work. No bait-and-switch to a junior team after the kickoff." },
              { icon: "ShieldCheck", title: "Independent and conflict-free", description: "We don't sell software, take referral fees, or work for your competitors. Our advice serves your interests, full stop." },
              { icon: "Clock", title: "Decisive timelines", description: "Most engagements deliver in 4–8 weeks. We commit to a date and we hit it — written into every statement of work." },
              { icon: "Layers", title: "Operator experience", description: "Every partner has run a P&L, closed a transaction, or built a function. Our advice is grounded in having done the job." },
              { icon: "Sparkles", title: "Clear, written deliverables", description: "Memos, models, and recommendations you can actually act on — not 80-slide decks of frameworks and stock photos." },
              { icon: "MessageCircle", title: "Available when it matters", description: "Direct partner phone numbers, weekend coverage during critical moments, and follow-up at no additional charge for 90 days." },
            ],
          },
        },
        {
          id: blockId("product-grid", 7),
          type: "product-grid",
          props: {
            headline: "Where we do our best work",
            subheadline: "Four practice areas, deeply connected. Engaged on their own or as a coordinated program.",
            items: [
              { image: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&h=400&fit=crop", title: "Strategy & Operating Model", description: "Three- and five-year strategy, operating-model design, org structure, and the priorities that turn plans into execution." },
              { image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=600&h=400&fit=crop", title: "Mergers & Transactions", description: "Buy-side and sell-side support: diligence, valuation, integration planning, and post-close value capture." },
              { image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=600&h=400&fit=crop", title: "Performance Improvement", description: "Cost transformation, pricing optimization, and commercial effectiveness work that pays for itself in-quarter." },
              { image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=600&h=400&fit=crop", title: "Leadership & Org Effectiveness", description: "Executive coaching, succession planning, and organizational design for teams entering their next stage of growth." },
              { image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&h=400&fit=crop", title: "Board Advisory", description: "Independent advisory to boards on CEO transitions, strategic review, governance, and crisis response." },
              { image: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?q=80&w=600&h=400&fit=crop", title: "Interim Leadership", description: "Senior interim placements — CFO, COO, Chief of Staff — when you need an experienced hand in the seat right now." },
            ],
          },
        },
        {
          id: blockId("testimonial", 8),
          type: "testimonial",
          props: {
            quote:
              "Meridian gave us the clearest, most actionable strategic review we've ever received. Six weeks of work that reshaped how the board, the executive team, and the investors talk about the next three years.",
            author: "Daniel Whitcomb",
            role: "Chief Executive Officer",
            practiceName: "Harborline Industries",
          },
        },
        {
          id: blockId("bottom-cta", 9),
          type: "bottom-cta",
          props: {
            headline: "Have a decision worth getting right?",
            subheadline: "We take on a small number of engagements each quarter. A 30-minute conversation will tell us both whether we're the right fit.",
            ctaText: "Request a consultation",
            ctaUrl: "#",
          },
        },
        brandFooter("Meridian Partners", 10),
      ],
    };

    // ── 3. Marketing Agency — Studio Vox ────────────────────────────────
    const agency: GlobalTemplateSeed = {
      slug: "global-crowns-marketing-agency",
      title: "Marketing Agency — Crowns Flagship",
      templateLabel: "Marketing Agency Flagship",
      templateDescription:
        "Crowns-style flagship layout for full-service brand and growth agencies. Editorial hero, credibility bar, work gallery, hero stat, six-up capabilities, services grid, client quote, and project CTA. Brand-aware colors.",
      ogImage:
        "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200&h=630&fit=crop",
      industry: "generic",
      blocks: [
        genericNav("Studio Vox", 1),
        {
          id: blockId("hero", 2),
          type: "hero",
          props: {
            headlineSize: "lg",
            headline: "Brand and growth, made by the same room.",
            subheadline:
              "Studio Vox is a brand-and-performance studio for ambitious companies. We design the story, build the system, and run the campaigns — all under one roof, all by the same senior team.",
            ctaText: "Start a project",
            ctaUrl: "#cta",
            // ctaColor omitted -> uses brand.accentColor
            heroType: "static-image",
            layout: "centered",
            backgroundStyle: "white",
            showSocialProof: true,
            socialProofText: "Selected work for 80+ brands across consumer, B2B SaaS, and fintech",
            imageUrl:
              "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1600&h=900&fit=crop",
            mediaUrl: "",
          },
        },
        {
          id: blockId("trust-bar", 3),
          type: "trust-bar",
          props: {
            items: [
              { value: "80+", label: "Brands Launched" },
              { value: "4.9★", label: "Client NPS" },
              { value: "12 yrs", label: "In Practice" },
              { value: "3×", label: "Avg. Lift Y1" },
            ],
          },
        },
        {
          id: blockId("photo-strip", 4),
          type: "photo-strip",
          props: {
            images: [
              { src: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=600&fit=crop", alt: "Brand identity board" },
              { src: "https://images.unsplash.com/photo-1561070791-2526d30994b8?q=80&w=600&fit=crop", alt: "Campaign photography" },
              { src: "https://images.unsplash.com/photo-1481487196290-c152efe083f5?q=80&w=600&fit=crop", alt: "Print collateral" },
              { src: "https://images.unsplash.com/photo-1542744095-291d1f67b221?q=80&w=600&fit=crop", alt: "Studio workspace" },
              { src: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=600&fit=crop", alt: "Design exploration" },
              { src: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?q=80&w=600&fit=crop", alt: "Color study" },
              { src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600&fit=crop", alt: "Product photography" },
            ],
          },
        },
        {
          id: blockId("stat-callout", 5),
          type: "stat-callout",
          props: {
            stat: "92%",
            description: "of Studio Vox clients renew or expand their engagement after the first project",
            footnote: "Trailing-three-year average across all brand and performance retainers.",
          },
        },
        {
          id: blockId("benefits-grid", 6),
          type: "benefits-grid",
          props: {
            headline: "Why brand teams keep coming back",
            columns: 3,
            items: [
              { icon: "Sparkles", title: "Editorial-grade craft", description: "Type, color, photography, and motion treated like the brand assets they are. Work that holds up next to the best in the world." },
              { icon: "Zap", title: "Brand and growth, together", description: "Strategists, designers, copywriters, and media buyers in the same room — so the brand work and the campaign work tell the same story." },
              { icon: "Users", title: "Senior team, every meeting", description: "You work with the people doing the work — never a junior handoff after the pitch. Direct Slack with the lead designer and strategist." },
              { icon: "Clock", title: "Honest timelines", description: "We commit to milestones and we hit them. No surprise scope creep, no quiet weekends to recover lost ground." },
              { icon: "Layers", title: "Systems, not one-offs", description: "Identity, web, and campaign assets shipped as a coherent system — production-ready files your in-house team can extend on day one." },
              { icon: "MessageCircle", title: "Honest about what works", description: "We measure what we ship and we tell you what didn't land. Quarterly reviews with real numbers, not vanity slides." },
            ],
          },
        },
        {
          id: blockId("product-grid", 7),
          type: "product-grid",
          props: {
            headline: "What we make",
            subheadline: "Six services, woven into one studio. Engaged together or à la carte.",
            items: [
              { image: "https://images.unsplash.com/photo-1561070791-2526d30994b8?q=80&w=600&h=400&fit=crop", title: "Brand Identity", description: "Naming, logo systems, type, color, voice, and the foundational story — built to outlast a quarterly refresh." },
              { image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?q=80&w=600&h=400&fit=crop", title: "Marketing Site", description: "Editorial, conversion-focused websites with the polish of a magazine and the metrics of a growth team." },
              { image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?q=80&w=600&h=400&fit=crop", title: "Performance Media", description: "Paid search, paid social, and lifecycle — managed by senior buyers with the creative team in the same room." },
              { image: "https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&h=400&fit=crop", title: "Campaigns", description: "Launch films, social systems, and OOH that turn a moment into a movement and a movement into pipeline." },
              { image: "https://images.unsplash.com/photo-1483058712412-4245e9b90334?q=80&w=600&h=400&fit=crop", title: "Content & Editorial", description: "Long-form, podcasts, and reports with the typographic care most teams reserve for their logo." },
              { image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=600&h=400&fit=crop", title: "Workshops & Strategy", description: "Two-day intensives that align leadership on positioning, messaging, and what to do on Monday morning." },
            ],
          },
        },
        {
          id: blockId("testimonial", 8),
          type: "testimonial",
          props: {
            quote:
              "Studio Vox shipped the most polished work our company has ever put into the world — and the launch was the best in our history. They held the bar when we were ready to lower it.",
            author: "Camille Okafor",
            role: "Chief Marketing Officer",
            practiceName: "Northwind & Co.",
          },
        },
        {
          id: blockId("bottom-cta", 9),
          type: "bottom-cta",
          props: {
            headline: "Have something worth doing properly?",
            subheadline: "We take on a small number of projects each quarter. Tell us about yours.",
            ctaText: "Start a project",
            ctaUrl: "#",
          },
        },
        brandFooter("Studio Vox", 10),
      ],
    };

    return [saas, services, agency];
  })(),
];

import { DISTINCTIVE_TEMPLATE_SEEDS } from "./distinctiveTemplates";
import { FLAGSHIP_TEMPLATE_SEEDS } from "./flagshipTemplates";
import { TEMPLATE_PAGE_SEEDS } from "./templatePageSeeds";
import { SHOWCASE_TEMPLATE_SEEDS } from "./showcaseTemplates";

// Default premiumRank applied when a seed doesn't carry one explicitly.
// The marketplace shows lower ranks first and groups rank ≤ 10 under
// the "Featured" header. Buckets:
//   1-10  → Featured flagships (set explicitly in flagshipTemplates.ts)
//   11-30 → "Distinctive" premium opinionated templates
//   31-80 → Generic starters
//   81-150 → Industry starters
//   151+   → fallback / unknown
//
// The distinctive templates predate the slug-prefix convention, so we
// enumerate them explicitly to keep ordering deterministic. New
// distinctive templates should add their slug here (or set
// premiumRank explicitly on the seed).
const DISTINCTIVE_SLUG_RANKS: Record<string, number> = {
  "global-editorial-story":     11,
  "global-cinematic-launch":    12,
  "global-brutalist-manifesto": 13,
  "global-boutique-studio":     14,
  "global-pricing-forward-saas":15,
  "global-conversion-capture":  16,
  "global-premium-brand-hero":  17,
  "global-modern-launch":       18,
  "global-quality-os":          19,
  "global-craft-experience":    20,
  "global-trusted-partner":     21,
  "global-data-platform":       22,
  "global-old-way-new-way":     23,
};

function defaultPremiumRank(slug: string): number {
  if (slug.startsWith("global-flagship-")) return 5;
  if (slug in DISTINCTIVE_SLUG_RANKS) return DISTINCTIVE_SLUG_RANKS[slug];
  if (slug.startsWith("global-distinctive-")) return 25;
  if (slug.startsWith("global-")) return 50;
  if (slug.startsWith("ind-")) return 100;
  return 200;
}

// Industry templates are always pinned beneath flagships, distinctives,
// and generic starters. We assign explicit premiumRank values per
// industry seed (rather than relying on the slug-prefix default) so the
// ordering is deterministic and obvious from the data, and so any single
// industry seed can opt out by setting its own `premiumRank`.
const INDUSTRY_TEMPLATE_SEEDS_RANKED: GlobalTemplateSeed[] =
  INDUSTRY_TEMPLATE_SEEDS.map((t, i) => ({
    ...t,
    premiumRank: t.premiumRank ?? 100 + i,
  }));

// Dandy DSO business-case microsite templates (single-block monograph layouts).
// These mirror the in-builder block defaults in lp-studio/block-registry.tsx so
// cloning from the marketplace gives the same starting copy as dragging the
// block into a page from scratch. Premium ranks 26-28 keep them just below the
// distinctive templates but pinned above generic starters in "Featured".
// Block-prop defaults inlined from artifacts/lp-studio/src/lib/block-types/
// block-registry.tsx. The api-server cannot import the lp-studio React module
// (the registry includes JSX thumbnails), so seed maintenance for these three
// templates is manual: when the in-builder defaults change in block-registry,
// update the matching object here so cloning from the marketplace produces the
// same starting content as dragging the block into a page.
const BUSINESS_CASE_SPLIT_PROPS = {
  forCompanyLabel: "For {{company_name}}",
  logoUrl: "/dandy-logo-white.svg",
  logoAlt: "Dandy",
  heroImageUrl: "/dental-professional.png",
  heroEyebrow: "The Business Case",
  heroHeadline: "Building the business case for {{company_name}}'s next chapter.",
  heroSubhead: "The DSO landscape is shifting from fragmented vendor management to centralized, digital-first clinical operations. Here is how leading groups are capitalizing on the change.",
  heroPrimaryCtaText: "Schedule a working session",
  heroPrimaryCtaUrl: "#contact",
  heroSecondaryCtaText: "Read the 5-min summary",
  heroSecondaryCtaUrl: "#summary",
  situationEyebrow: "01",
  situationHeading: "The Situation",
  situationBody: "Scaling a DSO today requires more than just acquiring practices. It demands standardizing clinical quality across hundreds of chairs while managing capital expenditure. Fragmented labs, varying scanner ecosystems, and high remake rates are silently eroding gross margins and frustrating providers. The model must evolve.",
  situationStats: [
    { value: "$40k+", label: "Average scanner capex per office" },
    { value: "5-7%", label: "Industry average remake rate" },
    { value: "4+", label: "Distinct lab vendors managed per clinic" },
  ],
  signalEyebrow: "02",
  signalHeading: "Dandy adoption is accelerating",
  signalCards: [
    { icon: "trending-up", stat: "+312%", body: "YoY growth in digital removables cases across enterprise partners." },
    { icon: "users", stat: "1 in 3", body: "New doctors ask for Dandy by name during the recruitment process." },
    { stat: "", body: "Our associates were demanding better tech. Bringing Dandy in immediately improved our retention and accelerated our digital transition without the upfront capex.", attribution: "VP of Operations, Top 50 DSO" },
  ],
  costEyebrow: "03",
  costHeading: "The Cost of Inaction",
  costItems: [
    { stat: "7%", label: "Remake Rate", description: "The analog industry average, costing hours of unbillable chair time." },
    { stat: "120+", label: "Lost Hours / Year", description: "Per doctor, spent managing physical impressions and lab disputes." },
    { stat: "$40k", label: "Scanner Capex", description: "The upfront cost to digitize a single practice using traditional models." },
    { stat: "4-6", label: "Vendor Count", description: "Fragmented lab partners causing inconsistent quality and opaque data." },
  ],
  shiftEyebrow: "04",
  shiftHeading: "The Paradigm Shift",
  shiftRows: [],
  shiftOldBullets: [
    { title: "Analog Impressions", body: "Messy, uncomfortable for patients, prone to distortion and errors." },
    { title: "Fragmented Lab Network", body: "Managing multiple local labs with varying quality standards and systems." },
    { title: "Opaque Operations", body: "Zero visibility into remake rates, lab spend, or clinical performance at scale." },
    { title: "High Capital Expenditure", body: "Purchasing expensive scanners outright and managing hardware lifecycles." },
  ],
  shiftNewBullets: [
    { title: "100% Digital Workflow", body: "Best-in-class intraoral scanners provided, ensuring precise data capture." },
    { title: "Single Partner", body: "One standardized platform for all indications, from crowns to clear aligners." },
    { title: "Real-Time Data Visibility", body: "Enterprise dashboard tracking every metric across every practice and doctor." },
    { title: "Zero Capex Model", body: "Scanners and training included with lab partnership. Immediate ROI." },
  ],
  mathEyebrow: "05",
  mathHeading: "The Math",
  mathSubhead: "Based on {{practice_count}} offices",
  mathOfficeCount: "{{practice_count}}",
  mathVolumeLabel: "Est. Monthly Case Volume",
  mathVolumeValue: "~450",
  mathStats: [
    { label: "Gross Margin Uplift", value: "+12%", caption: "Estimated annual improvement" },
    { label: "Chair Hours Saved", value: "1,200+", caption: "Across the network annually" },
    { label: "Capex Avoided", value: "$850k", caption: "By utilizing Dandy's scanner model" },
    { label: "Payback Period", value: "Immediate", caption: "ROI realized in month one" },
  ],
  proofEyebrow: "06",
  proofHeading: "The Proof",
  proofFeatured: {
    quote: "Partnering with Dandy was the single highest ROI operational decision we made this year. We digitized 45 practices in 90 days with zero capex, and our doctors couldn't be happier with the clinical quality.",
    name: "Dr. Sarah Jenkins",
    title: "Chief Clinical Officer, Summit Smile Group (45 practices)",
  },
  proofSecondary: [
    { quote: "Our remake rate dropped from 6% to under 2% across the entire network in the first quarter.", name: "Michael Chang", title: "COO, Pacific Coast DSO (28 practices)" },
    { quote: "The enterprise dashboard finally gave us the visibility we needed to standardize care.", name: "Amanda Reyes", title: "VP Operations, Heartland Dental Partners" },
  ],
  planEyebrow: "07",
  planHeading: "The Plan",
  planSteps: [
    { num: "01", title: "Scope", timeframe: "Week 1", description: "Identify a 5-office pilot cohort. Baseline current metrics and align on success criteria." },
    { num: "02", title: "Onboard & Train", timeframe: "Week 2-4", description: "Scanners delivered. White-glove clinical training for doctors and staff." },
    { num: "03", title: "Measure", timeframe: "Month 2", description: "Track case acceptance, turnaround times, and remake rate improvements." },
    { num: "04", title: "Scale", timeframe: "Month 3+", description: "Roll out the Dandy operating system organization-wide." },
  ],
  finalCtaHeading: "Let's build the business case for {{company_name}}.",
  finalCtaSubhead: "Schedule a consultative working session to map out the financial and clinical impact of standardizing on Dandy.",
  finalCtaPrimaryText: "Schedule a working session",
  finalCtaPrimaryUrl: "#contact",
  finalCtaSecondaryText: "or download the one-pager",
  finalCtaSecondaryUrl: "#download",
  bgColor: "#f6f5ee",
  inkColor: "#0f2a1c",
  darkColor: "#0d1f15",
  accentColor: "#c8e84e",
  accentInkColor: "#0d1f15",
  headlineColor: "#0f2a1c",
  headlineOnDarkColor: "#f6f5ee",
} as Record<string, unknown>;

const BUSINESS_CASE_CENTERED_PROPS = {
  forCompanyLabel: "For {{company_name}}",
  logoUrl: "/dandy-logo-white.svg",
  logoAlt: "Dandy",
  heroEyebrow: "The Business Case",
  heroHeadline: "The case for {{company_name}} and Dandy, in plain numbers.",
  heroSubhead: "A comprehensive analysis of how transitioning to a fully digital lab partner impacts clinical outcomes, operational efficiency, and EBITDA at scale.",
  heroPrimaryCtaText: "Schedule a working session",
  heroPrimaryCtaUrl: "#contact",
  heroSecondaryCtaText: "Read the 5-min summary",
  heroSecondaryCtaUrl: "#summary",
  situationEyebrow: "",
  situationHeading: "The Situation",
  situationBody: "DSOs operating at scale are encountering a structural ceiling. Legacy workflows demand massive upfront CAPEX for intraoral scanners, while managing dozens of fragmented local labs creates inconsistent clinical quality and unpredictable costs.",
  situationBodyExtra: "Meanwhile, clinical recruitment and retention have never been more competitive. Doctors expect modern, digital-first workflows that reduce chair time and eliminate frustrating remakes.",
  situationStats: [
    { value: "$30k+", label: "Scanner CAPEX", description: "Average upfront cost per office just for hardware." },
    { value: "4-6", label: "Vendor Sprawl", description: "Average number of lab partners a typical DSO manages." },
    { value: "6-8%", label: "Remake Rate", description: "Industry average, resulting in unbillable chair time." },
  ],
  signalEyebrow: "THE SIGNAL",
  signalHeading: "Doctors are demanding a better standard of care.",
  signalCards: [
    { stat: "+312%", body: "Growth in Dandy removables YoY across our DSO partners." },
    { stat: "1 in 3", body: "New clinical hires ask for Dandy by name during recruitment." },
    { stat: "", body: "We realized we were losing top producers because our legacy lab workflows were frustrating them.", attribution: "VP of Clinical Ops" },
  ],
  costEyebrow: "",
  costHeading: "The Cost of Inaction",
  costSubhead: "Sticking with the status quo isn't neutral. It actively erodes margin and limits growth potential.",
  costItems: [
    { num: "01", stat: "7.2%", label: "Average Remake Rate", description: "Every remake costs an estimated $350 in unbillable chair time." },
    { num: "02", stat: "1,200", label: "Lost Chair Hours / Yr", description: "Based on an average 10-office DSO relying on analog impressions." },
    { num: "03", stat: "$35k", label: "Scanner CAPEX", description: "Upfront capital per office that could be deployed for growth." },
    { num: "04", stat: "12+", label: "Fragmented Vendors", description: "Creating inconsistent quality and opaque unit economics." },
  ],
  shiftEyebrow: "",
  shiftHeading: "The Paradigm Shift",
  shiftRows: [
    { category: "Turnaround Time", oldWay: "2-3 weeks, unpredictable", withDandy: "5-7 days, guaranteed" },
    { category: "First-Time-Right Rate", oldWay: "~92% industry average", withDandy: "99% digital precision" },
    { category: "Doctor Experience", oldWay: "Analog impressions, blind delivery", withDandy: "100% digital, full case visibility" },
    { category: "Data & Visibility", oldWay: "Zero central oversight", withDandy: "Real-time DSO analytics dashboard" },
    { category: "Partnership Model", oldWay: "Transactional vendor", withDandy: "Strategic growth partner (Zero CAPEX)" },
  ],
  shiftOldBullets: [],
  shiftNewBullets: [],
  mathEyebrow: "",
  mathHeading: "The Math",
  mathSubhead: "Based on our analysis for {{company_name}} across {{practice_count}} offices.",
  mathOfficeCount: "{{practice_count}}",
  mathVolumeLabel: "Est. Monthly Restorations",
  mathVolumeValue: "1,450",
  mathStats: [
    { label: "Incremental Cases / Mo", value: "+185" },
    { label: "Chair Hours Saved / Yr", value: "4,200" },
    { label: "Est. Gross Margin Uplift", value: "+14%" },
    { label: "Payback Period", value: "Immediate", caption: "(Zero CAPEX model)" },
  ],
  proofEyebrow: "",
  proofHeading: "Trusted by industry leaders",
  proofFeatured: {
    quote: "Dandy didn't just digitize our labs; they fundamentally changed our unit economics. We've eliminated scanner CAPEX entirely, reduced remakes to near-zero, and our doctors couldn't be happier. It's the most compelling ROI equation in dental right now.",
    name: "Dr. Sarah Jenkins",
    title: "Chief Clinical Officer, Summit Smile Group (42 offices)",
  },
  proofSecondary: [
    { quote: "Rolling out Dandy across 80 locations took less time than a single traditional hardware procurement cycle. The training is phenomenal.", name: "Marcus Thorne", title: "VP Operations, Heartland Dental Partners" },
    { quote: "The real-time data visibility into lab spend and remake rates across all our clinics has been a game-changer for our finance team.", name: "Elena Rostova", title: "CFO, Pacific Coast DSO" },
  ],
  planEyebrow: "",
  planHeading: "The Activation Plan",
  planSubhead: "A derisked, systematic approach to rolling out digital workflows.",
  planSteps: [
    { num: "01", title: "Scope Pilot", timeframe: "Week 1", description: "Select 5 representative offices to establish baseline metrics." },
    { num: "02", title: "Onboard & Train", timeframe: "Weeks 2-4", description: "Scanner delivery and in-person clinical training by Dandy experts." },
    { num: "03", title: "Measure Impact", timeframe: "Month 2", description: "Track case acceptance, turnaround times, and doctor satisfaction." },
    { num: "04", title: "Org-wide Rollout", timeframe: "Month 3+", description: "Phased deployment across all remaining practices." },
  ],
  finalCtaHeading: "Let's build the business case for {{company_name}}.",
  finalCtaSubhead: "Schedule a 45-minute working session with our enterprise team to run your specific numbers through our ROI model.",
  finalCtaPrimaryText: "Schedule a working session",
  finalCtaPrimaryUrl: "#contact",
  finalCtaSecondaryText: "or download the one-pager",
  finalCtaSecondaryUrl: "#download",
  bgColor: "#f6f5ee",
  inkColor: "#0d1f15",
  darkColor: "#0d1f15",
  accentColor: "#c8e84e",
  accentInkColor: "#0d1f15",
  headlineColor: "#0d1f15",
  headlineOnDarkColor: "#f6f5ee",
} as Record<string, unknown>;

const BUSINESS_CASE_PREMIUM_PROPS = {
  forCompanyLabel: "For {{company_name}}",
  logoUrl: "/dandy-logo-white.svg",
  logoAlt: "Dandy",
  kicker: "Field study · Confidential",
  heroEyebrow: "Organic demand from {{company_name}} practices",
  heroHeadline: "Why {{company_name}} doctors keep finding Dandy.",
  heroSubhead: "{{company_name}} practices have been reaching out. Here's what they're telling us — and what it signals for the network.",
  heroPrimaryCtaText: "Schedule a working session",
  heroPrimaryCtaUrl: "#contact",
  heroSecondaryCtaText: "",
  heroSecondaryCtaUrl: "",
  heroLayout: "split-image-right",
  heroImageUrl: "",
  heroImageCaption: "Field study · 8 active practices · 30+ inbound requests",
  situationImageUrl: "",
  proofImageUrl: "",
  volumeLabel: "Volume I",
  issueLabel: "2025 · No. 01",
  plateLabel: "Plate 01",
  situationEyebrow: "The signal",
  situationHeading: "Removables are a clinical opportunity.",
  situationBody: "30+ {{company_name}} doctors and regional managers have reached out asking to start using Dandy. 8 practices are already active, with monthly orders heavily skewed toward partials and full dentures.",
  situationBodyExtra: "Their reasons for finding us are consistent: they're solving real pain points with hard-to-ignore ROI.",
  situationStats: [
    { value: "30+", label: "Inbound requests", description: "Practices from every region asking to work with us." },
    { value: "8", label: "Active practices", description: "Already using Dandy while waiting for vendor approval." },
    { value: "$25K–$28K", label: "Monthly combined spend", description: "Combined spend from active {{company_name}} practices." },
    { value: "Removables", label: "Most requested orders", description: "Partials and dentures driving the most demand." },
  ],
  signalEyebrow: "The clinical case",
  signalHeading: "Solving the biggest challenges {{company_name}} practices are facing.",
  signalCards: [
    { stat: "01", body: "Impression quality — analog impressions introduce variability that propagates through the entire workflow." },
    { stat: "02", body: "Removables gap — practices run 5–6 appointment denture workflows. Dandy cuts that to 2–3." },
    { stat: "03", body: "In-house printing — SprintRay and PrimePrint are hard to standardize across locations." },
    { stat: "04", body: "Current labs are inconsistent — doctors report 'hit or miss' results without an accountable, vertically integrated partner." },
    { stat: "05", body: "Immediate dentures — in high-extraction markets, Dandy's workflow replaces multi-reline processes at lower cost." },
    { stat: "", body: "Doctors keep telling us the same thing — they need one accountable partner, not five vendors and a printer.", attribution: "Dandy enterprise team" },
  ],
  costEyebrow: "The operational layer",
  costHeading: "What regional leaders are telling us.",
  costSubhead: "Regionals and clinical leaders struggle with little to no real-time visibility into lab performance across locations. Dandy Hub changes that.",
  costItems: [
    { num: "01", stat: "0%", label: "Clinical oversight visibility", description: "Most groups have no shared view of scan quality, remakes, or case outcomes across locations." },
    { num: "02", stat: "Real-time", label: "Case data access", description: "Live metrics on scan quality, remake rates, and case outcomes in one dashboard." },
    { num: "03", stat: "AI", label: "Scan Review tool", description: "Monitor clinical quality without being on-site daily." },
    { num: "04", stat: "1 view", label: "Across every location", description: "Coach with data, not instinct — provider-level performance, not just practice averages." },
  ],
  shiftEyebrow: "See everything",
  shiftHeading: "See everything. Before it becomes a problem.",
  shiftRows: [
    { category: "Remake rates", oldWay: "Tracked by practice only, weeks late", withDandy: "Tracked by provider, in real time" },
    { category: "Provider performance", oldWay: "Coaching based on instinct", withDandy: "Coach with data, side-by-side comparisons" },
    { category: "Spend tracking", oldWay: "Reconciled monthly, by location", withDandy: "Live, every dollar, every location" },
    { category: "Scan quality", oldWay: "Caught at delivery (or never)", withDandy: "Flagged before the case ships" },
    { category: "Operational view", oldWay: "Phone calls and spreadsheets", withDandy: "Purpose-built analytics for modern groups" },
  ],
  shiftOldBullets: [],
  shiftNewBullets: [],
  mathEyebrow: "The math",
  mathHeading: "What this looks like at {{company_name}} scale.",
  mathSubhead: "Modeled across {{company_name}}'s network of {{practice_count}} offices using current active-practice metrics.",
  mathOfficeCount: "{{practice_count}}",
  mathVolumeLabel: "Active Practices Today",
  mathVolumeValue: "8",
  mathHeroEyebrow: "Inbound requests",
  mathHeroStat: "30+",
  mathHeroDescription: "Doctors and regional managers reaching out organically — before any formal vendor approval.",
  mathStats: [
    { value: "$25K–$28K", label: "Monthly combined spend" },
    { value: "Removables", label: "Most requested orders" },
    { value: "2–3", label: "Denture appointments", caption: "vs. 5–6 industry standard" },
    { value: "Zero", label: "CAPEX to start", caption: "Scanners included" },
  ],
  proofEyebrow: "Your clinical perspective",
  proofHeading: "What active {{company_name}} practices are telling us.",
  proofFeatured: {
    quote: "Removables were our biggest gap. We had three vendors and an in-house printer, and we still couldn't deliver consistent dentures. Dandy is the first partner that's actually accountable for the whole workflow.",
    name: "Active {{company_name}} practice",
    title: "Regional clinical lead",
  },
  proofSecondary: [
    { quote: "Cutting denture workflows from six appointments to two changes the economics of every removable case we accept.", name: "Practice owner", title: "{{company_name}} affiliate practice" },
    { quote: "Real-time scan quality flags mean we catch issues at the chair, not at delivery. That's the visibility our regionals have been asking for.", name: "Regional manager", title: "{{company_name}} operations" },
  ],
  planEyebrow: "Next step",
  planHeading: "A clinical evaluation, not a commitment.",
  planSubhead: "We have a lot of respect for what a formal clinical evaluation requires. We're not asking for a commitment — just your perspective.",
  planSteps: [
    { num: "01", title: "Clinical conversation", timeframe: "Week 1", description: "30-minute working session with your clinical and operations leaders." },
    { num: "02", title: "Side-by-side cases", timeframe: "Weeks 2–3", description: "Run a handful of representative cases through Dandy alongside your current workflow." },
    { num: "03", title: "Review findings", timeframe: "Week 4", description: "Compare turnaround, quality, and chair time on the same patient set." },
    { num: "04", title: "Decide together", timeframe: "Week 5+", description: "If the numbers support it, scope a pilot. If not, we walk away with mutual respect." },
  ],
  finalCtaEyebrow: "Your input can shape better outcomes",
  finalCtaHeading: "Your input can shape better outcomes.",
  finalCtaSubhead: "Thousands of practices rely on us. Purpose-built for multi-location DSOs. Fully integrated hardware, software, and lab.",
  finalCtaPrimaryText: "Schedule a working session",
  finalCtaPrimaryUrl: "#contact",
  finalCtaSecondaryText: "",
  finalCtaSecondaryUrl: "",
  footerLeftLabel: "Dandy × {{company_name}}",
  footerRightLabel: "Confidential · 2025",
  bgColor: "#f6f5ee",
  inkColor: "#0d1f15",
  darkColor: "#0d1f15",
  accentColor: "#c8e84e",
  accentInkColor: "#0d1f15",
  headlineColor: "#0d1f15",
  headlineOnDarkColor: "#f6f5ee",
} as Record<string, unknown>;

// Brand-neutral siblings of the three business-case monographs (June 2026).
// Same single-block layouts, but every line of copy is rewritten as a generic
// consultative-B2B narrative (fragmented vendors / manual handoffs → one
// accountable platform) so the templates can absorb ANY tenant brand:
//   • industry is null (universal) instead of "dental";
//   • the Dandy logo and palette props are OMITTED — the blocks fall back to
//     the tenant BrandConfig (brand colors, brand logo, and the
//     "With <brandName>" comparison labels), so the page repaints itself for
//     whichever brand clones it;
//   • every stat is a plausible generic placeholder meant to be replaced by
//     the AI copy-rewrite pass (template-driven generation) or by hand.
// {{company_name}} / {{practice_count}} are the two wired personalization
// tokens (lib/businessCaseVars.ts; practice_count is the token's canonical
// name — it resolves to a location count, not dental copy).
const BUSINESS_CASE_SPLIT_GENERIC_PROPS = {
  forCompanyLabel: "For {{company_name}}",
  logoUrl: "",
  logoAlt: "",
  heroImageUrl: "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?w=1200&q=80",
  heroEyebrow: "The Business Case",
  heroHeadline: "Building the business case for {{company_name}}'s next chapter.",
  heroSubhead: "Operations leaders are moving from fragmented vendors and manual handoffs to one accountable, digital-first platform. Here is how leading teams are capitalizing on the shift.",
  heroPrimaryCtaText: "Schedule a working session",
  heroPrimaryCtaUrl: "#contact",
  heroSecondaryCtaText: "Read the 5-min summary",
  heroSecondaryCtaUrl: "#summary",
  situationEyebrow: "01",
  situationHeading: "The Situation",
  situationBody: "Scaling an operation today takes more than adding headcount. It means standardizing quality across every team and location while keeping spend predictable. Fragmented vendors, inconsistent tooling, and avoidable rework are quietly eroding margins and frustrating your best people. The model has to evolve.",
  situationStats: [
    { value: "$30k+", label: "Average tooling spend per location" },
    { value: "5-7%", label: "Typical rework rate" },
    { value: "4+", label: "Point vendors managed per team" },
  ],
  signalEyebrow: "02",
  signalHeading: "Adoption is accelerating",
  signalCards: [
    { icon: "trending-up", stat: "+180%", body: "YoY growth in platform usage across enterprise customers." },
    { icon: "users", stat: "1 in 3", body: "Candidates ask about modern tooling during the hiring process." },
    { stat: "", body: "Our team was asking for better tools. Standardizing on one platform improved retention and accelerated our rollout without upfront capital.", attribution: "VP of Operations, mid-market services group" },
  ],
  costEyebrow: "03",
  costHeading: "The Cost of Inaction",
  costItems: [
    { stat: "6%", label: "Rework Rate", description: "The legacy-workflow average, costing hours of unbillable team time." },
    { stat: "120+", label: "Lost Hours / Year", description: "Per operator, spent on manual handoffs and vendor disputes." },
    { stat: "$30k", label: "Upfront Tooling", description: "The typical cost to equip a single location under the legacy model." },
    { stat: "4-6", label: "Vendor Count", description: "Fragmented partners causing inconsistent quality and opaque data." },
  ],
  shiftEyebrow: "04",
  shiftHeading: "The Paradigm Shift",
  shiftRows: [],
  shiftOldBullets: [
    { title: "Manual Handoffs", body: "Slow, error-prone, and frustrating for customers and staff alike." },
    { title: "Fragmented Vendor Network", body: "Multiple point solutions with varying quality standards and systems." },
    { title: "Opaque Operations", body: "Zero visibility into rework, spend, or performance at scale." },
    { title: "High Upfront Spend", body: "Buying equipment and licenses outright and managing the refresh cycle." },
  ],
  shiftNewBullets: [
    { title: "One Digital Workflow", body: "Modern tooling included, ensuring consistent execution everywhere." },
    { title: "Single Partner", body: "One standardized platform for every workflow, end to end." },
    { title: "Real-Time Visibility", body: "A live dashboard tracking every metric across every team and location." },
    { title: "No Upfront Capital", body: "Tooling and training included with the partnership. Immediate ROI." },
  ],
  mathEyebrow: "05",
  mathHeading: "The Math",
  mathSubhead: "Based on {{practice_count}} locations",
  mathOfficeCount: "{{practice_count}}",
  mathVolumeLabel: "Est. Monthly Volume",
  mathVolumeValue: "~450",
  mathStats: [
    { label: "Gross Margin Uplift", value: "+10%", caption: "Estimated annual improvement" },
    { label: "Team Hours Saved", value: "1,200+", caption: "Across the network annually" },
    { label: "Capital Avoided", value: "$500k", caption: "Via the partner-provided tooling model" },
    { label: "Payback Period", value: "Immediate", caption: "ROI realized in month one" },
  ],
  proofEyebrow: "06",
  proofHeading: "The Proof",
  proofFeatured: {
    quote: "This was the single highest-ROI operational decision we made this year. We rolled out 45 locations in 90 days with no upfront capital, and our operators couldn't be happier with the results.",
    name: "Jordan Avery",
    title: "Chief Operating Officer, Meridian Group (45 locations)",
  },
  proofSecondary: [
    { quote: "Our rework rate dropped from 6% to under 2% across the entire network in the first quarter.", name: "Michael Chang", title: "COO, Pacific Crest Operations (28 locations)" },
    { quote: "The enterprise dashboard finally gave us the visibility we needed to standardize quality.", name: "Amanda Reyes", title: "VP Operations, Northwind Services Group" },
  ],
  planEyebrow: "07",
  planHeading: "The Plan",
  planSteps: [
    { num: "01", title: "Scope", timeframe: "Week 1", description: "Identify a 5-location pilot cohort. Baseline current metrics and align on success criteria." },
    { num: "02", title: "Onboard & Train", timeframe: "Week 2-4", description: "Tooling delivered. White-glove training for operators and staff." },
    { num: "03", title: "Measure", timeframe: "Month 2", description: "Track throughput, turnaround times, and rework improvements." },
    { num: "04", title: "Scale", timeframe: "Month 3+", description: "Roll out the new operating model organization-wide." },
  ],
  finalCtaHeading: "Let's build the business case for {{company_name}}.",
  finalCtaSubhead: "Schedule a consultative working session to map out the financial and operational impact of standardizing on one platform.",
  finalCtaPrimaryText: "Schedule a working session",
  finalCtaPrimaryUrl: "#contact",
  finalCtaSecondaryText: "or download the one-pager",
  finalCtaSecondaryUrl: "#download",
} as Record<string, unknown>;

const BUSINESS_CASE_CENTERED_GENERIC_PROPS = {
  forCompanyLabel: "For {{company_name}}",
  logoUrl: "",
  logoAlt: "",
  heroEyebrow: "The Business Case",
  heroHeadline: "The case for {{company_name}}'s next platform, in plain numbers.",
  heroSubhead: "A comprehensive analysis of how consolidating on a single operating platform impacts quality, operational efficiency, and EBITDA at scale.",
  heroPrimaryCtaText: "Schedule a working session",
  heroPrimaryCtaUrl: "#contact",
  heroSecondaryCtaText: "Read the 5-min summary",
  heroSecondaryCtaUrl: "#summary",
  situationEyebrow: "",
  situationHeading: "The Situation",
  situationBody: "Organizations operating at scale are hitting a structural ceiling. Legacy workflows demand heavy upfront spend on tooling, while managing a sprawl of point vendors creates inconsistent quality and unpredictable costs.",
  situationBodyExtra: "Meanwhile, recruiting and retention have never been more competitive. Your best people expect modern, digital-first workflows that cut busywork and eliminate frustrating rework.",
  situationStats: [
    { value: "$30k+", label: "Upfront Tooling", description: "Average cost per location just to get equipped." },
    { value: "4-6", label: "Vendor Sprawl", description: "Average number of point vendors a typical operator manages." },
    { value: "6-8%", label: "Rework Rate", description: "Legacy-workflow average, resulting in unbillable hours." },
  ],
  signalEyebrow: "THE SIGNAL",
  signalHeading: "Your team is asking for a better standard.",
  signalCards: [
    { stat: "+180%", body: "YoY growth in platform adoption across enterprise customers." },
    { stat: "1 in 3", body: "New hires ask about tooling and workflows during recruitment." },
    { stat: "", body: "We realized we were losing top performers because our legacy workflows were frustrating them.", attribution: "VP of Operations" },
  ],
  costEyebrow: "",
  costHeading: "The Cost of Inaction",
  costSubhead: "Sticking with the status quo isn't neutral. It actively erodes margin and limits growth potential.",
  costItems: [
    { num: "01", stat: "7%", label: "Average Rework Rate", description: "Every redo costs an estimated $300 in unbillable team time." },
    { num: "02", stat: "1,200", label: "Lost Hours / Yr", description: "Based on an average 10-location operation relying on manual handoffs." },
    { num: "03", stat: "$30k", label: "Upfront Tooling", description: "Capital per location that could be deployed for growth instead." },
    { num: "04", stat: "12+", label: "Fragmented Vendors", description: "Creating inconsistent quality and opaque unit economics." },
  ],
  shiftEyebrow: "",
  shiftHeading: "The Paradigm Shift",
  shiftRows: [
    { category: "Turnaround Time", oldWay: "2-3 weeks, unpredictable", withDandy: "Days, guaranteed" },
    { category: "First-Time-Right Rate", oldWay: "~92% legacy average", withDandy: "99% with a digital workflow" },
    { category: "Team Experience", oldWay: "Manual handoffs, blind delivery", withDandy: "100% digital, full visibility" },
    { category: "Data & Visibility", oldWay: "Zero central oversight", withDandy: "Real-time analytics dashboard" },
    { category: "Partnership Model", oldWay: "Transactional vendor", withDandy: "Strategic growth partner (no upfront capital)" },
  ],
  shiftOldBullets: [],
  shiftNewBullets: [],
  mathEyebrow: "",
  mathHeading: "The Math",
  mathSubhead: "Based on our analysis for {{company_name}} across {{practice_count}} locations.",
  mathOfficeCount: "{{practice_count}}",
  mathVolumeLabel: "Est. Monthly Orders",
  mathVolumeValue: "1,450",
  mathStats: [
    { label: "Incremental Orders / Mo", value: "+150" },
    { label: "Team Hours Saved / Yr", value: "4,200" },
    { label: "Est. Gross Margin Uplift", value: "+12%" },
    { label: "Payback Period", value: "Immediate", caption: "(No upfront capital)" },
  ],
  proofEyebrow: "",
  proofHeading: "Trusted by operators at scale",
  proofFeatured: {
    quote: "They didn't just modernize our workflows; they fundamentally changed our unit economics. We eliminated upfront tooling spend entirely, cut rework to near zero, and our teams couldn't be happier. It's the most compelling ROI equation we've seen.",
    name: "Jordan Avery",
    title: "Chief Operating Officer, Meridian Group (42 locations)",
  },
  proofSecondary: [
    { quote: "Rolling out across 80 locations took less time than a single traditional procurement cycle. The training is phenomenal.", name: "Marcus Thorne", title: "VP Operations, Northwind Services Group" },
    { quote: "Real-time visibility into spend and rework across every location has been a game-changer for our finance team.", name: "Elena Rostova", title: "CFO, Pacific Crest Operations" },
  ],
  planEyebrow: "",
  planHeading: "The Activation Plan",
  planSubhead: "A derisked, systematic approach to rolling out the new operating model.",
  planSteps: [
    { num: "01", title: "Scope Pilot", timeframe: "Week 1", description: "Select 5 representative locations to establish baseline metrics." },
    { num: "02", title: "Onboard & Train", timeframe: "Weeks 2-4", description: "Tooling delivery and hands-on training from the partner team." },
    { num: "03", title: "Measure Impact", timeframe: "Month 2", description: "Track throughput, turnaround times, and team satisfaction." },
    { num: "04", title: "Org-wide Rollout", timeframe: "Month 3+", description: "Phased deployment across all remaining locations." },
  ],
  finalCtaHeading: "Let's build the business case for {{company_name}}.",
  finalCtaSubhead: "Schedule a 45-minute working session with our enterprise team to run your specific numbers through the ROI model.",
  finalCtaPrimaryText: "Schedule a working session",
  finalCtaPrimaryUrl: "#contact",
  finalCtaSecondaryText: "or download the one-pager",
  finalCtaSecondaryUrl: "#download",
} as Record<string, unknown>;

const BUSINESS_CASE_PREMIUM_GENERIC_PROPS = {
  forCompanyLabel: "For {{company_name}}",
  logoUrl: "",
  logoAlt: "",
  kicker: "Field study · Confidential",
  heroEyebrow: "Organic demand from {{company_name}} teams",
  heroHeadline: "Why {{company_name}} teams keep finding us.",
  heroSubhead: "{{company_name}} teams have been reaching out. Here's what they're telling us — and what it signals for the organization.",
  heroPrimaryCtaText: "Schedule a working session",
  heroPrimaryCtaUrl: "#contact",
  heroSecondaryCtaText: "",
  heroSecondaryCtaUrl: "",
  heroLayout: "split-image-right",
  heroImageUrl: "",
  heroImageCaption: "Field study · 8 active teams · 30+ inbound requests",
  situationImageUrl: "",
  proofImageUrl: "",
  volumeLabel: "Volume I",
  issueLabel: "2026 · No. 01",
  plateLabel: "Plate 01",
  situationEyebrow: "The signal",
  situationHeading: "The demand is already inside the building.",
  situationBody: "30+ {{company_name}} operators and regional leads have reached out asking to start working with us. 8 teams are already active, with monthly usage concentrated in the highest-friction workflows.",
  situationBodyExtra: "Their reasons for finding us are consistent: they're solving real pain points with hard-to-ignore ROI.",
  situationStats: [
    { value: "30+", label: "Inbound requests", description: "Teams from every region asking to work with us." },
    { value: "8", label: "Active teams", description: "Already using the platform while waiting for formal approval." },
    { value: "$25K–$28K", label: "Monthly combined spend", description: "Combined spend from active {{company_name}} teams." },
    { value: "Core workflows", label: "Most requested", description: "The highest-friction processes driving the most demand." },
  ],
  signalEyebrow: "The operating case",
  signalHeading: "Solving the biggest challenges {{company_name}} teams are facing.",
  signalCards: [
    { stat: "01", body: "Input quality — manual data capture introduces variability that propagates through the entire workflow." },
    { stat: "02", body: "Cycle-time gap — teams run 5–6 step approval loops today. The platform cuts that to 2–3." },
    { stat: "03", body: "In-house point tools — ad-hoc solutions are hard to standardize across locations." },
    { stat: "04", body: "Current vendors are inconsistent — teams report 'hit or miss' results without one accountable, integrated partner." },
    { stat: "05", body: "Urgent requests — in high-volume regions, the new workflow replaces multi-step escalations at lower cost." },
    { stat: "", body: "Teams keep telling us the same thing — they need one accountable partner, not five vendors and a workaround.", attribution: "Enterprise partnerships team" },
  ],
  costEyebrow: "The operational layer",
  costHeading: "What regional leaders are telling us.",
  costSubhead: "Regional and functional leaders struggle with little to no real-time visibility into performance across locations. A shared operations hub changes that.",
  costItems: [
    { num: "01", stat: "0%", label: "Oversight visibility", description: "Most groups have no shared view of quality, rework, or outcomes across locations." },
    { num: "02", stat: "Real-time", label: "Performance data access", description: "Live metrics on quality, rework rates, and outcomes in one dashboard." },
    { num: "03", stat: "AI", label: "Quality review tooling", description: "Monitor quality without being on-site daily." },
    { num: "04", stat: "1 view", label: "Across every location", description: "Coach with data, not instinct — individual-level performance, not just location averages." },
  ],
  shiftEyebrow: "See everything",
  shiftHeading: "See everything. Before it becomes a problem.",
  shiftRows: [
    { category: "Rework rates", oldWay: "Tracked by location only, weeks late", withDandy: "Tracked by individual, in real time" },
    { category: "Team performance", oldWay: "Coaching based on instinct", withDandy: "Coach with data, side-by-side comparisons" },
    { category: "Spend tracking", oldWay: "Reconciled monthly, by location", withDandy: "Live, every dollar, every location" },
    { category: "Quality issues", oldWay: "Caught at delivery (or never)", withDandy: "Flagged before the work ships" },
    { category: "Operational view", oldWay: "Phone calls and spreadsheets", withDandy: "Purpose-built analytics for modern groups" },
  ],
  shiftOldBullets: [],
  shiftNewBullets: [],
  mathEyebrow: "The math",
  mathHeading: "What this looks like at {{company_name}} scale.",
  mathSubhead: "Modeled across {{company_name}}'s network of {{practice_count}} locations using current active-team metrics.",
  mathOfficeCount: "{{practice_count}}",
  mathVolumeLabel: "Active Teams Today",
  mathVolumeValue: "8",
  mathHeroEyebrow: "Inbound requests",
  mathHeroStat: "30+",
  mathHeroDescription: "Operators and regional leads reaching out organically — before any formal vendor approval.",
  mathStats: [
    { value: "$25K–$28K", label: "Monthly combined spend" },
    { value: "Core workflows", label: "Most requested" },
    { value: "2–3", label: "Steps per cycle", caption: "vs. 5–6 legacy standard" },
    { value: "Zero", label: "Upfront capital", caption: "Tooling included" },
  ],
  proofEyebrow: "Your operators' perspective",
  proofHeading: "What active {{company_name}} teams are telling us.",
  proofFeatured: {
    quote: "Consistency was our biggest gap. We had three vendors and an in-house workaround, and we still couldn't deliver predictable results. This is the first partner that's actually accountable for the whole workflow.",
    name: "Active {{company_name}} team",
    title: "Regional operations lead",
  },
  proofSecondary: [
    { quote: "Cutting the cycle from six steps to two changes the economics of every order we accept.", name: "Team lead", title: "{{company_name}} affiliate location" },
    { quote: "Real-time quality flags mean we catch issues at the source, not at delivery. That's the visibility our regional leads have been asking for.", name: "Regional manager", title: "{{company_name}} operations" },
  ],
  planEyebrow: "Next step",
  planHeading: "An evaluation, not a commitment.",
  planSubhead: "We have a lot of respect for what a formal evaluation requires. We're not asking for a commitment — just your perspective.",
  planSteps: [
    { num: "01", title: "Working conversation", timeframe: "Week 1", description: "30-minute session with your operations and functional leaders." },
    { num: "02", title: "Side-by-side trial", timeframe: "Weeks 2–3", description: "Run a handful of representative orders through the platform alongside your current workflow." },
    { num: "03", title: "Review findings", timeframe: "Week 4", description: "Compare turnaround, quality, and team time on the same work." },
    { num: "04", title: "Decide together", timeframe: "Week 5+", description: "If the numbers support it, scope a pilot. If not, we walk away with mutual respect." },
  ],
  finalCtaEyebrow: "Your input can shape better outcomes",
  finalCtaHeading: "Your input can shape better outcomes.",
  finalCtaSubhead: "Thousands of teams rely on the platform. Purpose-built for multi-location organizations. Fully integrated tooling, software, and support.",
  finalCtaPrimaryText: "Schedule a working session",
  finalCtaPrimaryUrl: "#contact",
  finalCtaSecondaryText: "",
  finalCtaSecondaryUrl: "",
  footerLeftLabel: "Prepared for {{company_name}}",
  footerRightLabel: "Confidential · 2026",
} as Record<string, unknown>;

// ── Sales-narrative monograph default props ─────────────────────────────────
// Brand-neutral defaults mirrored from each block component's exported
// *_DEFAULT_PROPS. No palette keys (the blocks derive every color from the
// tenant BrandConfig), no baked logos/testimonials, no dental/Dandy vocabulary.

const STORYBRAND_JOURNEY_GENERIC_PROPS = {
  displayFontMode: "serif",
  kicker: "For teams that run on client work",
  heroHeadline: "Every client launch, smooth from day one.",
  heroSubhead:
    "One simple system for onboarding new clients — so every project starts on time, every time.",
  heroPrimaryCtaText: "Book a 20-minute call",
  heroPrimaryCtaUrl: "#",
  heroTransitionalCtaText: "Get the onboarding checklist",
  heroTransitionalCtaUrl: "#",
  heroTransitionalAssetLabel: "Free guide · 9 pages · no email required",
  heroImageUrl:
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1100&h=1300&fit=crop",
  heroImageAlt: "A small team working together around a sunlit table",
  showProblem: true,
  problemKicker: "Sound familiar?",
  problemHeading: "Starting a new client shouldn't feel like starting over.",
  problemIntro:
    "You won the work. Then the first two weeks disappear into chasing details that should already be in one place.",
  problemCards: [
    {
      icon: "ClipboardList",
      label: "The external problem",
      title: "Onboarding lives in ten places",
      body: "Kickoff details are scattered across email threads, spreadsheets, and someone's memory.",
    },
    {
      icon: "HeartCrack",
      label: "The internal problem",
      title: "You look less buttoned-up than you are",
      body: "Every dropped handoff chips away at the confidence your team worked so hard to earn.",
    },
    {
      icon: "Scale",
      label: "The philosophical problem",
      title: "The first week should match the pitch",
      body: "Teams that do great work shouldn't lose trust in the gap between contract and kickoff.",
    },
  ],
  showStakes: true,
  stakesKicker: "The cost of waiting",
  stakesHeading: "What another messy quarter costs you",
  stakesItems: [
    "Hours of senior time spent chasing status instead of serving clients",
    "Revenue that slips every time a project starts two weeks late",
    "Referrals that never happen because the first impression wobbled",
  ],
  stakesFootnote: "None of it shows up on an invoice. All of it shows up in the year.",
  showGuide: true,
  guideKicker: "Your guide",
  guideEmpathy:
    "We've sat in the Monday meeting where nobody could say when the project actually starts. You shouldn't need heroics to begin work you've already won.",
  guideAuthorityHeading: "Why teams trust us",
  guideLogos: [],
  guideStats: [
    { value: "9 yrs", label: "Helping services teams launch" },
    { value: "400+", label: "Onboarding playbooks installed" },
    { value: "98%", label: "Of customers stay year over year" },
  ],
  guideTestimonials: [],
  showPlan: true,
  planKicker: "The plan",
  planHeading: "Three steps to a calmer quarter",
  planSubhead: "No rip-and-replace. We start with how your team already works.",
  planSteps: [
    {
      title: "Map your onboarding",
      body: "We chart how a client moves from signed to started today — every step, owner, and gap.",
    },
    {
      title: "Install your playbook",
      body: "Your steps, owners, and timelines live in one shared system your whole team can see.",
    },
    {
      title: "Launch with confidence",
      body: "Every new client follows the same smooth path — automatically, without the chase.",
    },
  ],
  showPostPurchase: false,
  postPurchaseLabel: "And after you're up and running",
  postPurchaseSteps: [
    {
      title: "Quarterly tune-ups",
      body: "We review the data together and tighten the playbook where launches still drag.",
    },
    {
      title: "A team that runs it",
      body: "Training and templates so the system outlives any single hire.",
    },
  ],
  showSuccess: true,
  successKicker: "Where this goes",
  successHeading: "Imagine the next kickoff",
  successBody:
    "The week a contract is signed, everyone — your team and theirs — already knows what happens next.",
  successItems: [
    { from: "Scattered email threads", to: "One shared launch plan" },
    { from: "“When do we start?”", to: "A date everyone trusts" },
    { from: "Heroic catch-up weeks", to: "Calm, on-time delivery" },
  ],
  successImageUrl:
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1200&h=900&fit=crop",
  successImageAlt: "Two colleagues reviewing a plan and smiling",
  showFinale: true,
  finaleKicker: "The next step",
  finaleHeading: "Be the team clients brag about.",
  finaleRecap:
    "One simple system for onboarding — fewer fires, faster starts, happier clients.",
  finalePrimaryCtaText: "Book a 20-minute call",
  finalePrimaryCtaUrl: "#",
  finaleTransitionalCtaText: "Get the onboarding checklist",
  finaleTransitionalCtaUrl: "#",
  finaleTransitionalAssetLabel: "Free guide · 9 pages · no email required",
} as Record<string, unknown>;

const EXEC_DECISION_BRIEF_GENERIC_PROPS = {
  preparedForLabel: "Prepared for {{company_name}}",
  headline: "Cut order-processing cost 32% within 90 days of go-live.",
  thesis:
    "Manual order operations are now the single largest controllable cost in fulfillment. This brief lays out the pain, the proof, the criteria, and the math behind fixing it this quarter.",
  metaDate: "Decision brief · Q3",
  metaPreparer: "Prepared by your account team",
  showLogo: true,
  logoUrl: "",
  showPain: true,
  painKicker: "Identified pain",
  painHeading: "Three costs the status quo books every month.",
  painHeader: "Pain",
  painCostHeader: "Cost if unresolved",
  painRows: [
    {
      pain: "Order exceptions are re-keyed by hand across three systems, so every error is touched twice.",
      owner: "Operations",
      cost: "$310K / yr",
    },
    {
      pain: "SLA penalties accrue because escalations sit in shared inboxes with no owner or clock.",
      owner: "Customer success",
      cost: "$96K / yr",
    },
    {
      pain: "Month-end close needs four analyst-days of reconciliation before finance will sign off.",
      owner: "Finance",
      cost: "48 days / yr",
    },
  ],
  showMetrics: true,
  metricsKicker: "Metrics",
  metricsHeading: "What customers measure after switching.",
  metrics: [
    { value: "32%", label: "Lower cost per order", source: "Median, first 90 days" },
    { value: "4.1x", label: "Faster exception resolution", source: "Across active deployments" },
    { value: "99.95%", label: "Platform uptime", source: "Trailing 12 months" },
  ],
  showCriteria: true,
  criteriaKicker: "Decision criteria",
  criteriaHeading: "Your requirements, mapped line by line.",
  criteriaIntro:
    "The evaluation committee set the bar. Each criterion below is the committee's own language, with how we meet it on the record.",
  criterionHeader: "Criterion",
  requirementHeader: "What you required",
  deliveryHeader: "How we deliver",
  alternativesHeader: "Status quo / alternatives",
  showAlternatives: false,
  criteriaRows: [
    {
      criterion: "Time to value",
      requirement: "First measurable savings inside one quarter, not a year-long program.",
      delivery: "Guided 6-week implementation; first workflows live by week 3.",
      alternative: "12–18 month internal build before any savings land.",
    },
    {
      criterion: "Security & compliance",
      requirement: "SOC 2 Type II, SSO, and full audit trails before procurement sign-off.",
      delivery: "SOC 2 Type II report on file; SSO/SCIM and immutable audit logs are standard.",
      alternative: "Point tools pass partially; spreadsheets fail audit outright.",
    },
    {
      criterion: "Integration coverage",
      requirement: "Native connections to the ERP and CRM already in production.",
      delivery: "Certified connectors for your stack, plus an open API for the long tail.",
      alternative: "Custom middleware adds a second system to maintain.",
    },
    {
      criterion: "Total cost of ownership",
      requirement: "Predictable pricing with no per-seat penalty as adoption grows.",
      delivery: "Flat platform fee; unlimited seats so rollout never fights the meter.",
      alternative: "Per-seat licenses tax exactly the adoption you want.",
    },
    {
      criterion: "Support model",
      requirement: "A named team with response SLAs, not a ticket queue.",
      delivery: "Named CSM plus 1-hour P1 response, in the contract.",
      alternative: "Community forums and best-effort email.",
    },
  ],
  showEconomics: true,
  economicsKicker: "Economic case",
  economicsHeading: "The math, in one panel.",
  investmentLabel: "Investment",
  investmentItems: [
    { label: "Platform (annual)", value: "$120,000" },
    { label: "Implementation (one-time)", value: "$18,000" },
    { label: "Training & enablement", value: "Included" },
  ],
  investmentTotalLabel: "Year-one investment",
  investmentTotal: "$138,000",
  returnLabel: "Return",
  returnItems: [
    { label: "Ops hours reclaimed", value: "$210,000" },
    { label: "Error & penalty reduction", value: "$96,000" },
    { label: "Faster order-to-cash", value: "$54,000" },
  ],
  returnTotalLabel: "Year-one return",
  returnTotal: "$360,000",
  paybackLabel: "Payback",
  paybackValue: "4.6 months",
  economicsFootnote:
    "Assumes current order volume and fully-loaded labor rates supplied by your team; figures are refined during evaluation.",
  showProcess: true,
  processKicker: "Decision process",
  processHeading: "What happens next.",
  processSteps: [
    {
      label: "Evaluation",
      timeframe: "Weeks 1–2",
      description: "Working session with the committee; success criteria and data access agreed.",
    },
    {
      label: "Security review",
      timeframe: "Weeks 3–4",
      description: "SOC 2 package, DPA, and architecture review with IT and procurement.",
    },
    {
      label: "Pilot",
      timeframe: "Weeks 5–10",
      description: "Two live workflows in one region, measured against the agreed baseline.",
    },
    {
      label: "Rollout decision",
      timeframe: "Week 12",
      description: "Executive review of pilot results; contract and rollout plan on the table.",
    },
  ],
  showChampion: true,
  championKicker: "Share this brief",
  championHeading: "Forwarding this to your executive team?",
  championIntro: "Three lines that carry the whole case — paste them straight into the email.",
  takeawaysLabel: "Key takeaways — written to forward",
  takeaways: [
    "The status quo costs ~$400K a year in rework, penalties, and reconciliation.",
    "Every criterion the committee set is met, with evidence on the record.",
    "Year-one return of $360K against $138K invested — payback in under five months.",
  ],
  primaryCtaText: "Book the executive review",
  primaryCtaUrl: "#",
  secondaryCtaText: "Download as PDF",
  secondaryCtaUrl: "#",
  footerNote: "Prepared for internal evaluation. Figures refined jointly during the pilot.",
} as Record<string, unknown>;

const CHALLENGER_INSIGHT_GENERIC_PROPS = {
  kicker: "An uncomfortable truth about operations reporting",
  headline: "The way you track operations is costing you the quarter.",
  highlightPhrase: "costing you the quarter",
  subheadline:
    "Problems don't surface in the monthly review until they've already compounded. The teams that hit plan catch them in week one — everyone else finds out at the QBR.",
  heroCtaText: "See the evidence",
  heroCtaUrl: "#evidence",
  reframeEyebrow: "The reframe",
  beliefLabel: "What everyone believes",
  beliefStatement: "“Our monthly ops review keeps us on top of problems.”",
  beliefSupport: [
    "The review feels rigorous because every line item gets discussed.",
    "But a review is a rear-view mirror — it reports the damage, it doesn't prevent it.",
  ],
  realityLabel: "What the data shows",
  realityStatement:
    "Most operational losses are visible in the data weeks before anyone talks about them.",
  realitySupport: [
    "The signal exists on day one. The meeting happens on day thirty.",
    "The gap in between is where margin quietly leaves the business.",
  ],
  costEyebrow: "The cost of the status quo",
  costHeading: "While the report is being formatted, the loss is compounding.",
  costStats: [
    { value: "$1.2M", label: "Lost per year to issues caught a month late" },
    { value: "19 hrs", label: "Per manager, per month, assembling reports by hand" },
    { value: "6 wks", label: "Average lag between a margin leak and an intervention" },
  ],
  costFootnote: "Illustrative figures — replace with your own numbers.",
  tailorEyebrow: "Tailored to your team",
  tailorHeading: "What this means for you",
  stakeholders: [
    {
      label: "For Operations",
      title: "You're managing by anecdote",
      body: "By the time the dashboard is assembled, the floor has moved on. You deserve a live view of throughput — not a memorial to last month's.",
    },
    {
      label: "For Finance",
      title: "Your forecast is built on stale inputs",
      body: "Every aging data point widens the band on your forecast. Tightening the loop is the cheapest accuracy you will ever buy.",
    },
    {
      label: "For the Team",
      title: "Your best people are doing data entry",
      body: "Your sharpest operators spend their best hours copying numbers between systems. That's not a staffing problem — it's a tooling decision.",
    },
  ],
  betterWayEyebrow: "The better way",
  betterWayHeading: "Close the loop weekly, not quarterly.",
  betterWayParagraphs: [
    "The shift isn't a bigger dashboard or a longer meeting. It's moving the conversation from “what happened last month” to “what is happening right now” — and giving every owner the same live number.",
    "Teams that close the loop weekly don't work harder; they intervene earlier. A leak caught in week one is a line item. The same leak caught at the QBR is a narrative.",
    "That's the commercial insight: speed-to-signal, not depth-of-report, is what separates the operators who hit plan from the ones who explain why they didn't.",
  ],
  proofEyebrow: "Proof",
  proofHeading: "Teams who made the shift",
  testimonials: [
    {
      quote:
        "We found the first leak in eleven days. It had been sitting in the monthly deck for two quarters — labeled “variance.”",
      name: "Jordan Avery",
      title: "VP Operations, Meridian Freight",
    },
  ],
  logosLabel: "Trusted by operators at",
  logos: [
    { name: "Acme Corp" },
    { name: "Northwind" },
    { name: "Globex" },
    { name: "Vertex" },
  ],
  planEyebrow: "Take control",
  planHeading: "Here's what happens next",
  planSteps: [
    {
      title: "A 45-minute working session",
      description: "We map where decisions lag the data in your operation — no deck, no pitch.",
    },
    {
      title: "Your exposure, quantified",
      description: "You leave with a one-page estimate of what the reporting gap costs you today.",
    },
    {
      title: "A 30-day proof",
      description: "We instrument one workflow end-to-end and let the numbers argue for themselves.",
    },
  ],
  finalCtaText: "Book the working session",
  finalCtaUrl: "#contact",
  tensionLine: "Doing nothing is also a decision.",
} as Record<string, unknown>;

// ── ABM funnel-stage microsite default props ────────────────────────────────
// Mirrored from each block component's exported *_DEFAULT_PROPS. No palette keys
// (the blocks derive every color from the tenant BrandConfig), no baked logos /
// avatars, no Dandy/dental vocabulary; uses the {{company_name}} token.

const DEAL_ROOM_GENERIC_PROPS = {
  ctaText: "Book the next step",
  ctaUrl: "#close",
  ctaAction: "url",
  ctaSecondaryText: "Forward this deal room",
  ctaSecondaryUrl: "#",
  eyebrow: "Deal room for {{company_name}}",
  accountName: "Acme",
  yourName: "Your Co",
  showYourLogo: true,
  headline: "The shared path from pilot to go-live — in one place.",
  subheadline:
    "Everything your team needs to decide together: the plan, the business case, the proof, and the people. Built for this deal, kept current as we go.",
  showPlan: true,
  planKicker: "Mutual action plan",
  planHeading: "The steps to go-live — owners and dates agreed.",
  planIntro:
    "A shared plan beats a sales pitch. Here's what we move through together, who owns each step, and when it lands.",
  planSteps: [
    { title: "Discovery & alignment", owner: "Both teams", date: "Done", detail: "Success criteria, scope, and data access agreed in a working session.", status: "done" },
    { title: "Security review", owner: "Your IT + procurement", date: "This week", detail: "SOC 2 package, DPA, and architecture review with your security team.", status: "in-progress" },
    { title: "Pilot", owner: "Both teams", date: "Weeks 3–8", detail: "Two live workflows in one team, measured against the baseline we set.", status: "upcoming" },
    { title: "Executive review", owner: "Your sponsor", date: "Week 9", detail: "Pilot results to the committee; contract and rollout plan on the table.", status: "upcoming" },
    { title: "Go-live", owner: "Both teams", date: "Week 12", detail: "Full rollout with a named team and response SLAs in the contract.", status: "upcoming" },
  ],
  showCase: true,
  caseKicker: "The business case",
  caseHeading: "What this is worth to your team.",
  caseIntro:
    "Built from the numbers you shared. Totals are estimates we refine together during the pilot — not a quote.",
  investmentLabel: "Investment",
  investmentItems: [
    { label: "Platform (annual)", value: "$120,000" },
    { label: "Implementation (one-time)", value: "$18,000" },
    { label: "Training & enablement", value: "Included" },
  ],
  investmentTotalLabel: "Year-one investment",
  investmentTotal: "$138,000",
  returnLabel: "Return",
  returnItems: [
    { label: "Hours reclaimed", value: "$210,000" },
    { label: "Error & penalty reduction", value: "$96,000" },
    { label: "Faster cycle time", value: "$54,000" },
  ],
  returnTotalLabel: "Year-one return",
  returnTotal: "$360,000",
  paybackLabel: "Payback",
  paybackValue: "4.6 months",
  caseFootnote:
    "Based on current volume and the loaded labor rates your team supplied. We refine these jointly during the pilot.",
  countUpMs: 1400,
  showStakeholders: true,
  stakeholdersKicker: "Who's involved",
  stakeholdersHeading: "What each person gets out of this.",
  stakeholdersIntro:
    "A deal moves when everyone sees their own win. Here's the value for each role at the table.",
  stakeholders: [
    { role: "Champion", gets: "A plan that runs itself and a partner who keeps the deal moving — not more work." },
    { role: "Economic buyer", gets: "Payback inside five months and a return that clears the bar, with the math on the record." },
    { role: "Technical lead", gets: "SOC 2, SSO/SCIM, native integrations, and an open API — reviewed before sign-off." },
    { role: "End users", gets: "Hours back every week and an end to the rework, with a guided rollout that doesn't disrupt." },
  ],
  showProof: true,
  proofKicker: "Proof for this buyer",
  proofHeading: "Teams like yours, already there.",
  caseStudies: [
    { name: "Northwind", result: "34% lower cost per order within 90 days", quote: "We expected a six-month slog. We were measuring savings by week four, and the rollout never fought our team.", attribution: "VP Operations, Northwind" },
    { name: "Vertex Logistics", result: "4.1× faster exception resolution", quote: "Escalations used to disappear into shared inboxes. Now every one has an owner and a clock.", attribution: "Director of Support, Vertex Logistics" },
  ],
  logoWallLabel: "In good company",
  logos: [
    { name: "Acme Corp" }, { name: "Northwind" }, { name: "Globex" }, { name: "Initech" }, { name: "Vertex" },
  ],
  showResources: true,
  resourcesKicker: "Resources",
  resourcesHeading: "The docs your team will ask for.",
  resources: [
    { title: "Security & compliance overview", type: "PDF · Security", url: "#" },
    { title: "Pricing & packaging", type: "PDF · Pricing", url: "#" },
    { title: "Implementation plan", type: "PDF · Onboarding", url: "#" },
  ],
  showFaq: true,
  faqKicker: "Objection handling",
  faqHeading: "The questions your team will raise.",
  faqs: [
    { question: "How long until we see value?", answer: "First workflows go live in week three of the pilot, and most teams measure savings inside the first 90 days." },
    { question: "What does this ask of our IT team?", answer: "A security review and SSO setup — that's it. Native connectors cover your stack, with an open API for the long tail." },
    { question: "What happens if the pilot doesn't hit the bar?", answer: "We set the success criteria together up front. If the pilot misses them, you walk — no contract, no commitment." },
    { question: "How is pricing structured as we grow?", answer: "A flat platform fee with unlimited seats, so rollout never fights the meter. No per-seat penalty for the adoption you want." },
  ],
  showClose: true,
  closeKicker: "Next step",
  closeHeading: "Ready to move? Let's book it.",
  closeIntro:
    "Pick a time that works for your team and we'll walk the plan together. Bring whoever needs to be in the room.",
  footerNote: "Shared for internal review. Figures and dates refined jointly as we go.",
} as Record<string, unknown>;

const ACCOUNT_MICROSITE_GENERIC_PROPS = {
  ctaText: "Book a working session",
  ctaUrl: "#close",
  ctaAction: "url",
  ctaSecondaryText: "Forward to your team",
  ctaSecondaryUrl: "#",
  heroLayout: "split",
  showNavbar: true,
  heroImageUrl:
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1100&h=900&fit=crop",
  heroImageAlt: "Two teams aligning on a shared plan",
  navLinks: [
    { label: "Why now", href: "#why" },
    { label: "The approach", href: "#approach" },
    { label: "Next step", href: "#close" },
  ],
  navCtaText: "Book a working session",
  navCtaUrl: "#close",
  eyebrow: "Prepared for {{company_name}}",
  accountName: "Acme",
  yourName: "Your Co",
  showYourLogo: true,
  headline: "A plan built around where your team is headed.",
  subheadline:
    "We pulled together what we know about your goals, the approach we'd recommend, and the proof it works — so your team can decide together, fast.",
  showBrief: true,
  briefHeading: "What we know about you",
  briefItems: [
    { label: "Industry", value: "Operations & service" },
    { label: "Size", value: "Growing team" },
    { label: "Focus", value: "Reducing manual work" },
    { label: "Timeline", value: "This quarter" },
  ],
  showWhy: true,
  whyKicker: "Why this matters now",
  whyHeading: "The window to move is open.",
  whyIntro:
    "Three things make this the right quarter to act, based on what your team has shared and where the market is heading.",
  reasons: [
    { title: "Costs keep climbing", detail: "Every quarter of manual work compounds — the savings start the moment you switch." },
    { title: "Your team is ready", detail: "You already have the process; this removes the friction without a disruptive rollout." },
    { title: "A clear runway", detail: "Start small this quarter and scale on results, not on a leap of faith." },
  ],
  showApproach: true,
  approachKicker: "Recommended approach",
  approachHeading: "How we'd get you there.",
  approachIntro:
    "A staged path that proves value early and scales on results — no big-bang rollout.",
  phases: [
    { title: "Align on outcomes", timeframe: "Weeks 1–2", detail: "Agree the success criteria and the one workflow we prove first." },
    { title: "Run a focused pilot", timeframe: "Weeks 3–6", detail: "Go live with one team, measured against the baseline we set together." },
    { title: "Review & expand", timeframe: "Weeks 7–8", detail: "Take the results to your sponsor and plan the rollout that fits." },
  ],
  showUseCases: true,
  useCasesKicker: "Where it fits",
  useCasesHeading: "The use cases that match your team.",
  useCasesIntro:
    "The places we'd expect the biggest, fastest wins for an organization like yours.",
  useCases: [
    { title: "Faster order entry", detail: "Replace the manual steps that slow your team down every single day.", metric: "Hours back / week" },
    { title: "Fewer errors", detail: "Catch issues before they cost you, with checks built into the flow.", metric: "Lower rework" },
    { title: "Clear visibility", detail: "Everyone sees status in one place, so nothing slips between teams.", metric: "One source of truth" },
  ],
  showPersona: true,
  personaKicker: "Value for your team",
  personaHeading: "What each person gets out of this.",
  personaIntro:
    "A decision moves when everyone sees their own win. Here's the value by role.",
  personaValues: [
    { role: "Economic buyer", gets: "Payback inside the year and a return that clears the bar, with the math on the record." },
    { role: "Technical lead", gets: "Security, SSO, and native integrations — reviewed before sign-off." },
    { role: "End users", gets: "Hours back every week and an end to the rework, with a guided rollout." },
  ],
  showProof: true,
  proofKicker: "Proof for this buyer",
  proofHeading: "Teams like yours, already there.",
  caseStudies: [
    { name: "Northwind", result: "34% lower cost per order within 90 days", quote: "We expected a six-month slog. We were measuring savings by week four, and the rollout never fought our team.", attribution: "VP Operations, Northwind" },
    { name: "Vertex Logistics", result: "4.1× faster exception resolution", quote: "Escalations used to disappear into shared inboxes. Now every one has an owner and a clock.", attribution: "Director of Support, Vertex Logistics" },
  ],
  logoWallLabel: "In good company",
  logos: [
    { name: "Acme Corp" }, { name: "Northwind" }, { name: "Globex" }, { name: "Initech" }, { name: "Vertex" },
  ],
  showResources: true,
  resourcesKicker: "Recommended resources",
  resourcesHeading: "The docs your team will ask for.",
  resources: [
    { title: "Security & compliance overview", type: "PDF · Security", url: "#" },
    { title: "Pricing & packaging", type: "PDF · Pricing", url: "#" },
    { title: "Implementation plan", type: "PDF · Onboarding", url: "#" },
  ],
  showPlan: true,
  planKicker: "Mutual action plan",
  planHeading: "The steps to a decision — owners and dates.",
  planIntro:
    "A shared plan beats a sales pitch. Here's what we move through together, who owns each step, and when it lands.",
  planSteps: [
    { title: "Discovery & alignment", owner: "Both teams", date: "Done", detail: "Success criteria and scope agreed in a working session.", status: "done" },
    { title: "Security review", owner: "Your IT", date: "This week", detail: "Security package and architecture review with your team.", status: "in-progress" },
    { title: "Pilot", owner: "Both teams", date: "Weeks 3–6", detail: "One live workflow, measured against the baseline we set.", status: "upcoming" },
    { title: "Executive review", owner: "Your sponsor", date: "Week 7", detail: "Pilot results to the committee; rollout plan on the table.", status: "upcoming" },
  ],
  showTeam: true,
  teamKicker: "Your team",
  teamHeading: "The people behind this — start to finish.",
  teamIntro:
    "You're not handed off to a queue. Here's who you'll work with and how to reach them.",
  teamMembers: [
    { name: "Your account executive", role: "Your main point of contact", note: "Owns the plan with you." },
    { name: "Solutions engineer", role: "Technical partner", note: "Handles the security review and setup." },
    { name: "Customer success", role: "Onboarding lead", note: "Gets your team live and measuring." },
  ],
  showClose: true,
  closeKicker: "Next step",
  closeHeading: "Ready to move? Let's book it.",
  closeIntro:
    "Pick a time that works for your team and we'll walk the plan together. Bring whoever needs to be in the room.",
  footerNote: "Prepared for your team's internal review. Details refined together as we go.",
} as Record<string, unknown>;

const ONBOARDING_HUB_GENERIC_PROPS = {
  ctaText: "Book your kickoff call",
  ctaUrl: "#support",
  ctaAction: "url",
  ctaSecondaryText: "Jump to your checklist",
  ctaSecondaryUrl: "#checklist",
  eyebrow: "Welcome to {{company_name}}",
  accountName: "Acme",
  headline: "Welcome, Acme. Here's your path to your first win.",
  subheadline:
    "Everything you need to get started, in one place: your plan, your team, your first actions, and the outcomes we're aiming for together. We'll move at your pace.",
  showLogo: true,
  showPlan: true,
  planKicker: "Your onboarding plan",
  planHeading: "Four phases, from kickoff to full rollout.",
  planIntro:
    "A clear plan beats a pile of to-dos. Here's what we move through together, who leads each phase, and roughly when it lands.",
  phases: [
    { title: "Kickoff", owner: "You + your CSM", timeframe: "Week 1", detail: "We meet your team, confirm goals, and agree what a first win looks like.", status: "done" },
    { title: "Setup", owner: "You + implementation", timeframe: "Weeks 1–2", detail: "Connect your tools, invite your team, and configure the basics together.", status: "in-progress" },
    { title: "First value", owner: "Both teams", timeframe: "Weeks 2–4", detail: "Run your first real workflow and see the first measurable result.", status: "upcoming" },
    { title: "Full rollout", owner: "Both teams", timeframe: "Weeks 4–8", detail: "Roll out to the wider team with a named contact and a regular check-in.", status: "upcoming" },
  ],
  showTeam: true,
  teamKicker: "Your team",
  teamHeading: "The people in your corner.",
  teamIntro:
    "You're not doing this alone. Here's who to reach, and what each of us is here to help with.",
  contacts: [
    { name: "Dana Ruiz", role: "Customer Success Manager", blurb: "Your main point of contact — goals, check-ins, and anything that's blocking you.", email: "dana@example.com" },
    { name: "Marcus Lee", role: "Implementation Specialist", blurb: "Hands-on setup, integrations, and getting your data flowing cleanly.", email: "marcus@example.com" },
    { name: "Priya Shah", role: "Support Lead", blurb: "Quick answers when you need them, with a one-hour response on anything urgent.", email: "support@example.com" },
  ],
  showChecklist: true,
  checklistKicker: "Getting started",
  checklistHeading: "Your first few actions.",
  checklistIntro:
    "Knock these out in your first week and you'll be set up for that first win. None of them take long.",
  checklist: [
    { label: "Complete your kickoff call", hint: "30 minutes with your CSM to confirm goals.", done: true },
    { label: "Invite your team", hint: "Add the people who'll use this day to day." },
    { label: "Connect your first integration", hint: "Link the tool you'll use most so data flows in." },
    { label: "Set up your first workflow", hint: "Start with one real use case, not all of them." },
    { label: "Review your success metrics", hint: "Agree what we'll measure so progress is clear." },
  ],
  showResources: true,
  resourcesKicker: "Resources & training",
  resourcesHeading: "Everything you'll want to reference.",
  resourceGroups: [
    { heading: "Set up", resources: [
      { title: "Quick-start guide", meta: "5 min read", url: "#", kind: "guide" },
      { title: "Connecting your integrations", meta: "Doc", url: "#", kind: "doc" },
      { title: "Setup walkthrough", meta: "Video · 6 min", url: "#", kind: "video" },
    ] },
    { heading: "Train your team", resources: [
      { title: "Admin basics", meta: "Video · 8 min", url: "#", kind: "video" },
      { title: "Inviting and managing users", meta: "Doc", url: "#", kind: "doc" },
      { title: "Power-user playbook", meta: "10 min read", url: "#", kind: "guide" },
    ] },
  ],
  showSuccess: true,
  successKicker: "What success looks like",
  successHeading: "The outcomes we're aiming for together.",
  successIntro:
    "These are the markers we'll watch over your first 90 days, so we both know it's working — and where to help.",
  metrics: [
    { value: "30 days", label: "To your first measurable win", source: "Typical for teams your size" },
    { value: "90%", label: "Of your team active in month one", source: "Our onboarding benchmark" },
    { value: "3x", label: "Faster than setting up alone", source: "Vs. self-serve, on average" },
  ],
  countUpMs: 1400,
  showSupport: true,
  supportKicker: "Support & next check-in",
  supportHeading: "We're here whenever you need us.",
  supportIntro:
    "Stuck on something or ready to go deeper? Book your next review and we'll walk it through together. Bring whoever's working alongside you.",
  footerNote: "Your onboarding plan stays current here — we'll keep it updated as we go.",
} as Record<string, unknown>;

const VALUE_RENEWAL_REVIEW_GENERIC_PROPS = {
  ctaText: "Book your renewal conversation",
  ctaUrl: "#close",
  ctaAction: "url",
  ctaSecondaryText: "See what's next",
  ctaSecondaryUrl: "#expansion",
  eyebrow: "Value review for {{company_name}}",
  accountName: "Acme",
  yourName: "Your Co",
  headline: "Acme: your year with Your Co.",
  subheadline:
    "A year in, the numbers are clear: faster work, fewer errors, and a team that's all-in. Here's what we delivered together — and where we go next.",
  showLogo: true,
  metaLine: "Annual review · 2026",
  showValue: true,
  valueKicker: "Value delivered",
  valueHeading: "What this term was worth.",
  valueIntro:
    "The results your team realized over the last twelve months, measured against the baseline we set together.",
  metrics: [
    { value: "32%", label: "Lower cost per order", source: "vs. last term" },
    { value: "$1.4M", label: "Realized return this term", source: "Net of platform cost" },
    { value: "4.1x", label: "Faster exception resolution", source: "Across your workflows" },
    { value: "94%", label: "Team active monthly", source: "Up from 61% at start" },
  ],
  countUpMs: 1400,
  showUsage: true,
  usageKicker: "Usage & adoption",
  usageHeading: "Momentum built over the year.",
  usageIntro:
    "Adoption didn't spike and fade — it compounded. Here are the milestones your team hit, in order.",
  milestones: [
    { title: "Rolled out to all regions", when: "Q1", detail: "From one pilot team to the full org in under a quarter." },
    { title: "Automated the top three workflows", when: "Q2", detail: "The manual rework that used to fill mornings, gone." },
    { title: "Hit 90% monthly active", when: "Q3", detail: "Daily use became the default, not the exception." },
    { title: "Launched executive reporting", when: "Q4", detail: "Leadership now sees the numbers without asking." },
  ],
  productUrlLabel: "app.yourco.com",
  showWins: true,
  winsKicker: "In their words",
  winsHeading: "What your team is saying.",
  wins: [
    { quote: "We expected a tool. We got a step-change in how the team works — and the rollout never fought us.", attribution: "VP Operations, your team" },
    { quote: "The escalations that used to disappear now have an owner and a clock. That alone paid for the year.", attribution: "Director of Support, your team" },
  ],
  showExpansion: true,
  expansionKicker: "What's next",
  expansionHeading: "Your roadmap for the year ahead.",
  expansionIntro:
    "Not an upsell — the next steps that build on what's already working. Pick what fits; we'll pace it with you.",
  expansionItems: [
    { title: "Advanced analytics", detail: "Turn the data you're already capturing into the forecasting your leadership keeps asking for.", tag: "Most-requested" },
    { title: "Twenty more seats", detail: "Extend to the two teams on the waitlist, at the same flat rate — no per-seat penalty.", tag: "Ready now" },
    { title: "A second use case", detail: "Apply the same playbook to procurement, where the manual load looks a lot like where you started.", tag: "Next quarter" },
  ],
  showRenewal: true,
  renewalKicker: "The renewal",
  renewalHeading: "Keep it going — same terms, no surprises.",
  renewalIntro:
    "Here's the renewal at a glance. Nothing changes unless you want it to, and expansion can fold in whenever you're ready.",
  termRows: [
    { label: "Plan", value: "Enterprise" },
    { label: "Seats", value: "150 included" },
    { label: "Term", value: "12 months" },
    { label: "Renewal price", value: "No increase" },
  ],
  renewalNote: "One click to confirm, or bring questions to the call — whichever you prefer.",
  showClose: true,
  closeKicker: "Next steps",
  closeHeading: "Let's talk through the year ahead.",
  closeIntro:
    "Book a time and we'll walk the renewal and the roadmap together. Bring whoever owns the relationship on your side.",
  footerNote: "Prepared for your team. Figures reflect your account data as of this review.",
} as Record<string, unknown>;

const BUSINESS_CASE_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: "global-business-case-split",
    title: "Business Case — Split",
    templateLabel: "Business Case — Split",
    templateDescription:
      "DSO microsite, split-hero layout. Dark left column with the offer, portrait photo on the right, then situation → signal → cost → shift → math → proof → plan → CTA. Built for consultative enterprise sales.",
    ogImage: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200&q=80",
    industry: "dental",
    premiumRank: 26,
    category: "business-case",
    keywords: ["business case", "exec brief", "executive summary",
      "ROI case", "enterprise pitch", "consultative sales", "deal microsite",
      "1:1 sales page", "buyer brief"],
    isAllInOne: true,
    blocks: [
      {
        id: "seed-business-case-split-1",
        type: "business-case-split",
        props: BUSINESS_CASE_SPLIT_PROPS,
      },
    ],
  },
  {
    slug: "global-business-case-centered",
    title: "Business Case — Centered",
    templateLabel: "Business Case — Centered",
    templateDescription:
      "DSO microsite, centered-hero layout. Symmetric dark hero band, full-width comparison table for the paradigm shift, large KPI row for the math. Best when the executive narrative leads the page.",
    ogImage: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80",
    industry: "dental",
    premiumRank: 27,
    category: "business-case",
    keywords: ["business case", "ROI case", "exec narrative",
      "comparison case", "paradigm shift", "KPI case", "centered case"],
    isAllInOne: true,
    blocks: [
      {
        id: "seed-business-case-centered-1",
        type: "business-case-centered",
        props: BUSINESS_CASE_CENTERED_PROPS,
      },
    ],
  },
  {
    slug: "global-business-case-premium-editorial",
    title: "Business Case — Premium Editorial",
    templateLabel: "Business Case — Premium Editorial",
    templateDescription:
      "Centered editorial business case tuned to organic-demand stories — inbound interest, clinical case grid, operational layer, insights comparison, math, proof, plan, and CTA. Modeled on the PDS-style 'why doctors keep finding Dandy' narrative.",
    ogImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80",
    industry: "dental",
    premiumRank: 28,
    category: "business-case",
    keywords: ["business case", "editorial case", "inbound narrative",
      "story-led case", "exec briefing", "story-driven case"],
    isAllInOne: true,
    blocks: [
      {
        id: "seed-business-case-premium-1",
        type: "business-case-premium",
        props: BUSINESS_CASE_PREMIUM_PROPS,
      },
    ],
  },
  // ── Brand-neutral siblings (industry: null = universal). Ranks 29-31 sit
  //    directly beneath the dental originals (26-28) in "Featured".
  {
    slug: "global-business-case-split-generic",
    title: "Executive Brief — Split",
    templateLabel: "Executive Brief — Split",
    templateDescription:
      "Industry-neutral business-case microsite, split-hero layout. Dark left column with the offer, photo on the right, then situation → signal → cost → shift → math → proof → plan → CTA. Inherits the tenant brand's colors and logo, so it works for any consultative enterprise sale.",
    ogImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80",
    industry: null,
    premiumRank: 29,
    category: "business-case",
    keywords: ["business case", "exec brief", "executive brief", "executive summary",
      "ROI case", "enterprise pitch", "consultative sales", "deal microsite",
      "1:1 sales page", "buyer brief"],
    isAllInOne: true,
    blocks: [
      {
        id: "seed-business-case-split-generic-1",
        type: "business-case-split",
        props: BUSINESS_CASE_SPLIT_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-business-case-centered-generic",
    title: "Executive Brief — Centered",
    templateLabel: "Executive Brief — Centered",
    templateDescription:
      "Industry-neutral business-case microsite, centered-hero layout. Symmetric dark hero band, full-width comparison table for the paradigm shift, large KPI row for the math. Inherits the tenant brand's colors and logo — best when the executive narrative leads the page.",
    ogImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80",
    industry: null,
    premiumRank: 30,
    category: "business-case",
    keywords: ["business case", "executive brief", "ROI case", "exec narrative",
      "comparison case", "paradigm shift", "KPI case", "centered case"],
    isAllInOne: true,
    blocks: [
      {
        id: "seed-business-case-centered-generic-1",
        type: "business-case-centered",
        props: BUSINESS_CASE_CENTERED_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-business-case-premium-editorial-generic",
    title: "Executive Brief — Premium Editorial",
    templateLabel: "Executive Brief — Premium Editorial",
    templateDescription:
      "Industry-neutral editorial business case tuned to organic-demand stories — inbound interest, operating-case grid, operational layer, insights comparison, math, proof, plan, and CTA. Inherits the tenant brand's colors and logo for any 'your teams keep finding us' narrative.",
    ogImage: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80",
    industry: null,
    premiumRank: 31,
    category: "business-case",
    keywords: ["business case", "executive brief", "editorial case", "inbound narrative",
      "story-led case", "exec briefing", "story-driven case"],
    isAllInOne: true,
    blocks: [
      {
        id: "seed-business-case-premium-generic-1",
        type: "business-case-premium",
        props: BUSINESS_CASE_PREMIUM_GENERIC_PROPS,
      },
    ],
  },
  // ── Sales-narrative monographs (June 2026). Industry-neutral full-page
  //    templates that inherit the tenant brand. Each is a single self-styled
  //    block carrying its own neutral component defaults (no Dandy palette,
  //    no logos/testimonials baked in). Ranks 32-34 sit beneath the
  //    business-case generics.
  {
    slug: "global-storybrand-journey",
    title: "StoryBrand Journey",
    templateLabel: "StoryBrand Journey",
    templateDescription:
      "Warm editorial full-page narrative that walks the StoryBrand SB7 BrandScript — a character with a problem, a guide, a plan, and a call to action — from hero through stakes, guide, plan, success, and finale. Inherits the tenant brand's colors and logo for any customer-journey story.",
    ogImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
    industry: null,
    premiumRank: 32,
    category: "business-case",
    keywords: ["business case", "executive brief", "storybrand", "story brand",
      "brandscript", "customer journey", "sb7", "narrative landing", "donald miller"],
    isAllInOne: true,
    funnelStage: "first-meeting",
    blocks: [
      {
        id: "seed-storybrand-journey-1",
        type: "storybrand-journey",
        props: STORYBRAND_JOURNEY_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-exec-decision-brief",
    title: "Exec Decision Brief",
    templateLabel: "Exec Decision Brief",
    templateDescription:
      "Data-dense boardroom one-pager a champion forwards to the economic buyer: identified pain with cost-if-unresolved, count-up proof metrics, a MEDDIC decision-criteria table, the economic case with payback, the decision process, and forward-ready takeaways. Inherits the tenant brand's colors and logo.",
    ogImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80",
    industry: null,
    premiumRank: 33,
    category: "business-case",
    keywords: ["business case", "executive brief", "meddic", "meddpicc",
      "decision brief", "economic buyer", "champion", "decision criteria", "ROI case"],
    isAllInOne: true,
    funnelStage: "first-meeting",
    // Persona-specific: the boardroom decision brief is for the economic
    // buyer / executive. Segment + funnel stage left wildcard (any segment, and
    // eligibleFunnelStages defaults to [funnelStage] at backfill).
    eligiblePersonas: ["executive", "economic buyer", "cfo", "ceo", "chief", "vp", "owner"],
    blocks: [
      {
        id: "seed-exec-decision-brief-1",
        type: "exec-decision-brief",
        props: EXEC_DECISION_BRIEF_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-challenger-insight",
    title: "Challenger Insight",
    templateLabel: "Challenger Insight",
    templateDescription:
      "Bold dark Challenger-sale brief — Teach, Tailor, Take Control. A provocative reframe headline, the belief-vs-data contrast, count-up cost-of-status-quo stats, stakeholder implications, the pivot to the better way, proof, and a constructive-tension close. Inherits the tenant brand's colors and logo.",
    ogImage: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&q=80",
    industry: null,
    premiumRank: 34,
    category: "business-case",
    keywords: ["business case", "executive brief", "challenger", "challenger sale",
      "commercial insight", "reframe", "status quo", "constructive tension", "teach tailor take control"],
    isAllInOne: true,
    funnelStage: "first-meeting",
    blocks: [
      {
        id: "seed-challenger-insight-1",
        type: "challenger-insight",
        props: CHALLENGER_INSIGHT_GENERIC_PROPS,
      },
    ],
  },
  // ── ABM funnel-stage microsite all-in-ones (June 2026) ─────────────────────
  //    Single-block ABM microsites grouped by sales intent in the create-
  //    microsite modal (funnelStage). Like the framework templates above they
  //    are isAllInOne + category "business-case" + industry null and enter the
  //    intent selector's candidate set via their keywords.
  {
    slug: "global-deal-room",
    title: "Deal Room",
    templateLabel: "Deal Room",
    templateDescription:
      "ABM deal-acceleration microsite a rep shares with a buying committee: a personalized co-brand hero, a mutual action plan timeline, the business case with a count-up payback, a stakeholder map, proof and a logo wall, resource docs, an objection-handling FAQ, and a scheduling close. Inherits the tenant brand's colors and logo.",
    ogImage: "https://images.unsplash.com/photo-1664575602554-2087b04935a5?w=1200&q=80",
    industry: null,
    premiumRank: 35,
    category: "business-case",
    keywords: ["deal room", "mutual action plan", "business case", "deal",
      "champion", "next steps", "ABM", "buying committee", "deal acceleration"],
    isAllInOne: true,
    funnelStage: "deal-acceleration",
    blocks: [
      {
        id: "seed-deal-room-1",
        type: "deal-room",
        props: DEAL_ROOM_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-account-microsite",
    title: "1:1 Account Microsite",
    templateLabel: "1:1 Account Microsite",
    templateDescription:
      "A premium, buyer-facing strategy story a rep generates for one target account: a personalized co-brand hero, a short brief of what we know about them, why-now reasons, the recommended approach, matching use cases, value by role, proof and a logo wall, recommended resources, a mutual action plan, the people on your team, and a scheduling close. Personalized behind the scenes — no visible controls. Inherits the tenant brand's colors and logo.",
    ogImage: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80",
    industry: null,
    premiumRank: 34,
    category: "business-case",
    keywords: ["account microsite", "1:1", "ABM", "target account",
      "strategy story", "personalized", "account based", "first meeting",
      "buyer", "outreach"],
    isAllInOne: true,
    funnelStage: "first-meeting",
    blocks: [
      {
        id: "seed-account-microsite-1",
        type: "account-microsite",
        props: ACCOUNT_MICROSITE_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-onboarding-hub",
    title: "Onboarding Hub",
    templateLabel: "Onboarding Hub",
    templateDescription:
      "ABM new-customer onboarding hub: a warm welcome hero, an onboarding phases timeline, your implementation contacts, a getting-started checklist, a resource library, success metrics, and a kickoff-scheduling close. Inherits the tenant brand's colors and logo.",
    ogImage: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&q=80",
    industry: null,
    premiumRank: 36,
    category: "business-case",
    keywords: ["onboarding", "welcome", "kickoff", "getting started",
      "new customer", "implementation", "onboarding hub", "ABM"],
    isAllInOne: true,
    funnelStage: "onboarding",
    blocks: [
      {
        id: "seed-onboarding-hub-1",
        type: "onboarding-hub",
        props: ONBOARDING_HUB_GENERIC_PROPS,
      },
    ],
  },
  {
    slug: "global-value-renewal-review",
    title: "Value & Renewal Review",
    templateLabel: "Value & Renewal Review",
    templateDescription:
      "ABM expansion/renewal QBR readout a rep shares ahead of a quarterly business review: a value-recap hero, count-up results metrics, wins delivered, a roadmap of milestones, expansion opportunities, renewal terms, and a renewal-scheduling close. Inherits the tenant brand's colors and logo.",
    ogImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
    industry: null,
    premiumRank: 37,
    category: "business-case",
    keywords: ["renewal", "QBR", "expansion", "value review", "upsell",
      "quarterly business review", "value & renewal", "ABM"],
    isAllInOne: true,
    funnelStage: "expansion-renewal",
    // Stage-specific: fits both the expansion-renewal motion and a bare
    // "renewal" stage label. Segment + persona left wildcard (any).
    eligibleFunnelStages: ["expansion-renewal", "renewal"],
    blocks: [
      {
        id: "seed-value-renewal-review-1",
        type: "value-renewal-review",
        props: VALUE_RENEWAL_REVIEW_GENERIC_PROPS,
      },
    ],
  },
];

const COMBINED: GlobalTemplateSeed[] = [
  ...FLAGSHIP_TEMPLATE_SEEDS,
  ...DISTINCTIVE_TEMPLATE_SEEDS,
  ...TEMPLATE_PAGE_SEEDS,
  ...SHOWCASE_TEMPLATE_SEEDS,
  ...BUSINESS_CASE_TEMPLATE_SEEDS,
  ...GENERIC_TEMPLATE_SEEDS,
  ...INDUSTRY_TEMPLATE_SEEDS_RANKED,
];

export const GLOBAL_TEMPLATE_SEEDS: GlobalTemplateSeed[] = COMBINED.map((t) => ({
  ...t,
  premiumRank: t.premiumRank ?? defaultPremiumRank(t.slug),
}));

/** Lookup table the API uses to expose the seed's premiumRank to the
 *  marketplace UI without adding a DB column. */
export const PREMIUM_RANK_BY_SLUG: Record<string, number> = Object.fromEntries(
  GLOBAL_TEMPLATE_SEEDS.map((t) => [t.slug, t.premiumRank ?? defaultPremiumRank(t.slug)]),
);

/** All-in-one templates (June 2026) — the subset whose category/keywords/
 *  isAllInOne intent fields are backfilled onto lp_pages by the
 *  global_templates_intent_v1 step in migrate.ts, and the only templates
 *  the generation route's intent selector may pick. */
export const ALL_IN_ONE_TEMPLATE_SEEDS: GlobalTemplateSeed[] =
  GLOBAL_TEMPLATE_SEEDS.filter((t) => t.isAllInOne === true);

/** Template eligibility (June 2026). The resolved eligibility constraints the
 *  global_templates_eligibility_v1 backfill in migrate.ts writes onto lp_pages.
 *  Only templates that DECLARE something (a primary funnelStage or any explicit
 *  eligible* axis) are included — a fully-undeclared template stays wildcard
 *  (eligible everywhere), so it needs no row written. `eligibleFunnelStages`
 *  defaults to [funnelStage] when only the singular primary is known, matching
 *  the engine's effectiveEligibleFunnelStages(). */
export interface TemplateEligibilitySeed {
  slug: string;
  funnelStage: string | null;
  eligibleSegments: string[] | null;
  eligiblePersonas: string[] | null;
  eligibleFunnelStages: string[] | null;
}

export const TEMPLATE_ELIGIBILITY_SEEDS: TemplateEligibilitySeed[] = GLOBAL_TEMPLATE_SEEDS
  .filter(
    (t) =>
      t.funnelStage ||
      (t.eligibleSegments && t.eligibleSegments.length > 0) ||
      (t.eligiblePersonas && t.eligiblePersonas.length > 0) ||
      (t.eligibleFunnelStages && t.eligibleFunnelStages.length > 0),
  )
  .map((t) => ({
    slug: t.slug,
    funnelStage: t.funnelStage ?? null,
    eligibleSegments: t.eligibleSegments && t.eligibleSegments.length > 0 ? t.eligibleSegments : null,
    eligiblePersonas: t.eligiblePersonas && t.eligiblePersonas.length > 0 ? t.eligiblePersonas : null,
    // Default the allowed-set to [funnelStage] when only the primary is known.
    eligibleFunnelStages:
      t.eligibleFunnelStages && t.eligibleFunnelStages.length > 0
        ? t.eligibleFunnelStages
        : t.funnelStage
          ? [t.funnelStage]
          : null,
  }));
