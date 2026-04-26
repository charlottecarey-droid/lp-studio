#!/usr/bin/env node
/**
 * Seed the block_catalog table with initial rows for industry="generic".
 *
 * Why we override almost every Dandy-flavored field
 * -------------------------------------------------
 * The frontend reads catalog rows and shallow-merges:
 *     { ...BLOCK_REGISTRY.defaultProps(), ...catalog.default_props }
 * So any field we leave out of `default_props` falls through to the
 * BLOCK_REGISTRY default — which for a lot of blocks contains Dandy logos,
 * dental unsplash photos, "Dandy" copy, and meetdandy.com URLs.
 *
 * Each row below carries `default_props` that COMPLETELY OVERRIDES every
 * leaky field for the row's block type. Rows for blocks whose registry
 * default is already neutral (e.g. trust-bar, form, comparison) pass `{}`.
 *
 * Idempotency / re-seeding
 * ------------------------
 * Rows tagged `force: true` use `ON CONFLICT … DO UPDATE` so corrected
 * defaults overwrite previously-seeded leaky rows. Rows without `force`
 * use `ON CONFLICT … DO NOTHING` so admin tweaks survive re-runs.
 *
 * For industry="dental": no rows are seeded — frontend falls back to
 * BLOCK_REGISTRY (which is intentionally Dandy-flavored).
 *
 * Usage:  node scripts/seed-block-catalog.cjs
 */
const path = require("path");
const { Pool } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

// Neutral office/work imagery for generic tenants — no dental, no clinical.
const NEUTRAL_OFFICE_IMG_1 = "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&h=600&fit=crop";
const NEUTRAL_OFFICE_IMG_2 = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=800&h=600&fit=crop";
const NEUTRAL_OFFICE_IMG_3 = "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&h=600&fit=crop";
const NEUTRAL_OFFICE_IMG_4 = "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=800&h=600&fit=crop";
const NEUTRAL_OFFICE_IMG_5 = "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=800&h=600&fit=crop";

