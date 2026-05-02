// Visually-distinctive starter templates.
//
// Each of these templates uses a different *visual* recipe so the marketplace
// stops feeling like 8 versions of the same nav+hero+benefits-grid combo.
// They lean on the new editorial / brutalist / bento / gradient-pricing
// blocks alongside diverse existing blocks (full-bleed-hero, vertical tabs,
// switchback, zigzag-features) to give every template its own personality.
//
// Block JSON shapes match the props expected by `BlockRenderer` and the
// per-type defaults in `BLOCK_REGISTRY`. Anything missing falls back to those
// defaults inside the renderer / builder.

import type { GlobalTemplateSeed } from "./globalTemplates";

const FOOTER_DARK = "#0F172A";

const id = (type: string, n: number) => `seed-dist-${type}-${n}`;

function nav(
  brand: string,
  links: { label: string; url: string }[],
  cta: { label: string; url: string },
  n: number,
) {
  return {
    id: id("nav-header", n),
    type: "nav-header",
    props: {
      logoText: brand,
      logoUrl: "",
      navLinks: links,
      phone: "",
      cta1: { label: "", url: "" },
      cta2: cta,
    },
  };
}

function footer(brand: string, accent: string, n: number) {
  return {
    id: id("footer", n),
    type: "footer",
    props: {
      backgroundColor: FOOTER_DARK,
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
            { label: "Pricing", url: "#pricing" },
            { label: "Changelog", url: "#" },
            { label: "Roadmap", url: "#" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", url: "#" },
            { label: "Customers", url: "#" },
            { label: "Careers", url: "#" },
            { label: "Contact", url: "#" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Docs", url: "#" },
            { label: "Blog", url: "#" },
            { label: "Help Center", url: "#" },
            { label: "Status", url: "#" },
          ],
        },
      ],
    },
  };
}

