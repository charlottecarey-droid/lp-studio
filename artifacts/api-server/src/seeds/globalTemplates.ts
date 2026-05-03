// Idempotent seed for global landing-page templates that any tenant in the
// matching industry can clone from.
//
// These rows live in `lp_pages` with is_template=true and is_global=true. The
// owning tenant_id is irrelevant for visibility (the GET /lp/templates filter
// pulls all globals regardless of owner) but the FK still has to point at a
// real tenant row, so we own these under the lowest-id tenant by default.
//
// Block JSON shapes match the props expected by `BlockRenderer` and the
// per-type defaults in `BLOCK_REGISTRY`. Anything missing falls back to those
// defaults inside the renderer / builder.

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

// Default premiumRank applied when a seed doesn't carry one explicitly. Slug
// prefix drives the bucket so the marketplace can present a stable
// Featured / Premium / Industry order without a DB column migration:
//   `global-flagship-*` → 1-10 (set explicitly in the flagship file)
//   `global-distinctive-*` → 20  (the older "premium" templates)
//   `global-*` (other)     → 50  (generic starters)
//   `ind-*`                → 100 (industry starters, pushed to bottom)
function defaultPremiumRank(slug: string): number {
  if (slug.startsWith("global-flagship-")) return 5;
  if (slug.startsWith("global-distinctive-")) return 20;
  if (slug.startsWith("global-")) return 50;
  if (slug.startsWith("ind-")) return 100;
  return 200;
}

const COMBINED: GlobalTemplateSeed[] = [
  ...FLAGSHIP_TEMPLATE_SEEDS,
  ...DISTINCTIVE_TEMPLATE_SEEDS,
  ...GENERIC_TEMPLATE_SEEDS,
  ...INDUSTRY_TEMPLATE_SEEDS,
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
