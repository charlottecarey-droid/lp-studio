// "Enterprise Account Page" — the ABM-family 1:1 account microsite (Oct 2026):
// a brand-aware, industry-neutral replica of the enterprise account-page idiom
// (a white site nav over a dark split hero, phone showcase, solution tabs,
// integrations, a customer-story quote card, a logo strip, ROI stats, a
// feature grid, recommended reading, the account team, and a dark ratings
// close). Built from eleven generic `abm-*` section blocks so every section
// can be edited inline, re-ordered or dropped, and every CTA carries the full
// action suite (URL / Chili Piper / form modal / email → Chili Piper / video).
//
// Copy is brand-neutral B2B; `{{company_name}}` is the target account and is
// substituted by the microsite generator. No video is seeded — the phone and
// hero slots render the designed placeholder until a real product clip is set
// (portrait recordings fill the phone best). Palette keys are deliberately
// absent: every block derives its inks from the brand + its background preset.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const SLUG = "global-abm-account-page";
const sid = (type: string, n: number) => `seed-${SLUG}-${type}-${n}`;
const u = (id: string, w = 1400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const IMG_HERO = u("photo-1521737604893-d14cc237f11d", 1600);
const IMG_STORY = u("photo-1497366216548-37526070297c", 1400);
const IMG_READ_1 = u("photo-1460925895917-afdab827c52f", 900);
const IMG_READ_2 = u("photo-1486312338219-ce68d2c6f44d", 900);
const IMG_READ_3 = u("photo-1517048676732-d65bc937f952", 900);
const IMG_TAB_1 = u("photo-1454165804606-c3d57bc86b40", 1200);
const IMG_TAB_2 = u("photo-1531297484001-80022131f5a1", 1200);

const blocks: Block[] = [
  {
    id: sid("abm-split-hero", 1),
    type: "abm-split-hero",
    props: {
      showNav: true,
      navTheme: "light",
      navLinks: [
        { label: "Platform", href: "#platform" },
        { label: "Solutions", href: "#solutions" },
        { label: "Proof", href: "#proof" },
        { label: "Your team", href: "#team" },
      ],
      navLinkText: "Log in",
      navLinkUrl: "#",
      companyName: "{{company_name}}",
      kicker: "Operations. Finance. Field teams",
      showKickerDot: true,
      headline: "One {{company_name}}, one platform",
      subheadline:
        "Connect every team, region and workflow across {{company_name}} in a single system of record to drive predictable performance and operational excellence.",
      ctaText: "Contact your account team",
      ctaUrl: "#team",
      ctaAction: "url",
      mediaImageUrl: IMG_HERO,
      mediaImageAlt: "A field team reviewing a plan on site",
      mediaAspect: "4/3",
      mediaSide: "right",
      backgroundStyle: "black",
    },
  },
  {
    id: sid("abm-phone-showcase", 2),
    type: "abm-phone-showcase",
    props: {
      headline: "The foundation for enterprise success",
      intro:
        "The operational foundation that drives next-level consistency and predictable performance across {{company_name}}'s most complex programs.",
      items: [
        { title: "Gain enterprise-wide financial clarity", body: "Integrate disparate workflows into a single source of truth for real-time cost certainty and a unified view of profit performance across every segment." },
        { title: "Master complex project controls", body: "Manage large programs with the process adherence needed to keep teams productive, from the first plan to the final handover." },
        { title: "Use AI for proactive foresight", body: "Surface risks early, optimize schedules and identify the most efficient path forward for a growing backlog." },
        { title: "Scale without additional overhead", body: "Digitize manual methods and give every employee back hours of administrative time each week." },
      ],
      mediaVideoUrl: "",
      mediaImageUrl: "",
      phoneSide: "left",
      anchorId: "platform",
      backgroundStyle: "white",
    },
  },
  {
    id: sid("abm-solution-tabs", 3),
    type: "abm-solution-tabs",
    props: {
      headline: "Connect all your projects and people\nin a single solution",
      linkText: "Contact your account team",
      linkUrl: "#team",
      tabs: [
        {
          label: "Change management",
          title: "Get paid for the work you do",
          body: "Bring change management to the field, facilitating faster approvals, more accurate communication and eliminating the need to proceed at risk.",
          bullets: [
            "Standardize change management processes across the business",
            "Capture and manage financial risk and opportunities in one connected place",
            "Make communication more transparent, open and honest",
            "Create one source of information for collaborative decision making",
            "Empower teams to manage change as it occurs on site",
          ],
          imageUrl: IMG_TAB_1,
          imageAlt: "A budget review in progress",
        },
        {
          label: "Quality management",
          title: "Catch issues before they become rework",
          body: "Standardize inspections and daily logs so every site runs the same playbook and problems surface while they are still cheap to fix.",
          bullets: ["Consistent inspection templates across every program", "Real-time visibility into open items and owners", "A clean audit trail for every decision"],
          imageUrl: IMG_TAB_2,
          imageAlt: "A quality dashboard on a laptop",
        },
        {
          label: "Risk management",
          title: "See risk early, everywhere",
          body: "Connect field observations, incidents and schedule impacts so leadership sees exposure across the portfolio, not one project at a time.",
          bullets: ["Portfolio-wide risk dashboards", "Incident capture from any device", "Trend reporting by region and segment"],
          imageUrl: IMG_TAB_1,
          imageAlt: "Reviewing risk reports",
        },
        {
          label: "Financial management",
          title: "Real-time cost certainty",
          body: "Budgets, commitments and forecasts in one connected ledger so finance and operations work from the same numbers.",
          bullets: ["Live budget-to-actual by program", "Commitments and change orders in one flow", "Forecasts leadership can trust"],
          imageUrl: IMG_TAB_2,
          imageAlt: "Financial reporting on screen",
        },
      ],
      ctaText: "Contact your account team",
      ctaUrl: "#team",
      ctaAction: "url",
      anchorId: "solutions",
      backgroundStyle: "white",
    },
  },
  {
    id: sid("abm-integrations-row", 4),
    type: "abm-integrations-row",
    props: {
      headline: "Tap into 500+ integrations and\napps you love working with",
      subheadline: "Work more efficiently, communicate better and move faster from a single source of truth. See how much more {{company_name}} can do on one connected platform.",
      linkText: "Explore all integrations",
      linkUrl: "#",
      items: [{ name: "ERP" }, { name: "Accounting" }, { name: "CRM" }, { name: "Microsoft Teams" }, { name: "Microsoft 365" }, { name: "Document control" }, { name: "Analytics" }],
      tileSize: 96,
      anchorId: "integrations",
      backgroundStyle: "muted",
    },
  },
  {
    id: sid("abm-story-quote", 5),
    type: "abm-story-quote",
    props: {
      kicker: "Customer story",
      quote: "I couldn't recommend it any more than I already have. It's clear what the status of something is, for everyone.",
      author: "Project manager",
      role: "Enterprise customer",
      company: "",
      linkText: "Read their story",
      linkUrl: "#",
      imageUrl: IMG_STORY,
      imageAlt: "A large project site",
      imageSide: "right",
      anchorId: "proof",
      backgroundStyle: "white",
    },
  },
  {
    id: sid("abm-logo-strip", 6),
    type: "abm-logo-strip",
    props: {
      headline: "Industry leaders run on one platform",
      logos: [{ name: "Northwind" }, { name: "Contoso" }, { name: "Fabrikam" }, { name: "Globex" }, { name: "Initech" }, { name: "Umbrella" }],
      backgroundStyle: "white",
    },
  },
  {
    id: sid("abm-roi-stats", 7),
    type: "abm-roi-stats",
    props: {
      headline: "The ROI of one platform",
      stats: [
        { value: "95%", label: "see higher profit margins and an improved safety culture" },
        { value: "97%", label: "make faster, data-backed decisions" },
        { value: "95%", label: "report lower risk across projects" },
      ],
      ctaText: "Get the ROI report",
      ctaUrl: "#",
      ctaAction: "url",
      ctaVariant: "ink",
      footnote: "* Annual customer ROI survey, enterprise edition",
      anchorId: "roi",
      backgroundStyle: "muted",
    },
  },
  {
    id: sid("abm-feature-grid", 8),
    type: "abm-feature-grid",
    props: {
      headline: "Explore features available to\n{{company_name}}",
      items: [
        { title: "Project management", body: "Easy-to-use, mobile project management that connects field and office for real-time visibility.", linkUrl: "#" },
        { title: "Quality & safety", body: "Mitigate risk and make tough calls with real-time data from the field: daily logs, inspections and incidents in one place.", linkUrl: "#" },
        { title: "Invoice management", body: "Streamline billing across stakeholders so everyone works from the latest information on one organized platform.", linkUrl: "#" },
        { title: "Resource tracking", body: "Protect your labor budget and schedule with insights from real-time productivity tracking.", linkUrl: "#" },
        { title: "Analytics", body: "Power profitable work, identify risks and uncover inefficiencies with pre-built or custom reports on unified data.", linkUrl: "#" },
        { title: "Training center", body: "Keep teams up and running by tailoring support documentation to {{company_name}}'s own standard operating procedures.", linkUrl: "#" },
      ],
      columns: 3,
      anchorId: "features",
      backgroundStyle: "white",
    },
  },
  {
    id: sid("abm-reading-tiles", 9),
    type: "abm-reading-tiles",
    props: {
      headline: "Recommended reading",
      items: [
        { kicker: "Customer story", title: "How a global operator standardized 140 sites on one platform", excerpt: "From disconnected spreadsheets to one source of truth across every region.", imageUrl: IMG_READ_1, imageAlt: "Analytics on a laptop", linkUrl: "#" },
        { kicker: "Blog", title: "Making smarter workforce decisions through data", excerpt: "Data is the lifeblood of operations, yet it is often scattered across the organization, unable to support the decisions that matter.", imageUrl: IMG_READ_2, imageAlt: "Working at a laptop", linkUrl: "#" },
        { kicker: "Customer story", title: "Fixing the inputs so AI can deliver the output", excerpt: "Why clean field data came first, and what it unlocked.", imageUrl: IMG_READ_3, imageAlt: "A team meeting", linkUrl: "#" },
      ],
      anchorId: "resources",
      backgroundStyle: "muted",
    },
  },
  {
    id: sid("abm-account-team", 10),
    type: "abm-account-team",
    props: {
      headline: "Meet your account team",
      members: [
        { name: "Alex Rivera", title: "Strategic account executive" },
        { name: "Jordan Lee", title: "Customer success engineer" },
        { name: "Sam Patel", title: "Solutions engineer" },
        { name: "Morgan Chen", title: "Industry lead" },
        { name: "Taylor Brooks", title: "Inside sales representative" },
      ],
      headshotSize: 120,
      anchorId: "team",
      backgroundStyle: "white",
    },
  },
  {
    id: sid("abm-ratings-cta", 11),
    type: "abm-ratings-cta",
    props: {
      headline: "Ready to better manage\nmission-critical projects?",
      ctaText: "Request a demo",
      ctaUrl: "#",
      ctaAction: "url",
      ratings: [
        { platform: "Software Advice", rating: 4.5, count: "2,675" },
        { platform: "G2", rating: 4.6, count: "4,298" },
        { platform: "App Store", rating: 4.6, count: "46K" },
        { platform: "Google Play", rating: 3.8, count: "3,250" },
      ],
      anchorId: "demo",
      backgroundStyle: "black",
    },
  },
  {
    id: sid("footer", 12),
    type: "footer",
    props: {
      backgroundColor: "#0B0B0F",
      copyrightText: `© ${new Date().getFullYear()} All rights reserved.`,
      showSocialLinks: true,
      linkedinUrl: "#",
      columns: [
        { title: "Platform", links: [{ label: "What is it?", url: "#platform" }, { label: "Solutions", url: "#solutions" }, { label: "Integrations", url: "#integrations" }, { label: "Resources", url: "#resources" }] },
        { title: "Company", links: [{ label: "Our story", url: "#" }, { label: "Customers", url: "#proof" }, { label: "Careers", url: "#" }, { label: "Contact", url: "#team" }] },
        { title: "Legal", links: [{ label: "Privacy", url: "#" }, { label: "Terms", url: "#" }] },
      ],
    },
  },
];

export const ABM_ACCOUNT_PAGE_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: SLUG,
    title: "Enterprise Account Page",
    templateLabel: "Enterprise Account Page",
    templateDescription:
      "A 1:1 account microsite in the enterprise account-page idiom: a site-style top bar over a dark split hero, a phone showcase with a checklist of outcomes, solution tabs with screenshots or clips, an integrations row, a customer-story quote card, a logo strip, count-up ROI stats, a feature grid, recommended reading, the account team, and a dark ratings close. Eleven separate, inline-editable sections; every CTA carries the full action suite. Inherits the tenant brand's colors, fonts and logo.",
    ogImage: IMG_HERO,
    industry: null,
    premiumRank: 7,
    category: "business-case",
    keywords: ["account page", "enterprise account", "1:1", "ABM", "target account", "account based", "platform story", "integrations", "account team", "first meeting"],
    isAllInOne: true,
    funnelStage: "first-meeting",
    blocks,
  },
];
