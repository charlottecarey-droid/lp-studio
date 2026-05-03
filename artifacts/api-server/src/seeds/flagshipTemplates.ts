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
  ogImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
  industry: "saas",
  premiumRank: 1,
  blocks: [
    {
      id: id("full-bleed-hero", 1),
      type: "full-bleed-hero",
      props: {
        headline: "The AI partner that thinks alongside you.",
        subheadline:
          "Vela is a workspace-native model trained on your team's docs, decisions, and history. Less prompting. More work shipped.",
        ctaText: "Request access",
        ctaUrl: "#access",
        secondaryCtaText: "Watch the demo",
        secondaryCtaUrl: "#demo",
        backgroundType: "image",
        backgroundImageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1920&q=80",
        backgroundVideoUrl: "",
        videoAutoplay: true,
        overlayOpacity: 65,
        minHeight: "full",
        contentAlignment: "left",
        logoImageUrl: "",
        logoUrl: "#",
        navLinks: [
          { label: "Product", url: "#product" },
          { label: "Capabilities", url: "#capabilities" },
          { label: "Pricing", url: "#pricing" },
        ],
        headerCtaText: "Request access",
        headerCtaUrl: "#access",
        headerScrolledBg: "#0A0A0B",
        showSocialProof: true,
        socialProofText: "Now in private beta — joining 200+ teams",
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
      id: id("sticky-stack", 4),
      type: "sticky-stack",
      props: {
        eyebrow: "HOW IT WORKS",
        headline: "Three reasons teams pick Vela.",
        bgColor: "#0A0A0B",
        cardScrollVh: 110,
        cards: [
          { tag: "CONTEXT", title: "Reads your codebase. Writes the PR.", body: "Vela ingests every doc, decision, and commit — then proposes pull requests with reasoning, tests, and changelog notes you can review in seconds.", imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80", imageSide: "right", bgColor: "#0F0B2A", textColor: "#F5F5F7", accentColor: "#7B5BFF" },
          { tag: "FAST", title: "Triage in minutes, not days.", body: "Vela auto-categorizes incoming tickets, suggests owners, and drafts the first reply — so your team starts every Monday with an empty inbox.", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80", imageSide: "left", bgColor: "#1a1a1f", textColor: "#F5F5F7", accentColor: "#7B5BFF" },
          { tag: "SAFE", title: "Your data, your boundary.", body: "VPC deploy, customer-managed keys, and full audit logging. Vela never trains on your data — and you can prove it on day one.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80", imageSide: "right", bgColor: "#0B0B0F", textColor: "#F5F5F7", accentColor: "#7B5BFF" },
        ],
      },
    },
    {
      id: id("dso-stat-showcase", 5),
      type: "dso-stat-showcase",
      props: {
        eyebrow: "By the numbers",
        headline: "What teams ship with Vela.",
        stats: [
          { value: "12x",  label: "Faster ticket triage", description: "Avg. across 200+ pilot teams in 2025." },
          { value: "40%",  label: "Faster PR cycle time", description: "From draft to merge with auto-generated review notes." },
          { value: "99.9%", label: "Uptime",              description: "Globally distributed, region-pinned for compliance." },
          { value: "SOC 2", label: "Type II",             description: "Plus HIPAA, ISO 27001, and EU data residency." },
          { value: "0",     label: "Training on your data", description: "Customer-managed keys. Always." },
          { value: "60d",   label: "Avg. payback period",   description: "Most teams break even before quarter-end." },
        ],
      },
    },
    {
      id: id("dandy-versus", 6),
      type: "dandy-versus",
      props: {},
    },
    {
      id: id("editorial-carousel", 7),
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
      id: id("gradient-pricing", 8),
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
      id: id("bottom-cta", 9),
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
  ogImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
  industry: "saas",
  premiumRank: 2,
  blocks: [
    {
      id: id("magazine-hero", 1),
      type: "magazine-hero",
      props: {
        eyebrow: "PLATFORM · ISSUE 04",
        headline: "Enterprise infrastructure, without the enterprise tax.",
        subheadline: "Provision, govern, and audit every workload across every cloud — in one console. Built for the people who actually run production.",
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
      id: id("photo-strip", 25),
      type: "photo-strip",
      props: {
        images: [
          { src: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80", alt: "Customer / Northwind" },
          { src: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&q=80", alt: "Customer / Latticework" },
          { src: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=400&q=80", alt: "Customer / Veridian" },
          { src: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80", alt: "Customer / Helix" },
          { src: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&q=80", alt: "Customer / Atlas" },
          { src: "https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=400&q=80", alt: "Customer / Stratus" },
        ],
      },
    },
    {
      id: id("sticky-stack", 3),
      type: "sticky-stack",
      props: {
        eyebrow: "THE PLATFORM",
        headline: "One control plane. Every cloud.",
        bgColor: "#F8FAFC",
        cardScrollVh: 110,
        cards: [
          { tag: "PROVISION", title: "Spin up secure environments in minutes.", body: "Pre-baked landing zones, golden VPCs, and policy-as-code from day one — across AWS, GCP, and Azure.", imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80", imageSide: "right", bgColor: "#0B1220", textColor: "#F8FAFC", accentColor: "#22D3EE" },
          { tag: "GOVERN",    title: "Zero-trust, by default.",                  body: "RBAC + SCIM + SSO baked in. Every action gated by policy. Every access logged with full lineage.",                                  imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80", imageSide: "left",  bgColor: "#0F172A", textColor: "#F8FAFC", accentColor: "#22D3EE" },
          { tag: "OBSERVE",   title: "Trace every request, end to end.",         body: "OTel-native traces, metrics, and logs. Anomalies surface before pages — not after the postmortem.",                                imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80", imageSide: "right", bgColor: "#0B1220", textColor: "#F8FAFC", accentColor: "#22D3EE" },
        ],
      },
    },
    {
      id: id("bento-showcase", 4),
      type: "bento-showcase",
      props: {
        eyebrow: "Capabilities",
        headline: "Everything your platform team needs.",
        bgColor: "#0B1220",
        textColor: "#F8FAFC",
        accentColor: "#22D3EE",
        tiles: [
          { kind: "headline", size: "lg", headline: "Multi-cloud, one console.",      body: "Provision, govern, and audit AWS, GCP, Azure and on-prem identically." },
          { kind: "stat",     size: "md", stat: "32",  statLabel: "Regions covered" },
          { kind: "headline", size: "md", headline: "Pre-mapped compliance.",          body: "SOC 2, ISO 27001, HIPAA, FedRAMP — every control wired in on day one." },
          { kind: "headline", size: "sm", headline: "Native integrations.",            body: "Okta, Datadog, Splunk, ServiceNow, Snowflake, Terraform Cloud." },
          { kind: "headline", size: "sm", headline: "Policy as code.",                 body: "Versioned guardrails. Reviewable. Replayable." },
          { kind: "stat",     size: "sm", stat: "99.99%", statLabel: "Platform SLA" },
        ],
      },
    },
    {
      id: id("benefits-grid", 5),
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
      id: id("comparison", 6),
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
      id: id("dandy-versus", 7),
      type: "dandy-versus",
      props: {},
    },
    {
      id: id("testimonial", 8),
      type: "testimonial",
      props: {
        quote: "We retired four tools and shipped our SOC 2 in half the time. The platform paid for itself in quarter one.",
        author: "Lena Park",
        role: "VP of Platform, Stratus",
      },
    },
    {
      id: id("dandy-form-right-alt", 9),
      type: "dandy-form-right-alt",
      props: {
        eyebrow: "TALK TO AN ARCHITECT",
        headline: "Get a 30-minute platform tour.",
        subheadline: "A senior solutions engineer will walk through your current architecture and show you exactly where the platform fits — no slides.",
        bullets: [
          "Tailored to your stack (AWS/GCP/Azure/on-prem)",
          "Compliance walkthrough (SOC 2, ISO, HIPAA, FedRAMP)",
          "Pricing and procurement options up front",
          "References from peers in your industry",
        ],
        trustNote: "🔒 We never share your information. Used only to schedule your session.",
        formHeadline: "Book your architecture review",
        formSubheadline: "We'll respond within one business day to confirm a time.",
        submitText: "Book a session",
        formDisclaimer: "No purchase required.",
        successMessage: "Thanks — a solutions engineer will reach out within one business day.",
        bgColor: "#F8FAFC",
      },
    },
    {
      id: id("bottom-cta", 10),
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
  ogImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
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
        eyebrow: "WHY IT WORKS",
        headline: "Built around the work — not around the org chart.",
        bgColor: "#FAFAF7",
        cardScrollVh: 110,
        cards: [
          { tag: "ONE PLACE",   title: "Everything in one place.",            body: "Quotes, invoices, contacts, tasks — all attached to the customer record they belong to. No more swivel-chair workflows.", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80", imageSide: "right", bgColor: "#111827", textColor: "#F8FAFC", accentColor: "#22D3EE" },
          { tag: "AUTOMATIONS", title: "Automations that actually fire.",     body: "Visual rules with real previews and a complete replay history. If it ran, you can prove it ran.",                              imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80", imageSide: "left",  bgColor: "#0F172A", textColor: "#F8FAFC", accentColor: "#22D3EE" },
          { tag: "REPORTS",     title: "Dashboards leadership trusts.",       body: "Pre-built reports your CFO will actually open — pipeline, cash, margin, and burn — refreshed live.",                            imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80", imageSide: "right", bgColor: "#111827", textColor: "#F8FAFC", accentColor: "#22D3EE" },
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
      id: id("horizontal-showcase", 41),
      type: "horizontal-showcase",
      props: {
        eyebrow: "BUILT FOR THE WAY YOU WORK",
        headline: "Three surfaces. One source of truth.",
        bgColor: "#0B0B0F",
        panelHeightVh: 90,
        panels: [
          { tag: "PIPELINE",   title: "Sell more without the swivel-chair.", body: "Every conversation, attachment, and next-step on one record. AI summaries on every deal.",  imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80",  alignment: "left",  bgColor: "#0F172A", overlayColor: "rgba(0,0,0,0.6)",  accentColor: "#22D3EE", ctaText: "See it",   ctaUrl: "#" },
          { tag: "FINANCE",    title: "Books that close themselves.",         body: "Real-time cash, auto-categorized expenses, and a one-click month-end your CFO will love.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",  alignment: "right", bgColor: "#111827", overlayColor: "rgba(0,0,0,0.55)", accentColor: "#22D3EE", ctaText: "Tour",      ctaUrl: "#" },
          { tag: "OPERATIONS", title: "Ops that run on rails.",               body: "Templated SOPs, role-based assignments, and a calendar your team will actually follow.",   imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80", alignment: "left",  bgColor: "#0F172A", overlayColor: "rgba(0,0,0,0.55)", accentColor: "#22D3EE", ctaText: "Walkthrough", ctaUrl: "#" },
        ],
      },
    },
    {
      id: id("dandy-switchback", 42),
      type: "dandy-switchback",
      props: {
        eyebrow: "WHY TEAMS PICK US",
        headline: "Three ways teams change their week.",
        subheadline: "From the moment you log in, the work feels less heavy. Here's exactly how.",
        items: [
          { title: "From spreadsheets to one source of truth.", description: "Stop reconciling four tools. One record per customer, owned by the people closest to the work.", ctaText: "Read more", ctaUrl: "#",                imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80" },
          { title: "From manual work to automations that fire.", description: "Visual rules with previews and replay history. If it ran, you can prove it ran.",                                                                                ctaText: "Read more", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80" },
          { title: "From after-the-fact reports to real-time dashboards.", description: "Pre-built reports leadership trusts — pipeline, cash, margin, burn — refreshed live.",                                                                  ctaText: "Read more", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80" },
        ],
      },
    },
    {
      id: id("dandy-vertical-tabs", 43),
      type: "dandy-vertical-tabs",
      props: {
        headline: "Built for the role you actually have.",
        subheadline: "Switch lanes — see exactly how the platform works for sales, finance, or operations leaders.",
        tabs: [
          { title: "For founders & GMs", description: "Run weekly on a single dashboard. Cash, pipeline, and ops on one screen.",         ctaText: "See the GM view",     ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80" },
          { title: "For sales leaders",  description: "Forecasts that hold up. AI deal coaching. Auto-logged calls and emails.",          ctaText: "See the sales view",   ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80" },
          { title: "For finance leads",  description: "Real-time cash, automatic expense categorization, and a one-click close.",         ctaText: "See the finance view", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80" },
        ],
      },
    },
    {
      id: id("testimonial", 44),
      type: "testimonial",
      props: {
        quote: "We retired three tools and our weekly leadership meeting is now twenty minutes shorter. The team is just… happier.",
        author: "Reese Anand",
        role: "Founder, Northwind",
      },
    },
    {
      id: id("rich-text", 45),
      type: "rich-text",
      props: {
        html:
          "<h2>Frequently asked</h2>" +
          "<h3>How long does setup take?</h3><p>Most teams are in production in under two hours. Importing your existing data, configuring users, and connecting your email/calendar takes the longest — and we walk you through it live if you'd like.</p>" +
          "<h3>Can we keep using the tools we already love?</h3><p>Yes. Native, two-way integrations with Slack, Gmail, Outlook, Stripe, QuickBooks, Xero, and 60+ others. We never become the place you have to log in to — we become the place you finally see everything.</p>" +
          "<h3>Is our data safe?</h3><p>SOC 2 Type II, GDPR, and HIPAA-ready. Your data is encrypted in transit and at rest, and you can export everything any time.</p>" +
          "<h3>What if we outgrow the plan?</h3><p>Move up any time, prorated to the day. No re-implementation. Your data, your workflows, your reports come with you.</p>",
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
  ogImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80",
  industry: "restaurant",
  premiumRank: 4,
  blocks: [
    {
      id: id("full-bleed-hero", 1),
      type: "full-bleed-hero",
      props: {
        headline: "Modern Italian, sourced from the field.",
        subheadline: "An intimate ten-table room serving a five-course tasting menu, six nights a week.",
        ctaText: "Reserve a table",
        ctaUrl: "#reservations",
        secondaryCtaText: "View menu",
        secondaryCtaUrl: "#menu",
        backgroundType: "image",
        backgroundImageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80",
        backgroundVideoUrl: "",
        videoAutoplay: true,
        overlayOpacity: 55,
        minHeight: "full",
        contentAlignment: "left",
        logoImageUrl: "",
        logoUrl: "#",
        navLinks: [
          { label: "Menu", url: "#menu" },
          { label: "Hours", url: "#hours" },
          { label: "Reserve", url: "#reservations" },
        ],
        headerCtaText: "Reserve",
        headerCtaUrl: "#reservations",
        headerScrolledBg: "#1A1610",
        showSocialProof: true,
        socialProofText: "Featured in The New York Times · Bon Appétit",
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
      id: id("form", 5),
      type: "form",
      props: {
        headline: "Reserve a table",
        subheadline: "Tell us a date, time, and party size — we'll confirm by email within an hour.",
        multiStep: false,
        steps: [
          {
            title: "Reservation request",
            fields: [
              { id: "field-name",   type: "text",     label: "Full Name",       placeholder: "Your name",                  required: true },
              { id: "field-email",  type: "email",    label: "Email",            placeholder: "you@example.com",            required: true },
              { id: "field-phone",  type: "phone",    label: "Phone",            placeholder: "(212) 555-0142",             required: true },
              { id: "field-date",   type: "text",     label: "Preferred date",   placeholder: "e.g. Friday, Aug 22",        required: true },
              { id: "field-time",   type: "text",     label: "Preferred time",   placeholder: "e.g. 7:30 PM",               required: true },
              { id: "field-party",  type: "select",   label: "Party size",       placeholder: "Select…",                    required: true, options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"] },
              { id: "field-notes",  type: "textarea", label: "Allergies / notes", placeholder: "Anything we should know?",   required: false },
            ],
          },
        ],
        submitButtonText: "Request reservation",
        successMessage: "Thanks — we'll confirm by email within the hour.",
        redirectUrl: "",
        backgroundStyle: "white",
      },
    },
    {
      id: id("sticky-bar", 6),
      type: "sticky-bar",
      props: {
        text: "Reservations open 30 days out at midnight ET — book yours now.",
        ctaText: "Reserve",
        ctaUrl: "#reservations",
        ctaColor: "#C7A664",
        position: "top",
        backgroundStyle: "dark",
        showAfterScroll: 200,
        dismissible: true,
      },
    },
    {
      id: id("bottom-cta", 7),
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
  ogImage: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=1200&q=80",
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
      id: id("bento-showcase", 31),
      type: "bento-showcase",
      props: {
        eyebrow: "Services",
        headline: "How I work — and what you get.",
        bgColor: "#FFFFFF",
        textColor: "#0B0B0C",
        accentColor: "#FF4D2E",
        tiles: [
          { kind: "headline", size: "lg", headline: "Brand & identity systems.",        body: "Logo, type, color, voice, and a usable guidelines doc your team will actually open." },
          { kind: "stat",     size: "md", stat: "4–8 wks", statLabel: "Typical engagement" },
          { kind: "headline", size: "md", headline: "Marketing sites & launches.",      body: "Conversion-tuned design + dev-ready handoff for SaaS, fintech, and consumer." },
          { kind: "headline", size: "sm", headline: "Product UI & design systems.",     body: "Dashboards, app flows, and components in Figma — built to scale." },
          { kind: "headline", size: "sm", headline: "Pitch & investor decks.",          body: "Decks that close rounds — narrative, layout, and slide-by-slide editing." },
        ],
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
      id: id("testimonial", 32),
      type: "testimonial",
      props: {
        quote: "The best designer I've ever worked with — full stop. Senior thinking, fast turnaround, and the work always lands.",
        author: "Maya Chen",
        role: "Co-founder, Latticework",
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
  ogImage: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200&q=80",
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
      id: id("form", 7),
      type: "form",
      props: {
        headline: "Get a free quote",
        subheadline: "Tell us about your project. We'll come measure for free and send a fixed-price quote within 48 hours.",
        multiStep: false,
        steps: [
          {
            title: "Project details",
            fields: [
              { id: "field-name",    type: "text",     label: "Full Name",       placeholder: "Your name",          required: true },
              { id: "field-email",   type: "email",    label: "Email",            placeholder: "you@example.com",    required: true },
              { id: "field-phone",   type: "phone",    label: "Phone",            placeholder: "(512) 555-0199",     required: true },
              { id: "field-zip",     type: "text",     label: "ZIP code",         placeholder: "78704",              required: true },
              { id: "field-project", type: "select",   label: "Project type",     placeholder: "Select…",            required: true, options: ["Kitchen", "Bath", "Whole home", "Outdoor / hardscape", "Other"] },
              { id: "field-budget",  type: "select",   label: "Approx. budget",   placeholder: "Select…",            required: false, options: ["Under $25k", "$25k–$75k", "$75k–$150k", "$150k+"] },
              { id: "field-notes",   type: "textarea", label: "Tell us more",     placeholder: "Anything we should know?", required: false },
            ],
          },
        ],
        submitButtonText: "Request my free quote",
        successMessage: "Thanks — we'll be in touch within 48 hours to schedule your free in-home measurement.",
        redirectUrl: "",
        backgroundStyle: "white",
      },
    },
    {
      id: id("bottom-cta", 8),
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
  ogImage: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80",
  industry: "events",
  premiumRank: 7,
  blocks: [
    {
      id: id("event-page", 1),
      type: "event-page",
      props: {
        eventName: "Forge / 2026",
        eventSubtitle: "The conference for people who build things that matter.",
        logoUrl: "",
        navLinks: [
          { label: "Agenda",   href: "#agenda" },
          { label: "Speakers", href: "#speakers" },
          { label: "Venue",    href: "#venue" },
          { label: "Tickets",  href: "#tickets" },
        ],
        navCtaText: "Get tickets",
        navCtaUrl: "#tickets",
        heroEyebrow: "October 14–16, 2026 · Brooklyn, NY",
        heroImageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1920&q=80",
        heroTagline: "Three days of talks, workshops, and small-room conversations with the operators, founders, and craftspeople defining the next decade.",
        heroLocation: "BROOKLYN STEEL · LIMITED CAPACITY",
        heroCtaText: "GET TICKETS",
        agendaEyebrow: "The Agenda",
        agendaHeadline: "Three days, three modes.",
        agendaSubtitle: "We design the program around how people actually learn — small-group workshops, a single-track main stage, and a build day for the people who want to ship together.",
        agendaValueProps: [
          "60+ talks and workshops",
          "Single-track main stage day",
          "Build day with speakers in the room",
          "Curated speaker dinners",
        ],
        agendaDays: [
          { day: "Day One",   title: "Workshops",   description: "Hands-on, small-room sessions with the speakers themselves. Pick three across the day.",                                            highlight: "Evening welcome reception at the Brooklyn Steel rooftop with views of Manhattan." },
          { day: "Day Two",   title: "Main Stage",  description: "Single-track keynote day. The whole community in one room, one conversation, one shared reference point all year.",                  highlight: "Curated speaker dinners across Williamsburg — sign up the morning of." },
          { day: "Day Three", title: "Build Day",   description: "Open studio + collaborative build sessions. Speakers stay and join the rooms. Bring a laptop and a real problem.",                    highlight: "Closing dinner + after-party at Marlow & Sons." },
        ],
        photos: [
          { src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&q=80", alt: "Main stage", caption: "Main Stage" },
          { src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80", alt: "Workshop", caption: "Workshop Rooms" },
          { src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&q=80", alt: "Reception", caption: "Welcome Reception" },
          { src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80", alt: "Networking", caption: "Speaker Dinners" },
          { src: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=900&q=80", alt: "Conference", caption: "Build Day" },
          { src: "https://images.unsplash.com/photo-1559223607-a43f990c692c?w=900&q=80", alt: "Conference", caption: "After Party" },
        ],
        detailsEyebrow: "Venue & Travel",
        detailsHeadline: "Everything you need to know",
        detailsSubtitle: "We've negotiated room blocks at three nearby hotels and partnered with Lyft for attendee credits. Logistics shouldn't be the thing that makes you miss it.",
        details: [
          { label: "When",  value: "October 14–16, 2026", sub: "Wednesday through Friday" },
          { label: "Where", value: "Brooklyn Steel",      sub: "319 Frost St, Brooklyn, NY 11222" },
          { label: "Stay",  value: "Hotel block",         sub: "The William Vale · Wythe Hotel · The Box House" },
          { label: "Travel",value: "JFK / LGA / EWR",     sub: "Lyft credits emailed to ticket-holders" },
        ],
        rsvpEyebrow: "Tickets",
        rsvpHeadline: "Reserve your seat",
        rsvpSubtitle: "Tickets release in waves. The earliest waves get the best workshop slots and dinner spots — drop your details and we'll email you the moment your tier opens.",
        formSteps: [
          {
            title: "Your details",
            fields: [
              { id: "firstName", type: "text"   as const, label: "First Name", placeholder: "First name",         required: true },
              { id: "lastName",  type: "text"   as const, label: "Last Name",  placeholder: "Last name",          required: true },
              { id: "email",     type: "email"  as const, label: "Email",      placeholder: "you@example.com",    required: true },
              { id: "company",   type: "text"   as const, label: "Company",    placeholder: "Where you work",     required: false },
            ],
          },
        ],
        rsvpSubmitText: "Notify me when tickets open",
        rsvpSuccessMessage: "Thanks — keep an eye on your inbox.",
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
      id: id("photo-strip", 6),
      type: "photo-strip",
      props: {
        images: [
          { src: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80", alt: "Sponsor / Northwind" },
          { src: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&q=80", alt: "Sponsor / Latticework" },
          { src: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=400&q=80", alt: "Sponsor / Veridian" },
          { src: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80", alt: "Sponsor / Helix" },
          { src: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&q=80", alt: "Sponsor / Atlas" },
          { src: "https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=400&q=80", alt: "Sponsor / Fieldnotes" },
        ],
      },
    },
    {
      id: id("form", 7),
      type: "form",
      props: {
        headline: "RSVP for early access",
        subheadline: "Tickets release in waves. Drop your details and we'll email you the moment your tier opens.",
        multiStep: false,
        steps: [
          {
            title: "Your details",
            fields: [
              { id: "field-name",    type: "text",   label: "Full Name", placeholder: "Your name",          required: true },
              { id: "field-email",   type: "email",  label: "Email",      placeholder: "you@example.com",    required: true },
              { id: "field-company", type: "text",   label: "Company",    placeholder: "Where you work",     required: false },
              { id: "field-pass",    type: "select", label: "Interested pass", placeholder: "Select…",       required: true, options: ["Day pass ($299)", "Full conference ($799)", "Team of 5 ($2,995)"] },
            ],
          },
        ],
        submitButtonText: "Reserve my spot",
        successMessage: "You're on the list — watch your inbox for your early-access link.",
        redirectUrl: "",
        backgroundStyle: "white",
      },
    },
    {
      id: id("bottom-cta", 8),
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
  ogImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80",
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
      id: id("sticky-stack", 81),
      type: "sticky-stack",
      props: {
        eyebrow: "HOW IT WORKS",
        headline: "From kickoff to live, in three predictable steps.",
        bgColor: "#FAF7F2",
        cardScrollVh: 110,
        cards: [
          { tag: "STEP 01", title: "Kickoff in your first 24 hours.",     body: "We meet, scope your roadmap, and set up your Slack channel and Trello board. You file your first request before the day is out.",                imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80", imageSide: "right", bgColor: "#0F0F10", textColor: "#F5F2EC", accentColor: "#FF6B2C" },
          { tag: "STEP 02", title: "First draft in 48 hours.",            body: "A senior designer ships the first draft within two business days. You review in Figma, leave comments, and we iterate live.",                                imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80", imageSide: "left",  bgColor: "#1F1F2A", textColor: "#F5F2EC", accentColor: "#FF6B2C" },
          { tag: "STEP 03", title: "Final files. Production-ready.",      body: "Final assets, dev handoff, and a tidy file structure your team can actually maintain. Pause or resume the subscription whenever.",                            imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80", imageSide: "right", bgColor: "#0F0F10", textColor: "#F5F2EC", accentColor: "#FF6B2C" },
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
      id: id("form", 82),
      type: "form",
      props: {
        headline: "Start a project",
        subheadline: "Tell us about your team and what you'd ship first. We respond to every inquiry within one business day.",
        multiStep: false,
        steps: [
          {
            title: "Project intake",
            fields: [
              { id: "field-name",    type: "text",     label: "Full Name",  placeholder: "Your name",                   required: true },
              { id: "field-email",   type: "email",    label: "Email",       placeholder: "you@company.com",             required: true },
              { id: "field-company", type: "text",     label: "Company",     placeholder: "Where you work",              required: true },
              { id: "field-plan",    type: "select",   label: "Interested plan", placeholder: "Select…",                 required: true, options: ["Studio ($4,995/mo)", "Studio Pro ($8,995/mo)", "Embedded (custom)"] },
              { id: "field-first",   type: "textarea", label: "What would you ship in the first 30 days?", placeholder: "A landing page, brand refresh, dashboard…", required: false },
            ],
          },
        ],
        submitButtonText: "Request a call",
        successMessage: "Thanks — we'll be in touch within one business day to schedule a kickoff.",
        redirectUrl: "",
        backgroundStyle: "white",
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
