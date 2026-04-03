import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable, salesBriefingsTable, lpPagesTable, lpBrandSettingsTable } from "@workspace/db";
import OpenAI from "openai";

const router = Router();

export type MicrositeAudience = "dso-corporate" | "dso-practice" | "independent";

function getOpenAIClient(): OpenAI | null {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return new OpenAI({ apiKey: integrationKey, baseURL: integrationBase });
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return new OpenAI({ apiKey: directKey });
  return null;
}

type AiBlock = Record<string, unknown>;

function normalizeBlock(raw: AiBlock, index: number): AiBlock {
  const type = (raw.type as string) ?? "hero";
  if (raw.props && typeof raw.props === "object") {
    return {
      id: raw.id ?? `${type}-${index}`,
      type,
      props: mergeWithDefaults(type, raw.props as AiBlock),
    };
  }
  const { type: _t, id: _id, ...rest } = raw;
  return {
    id: `${type}-${index}`,
    type,
    props: mergeWithDefaults(type, rest),
  };
}

function mergeWithDefaults(type: string, p: AiBlock): AiBlock {
  switch (type) {
    // ── Standard practice blocks ────────────────────────────────────
    case "hero":
      return {
        headline: p.headline ?? p.heading ?? "See What Dandy Can Do For You",
        subheadline: p.subheadline ?? p.subheading ?? p.subtitle ?? "Digital-first lab workflows that save time, reduce remakes, and delight your patients.",
        ctaText: p.ctaText ?? "Book a Demo",
        ctaUrl: p.ctaUrl ?? "#",
        ctaColor: p.ctaColor ?? "#C7E738",
        ctaTextColor: p.ctaTextColor ?? "#001a14",
        heroType: p.heroType ?? "static-image",
        layout: p.layout ?? "centered",
        backgroundStyle: p.backgroundStyle ?? "dark",
        showSocialProof: p.showSocialProof ?? true,
        socialProofText: p.socialProofText ?? "Trusted by 12,000+ dental practices across the US",
        imageUrl: p.imageUrl ?? "",
        mediaUrl: p.mediaUrl ?? "",
      };

    case "benefits-grid":
    case "features": {
      const items = (p.items ?? p.features ?? p.benefits ?? []) as AiBlock[];
      return {
        headline: p.headline ?? p.heading ?? "Why practices choose Dandy",
        columns: p.columns ?? 3,
        items: items.length > 0
          ? items.map(f => ({ icon: f.icon ?? "Zap", title: f.title ?? f.name ?? "", description: f.description ?? f.body ?? "" }))
          : [
              { icon: "Zap", title: "Faster Turnaround", description: "5-day crown delivery with real-time case tracking." },
              { icon: "RefreshCcw", title: "Free Remakes", description: "If a case doesn't fit, we remake it at no charge." },
              { icon: "HeadphonesIcon", title: "Dedicated Support", description: "A real person answers your calls and knows your preferences." },
            ],
      };
    }

    case "trust-bar":
    case "stats": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [{ value: "12,000+", label: "Dental Practices" }, { value: "48 hrs", label: "Avg. Turnaround" }, { value: "99.2%", label: "Perfect Fit Rate" }],
      };
    }

    case "testimonial":
    case "testimonials": {
      const list = (p.testimonials ?? []) as AiBlock[];
      const t = list[0] ?? p;
      return {
        quote: t.quote ?? t.body ?? "",
        author: t.author ?? t.name ?? "Dental Practice Owner",
        role: t.role ?? t.title ?? "Dentist",
        practiceName: t.practiceName ?? t.company ?? "",
      };
    }

    case "bottom-cta":
    case "cta":
      return {
        headline: p.headline ?? p.heading ?? "Ready to upgrade your lab — with zero risk?",
        subheadline: p.subheadline ?? p.subheading ?? "No contracts. No setup fees. Free shipping both ways.",
        ctaText: p.ctaText ?? "Book a Demo",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "how-it-works": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        headline: p.headline ?? p.heading ?? "Simple to start.",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ number: s.number ?? `0${i + 1}`, title: s.title ?? s.name ?? "", description: s.description ?? s.body ?? "" }))
          : [
              { number: "01", title: "Scan & Send", description: "Take an intraoral scan and send it to Dandy in seconds." },
              { number: "02", title: "We Manufacture", description: "Your case enters our digital lab immediately." },
              { number: "03", title: "Delivered to Your Door", description: "Your restoration arrives in 5 business days." },
            ],
      };
    }

    case "comparison":
      return {
        headline: p.headline ?? p.heading ?? "A paradigm shift for your practice.",
        ctaText: p.ctaText ?? "Get Started Free",
        ctaUrl: p.ctaUrl ?? "#",
        oldWayLabel: p.oldWayLabel ?? "Traditional Lab",
        oldWayBullets: p.oldWayBullets ?? ["Long wait times", "Inconsistent fits", "Opaque pricing"],
        newWayLabel: p.newWayLabel ?? "Dandy",
        newWayBullets: p.newWayBullets ?? ["5-day crowns", "Free remakes", "Transparent pricing"],
      };

    case "pas-section":
      return {
        headline: p.headline ?? p.heading ?? "Your lab is costing you more than money.",
        body: p.body ?? p.description ?? "",
        bullets: Array.isArray(p.bullets) ? p.bullets : [],
      };

    case "stat-callout":
      return {
        stat: p.stat ?? p.value ?? "89%",
        description: p.description ?? p.label ?? "Average reduction in remakes when partnering with Dandy",
        footnote: p.footnote ?? "",
      };

    case "rich-text":
      return { content: p.content ?? p.body ?? p.html ?? "", maxWidth: p.maxWidth ?? "prose" };

    // ── DSO Corporate blocks ─────────────────────────────────────────
    case "dso-heartland-hero": {
      const stats = (p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "The Dandy Difference",
        headline: p.headline ?? p.heading ?? "Built for your DSO.",
        companyName: p.companyName ?? p.company ?? "Your DSO",
        subheadline: p.subheadline ?? p.subheading ?? "The lab partner built to match your DSO's scale — precision manufacturing, AI quality control, and network-wide visibility.",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Schedule a Conversation",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "See the ROI",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [{ value: "30%", label: "Avg case acceptance lift" }, { value: "96%", label: "First-time right rate" }, { value: "4.2 days", label: "Avg turnaround" }, { value: "$0", label: "CAPEX to start" }],
        showScrollIndicator: true,
      };
    }

    case "dso-stat-bar": {
      const stats = (p.stats ?? p.items ?? []) as AiBlock[];
      return {
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [{ value: "30%", label: "Avg case acceptance lift" }, { value: "96%", label: "First-time right rate" }, { value: "50%", label: "Denture appointments saved" }, { value: "$0", label: "CAPEX to start" }],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-challenges": {
      const challenges = (p.challenges ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "The Hidden Cost",
        headline: p.headline ?? p.heading ?? "At scale — even small inefficiencies compound fast.",
        backgroundStyle: p.backgroundStyle ?? "muted",
        layout: p.layout ?? "4-col",
        challenges: challenges.length > 0
          ? challenges.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? c.body ?? "" }))
          : [
              { title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. DSOs must unlock more revenue from existing practices to protect EBITDA." },
              { title: "Fragmented Lab Relationships", desc: "Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
              { title: "Standards That Don't Scale", desc: "Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
              { title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast." },
            ],
      };
    }

    case "dso-insights-dashboard":
      return {
        eyebrow: p.eyebrow ?? "Dandy Hub & Insights",
        headline: p.headline ?? p.heading ?? "One dashboard for every location.",
        subheadline: p.subheadline ?? p.subheading ?? "Dandy Insights gives your leadership team actionable data — not just reports. Know where to intervene before problems scale.",
        practiceLabel: p.practiceLabel ?? "practices",
        backgroundStyle: p.backgroundStyle ?? "muted",
        dashboardVariant: p.dashboardVariant ?? "light",
      };

    case "dso-success-stories": {
      const cases = (p.cases ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Proven Results",
        headline: p.headline ?? p.heading ?? "DSOs that switched and never looked back.",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        cases: cases.length > 0
          ? cases.map(c => ({ name: c.name ?? "", stat: c.stat ?? "", label: c.label ?? "", quote: c.quote ?? "", author: c.author ?? "" }))
          : [
              { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner.", author: "Dr. Layla Lohmann, Founder" },
              { name: "Smile Brands", stat: "2–3 min", label: "saved per crown appointment", quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.", author: "VP of Clinical Operations" },
            ],
      };
    }

    case "dso-pilot-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "How It Works",
        headline: p.headline ?? p.heading ?? "Start small. Prove it out. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "Validate impact with a focused pilot, then expand with confidence.",
        backgroundStyle: p.backgroundStyle ?? "muted",
        steps: steps.length > 0
          ? steps.map(s => ({
              title: s.title ?? s.name ?? "",
              subtitle: s.subtitle ?? "",
              desc: s.desc ?? s.description ?? s.body ?? "",
              details: Array.isArray(s.details) ? s.details : [],
            }))
          : [
              { title: "Launch a Pilot", subtitle: "Start with 5–10 offices", desc: "Dandy deploys scanners, onboards doctors, and integrates into existing workflows — no CAPEX, no disruption.", details: ["Premium hardware included", "Dedicated field team", "Doctors trained within days"] },
              { title: "Validate Impact", subtitle: "Measure results in 60–90 days", desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time.", details: ["Live dashboard tracks KPIs", "Compare pilot vs. control group", "Executive-ready reporting"] },
              { title: "Scale With Confidence", subtitle: "Roll out across the network", desc: "Expand with the same standard, same playbook, and same results — predictable execution at enterprise scale.", details: ["Consistent onboarding", "One standard across every office", "MSA ensures network-wide alignment"] },
            ],
      };
    }

    case "dso-final-cta":
      return {
        eyebrow: p.eyebrow ?? "Next Steps",
        headline: p.headline ?? p.heading ?? "Prove ROI. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "Validate impact with a focused pilot. Measure remake reduction, chair time recovered, and same-store revenue lift in real time.",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Get Pricing",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "Calculate ROI",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
      };

    case "dso-comparison": {
      const rows = (p.rows ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "The Dandy Difference",
        headline: p.headline ?? p.heading ?? "Built for DSO scale.\nDesigned for provider trust.",
        subheadline: p.subheadline ?? p.subheading ?? "Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights.",
        companyName: p.companyName ?? p.company ?? "Your DSO",
        ctaText: p.ctaText ?? "Request a Demo",
        ctaUrl: p.ctaUrl ?? "#",
        rows: rows.map(r => ({ feature: r.feature ?? "", dandy: r.dandy ?? "", traditional: r.traditional ?? "" })),
        backgroundStyle: p.backgroundStyle ?? "muted",
      };
    }

    case "dso-lab-tour":
      return {
        eyebrow: p.eyebrow ?? "Built in the USA",
        headline: p.headline ?? p.heading ?? "See vertical integration in action.",
        body: p.body ?? p.description ?? "Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery.",
        quote: p.quote ?? "Dandy is a true partner, not just a vendor.",
        quoteAttribution: p.quoteAttribution ?? "DSO Clinical Operations Officer",
        imageUrl: p.imageUrl ?? "",
        videoUrl: p.videoUrl ?? "",
        ctaText: p.ctaText ?? "Request a Lab Tour",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "white",
      };

    // ── DSO Practice blocks ──────────────────────────────────────────
    case "dso-practice-hero":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "Your practice. Elevated by Dandy.",
        subheadline: p.subheadline ?? p.subheading ?? "As a network partner, your practice gets dedicated support, premium scanners at no cost, and a lab that backs every case with a first-time fit guarantee.",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Start your first case",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "See how it works",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        trustLine: p.trustLine ?? "Join hundreds of practices in your network already using Dandy",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "dso-stat-row": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "By the numbers",
        headline: p.headline ?? p.heading ?? "Results that speak for themselves.",
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "", detail: s.detail ?? "" }))
          : [{ value: "96%", label: "First-time fit rate", detail: "Industry average is 78%" }, { value: "50%", label: "Fewer remakes", detail: "vs. traditional labs" }, { value: "2x", label: "Faster turnaround", detail: "Same-day delivery available" }],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-partnership-perks": {
      const perks = (p.perks ?? p.benefits ?? p.items ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Partnership Benefits",
        headline: p.headline ?? p.heading ?? "Perks that come with every Dandy partnership.",
        subheadline: p.subheadline ?? p.subheading ?? "From day one, your practice gets dedicated support, premium hardware, and exclusive incentives.",
        perks: perks.length > 0
          ? perks.map(pk => ({ icon: pk.icon ?? "star", title: pk.title ?? pk.name ?? "", desc: pk.desc ?? pk.description ?? "" }))
          : [
              { icon: "gift",     title: "$1,500 Lab Credit",         desc: "Get $1,500 toward your first cases — experience Dandy quality risk-free." },
              { icon: "zap",      title: "AI Scan Review",            desc: "Real-time AI flags margin issues while your patient is still in the chair." },
              { icon: "star",     title: "Dedicated DSO Support",     desc: "Your own account team. Direct line, same-day response." },
              { icon: "shield",   title: "Free CE Credits",           desc: "Accredited courses on digital dentistry, scan technique, and restorative workflows." },
              { icon: "users",    title: "Live Clinical Collaboration", desc: "Chat directly with Dandy lab technicians in real time to dial in your preps." },
              { icon: "sparkles", title: "$100 UberEats Gift Card",   desc: "Book a lunch-and-learn for your team — we'll cover the food and walk you through going digital." },
            ],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-split-feature": {
      const bullets = (p.bullets ?? []) as string[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        bullets: bullets.length > 0 ? bullets : [],
        ctaText: p.ctaText ?? "",
        ctaUrl: p.ctaUrl ?? "#",
        imageUrl: p.imageUrl ?? "",
        imagePosition: p.imagePosition ?? "right",
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-software-showcase": {
      const features = (p.features ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Chairside Software",
        headline: p.headline ?? p.heading ?? "The only chairside software built for same-day dentistry.",
        body: p.body ?? p.description ?? "Dandy's AI-powered platform gives clinicians real-time scan review, prep guidance, and digital workflows — all in one seamless experience.",
        imageUrl: p.imageUrl ?? "",
        features: features.length > 0
          ? features.map(f => ({ icon: f.icon ?? "zap", label: f.label ?? f.title ?? "" }))
          : [{ icon: "zap", label: "Real-time scan analysis" }, { icon: "check", label: "AI-flagged margin errors" }, { icon: "clock", label: "2–3 min saved per case" }],
        ctaText: p.ctaText ?? "See it in action",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        layout: p.layout ?? "centered",
      };
    }

    case "dso-faq": {
      const items = (p.items ?? p.questions ?? p.faqs ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Common questions",
        headline: p.headline ?? p.heading ?? "Everything you're wondering about switching.",
        subheadline: p.subheadline ?? p.subheading ?? "We know change feels risky. Here's what practices ask us most.",
        items: items.length > 0
          ? items.map(i => ({ question: i.question ?? i.q ?? i.title ?? "", answer: i.answer ?? i.a ?? i.body ?? "" }))
          : [
              { question: "Will switching labs disrupt my workflow?", answer: "No. We design the transition around your schedule. Most practices see zero disruption to active cases." },
              { question: "What if a case doesn't come back right?", answer: "We back every case with our first-time fit guarantee. If it doesn't seat, we remake it at no cost." },
            ],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-activation-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Getting Started",
        headline: p.headline ?? p.heading ?? "Four steps to going live with Dandy.",
        subheadline: p.subheadline ?? p.subheading ?? "Our onboarding team handles every detail — from scanner delivery to your first case.",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ step: s.step ?? `${i + 1}`, title: s.title ?? s.name ?? "", desc: s.desc ?? s.description ?? s.body ?? "" }))
          : [
              { step: "1", title: "Schedule Your Kickoff", desc: "Meet your Dandy activation manager to align on rollout timeline and goals." },
              { step: "2", title: "Equipment Setup", desc: "We ship and install your intraoral scanners — every operatory fully configured and ready." },
              { step: "3", title: "Clinical Training", desc: "Hands-on training for doctors and staff covering scan technique and workflow." },
              { step: "4", title: "First Cases & Go Live", desc: "Submit your first cases and experience real-time tracking, guaranteed fit, and dedicated support." },
            ],
        ctaText: p.ctaText ?? "Book Your Activation Call",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-promo-cards": {
      const cards = (p.cards ?? p.offers ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Limited-Time Offers",
        headline: p.headline ?? p.heading ?? "Exclusive promotions for DSO partners.",
        subheadline: p.subheadline ?? p.subheading ?? "Activate your practice and take advantage of offers available only through your group partnership.",
        cards: cards.length > 0
          ? cards.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? "", badge: c.badge ?? "OFFER", ctaText: c.ctaText ?? "Claim now" }))
          : [
              { title: "$1,500 Lab Credit", desc: "Activate your practice and get $1,500 toward your first cases — experience our 96% fit rate with zero risk.", badge: "CREDIT", ctaText: "Claim my credit" },
              { title: "Free Scanner + Cart", desc: "Get a premium intraoral scanner and all-in-one operatory cart at zero cost — included with your DSO partnership.", badge: "FREE", ctaText: "Reserve yours" },
            ],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "footer": {
      const columns = (p.columns ?? []) as AiBlock[];
      return {
        columns: Array.isArray(columns) ? columns : [],
        copyrightText: p.copyrightText ?? `© ${new Date().getFullYear()} Dandy. All rights reserved.`,
        showSocialLinks: p.showSocialLinks ?? false,
        backgroundColor: p.backgroundColor ?? "#003A30",
        accentColor: p.accentColor ?? "#C7E738",
      };
    }

    default:
      return { ...p };
  }
}

