import type { PageBlock } from "./block-types";

function makeId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface MicrositeTemplate {
  id: string;
  name: string;
  description: string;
  skinKey: string;
  badge?: string;
  accentColor: string;
  bgColor: string;
  buildBlocks: () => PageBlock[];
}

const DANDY_CTA_URL = "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";

function dandyBlocks(): PageBlock[] {
  return [
    {
      id: makeId("hero"),
      type: "hero",
      props: {
        headline: "The lab partner built for {company_name} growth",
        subheadline: "Standardize quality + profitability across every location with real-time visibility into cost, turnaround, and clinical outcomes.",
        ctaText: "GET PRICING",
        ctaUrl: DANDY_CTA_URL,
        ctaColor: "#c8e84e",
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "dark",
        showSocialProof: true,
        socialProofText: "Trusted by 2,000+ dental practices across the US",
        imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=1400&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: makeId("trust-bar"),
      type: "trust-bar",
      props: {
        items: [
          { value: "30%", label: "Avg case acceptance lift" },
          { value: "96%", label: "First-time right rate" },
          { value: "50%", label: "Denture appointments saved" },
          { value: "$0", label: "CAPEX to get started" },
        ],
        bgColor: "#f8faf5",
        statColor: "#1b3a2d",
        labelColor: "#6b7280",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("pas-section"),
      type: "pas-section",
      props: {
        headline: "At scale — even small inefficiencies compound fast.",
        body: "Every dentist choosing their own lab means zero volume advantage, inconsistent outcomes, and no visibility into what's happening across your {practice_count} practices.",
        bullets: [
          "Fragmented lab networks with no negotiating leverage",
          "Quality variance across brands and locations",
          "No centralized data on remakes, turnaround, or cost",
          "Scanner CAPEX requests piling up every year",
        ],
      },
    },
    {
      id: makeId("comparison"),
      type: "comparison",
      props: {
        headline: "Built for DSO scale. Designed for provider trust.",
        ctaText: "GET PRICING",
        ctaUrl: DANDY_CTA_URL,
        oldWayLabel: "Traditional Lab",
        oldWayBullets: [
          "No growth enablement",
          "Varies by location and vendor",
          "Remakes discovered after the fact",
          "Fragmented, non-actionable reports",
          "Heavy CAPEX, scanner bottlenecks",
          "Minimal onboarding, slow rollout",
        ],
        newWayLabel: "Dandy",
        newWayBullets: [
          "30% higher case acceptance, expanded services",
          "One standard across all brands and locations",
          "AI Scan Review catches issues before they cost you",
          "Real-time, actionable data across all offices",
          "Premium scanners included — no CAPEX required",
          "Hands-on training that respects clinical autonomy",
        ],
        oldCardBg: "#fafafa",
        newCardBg: "#f0faf4",
      },
    },
    {
      id: makeId("benefits-grid"),
      type: "benefits-grid",
      props: {
        headline: "Why DSOs choose Dandy",
        columns: 3,
        items: [
          { icon: "ScanLine", title: "AI Scan Review", description: "Catches margin issues and prep problems while your patient is still in the chair — fewer remakes, faster seats." },
          { icon: "BarChart2", title: "Executive Dashboard", description: "Real-time visibility across every location — remake rates, turnaround, case volume, and provider accuracy." },
          { icon: "Zap", title: "5-Day Crowns", description: "Digital-first workflow delivers crowns in 5 days with a fit rate your current lab never came close to." },
          { icon: "DollarSign", title: "$0 CAPEX", description: "Premium intraoral scanners included at zero cost — eliminate the endless scanner CAPEX requests." },
          { icon: "Users", title: "Hands-On Onboarding", description: "Dedicated team manages the rollout across {practice_count} practices — training, activation, and support." },
          { icon: "Shield", title: "Consistent Standards", description: "One lab partner means one quality standard across every brand, every location, every provider." },
        ],
        hoverLift: true,
      },
    },
    {
      id: makeId("testimonial"),
      type: "testimonial",
      props: {
        quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
        author: "Dr. Layla Lohmann",
        role: "Founder",
        practiceName: "APEX Dental Partners",
      },
    },
    {
      id: makeId("stat-callout"),
      type: "stat-callout",
      props: {
        stat: "96%",
        description: "of practices are still using Dandy after one year — across multi-location groups of every size.",
        footnote: "Based on retention data from DSO and group practice partners.",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("how-it-works"),
      type: "how-it-works",
      props: {
        headline: "Pilot at 5–10 practices. Prove ROI. Then scale.",
        steps: [
          { number: "01", title: "Discovery Call", description: "Map your current lab relationships, pain points, and which locations to include in the pilot." },
          { number: "02", title: "Pilot Launch", description: "Onboard 5–10 practices. We handle equipment, training, and integration with your existing scanners." },
          { number: "03", title: "Measure Impact", description: "Track remake reduction, chair time recovered, and same-store revenue lift across pilot locations." },
          { number: "04", title: "Scale Across {company_name}", description: "Roll out to remaining practices with a proven playbook and your dedicated enterprise team." },
        ],
        circleBg: "#1b3a2d",
        circleText: "#c8e84e",
      },
    },
    {
      id: makeId("dso-insights-dashboard"),
      type: "dso-insights-dashboard",
      props: {
        eyebrow: "Dandy Hub & Insights",
        headline: "One dashboard for every location.",
        subheadline: "Dandy Insights gives {company_name} leaders actionable data — not just reports. Know where to intervene before problems scale, manage by exception, and maintain control as complexity increases.",
        practiceLabel: "practices",
        backgroundStyle: "muted",
        dashboardVariant: "light",
      },
    },
    {
      id: makeId("dso-lab-tour"),
      type: "dso-lab-tour",
      props: {
        eyebrow: "Built in the USA",
        headline: "See vertical integration in action.",
        body: "Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery. U.S.-based facilities, AI quality control, and expert technicians deliver a 96% first-time right rate at enterprise scale.",
        quote: "Dandy is a true partner, not just a vendor. They value education, technology, and people — that's what makes the difference.",
        quoteAttribution: "DSO Clinical Operations Officer",
        imageUrl: "https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=1400&fit=crop",
        videoUrl: "https://www.youtube.com/embed/SjXFjvWW9o0",
        ctaText: "Request a Lab Tour",
        ctaUrl: DANDY_CTA_URL,
      },
    },
    {
      id: makeId("bottom-cta"),
      type: "bottom-cta",
      props: {
        headline: "Prove ROI. Then scale.",
        subheadline: "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift — then scale across {company_name}.",
        ctaText: "Schedule a Discovery Call",
        ctaUrl: DANDY_CTA_URL,
        ctaAction: "url",
      },
    },
  ] as PageBlock[];
}

function heartlandBlocks(): PageBlock[] {
  return [
    {
      id: makeId("hero"),
      type: "hero",
      props: {
        headline: "Built for {company_name}.",
        subheadline: "The lab partner built to match {company_name}'s scale — one standard across every practice.",
        ctaText: "Get Started",
        ctaUrl: DANDY_CTA_URL,
        ctaColor: "#8db63c",
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "dark",
        showSocialProof: true,
        socialProofText: "Trusted by 2,000+ dental offices · 96% first-time right",
        imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=1400&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: makeId("trust-bar"),
      type: "trust-bar",
      props: {
        items: [
          { value: "96%", label: "First-time right" },
          { value: "60%", label: "Fewer remakes" },
          { value: "$0", label: "CAPEX" },
          { value: "5 days", label: "Crown turnaround" },
        ],
        bgColor: "#0d1a10",
        statColor: "#8db63c",
        labelColor: "rgba(255,255,255,0.6)",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("pas-section"),
      type: "pas-section",
      props: {
        headline: "At {company_name}'s scale — even small inefficiencies compound fast.",
        body: "Fragmented lab relationships across {practice_count} practices create data silos, quality variance, and zero negotiating leverage. Every location paying different rates, getting different outcomes.",
        bullets: [
          "Same-store growth pressure with no lab lever to pull",
          "Fragmented lab relationships with no volume advantage",
          "Standards that don't survive growth across locations",
          "Capital constraints from scanner CAPEX requests",
        ],
      },
    },
    {
      id: makeId("comparison"),
      type: "comparison",
      props: {
        headline: "Your lab should be a competitive advantage.",
        ctaText: "Get Started",
        ctaUrl: DANDY_CTA_URL,
        oldWayLabel: "Traditional Labs",
        oldWayBullets: [
          "No growth enablement",
          "Varies by location and vendor",
          "Remakes discovered after the fact",
          "Fragmented, non-actionable reports",
          "Heavy CAPEX, scanner bottlenecks",
          "Minimal onboarding, slow rollout",
        ],
        newWayLabel: "Dandy",
        newWayBullets: [
          "30% higher case acceptance, expanded services",
          "One standard across all your practices",
          "AI Scan Review catches issues before they cost you",
          "Real-time data across {company_name}'s network",
          "Premium scanners included — no CAPEX required",
          "Hands-on training respecting clinical autonomy",
        ],
        oldCardBg: "#0d1a10",
        newCardBg: "#142218",
      },
    },
    {
      id: makeId("benefits-grid"),
      type: "benefits-grid",
      props: {
        headline: "Four systems. One growth engine.",
        columns: 2,
        items: [
          { icon: "ScanLine", title: "AI Scan Review", description: "Real-time AI flags margin issues and prep problems while the patient is still in the chair." },
          { icon: "BarChart2", title: "Executive Dashboard", description: "Visibility isn't reporting. It's control. Track remakes, turnaround, and revenue across every location." },
          { icon: "Zap", title: "5-Day Turnaround", description: "Same-day scans, 5-day crowns, 2-appointment dentures. Your patients stop waiting." },
          { icon: "DollarSign", title: "Zero CAPEX", description: "Premium intraoral scanners included. No capital requests, no bottlenecks, no excuses." },
        ],
        hoverLift: true,
      },
    },
    {
      id: makeId("testimonial"),
      type: "testimonial",
      props: {
        quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.",
        author: "Dr. Trey Mueller",
        role: "Chief Clinical Officer",
        practiceName: "Dental Care Alliance",
      },
    },
    {
      id: makeId("how-it-works"),
      type: "how-it-works",
      props: {
        headline: "Start small. Prove it. Then scale.",
        steps: [
          { number: "01", title: "Discovery Call", description: "Understand {company_name}'s current lab relationships and identify pilot locations." },
          { number: "02", title: "5–10 Location Pilot", description: "Onboard with zero disruption — scanners, training, and integration handled by Dandy." },
          { number: "03", title: "Validate Results", description: "Measure remake reduction, chair time recovered, and revenue lift at pilot sites." },
          { number: "04", title: "Network Rollout", description: "Scale across {company_name} with a proven playbook and enterprise support team." },
        ],
        circleBg: "#8db63c",
        circleText: "#0b1214",
      },
    },
    {
      id: makeId("bottom-cta"),
      type: "bottom-cta",
      props: {
        headline: "Prove ROI at a handful of practices — then scale across {company_name}.",
        subheadline: "We'll pilot at 5–10 practices, validate the impact on remakes, chair time, and revenue — then roll out with confidence.",
        ctaText: "Schedule a Discovery Call",
        ctaUrl: DANDY_CTA_URL,
        ctaAction: "url",
      },
    },
  ] as PageBlock[];
}

function flagshipBlocks(): PageBlock[] {
  return [
    {
      id: makeId("hero"),
      type: "hero",
      props: {
        headline: "Built for {company_name}.",
        subheadline: "A vertically integrated lab partner built to drive same-store growth, reduce waste, and scale with confidence.",
        ctaText: "Schedule a Conversation",
        ctaUrl: DANDY_CTA_URL,
        ctaColor: "#2ecc71",
        heroType: "static-image",
        layout: "split",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "Trusted by 2,000+ dental offices · 96% first-time right",
        imageUrl: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=1400&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: makeId("trust-bar"),
      type: "trust-bar",
      props: {
        items: [
          { value: "96%", label: "First-time right" },
          { value: "60%", label: "Fewer remakes" },
          { value: "$0", label: "CAPEX" },
          { value: "5 days", label: "Crown turnaround" },
        ],
        bgColor: "#f8faf5",
        statColor: "#0a2e1a",
        labelColor: "#6b7280",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("pas-section"),
      type: "pas-section",
      props: {
        headline: "At {company_name}'s scale — even small inefficiencies compound fast.",
        body: "Growing DSOs face a critical tension: executives need standardization and cost control, while providers demand clinical autonomy and quality they trust.",
        bullets: [
          "Same-store growth pressure — the lab is an overlooked lever",
          "Fragmented lab relationships with no volume advantage",
          "Standards that erode with every new location",
          "Capital bottlenecks from scanner CAPEX requests",
        ],
      },
    },
    {
      id: makeId("comparison"),
      type: "comparison",
      props: {
        headline: "Lab consolidation shouldn't mean compromise.",
        ctaText: "Schedule a Conversation",
        ctaUrl: DANDY_CTA_URL,
        oldWayLabel: "Traditional Labs",
        oldWayBullets: [
          "No growth enablement",
          "Varies by location and vendor",
          "Remakes discovered after the fact",
          "Fragmented, non-actionable reports",
          "Heavy CAPEX, scanner bottlenecks",
          "Minimal onboarding, slow rollout",
        ],
        newWayLabel: "Dandy",
        newWayBullets: [
          "30% higher case acceptance, expanded services",
          "One standard across all brands and locations",
          "AI Scan Review catches issues before they cost you",
          "Real-time, actionable data across all offices",
          "Premium scanners included — no CAPEX required",
          "Hands-on training that respects clinical autonomy",
        ],
        oldCardBg: "#fafafa",
        newCardBg: "#f0faf4",
      },
    },
    {
      id: makeId("benefits-grid"),
      type: "benefits-grid",
      props: {
        headline: "Why {company_name} should partner with Dandy",
        columns: 3,
        items: [
          { icon: "ScanLine", title: "AI Scan Review", description: "Real-time AI analysis catches prep and margin issues before manufacturing — eliminating the costly remake cycle." },
          { icon: "BarChart2", title: "Executive Dashboard", description: "Centralized visibility into every location's remake rate, turnaround time, and case volume — in real time." },
          { icon: "Zap", title: "Digital-First Workflow", description: "5-day crowns, 2-appointment dentures, and premium scanners included with your enterprise partnership." },
          { icon: "DollarSign", title: "Zero Capital Required", description: "Full scanner fleet included. No CAPEX. No annual requests. Just results from day one." },
          { icon: "Users", title: "Enterprise Onboarding", description: "Your dedicated enterprise team manages every aspect of the rollout across {company_name}'s network." },
          { icon: "Shield", title: "Quality Guarantee", description: "Free remakes, AI-backed quality control, and a team that owns outcomes — not just deliveries." },
        ],
        hoverLift: true,
      },
    },
    {
      id: makeId("testimonial"),
      type: "testimonial",
      props: {
        quote: "99% of our practices are still using Dandy after year one. That's not a vendor relationship — that's a partnership.",
        author: "Dr. Trey Mueller",
        role: "Chief Clinical Officer",
        practiceName: "Dental Care Alliance",
      },
    },
    {
      id: makeId("how-it-works"),
      type: "how-it-works",
      props: {
        headline: "Start small. Prove it out. Then scale.",
        steps: [
          { number: "01", title: "Strategic Discovery", description: "Map {company_name}'s current lab landscape and define the right pilot scope." },
          { number: "02", title: "Pilot Launch", description: "Onboard 5–10 locations with zero disruption — we handle everything." },
          { number: "03", title: "Validate & Measure", description: "Track remake reduction, chair time, and same-store revenue lift." },
          { number: "04", title: "Enterprise Rollout", description: "Scale across {company_name} with a proven playbook and dedicated support." },
        ],
        circleBg: "#0a2e1a",
        circleText: "#2ecc71",
      },
    },
    {
      id: makeId("bottom-cta"),
      type: "bottom-cta",
      props: {
        headline: "Start with a few locations. Then scale with confidence.",
        subheadline: "We'll pilot at 5–10 offices, validate the impact on remakes, chair time, and revenue — then roll out with confidence across {company_name}.",
        ctaText: "Schedule a Conversation",
        ctaUrl: DANDY_CTA_URL,
        ctaAction: "url",
      },
    },
  ] as PageBlock[];
}

function expansionBlocks(): PageBlock[] {
  return [
    {
      id: makeId("hero"),
      type: "hero",
      props: {
        headline: "Welcome to your Dandy partnership, {company_name}.",
        subheadline: "Your {practice_count} practices now have access to Dandy's full platform — premium scanners, AI-powered quality, and a dedicated team ready to help you grow.",
        ctaText: "Activate Your Practice",
        ctaUrl: DANDY_CTA_URL,
        ctaColor: "#2ecc71",
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "dark",
        showSocialProof: false,
        socialProofText: "",
        imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=1400&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: makeId("trust-bar"),
      type: "trust-bar",
      props: {
        items: [
          { value: "6,000+", label: "dental practices" },
          { value: "96%", label: "first-time fit rate" },
          { value: "5 Days", label: "crown turnaround" },
          { value: "$0", label: "CAPEX" },
        ],
        bgColor: "#111a14",
        statColor: "#2ecc71",
        labelColor: "rgba(255,255,255,0.6)",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("comparison"),
      type: "comparison",
      props: {
        headline: "A paradigm shift for your practices.",
        ctaText: "Activate Your Practice",
        ctaUrl: DANDY_CTA_URL,
        oldWayLabel: "Old Way",
        oldWayBullets: [
          "Analog impressions and 3-week waits",
          "Remake-prone workflows with no visibility",
          "Scanner requests piling up every year",
          "Multiple labs, none specializing",
          "No data on provider or location performance",
        ],
        newWayLabel: "Dandy",
        newWayBullets: [
          "Digital scans, 5-day crowns, 2-appointment dentures",
          "AI Scan Review catches issues in real time",
          "Premium scanners included at zero cost",
          "One lab for everything — crowns, dentures, implants",
          "Live dashboard across all {practice_count} locations",
        ],
        oldCardBg: "#111a14",
        newCardBg: "#162418",
      },
    },
    {
      id: makeId("benefits-grid"),
      type: "benefits-grid",
      props: {
        headline: "What's included in your partnership",
        columns: 3,
        items: [
          { icon: "Laptop", title: "Premium Scanner + Cart", description: "Free intraoral scanner and operatory cart delivered and installed at every activating practice." },
          { icon: "ScanLine", title: "AI Scan Review", description: "Real-time AI flags margin and prep issues while the patient is still in the chair — fewer remakes, faster seats." },
          { icon: "Zap", title: "5-Day Crowns", description: "Digital workflow delivers crowns in 5 days with a fit rate your old lab never came close to." },
          { icon: "DollarSign", title: "$1,500 Lab Credit", description: "New practices get $1,500 toward their first cases — enough to experience Dandy quality risk-free." },
          { icon: "Users", title: "Dedicated DSO Support", description: "Your own account team that knows {company_name}'s workflow. Direct line, same-day response." },
          { icon: "Award", title: "Free CE Credits", description: "Accredited courses on digital dentistry, scan technique, and restorative workflows — earn credits while you level up." },
        ],
        hoverLift: true,
      },
    },
    {
      id: makeId("how-it-works"),
      type: "how-it-works",
      props: {
        headline: "Get your practice activated in 3 steps.",
        steps: [
          { number: "01", title: "Book Onboarding Call", description: "Your dedicated Dandy rep schedules a 30-minute call to walk through the activation process." },
          { number: "02", title: "Equipment Delivered", description: "Scanner, cart, and supplies shipped to your practice — installed and ready in under a week." },
          { number: "03", title: "Start Sending Cases", description: "Submit your first scan and experience 5-day turnaround with AI-backed quality from day one." },
        ],
        circleBg: "#2ecc71",
        circleText: "#0a0f0d",
      },
    },
    {
      id: makeId("testimonial"),
      type: "testimonial",
      props: {
        quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.",
        author: "Clinical Director",
        role: "Operations",
        practiceName: "Open & Affordable Dental",
      },
    },
    {
      id: makeId("bottom-cta"),
      type: "bottom-cta",
      props: {
        headline: "Ready to activate your practice?",
        subheadline: "Your dedicated Dandy team is standing by to get you started. Book a call today.",
        ctaText: "Activate Your Practice",
        ctaUrl: DANDY_CTA_URL,
        ctaAction: "url",
      },
    },
  ] as PageBlock[];
}

function solutionsBlocks(): PageBlock[] {
  return [
    {
      id: makeId("hero"),
      type: "hero",
      props: {
        headline: "The lab partner built for {company_name}",
        subheadline: "End-to-end dental lab solutions with AI-powered quality, digital scanning, and U.S.-based manufacturing.",
        ctaText: "GET PRICING",
        ctaUrl: DANDY_CTA_URL,
        ctaColor: "#c8e84e",
        heroType: "static-image",
        layout: "split",
        backgroundStyle: "white",
        showSocialProof: true,
        socialProofText: "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing",
        imageUrl: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=1400&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: makeId("trust-bar"),
      type: "trust-bar",
      props: {
        items: [
          { value: "30%", label: "Avg case acceptance lift" },
          { value: "96%", label: "First-time right rate" },
          { value: "50%", label: "Denture appointments saved" },
          { value: "$0", label: "CAPEX to get started" },
        ],
        bgColor: "#f8faf5",
        statColor: "#1b3a2d",
        labelColor: "#6b7280",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("pas-section"),
      type: "pas-section",
      props: {
        headline: "At scale — even small inefficiencies compound fast.",
        body: "If every dentist across {company_name}'s {practice_count} practices chooses their own lab, you never get a volume advantage. Disconnected vendors create data silos, quality variance, and zero negotiating leverage.",
        bullets: [
          "Fragmented lab networks with no centralized visibility",
          "Quality that varies by location and provider",
          "No data on remake rates, turnaround, or cost",
          "Capital constraints from recurring scanner CAPEX",
        ],
      },
    },
    {
      id: makeId("comparison"),
      type: "comparison",
      props: {
        headline: "Lab consolidation shouldn't mean compromise.",
        ctaText: "GET PRICING",
        ctaUrl: DANDY_CTA_URL,
        oldWayLabel: "Traditional Labs",
        oldWayBullets: [
          "No growth enablement",
          "Varies by location and vendor",
          "Remakes discovered after the fact",
          "Fragmented, non-actionable reports",
          "Heavy CAPEX, scanner bottlenecks",
          "Minimal onboarding, slow rollout",
        ],
        newWayLabel: "Dandy",
        newWayBullets: [
          "30% higher case acceptance, expanded services like Aligners",
          "One standard across all your brands and locations",
          "AI Scan Review catches issues before they cost you",
          "Real-time, actionable data across all offices",
          "Premium scanners included — no CAPEX required",
          "Hands-on training that respects clinical autonomy",
        ],
        oldCardBg: "#fafafa",
        newCardBg: "#f0faf4",
      },
    },
    {
      id: makeId("benefits-grid"),
      type: "benefits-grid",
      props: {
        headline: "The Dandy solution for {company_name}",
        columns: 3,
        items: [
          { icon: "ScanLine", title: "AI Scan Review", description: "Real-time AI analysis catches prep and margin issues before manufacturing — eliminating costly remakes." },
          { icon: "BarChart2", title: "Executive Dashboard", description: "Centralized data across every location — remake rates, turnaround, and revenue impact in real time." },
          { icon: "Zap", title: "5-Day Crowns", description: "Same-day scans, 5-day turnaround. Your patients stop waiting and your chair time stops being wasted." },
          { icon: "DollarSign", title: "Zero CAPEX", description: "Premium intraoral scanners included with your partnership — no capital requests required." },
          { icon: "Users", title: "Enterprise Support", description: "A dedicated team manages your entire rollout — from pilot to full-network activation." },
          { icon: "Shield", title: "Quality Guarantee", description: "Free remakes backed by AI quality control. If a case doesn't fit, we fix it — no questions asked." },
        ],
        hoverLift: true,
      },
    },
    {
      id: makeId("testimonial"),
      type: "testimonial",
      props: {
        quote: "12.5% annualized revenue potential increase. Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
        author: "Dr. Layla Lohmann",
        role: "Founder",
        practiceName: "APEX Dental Partners",
      },
    },
    {
      id: makeId("how-it-works"),
      type: "how-it-works",
      props: {
        headline: "Prove ROI. Then scale.",
        steps: [
          { number: "01", title: "Discovery", description: "Map {company_name}'s current lab relationships and define the right pilot scope." },
          { number: "02", title: "Pilot at 5–10 Offices", description: "Onboard with zero disruption — equipment, training, and integration fully managed." },
          { number: "03", title: "Measure Impact", description: "Validate remake reduction, chair time recovered, and same-store revenue lift." },
          { number: "04", title: "Scale Across {company_name}", description: "Roll out to all {practice_count} practices with a proven playbook and enterprise team." },
        ],
        circleBg: "#1b3a2d",
        circleText: "#c8e84e",
      },
    },
    {
      id: makeId("bottom-cta"),
      type: "bottom-cta",
      props: {
        headline: "Prove ROI. Then scale.",
        subheadline: "Validate impact with a focused pilot at 5–10 offices — then scale across {company_name} with confidence.",
        ctaText: "GET PRICING",
        ctaUrl: DANDY_CTA_URL,
        ctaAction: "url",
      },
    },
  ] as PageBlock[];
}

function executiveBlocks(): PageBlock[] {
  return [
    {
      id: makeId("hero"),
      type: "hero",
      props: {
        headline: "Built for {company_name}.",
        subheadline: "A vertically integrated lab partner built to drive same-store growth, reduce waste, and scale with confidence.",
        ctaText: "Get Started",
        ctaUrl: DANDY_CTA_URL,
        ctaColor: "#2ecc71",
        heroType: "static-image",
        layout: "centered",
        backgroundStyle: "dark",
        showSocialProof: true,
        socialProofText: "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing",
        imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=1400&fit=crop",
        mediaUrl: "",
      },
    },
    {
      id: makeId("trust-bar"),
      type: "trust-bar",
      props: {
        items: [
          { value: "96%", label: "First-time right" },
          { value: "60%", label: "Fewer remakes" },
          { value: "$0", label: "CAPEX" },
          { value: "5 days", label: "Crown turnaround" },
        ],
        bgColor: "#0d1a10",
        statColor: "#2ecc71",
        labelColor: "rgba(255,255,255,0.6)",
        countUpEnabled: true,
      },
    },
    {
      id: makeId("pas-section"),
      type: "pas-section",
      props: {
        headline: "At {company_name}'s scale —",
        body: "Every remake is a tax. Every fragmented lab relationship is a missed leverage opportunity. Every scanner CAPEX request is capital that could be deployed elsewhere.",
        bullets: [
          "Same-store growth pressure — the lab is the most overlooked lever",
          "Multi-brand inconsistency across your network",
          "Waste that compounds silently at every location",
          "Capital tied up in scanner hardware requests",
        ],
      },
    },
    {
      id: makeId("comparison"),
      type: "comparison",
      props: {
        headline: "Lab consolidation shouldn't mean compromise",
        ctaText: "Get Started",
        ctaUrl: DANDY_CTA_URL,
        oldWayLabel: "Traditional Labs",
        oldWayBullets: [
          "No growth enablement",
          "Varies by location and vendor",
          "Remakes discovered after the fact",
          "Fragmented, non-actionable reports",
          "Heavy CAPEX, scanner bottlenecks",
          "Minimal onboarding, slow rollout",
        ],
        newWayLabel: "Dandy",
        newWayBullets: [
          "30% higher case acceptance, expanded services like Aligners",
          "One standard across all brands and locations",
          "AI Scan Review catches issues before they cost you",
          "Real-time, actionable data across all offices",
          "Premium scanners included — no CAPEX required",
          "Hands-on training that respects clinical autonomy",
        ],
        oldCardBg: "#0d1a10",
        newCardBg: "#142218",
      },
    },
    {
      id: makeId("benefits-grid"),
      type: "benefits-grid",
      props: {
        headline: "Visibility isn't reporting. It's control.",
        columns: 2,
        items: [
          { icon: "ScanLine", title: "AI Scan Review", description: "Remakes are a tax. AI eliminates them — catching margin and prep issues while the patient is still in the chair." },
          { icon: "BarChart2", title: "Executive Dashboard", description: "Real-time data across every location in {company_name}'s network — remake rates, turnaround, revenue impact." },
          { icon: "Zap", title: "Vertical Integration", description: "One partner for crowns, bridges, dentures, implants, and aligners — with U.S.-based manufacturing." },
          { icon: "DollarSign", title: "Capital Efficiency", description: "Premium scanners included. No CAPEX. Deploy capital to growth instead of hardware." },
        ],
        hoverLift: true,
      },
    },
    {
      id: makeId("stat-callout"),
      type: "stat-callout",
      props: {
        stat: "12.5%",
        description: "Annualized revenue potential increase for DSO partners who fully adopt the Dandy digital workflow.",
        footnote: "Based on APEX Dental Partners case study data.",
        countUpEnabled: false,
      },
    },
    {
      id: makeId("testimonial"),
      type: "testimonial",
      props: {
        quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
        author: "Dr. Layla Lohmann",
        role: "Founder",
        practiceName: "APEX Dental Partners",
      },
    },
    {
      id: makeId("how-it-works"),
      type: "how-it-works",
      props: {
        headline: "Start small. Prove it out. Then scale.",
        steps: [
          { number: "01", title: "Strategic Alignment", description: "Map {company_name}'s current lab relationships and define the right pilot scope." },
          { number: "02", title: "Focused Pilot", description: "Onboard 5–10 locations. Dandy manages equipment, training, and integration." },
          { number: "03", title: "Validate ROI", description: "Measure remake reduction, chair time recovered, and same-store revenue lift." },
          { number: "04", title: "Scale with Confidence", description: "Roll out across {company_name} with a proven playbook and dedicated enterprise team." },
        ],
        circleBg: "#2ecc71",
        circleText: "#0a0f0d",
      },
    },
    {
      id: makeId("bottom-cta"),
      type: "bottom-cta",
      props: {
        headline: "Start with a few locations. Then scale with confidence.",
        subheadline: "We'll pilot at 5–10 offices, validate the impact on remakes, chair time, and revenue — then roll out with confidence across {company_name}.",
        ctaText: "Schedule a Discovery Call",
        ctaUrl: DANDY_CTA_URL,
        ctaAction: "url",
      },
    },
  ] as PageBlock[];
}

export const MICROSITE_TEMPLATES: MicrositeTemplate[] = [
  {
    id: "microsite-dandy",
    name: "Dandy",
    description: "Light-mode enterprise sales microsite. Modern, data-forward layout for mid-market DSO prospects.",
    skinKey: "dandy",
    badge: "Reference",
    accentColor: "#c8e84e",
    bgColor: "#f0faf4",
    buildBlocks: dandyBlocks,
  },
  {
    id: "microsite-heartland",
    name: "Heartland",
    description: "Dark-mode enterprise skin for large regional DSOs. Emphasizes network-wide scale and operational control.",
    skinKey: "heartland",
    accentColor: "#8db63c",
    bgColor: "#0d1a10",
    buildBlocks: heartlandBlocks,
  },
  {
    id: "microsite-flagship",
    name: "Flagship",
    description: "Premium enterprise skin for top-tier DSO accounts. Professional, consultative tone with deep ROI focus.",
    skinKey: "flagship",
    accentColor: "#2ecc71",
    bgColor: "#f0faf4",
    buildBlocks: flagshipBlocks,
  },
  {
    id: "microsite-expansion",
    name: "Expansion",
    description: "Partnership onboarding skin for existing DSO customers expanding their Dandy footprint.",
    skinKey: "expansion",
    accentColor: "#2ecc71",
    bgColor: "#111a14",
    buildBlocks: expansionBlocks,
  },
  {
    id: "microsite-solutions",
    name: "Solutions",
    description: "Solutions-led enterprise skin. Leads with outcomes and proof points for operationally-minded buyers.",
    skinKey: "solutions",
    accentColor: "#c8e84e",
    bgColor: "#f8faf5",
    buildBlocks: solutionsBlocks,
  },
  {
    id: "microsite-executive",
    name: "Executive",
    description: "Dark-mode premium skin for C-suite and PE-backed DSO prospects. High-stakes, high-contrast, ROI-first.",
    skinKey: "executive",
    accentColor: "#2ecc71",
    bgColor: "#0a0f0d",
    buildBlocks: executiveBlocks,
  },
];