const GENERIC_SEED = [
  // ── Layout ─────────────────────────────────────────────────────────────────
  { block_type: "hero", label: "Hero", category: "Layout", sort_order: 10, force: true,
    default_props: {
      headline: "Software your team will actually use",
      subheadline: "Cut onboarding time in half and keep every customer in the loop — from kickoff to renewal.",
      ctaText: "Start Free Trial",
      ctaUrl: "#",
      socialProofText: "Trusted by 500+ teams across SaaS, fintech, and ops",
      heroType: "static-image",
      backgroundStyle: "white",
      imageUrl: "",
    } },
  { block_type: "full-bleed-hero", label: "Full-Bleed Hero", category: "Layout", sort_order: 11, force: true,
    default_props: {
      headline: "Built for teams that ship",
      subheadline: "The all-in-one platform that replaces 5 tools — and pays for itself in a week.",
      ctaText: "Get Started",
      ctaUrl: "#",
      secondaryCtaText: "See How It Works",
      secondaryCtaUrl: "#",
      backgroundType: "image",
      backgroundImageUrl: NEUTRAL_OFFICE_IMG_1,
      backgroundVideoUrl: "",
      videoAutoplay: false,
      overlayOpacity: 55,
      minHeight: "full",
      contentAlignment: "left",
      logoImageUrl: "",
      logoUrl: "#",
      navLinks: [
        { label: "Product", url: "#" },
        { label: "Pricing", url: "#" },
        { label: "Resources", url: "#" },
      ],
      headerCtaText: "Get Started",
      headerCtaUrl: "#",
      headerScrolledBg: "#111111",
      showSocialProof: true,
      socialProofText: "Trusted by 500+ teams worldwide",
    } },
  { block_type: "photo-strip", label: "Photo Strip", category: "Layout", sort_order: 12, force: true,
    default_props: {
      images: [
        { src: NEUTRAL_OFFICE_IMG_1, alt: "Team collaboration" },
        { src: NEUTRAL_OFFICE_IMG_2, alt: "Workspace" },
        { src: NEUTRAL_OFFICE_IMG_3, alt: "Team meeting" },
        { src: NEUTRAL_OFFICE_IMG_4, alt: "Working together" },
        { src: NEUTRAL_OFFICE_IMG_5, alt: "Office life" },
      ],
    } },
  { block_type: "spacer", label: "Spacer", category: "Layout", sort_order: 13, default_props: {} },

  // ── Content ────────────────────────────────────────────────────────────────
  { block_type: "pas-section", label: "PAS Section", category: "Content", sort_order: 20, default_props: {
      headline: "Manual workflows are killing your margin.",
      body: "Every spreadsheet handoff is a missed update. Every Slack ping is a context switch. The teams winning today are the ones who stopped patching the gaps and started replacing them.",
      bullets: [
        "Hours lost every week to status meetings nobody wants",
        "No single source of truth — everyone has their own version",
        "Hand-rolled reporting that breaks every quarter",
        "Tools that don't talk to each other, ever",
      ],
    } },
  { block_type: "comparison", label: "Comparison", category: "Content", sort_order: 21, default_props: {
      headline: "A modern stack vs. the old way.",
      ctaText: "See It In Action",
      oldWayLabel: "The Old Way",
      oldWayBullets: [
        "Five tools duct-taped together",
        "Reports that take a day to compile",
        "Onboarding that drags on for weeks",
        "Tribal knowledge in someone's head",
      ],
      newWayLabel: "The Modern Way",
      newWayBullets: [
        "One unified platform, end to end",
        "Live dashboards updated in seconds",
        "Self-serve onboarding in under an hour",
        "Documented playbooks that scale with you",
      ],
    } },
  { block_type: "benefits-grid", label: "Benefits Grid", category: "Content", sort_order: 22, default_props: {
      headline: "Why fast-growing teams choose us",
      columns: 3,
      items: [
        { icon: "Zap",          title: "10x Faster Setup",       description: "Connect your stack in minutes — not the multi-week implementations your last vendor sold you." },
        { icon: "BarChart2",    title: "Real-Time Insights",     description: "Live dashboards your whole team can trust. No more waiting on the analytics team." },
        { icon: "RefreshCcw",   title: "Always-On Sync",         description: "Two-way sync with the tools you already use. Nothing slips through the cracks." },
        { icon: "HeadphonesIcon", title: "Human Support",        description: "A real CSM you can text. SLA-backed, time-zone aware, and actually helpful." },
        { icon: "ScanLine",     title: "Built-In Compliance",    description: "SOC 2, GDPR, and HIPAA-ready out of the box. Audit logs included." },
        { icon: "DollarSign",   title: "Transparent Pricing",    description: "Flat per-seat pricing. No hidden fees, no surprise bills, no annual lock-in." },
      ],
    } },
  { block_type: "how-it-works", label: "How It Works", category: "Content", sort_order: 23, default_props: {
      headline: "Up and running in three steps.",
      steps: [
        { number: "01", title: "Connect Your Stack", description: "Plug in the tools you already use. Native integrations, no engineering required." },
        { number: "02", title: "Import Your Data",   description: "We migrate your history overnight. You wake up to a fully populated workspace." },
        { number: "03", title: "Invite Your Team",   description: "Roll out to the whole team in a week — most users are productive on day one." },
      ],
    } },
  { block_type: "product-grid", label: "Product Grid", category: "Content", sort_order: 24, force: true,
    default_props: {
      headline: "One platform. Every workflow.",
      subheadline: "Replace your patchwork of point solutions with a single connected system.",
      items: [
        { image: "", title: "Workflow Automation", description: "Automate the repetitive work that's eating your team's week." },
        { image: "", title: "Real-Time Reporting", description: "Live dashboards built for execs and operators alike." },
        { image: "", title: "Team Collaboration",  description: "Comments, approvals, and audit trails right where the work happens." },
      ],
    } },
  { block_type: "product-showcase", label: "Product Showcase", category: "Content", sort_order: 25, force: true,
    default_props: {
      headline: "Everything your team needs",
      subheadline: "One connected platform — no more juggling vendors.",
      columns: 3,
      cards: [
        { name: "Automation",       description: "Workflow engine for the repetitive work that eats your week.",        badge: "INCLUDED" },
        { name: "Reporting",        description: "Live dashboards your CFO will trust on day one.",                     badge: "INCLUDED" },
        { name: "Integrations",     description: "100+ native connectors out of the box — no custom code.",             badge: "INCLUDED" },
        { name: "Collaboration",    description: "Comments, approvals, and audit trails right where work happens.",     badge: "INCLUDED" },
        { name: "Security",         description: "SOC 2 Type II, HIPAA-ready, GDPR-compliant out of the box.",          badge: "ENTERPRISE" },
        { name: "API & Webhooks",   description: "Build on top of us with a fully-documented REST API.",                badge: "DEVELOPER" },
      ],
    } },
  { block_type: "zigzag-features", label: "Zigzag Features", category: "Content", sort_order: 26, force: true,
    default_props: {
      rows: [
        {
          tag: "SPEED",
          headline: "Ship in days, not quarters",
          body: "Connect your stack in minutes and roll out to the whole team in a week. No multi-quarter implementations.",
          ctaText: "Learn more",
          ctaUrl: "#",
          imageUrl: NEUTRAL_OFFICE_IMG_1,
        },
        {
          tag: "RELIABILITY",
          headline: "Built for the work, not the demo",
          body: "Type-safe automations, audit-ready by default, and a 99.99% uptime SLA. Your team can finally trust the dashboard.",
          ctaText: "Learn more",
          ctaUrl: "#",
          imageUrl: NEUTRAL_OFFICE_IMG_2,
        },
      ],
    } },
  { block_type: "rich-text", label: "Rich Text", category: "Content", sort_order: 27, default_props: {} },
  { block_type: "video-section", label: "Video Section", category: "Content", sort_order: 28, default_props: {} },
  { block_type: "resources", label: "Resources", category: "Content", sort_order: 29, default_props: {
      headline: "Resources",
      subheadline: "Insights, guides, and articles to help you grow.",
      columns: 3,
      items: [
        { image: "", title: "Getting Started Guide", description: "Everything you need to know to hit the ground running.", category: "Guide", url: "#" },
        { image: "", title: "Best Practices for Growth", description: "Proven strategies from industry leaders.", category: "Article", url: "#" },
        { image: "", title: "2025 Industry Report",  description: "Key trends and benchmarks for the year ahead.", category: "Report", url: "#" },
      ],
    } },
  { block_type: "custom-html", label: "Custom HTML", category: "Content", sort_order: 30, default_props: {} },

  // ── Social Proof ───────────────────────────────────────────────────────────
  { block_type: "trust-bar", label: "Trust Bar", category: "Social Proof", sort_order: 40, default_props: {
      items: [
        { value: "500+",   label: "Teams Onboarded" },
        { value: "98%",    label: "Customer Retention" },
        { value: "4.9★",   label: "G2 Rating" },
        { value: "<1 hr",  label: "Avg. Time to Value" },
      ],
    } },
  { block_type: "stat-callout", label: "Stat Callout", category: "Social Proof", sort_order: 41, default_props: {
      stat: "73%",
      description: "Average reduction in manual reporting time after switching",
      footnote: "Based on customer surveys conducted in the first 90 days.",
    } },
  { block_type: "testimonial", label: "Testimonial", category: "Social Proof", sort_order: 42, default_props: {
      quote: "We replaced three tools and saved an entire FTE in the first quarter. Our team actually enjoys using it — that's the part I didn't expect.",
      author: "Jamie Patel",
      role: "VP of Operations",
      practiceName: "Northwind Logistics",
    } },
  { block_type: "case-studies", label: "Case Studies", category: "Social Proof", sort_order: 43, default_props: {
      headline: "Customer Stories",
      subheadline: "See how teams like yours unlocked growth.",
      items: [
        { image: "", logoUrl: "", title: "How Acme cut onboarding time by 60%",      categories: "SOFTWARE & TECHNOLOGY / ENTERPRISE", url: "#" },
        { image: "", logoUrl: "", title: "Beacon saves 100+ hours a month on ops",    categories: "PUBLIC SECTOR / MID-SIZE",          url: "#" },
        { image: "", logoUrl: "", title: "From 2 months to 2 days: audits cut in half", categories: "FINANCE / ENTERPRISE",            url: "#" },
      ],
    } },

  // ── CTA ────────────────────────────────────────────────────────────────────
  { block_type: "bottom-cta", label: "Bottom CTA", category: "CTA", sort_order: 50, default_props: {
      headline: "Ready to ship faster?",
      subheadline: "Free for 14 days. No credit card required.",
      ctaText: "Start Free Trial",
      ctaUrl: "#",
    } },
  { block_type: "cta-button", label: "CTA Button", category: "CTA", sort_order: 51, force: true,
    default_props: {
      label: "Get Started",
      url: "#",
      style: "primary",
      size: "medium",
      alignment: "center",
      // No hardcoded brand color — let block-level styling fall through to the
      // tenant's brand variables.
      bgColor: "",
    } },

  // ── Lead Capture ───────────────────────────────────────────────────────────
  { block_type: "form", label: "Form", category: "Lead Capture", sort_order: 60, default_props: {} },

  // ── Engagement ─────────────────────────────────────────────────────────────
  { block_type: "popup", label: "Popup", category: "Engagement", sort_order: 70, force: true,
    default_props: {
      headline: "Special Offer Inside",
      body: "Get 20% off your first order when you sign up today.",
      ctaText: "Claim Offer",
      ctaUrl: "#",
      ctaColor: "",
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
    } },
  { block_type: "sticky-bar", label: "Sticky Bar", category: "Engagement", sort_order: 71, force: true,
    default_props: {
      text: "Limited time: Get 20% off your first purchase",
      ctaText: "Shop Now",
      ctaUrl: "#",
      ctaColor: "",
      position: "top",
      backgroundStyle: "dark",
      showAfterScroll: 0,
      dismissible: true,
    } },
  { block_type: "sticky-header", label: "Sticky Header", category: "Engagement", sort_order: 72, force: true,
    default_props: {
      logoUrl: "",
      logoAlt: "",
      companyName: "",
      navLinks: [
        { label: "Product",  href: "#product"  },
        { label: "Solutions",href: "#solutions"},
        { label: "Pricing",  href: "#pricing"  },
        { label: "Resources",href: "#resources"},
      ],
      primaryCtaText: "Get Started",
      primaryCtaUrl: "#",
      theme: "dark",
      position: "fixed",
      scrollThreshold: 40,
    } },
  { block_type: "nav-header", label: "Nav Header", category: "Layout", sort_order: 14, force: true,
    default_props: {
      // Empty logoText falls through to brand.brandName at render time.
      logoText: "",
      logoUrl: "",
      navLinks: [
        { label: "Product",  url: "#" },
        { label: "Pricing",  url: "#" },
        { label: "Resources",url: "#" },
      ],
      // No phone — tenants opt in.
      phone: "",
      cta1: { label: "Log In",       url: "#" },
      cta2: { label: "Get Started",  url: "#" },
    } },
  { block_type: "footer", label: "Footer", category: "Layout", sort_order: 15, force: true,
    default_props: {
      // Solid neutral dark — block-level overrides only kick in when a tenant
      // sets them. Brand vars on the page wrapper continue to dominate.
      backgroundColor: "#111111",
      accentColor: "",
      // Empty copyrightText falls through to BrandFooterCopyright (which uses
      // brand.copyrightName, not "Dandy").
      copyrightText: "",
      showSocialLinks: false,
      facebookUrl: "",
      instagramUrl: "",
      linkedinUrl: "",
      columns: [
        {
          title: "Product",
          links: [
            { label: "Features", url: "#" },
            { label: "Pricing",  url: "#" },
            { label: "Roadmap",  url: "#" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About",    url: "#" },
            { label: "Customers",url: "#" },
            { label: "Careers",  url: "#" },
            { label: "Contact",  url: "#" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Docs",       url: "#" },
            { label: "Blog",       url: "#" },
            { label: "Changelog",  url: "#" },
          ],
        },
        {
          title: "Legal",
          links: [
            { label: "Privacy",    url: "#" },
            { label: "Terms",      url: "#" },
            { label: "Security",   url: "#" },
          ],
        },
      ],
    } },

  // ── Interactive ────────────────────────────────────────────────────────────
  { block_type: "roi-calculator", label: "ROI Calculator", category: "Interactive", sort_order: 80, force: true,
    default_props: {
      headline: "Calculate Your ROI",
      subheadline: "Estimate the impact of switching across your team.",
      backgroundStyle: "white",
      resultsPanelLabel: "Your Results",
      disclaimer: "Calculations based on customer estimates. Actual results may vary.",
      ctaEnabled: true,
      ctaText: "Book a Demo",
      ctaUrl: "#",
      ctaAction: "url",
      chilipiperUrl: "",
      inputFields: [
        { id: "teams",        label: "Number of Teams",            defaultValue: 5,    min: 1,   max: 500,   step: 1,   inputType: "number" },
        { id: "seats",        label: "Total Seats",                defaultValue: 50,   min: 1,   max: 5000,  step: 1,   inputType: "number" },
        { id: "hoursPerWeek", label: "Hours / Week on Manual Work",defaultValue: 8,    min: 0.5, max: 40,    step: 0.5, suffix: " hrs", inputType: "slider" },
        { id: "hourlyCost",   label: "Average Loaded Hourly Cost", defaultValue: 75,   min: 20,  max: 500,   step: 5,   prefix: "$", inputType: "number" },
        { id: "weeksPerYear", label: "Working Weeks / Year",       defaultValue: 48,   min: 1,   max: 52,    step: 1,   inputType: "number" },
      ],
      outputFields: [
        { id: "hoursSavedYear",  label: "Hours Saved / Year",          formula: "seats * hoursPerWeek * weeksPerYear * 0.5",                              format: "number",   decimals: 0 },
        { id: "dollarsSavedYear",label: "Dollars Saved / Year",        formula: "seats * hoursPerWeek * weeksPerYear * 0.5 * hourlyCost",                  format: "currency", decimals: 0 },
        { id: "totalUpside",     label: "Total Annual Upside",         formula: "(seats * hoursPerWeek * weeksPerYear * 0.5 * hourlyCost) * teams",        format: "currency", decimals: 0, highlight: true },
      ],
    } },

  // ── Reused DSO blocks (visually generic) — exposed under existing categories
  { block_type: "dso-stat-bar", label: "Stat Bar (Animated)", category: "Social Proof", sort_order: 44,
    default_props: { stats: [
      { value: "500+", label: "Teams" },
      { value: "98%",  label: "Retention" },
      { value: "10x",  label: "Faster" },
      { value: "4.9★", label: "Rating" },
    ] } },
  { block_type: "dso-stat-row", label: "Stat Row", category: "Social Proof", sort_order: 45,
    default_props: { eyebrow: "By the numbers", headline: "Numbers our customers trust", items: [
      { value: "73%",  label: "Less reporting time", detail: "Average across 200 customers" },
      { value: "10x",  label: "Faster onboarding",   detail: "From weeks to hours" },
      { value: "4.9",  label: "G2 rating",           detail: "From 800+ verified reviews" },
    ] } },
  { block_type: "dso-stat-showcase", label: "Stat Showcase", category: "Social Proof", sort_order: 46,
    default_props: { eyebrow: "Impact", headline: "Built to move the needle", stats: [
      { value: "73%", label: "Less reporting time", description: "Average reduction in week-1 reporting overhead" },
      { value: "10x", label: "Faster onboarding",   description: "From multi-week rollouts to same-day" },
      { value: "98%", label: "Retention",           description: "Customers who renew at year one" },
    ] } },
  { block_type: "dso-success-stories", label: "Success Stories", category: "Social Proof", sort_order: 47,
    default_props: { eyebrow: "Customer Stories", headline: "How teams win with us", cases: [
      { name: "Acme",     stat: "60%", label: "Faster onboarding", quote: "We rolled out to 200 people in a week.", author: "Jamie · COO" },
      { name: "Northwind",stat: "$1.2M", label: "Annual savings",   quote: "It paid for itself the first quarter.", author: "Priya · VP Ops" },
      { name: "Globex",   stat: "4.9★", label: "Internal NPS",      quote: "The team actually likes the new system.", author: "Marco · Director" },
    ] } },
  { block_type: "dso-testimonials", label: "Testimonials Grid", category: "Social Proof", sort_order: 48,
    default_props: { eyebrow: "What our customers say", headline: "Loved by teams of every size", testimonials: [
      { quote: "Best onboarding I've seen in 10 years.", author: "Sarah K.", location: "VP Eng" },
      { quote: "We replaced three tools in a month.",     author: "Tom L.",   location: "Head of Ops" },
      { quote: "The CSM actually returns calls.",         author: "Mei R.",   location: "Director, RevOps" },
    ] } },

  { block_type: "dso-challenges", label: "Challenges Grid", category: "Content", sort_order: 31,
    default_props: { eyebrow: "Why teams switch", headline: "The cost of doing nothing", layout: "4-col", challenges: [
      { title: "Shadow IT",        desc: "Every team has its own spreadsheet. None of them agree." },
      { title: "Slow Reporting",   desc: "Friday's numbers don't show up till Tuesday." },
      { title: "Fragile Pipelines",desc: "One vendor change breaks the whole stack." },
      { title: "Tool Sprawl",      desc: "You're paying for 14 tools and using 4 well." },
    ] } },
  { block_type: "dso-problem", label: "Problem Highlight", category: "Content", sort_order: 32,
    default_props: { eyebrow: "The problem", headline: "Your stack is fighting you.", body: "Modern teams don't lose to competitors — they lose to internal friction. Here's where it shows up.",
      panels: [
        { icon: "alert-triangle", title: "Manual everything",   desc: "Repetitive copy/paste between tools" },
        { icon: "clock",          title: "Slow cycle times",     desc: "Days of lag between request and response" },
        { icon: "users",          title: "Onboarding bottleneck",desc: "New hires take a quarter to ramp" },
        { icon: "trending-down",  title: "Margin leak",          desc: "Hidden costs no dashboard catches" },
      ], statValue: "73%", statLabel: "of revenue ops time spent on plumbing" } },
  { block_type: "dso-paradigm-shift", label: "Old Way / New Way", category: "Content", sort_order: 33,
    default_props: { eyebrow: "The shift", headline: "From patchwork to platform", subheadline: "What changes when you stop duct-taping tools together.",
      oldWayLabel: "Then", newWayLabel: "Now",
      oldWayItems: ["Five tools, none integrated", "Excel as a database", "Reports built by hand", "Slack as a project tracker"],
      newWayItems: ["One platform, fully synced", "Live data, single source", "Dashboards that update themselves", "Workflows with audit trails"] } },
  { block_type: "dso-split-feature", label: "Split Feature", category: "Content", sort_order: 34,
    default_props: { eyebrow: "Capability", headline: "Built for the work, not the demo.", body: "Every feature is shaped by real customer feedback — and ships behind a flag for safety.",
      bullets: ["Type-safe automations", "Audit-ready by default", "Works offline", "Scales from 5 to 5,000"] } },
  { block_type: "dso-ai-feature", label: "AI Feature Highlight", category: "Content", sort_order: 35,
    default_props: { eyebrow: "AI built in", headline: "Smart suggestions, not surveillance.", body: "Our AI helps your team move faster — without ever guessing at your data.",
      bullets: ["Inline suggestions while you work","Always-on summarization","Auto-categorize new items","Privacy-first: nothing leaves your tenant"],
      stats: [{ value: "40%", label: "Faster ticket resolution" },{ value: "10x", label: "Less manual triage" }],
      imageUrl: "" } },
  { block_type: "dso-software-showcase", label: "Software Showcase", category: "Content", sort_order: 36,
    default_props: { eyebrow: "Product", headline: "See it in action", body: "Live workflows, live data, no demo magic." } },
  { block_type: "dso-bento-outcomes", label: "Bento Grid", category: "Content", sort_order: 37,
    default_props: { eyebrow: "Outcomes", headline: "What our customers actually get",
      tiles: [
        { type: "stat",    value: "73%", label: "Less manual work" },
        { type: "feature", headline: "Native integrations", body: "Works with the tools you already use." },
        { type: "stat",    value: "10x", label: "Faster onboarding" },
        { type: "quote",   quote: "Best ROI we've ever booked.", author: "Priya, VP Ops" },
        { type: "feature", headline: "Audit-ready", body: "SOC 2, HIPAA, GDPR — all out of the box." },
        { type: "stat",    value: "4.9★",label: "G2 rating" },
      ] } },
  { block_type: "dso-flow-canvas", label: "Quote Canvas", category: "Content", sort_order: 38,
    default_props: { eyebrow: "What customers say", quote: "It replaced three tools and freed up an FTE in the first quarter.", attribution: "Jamie Patel, VP Ops · Northwind", stat: "$240K", statLabel: "Annual savings" } },

  { block_type: "dso-promises", label: "Promises", category: "Content", sort_order: 39,
    default_props: { eyebrow: "What you can count on", headline: "Three promises, in writing",
      promises: [
        { icon: "shield",   title: "Always-on uptime",   desc: "99.99% SLA, monitored 24/7." },
        { icon: "clock",    title: "1-hour response",    desc: "Real humans answer support tickets fast." },
        { icon: "scale",    title: "Fair pricing",       desc: "No surprise bills. Cancel anytime." },
      ] } },
  { block_type: "dso-promo-cards", label: "Promo Cards", category: "Content", sort_order: 40,
    default_props: { eyebrow: "Offers", headline: "Built to get you started",
      cards: [
        { title: "Free for 14 days", desc: "Full feature access, no credit card needed.", badge: "Most popular" },
        { title: "Concierge migration", desc: "We'll move your data over the weekend." },
        { title: "Annual discount", desc: "Save 20% when you go yearly." },
      ] } },

  { block_type: "dso-products-grid", label: "Products Grid", category: "Content", sort_order: 41,
    default_props: { eyebrow: "What you get", headline: "Everything in one place",
      products: [
        { name: "Automation",  detail: "Workflow engine for the repetitive work.",     price: "Included" },
        { name: "Reporting",   detail: "Live dashboards your CFO will trust.",         price: "Included" },
        { name: "Integrations",detail: "100+ native connectors out of the box.",       price: "Included" },
      ] } },

  { block_type: "dso-meet-team", label: "Meet the Team", category: "Content", sort_order: 42,
    default_props: { eyebrow: "Your account team", headline: "Real humans, time-zone aware",
      members: [
        { name: "Alex Rivera",  role: "Customer Success Manager" },
        { name: "Priya Shah",   role: "Onboarding Specialist" },
        { name: "Marcus Chen",  role: "Solutions Engineer" },
      ] } },

  { block_type: "dso-final-cta", label: "Final CTA", category: "CTA", sort_order: 52, force: true,
    default_props: {
      eyebrow: "Next Steps",
      headline: "Ready when you are",
      subheadline: "Start a focused pilot, measure the impact, and scale on your terms.",
      primaryCtaText: "Get Pricing",
      primaryCtaUrl: "#",
      secondaryCtaText: "Book a Demo",
      secondaryCtaUrl: "#",
      // 'muted' is a neutral surface; 'dandy-green' would force the Dandy
      // forest backdrop for non-Dandy tenants. Keep it neutral and let
      // tenants opt into a brand-colored variant.
      backgroundStyle: "muted",
    } },
  { block_type: "dso-cta-capture", label: "Inline CTA Capture", category: "Lead Capture", sort_order: 61,
    default_props: { eyebrow: "Get a demo", headline: "See it in action", body: "Pick a time that works for you.", inputLabel: "Work email", inputPlaceholder: "you@company.com", ctaLabel: "Book a demo", trust1: "No credit card", trust2: "30-min walkthrough", trust3: "Free trial after" } },
  { block_type: "dso-comparison", label: "Animated Comparison", category: "Content", sort_order: 43, force: true,
    default_props: {
      eyebrow: "The Difference",
      headline: "A modern stack vs. the old way.",
      subheadline: "What changes when you stop duct-taping tools together.",
      companyName: "Your Team",
      ctaText: "Request a Demo",
      ctaUrl: "#",
      rows: [],
      backgroundStyle: "muted",
    } },
  { block_type: "dso-faq", label: "FAQ", category: "Content", sort_order: 44,
    default_props: { eyebrow: "FAQ", headline: "Common questions",
      items: [
        { question: "How long does setup take?", answer: "Most teams are live within a day. We handle the migration." },
        { question: "What integrates out of the box?", answer: "We support 100+ tools natively, including Slack, HubSpot, Salesforce, Stripe, and Notion." },
        { question: "Is my data secure?", answer: "SOC 2 Type II certified, HIPAA-ready, and GDPR-compliant. Your data never leaves your tenant." },
      ] } },
  { block_type: "dso-activation-steps", label: "Activation Steps", category: "Content", sort_order: 45,
    default_props: { eyebrow: "Getting started", headline: "From signup to live in 3 steps",
      steps: [
        { step: "01", title: "Connect your tools",  desc: "OAuth in, no IT ticket required." },
        { step: "02", title: "Import your data",    desc: "Overnight migration, fully reversible." },
        { step: "03", title: "Invite your team",    desc: "Role-based access, SSO ready." },
      ] } },
  { block_type: "dso-pilot-steps", label: "Pilot Steps", category: "Content", sort_order: 46, force: true,
    default_props: {
      eyebrow: "How It Works",
      headline: "Start small. Prove it out. Then scale.",
      subheadline: "Validate the impact with a focused pilot — then roll out across the rest of the org with confidence.",
      backgroundStyle: "muted",
      steps: [
        {
          title: "Launch a Pilot",
          subtitle: "Start with one team",
          desc: "Get up and running in days. We deploy the platform, onboard your team, and integrate into existing workflows — no heavy lift required.",
          details: [
            "Full access to every feature from day one",
            "Dedicated onboarding specialist",
            "Live in days, not weeks",
          ],
        },
        {
          title: "Validate Impact",
          subtitle: "Measure results in 60–90 days",
          desc: "Track adoption, time saved, and outcome metrics in real time — so you can prove ROI before you scale.",
          details: [
            "Live dashboard tracks pilot KPIs",
            "Compare pilot team vs. control",
            "Executive-ready reporting for leadership review",
          ],
        },
        {
          title: "Scale With Confidence",
          subtitle: "Roll out across the org",
          desc: "Expand across the rest of your teams with the same playbook and the same results — predictable execution at scale.",
          details: [
            "Consistent onboarding everywhere",
            "One standard across every team",
            "Network-wide alignment built in",
          ],
        },
      ],
    } },

  { block_type: "dso-scroll-story", label: "Scroll Story", category: "Engagement", sort_order: 73, force: true,
    default_props: {
      eyebrow: "Why teams choose us",
      sectionHeading: "How our platform transforms your operation",
      sectionSubheading: "Scroll to explore each pillar of the platform.",
      chapters: [
        { headline: "One platform across every location.", body: "Replace fragmented tooling with a single source of truth — standardizing quality, pricing, and reporting across your network.", imageUrl: "" },
        { headline: "Catch problems before they cost you.", body: "Built-in checks validate every workflow in real time, before they become expensive remakes downstream.", imageUrl: "" },
        { headline: "Executive visibility, instantly.", body: "A real-time dashboard shows leadership the metrics that matter — by location, by region, by brand. Manage by exception, not by spreadsheet.", imageUrl: "" },
        { headline: "Prove ROI, then scale.", body: "Validate impact at a small number of locations first — measuring the lift you care about — before committing to a full rollout.", imageUrl: "" },
      ],
    } },
  { block_type: "dso-scroll-story-hero", label: "Scroll Story Hero", category: "Engagement", sort_order: 74, force: true,
    default_props: {
      eyebrow: "Why teams choose us",
      chapters: [
        { headline: "One platform. Every location.", body: "Become your single source of truth — standardizing quality, pricing, and reporting across every site in your network.", imageUrl: "" },
        { headline: "Catch problems before they happen.", body: "Real-time checks validate every workflow before issues become costly downstream.", imageUrl: "" },
        { headline: "Executive visibility, by site and region.", body: "Dashboards give leadership insight into the metrics that matter, in real time. Manage by exception, not by spreadsheet.", imageUrl: "" },
        { headline: "Prove ROI, then scale.", body: "Validate impact at a small number of locations first, then expand with confidence.", imageUrl: "" },
      ],
      ctaText: "Request a Demo",
      ctaUrl: "#",
    } },
  { block_type: "dso-particle-mesh", label: "Particle Mesh", category: "Engagement", sort_order: 75, force: true,
    default_props: {
      eyebrow: "Built on a modern stack", headline: "Powered by your live data",
      body: "Every screen is fed by real-time pipelines. No batch jobs. No stale dashboards.",
      stat1Value: "10ms", stat1Label: "Median query time",
      stat2Value: "99.99%", stat2Label: "Uptime SLA",
      stat3Value: "0", stat3Label: "Manual refreshes",
      imageUrl: "" } },
  { block_type: "dso-network-map", label: "Network Map", category: "Engagement", sort_order: 76, force: true,
    default_props: {
      eyebrow: "Global",
      headline: "Customers in 40+ countries",
      body: "Built to scale wherever your team is.",
      ctaText: "See coverage",
      ctaUrl: "#",
      hubLabel: "",
    } },
  { block_type: "dso-live-feed", label: "Live Feed", category: "Engagement", sort_order: 77, force: true,
    default_props: {
      eyebrow: "Platform Intelligence",
      headline: "See everything.\nAct on what matters.",
      body: "Every metric from every location, streaming in real time. Turn raw operational data into executive-ready intelligence — automatically.",
      footerNote: "Live data across your network",
    } },
  { block_type: "dso-case-flow", label: "Case Flow", category: "Engagement", sort_order: 78, force: true,
    default_props: {
      eyebrow: "How it works",
      headline: "From request to delivery, in days.",
      subheadline: "Every workflow follows the same precise, validated path — regardless of which location submits it.",
      // Empty stages arrays trigger a Dandy-flavored DEFAULT_STAGES fallback in
      // the component. Provide neutral 4-step content here instead.
      stages: [
        { number: "01", label: "Submit", metric: "< 1 min", metricLabel: "Avg submission time", body: "Kick off a request from any location with a streamlined intake form." },
        { number: "02", label: "Validate", metric: "Real-time", metricLabel: "Automated checks", body: "Built-in validation catches issues before they propagate downstream." },
        { number: "03", label: "Route", metric: "Auto", metricLabel: "Routing", body: "Requests are routed to the right team based on rules you control." },
        { number: "04", label: "Deliver", metric: "Days", metricLabel: "Typical turnaround", body: "Track every step end-to-end with full visibility into status and SLA." },
      ],
    } },
  { block_type: "dso-case-study", label: "Case Study", category: "Social Proof", sort_order: 49, force: true,
    default_props: {
      eyebrow: "Customer Story",
      headline: "How a multi-location operator unlocked measurable ROI",
      subheadline: "A real-world look at the operational gains that come from standardizing on one platform across every site.",
      stats: [
        { value: "—", label: "Outcome metric" },
        { value: "—", label: "Hours recovered" },
        { value: "—", label: "Hard cost savings" },
        { value: "—", label: "Total annualized value" },
      ],
      challenge: { heading: "The Challenge", body: "Describe the customer's situation before adopting the platform — fragmented tooling, manual workflows, growing operational cost." },
      solution: { heading: "The Solution", body: "Describe how the customer rolled out the platform across their network — pilot first, then standardized rollout, with measurable outcomes at each phase." },
      quote: "Replace this quote with a real customer testimonial.",
      results: [
        { value: "—", label: "Result one", description: "Short description of what changed and by how much." },
        { value: "—", label: "Result two", description: "Short description of what changed and by how much." },
        { value: "—", label: "Result three", description: "Short description of what changed and by how much." },
        { value: "—", label: "Result four", description: "Short description of what changed and by how much." },
      ],
      whyItMatters: { heading: "Why It Matters", body: "Tie the result back to a broader business outcome — revenue, capacity, or efficiency at scale." },
    } },
];

module.exports = { GENERIC_SEED };

if (require.main === module) (async () => {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL });
  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of GENERIC_SEED) {
      const force = row.force === true;
      const sql = force
        ? `INSERT INTO block_catalog (block_type, industry, label, category, default_props, sort_order)
           VALUES ($1, 'generic', $2, $3, $4, $5)
           ON CONFLICT (block_type, industry) DO UPDATE
             SET label         = EXCLUDED.label,
                 category      = EXCLUDED.category,
                 default_props = EXCLUDED.default_props,
                 sort_order    = EXCLUDED.sort_order
           RETURNING (xmax = 0) AS inserted`
        : `INSERT INTO block_catalog (block_type, industry, label, category, default_props, sort_order)
           VALUES ($1, 'generic', $2, $3, $4, $5)
           ON CONFLICT (block_type, industry) DO NOTHING
           RETURNING block_type`;
      const r = await pool.query(sql, [
        row.block_type, row.label, row.category,
        JSON.stringify(row.default_props ?? {}), row.sort_order ?? 0,
      ]);
      if (force) {
        if (r.rows[0]?.inserted) inserted++; else updated++;
      } else {
        if (r.rowCount) inserted++; else skipped++;
      }
    }
    const c = await pool.query(`SELECT industry, COUNT(*)::int AS n FROM block_catalog GROUP BY industry ORDER BY industry`);
    console.log(`[seed] inserted=${inserted} updated=${updated} skipped=${skipped}`);
    console.log(`[seed] catalog totals:`, c.rows);
  } catch (e) {
    console.error("[seed] error:", e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
