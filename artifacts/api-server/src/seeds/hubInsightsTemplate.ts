// "Dandy Hub & Insights" — the first page composed from the Stack block family
// (Sept 2026): a Ramp-Stack-style product page where the product itself is the
// imagery. Every media slot is a real Dandy recording, blended into a
// gradient-glow panel so it reads as a graphic rather than an embedded player.
//
// Dental-only (industry "dental"): the copy is Dandy's own Hub / Insights
// positioning and the videos are Dandy tenant assets (media-library uploads
// served by /api/storage — public-by-URL, see routes/storage.ts — plus the
// bundled /videos clips). Facts and figures are lifted from the existing Dandy
// seeds (dso-insights-video / dso-faq / dso-testimonials defaults and the DSO
// business-case seed) — nothing here is invented.
//
// Palette keys are deliberately omitted so the page follows the tenant brand
// (Dandy forest primary + lime accent = the glow), except the stat band, which
// is a dark slab by design.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const SLUG = "global-dandy-hub-insights";
const sid = (type: string, n: number) => `seed-${SLUG}-${type}-${n}`;

// Dandy tenant media-library uploads (lp_media rows for tenant 1).
const VIDEO_INSIGHTS = "/api/storage/objects/uploads/f6f413fd-9db8-4772-b888-b6d45e58bbb9"; // "Insights Recording vff"
const VIDEO_DSO_SIZZLE = "/api/storage/objects/uploads/cd964e87-3fc8-432d-af6c-659c3387fe27"; // "2026 DSO Sizzle"
const VIDEO_VISION_SCANNER = "/api/storage/objects/uploads/68967d1d-42e1-4ab9-989c-25e7cdef39e6"; // "New Dandy Vision Intraoral Scanner"
// Bundled public clips (artifacts/lp-studio/public/videos).
const VIDEO_AI_SCAN_REVIEW = "/videos/ai-scan-review.mp4";
const VIDEO_DIGITAL_LAB = "/videos/dandy-digital-lab.mp4";

const DEMO_URL = "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";

