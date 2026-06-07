// Showcase global templates — six polished, purpose-built full-page landing
// pages composed from the existing block library (mirrors the multi-block
// authoring model used by flagshipTemplates / GENERIC_TEMPLATE_SEEDS). Each
// targets a specific conversion archetype the marketing homepage previewer
// features:
//   1. ROI / business-case report   (global-roi-business-case)
//   2. Lead magnet download         (global-lead-magnet)
//   3. Book-a-demo / sales call     (global-book-demo)
//   4. Comparison / us vs them      (global-comparison-switch)
//   5. SaaS / product launch        (global-saas-launch)
//   6. Single-feature deep dive     (global-feature-deep-dive)
//
// Block JSON shapes mirror the props expected by BlockRenderer / BLOCK_REGISTRY.
// Anything omitted falls back to per-type defaults in the renderer.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const sid = (slug: string, type: string, n: number) => `seed-${slug}-${type}-${n}`;

function navBlock(
  slug: string,
  brand: string,
  links: { label: string; url: string }[],
  cta: { label: string; url: string },
  accent: string,
): Block {
  return {
    id: sid(slug, "nav-header", 1),
    type: "nav-header",
    props: {
      logoText: brand,
      logoUrl: "",
      navLinks: links,
      phone: "",
      cta1: { label: "Sign in", url: "#" },
      cta2: { label: cta.label, url: cta.url },
      accentColor: accent,
    },
  };
}

