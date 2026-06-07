// Rich, tenant-neutral premium default props for the template-page blocks.
// Kept separate from the pure type contract (template-pages.ts) and consumed by
// the block registry's defaultProps() factories. Every value is generic /
// brand-agnostic so the blocks read as polished starting points for ANY tenant.

import type {
  EventPageCommonProps,
  CaseStudyCommonProps,
} from "./template-pages";

export type EventVariant = "noir" | "luminous" | "split";
export type CaseVariant = "metrics" | "editorial" | "modular";

// ── shared neutral content ──────────────────────────────────────────────────

const EVENT_FORM_FIELDS = [
  { id: "firstName", label: "First name", type: "text" as const, required: true },
  { id: "lastName", label: "Last name", type: "text" as const, required: true },
  { id: "email", label: "Work email", type: "email" as const, required: true },
  { id: "company", label: "Company", type: "text" as const },
  { id: "role", label: "Role / title", type: "text" as const },
];

interface EventVariantConfig {
  palette: Partial<EventPageCommonProps>;
  heroImageUrl: string;
  venueImageUrl: string;
  speakerPhotos: string[];
  galleryImages: string[];
}

const EVENT_VARIANTS: Record<EventVariant, EventVariantConfig> = {
  noir: {
    palette: {
      bgColor: "#0b0b0d",
      inkColor: "#f4f4f5",
      mutedColor: "#a1a1aa",
      accentColor: "#c9a86a",
      accentInkColor: "#0b0b0d",
      darkColor: "#000000",
      cardBgColor: "#151517",
      borderColor: "#2a2a2e",
      headlineColor: "#f4f4f5",
      sectionSpacing: "spacious",
      contentWidth: "standard",
      cornerRadius: "sharp",
      headingScale: "display",
    },
    heroImageUrl: "/images/noir-hero.png",
    venueImageUrl: "/images/noir-venue-map.png",
    speakerPhotos: ["/images/noir-speaker-1.png", "/images/noir-speaker-2.png", "/images/noir-speaker-3.png"],
    galleryImages: ["/images/noir-gallery-1.png", "/images/noir-gallery-2.png", "/images/noir-gallery-3.png"],
  },
  luminous: {
    palette: {
      bgColor: "#fafaf8",
      inkColor: "#18181b",
      mutedColor: "#71717a",
      accentColor: "#4f46e5",
      accentInkColor: "#ffffff",
      darkColor: "#1c1c22",
      cardBgColor: "#ffffff",
      borderColor: "#e7e5e0",
      headlineColor: "#18181b",
      sectionSpacing: "spacious",
      contentWidth: "narrow",
      cornerRadius: "rounded",
      headingScale: "balanced",
    },
    heroImageUrl: "/images/luminous-hero.png",
    venueImageUrl: "/images/luminous-venue.png",
    speakerPhotos: ["/images/luminous-gallery-1.png", "/images/luminous-gallery-2.png", "/images/luminous-gallery-3.png"],
    galleryImages: ["/images/luminous-gallery-1.png", "/images/luminous-gallery-2.png", "/images/luminous-gallery-3.png"],
  },
  split: {
    palette: {
      bgColor: "#ffffff",
      inkColor: "#0f172a",
      mutedColor: "#64748b",
      accentColor: "#2563eb",
      accentInkColor: "#ffffff",
      darkColor: "#0f172a",
      cardBgColor: "#f8fafc",
      borderColor: "#e2e8f0",
      headlineColor: "#0f172a",
      sectionSpacing: "normal",
      contentWidth: "wide",
      cornerRadius: "soft",
      headingScale: "balanced",
    },
    heroImageUrl: "/images/framework-hero.png",
    venueImageUrl: "/images/framework-venue.png",
    speakerPhotos: [
      "/images/framework-speaker1.png",
      "/images/framework-speaker2.png",
      "/images/framework-speaker3.png",
      "/images/framework-speaker4.png",
    ],
    galleryImages: ["/images/framework-gallery1.png", "/images/framework-gallery2.png"],
  },
};