export const DISTINCTIVE_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  // 1. Editorial Brand Story — magazine-hero + zigzag + bento + gradient $$
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "global-editorial-story",
    title: "Editorial Brand Story",
    templateLabel: "Editorial Brand Story",
    templateDescription:
      "A magazine-style landing page. Big serif hero, asymmetric photo, alternating feature rows, a bento showcase, and dark gradient pricing. For brands that want to feel like a publication, not a product.",
    ogImage:
      "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      nav(
        "Field & Co.",
        [
          { label: "The Story", url: "#story" },
          { label: "Pricing", url: "#pricing" },
          { label: "Press", url: "#press" },
        ],
        { label: "Read it free", url: "#cta" },
        1,
      ),
      {
        id: id("magazine-hero", 2),
        type: "magazine-hero",
        props: {
          eyebrow: "ISSUE 04 / FEATURE",
          headline: "The quiet revolution in how teams ship work.",
          subheadline:
            "An eighteen-month investigation into how the fastest-moving teams have replaced their tooling, their meetings, and their reporting habits — without anyone asking them to.",
          ctaText: "Read the issue",
          ctaUrl: "#story",
          bylineLabel: "By the editors",
          bylineValue: "12 min read · Updated weekly",
          imageUrl:
            "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=900&h=1100&fit=crop",
          accentColor: "#FF6B35",
          bgColor: "#FAF7F2",
          textColor: "#0A0A0A",
        },
      },
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "Three changes that compound.",
          subheadline:
            "We talked to 400 teams. The patterns were uncomfortably consistent.",
          headlineAlign: "center",
          rows: [
            {
              tag: "01 / WORKFLOWS",
              headline: "They threw away the meeting calendar.",
              body: "Async-first updates. Threaded decisions. Recorded reviews. Status meetings dropped to one a week — and nobody missed them.",
              ctaText: "Read the playbook",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "02 / METRICS",
              headline: "They stopped measuring what looked good.",
              body: "Cycle time over story points. Customer-reported defects over QA pass rate. The simple metrics turned out to be the honest ones.",
              ctaText: "See the framework",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "03 / TOOLING",
              headline: "They consolidated, ruthlessly.",
              body: "The average winning team uses 40% fewer SaaS tools than their peers. Less context-switching, more flow, lower bills.",
              ctaText: "View the audit",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("bento-showcase", 4),
        type: "bento-showcase",
        props: {
          eyebrow: "INSIDE THE TOOLKIT",
          headline: "Everything we publish, in one place.",
          subheadline:
            "Annual reports, weekly playbooks, founder interviews, and the open data behind every claim.",
          tiles: [
            {
              kind: "stat",
              size: "md",
              primary: "400+",
              secondary: "Teams interviewed",
              tertiary: "Across 18 industries",
              bgColor: "#0A0A0A",
              textColor: "#FFFFFF",
            },
            {
              kind: "image",
              size: "lg",
              primary:
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=600&fit=crop",
              secondary: "The Annual Report — printed and digital",
              tertiary: "Issue 04",
            },
            {
              kind: "feature",
              size: "md",
              primary: "Weekly playbooks delivered Friday",
              secondary:
                "One short, opinionated essay every week. No filler, no roundups.",
              icon: "Mail",
              bgColor: "#FFFFFF",
            },
            {
              kind: "feature",
              size: "md",
              primary: "Open data, fully sourced",
              secondary:
                "Every chart links back to its dataset. Audit anything you read.",
              icon: "Database",
              bgColor: "#FFFFFF",
            },
            {
              kind: "quote",
              size: "md",
              primary:
                "Field & Co. is the only thing in our slack that everyone actually reads.",
              secondary: "Maya Patel",
              tertiary: "VP Operations · Aperture",
              bgColor: "#FFFFFF",
            },
          ],
          bgColor: "#F4F4F5",
          textColor: "#0A0A0A",
          accentColor: "#FF6B35",
        },
      },
      {
        id: id("gradient-pricing", 5),
        type: "gradient-pricing",
        props: {
          eyebrow: "MEMBERSHIP",
          headline: "Read free. Subscribe for the deep work.",
          subheadline:
            "Most of what we publish is free. Members get the data, the templates, and the in-person events.",
          tiers: [
            {
              name: "Reader",
              price: "$0",
              period: "/forever",
              description: "Weekly essays delivered to your inbox.",
              features: [
                "Weekly Friday essay",
                "Public archive",
                "Comment threads",
                "Cancel any time",
              ],
              ctaText: "Start reading",
              ctaUrl: "#",
            },
            {
              name: "Member",
              price: "$12",
              period: "/mo",
              description: "For operators who want the full toolkit.",
              features: [
                "Everything in Reader",
                "Annual Report (print + digital)",
                "All datasets and templates",
                "Members-only essays",
                "Quarterly virtual workshop",
                "Discord community access",
              ],
              ctaText: "Become a member",
              ctaUrl: "#",
              featured: true,
              badge: "Most popular",
            },
            {
              name: "Team",
              price: "Custom",
              description: "Roll out membership across your org.",
              features: [
                "Everything in Member",
                "Bulk seats with admin console",
                "Annual on-site workshop",
                "Quarterly leadership briefing",
              ],
              ctaText: "Talk to us",
              ctaUrl: "#",
            },
          ],
          gradientFrom: "#0B0B1A",
          gradientTo: "#3D1F1A",
          accentColor: "#FF6B35",
        },
      },
      footer("Field & Co.", "#FF6B35", 6),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 2. Brutalist Manifesto — bold-statement led, dark + accent
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "global-brutalist-manifesto",
    title: "Brutalist Manifesto",
    templateLabel: "Brutalist Manifesto",
    templateDescription:
      "A high-contrast, opinionated landing page. Massive typography, a single accent color, and zero filler. For brands that want to feel like a campaign.",
    ogImage:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      nav(
        "MOMENTUM",
        [
          { label: "Manifesto", url: "#manifesto" },
          { label: "Work", url: "#work" },
          { label: "Pricing", url: "#pricing" },
        ],
        { label: "Get in touch", url: "#cta" },
        1,
      ),
      {
        id: id("bold-statement", 2),
        type: "bold-statement",
        props: {
          eyebrow: "MANIFESTO 01",
          statement:
            "We don't make <em>tools</em>. We make <em>momentum</em>.",
          footnote:
            "Every product decision starts with one question: does this make our customers move faster today than yesterday? If the answer is no, we don't ship it.",
          ctaText: "Read the manifesto",
          ctaUrl: "#manifesto",
          bgColor: "#0A0A0A",
          textColor: "#FFFFFF",
          accentColor: "#C7E738",
        },
      },
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "Three things we believe.",
          subheadline: "And one thing we don't.",
          headlineAlign: "center",
          rows: [
            {
              tag: "BELIEF 01",
              headline: "Velocity is a feature, not a side-effect.",
              body: "If your team isn't 5× faster after a quarter with us, we don't deserve your money. We've offered that guarantee since day one.",
              ctaText: "How it works",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "BELIEF 02",
              headline: "Defaults beat configuration.",
              body: "We make the call you should have made. Then we let you change it if you really, really need to. Most teams never do.",
              ctaText: "See the defaults",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "BELIEF 03",
              headline: "Pricing should be obvious.",
              body: "Three tiers. One page. Zero sales calls required. If you ever need to ask what something costs, we've already lost.",
              ctaText: "Open pricing",
              ctaUrl: "#pricing",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("bold-statement", 4),
        type: "bold-statement",
        props: {
          eyebrow: "WHAT WE WON'T DO",
          statement:
            "No demos. No <em>discovery calls</em>. No <em>roadmaps</em> behind logins.",
          footnote:
            "If you can't try it in five minutes, we've failed at our job. Sign up, get to work, cancel any time. That's the whole pitch.",
          ctaText: "Try it now",
          ctaUrl: "#cta",
          bgColor: "#C7E738",
          textColor: "#0A0A0A",
          accentColor: "#0A0A0A",
        },
      },
      {
        id: id("gradient-pricing", 5),
        type: "gradient-pricing",
        props: {
          eyebrow: "PRICING",
          headline: "Three tiers. No surprises.",
          subheadline: "Cancel any time. We mean it — one click, in app.",
          tiers: [
            {
              name: "Solo",
              price: "$0",
              period: "/mo",
              description: "Everything one person needs.",
              features: [
                "1 workspace",
                "Unlimited projects",
                "Community support",
                "All core features",
              ],
              ctaText: "Start free",
              ctaUrl: "#",
            },
            {
              name: "Team",
              price: "$24",
              period: "/seat/mo",
              description: "For teams that ship every week.",
              features: [
                "Everything in Solo",
                "Unlimited collaborators",
                "Priority support",
                "Audit log + SSO",
                "Custom integrations",
                "5× speed guarantee",
              ],
              ctaText: "Start 14-day trial",
              ctaUrl: "#",
              featured: true,
              badge: "What 90% pick",
            },
            {
              name: "Org",
              price: "$96",
              period: "/seat/mo",
              description: "Compliance-ready, with everything turned on.",
              features: [
                "Everything in Team",
                "Dedicated success manager",
                "Custom DPA + MSA",
                "99.99% uptime SLA",
                "On-prem deploy option",
              ],
              ctaText: "Talk to us",
              ctaUrl: "#",
            },
          ],
          gradientFrom: "#0A0A0A",
          gradientTo: "#1A2A0A",
          accentColor: "#C7E738",
        },
      },
      footer("MOMENTUM", "#C7E738", 6),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 3. Cinematic Product Launch — full-bleed hero + bento + bold CTA
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "global-cinematic-launch",
    title: "Cinematic Product Launch",
    templateLabel: "Cinematic Product Launch",
    templateDescription:
      "Full-bleed image hero with overlay header, vertical tabs feature deep-dive, bento outcomes grid, and a bold closing manifesto. For launches that need to feel like an event.",
    ogImage:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "The next chapter starts now.",
          subheadline:
            "Three years of work, one release. Atlas 3.0 reimagines what a workspace can do for a modern team — and it ships today.",
          ctaText: "See what's new",
          ctaUrl: "#tour",
          secondaryCtaText: "Watch the keynote",
          secondaryCtaUrl: "#video",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: true,
          overlayOpacity: 60,
          minHeight: "full",
          contentAlignment: "left",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Tour", url: "#tour" },
            { label: "What's New", url: "#whats-new" },
            { label: "Pricing", url: "#pricing" },
          ],
          headerCtaText: "Get Atlas 3.0",
          headerCtaUrl: "#cta",
          headerScrolledBg: "#0A0A0A",
          showSocialProof: true,
          socialProofText: "Trusted by 14,000+ teams · Forbes #1 Software Launch of the Year",
        },
      },
      {
        id: id("dandy-vertical-tabs", 2),
        type: "dandy-vertical-tabs",
        props: {
          headline: "Built around how teams actually work.",
          subheadline:
            "Three core changes. Each one solves a problem you've stopped noticing because you're so used to it.",
          tabs: [
            {
              title: "Inbox-zero by design",
              description:
                "Threaded inbox that auto-summarizes, auto-prioritizes, and auto-files. The average user closes 78% fewer notifications than they did on Atlas 2.",
              ctaText: "See the new inbox",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=800&fit=crop",
            },
            {
              title: "Decisions, not documents",
              description:
                "Every doc has a decision tracker baked in. Stakeholders see live status, comment in-context, and the answer ships when the last vote lands.",
              ctaText: "How decisions work",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&h=800&fit=crop",
            },
            {
              title: "AI that's actually accountable",
              description:
                "Every Atlas AI suggestion shows its sources, its confidence, and the data it touched. Off by default for compliance-heavy industries.",
              ctaText: "Read the AI charter",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200&h=800&fit=crop",
            },
          ],
        },
      },
      {
        id: id("bento-showcase", 3),
        type: "bento-showcase",
        props: {
          eyebrow: "WHY IT MATTERS",
          headline: "The numbers, before and after.",
          subheadline:
            "Atlas 3.0 spent six months in private beta with 500 teams. Here's what shifted.",
          tiles: [
            {
              kind: "stat",
              size: "md",
              primary: "78%",
              secondary: "Fewer notifications closed",
              tertiary: "Per user, per week",
              bgColor: "#0A0A0A",
              textColor: "#FFFFFF",
            },
            {
              kind: "stat",
              size: "md",
              primary: "3.4×",
              secondary: "Faster decision turnaround",
              tertiary: "From open to shipped",
              bgColor: "#C7E738",
              textColor: "#0A0A0A",
            },
            {
              kind: "image",
              size: "lg",
              primary:
                "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200&h=600&fit=crop",
              secondary: "Atlas 3.0 in the wild",
              tertiary: "Behind the scenes",
            },
            {
              kind: "quote",
              size: "lg",
              primary:
                "We replaced four tools with Atlas 3.0 in our first month. The team got faster, the meetings got shorter, and our COO finally stopped chasing status updates.",
              secondary: "Jordan Reyes",
              tertiary: "Chief of Staff · Helio Robotics",
              bgColor: "#FFFFFF",
            },
            {
              kind: "feature",
              size: "md",
              primary: "Migration in a weekend",
              secondary:
                "Bring your data from any of 12 supported tools — we handle the heavy lifting.",
              icon: "ArrowRightLeft",
              bgColor: "#FFFFFF",
            },
          ],
          bgColor: "#F4F4F5",
          textColor: "#0A0A0A",
          accentColor: "#3B82F6",
        },
      },
      {
        id: id("bold-statement", 4),
        type: "bold-statement",
        props: {
          eyebrow: "AVAILABLE TODAY",
          statement: "It's <em>here</em>. And it's <em>free</em> to try.",
          footnote:
            "Atlas 3.0 is rolling out to every account starting today. Free tier, no credit card, full feature set for 30 days.",
          ctaText: "Get Atlas 3.0",
          ctaUrl: "#cta",
          bgColor: "#0B0B1A",
          textColor: "#FFFFFF",
          accentColor: "#3B82F6",
        },
      },
      footer("Atlas", "#3B82F6", 5),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 4. Conversion-First Lead Capture — full-bleed hero w/ form-driven CTA
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "global-conversion-capture",
    title: "Conversion Capture Page",
    templateLabel: "Conversion Capture Page",
    templateDescription:
      "Single-purpose lead capture. Full-bleed hero, social proof bar, three-row value props, an inline form with multi-step support, and a closing manifesto. Built for paid traffic.",
    ogImage:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "Cut your CAC in half. We'll show you how — free.",
          subheadline:
            "Get the 14-page playbook our growth team uses to ship paid campaigns that beat agency benchmarks 4 out of 5 times. No fluff, no upsell.",
          ctaText: "Get the playbook",
          ctaUrl: "#form",
          secondaryCtaText: "See sample chapter",
          secondaryCtaUrl: "#sample",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 70,
          minHeight: "large",
          contentAlignment: "center",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [],
          headerCtaText: "Get the playbook",
          headerCtaUrl: "#form",
          headerScrolledBg: "#0F172A",
          showSocialProof: true,
          socialProofText: "Downloaded by 28,000+ marketing teams · Featured in Demand Curve",
        },
      },
      {
        id: id("trust-bar", 2),
        type: "trust-bar",
        props: {
          items: [
            { value: "28,000+", label: "Downloads" },
            { value: "4.9★", label: "Average rating" },
            { value: "14 pages", label: "Of pure tactics" },
            { value: "$0", label: "Forever free" },
          ],
        },
      },
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "What's inside the playbook.",
          subheadline:
            "Three sections, ordered the way our team actually rolls out a new channel.",
          headlineAlign: "center",
          rows: [
            {
              tag: "PART 01",
              headline: "Audience modelling that doesn't lie",
              body: "How we built a lookalike model that beats Facebook's defaults by 40% — using only first-party data and a Google Sheet.",
              ctaText: "Sample this chapter",
              ctaUrl: "#sample",
              imageUrl:
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "PART 02",
              headline: "Creative testing without the chaos",
              body: "The exact framework we use to ship 40 ad variants a week without the team burning out — and the cuts you can make to half it.",
              ctaText: "See the workflow",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("form", 4),
        type: "form",
        props: {
          headline: "Send me the playbook.",
          subheadline:
            "No spam. We'll email it once and add you to the weekly tactics list — unsubscribe with one click.",
          multiStep: false,
          steps: [
            {
              title: "Where should we send it?",
              fields: [
                {
                  id: "field-name",
                  type: "text",
                  label: "Full Name",
                  placeholder: "Jane Smith",
                  required: true,
                },
                {
                  id: "field-email",
                  type: "email",
                  label: "Work Email",
                  placeholder: "jane@company.com",
                  required: true,
                },
                {
                  id: "field-company",
                  type: "text",
                  label: "Company",
                  placeholder: "Acme Inc.",
                  required: false,
                },
                {
                  id: "field-spend",
                  type: "select",
                  label: "Monthly paid spend",
                  placeholder: "Pick a range",
                  required: false,
                  options: [
                    { label: "Under $5k", value: "under-5k" },
                    { label: "$5k–$25k", value: "5-25" },
                    { label: "$25k–$100k", value: "25-100" },
                    { label: "$100k+", value: "100-plus" },
                  ],
                },
              ],
            },
          ],
          submitButtonText: "Send me the playbook",
          successMessage: "It's on the way — check your inbox in the next minute.",
          redirectUrl: "",
          backgroundStyle: "white",
        },
      },
      {
        id: id("bold-statement", 5),
        type: "bold-statement",
        props: {
          eyebrow: "WHY FREE",
          statement:
            "We grew by giving away our best <em>work</em>. So we keep doing it.",
          footnote:
            "Half the teams we work with hired us after a free download did their last campaign for them. The other half didn't — and that's fine too.",
          bgColor: "#0F172A",
          textColor: "#FFFFFF",
          accentColor: "#22D3EE",
        },
      },
      footer("North Loop", "#22D3EE", 6),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 5. Boutique Agency / Studio — magazine hero + bento + bold CTA
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "global-boutique-studio",
    title: "Boutique Studio Portfolio",
    templateLabel: "Boutique Studio Portfolio",
    templateDescription:
      "Editorial site for a small studio or independent agency. Magazine-style intro, photo grid, bento case-studies, and a confident closing pitch. Designed to feel hand-made.",
    ogImage:
      "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      nav(
        "Bramble & Co.",
        [
          { label: "Work", url: "#work" },
          { label: "Studio", url: "#studio" },
          { label: "Journal", url: "#journal" },
        ],
        { label: "Start a project", url: "#cta" },
        1,
      ),
      {
        id: id("magazine-hero", 2),
        type: "magazine-hero",
        props: {
          eyebrow: "AN INDEPENDENT STUDIO",
          headline: "Slow design, for brands worth taking seriously.",
          subheadline:
            "We work with five clients a year. We finish what we start. And we make work we'd put on our own walls.",
          ctaText: "See selected work",
          ctaUrl: "#work",
          bylineLabel: "Founded",
          bylineValue: "Brooklyn, 2017",
          imageUrl:
            "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=900&h=1100&fit=crop",
          accentColor: "#B45309",
          bgColor: "#F5F1EA",
          textColor: "#1A1410",
        },
      },
      {
        id: id("photo-strip", 3),
        type: "photo-strip",
        props: {
          images: [
            {
              src: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=600&fit=crop",
              alt: "Studio interior",
            },
            {
              src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=600&fit=crop",
              alt: "Workshop bench",
            },
            {
              src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&fit=crop",
              alt: "Branding artifact",
            },
            {
              src: "https://images.unsplash.com/photo-1542744095-291d1f67b221?q=80&w=600&fit=crop",
              alt: "Press sample",
            },
            {
              src: "https://images.unsplash.com/photo-1503602642458-232111445657?q=80&w=600&fit=crop",
              alt: "Object photography",
            },
          ],
        },
      },
      {
        id: id("bento-showcase", 4),
        type: "bento-showcase",
        props: {
          eyebrow: "SELECTED WORK 2024",
          headline: "Five projects, picked by our clients.",
          tiles: [
            {
              kind: "image",
              size: "lg",
              primary:
                "https://images.unsplash.com/photo-1542744095-291d1f67b221?q=80&w=1200&h=900&fit=crop",
              secondary: "Tessera — full identity refresh",
              tertiary: "Hospitality · 6 months",
            },
            {
              kind: "image",
              size: "md",
              primary:
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=900&h=900&fit=crop",
              secondary: "North & Wren",
              tertiary: "Apparel · 4 months",
            },
            {
              kind: "stat",
              size: "md",
              primary: "5",
              secondary: "Clients per year",
              tertiary: "By design",
              bgColor: "#1A1410",
              textColor: "#F5F1EA",
            },
            {
              kind: "quote",
              size: "lg",
              primary:
                "Bramble didn't just rebrand us — they made us understand who we were. Three years later we're still using the system they built.",
              secondary: "Margot Fields",
              tertiary: "Founder · Tessera Hotels",
              bgColor: "#FFFFFF",
            },
            {
              kind: "feature",
              size: "md",
              primary: "We don't pitch.",
              secondary:
                "If we're a fit, you'll know it in our first call. If we're not, we'll send you somewhere better.",
              icon: "Sparkles",
              bgColor: "#FFFFFF",
            },
          ],
          bgColor: "#F5F1EA",
          textColor: "#1A1410",
          accentColor: "#B45309",
        },
      },
      {
        id: id("bold-statement", 5),
        type: "bold-statement",
        props: {
          eyebrow: "BOOK 2025",
          statement:
            "Two slots left for <em>summer</em>. One for <em>autumn</em>.",
          footnote:
            "Tell us about your project in a paragraph or two. We respond within a week — sometimes with a yes, often with a referral.",
          ctaText: "Tell us about it",
          ctaUrl: "#cta",
          bgColor: "#1A1410",
          textColor: "#F5F1EA",
          accentColor: "#B45309",
        },
      },
      footer("Bramble & Co.", "#B45309", 6),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 6. Modern SaaS Pricing-Forward — bento value + gradient pricing
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "global-pricing-forward-saas",
    title: "Pricing-Forward SaaS",
    templateLabel: "Pricing-Forward SaaS",
    templateDescription:
      "For SaaS pages where price is the headline. Hero ties value to price, bento shows the proof, and the gradient pricing block does the closing.",
    ogImage:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200&h=630&fit=crop",
    industry: "generic",
    blocks: [
      nav(
        "Constant",
        [
          { label: "Product", url: "#product" },
          { label: "Customers", url: "#customers" },
          { label: "Pricing", url: "#pricing" },
          { label: "Docs", url: "#" },
        ],
        { label: "Start free", url: "#pricing" },
        1,
      ),
      {
        id: id("magazine-hero", 2),
        type: "magazine-hero",
        props: {
          eyebrow: "FROM $0 / FOREVER",
          headline: "The observability platform that doesn't price you out.",
          subheadline:
            "Constant gives you logs, metrics, and traces with one bill that scales linearly. No surprise overages, no per-host gymnastics, no contract minimums.",
          ctaText: "Start free in 30 seconds",
          ctaUrl: "#pricing",
          bylineLabel: "Launched",
          bylineValue: "Trusted by 9,400 teams",
          imageUrl:
            "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=1100&fit=crop",
          accentColor: "#A78BFA",
          bgColor: "#0B0B1A",
          textColor: "#FFFFFF",
        },
      },
      {
        id: id("trust-bar", 3),
        type: "trust-bar",
        props: {
          items: [
            { value: "9,400+", label: "Teams" },
            { value: "12B", label: "Events / day" },
            { value: "SOC 2", label: "Type II" },
            { value: "$0", label: "To start" },
          ],
        },
      },
      {
        id: id("bento-showcase", 4),
        type: "bento-showcase",
        props: {
          eyebrow: "WHY TEAMS SWITCH",
          headline: "Same observability. A tenth of the bill.",
          subheadline:
            "Constant runs on a custom storage engine that compresses 10× harder than competitors. We pass the savings on.",
          tiles: [
            {
              kind: "stat",
              size: "md",
              primary: "10×",
              secondary: "Cheaper than Datadog",
              tertiary: "Average bill comparison",
              bgColor: "#0B0B1A",
              textColor: "#FFFFFF",
            },
            {
              kind: "stat",
              size: "md",
              primary: "30s",
              secondary: "From signup to first log",
              tertiary: "Median onboarding time",
              bgColor: "#A78BFA",
              textColor: "#0A0A0A",
            },
            {
              kind: "image",
              size: "md",
              primary:
                "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&h=900&fit=crop",
              secondary: "Real customer dashboards",
              tertiary: "Live demo available",
            },
            {
              kind: "quote",
              size: "lg",
              primary:
                "We migrated 4 services from Datadog to Constant in a weekend. Our bill dropped from $11k/mo to $1.2k. Same data, same alerts, same engineers.",
              secondary: "Sam Okafor",
              tertiary: "Staff SRE · Lumen Labs",
              bgColor: "#FFFFFF",
            },
            {
              kind: "feature",
              size: "md",
              primary: "Open-standard exporters",
              secondary:
                "OTel-native. Drop-in replacement for any agent you're already running.",
              icon: "Cable",
              bgColor: "#FFFFFF",
            },
            {
              kind: "feature",
              size: "md",
              primary: "Alerts that don't wake you up",
              secondary:
                "Anomaly detection trained on your data. 84% fewer pages on average.",
              icon: "BellOff",
              bgColor: "#FFFFFF",
            },
          ],
          bgColor: "#F4F4F5",
          textColor: "#0A0A0A",
          accentColor: "#A78BFA",
        },
      },
      {
        id: id("gradient-pricing", 5),
        type: "gradient-pricing",
        props: {
          eyebrow: "PRICING",
          headline: "One simple price. Scales with you.",
          subheadline: "No per-host fees. No log overages. No long-term contracts.",
          tiers: [
            {
              name: "Hobby",
              price: "$0",
              period: "/mo",
              description: "For side projects and small teams.",
              features: [
                "Up to 5 GB ingest / month",
                "7-day retention",
                "Community support",
                "All core features",
              ],
              ctaText: "Start free",
              ctaUrl: "#",
            },
            {
              name: "Team",
              price: "$0.30",
              period: "/GB ingested",
              description: "Linear pricing that scales with you.",
              features: [
                "Unlimited ingest",
                "30-day retention",
                "Email + chat support",
                "All integrations",
                "Custom dashboards",
                "SSO + RBAC",
              ],
              ctaText: "Start 14-day trial",
              ctaUrl: "#",
              featured: true,
              badge: "Most popular",
            },
            {
              name: "Enterprise",
              price: "Custom",
              description: "Volume pricing, custom retention, white-glove onboarding.",
              features: [
                "Everything in Team",
                "Custom retention up to 5y",
                "Dedicated success manager",
                "DPA + custom MSA",
                "99.99% uptime SLA",
              ],
              ctaText: "Talk to sales",
              ctaUrl: "#",
            },
          ],
          gradientFrom: "#0B0B1A",
          gradientTo: "#1F1147",
          accentColor: "#A78BFA",
        },
      },
      footer("Constant", "#A78BFA", 6),
    ],
  },
];