function footerBlock(slug: string, brand: string, accent: string): Block {
  return {
    id: sid(slug, "footer", 99),
    type: "footer",
    props: {
      backgroundColor: "#0F172A",
      accentColor: accent,
      copyrightText: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
      showSocialLinks: true,
      facebookUrl: "#",
      instagramUrl: "#",
      linkedinUrl: "#",
      columns: [
        {
          title: "Product",
          links: [
            { label: "Features", url: "#" },
            { label: "Pricing", url: "#" },
            { label: "Customers", url: "#" },
            { label: "Changelog", url: "#" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", url: "#" },
            { label: "Careers", url: "#" },
            { label: "Contact", url: "#contact" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Help Center", url: "#" },
            { label: "Privacy", url: "#" },
            { label: "Terms", url: "#" },
          ],
        },
      ],
    },
  };
}

// ── 1. ROI / business-case report ────────────────────────────────────────────

const ROI = "global-roi-business-case";
const ROI_ACCENT = "#047857";
const roiTemplate: GlobalTemplateSeed = {
  slug: ROI,
  title: "ROI / Business-Case Report",
  templateLabel: "ROI / Business-Case Report",
  templateDescription:
    "An executive-grade business case: a hard-numbers hero, an interactive ROI calculator, payback proof stats, and a buyer-ready summary. Built to win budget approval.",
  ogImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=630&fit=crop",
  industry: "generic",
  premiumRank: 24,
  blocks: [
    navBlock(
      ROI,
      "Meridian",
      [
        { label: "The case", url: "#case" },
        { label: "Calculator", url: "#roi" },
        { label: "Proof", url: "#proof" },
      ],
      { label: "Get the report", url: "#roi" },
      ROI_ACCENT,
    ),
    {
      id: sid(ROI, "hero", 2),
      type: "hero",
      props: {
        eyebrow: "Business Case",
        headlineSize: "lg",
        headline: "Prove the return before you spend the budget.",
        subheadline:
          "A board-ready business case that turns Meridian into a line item your CFO approves — quantified payback, conservative assumptions, and the math behind every number.",
        ctaText: "Build my ROI report",
        ctaUrl: "#roi",
        ctaColor: ROI_ACCENT,
        secondaryCtaText: "See the proof",
        secondaryCtaUrl: "#proof",
        heroType: "static-image",
        layout: "split-right",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "Used in 1,400+ approved budget proposals",
        imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1600&h=900&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: sid(ROI, "trust-bar", 3),
      type: "trust-bar",
      props: {
        items: [
          { value: "312%", label: "Avg. 3-yr ROI" },
          { value: "4.7 mo", label: "Payback period" },
          { value: "$1.4M", label: "Avg. annual savings" },
          { value: "0", label: "Hidden assumptions" },
        ],
      },
    },
    {
      id: sid(ROI, "roi-calculator", 4),
      type: "roi-calculator",
      props: {
        headline: "Calculate your own return",
        subheadline:
          "Plug in your team's numbers. We use conservative, defensible assumptions so the result holds up in the room.",
        ctaEnabled: true,
        ctaText: "Email me the full report",
        ctaUrl: "#case",
        backgroundStyle: "tinted",
        accentColor: ROI_ACCENT,
        inputFields: [
          { id: "headcount", label: "Team size", defaultValue: 50, suffix: "people" },
          { id: "avg_salary", label: "Avg. fully-loaded salary", defaultValue: 120000, prefix: "$" },
          { id: "hours_lost", label: "Hours lost weekly per person", defaultValue: 6, suffix: "hrs" },
        ],
        outputFields: [
          { id: "annual_savings", label: "Annual savings", prefix: "$" },
          { id: "payback", label: "Payback period", suffix: "months" },
          { id: "roi", label: "3-year ROI", suffix: "%" },
        ],
      },
    },
    {
      id: sid(ROI, "stat-callout", 5),
      type: "stat-callout",
      props: {
        stat: "$1.4M",
        description: "in annual operating savings, realized within the first two quarters of rollout",
        footnote: "Based on the median result across 200+ deployments.",
      },
    },
    {
      id: sid(ROI, "benefits-grid", 6),
      type: "benefits-grid",
      props: {
        headline: "Everything your approver needs in one place",
        columns: 3,
        items: [
          { icon: "Calculator", title: "Quantified payback", description: "A defensible model with every assumption shown — no black boxes." },
          { icon: "ShieldCheck", title: "Risk & sensitivity", description: "Best, base, and worst case so the downside is on the table too." },
          { icon: "TrendingUp", title: "Cost of inaction", description: "What another year on the status quo actually costs you." },
          { icon: "FileText", title: "Exec summary", description: "A one-page brief written for the budget meeting, not the demo." },
          { icon: "Clock", title: "Time-to-value", description: "A realistic rollout timeline mapped to when savings land." },
          { icon: "LineChart", title: "Benchmark data", description: "How peers in your segment performed after switching." },
        ],
      },
    },
    {
      id: sid(ROI, "testimonial", 7),
      type: "testimonial",
      props: {
        quote:
          "I walked into the budget review with the Meridian business case and walked out with a yes in eleven minutes. The numbers held up because every assumption was right there.",
        author: "David Okafor",
        role: "VP Finance",
        practiceName: "Northwind Logistics",
      },
    },
    {
      id: sid(ROI, "how-it-works", 8),
      type: "how-it-works",
      props: {
        headline: "From numbers to approved budget",
        steps: [
          { number: "01", title: "Enter your inputs", description: "Three numbers you already know give you a tailored model." },
          { number: "02", title: "Get the report", description: "A branded, board-ready PDF with the full methodology attached." },
          { number: "03", title: "Win the room", description: "Walk into the review with the math already done — and defensible." },
        ],
      },
    },
    {
      id: sid(ROI, "bottom-cta", 9),
      type: "bottom-cta",
      props: {
        headline: "Build the business case in under two minutes.",
        subheadline: "No sales call required. Get the full report in your inbox.",
        ctaText: "Build my ROI report",
        ctaUrl: "#roi",
      },
    },
    footerBlock(ROI, "Meridian", ROI_ACCENT),
  ],
};

// ── 2. Lead magnet download ──────────────────────────────────────────────────

const LEAD = "global-lead-magnet";
const LEAD_ACCENT = "#4F46E5";
const leadMagnetTemplate: GlobalTemplateSeed = {
  slug: LEAD,
  title: "Lead Magnet Download",
  templateLabel: "Lead Magnet Download",
  templateDescription:
    "A focused download page for an ebook, guide, or report. Value-packed hero, what's-inside grid, a single gated form, and social proof. Built to capture qualified leads.",
  ogImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1200&h=630&fit=crop",
  industry: "generic",
  premiumRank: 25,
  blocks: [
    navBlock(
      LEAD,
      "Fieldnotes",
      [
        { label: "What's inside", url: "#inside" },
        { label: "Reviews", url: "#reviews" },
      ],
      { label: "Get the guide", url: "#download" },
      LEAD_ACCENT,
    ),
    {
      id: sid(LEAD, "hero", 2),
      type: "hero",
      props: {
        eyebrow: "Free 2026 Field Guide",
        headlineSize: "lg",
        headline: "The B2B Growth Playbook for the AI era.",
        subheadline:
          "48 pages of channel benchmarks, hard CAC numbers, and the plays the fastest-growing teams are running right now. No fluff — just what's working.",
        ctaText: "Download the free guide",
        ctaUrl: "#download",
        ctaColor: LEAD_ACCENT,
        heroType: "static-image",
        layout: "split-right",
        backgroundStyle: "tinted",
        showSocialProof: true,
        socialProofText: "Downloaded by 12,000+ growth and marketing leaders",
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1600&h=900&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: sid(LEAD, "benefits-grid", 3),
      type: "benefits-grid",
      props: {
        headline: "What's inside",
        columns: 3,
        items: [
          { icon: "BarChart2", title: "Channel benchmarks", description: "What's actually converting in 2026, with real CAC and payback numbers." },
          { icon: "Sparkles", title: "AI-era playbooks", description: "The repeatable plays top teams use to compound pipeline." },
          { icon: "Target", title: "ICP worksheets", description: "Templates to sharpen targeting you can apply this week." },
          { icon: "Activity", title: "Funnel teardown", description: "A stage-by-stage diagnostic to find where deals leak." },
          { icon: "Users", title: "20 real examples", description: "Annotated campaigns from companies you'll recognize." },
          { icon: "Download", title: "Swipe files", description: "Copy, subject lines, and sequences ready to adapt." },
        ],
      },
    },
    {
      id: sid(LEAD, "form", 4),
      type: "form",
      props: {
        headline: "Get instant access",
        subheadline: "Tell us where to send it and the guide lands in your inbox immediately.",
        multiStep: false,
        steps: [
          {
            title: "Your info",
            fields: [
              { id: "firstName", type: "text", label: "First name", placeholder: "Jane", required: true },
              { id: "email", type: "email", label: "Work email", placeholder: "you@company.com", required: true },
              { id: "company", type: "text", label: "Company", placeholder: "Acme Inc.", required: false },
            ],
          },
        ],
        submitButtonText: "Send me the guide",
        submitButtonColor: LEAD_ACCENT,
        successMessage: "Done! Check your inbox — your guide is on the way.",
        formMode: "native",
        cardStyle: "elevated",
        backgroundStyle: "white",
        formSubmitUrl: "/api/lp/leads",
      },
    },
    {
      id: sid(LEAD, "testimonial", 5),
      type: "testimonial",
      props: {
        quote:
          "I expected a thin gated PDF and got a genuinely useful playbook. We reworked our paid mix off the benchmarks in chapter three and cut CAC by a fifth.",
        author: "Priya Nair",
        role: "Head of Growth",
        practiceName: "Lumen",
      },
    },
    {
      id: sid(LEAD, "trust-bar", 6),
      type: "trust-bar",
      props: {
        items: [
          { value: "12,000+", label: "Downloads" },
          { value: "48", label: "Pages of plays" },
          { value: "20", label: "Real examples" },
          { value: "4.8★", label: "Reader rating" },
        ],
      },
    },
    footerBlock(LEAD, "Fieldnotes", LEAD_ACCENT),
  ],
};

// ── 3. Book-a-demo / sales call ──────────────────────────────────────────────

const DEMO = "global-book-demo";
const DEMO_ACCENT = "#2563EB";
const bookDemoTemplate: GlobalTemplateSeed = {
  slug: DEMO,
  title: "Book a Demo",
  templateLabel: "Book a Demo",
  templateDescription:
    "A high-intent demo booking page: outcome-led hero, what-you'll-see grid, a simple 3-step process, proof, and a tight request form. Built to fill the sales calendar.",
  ogImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1200&h=630&fit=crop",
  industry: "generic",
  premiumRank: 26,
  blocks: [
    navBlock(
      DEMO,
      "Cadence",
      [
        { label: "Why Cadence", url: "#why" },
        { label: "How it works", url: "#how" },
      ],
      { label: "Book a demo", url: "#book" },
      DEMO_ACCENT,
    ),
    {
      id: sid(DEMO, "hero", 2),
      type: "hero",
      props: {
        eyebrow: "30-minute personalized walkthrough",
        headlineSize: "lg",
        headline: "See exactly how Cadence works for your team.",
        subheadline:
          "No generic pitch. Book a focused session and we'll map Cadence to your actual workflow, answer your hardest questions, and leave you with a concrete next step.",
        ctaText: "Book your demo",
        ctaUrl: "#book",
        ctaColor: DEMO_ACCENT,
        heroType: "static-image",
        layout: "split-right",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "Trusted by revenue teams at 600+ companies",
        imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1600&h=900&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: sid(DEMO, "trust-bar", 3),
      type: "trust-bar",
      props: {
        items: [
          { value: "600+", label: "Teams onboarded" },
          { value: "30 min", label: "Time to value" },
          { value: "4.9★", label: "G2 rating" },
          { value: "98%", label: "Would recommend" },
        ],
      },
    },
    {
      id: sid(DEMO, "benefits-grid", 4),
      type: "benefits-grid",
      props: {
        headline: "What you'll see in the demo",
        columns: 3,
        items: [
          { icon: "Gauge", title: "Your workflow, live", description: "We configure the demo around how your team actually works." },
          { icon: "Zap", title: "The 3 highest-impact wins", description: "The features that move your numbers first — no feature firehose." },
          { icon: "LineChart", title: "Real ROI math", description: "A back-of-envelope payback estimate for your situation." },
          { icon: "Workflow", title: "Integrations check", description: "We confirm it fits your stack before you commit." },
          { icon: "ShieldCheck", title: "Security & rollout", description: "How teams go live safely, with admin controls covered." },
          { icon: "Target", title: "A concrete next step", description: "You leave with a plan, not a follow-up to schedule a follow-up." },
        ],
      },
    },
    {
      id: sid(DEMO, "how-it-works", 5),
      type: "how-it-works",
      props: {
        headline: "Booking takes 30 seconds",
        steps: [
          { number: "01", title: "Pick a time", description: "Grab a slot that works — same week, often same day." },
          { number: "02", title: "Tailored walkthrough", description: "A specialist shows Cadence mapped to your workflow." },
          { number: "03", title: "Leave with a plan", description: "Clear next steps and an honest fit assessment. No pressure." },
        ],
      },
    },
    {
      id: sid(DEMO, "testimonial", 6),
      type: "testimonial",
      props: {
        quote:
          "Best demo we sat through in our whole evaluation. They didn't waste a minute on features we'd never use — they showed us our process, fixed.",
        author: "Marcus Bell",
        role: "Director of RevOps",
        practiceName: "Atlas Software",
      },
    },
    {
      id: sid(DEMO, "form", 7),
      type: "form",
      props: {
        headline: "Request your demo",
        subheadline: "Tell us a little about your team and we'll reach out within one business day.",
        multiStep: false,
        steps: [
          {
            title: "Your info",
            fields: [
              { id: "firstName", type: "text", label: "First name", placeholder: "Jane", required: true },
              { id: "email", type: "email", label: "Work email", placeholder: "you@company.com", required: true },
              { id: "company", type: "text", label: "Company", placeholder: "Acme Inc.", required: true },
              { id: "teamSize", type: "text", label: "Team size", placeholder: "e.g. 25", required: false },
            ],
          },
        ],
        submitButtonText: "Book my demo",
        submitButtonColor: DEMO_ACCENT,
        successMessage: "Thanks! We'll be in touch within one business day to lock in a time.",
        formMode: "native",
        cardStyle: "elevated",
        backgroundStyle: "tinted",
        formSubmitUrl: "/api/lp/leads",
      },
    },
    footerBlock(DEMO, "Cadence", DEMO_ACCENT),
  ],
};

// ── 4. Comparison / us vs them ───────────────────────────────────────────────

const CMP = "global-comparison-switch";
const CMP_ACCENT = "#0D9488";
const comparisonTemplate: GlobalTemplateSeed = {
  slug: CMP,
  title: "Comparison / Us vs Them",
  templateLabel: "Comparison / Us vs Them",
  templateDescription:
    "A switch-focused comparison page: a sharp old-way / new-way breakdown, reasons to switch, a migration proof stat, and a switcher testimonial. Built to win the bake-off.",
  ogImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1200&h=630&fit=crop",
  industry: "generic",
  premiumRank: 27,
  blocks: [
    navBlock(
      CMP,
      "Switchpoint",
      [
        { label: "Compare", url: "#compare" },
        { label: "Why switch", url: "#why" },
      ],
      { label: "Make the switch", url: "#switch" },
      CMP_ACCENT,
    ),
    {
      id: sid(CMP, "hero", 2),
      type: "hero",
      props: {
        eyebrow: "Switchpoint vs. the old way",
        headlineSize: "lg",
        headline: "You've outgrown the tool you're fighting with.",
        subheadline:
          "See, side by side, what changes when you switch to Switchpoint — and why teams that move never look back. Migration included, no lock-in.",
        ctaText: "See the comparison",
        ctaUrl: "#compare",
        ctaColor: CMP_ACCENT,
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "tinted",
        showSocialProof: true,
        socialProofText: "2,300+ teams switched in the last year",
        imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1600&h=900&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: sid(CMP, "comparison", 3),
      type: "comparison",
      props: {
        headline: "What changes when you switch",
        oldWayLabel: "The tool you have",
        oldWayBullets: [
          "Setup measured in weeks and a paid onboarding fee",
          "Reports you export, reformat, and email by hand",
          "Support tickets that close before they're solved",
          "Per-action pricing that punishes you for growing",
          "Integrations that break on every release",
        ],
        newWayLabel: "Switchpoint",
        newWayBullets: [
          "Live in a day with white-glove migration included",
          "Live dashboards your stakeholders can self-serve",
          "A named specialist who owns the problem to done",
          "Flat per-seat pricing — scale without the surprise bill",
          "Integrations we monitor and fix before you notice",
        ],
        ctaText: "Make the switch",
        ctaUrl: "#switch",
      },
    },
    {
      id: sid(CMP, "benefits-grid", 4),
      type: "benefits-grid",
      props: {
        headline: "Reasons teams move to Switchpoint",
        columns: 3,
        items: [
          { icon: "Rocket", title: "Migration done for you", description: "We move your data, rebuild your views, and verify it all." },
          { icon: "DollarSign", title: "Predictable pricing", description: "Flat per-seat. No metered surprises at the end of the quarter." },
          { icon: "Headphones", title: "Support that owns it", description: "A real person, not a queue — and they stay until it's fixed." },
          { icon: "Lock", title: "No lock-in", description: "Export everything any time. Stay because it's better, not trapped." },
          { icon: "Gauge", title: "Faster, by design", description: "Built for the volume the old tool was never meant to handle." },
          { icon: "ShieldCheck", title: "Enterprise-ready", description: "SOC 2 Type II, SSO, and granular admin controls included." },
        ],
      },
    },
    {
      id: sid(CMP, "stat-callout", 5),
      type: "stat-callout",
      props: {
        stat: "1 day",
        description: "median time to fully migrate and go live — including importing your historical data",
        footnote: "Across 2,300+ team migrations in the past 12 months.",
      },
    },
    {
      id: sid(CMP, "testimonial", 6),
      type: "testimonial",
      props: {
        quote:
          "We dreaded the migration and it was a non-event. Switchpoint moved everything over a weekend and we were faster by Monday. The pricing alone paid for the switch.",
        author: "Elena Ruiz",
        role: "Head of Operations",
        practiceName: "Vertex Group",
      },
    },
    {
      id: sid(CMP, "bottom-cta", 7),
      type: "bottom-cta",
      props: {
        headline: "Switching is easier than staying.",
        subheadline: "Free migration, no lock-in, and a team that does the heavy lifting.",
        ctaText: "Make the switch",
        ctaUrl: "#switch",
      },
    },
    footerBlock(CMP, "Switchpoint", CMP_ACCENT),
  ],
};

// ── 5. SaaS / product launch ─────────────────────────────────────────────────

const SAAS = "global-saas-launch";
const SAAS_ACCENT = "#7B5BFF";
const saasLaunchTemplate: GlobalTemplateSeed = {
  slug: SAAS,
  title: "SaaS Product Launch",
  templateLabel: "SaaS Product Launch",
  templateDescription:
    "A bold launch page for a new product: announcement hero, a dark bento capability showcase, alternating feature rows, clean pricing, and a closing CTA. Built for launch day.",
  ogImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&h=630&fit=crop",
  industry: "saas",
  premiumRank: 28,
  blocks: [
    navBlock(
      SAAS,
      "Vela",
      [
        { label: "Features", url: "#features" },
        { label: "Pricing", url: "#pricing" },
        { label: "Customers", url: "#customers" },
      ],
      { label: "Start free", url: "#pricing" },
      SAAS_ACCENT,
    ),
    {
      id: sid(SAAS, "hero", 2),
      type: "hero",
      props: {
        eyebrow: "Now in public beta",
        headlineSize: "xl",
        headline: "Meet Vela. The workspace that ships itself.",
        subheadline:
          "Vela reads your codebase, drafts the work, and keeps your whole team in context — so you spend your day building, not coordinating. Free for 14 days.",
        ctaText: "Start free trial",
        ctaUrl: "#pricing",
        ctaColor: SAAS_ACCENT,
        secondaryCtaText: "Watch the 2-min tour",
        secondaryCtaUrl: "#features",
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "Trusted by 4,000+ teams at companies you know",
        imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&h=900&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: sid(SAAS, "trust-bar", 3),
      type: "trust-bar",
      props: {
        items: [
          { value: "4,000+", label: "Teams" },
          { value: "99.99%", label: "Uptime SLA" },
          { value: "SOC 2", label: "Type II" },
          { value: "4.9★", label: "G2 rating" },
        ],
      },
    },
    {
      id: sid(SAAS, "bento-showcase", 4),
      type: "bento-showcase",
      props: {
        eyebrow: "Capabilities",
        headline: "Built for the way real teams build.",
        bgColor: "#0A0A0B",
        textColor: "#F5F5F7",
        accentColor: SAAS_ACCENT,
        tiles: [
          { kind: "feature", size: "lg", primary: "Reads your codebase. Writes the PR.", secondary: "Vela drafts pull requests with reasoning, tests, and a changelog — ready for review.", icon: "GitPullRequest", bgColor: "#15122E", textColor: "#F5F5F7" },
          { kind: "stat", size: "md", primary: "12x", secondary: "Faster ticket triage", bgColor: "#7B5BFF", textColor: "#FFFFFF" },
          { kind: "feature", size: "md", primary: "Always-on context", secondary: "Knows your decisions, your stack, and your conventions.", icon: "BrainCircuit", bgColor: "#1A1830", textColor: "#F5F5F7" },
          { kind: "feature", size: "md", primary: "One source of truth", secondary: "Docs, tickets, and code stay in sync automatically.", icon: "Layers", bgColor: "#1A1830", textColor: "#F5F5F7" },
          { kind: "stat", size: "sm", primary: "5 → 1", secondary: "Tools replaced", bgColor: "#15122E", textColor: "#F5F5F7" },
          { kind: "feature", size: "md", primary: "Ships on autopilot", secondary: "Automate the busywork; keep the judgment calls.", icon: "Rocket", bgColor: "#1A1830", textColor: "#F5F5F7" },
        ],
      },
    },
    {
      id: sid(SAAS, "zigzag-features", 5),
      type: "zigzag-features",
      props: {
        headline: "Everything your team needs, in one place",
        subheadline: "Built for fast-moving teams that hate context switching.",
        headlineAlign: "center",
        rows: [
          { tag: "AUTOMATIONS", headline: "Replace your spreadsheets with workflows that run themselves", body: "Trigger any action from any event and connect to 200+ apps in a click. The busywork just disappears.", ctaText: "See automations", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=700&fit=crop" },
          { tag: "ANALYTICS", headline: "Real metrics, not vanity dashboards", body: "See exactly what's moving the needle and share live views with stakeholders — no exports, no reformatting.", ctaText: "Explore analytics", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=900&h=700&fit=crop" },
          { tag: "COLLABORATION", headline: "Your whole team, finally on the same page", body: "Comments, approvals, and handoffs live right where the work happens. Nothing falls through the cracks.", ctaText: "See collaboration", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=900&h=700&fit=crop" },
        ],
      },
    },
    {
      id: sid(SAAS, "gradient-pricing", 6),
      type: "gradient-pricing",
      props: {
        eyebrow: "Pricing",
        headline: "Pay for what your team actually ships.",
        gradientFrom: "#1A1640",
        gradientTo: "#0A0A0B",
        accentColor: SAAS_ACCENT,
        tiers: [
          { name: "Starter", price: "$29", period: "/seat/mo", features: ["Up to 10 seats", "Core automations", "Standard analytics", "Email support"], ctaText: "Start free", ctaUrl: "#" },
          { name: "Team", price: "$79", period: "/seat/mo", features: ["Unlimited seats", "Advanced automations", "Live dashboards", "Priority support", "SSO & SAML"], ctaText: "Start trial", ctaUrl: "#", featured: true, badge: "Most popular" },
          { name: "Enterprise", price: "Custom", period: "", features: ["Everything in Team", "Dedicated success manager", "Custom SLAs", "Advanced security review"], ctaText: "Talk to sales", ctaUrl: "#contact" },
        ],
      },
    },
    {
      id: sid(SAAS, "testimonial", 7),
      type: "testimonial",
      props: {
        quote:
          "We replaced six tools with Vela in our first quarter. Everyone got faster, our reports got cleaner, and the engineering team finally got their nights back.",
        author: "Maya Patel",
        role: "VP Operations",
        practiceName: "Aperture Logistics",
      },
    },
    {
      id: sid(SAAS, "bottom-cta", 8),
      type: "bottom-cta",
      props: {
        headline: "Ready to see what your team could ship?",
        subheadline: "Free for 14 days. No credit card required.",
        ctaText: "Start free trial",
        ctaUrl: "#pricing",
      },
    },
    footerBlock(SAAS, "Vela", SAAS_ACCENT),
  ],
};

// ── 6. Single-feature deep dive ──────────────────────────────────────────────

const FEAT = "global-feature-deep-dive";
const FEAT_ACCENT = "#0891B2";
const featureDeepDiveTemplate: GlobalTemplateSeed = {
  slug: FEAT,
  title: "Single-Feature Deep Dive",
  templateLabel: "Single-Feature Deep Dive",
  templateDescription:
    "A focused page that sells one capability end to end: a spotlight hero, in-depth feature rows, an impact stat, a 3-step how-it-works, proof, and a CTA. One idea, done thoroughly.",
  ogImage: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=1200&h=630&fit=crop",
  industry: "generic",
  premiumRank: 29,
  blocks: [
    navBlock(
      FEAT,
      "Focus",
      [
        { label: "How it works", url: "#how" },
        { label: "Impact", url: "#impact" },
      ],
      { label: "Try it free", url: "#cta" },
      FEAT_ACCENT,
    ),
    {
      id: sid(FEAT, "hero", 2),
      type: "hero",
      props: {
        eyebrow: "Feature Spotlight — Instant Replay",
        headlineSize: "lg",
        headline: "Rewind any decision. See exactly what changed, and why.",
        subheadline:
          "Instant Replay records every change across your workspace so you can scrub back through time, understand any state, and recover in one click. One feature, done properly.",
        ctaText: "Try Instant Replay free",
        ctaUrl: "#cta",
        ctaColor: FEAT_ACCENT,
        secondaryCtaText: "See how it works",
        secondaryCtaUrl: "#how",
        heroType: "static-image",
        layout: "split-right",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "Shipped to every plan — loved by 30,000+ users",
        imageUrl: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=1600&h=900&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: sid(FEAT, "zigzag-features", 3),
      type: "zigzag-features",
      props: {
        headline: "One feature, explored from every angle",
        subheadline: "Everything Instant Replay does — and why it matters in practice.",
        headlineAlign: "center",
        rows: [
          { tag: "TIME TRAVEL", headline: "Scrub back to any moment in your workspace's history", body: "A continuous timeline of every change. Drag the slider and watch the state rebuild itself, second by second.", ctaText: "See the timeline", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=700&fit=crop" },
          { tag: "WHO & WHY", headline: "Every change, attributed and explained", body: "Hover any edit to see who made it, when, and the reasoning captured alongside it. No more archaeology in the audit log.", ctaText: "Explore attribution", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=900&h=700&fit=crop" },
          { tag: "ONE-CLICK RECOVERY", headline: "Made a mistake? Roll it back without a ticket", body: "Restore any prior state instantly — a single object or the whole workspace. Recovery that used to take support now takes a click.", ctaText: "See recovery", ctaUrl: "#", imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=900&h=700&fit=crop" },
        ],
      },
    },
    {
      id: sid(FEAT, "stat-callout", 4),
      type: "stat-callout",
      props: {
        stat: "1 click",
        description: "to recover from a mistake that used to mean a support ticket and a half-day wait",
        footnote: "Instant Replay is included on every plan, at no extra cost.",
      },
    },
    {
      id: sid(FEAT, "how-it-works", 5),
      type: "how-it-works",
      props: {
        headline: "How Instant Replay works",
        steps: [
          { number: "01", title: "It records continuously", description: "Every change is captured automatically — nothing to configure or remember." },
          { number: "02", title: "You scrub the timeline", description: "Drag back to any moment and see the exact state at that point in time." },
          { number: "03", title: "Restore in one click", description: "Bring back a single object or the whole workspace, instantly." },
        ],
      },
    },
    {
      id: sid(FEAT, "testimonial", 6),
      type: "testimonial",
      props: {
        quote:
          "Instant Replay turned our scariest 'who broke this' moments into a ten-second scrub and a one-click fix. I can't imagine working without it now.",
        author: "Theo Nakamura",
        role: "Staff Engineer",
        practiceName: "Cobalt",
      },
    },
    {
      id: sid(FEAT, "bottom-cta", 7),
      type: "bottom-cta",
      props: {
        headline: "Never lose work — or sleep — again.",
        subheadline: "Instant Replay is on every plan. Turn it on in seconds.",
        ctaText: "Try Instant Replay free",
        ctaUrl: "#cta",
      },
    },
    footerBlock(FEAT, "Focus", FEAT_ACCENT),
  ],
};

export const SHOWCASE_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  roiTemplate,
  leadMagnetTemplate,
  bookDemoTemplate,
  comparisonTemplate,
  saasLaunchTemplate,
  featureDeepDiveTemplate,
];