export function eventPageDefaults(variant: EventVariant): EventPageCommonProps {
  const v = EVENT_VARIANTS[variant];
  return {
    brandName: "Summit",
    logoAlt: "Summit",

    showNav: true,
    showHero: true,
    showCountdown: true,
    showAbout: true,
    showAgenda: true,
    showSpeakers: true,
    showVenue: true,
    showGallery: true,
    showSponsors: true,
    showTickets: true,
    showFaq: true,
    showForm: true,
    showFooter: true,

    navLinks: [
      { label: "About", href: "#about" },
      { label: "Speakers", href: "#speakers" },
      { label: "Agenda", href: "#agenda" },
      { label: "Venue", href: "#venue" },
      { label: "Register", href: "#register" },
    ],
    navCtaLabel: "Register",
    navCtaUrl: "#register",

    heroEyebrow: "March 18–20, 2026 · San Francisco",
    eventName: "The Industry Summit 2026",
    heroTagline: "Three days of ideas, connections, and momentum with the people shaping what comes next.",
    eventDate: "March 18–20, 2026",
    eventLocation: "Pier 27, San Francisco",
    heroCtaLabel: "Reserve your seat",
    heroCtaUrl: "#register",
    heroSecondaryCtaLabel: "View the agenda",
    heroSecondaryCtaUrl: "#agenda",
    heroImageUrl: v.heroImageUrl,
    heroOverlayOpacity: 45,

    countdownHeading: "Doors open in",
    countdownTargetDate: "2026-03-18T09:00:00",

    aboutEyebrow: "Why attend",
    aboutHeading: "One room. Every leader you've been meaning to meet.",
    aboutBody:
      "The Summit brings together operators, builders, and decision-makers for three days of candid talks, hands-on workshops, and the kind of hallway conversations that change the trajectory of a year. No fluff, no filler — just signal.",
    aboutStats: [
      { value: "1,200+", label: "Attendees" },
      { value: "40+", label: "Speakers" },
      { value: "25", label: "Sessions" },
      { value: "3", label: "Days" },
    ],

    agendaEyebrow: "Agenda",
    agendaHeading: "Three days, carefully programmed",
    agendaDays: [
      {
        dayLabel: "Day 1",
        date: "Wed · March 18",
        sessions: [
          { time: "9:00 AM", title: "Registration & welcome coffee" },
          { time: "10:00 AM", title: "Opening keynote: The year ahead", description: "Where the industry is headed and why it matters now.", speaker: "Alex Rivera" },
          { time: "11:30 AM", title: "Panel: Building durable teams", speaker: "Jordan Lee" },
          { time: "1:00 PM", title: "Lunch & networking" },
          { time: "2:30 PM", title: "Workshop tracks (choose one)" },
        ],
      },
      {
        dayLabel: "Day 2",
        date: "Thu · March 19",
        sessions: [
          { time: "9:30 AM", title: "Morning keynote", speaker: "Sam Patel" },
          { time: "11:00 AM", title: "Deep-dive sessions" },
          { time: "1:00 PM", title: "Lunch & roundtables" },
          { time: "3:00 PM", title: "Fireside chat", speaker: "Maya Chen" },
          { time: "6:00 PM", title: "Evening reception" },
        ],
      },
      {
        dayLabel: "Day 3",
        date: "Fri · March 20",
        sessions: [
          { time: "10:00 AM", title: "Hands-on labs" },
          { time: "12:00 PM", title: "Closing keynote", speaker: "Alex Rivera" },
          { time: "1:30 PM", title: "Farewell lunch" },
        ],
      },
    ],

    speakersEyebrow: "Speakers",
    speakersHeading: "Learn from people doing the work",
    speakers: [
      { name: "Alex Rivera", role: "Founder & CEO", company: "Northwind", photoUrl: v.speakerPhotos[0], bio: "Building category-defining products for over a decade." },
      { name: "Maya Chen", role: "Head of Design", company: "Lumen", photoUrl: v.speakerPhotos[1], bio: "Designing systems used by millions every day." },
      { name: "Jordan Lee", role: "VP Engineering", company: "Atlas", photoUrl: v.speakerPhotos[2 % v.speakerPhotos.length], bio: "Scaling teams and platforms from zero to global." },
      { name: "Sam Patel", role: "Operating Partner", company: "Meridian", photoUrl: v.speakerPhotos[3 % v.speakerPhotos.length], bio: "Helping founders turn traction into durable growth." },
    ],

    venueEyebrow: "Venue",
    venueHeading: "A waterfront space built for focus",
    venueName: "Pier 27 · The Embarcadero",
    venueAddress: "Pier 27, The Embarcadero, San Francisco, CA 94111",
    venueDescription:
      "Floor-to-ceiling glass, bay views, and rooms designed for both big talks and small conversations. Steps from transit, hotels, and the best coffee in the city.",
    venueImageUrl: v.venueImageUrl,

    galleryHeading: "Moments from last year",
    galleryImages: v.galleryImages.map((url, i) => ({ url, caption: ["On the main stage", "Workshop in session", "The evening reception"][i] })),

    sponsorsHeading: "Backed by partners who get it",
    sponsors: [
      { name: "Northwind", tier: "Headline" },
      { name: "Lumen", tier: "Headline" },
      { name: "Atlas", tier: "Partner" },
      { name: "Meridian", tier: "Partner" },
      { name: "Vertex", tier: "Community" },
      { name: "Cobalt", tier: "Community" },
    ],

    ticketsEyebrow: "Registration",
    ticketsHeading: "Pick the pass that fits",
    ticketTiers: [
      {
        name: "Early Bird",
        price: "$399",
        period: "until Feb 1",
        description: "Full access at the best price.",
        features: ["All keynotes & sessions", "Workshop access", "Evening reception", "Lunch all three days"],
        ctaLabel: "Get Early Bird",
        ctaUrl: "#register",
      },
      {
        name: "Standard",
        price: "$599",
        period: "general admission",
        description: "Everything you need for the full experience.",
        features: ["All keynotes & sessions", "Workshop access", "Evening reception", "Lunch all three days", "Recorded sessions"],
        ctaLabel: "Register",
        ctaUrl: "#register",
        featured: true,
      },
      {
        name: "Team",
        price: "$2,499",
        period: "5 seats",
        description: "Bring the whole crew and save.",
        features: ["5 full passes", "Reserved seating", "Private team lunch", "Dedicated concierge"],
        ctaLabel: "Register a team",
        ctaUrl: "#register",
      },
    ],

    faqHeading: "Frequently asked",
    faqItems: [
      { question: "Where is the event held?", answer: "Pier 27 on the Embarcadero in San Francisco. Full travel details are sent after registration." },
      { question: "Are meals included?", answer: "Yes — lunch is provided all three days, plus coffee, snacks, and the evening reception." },
      { question: "Can I get a refund?", answer: "Tickets are fully refundable up to 30 days before the event, and transferable any time." },
      { question: "Will sessions be recorded?", answer: "Standard and Team passes include access to recorded sessions after the event." },
    ],

    formEyebrow: "Register",
    formHeading: "Save your seat",
    formSubheading: "Spots are limited. Tell us a little about you and we'll send your confirmation.",
    formFields: EVENT_FORM_FIELDS,
    formSubmitLabel: "Complete registration",
    formSuccessMessage: "You're in! Check your inbox for confirmation and details.",
    formSubmitUrl: "/api/lp/leads",

    footerTagline: "The Industry Summit — where the next chapter gets written.",
    footerLinks: [
      { label: "About", href: "#about" },
      { label: "Agenda", href: "#agenda" },
      { label: "Speakers", href: "#speakers" },
      { label: "Register", href: "#register" },
    ],
    footerNote: "© 2026 The Industry Summit. All rights reserved.",

    ...v.palette,
  };
}