const BLOCK_PROP_SCHEMAS: Record<string, string> = {
  "hero": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }",
  "trust-bar": "{ items: [{ value, label }] } — 3–4 key proof stats",
  "benefits-grid": "{ headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 benefits",
  "features": "{ headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 benefits",
  "testimonial": "{ quote, author, role, practiceName }",
  "testimonials": "{ quote, author, role, practiceName }",
  "how-it-works": "{ headline, steps: [{ number, title, description }] }",
  "comparison": "{ headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }",
  "bottom-cta": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
  "cta": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
  "stats": "{ items: [{ value, label }] }",
  "pas-section": "{ headline, body, bullets: string[] }",
  "stat-callout": "{ stat, description, footnote }",
  "rich-text": "{ content, maxWidth }",
  "dso-heartland-hero": "{ eyebrow, headline, companyName, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }",
  "dso-stat-bar": "{ stats: [{ value, label }], backgroundStyle }",
  "dso-challenges": "{ eyebrow, headline, backgroundStyle, layout (\"4-col\"), challenges: [{ title, desc }] } — 4 pain points specific to this account",
  "dso-insights-dashboard": "{ eyebrow, headline, subheadline, practiceLabel, backgroundStyle, dashboardVariant (\"light\"|\"dark\") }",
  "dso-success-stories": "{ eyebrow, headline, backgroundStyle, cases: [{ name, stat, label, quote, author }] } — 2–3 DSO case studies",
  "dso-pilot-steps": "{ eyebrow, headline, subheadline, backgroundStyle, steps: [{ title, subtitle, desc, details: string[] }] }",
  "dso-final-cta": "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle }",
  "dso-comparison": "{ eyebrow, headline, subheadline, companyName, ctaText, ctaUrl, rows: [{ feature, dandy, traditional }], backgroundStyle }",
  "dso-lab-tour": "{ eyebrow, headline, body, quote, quoteAttribution, ctaText, ctaUrl, backgroundStyle }",
  "dso-practice-hero": "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, trustLine, backgroundStyle }",
  "dso-stat-row": "{ eyebrow, headline, items: [{ value, label, detail }], backgroundStyle }",
  "dso-partnership-perks": "{ eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle }",
  "dso-split-feature": "{ eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle }",
  "dso-software-showcase": "{ eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }",
  "dso-faq": "{ eyebrow, headline, subheadline, items: [{ question, answer }], backgroundStyle } — 4–5 questions",
  "dso-activation-steps": "{ eyebrow, headline, subheadline, steps: [{ step, title, desc }], ctaText, ctaUrl, backgroundStyle }",
  "dso-promo-cards": "{ eyebrow, headline, subheadline, cards: [{ title, desc, badge, ctaText }], backgroundStyle }",
  "footer": "{ columns: [] (always empty array), copyrightText, showSocialLinks: false, backgroundColor: \"#003A30\" }",
  "video-section": "{ headline, subheadline, videoUrl, backgroundStyle }",
};

