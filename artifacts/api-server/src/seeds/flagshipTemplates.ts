// Premium flagship templates — task #125. Eight named, opinionated, modern
// landing-page recipes built on the existing "premium" block library plus the
// four new category-specific blocks (menu-section, hours-location,
// before-after-gallery, speaker-grid). Each template uses an Apple-style
// minimal aesthetic and ships with realistic, scannable copy.
//
// Slug convention: `global-flagship-<kind>`. The `premiumRank` field controls
// marketplace ordering (lower = higher).

import type { GlobalTemplateSeed } from "./globalTemplates";

const id = (type: string, n: number) => `flag-${type}-${n}`;

// ──────────────────────────────────────────────────────────────────────────
// 1. AI Product Launch
// ──────────────────────────────────────────────────────────────────────────
const aiProductLaunch: GlobalTemplateSeed = {
  slug: "global-flagship-ai-product-launch",
  title: "AI Product Launch",
  templateLabel: "AI Product Launch",
  templateDescription:
    "A confident, modern launch page for an AI product — bold magazine hero, animated bento showcase of capabilities, and conversion-focused gradient pricing.",
  ogImage: "",
  industry: "saas",
  premiumRank: 1,
  blocks: [
    {
      id: id("magazine-hero", 1),
      type: "magazine-hero",
      props: {
        eyebrow: "Now in beta",
        headline: "The AI partner that thinks alongside you.",
        subheadline:
          "Vela is a workspace-native model trained on your team's docs, decisions, and history. Less prompting. More work shipped.",
        ctaText: "Request access",
        ctaUrl: "#access",
        secondaryCtaText: "Watch the demo",
        secondaryCtaUrl: "#demo",
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: "#7B5BFF",
      },
    },
    {
      id: id("trust-bar", 2),
      type: "trust-bar",
      props: {
        items: [
          { value: "1.4M", label: "tasks completed" },
          { value: "40%", label: "faster shipping" },
          { value: "99.9%", label: "uptime" },
          { value: "SOC 2", label: "Type II certified" },
        ],
      },
    },
    {
      id: id("bento-showcase", 3),
      type: "bento-showcase",
      props: {
        eyebrow: "Capabilities",
        headline: "Built for the way real teams build.",
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: "#7B5BFF",
        tiles: [
          { kind: "headline", size: "lg", headline: "Reads your codebase. Writes the PR.", body: "Auto-drafts pull requests with reasoning, tests, and changelog notes." },
          { kind: "stat", size: "md", stat: "12x", statLabel: "Faster ticket triage" },
          { kind: "headline", size: "md", headline: "Always-on context", body: "Knows your decisions, your stack, your conventions." },
          { kind: "headline", size: "sm", headline: "Native integrations", body: "Slack, Linear, Notion, GitHub." },
          { kind: "headline", size: "sm", headline: "On-prem option", body: "VPC deploy. Your weights, your keys." },
        ],
      },
    },
    {
      id: id("editorial-carousel", 4),
      type: "editorial-carousel",
      props: {
        eyebrow: "In production at",
        headline: "Trusted by teams who ship every day.",
        slides: [
          { src: "", alt: "Customer 1", caption: "Northwind / Engineering" },
          { src: "", alt: "Customer 2", caption: "Latticework / Product" },
          { src: "", alt: "Customer 3", caption: "Veridian / Platform" },
          { src: "", alt: "Customer 4", caption: "Atlas Robotics / R&D" },
        ],
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: "#7B5BFF",
      },
    },
    {
      id: id("gradient-pricing", 5),
      type: "gradient-pricing",
      props: {
        eyebrow: "Pricing",
        headline: "Pay for what your team actually ships.",
        gradientFrom: "#1A1640",
        gradientTo: "#0A0A0B",
        accentColor: "#7B5BFF",
        tiers: [
          { name: "Starter", price: "$29", period: "/seat/mo", features: ["Up to 10 seats", "Standard models", "Slack & Linear", "Community support"], ctaText: "Start free", ctaUrl: "#" },
          { name: "Team", price: "$79", period: "/seat/mo", features: ["Unlimited seats", "Advanced models", "All integrations", "Priority support", "Audit log"], ctaText: "Start trial", ctaUrl: "#", featured: true, badge: "Most popular" },
          { name: "Enterprise", price: "Custom", features: ["VPC / on-prem", "SSO + SCIM", "Custom training", "Dedicated CSM", "Premium SLA"], ctaText: "Contact sales", ctaUrl: "#" },
        ],
      },
    },
    {
      id: id("bottom-cta", 6),
      type: "bottom-cta",
      props: {
        headline: "Ship the future. Starting today.",
        subheadline: "Join the closed beta and get a 60-day head start.",
        ctaText: "Request access",
        ctaUrl: "#access",
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: "#7B5BFF",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 2. Enterprise Platform
// ──────────────────────────────────────────────────────────────────────────
const enterprisePlatform: GlobalTemplateSeed = {
  slug: "global-flagship-enterprise-platform",
  title: "Enterprise Platform",
  templateLabel: "Enterprise Platform",
  templateDescription:
    "A polished, IT-buyer-ready landing page for enterprise infrastructure — full-bleed hero, benefits grid, comparison, and a serious final CTA.",
  ogImage: "",
  industry: "saas",
  premiumRank: 2,
  blocks: [
    {
      id: id("full-bleed-hero", 1),
      type: "full-bleed-hero",
      props: {
        eyebrow: "Platform",
        headline: "Enterprise infrastructure, without the enterprise tax.",
        subheadline: "Provision, govern, and audit every workload across every cloud — in one console.",
        ctaText: "Talk to sales",
        ctaUrl: "#sales",
        secondaryCtaText: "View architecture",
        secondaryCtaUrl: "#architecture",
        bgColor: "#0B1220",
        textColor: "#F8FAFC",
        accentColor: "#22D3EE",
      },
    },
    {
      id: id("trust-bar", 2),
      type: "trust-bar",
      props: {
        items: [
          { value: "Fortune 100", label: "customers" },
          { value: "32", label: "regions" },
          { value: "99.99%", label: "platform SLA" },
          { value: "SOC2 · ISO · HIPAA", label: "certified" },
        ],
      },
    },
    {
      id: id("benefits-grid", 3),
      type: "benefits-grid",
      props: {
        headline: "Built for the people who actually run production.",
        items: [
          { icon: "Lock", title: "Zero-trust by default", description: "Every action gated by policy. Every access logged." },
          { icon: "Globe", title: "Multi-cloud, one plane", description: "AWS, GCP, Azure, on-prem — managed identically." },
          { icon: "Activity", title: "Real-time observability", description: "OTel-native traces, metrics, and logs out of the box." },
          { icon: "Scale", title: "Compliance built-in", description: "Pre-mapped controls for SOC 2, ISO 27001, HIPAA, FedRAMP." },
          { icon: "Workflow", title: "Policy as code", description: "Version-controlled guardrails that reviewers can read." },
          { icon: "Headphones", title: "Premium support", description: "Slack-first, 15-minute SLA, named TAM on every account." },
        ],
      },
    },
    {
      id: id("comparison", 4),
      type: "comparison",
      props: {
        headline: "Why teams replace their stack with us.",
        oldWayLabel: "Stitched-together stack",
        newWayLabel: "Single platform",
        oldWayBullets: [
          "5+ vendors to invoice",
          "Inconsistent IAM models",
          "Manual audit prep",
          "Tribal-knowledge runbooks",
        ],
        newWayBullets: [
          "One contract, one console",
          "Unified RBAC + SCIM",
          "Always-on audit reports",
          "Codified, replayable workflows",
        ],
        ctaText: "See platform tour",
        ctaUrl: "#tour",
      },
    },
    {
      id: id("dandy-versus", 5),
      type: "dandy-versus",
      props: {},
    },
    {
      id: id("testimonial", 6),
      type: "testimonial",
      props: {
        quote: "We retired four tools and shipped our SOC 2 in half the time. The platform paid for itself in quarter one.",
        author: "Lena Park",
        role: "VP of Platform, Stratus",
      },
    },
    {
      id: id("bottom-cta", 7),
      type: "bottom-cta",
      props: {
        headline: "Ready to see it in your stack?",
        subheadline: "30-minute architecture review with a senior solutions engineer. No slides.",
        ctaText: "Book a session",
        ctaUrl: "#sales",
        bgColor: "#0B1220",
        textColor: "#F8FAFC",
        accentColor: "#22D3EE",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 3. Premium SaaS
// ──────────────────────────────────────────────────────────────────────────
const premiumSaas: GlobalTemplateSeed = {
  slug: "global-flagship-premium-saas",
  title: "Premium SaaS",
  templateLabel: "Premium SaaS",
  templateDescription:
    "An elegant, conversion-tuned SaaS landing page with a modern hero, sticky-stack story sequence, and gradient pricing.",
  ogImage: "",
  industry: "saas",
  premiumRank: 3,
  blocks: [
    {
      id: id("hero", 1),
      type: "hero",
      props: {
        eyebrow: "Made for modern teams",
        headline: "Run your business the way you've always wanted to.",
        subheadline: "Beautifully simple finance, ops, and CRM in one place. Set up in minutes, scale for years.",
        ctaText: "Start free",
        ctaUrl: "#start",
        ctaColor: "#111827",
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "10,000+ teams trust us to run their day-to-day",
      },
    },
    {
      id: id("trust-bar", 2),
      type: "trust-bar",
      props: {
        items: [
          { value: "10k+", label: "active teams" },
          { value: "4.9", label: "avg. rating" },
          { value: "120s", label: "median setup" },
          { value: "$2B+", label: "processed monthly" },
        ],
      },
    },
    {
      id: id("sticky-stack", 3),
      type: "sticky-stack",
      props: {
        eyebrow: "Why it works",
        headline: "Built around the work — not around the org chart.",
        cards: [
          { headline: "Everything in one place", body: "Quotes, invoices, contacts, tasks. No more swivel-chair workflows.", accent: "#111827" },
          { headline: "Automations that actually fire", body: "Visual rules with real previews and replay history.", accent: "#111827" },
          { headline: "Reports leadership trusts", body: "Pre-built dashboards your CFO will actually open.", accent: "#111827" },
        ],
      },
    },
    {
      id: id("zigzag-features", 4),
      type: "zigzag-features",
      props: {
        rows: [
          { headline: "Pipeline that sells itself", body: "AI-suggested next steps, auto-summaries on every deal, and one-click follow-ups.", imageUrl: "", imagePosition: "right" },
          { headline: "Books that close themselves", body: "Real-time cash position, auto-categorized expenses, and one-click month-end.", imageUrl: "", imagePosition: "left" },
          { headline: "Ops that run on rails", body: "Templated SOPs, role-based assignments, and a calendar your team will actually follow.", imageUrl: "", imagePosition: "right" },
        ],
      },
    },
    {
      id: id("gradient-pricing", 5),
      type: "gradient-pricing",
      props: {
        eyebrow: "Plans",
        headline: "Transparent pricing. No surprise add-ons.",
        gradientFrom: "#F8FAFC",
        gradientTo: "#E2E8F0",
        accentColor: "#111827",
        tiers: [
          { name: "Solo", price: "$15", period: "/mo", features: ["1 user", "All core features", "Email support"], ctaText: "Start free", ctaUrl: "#" },
          { name: "Team", price: "$49", period: "/seat/mo", features: ["Unlimited seats", "Automations", "Reporting", "Priority support"], ctaText: "Start trial", ctaUrl: "#", featured: true, badge: "Most loved" },
          { name: "Business", price: "$129", period: "/seat/mo", features: ["SSO + SCIM", "Custom roles", "Dedicated CSM", "99.99% SLA"], ctaText: "Contact us", ctaUrl: "#" },
        ],
      },
    },
    {
      id: id("bottom-cta", 6),
      type: "bottom-cta",
      props: {
        headline: "Try it free. No credit card.",
        subheadline: "Set up in two minutes. Cancel any time.",
        ctaText: "Start free trial",
        ctaUrl: "#start",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 4. Restaurant
// ──────────────────────────────────────────────────────────────────────────
const restaurant: GlobalTemplateSeed = {
  slug: "global-flagship-restaurant",
  title: "Restaurant",
  templateLabel: "Restaurant",
  templateDescription:
    "A warm, editorial restaurant page — moody hero photography, a real menu, hours & location with map embed, and a chef-led story.",
  ogImage: "",
  industry: "restaurant",
  premiumRank: 4,
  blocks: [
    {
      id: id("magazine-hero", 1),
      type: "magazine-hero",
      props: {
        eyebrow: "Now booking",
        headline: "Modern Italian, sourced from the field.",
        subheadline: "An intimate ten-table room serving a five-course tasting menu, six nights a week.",
        ctaText: "Reserve a table",
        ctaUrl: "#reservations",
        secondaryCtaText: "View menu",
        secondaryCtaUrl: "#menu",
        bgColor: "#1A1610",
        textColor: "#FAF7F2",
        accentColor: "#C7A664",
      },
    },
    {
      id: id("editorial-carousel", 2),
      type: "editorial-carousel",
      props: {
        eyebrow: "Inside the room",
        headline: "An evening with us.",
        slides: [
          { src: "", alt: "Dining room", caption: "The room" },
          { src: "", alt: "Wine cellar", caption: "Cellar" },
          { src: "", alt: "Open kitchen", caption: "Kitchen" },
          { src: "", alt: "Tasting menu plate", caption: "The plate" },
        ],
        bgColor: "#1A1610",
        textColor: "#FAF7F2",
        accentColor: "#C7A664",
      },
    },
    {
      id: id("menu-section", 3),
      type: "menu-section",
      props: {
        eyebrow: "Tasting menu",
        headline: "This week",
        subheadline: "Five courses, $128 per guest. Optional wine pairing $78.",
        bgColor: "#FAF7F2",
        textColor: "#1A1A1A",
        accentColor: "#8B0000",
        footnote: "Menu changes weekly based on what's available from our farms. Please advise of allergies at booking.",
        courses: [
          { title: "First", dishes: [
            { name: "Burrata", description: "Heirloom tomato, basil oil, sourdough", price: "—", tags: ["V"] },
            { name: "Tuna Crudo", description: "Yuzu, avocado, crispy shallot", price: "—", tags: ["GF"] },
          ]},
          { title: "Pasta", dishes: [
            { name: "Cacio e Pepe", description: "Tonnarelli, aged pecorino, black pepper", price: "—" },
            { name: "Agnolotti", description: "Brown butter, sage, hazelnut", price: "—" },
          ]},
          { title: "Main", dishes: [
            { name: "Wagyu Strip", description: "48-day dry-aged, bone marrow butter", price: "—" },
            { name: "Roasted Halibut", description: "Brown butter, charred lemon, capers", price: "—", tags: ["GF"] },
          ]},
          { title: "Dolce", dishes: [
            { name: "Olive Oil Cake", description: "Citrus, mascarpone, candied zest", price: "—", tags: ["V"] },
          ]},
        ],
      },
    },
    {
      id: id("hours-location", 4),
      type: "hours-location",
      props: {
        eyebrow: "Visit",
        headline: "Hours & Location",
        subheadline: "We can't wait to host you.",
        bgColor: "#0F0F10",
        textColor: "#F5F2EC",
        accentColor: "#C7A664",
        hours: [
          { day: "Monday", hours: "Closed" },
          { day: "Tuesday", hours: "5:00 PM – 10:00 PM" },
          { day: "Wednesday", hours: "5:00 PM – 10:00 PM" },
          { day: "Thursday", hours: "5:00 PM – 10:00 PM" },
          { day: "Friday", hours: "5:00 PM – 11:00 PM", highlight: true },
          { day: "Saturday", hours: "5:00 PM – 11:00 PM" },
          { day: "Sunday", hours: "5:00 PM – 9:00 PM" },
        ],
        businessName: "House of Daria",
        addressLine1: "248 Mulberry Street",
        addressLine2: "New York, NY 10012",
        phone: "(212) 555-0142",
        email: "reservations@houseofdaria.com",
        ctaText: "Reserve",
        ctaUrl: "#reservations",
      },
    },
    {
      id: id("bottom-cta", 5),
      type: "bottom-cta",
      props: {
        headline: "Book a table",
        subheadline: "Reservations open 30 days out at midnight ET.",
        ctaText: "Reserve",
        ctaUrl: "#reservations",
        bgColor: "#1A1610",
        textColor: "#FAF7F2",
        accentColor: "#C7A664",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 5. Creator / Portfolio
// ──────────────────────────────────────────────────────────────────────────
const creatorPortfolio: GlobalTemplateSeed = {
  slug: "global-flagship-creator-portfolio",
  title: "Creator Portfolio",
  templateLabel: "Creator / Portfolio",
  templateDescription:
    "A confident solo-creator portfolio — bold statement hero, editorial carousel of work, and a quiet, elegant about + contact.",
  ogImage: "",
  industry: "creator",
  premiumRank: 5,
  blocks: [
    {
      id: id("bold-statement", 1),
      type: "bold-statement",
      props: {
        eyebrow: "Designer · Brooklyn",
        headline: "I help ambitious teams turn fuzzy ideas into beautiful, opinionated products.",
        ctaText: "Start a project",
        ctaUrl: "#contact",
        bgColor: "#FFFFFF",
        textColor: "#0B0B0C",
        accentColor: "#FF4D2E",
      },
    },
    {
      id: id("editorial-carousel", 2),
      type: "editorial-carousel",
      props: {
        eyebrow: "Selected work",
        headline: "Recent projects.",
        slides: [
          { src: "", alt: "Project 1", caption: "Northwind / Identity 2024" },
          { src: "", alt: "Project 2", caption: "Latticework / Product Design" },
          { src: "", alt: "Project 3", caption: "Helix / Web Refresh" },
          { src: "", alt: "Project 4", caption: "Fieldnotes / App" },
        ],
        bgColor: "#0B0B0C",
        textColor: "#F5F5F7",
        accentColor: "#FF4D2E",
      },
    },
    {
      id: id("rich-text", 3),
      type: "rich-text",
      props: {
        html:
          "<h2>About</h2><p>Independent designer with 12 years of work across consumer, fintech, and developer tools. Previously design lead at two YC companies and one Fortune 500. I take on three engagements at a time. Most last 4–8 weeks.</p>",
      },
    },
    {
      id: id("photo-strip", 4),
      type: "photo-strip",
      props: {
        images: [
          { src: "", alt: "Press 1" },
          { src: "", alt: "Press 2" },
          { src: "", alt: "Press 3" },
          { src: "", alt: "Press 4" },
        ],
      },
    },
    {
      id: id("bottom-cta", 5),
      type: "bottom-cta",
      props: {
        headline: "Have a project in mind?",
        subheadline: "Tell me about it — I respond to every email within 48 hours.",
        ctaText: "Get in touch",
        ctaUrl: "#contact",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 6. Local Services
// ──────────────────────────────────────────────────────────────────────────
const localServices: GlobalTemplateSeed = {
  slug: "global-flagship-local-services",
  title: "Local Services",
  templateLabel: "Local Services",
  templateDescription:
    "A trustworthy local service business page — friendly hero, real before/after photos, hours & service area, and a quote-request CTA.",
  ogImage: "",
  industry: "local-services",
  premiumRank: 6,
  blocks: [
    {
      id: id("hero", 1),
      type: "hero",
      props: {
        eyebrow: "Greater Austin · 4.9★ on Google",
        headline: "Renovations done right. The first time.",
        subheadline: "Family-owned remodeling crew serving Austin since 2008. Fixed-price quotes, on-time finishes, lifetime workmanship guarantee.",
        ctaText: "Get a free quote",
        ctaUrl: "#quote",
        ctaColor: "#0B6B3A",
        heroType: "static-image",
        layout: "left",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "1,200+ projects completed across Central Texas",
      },
    },
    {
      id: id("trust-bar", 2),
      type: "trust-bar",
      props: {
        items: [
          { value: "16 yrs", label: "in business" },
          { value: "1,200+", label: "homes served" },
          { value: "4.9★", label: "Google rating" },
          { value: "Lifetime", label: "workmanship warranty" },
        ],
      },
    },
    {
      id: id("before-after-gallery", 3),
      type: "before-after-gallery",
      props: {
        eyebrow: "Real projects",
        headline: "The transformation",
        subheadline: "Before and after photos from recent jobs across Austin.",
        bgColor: "#FFFFFF",
        textColor: "#0B0B0C",
        accentColor: "#0B6B3A",
        beforeLabel: "Before",
        afterLabel: "After",
        pairs: [
          { beforeSrc: "", beforeAlt: "Kitchen before", afterSrc: "", afterAlt: "Kitchen after", caption: "Full kitchen refresh — completed in 4 weeks." },
          { beforeSrc: "", beforeAlt: "Bath before", afterSrc: "", afterAlt: "Bath after", caption: "Master bath — heated floors, frameless glass." },
          { beforeSrc: "", beforeAlt: "Yard before", afterSrc: "", afterAlt: "Yard after", caption: "Front yard hardscape and lighting." },
        ],
      },
    },
    {
      id: id("how-it-works", 4),
      type: "how-it-works",
      props: {
        headline: "How it works",
        steps: [
          { title: "Free in-home quote", description: "We come measure, listen, and walk you through options on the spot." },
          { title: "Fixed price, signed", description: "No change-order surprises. Your quote is your final price." },
          { title: "Schedule + start", description: "Most projects start within two weeks of signing." },
          { title: "Walkthrough + warranty", description: "Final walkthrough, punch list, and lifetime workmanship coverage." },
        ],
      },
    },
    {
      id: id("hours-location", 5),
      type: "hours-location",
      props: {
        eyebrow: "Service area",
        headline: "Where we work",
        subheadline: "Family-owned and locally based in South Austin.",
        bgColor: "#0B6B3A",
        textColor: "#FFFFFF",
        accentColor: "#FFD400",
        hours: [
          { day: "Mon – Fri", hours: "7:00 AM – 6:00 PM" },
          { day: "Saturday", hours: "8:00 AM – 2:00 PM" },
          { day: "Sunday", hours: "Closed" },
        ],
        businessName: "Hill Country Renovations",
        addressLine1: "2204 South Lamar Blvd",
        addressLine2: "Austin, TX 78704",
        phone: "(512) 555-0199",
        email: "hello@hillcountryreno.com",
        ctaText: "Get a quote",
        ctaUrl: "#quote",
      },
    },
    {
      id: id("testimonial", 6),
      type: "testimonial",
      props: {
        quote: "On time, on budget, and the crew was the most respectful contractor we've ever worked with. Recommend without reservation.",
        author: "Mara K.",
        role: "Austin homeowner",
      },
    },
    {
      id: id("bottom-cta", 7),
      type: "bottom-cta",
      props: {
        headline: "Get your free quote",
        subheadline: "Same-week visits available. We'll text you a confirmation within an hour.",
        ctaText: "Request a quote",
        ctaUrl: "#quote",
        bgColor: "#0B6B3A",
        textColor: "#FFFFFF",
        accentColor: "#FFD400",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 7. Event Landing
// ──────────────────────────────────────────────────────────────────────────
const eventLanding: GlobalTemplateSeed = {
  slug: "global-flagship-event-landing",
  title: "Event Landing",
  templateLabel: "Event Landing",
  templateDescription:
    "A high-energy event landing page — bold hero with date, speaker grid, agenda highlights, and a pricing-style ticketing section.",
  ogImage: "",
  industry: "events",
  premiumRank: 7,
  blocks: [
    {
      id: id("event-landing-hero", 1),
      type: "event-landing-hero",
      props: {
        eventName: "Forge / 2026",
        tagline: "The conference for people who build things that matter.",
        date: "October 14–16, 2026",
        location: "Brooklyn, NY",
        ctaText: "Get tickets",
        ctaUrl: "#tickets",
      },
    },
    {
      id: id("trust-bar", 2),
      type: "trust-bar",
      props: {
        items: [
          { value: "3 days", label: "of talks + workshops" },
          { value: "60+", label: "speakers" },
          { value: "1,200", label: "attendees" },
          { value: "4.8/5", label: "2025 attendee score" },
        ],
      },
    },
    {
      id: id("speaker-grid", 3),
      type: "speaker-grid",
      props: {
        eyebrow: "Featured speakers",
        headline: "The lineup",
        subheadline: "Operators, founders, and craftspeople sharing what's actually working.",
        columns: 3,
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: "#7B5BFF",
        speakers: [
          { name: "Maya Chen", role: "Co-founder & CEO", company: "Latticework", photoUrl: "", bio: "Building developer tools used by 30k+ teams.", socialLabel: "LinkedIn" },
          { name: "Jordan Reyes", role: "Head of Design", company: "Northwind", photoUrl: "", bio: "Previously at Stripe, Figma. Lover of small details.", socialLabel: "LinkedIn" },
          { name: "Priya Shah", role: "VP Engineering", company: "Veridian", photoUrl: "", bio: "Scaling teams from 5 to 500 without losing the magic.", socialLabel: "LinkedIn" },
          { name: "Andre Okafor", role: "Founder", company: "Helix Robotics", photoUrl: "", bio: "Building hands that learn." },
          { name: "Sam Nakamura", role: "Head of Product", company: "Fieldnotes", photoUrl: "", bio: "Shipping software that respects attention." },
          { name: "Ines Moreau", role: "Distinguished Engineer", company: "Atlas", photoUrl: "", bio: "Distributed systems, durably." },
        ],
      },
    },
    {
      id: id("how-it-works", 4),
      type: "how-it-works",
      props: {
        headline: "What three days look like",
        steps: [
          { title: "Day 1 — Workshops", description: "Hands-on sessions in small rooms with the speakers themselves." },
          { title: "Day 2 — Main stage", description: "Single-track keynote day. The whole crowd, one conversation." },
          { title: "Day 3 — Build day", description: "Open studio + dinner. Where the friendships actually start." },
        ],
      },
    },
    {
      id: id("gradient-pricing", 5),
      type: "gradient-pricing",
      props: {
        eyebrow: "Tickets",
        headline: "Pick your pass.",
        gradientFrom: "#1A1640",
        gradientTo: "#0A0A0B",
        accentColor: "#7B5BFF",
        tiers: [
          { name: "Day pass", price: "$299", features: ["One day of your choice", "All talks + lunch", "Community Slack"], ctaText: "Buy", ctaUrl: "#" },
          { name: "Full conference", price: "$799", features: ["All three days", "Workshops + main stage + build day", "Speaker dinners", "After-party access"], ctaText: "Buy", ctaUrl: "#", featured: true, badge: "Best value" },
          { name: "Team (5)", price: "$2,995", features: ["Five full passes", "Reserved seating", "Private Q&A with two speakers"], ctaText: "Contact us", ctaUrl: "#" },
        ],
      },
    },
    {
      id: id("bottom-cta", 6),
      type: "bottom-cta",
      props: {
        headline: "We'll save you a seat.",
        subheadline: "Tickets go up after early bird ends Aug 1.",
        ctaText: "Get tickets",
        ctaUrl: "#tickets",
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: "#7B5BFF",
      },
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 8. Productized Agency
// ──────────────────────────────────────────────────────────────────────────
const productizedAgency: GlobalTemplateSeed = {
  slug: "global-flagship-productized-agency",
  title: "Productized Agency",
  templateLabel: "Productized Agency",
  templateDescription:
    "A premium productized-service landing page — clear positioning, bento-style service tiles, transparent pricing, and a quiet portfolio carousel.",
  ogImage: "",
  industry: "agency",
  premiumRank: 8,
  blocks: [
    {
      id: id("magazine-hero", 1),
      type: "magazine-hero",
      props: {
        eyebrow: "Design subscription",
        headline: "Senior design. Flat monthly rate. Pause anytime.",
        subheadline: "We act as your in-house design team. One subscription. Unlimited requests. Real, considered work — not a Fiverr stack.",
        ctaText: "See plans",
        ctaUrl: "#plans",
        secondaryCtaText: "View work",
        secondaryCtaUrl: "#work",
        bgColor: "#0F0F10",
        textColor: "#F5F2EC",
        accentColor: "#FF6B2C",
      },
    },
    {
      id: id("trust-bar", 2),
      type: "trust-bar",
      props: {
        items: [
          { value: "48hr", label: "average turnaround" },
          { value: "120+", label: "active clients" },
          { value: "4.95★", label: "client rating" },
          { value: "Pause", label: "any time" },
        ],
      },
    },
    {
      id: id("bento-showcase", 3),
      type: "bento-showcase",
      props: {
        eyebrow: "What we do",
        headline: "One team. Every surface.",
        bgColor: "#FFFFFF",
        textColor: "#0F0F10",
        accentColor: "#FF6B2C",
        tiles: [
          { kind: "headline", size: "lg", headline: "Brand systems", body: "Logo, type, color, voice, and a real guidelines doc your team will use." },
          { kind: "headline", size: "md", headline: "Landing pages", body: "Conversion-tuned, copy + design + dev-ready handoff." },
          { kind: "headline", size: "md", headline: "Product UI", body: "Dashboards, app screens, design systems in Figma." },
          { kind: "stat", size: "sm", stat: "48h", statLabel: "Median turnaround" },
          { kind: "headline", size: "sm", headline: "Pitch + decks", body: "Investor decks that close rounds." },
        ],
      },
    },
    {
      id: id("editorial-carousel", 4),
      type: "editorial-carousel",
      props: {
        eyebrow: "Recent work",
        headline: "Across SaaS, fintech, and consumer.",
        slides: [
          { src: "", alt: "Work 1", caption: "Northwind / Identity" },
          { src: "", alt: "Work 2", caption: "Helix / Web" },
          { src: "", alt: "Work 3", caption: "Latticework / App" },
          { src: "", alt: "Work 4", caption: "Atlas / Brand" },
        ],
        bgColor: "#FAF7F2",
        textColor: "#0F0F10",
        accentColor: "#FF6B2C",
      },
    },
    {
      id: id("gradient-pricing", 5),
      type: "gradient-pricing",
      props: {
        eyebrow: "Plans",
        headline: "Flat rate. No surprises.",
        gradientFrom: "#FFF0E5",
        gradientTo: "#FAF7F2",
        accentColor: "#FF6B2C",
        tiers: [
          { name: "Studio", price: "$4,995", period: "/mo", features: ["One active request at a time", "48-hour turnaround", "Pause any time"], ctaText: "Start", ctaUrl: "#" },
          { name: "Studio Pro", price: "$8,995", period: "/mo", features: ["Two active requests", "24-hour turnaround", "Direct Slack channel", "Brand strategy sessions"], ctaText: "Start", ctaUrl: "#", featured: true, badge: "Most teams" },
          { name: "Embedded", price: "Custom", features: ["Dedicated designer", "Standups + sprint cadence", "Quarterly business reviews"], ctaText: "Contact us", ctaUrl: "#" },
        ],
      },
    },
    {
      id: id("testimonial", 6),
      type: "testimonial",
      props: {
        quote: "It's like hiring a senior designer at a third the cost — and the work has shipped on every deadline.",
        author: "David Yuen",
        role: "Founder, Latticework",
      },
    },
    {
      id: id("bottom-cta", 7),
      type: "bottom-cta",
      props: {
        headline: "Ready to ship better design?",
        subheadline: "Start your subscription today. Cancel or pause whenever.",
        ctaText: "See plans",
        ctaUrl: "#plans",
        bgColor: "#0F0F10",
        textColor: "#F5F2EC",
        accentColor: "#FF6B2C",
      },
    },
  ],
};

export const FLAGSHIP_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  aiProductLaunch,
  enterprisePlatform,
  premiumSaas,
  restaurant,
  creatorPortfolio,
  localServices,
  eventLanding,
  productizedAgency,
];