// ── case-study family ───────────────────────────────────────────────────────

interface CaseVariantConfig {
  palette: Partial<CaseStudyCommonProps>;
  heroImageUrl: string;
  challengeImageUrl: string;
  quotePortraitUrl: string;
  galleryImages: string[];
  moduleImages: string[];
}

const CASE_VARIANTS: Record<CaseVariant, CaseVariantConfig> = {
  metrics: {
    palette: {
      bgColor: "#ffffff",
      inkColor: "#0a0a0a",
      mutedColor: "#6b7280",
      accentColor: "#16a34a",
      accentInkColor: "#ffffff",
      darkColor: "#0a0a0a",
      cardBgColor: "#f9fafb",
      borderColor: "#e5e7eb",
      headlineColor: "#0a0a0a",
      sectionSpacing: "normal",
      contentWidth: "wide",
      cornerRadius: "soft",
      headingScale: "balanced",
    },
    heroImageUrl: "/images/case-study-deep-dive-1.jpg",
    challengeImageUrl: "/images/case-study-challenge.jpg",
    quotePortraitUrl: "/images/case-study-portrait.jpg",
    galleryImages: ["/images/case-study-gallery-1.jpg", "/images/case-study-gallery-2.jpg", "/images/case-study-gallery-3.jpg"],
    moduleImages: ["/images/case-study-deep-dive-1.jpg", "/images/case-study-deep-dive-2.jpg"],
  },
  editorial: {
    palette: {
      bgColor: "#fbf9f5",
      inkColor: "#1c1917",
      mutedColor: "#78716c",
      accentColor: "#b45309",
      accentInkColor: "#ffffff",
      darkColor: "#1c1917",
      cardBgColor: "#ffffff",
      borderColor: "#e7e1d8",
      headlineColor: "#1c1917",
      sectionSpacing: "spacious",
      contentWidth: "narrow",
      cornerRadius: "soft",
      headingScale: "display",
    },
    heroImageUrl: "/images/editorial-hero.png",
    challengeImageUrl: "/images/editorial-challenge.png",
    quotePortraitUrl: "/images/editorial-testimonial.png",
    galleryImages: ["/images/editorial-gallery-1.png", "/images/editorial-gallery-2.png", "/images/editorial-gallery-3.png"],
    moduleImages: ["/images/editorial-chapter-1.png", "/images/editorial-chapter-2.png"],
  },
  modular: {
    palette: {
      bgColor: "#f8fafc",
      inkColor: "#0f172a",
      mutedColor: "#64748b",
      accentColor: "#6366f1",
      accentInkColor: "#ffffff",
      darkColor: "#0f172a",
      cardBgColor: "#ffffff",
      borderColor: "#e2e8f0",
      headlineColor: "#0f172a",
      sectionSpacing: "normal",
      contentWidth: "standard",
      cornerRadius: "rounded",
      headingScale: "balanced",
    },
    heroImageUrl: "/images/vanguard-hero.png",
    challengeImageUrl: "/images/vanguard-module-1.png",
    quotePortraitUrl: "/images/vanguard-module-3.png",
    galleryImages: ["/images/vanguard-gallery-1.png", "/images/vanguard-gallery-2.png", "/images/vanguard-gallery-3.png"],
    moduleImages: ["/images/vanguard-module-1.png", "/images/vanguard-module-2.png", "/images/vanguard-module-3.png"],
  },
};