function buildSystemPrompt(audience: MicrositeAudience, brand: Record<string, unknown>, templateBlockTypes?: string[]): string {
  const tone = brand.toneOfVoice as string | undefined;
  const pillars = brand.messagingPillars as Array<{ label: string; description: string }> | undefined;
  const taglines = brand.taglines as string[] | undefined;
  const brandName = (brand.brandName as string | undefined) ?? "Dandy";

  const brandSection = [
    tone ? `Tone of voice: ${tone}` : null,
    pillars?.length ? `Messaging pillars:\n${pillars.map(p => `- ${p.label}: ${p.description}`).join("\n")}` : null,
    taglines?.length ? `Brand taglines: ${taglines.join(" | ")}` : null,
  ].filter(Boolean).join("\n");

  const header = [
    `You are an expert B2B landing page copywriter for ${brandName}, a dental technology company.`,
    "You create highly personalised microsites for specific dental accounts.",
    "",
    brandSection ? `BRAND GUIDELINES — incorporate these into all copy:\n${brandSection}` : "",
    "",
    "Return ONLY valid JSON: { \"title\": string, \"slug\": string, \"blocks\": Block[] }",
    "Each Block MUST use: { \"type\": string, \"props\": { ...fields } }",
    "Never put content fields at the top level of a block. Always nest inside props.",
  ].filter(s => s !== "").join("\n");

  const blockCount = templateBlockTypes ? templateBlockTypes.length : "5–7";
  const footer = [
    "",
    `Build a page with exactly ${blockCount} blocks in the order listed.`,
    "Write all copy to be specific, bold, and grounded in the account's real context.",
    "Reference the account name, segment, size, and pain points throughout.",
    "Never use filler phrases like 'in today's competitive landscape' or 'take it to the next level'.",
  ].join("\n");

  // When a template layout is provided, override the default block order with the template's blocks
  if (templateBlockTypes && templateBlockTypes.length > 0) {
    const blockList = templateBlockTypes.map((type, i) => {
      const schema = BLOCK_PROP_SCHEMAS[type] ?? "{ ...fields }";
      return `${i + 1}. "${type}": ${schema}`;
    }).join("\n");

    return [
      header,
      "",
      `AUDIENCE: ${audience === "dso-corporate" ? "DSO corporate leadership — VP of Operations, CFO, Chief Dental Officer" : audience === "dso-practice" ? "Individual dental practice within a DSO network — the dentist or office manager" : "Independent dental practice — solo dentist or small group"}`,
      "",
      "IMPORTANT: This page uses a fixed template layout. You MUST output EXACTLY these blocks in EXACTLY this order — do not add, remove, or reorder blocks. Customize ALL text copy for the specific account.",
      "",
      "BLOCKS TO GENERATE (fixed order):",
      blockList,
      footer,
    ].join("\n");
  }

  if (audience === "dso-corporate") {
    return [
      header,
      "",
      "AUDIENCE: DSO corporate leadership — VP of Operations, CFO, Chief Dental Officer.",
      "Messaging themes: same-store growth, EBITDA protection, standardization at scale, network-wide visibility, pilot-then-scale, zero CAPEX.",
      "",
      "AVAILABLE BLOCKS (use only these, in this order):",
      "1. \"dso-heartland-hero\": { eyebrow, headline, companyName, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }",
      "2. \"dso-stat-bar\": { stats: [{ value, label }], backgroundStyle }",
      "3. \"dso-challenges\": { eyebrow, headline, backgroundStyle, layout (\"4-col\"), challenges: [{ title, desc }] } — 4 DSO pain points specific to this account",
      "4. \"dso-insights-dashboard\": { eyebrow, headline, subheadline, practiceLabel, backgroundStyle, dashboardVariant (\"light\"|\"dark\") }",
      "5. \"dso-success-stories\": { eyebrow, headline, backgroundStyle, cases: [{ name, stat, label, quote, author }] } — 2–3 real DSO case studies",
      "6. \"dso-pilot-steps\": { eyebrow, headline, subheadline, backgroundStyle, steps: [{ title, subtitle, desc, details: string[] }] }",
      "7. \"dso-final-cta\": { eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle }",
      footer,
    ].join("\n");
  }

  if (audience === "dso-practice") {
    return [
      header,
      "",
      "AUDIENCE: Individual dental practice within a DSO network — the dentist or office manager, not corporate leadership.",
      "Messaging themes: practice-level benefits, $0 CAPEX scanner, $1,500 lab credit, first-time fit guarantee, chairside AI, easy onboarding, DSO partnership perks.",
      "",
      "AVAILABLE BLOCKS (use only these, in this order):",
      "1. \"dso-practice-hero\": { eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, trustLine, backgroundStyle }",
      "2. \"dso-stat-row\": { eyebrow, headline, items: [{ value, label, detail }], backgroundStyle }",
      "3. \"dso-partnership-perks\": { eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle } — list the exclusive DSO partnership benefits",
      "4. \"dso-split-feature\": { eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle } — highlight AI Scan Review",
      "5. \"dso-software-showcase\": { eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }",
      "6. \"dso-faq\": { eyebrow, headline, subheadline, items: [{ question, answer }], backgroundStyle } — 4–5 questions practices actually ask",
      "7. \"dso-activation-steps\": { eyebrow, headline, subheadline, steps: [{ step, title, desc }], ctaText, ctaUrl, backgroundStyle }",
      footer,
    ].join("\n");
  }

  // independent
  return [
    header,
    "",
    "AUDIENCE: Independent dental practice — solo dentist or small group, not part of a DSO.",
    "Messaging themes: lab quality, turnaround time, free remakes, digital workflow, practice growth, no contracts.",
    "",
    "AVAILABLE BLOCKS (use only these, in this order):",
    "1. \"hero\": { headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }",
    "2. \"trust-bar\": { items: [{ value, label }] } — 3–4 key proof stats",
    "3. \"benefits-grid\": { headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 specific Dandy benefits",
    "4. \"testimonial\": { quote, author, role, practiceName } — a real, specific practitioner voice",
    "5. \"how-it-works\": { headline, steps: [{ number, title, description }] }",
    "6. \"comparison\": { headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }",
    "7. \"bottom-cta\": { headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
    footer,
  ].join("\n");
}

