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
  industry: "dental" | "generic" | null;
  blocks: { id: string; type: string; props: Record<string, unknown> }[];
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
];

export const GLOBAL_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  ...GENERIC_TEMPLATE_SEEDS,
  ...INDUSTRY_TEMPLATE_SEEDS,
];