const blocks: Block[] = [
  {
    id: sid("dandy-site-header", 1),
    type: "dandy-site-header",
    props: {
      logoUrl: "",
      phoneNumber: "(315)-859-0703",
      phoneLabel: "Sales: (315)-859-0703",
      primaryCtaText: "GET A DEMO",
      primaryCtaUrl: DEMO_URL,
      secondaryCtaText: "GET STARTED",
      secondaryCtaUrl: "https://www.meetdandy.com/get-started/",
      navLinks: [
        { label: "Lab Services", url: "https://www.meetdandy.com/labs/" },
        { label: "Solutions", url: "https://www.meetdandy.com/solutions/" },
        { label: "Technology & Support", url: "https://www.meetdandy.com/technology/" },
        { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
      ],
    },
  },
  {
    id: sid("glow-video-hero", 2),
    type: "glow-video-hero",
    props: {
      eyebrow: "Dandy Hub & Insights for dental groups",
      eyebrowIcon: "BarChart3",
      headline: "See every practice. Before it becomes a problem.",
      subheadline:
        "Dandy Hub and Insights give DSO leaders one real-time view of case flow, remake rates, scan quality, and spend — across every location.",
      align: "center",
      ctaText: "Get a demo",
      ctaUrl: DEMO_URL,
      ctaAction: "url",
      ctaSecondaryText: "Explore the platform",
      ctaSecondaryUrl: "#platform",
      ctaSecondaryAction: "url",
      mediaVideoUrl: VIDEO_INSIGHTS,
      mediaImageUrl: "",
      mediaImageAlt: "Dandy Insights dashboard showing provider-level case data across locations",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      mediaAspect: "16/9",
      showSoundToggle: false,
      logosLabel: "",
      logos: [],
    },
  },
  {
    id: sid("video-step-showcase", 3),
    type: "video-step-showcase",
    props: {
      eyebrow: "",
      headline: "Set up in days. See everything in weeks.",
      subheadline: "",
      autoAdvanceSeconds: 8,
      mediaSide: "right",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      mediaAspect: "4/3",
      steps: [
        {
          title: "Connect every location",
          body: "Every practice on Dandy rolls into one Hub account — case tracking, scan submissions, and billing in a single portal your regionals actually use.",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Dandy Hub case list across locations",
        },
        {
          title: "Review scans before they ship",
          body: "AI Scan Review flags margin gaps, prep angles, and tissue interference while the patient is still in the chair, so issues are fixed before the case is submitted.",
          videoUrl: VIDEO_AI_SCAN_REVIEW,
          imageUrl: "",
          imageAlt: "AI Scan Review flagging a margin issue on an intraoral scan",
        },
        {
          title: "Manage by exception",
          body: "Insights surfaces the locations and providers trending the wrong way, so clinical leaders know exactly where to intervene — and where not to.",
          videoUrl: VIDEO_DSO_SIZZLE,
          imageUrl: "",
          imageAlt: "Dandy platform overview for dental groups",
        },
      ],
    },
  },
  {
    id: sid("glow-stat-band", 4),
    type: "glow-stat-band",
    props: {
      headline: "One platform. Every location.",
      headlineLine2: "Unlock quality and capacity.",
      showQuotes: true,
      stats: [
        { prefix: "Trusted by", value: "12,000+", label: "dental practices already running their lab work through Dandy." },
        { prefix: "Network-wide", value: "96%", label: "first-time-right rate — and Insights tracks it by provider, not just by practice." },
        { prefix: "Industry average", value: "5–7%", label: "remake rate. Insights shows which providers sit above it, in real time." },
      ],
      quotes: [
        { quote: "It would be insane not to use it given the data available.", author: "Dr. Eller", role: "Clinical Leader" },
        { quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", author: "Clinical Director", role: "Open & Affordable Dental" },
        { quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", author: "Dr. Trey Mueller", role: "Chief Clinical Officer, Dental Care Alliance" },
        { quote: "They value education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Maya Chen", role: "Founder, Northwind Dental Partners" },
      ],
    },
  },
  {
    id: sid("video-zigzag", 5),
    type: "video-zigzag",
    props: {
      eyebrow: "",
      headline: "Your practices. Your view.",
      subheadline: "Purpose-built analytics for modern dental groups — not another monthly report.",
      startSide: "left",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      mediaAspect: "4/3",
      rows: [
        {
          title: "Remake rates, by provider.",
          body: "Track quality by provider, not just by practice. See who is trending up, who needs coaching, and where remakes cluster — weeks before it shows up in the P&L.",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Insights remake-rate view by provider",
        },
        {
          title: "Scan quality, before it ships.",
          body: "AI Scan Review catches clinical issues chairside, and Insights shows scan quality by location and provider so problems are caught before they become remakes.",
          videoUrl: VIDEO_AI_SCAN_REVIEW,
          imageUrl: "",
          imageAlt: "AI Scan Review analysing an intraoral scan",
        },
        {
          title: "Spend tracking, every location.",
          body: "Know where every dollar goes across all locations — live, in one dashboard, instead of reconciled monthly by office.",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Insights spend view across locations",
        },
        {
          title: "Coach with data, not instinct.",
          body: "Provider-level performance, side by side. Give clinical leaders evidence to coach from instead of anecdotes and phone calls.",
          videoUrl: VIDEO_VISION_SCANNER,
          imageUrl: "",
          imageAlt: "Dandy Vision intraoral scanner in use",
        },
      ],
    },
  },
  {
    id: sid("benchmark-bars", 6),
    type: "benchmark-bars",
    props: {
      eyebrow: "",
      headline: "Digital precision beats the analog lab average.",
      subheadline:
        "A fully digital workflow — intraoral scan, AI Scan Review, and a vertically integrated lab — removes the impression variability that drives remakes in analog workflows.",
      chartLabel: "First-time-right rate, network-wide",
      bars: [
        { label: "Dandy digital lab", value: 99, highlighted: true },
        { label: "Analog lab industry average", value: 92, delta: "+7 pts" },
      ],
      footnote:
        "Industry average reflects analog impression workflows (~92% first-time-right); the Dandy figure is the network-wide digital first-time-right rate reported in Dandy Insights.",
    },
  },
  {
    id: sid("video-card-trio", 7),
    type: "video-card-trio",
    props: {
      eyebrow: "",
      headline: "Connected. Accountable. Clear.",
      subheadline: "One login for every location. One partner accountable for every case.",
      playMode: "inview",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      cards: [
        {
          title: "One portal for every location.",
          body: "Case tracking, scan submissions, billing, and support in a single Hub account that scales with the group.",
          icon: "LayoutGrid",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Dandy Hub portal",
        },
        {
          title: "AI Scan Review, built in.",
          body: "Real-time feedback with visual callouts on every scan — no extra software, no extra step for the assistant.",
          icon: "ScanLine",
          videoUrl: VIDEO_AI_SCAN_REVIEW,
          imageUrl: "",
          imageAlt: "AI Scan Review callouts on a scan",
        },
        {
          title: "One accountable partner.",
          body: "Every case flows through one vertically integrated digital lab — not five vendors and a printer.",
          icon: "Building2",
          videoUrl: VIDEO_DIGITAL_LAB,
          imageUrl: "",
          imageAlt: "Inside Dandy's digital dental lab",
        },
      ],
    },
  },
  {
    id: sid("dso-faq", 8),
    type: "dso-faq",
    props: {
      eyebrow: "Common questions",
      headline: "What DSO leaders ask us about Hub and Insights.",
      subheadline: "",
      items: [
        {
          question: "What is Dandy Hub?",
          answer:
            "Dandy Hub is the portal every location on Dandy already uses — case tracking, scan submissions, billing, and support in one place. For groups, every practice rolls into a single account so regional leaders see the whole network, not one office at a time.",
        },
        {
          question: "What does Insights actually show me?",
          answer:
            "Live metrics on scan quality, remake rates, case volumes, turnaround, and spend — by location, by region, and by provider. It is built for managing by exception: know where to intervene before problems scale.",
        },
        {
          question: "Do my practices need new software or hardware?",
          answer:
            "No. Insights runs on the case data already flowing through Dandy Hub. Practices keep scanning and submitting the way they do today; leadership gets the view on top.",
        },
        {
          question: "How does AI Scan Review fit in?",
          answer:
            "AI Scan Review flags margin gaps, prep angles, and tissue interference while the patient is still in the chair, so scans are fixed before submission. Insights then shows scan quality by provider so you can coach with data.",
        },
        {
          question: "How long does it take to get a location set up?",
          answer:
            "An on-site Dandy trainer walks the team through the scanner and workflow, and practices are up and running in days — not weeks. Most see zero disruption to active cases.",
        },
      ],
      backgroundStyle: "white",
    },
  },
  {
    id: sid("glow-final-cta", 9),
    type: "glow-final-cta",
    props: {
      headline: "See your whole group in one view.",
      subheadline: "Book a 30-minute walkthrough of Dandy Hub and Insights with the enterprise team.",
      ctaText: "Get a demo",
      ctaUrl: DEMO_URL,
      ctaAction: "url",
      ctaSecondaryText: "Talk to sales",
      ctaSecondaryUrl: "https://www.meetdandy.com/get-in-touch/",
      ctaSecondaryAction: "url",
      footnote: "",
      showGlow: true,
    },
  },
  {
    id: sid("dandy-site-footer", 10),
    type: "dandy-site-footer",
    props: {
      logoUrl: "",
      disclaimer: "",
      copyrightText: "",
      linkGroups: [
        {
          heading: "Dandy",
          links: [
            { label: "Home", url: "https://www.meetdandy.com/" },
            { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
            { label: "Get in touch", url: "https://www.meetdandy.com/get-in-touch/" },
            { label: "Dandy Reviews", url: "https://www.meetdandy.com/reviews/" },
            { label: "Careers", url: "https://www.meetdandy.com/careers/" },
          ],
        },
        {
          heading: "Legal",
          links: [
            { label: "Privacy Policy", url: "https://www.meetdandy.com/privacy/" },
            { label: "Terms of Use", url: "https://www.meetdandy.com/terms-of-use/" },
            { label: "Privacy Requests", url: "https://www.meetdandy.com/privacy-requests/" },
          ],
        },
      ],
    },
  },
];

export const HUB_INSIGHTS_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: SLUG,
    title: "Dandy Hub & Insights — Product Stack",
    templateLabel: "Dandy Hub & Insights — Product Stack",
    templateDescription:
      "Ramp-Stack-style product page for Hub and Insights: glow video hero, auto-advancing video steps, dark stat band with quotes, video zigzag, benchmark bars, video card trio, FAQ and a glow close — every clip blended into the page like a graphic.",
    ogImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
    industry: "dental",
    premiumRank: 12,
    blocks,
  },
];