/**
 * POST /sales/accounts/:accountId/generate-microsite
 */
router.post("/accounts/:accountId/generate-microsite", async (req, res): Promise<void> => {
  const accountId = Number(req.params.accountId);
  const { prompt: userPrompt, audience, templateId } = req.body as { prompt?: string; audience?: MicrositeAudience; templateId?: number };

  if (!audience || !["dso-corporate", "dso-practice", "independent"].includes(audience)) {
    res.status(400).json({ error: "audience is required: 'dso-corporate' | 'dso-practice' | 'independent'" });
    return;
  }

  try {
    const [account] = await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, accountId));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, accountId))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    const brandRows = await db.select().from(lpBrandSettingsTable).limit(1);
    const brand = brandRows.length > 0 ? (brandRows[0].config as Record<string, unknown>) : {};

    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    // If a template ID was provided, fetch its block types to use as a fixed layout
    let templateBlockTypes: string[] | undefined;
    if (typeof templateId === "number") {
      const [templatePage] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, templateId));
      if (templatePage?.blocks && Array.isArray(templatePage.blocks)) {
        templateBlockTypes = (templatePage.blocks as AiBlock[]).map(b => b.type as string).filter(Boolean);
      }
    }

    const briefingData = briefing?.briefingData as Record<string, unknown> | undefined;
    const systemPrompt = buildSystemPrompt(audience, brand, templateBlockTypes);

    const contextParts: string[] = [];
    contextParts.push(`ACCOUNT: ${account.name}`);
    if (account.domain) contextParts.push(`Domain: ${account.domain}`);
    if (account.segment) contextParts.push(`Segment: ${account.segment}`);
    if (account.industry) contextParts.push(`Industry: ${account.industry}`);
    contextParts.push(`MICROSITE AUDIENCE: ${audience}`);

    if (briefingData) {
      if (briefingData.overview) contextParts.push(`\nACCOUNT OVERVIEW:\n${briefingData.overview}`);
      if (briefingData.tier) contextParts.push(`Tier: ${briefingData.tier}`);

      const sizeAndLocations = briefingData.sizeAndLocations as Record<string, unknown> | undefined;
      if (sizeAndLocations) {
        if (sizeAndLocations.locationCount) contextParts.push(`Locations: ${sizeAndLocations.locationCount}`);
        if (sizeAndLocations.headquarters) contextParts.push(`HQ: ${sizeAndLocations.headquarters}`);
        if (sizeAndLocations.ownership) contextParts.push(`Ownership: ${sizeAndLocations.ownership}`);
      }

      const fitAnalysis = briefingData.fitAnalysis as Record<string, unknown> | undefined;
      if (fitAnalysis) {
        if (fitAnalysis.primaryValueProp) contextParts.push(`\nPRIMARY VALUE PROP:\n${fitAnalysis.primaryValueProp}`);
        if (Array.isArray(fitAnalysis.keyPainPoints) && fitAnalysis.keyPainPoints.length > 0) {
          contextParts.push(`KEY PAIN POINTS:\n${(fitAnalysis.keyPainPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (Array.isArray(fitAnalysis.proofPoints) && fitAnalysis.proofPoints.length > 0) {
          contextParts.push(`PROOF POINTS:\n${(fitAnalysis.proofPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (fitAnalysis.recommendedApproach) contextParts.push(`RECOMMENDED APPROACH:\n${fitAnalysis.recommendedApproach}`);
      }

      const buyingCommittee = briefingData.buyingCommittee as Array<{ role: string; painPoints: string }> | undefined;
      if (buyingCommittee?.length) {
        contextParts.push("\nBUYING COMMITTEE:");
        buyingCommittee.forEach(p => contextParts.push(`- ${p.role}: ${p.painPoints}`));
      }

      const pageRec = briefingData.pageRecommendations as Record<string, string> | undefined;
      if (pageRec) {
        if (pageRec.heroHeadline) contextParts.push(`\nSUGGESTED HERO HEADLINE: "${pageRec.heroHeadline}"`);
        if (pageRec.contentFocus) contextParts.push(`CONTENT FOCUS: ${pageRec.contentFocus}`);
        if (pageRec.ctaStrategy) contextParts.push(`CTA STRATEGY: ${pageRec.ctaStrategy}`);
      }
    }

    if (userPrompt) contextParts.push(`\nADDITIONAL INSTRUCTIONS:\n${userPrompt}`);
    contextParts.push(`\nGenerate a personalised microsite for ${account.name} targeting ${audience} audience. Make every block specific to their business.`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n") },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields" });
      return;
    }

    parsed.slug = parsed.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const normalizedBlocks = (parsed.blocks as AiBlock[]).map((b, i) => normalizeBlock(b, i));

    const [page] = await db.insert(lpPagesTable).values({
      title: parsed.title,
      slug: parsed.slug,
      blocks: normalizedBlocks,
      status: "draft",
      mode: "sales",
      accountId,
    }).returning();

    res.json({ page, blocks: normalizedBlocks });
  } catch (err) {
    console.error("Generate microsite error:", err);
    res.status(500).json({ error: "Failed to generate microsite" });
  }
});

export default router;