export function caseStudyDefaults(variant: CaseVariant): CaseStudyCommonProps {
  const v = CASE_VARIANTS[variant];
  return {
    brandName: "Acme",
    logoAlt: "Acme",

    showNav: true,
    showHero: true,
    showMetrics: true,
    showAtAGlance: true,
    showChallenge: true,
    showApproach: true,
    showResults: true,
    showQuote: true,
    showGallery: true,
    showModules: true,
    showTakeaways: true,
    showCta: true,
    showFooter: true,

    navLinks: [
      { label: "Overview", href: "#overview" },
      { label: "Challenge", href: "#challenge" },
      { label: "Results", href: "#results" },
    ],
    navCtaLabel: "Talk to us",
    navCtaUrl: "#contact",

    heroEyebrow: "Customer Story",
    clientName: "Northwind",
    heroHeadline: "How Northwind cut onboarding time by 60% and scaled to 40 new markets.",
    heroSummary:
      "A fast-growing operations team was buckling under manual processes. Here's how they rebuilt their workflow and turned a bottleneck into a competitive advantage.",
    heroImageUrl: v.heroImageUrl,
    heroCtaLabel: "Read the story",
    heroCtaUrl: "#challenge",

    metricsHeading: "The impact, by the numbers",
    metrics: [
      { value: "60%", label: "Faster onboarding", caption: "From 10 days to 4" },
      { value: "40", label: "New markets", caption: "Opened in 12 months" },
      { value: "3.2x", label: "Team throughput", caption: "Same headcount" },
      { value: "$1.4M", label: "Annual savings", caption: "In operating costs" },
    ],

    atAGlanceHeading: "At a glance",
    profile: [
      { label: "Industry", value: "Logistics" },
      { label: "Company size", value: "500–1,000" },
      { label: "Headquarters", value: "Chicago, IL" },
      { label: "Using since", value: "2024" },
    ],

    challengeEyebrow: "The Challenge",
    challengeHeading: "Growth was outpacing the playbook",
    challengeBody:
      "Every new market meant another round of manual setup, spreadsheets passed between teams, and onboarding that stretched for weeks. The operations team was spending more time fighting fires than building. Leadership knew the model wouldn't survive the next phase of growth — they needed a system, not more headcount.",
    challengeImageUrl: v.challengeImageUrl,

    approachEyebrow: "The Approach",
    approachHeading: "A system designed for scale",
    approachBody:
      "We worked side by side with the team to map every step, cut what didn't serve the goal, and rebuild the rest into a repeatable workflow.",
    approachCards: [
      { title: "Map & audit", body: "Documented every manual step to find the real bottlenecks — not the assumed ones.", icon: "search" },
      { title: "Standardize", body: "Turned tribal knowledge into a single, repeatable playbook anyone could run.", icon: "layers" },
      { title: "Automate", body: "Removed the busywork so the team could focus on judgment calls, not data entry.", icon: "zap" },
      { title: "Measure", body: "Instrumented the workflow so improvements were visible and durable.", icon: "bar-chart" },
    ],

    resultsEyebrow: "The Results",
    resultsHeading: "A bottleneck became an advantage",
    resultsBody:
      "Within two quarters, onboarding dropped from ten days to four, the team opened 40 new markets without adding headcount, and leadership finally had the visibility to plan the next phase with confidence.",
    resultStats: [
      { value: "60%", label: "Faster onboarding" },
      { value: "3.2x", label: "More throughput" },
      { value: "98%", label: "Process adherence" },
    ],

    quoteText:
      "We stopped firefighting and started building. The new system didn't just save time — it changed what our team believed was possible.",
    quoteAuthor: "Maya Chen",
    quoteRole: "VP of Operations, Northwind",
    quotePortraitUrl: v.quotePortraitUrl,

    galleryHeading: "Inside the work",
    galleryImages: v.galleryImages.map((url, i) => ({ url, caption: ["Workflow mapping", "The new dashboard", "Team rollout"][i] })),

    modulesHeading: "How it came together",
    modules: [
      {
        heading: "Rebuilding the onboarding flow",
        body:
          "We replaced a 14-step manual checklist with a guided flow that adapts to each market's requirements. New regions now go live in days, not weeks, with fewer errors and zero handoff gaps.",
        imageUrl: v.moduleImages[0],
      },
      {
        heading: "A single source of truth",
        body:
          "Scattered spreadsheets gave way to one live dashboard. Every team now works from the same data, and leadership can see exactly where each market stands at any moment.",
        imageUrl: v.moduleImages[1 % v.moduleImages.length],
      },
      {
        heading: "Automating the busywork",
        body:
          "Routine data entry and status updates now happen automatically, freeing the team to focus on the decisions that actually move the business forward.",
        imageUrl: v.moduleImages[2 % v.moduleImages.length],
      },
    ],

    takeawaysHeading: "Key takeaways",
    takeaways: [
      { text: "Standardizing the workflow unlocked scale without adding headcount." },
      { text: "Visibility turned reactive firefighting into proactive planning." },
      { text: "Automation freed the team to focus on judgment, not data entry." },
    ],

    ctaHeading: "Ready to write your own story?",
    ctaBody: "See how a system built for scale could change your next chapter. Let's talk.",
    ctaLabel: "Book a conversation",
    ctaUrl: "#contact",

    footerTagline: "Real results from teams who decided to build something better.",
    footerLinks: [
      { label: "Overview", href: "#overview" },
      { label: "Results", href: "#results" },
      { label: "Contact", href: "#contact" },
    ],
    footerNote: "© 2026 Acme. All rights reserved.",

    ...v.palette,
  };
}
