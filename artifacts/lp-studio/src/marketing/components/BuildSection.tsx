import { motion, useScroll, useTransform, useMotionValueEvent, MotionValue } from "framer-motion";
import lpLockup from "@assets/lp-lockup-horizontal-navy-depth-2048_1781934486001.png";
import { useEffect, useRef, useState, createContext, useContext, type ReactNode, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

// Lovable BuildSection ported verbatim from scroll-saga-lp. Only three
// surgical changes from the source:
//   • motion/react → framer-motion (same lib, v12 alias)
//   • Inline AISuggestion type (was imported from @/lib/ai-suggestions.functions)
//   • Replace useServerFn fetch with a USE_LIVE_AI flag that falls back to
//     the local getSuggestions heuristic. Flip USE_LIVE_AI = true once we
//     have a public AI Suggest backend endpoint at /api/public/ai-suggest
//     accepting the same payload shape.

type AISuggestion = {
  tag: "Copy" | "Layout" | "Brand" | "Convert";
  body: string;
};

type BlockCtx = {
  txMap: Record<string, BlockTx>;
  setTx: (key: string, next: BlockTx) => void;
  recordEdit: (s: string) => void;
  accentColor: string;
};
const BlockContext = createContext<BlockCtx | null>(null);


/**
 * BuildSection — pinned scrollytelling.
 * Page assembles inside a browser frame, then the browser frame gets
 * wrapped inside a full page-builder UI (left layers panel, right inspector,
 * top toolbar). Once wrapped, the user can click layers, swap accent color,
 * edit the headline live, and switch between demo brand configs.
 */

type Device = "Desktop" | "Tablet" | "Mobile";
type LayerKey = "page" | "nav" | "hero" | "headline" | "subhead" | "visual" | "stats" | "features" | "testimonial" | "logos" | "pricing" | "faq" | "cta" | "footer";
type BlockTx = { scale: number; dx: number; dy: number };


type AccentKey = "indigo" | "coral" | "sage" | "gold" | "ink" | "violet" | "teal" | "crimson" | "neon";
const ACCENTS: Record<AccentKey, { color: string; soft: string; label: string }> = {
  // Matches the marketing site's real indigo (marketing.css --indigo), so
  // the LP Studio demo page is in OUR palette, not a generic violet.
  indigo: { color: "#3C38B8", soft: "rgba(75, 71, 229, 0.28)", label: "Indigo" },
  coral: { color: "oklch(0.72 0.17 28)", soft: "oklch(0.86 0.09 28)", label: "Coral" },
  sage: { color: "oklch(0.62 0.11 155)", soft: "oklch(0.85 0.07 155)", label: "Sage" },
  gold: { color: "oklch(0.74 0.15 85)", soft: "oklch(0.88 0.09 85)", label: "Gold" },
  ink: { color: "oklch(0.18 0.012 270)", soft: "oklch(0.55 0.02 270)", label: "Ink" },
  violet: { color: "oklch(0.48 0.26 305)", soft: "oklch(0.80 0.11 305)", label: "Violet" },
  teal: { color: "oklch(0.62 0.13 195)", soft: "oklch(0.85 0.07 195)", label: "Teal" },
  crimson: { color: "oklch(0.55 0.22 18)", soft: "oklch(0.82 0.09 18)", label: "Crimson" },
  neon: { color: "oklch(0.78 0.22 142)", soft: "oklch(0.90 0.10 142)", label: "Neon" },
};

type HeroLayout = "splitRight" | "splitLeft" | "centered" | "fullBleed" | "dashboard";

type Preset = {
  id: string;
  brand: string;
  domain: string;
  category: string;
  nav: string[];
  headline1: string;
  headline2: string;
  subhead: string;
  primaryCta: string;
  ghostCta: string;
  badge: string;
  nextLabel: string;
  nextValue: string;
  features: { t: string; d: string }[];
  logos: string[];
  ctaTitle: string;
  ctaSub: string;
  ctaButton: string;
  /** Demo-page nav CTA label. Defaults to "Book" (the original presets'
   *  bookings vibe); product presets override it. */
  navCta?: string;
  /** Optional hero photograph — when set, the hero visual card renders it
   *  under the badge/live-signal overlays instead of the gradient fill. */
  heroImage?: string;
  /** Optional demo-page canvas background (defaults to white). The LP Studio
   *  preset uses the site's cream so the demo page matches OUR brand. */
  pageBg?: string;
  accent: AccentKey;
  layout: HeroLayout;
};

const PRESETS: Preset[] = [
  // Default preset is LP Studio ITSELF — the demo assembles our own landing
  // page (self-referential product copy people read while they watch). The
  // other presets stay in the toolbar switcher to show brand range; their
  // names double as the "customers" in this preset's logo row.
  {
    id: "lpstudio",
    brand: "LP Studio",
    domain: "lpstudio.ai",
    category: "AI Revenue Workspace",
    nav: ["For Marketing", "For Sales", "Templates", "Pricing"],
    // Deliberately does NOT repeat the homepage hero ("Describe a page. /
    // Watch it build." lives right above this section) — the demo page goes
    // a level deeper and teaches what's inside the app.
    headline1: "Skip the brief.",
    headline2: "Ship the page.",
    subhead:
      "Personalized, on-brand landing pages — live in minutes, measured from the first visit.",
    primaryCta: "Start free",
    ghostCta: "Book a demo",
    badge: "\u2726 AI-native",
    nextLabel: "Live signal",
    nextValue: "Acme opened your microsite \u00b7 2m ago",
    features: [
      { t: "Brand-locked", d: "Your kit on every block" },
      { t: "A/B built in", d: "Variants + smart traffic" },
      { t: "Live signals", d: "See who's reading, when" },
    ],
    logos: ["Smilist", "Northwind", "Field Co.", "Verdant", "Atlas", "Ember"],
    ctaTitle: "Ready to see your brand in it?",
    ctaSub: "Import your site — fonts, colors, and voice load in one scan.",
    ctaButton: "Import my brand \u2192",
    navCta: "Get started",
    heroImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=70",
    accent: "indigo",
    layout: "centered",
  },
  {
    id: "smilist",
    brand: "Smilist",
    domain: "smilist.com",
    category: "Dental · Local",
    nav: ["Locations", "Services", "Patients", "About"],
    headline1: "Modern dentistry,",
    headline2: "now in 16 cities.",
    subhead:
      "Same-day visits, transparent pricing, and a team that actually knows your name. Book online in under a minute.",
    primaryCta: "Find a location",
    ghostCta: "Watch tour",
    badge: "★ 4.9 · 12k",
    nextLabel: "Next available",
    nextValue: "Today, 3:40 PM · Brooklyn",
    features: [
      { t: "Same-day", d: "Walk-ins welcome" },
      { t: "Transparent", d: "Prices upfront" },
      { t: "Personal", d: "Your team, every time" },
    ],
    logos: ["Vogue", "Forbes", "TIME", "WSJ", "Wired", "Bloomberg"],
    ctaTitle: "Ready when you are.",
    ctaSub: "Book in 60 seconds · no insurance call needed.",
    ctaButton: "Get started →",
    accent: "indigo",
    layout: "splitRight",
  },
  {
    id: "northwind",
    brand: "Northwind",
    domain: "northwind.ai",
    category: "B2B SaaS",
    nav: ["Product", "Customers", "Pricing", "Docs"],
    headline1: "Pipeline that",
    headline2: "writes itself.",
    subhead:
      "AI-native CRM that drafts follow-ups, scores intent, and books meetings while your team focuses on closing.",
    primaryCta: "Start free trial",
    ghostCta: "Book a demo",
    badge: "SOC 2 · Type II",
    nextLabel: "Pipeline value",
    nextValue: "$1.2M · this quarter",
    features: [
      { t: "Auto-draft", d: "Replies in your voice" },
      { t: "Intent score", d: "Hot leads, first" },
      { t: "One inbox", d: "Email, LinkedIn, SMS" },
    ],
    logos: ["Stripe", "Notion", "Linear", "Vercel", "Ramp", "Loom"],
    ctaTitle: "Close more, type less.",
    ctaSub: "14-day trial · no credit card required.",
    ctaButton: "Try Northwind →",
    accent: "coral",
    layout: "dashboard",
  },
  {
    id: "field",
    brand: "Field Co.",
    domain: "fieldco.shop",
    category: "DTC · Outdoor",
    nav: ["Shop", "Field Notes", "Stockists", "Our story"],
    headline1: "Gear made for",
    headline2: "the long way home.",
    subhead:
      "Heritage canvas, lifetime guarantee, repaired for free forever. Built in Oregon, tested everywhere else.",
    primaryCta: "Shop the kit",
    ghostCta: "Our craft",
    badge: "Lifetime · guaranteed",
    nextLabel: "Ships within",
    nextValue: "24 hrs · free over $80",
    features: [
      { t: "Heritage canvas", d: "18oz waxed cotton" },
      { t: "Repaired free", d: "Forever, no questions" },
      { t: "Carbon-neutral", d: "Every order, always" },
    ],
    logos: ["GQ", "Outside", "Monocle", "Esquire", "Hypebeast", "Cool Hunting"],
    ctaTitle: "Built once. Worn for decades.",
    ctaSub: "Free returns · free repairs · always.",
    ctaButton: "Shop new arrivals →",
    accent: "gold",
    layout: "splitLeft",
  },
  {
    id: "verdant",
    brand: "Verdant",
    domain: "verdant.health",
    category: "Wellness",
    nav: ["Programs", "Coaches", "Science", "Reviews"],
    headline1: "Habits that stick,",
    headline2: "by design.",
    subhead:
      "Personalized coaching, daily check-ins, and a plan that bends to your week — not the other way around.",
    primaryCta: "Take the quiz",
    ghostCta: "How it works",
    badge: "NPS · 78",
    nextLabel: "Avg results",
    nextValue: "–9 lbs in 12 weeks",
    features: [
      { t: "1:1 coach", d: "Texts back in minutes" },
      { t: "No-diet plan", d: "Real food, real life" },
      { t: "Habit OS", d: "Tracks itself for you" },
    ],
    logos: ["NYT", "Goop", "Well+Good", "Vogue", "Self", "mindbodygreen"],
    ctaTitle: "Start with one habit.",
    ctaSub: "First week free · cancel anytime.",
    ctaButton: "Build my plan →",
    accent: "sage",
    layout: "centered",
  },
  {
    id: "nocturne",
    brand: "Nocturne",
    domain: "nocturne.fm",
    category: "Music · Nightlife",
    nav: ["Residencies", "Rooms", "Tickets", "Mixes"],
    headline1: "After-hours,",
    headline2: "engineered.",
    subhead:
      "Underground residencies, vinyl-only rooms, and a calendar curated by the artists themselves. No algorithms.",
    primaryCta: "See tonight",
    ghostCta: "Listen in",
    badge: "Live · 4 rooms",
    nextLabel: "On now",
    nextValue: "Room 2 · Floating Points",
    features: [
      { t: "Vinyl only", d: "Funktion-One, every room" },
      { t: "Artist-curated", d: "No paid placement" },
      { t: "Members first", d: "Tickets 48h early" },
    ],
    logos: ["Resident Advisor", "Mixmag", "Boiler Room", "DJ Mag", "XLR8R", "Crack"],
    ctaTitle: "The night is already moving.",
    ctaSub: "Doors open 11pm · members skip the line.",
    ctaButton: "Reserve tonight →",
    accent: "violet",
    layout: "fullBleed",
  },
  {
    id: "atlas",
    brand: "Atlas",
    domain: "atlas.bank",
    category: "Fintech",
    nav: ["Accounts", "Cards", "Treasury", "Developers"],
    headline1: "Banking for",
    headline2: "the builders.",
    subhead:
      "High-yield operating accounts, virtual cards, and treasury automation — built for founders who'd rather ship than reconcile.",
    primaryCta: "Open an account",
    ghostCta: "Talk to us",
    badge: "FDIC · $5M",
    nextLabel: "APY today",
    nextValue: "5.12% · auto-swept",
    features: [
      { t: "5.12% APY", d: "On every idle dollar" },
      { t: "Virtual cards", d: "Issue in seconds" },
      { t: "Treasury API", d: "Sweep, pay, reconcile" },
    ],
    logos: ["TechCrunch", "Fortune", "Bloomberg", "The Information", "Pitchbook", "a16z"],
    ctaTitle: "Your runway, working harder.",
    ctaSub: "Open in 8 minutes · no minimums.",
    ctaButton: "Get Atlas →",
    accent: "teal",
    layout: "dashboard",
  },
  {
    id: "ember",
    brand: "Ember",
    domain: "ember.kitchen",
    category: "Restaurant · Fine Dining",
    nav: ["Menu", "Reservations", "Cellar", "Private events"],
    headline1: "A tasting menu",
    headline2: "worth the trip.",
    subhead:
      "Twelve courses, wood-fired over Japanese binchotan, paired with low-intervention wines from a 600-bottle cellar.",
    primaryCta: "Reserve a table",
    ghostCta: "See the menu",
    badge: "★★ Michelin",
    nextLabel: "Next seating",
    nextValue: "Fri 8:15 PM · 2 seats left",
    features: [
      { t: "12 courses", d: "Wood-fired, hand-plated" },
      { t: "Wine pairing", d: "Sommelier-led journey" },
      { t: "Chef's counter", d: "Six seats, every service" },
    ],
    logos: ["NYT", "Eater", "Bon Appétit", "Food & Wine", "Michelin", "The Infatuation"],
    ctaTitle: "The fire is already lit.",
    ctaSub: "Booked 6 weeks out · join the waitlist.",
    ctaButton: "Reserve →",
    accent: "crimson",
    layout: "centered",
  },
  {
    id: "pulse",
    brand: "Pulse",
    domain: "pulse.gg",
    category: "Gaming · Esports",
    nav: ["Tournaments", "Teams", "Watch", "Pro shop"],
    headline1: "Where the next",
    headline2: "GOATs are made.",
    subhead:
      "Daily ladders, weekend majors, and the deepest stat engine in competitive play. Climb the ranks or watch them climb.",
    primaryCta: "Enter the ladder",
    ghostCta: "Watch live",
    badge: "12.4M · online",
    nextLabel: "Prize pool",
    nextValue: "$2.4M · Major IX",
    features: [
      { t: "Ranked daily", d: "Seasons reset weekly" },
      { t: "Stat engine", d: "Frame-by-frame replays" },
      { t: "Direct payouts", d: "Win at 3am, paid by 4am" },
    ],
    logos: ["ESPN", "Dexerto", "HLTV", "Liquipedia", "The Loadout", "Polygon"],
    ctaTitle: "Queue is open.",
    ctaSub: "Free to enter · top 1% gets paid.",
    ctaButton: "Drop in →",
    accent: "neon",
    layout: "splitLeft",
  },
];

type Extras = {
  eyebrow: string;
  stats: { v: string; l: string }[];
  testimonial: { quote: string; author: string; role: string };
  pricing: { name: string; price: string; per: string; blurb: string; features: string[]; cta: string; highlight?: boolean }[];
  faq: { q: string; a: string }[];
  footer: { title: string; links: string[] }[];
};

const DEFAULT_EXTRAS: Extras = {
  eyebrow: "New",
  stats: [
    { v: "98%", l: "Customer satisfaction" },
    { v: "24/7", l: "Live support" },
    { v: "10×", l: "Faster than before" },
    { v: "+42%", l: "Conversion lift" },
  ],
  testimonial: {
    quote: "It replaced three tools and a weekly meeting. We ship more in a Tuesday than we used to in a sprint.",
    author: "Alex Reyes",
    role: "Head of Growth",
  },
  pricing: [
    { name: "Starter", price: "$0", per: "/mo", blurb: "For small teams getting started.", features: ["3 seats", "Core blocks", "Community support"], cta: "Start free" },
    { name: "Growth", price: "$49", per: "/mo", blurb: "Most teams pick this.", features: ["10 seats", "Brand kit", "A/B testing", "Priority support"], cta: "Start trial", highlight: true },
    { name: "Scale", price: "Custom", per: "", blurb: "For teams shipping at scale.", features: ["Unlimited seats", "SSO + SCIM", "Dedicated CSM"], cta: "Talk to sales" },
  ],
  faq: [
    { q: "How long does setup take?", a: "Most teams are live the same afternoon — under 30 minutes from sign-up to first page." },
    { q: "Can I bring my own brand kit?", a: "Yes. Drop in tokens, fonts, and logos once — every block inherits automatically." },
    { q: "Is there a free trial?", a: "Yes, 14 days. No credit card required. Cancel any time." },
    { q: "Do you offer SSO and audit logs?", a: "On the Scale plan: SAML SSO, SCIM provisioning, and full audit trails." },
  ],
  footer: [
    { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
    { title: "Company", links: ["About", "Careers", "Press", "Contact"] },
    { title: "Resources", links: ["Docs", "Guides", "Community", "Status"] },
    { title: "Legal", links: ["Privacy", "Terms", "Security", "DPA"] },
  ],
};

const EXTRAS: Record<string, Partial<Extras>> = {
  // lpstudio: pricing / faq / footer intentionally fall through to
  // DEFAULT_EXTRAS — the defaults are already our own SaaS story.
  lpstudio: {
    eyebrow: "Pages \u00b7 Microsites \u00b7 A/B tests \u00b7 Analytics",
    stats: [
      { v: "60+", l: "Designed blocks, brand-locked" },
      { v: "1:1", l: "Microsites per target account" },
      { v: "A/B", l: "Variants with smart traffic" },
      { v: "47s", l: "Median time to first page" },
    ],
    testimonial: {
      quote: "I typed two sentences and got the page our agency quoted three weeks for. We shipped the campaign that afternoon.",
      author: "Maya Chen",
      role: "VP Marketing \u00b7 Series B SaaS",
    },
  },
  smilist: {
    eyebrow: "Now in NYC, Boston & LA",
    stats: [
      { v: "16", l: "Cities, growing" },
      { v: "4.9★", l: "12k Google reviews" },
      { v: "<24h", l: "Avg booking lead time" },
      { v: "94%", l: "Same-day availability" },
    ],
    testimonial: {
      quote: "I booked at 9am, was in the chair by 3. Cleanest office I've been in, no upsell, no surprise bill.",
      author: "Priya Shah",
      role: "Patient · Brooklyn",
    },
    pricing: [
      { name: "Cleaning", price: "$89", per: "/visit", blurb: "Exam, X-rays, polish.", features: ["30-min visit", "Same-day bookings", "All ages"], cta: "Book cleaning" },
      { name: "Membership", price: "$24", per: "/mo", blurb: "No insurance? No problem.", features: ["2 cleanings / yr", "20% off all care", "No deductibles"], cta: "Join Smilist", highlight: true },
      { name: "Cosmetic", price: "From $399", per: "", blurb: "Whitening, veneers, aligners.", features: ["Free consult", "0% financing", "Lifetime touch-ups"], cta: "Get a quote" },
    ],
    faq: [
      { q: "Do you take my insurance?", a: "We're in-network with 200+ plans. Enter your card at booking and we'll verify before you arrive." },
      { q: "What if I'm nervous?", a: "Tell us at booking — we offer nitrous, headphones, and longer appointments at no extra cost." },
      { q: "Same-day emergencies?", a: "Yes. Call any location before 4pm and we'll see you that day or the next morning." },
      { q: "Kids welcome?", a: "Absolutely. Most locations have a dedicated kids' room and pediatric-trained hygienists." },
    ],
  },
  northwind: {
    eyebrow: "Series B · backed by Sequoia",
    stats: [
      { v: "37%", l: "Avg pipeline lift" },
      { v: "2.1h", l: "Saved per rep, daily" },
      { v: "850+", l: "Teams shipping with us" },
      { v: "SOC 2", l: "Type II certified" },
    ],
    testimonial: {
      quote: "Northwind drafted 4,200 follow-ups last month. Our reps approved 91% in one click. Revenue is up and a-day-in-the-life is quieter.",
      author: "Dana Liu",
      role: "VP Sales, Helio",
    },
    pricing: [
      { name: "Team", price: "$39", per: "/seat/mo", blurb: "For founder-led teams.", features: ["5 seats min", "Auto-draft replies", "Intent scoring"], cta: "Start trial" },
      { name: "Business", price: "$89", per: "/seat/mo", blurb: "Most loved by RevOps.", features: ["Unified inbox", "Multi-channel sequences", "Salesforce sync", "Live chat support"], cta: "Start trial", highlight: true },
      { name: "Enterprise", price: "Custom", per: "", blurb: "Security and scale.", features: ["SSO + SCIM", "Custom data residency", "Dedicated AE + CSM"], cta: "Talk to sales" },
    ],
  },
  field: {
    eyebrow: "Made in Oregon since 2011",
    stats: [
      { v: "18oz", l: "Waxed canvas" },
      { v: "Free", l: "Repairs, forever" },
      { v: "100k+", l: "Bags in the wild" },
      { v: "Carbon-", l: "Neutral shipping" },
    ],
    testimonial: {
      quote: "Five years and three countries later, the bag came back from repair looking new. This is how things should be made.",
      author: "Marco S.",
      role: "Verified buyer",
    },
    pricing: [
      { name: "Field Pack", price: "$189", per: "", blurb: "Our flagship daypack.", features: ["22L volume", "Laptop sleeve", "Lifetime repairs"], cta: "Shop the pack" },
      { name: "Roll-top", price: "$229", per: "", blurb: "All-weather commuter.", features: ["28L expandable", "Roll-top closure", "Salvaged-leather trim"], cta: "Shop roll-top", highlight: true },
      { name: "Weekender", price: "$289", per: "", blurb: "3-day duffel.", features: ["48L volume", "Removable strap", "Repair-friendly seams"], cta: "Shop weekender" },
    ],
  },
  verdant: {
    eyebrow: "Backed by clinicians, not influencers",
    stats: [
      { v: "–9 lbs", l: "Avg in 12 weeks" },
      { v: "78", l: "NPS · industry-leading" },
      { v: "92%", l: "Hit their first goal" },
      { v: "1:1", l: "Real human coach" },
    ],
    testimonial: {
      quote: "First program that didn't make me hate Mondays. My coach texts me like a friend who happens to know nutrition science.",
      author: "Jamie Okafor",
      role: "Member · 8 months",
    },
  },
  nocturne: {
    eyebrow: "4 rooms · open Thu–Sun",
    stats: [
      { v: "4", l: "Rooms, one venue" },
      { v: "100%", l: "Vinyl-only sets" },
      { v: "48h", l: "Member presale" },
      { v: "Funktion-One", l: "Every floor" },
    ],
    testimonial: {
      quote: "Best sound system in the city. Zero phone-out energy, zero bottle-service nonsense. Just music.",
      author: "Ren H.",
      role: "Member since '23",
    },
  },
  atlas: {
    eyebrow: "FDIC insured up to $5M",
    stats: [
      { v: "5.12%", l: "APY, auto-swept" },
      { v: "$5M", l: "FDIC coverage" },
      { v: "8 min", l: "Avg signup" },
      { v: "0", l: "Monthly fees" },
    ],
    testimonial: {
      quote: "We moved $4M off our old bank in an afternoon. The yield alone pays for our seed round's legal bill.",
      author: "Tomás García",
      role: "CEO, Lumen Labs",
    },
  },
  ember: {
    eyebrow: "Tasting menu · seasonal",
    stats: [
      { v: "★★", l: "Michelin · 3 years" },
      { v: "12", l: "Courses per seating" },
      { v: "600", l: "Bottles in the cellar" },
      { v: "6", l: "Chef's counter seats" },
    ],
    testimonial: {
      quote: "Worth the flight. Quietly the most thoughtful tasting menu in North America right now.",
      author: "Eater · 2025 review",
      role: "Critic's pick",
    },
  },
  pulse: {
    eyebrow: "Season XI · live now",
    stats: [
      { v: "$2.4M", l: "Prize pool" },
      { v: "12.4M", l: "Players online" },
      { v: "<1ms", l: "Server tickrate" },
      { v: "4am", l: "Avg payout time" },
    ],
    testimonial: {
      quote: "Climbed from Bronze to Diamond in a season. Got my first payout the same night I qualified. This is the future.",
      author: "kxn1ght",
      role: "Diamond III · NA",
    },
  },
};

function getExtras(id: string): Extras {
  const e = EXTRAS[id] ?? {};
  return { ...DEFAULT_EXTRAS, ...e };
}

// Per-layout section order. Each block is given a flex `order` so the same
// markup can rearrange itself based on the active preset's archetype.
type SectionKey = "nav" | "hero" | "stats" | "features" | "testimonial" | "logos" | "pricing" | "faq" | "cta" | "footer";
const SECTION_ORDER: Record<HeroLayout, SectionKey[]> = {
  splitRight: ["nav", "hero", "stats", "features", "logos", "testimonial", "pricing", "faq", "cta", "footer"],
  splitLeft:  ["nav", "hero", "features", "stats", "testimonial", "logos", "pricing", "faq", "cta", "footer"],
  centered:   ["nav", "hero", "logos", "stats", "features", "testimonial", "pricing", "faq", "cta", "footer"],
  fullBleed:  ["nav", "hero", "testimonial", "features", "logos", "stats", "pricing", "faq", "cta", "footer"],
  dashboard:  ["nav", "hero", "stats", "features", "pricing", "logos", "testimonial", "faq", "cta", "footer"],
};
function orderStyle(layout: HeroLayout, key: SectionKey): CSSProperties {
  const i = SECTION_ORDER[layout].indexOf(key);
  return { order: i === -1 ? 99 : i };
}

// Scripted suggestion engine — reacts to the active layer, recent click
// history, what the user is actually typing, accent, device, and preset.
// Goal: every suggestion should quote something the user did so it
// feels like the panel is reading over their shoulder.
type Suggestion = { kind: "copy" | "layout" | "brand" | "perf" | "convert"; text: string };

const WEAK_WORDS = ["platform", "solution", "leverage", "synergy", "robust", "seamless", "innovative", "world-class", "next-gen", "cutting-edge", "stuff", "things"];
const POWER_VERBS = ["ship", "launch", "build", "close", "win", "grow", "scale", "book", "earn"];

function quote(s: string, max = 28): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > max ? `"${t.slice(0, max - 1)}…"` : `"${t}"`;
}

function getSuggestions(args: {
  layer: LayerKey;
  recent: LayerKey[];
  headline1: string;
  headline2: string;
  accent: AccentKey;
  preset: Preset;
  device: Device;
  edited: boolean;
}): Suggestion[] {
  const { layer, recent, headline1, headline2, accent, preset, device, edited } = args;
  const headline = `${headline1} ${headline2}`.trim();
  const lower = headline.toLowerCase();
  const words = headline.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const s: Suggestion[] = [];

  // ── Content-aware reads on the headline (always evaluated)
  const weakHit = WEAK_WORDS.find((w) => lower.includes(w));
  if (weakHit) s.push({ kind: "copy", text: `"${weakHit}" reads as filler — swap it for a verb a buyer would Google, like "${POWER_VERBS[wc % POWER_VERBS.length]}".` });
  if (/\bAI\b|\bai\b/.test(headline)) s.push({ kind: "copy", text: `"AI" is in your headline — back it with one concrete capability under it so it doesn't feel like a buzzword.` });
  if (/\bfree\b/i.test(headline)) s.push({ kind: "convert", text: `"Free" appears up top — pair it with a single condition ("forever, up to 5 seats") to kill the trust gap.` });
  if (/\bnew\b/i.test(headline)) s.push({ kind: "copy", text: `"New" decays fast — anchor it to a date ("New for 2026") or drop it.` });
  if (/[!?]/.test(headline)) s.push({ kind: "copy", text: `Drop the ${/!/.test(headline) ? "exclamation" : "question mark"} — declarative hero copy outperforms by ~8%.` });
  if (/[\u{1F300}-\u{1FAFF}]/u.test(headline)) s.push({ kind: "brand", text: "Emoji in the H1 reads playful — fine for DTC, risky for B2B trust signals." });
  const all = headline.replace(/[^A-Za-z]/g, "");
  if (all.length > 4 && all === all.toUpperCase()) s.push({ kind: "copy", text: "All-caps headline shouts — title case lets the accent line do the emphasis instead." });
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  if (longest > 13) s.push({ kind: "copy", text: `"${words.find((w) => w.length > 13)}" is long — line-wrap risk on mobile; consider a shorter synonym.` });

  if (wc > 0 && wc < 5) s.push({ kind: "copy", text: `${wc} words is lean — 6–9 tends to convert best for ${preset.category.toLowerCase()}.` });
  else if (wc > 11) s.push({ kind: "copy", text: `${wc} words is heavy — cut to the noun that matters (right now: ${quote(headline2)}).` });

  // Did the user actually edit headline1/headline2 away from the preset default?
  if (edited && (headline1 !== preset.headline1 || headline2 !== preset.headline2)) {
    s.push({ kind: "convert", text: `Your line ${quote(headline2 || headline1)} could echo in the CTA — try "${(headline2 || headline1).trim().replace(/[.!?]$/, "")} →".` });
  }

  // ── Layer-aware tips (the active layer always speaks first)
  const layerTips: Partial<Record<LayerKey, Suggestion[]>> = {
    headline: [{ kind: "copy", text: `Selected the headline — try front-loading the outcome: "${(headline2 || "the result").trim().replace(/[.!?]$/, "")}, ${headline1.toLowerCase().replace(/[.!?]$/, "") || preset.category.toLowerCase()}".` }],
    subhead:  [{ kind: "copy", text: "Subhead earns its keep when it adds the verb the headline left out — keep it under 18 words." }],
    visual:   [{ kind: "brand", text: `Hero visual carries ${preset.category.toLowerCase()} — a 6s product loop outperforms a static shot by ~14% on time-on-page.` }],
    nav:      [{ kind: "layout", text: `Your nav has ${4} items — every extra link past 4 drops hero CTR ~3%.` }],
    stats:    [{ kind: "copy", text: "Pair each stat with a unit and a source line — bare numbers read as decoration." }],
    features: [{ kind: "layout", text: `Features grid — lead with the one a ${preset.category.toLowerCase()} buyer asks about first, not the longest list.` }],
    testimonial: [{ kind: "copy", text: "Lead the quote with a number — outcomes-first quotes outperform feeling-first by 22%." }],
    logos:    [{ kind: "brand", text: "Mute logos to ~60% opacity — they should reinforce, not compete with, the hero." }],
    pricing:  [
      { kind: "convert", text: "Pin the middle tier as recommended — 67% default to the highlighted plan." },
      { kind: "copy", text: `Anchor annual savings — even "${preset.brand} Pro · save 2 months" lifts ARR.` },
    ],
    faq:      [{ kind: "convert", text: "Move the pricing objection to FAQ #1 — it's the most-opened question across SaaS." }],
    cta:      [{ kind: "convert", text: `Selected CTA — test "${preset.ctaButton}" against value-led "See ${preset.brand} live →".` }],
    footer:   [{ kind: "perf", text: "Footers don't need motion — drop transitions to save ~40ms on first paint." }],
    hero:     [{ kind: "layout", text: `Hero is a ${preset.layout} layout — try the ${preset.layout === "centered" ? "split" : "centered"} variant if scroll-depth drops below 60%.` }],
    page:     [{ kind: "layout", text: `${preset.brand}'s page is ${SECTION_ORDER[preset.layout].length} sections deep — collapse FAQ + Testimonial into a single proof band on mobile.` }],
  };
  (layerTips[layer] ?? []).forEach((t) => s.push(t));

  // ── Click-history awareness: notice patterns across recent clicks.
  const last3 = recent.slice(-3);
  if (last3.length >= 2) {
    if (last3.every((l) => l === "headline" || l === "subhead" || l === "hero")) {
      s.push({ kind: "copy", text: `You've been polishing the hero — once it lands, jump to ${preset.layout === "dashboard" ? "Stats" : "CTA"} next; that's where most ${preset.category.toLowerCase()} drop-off happens.` });
    } else if (last3.includes("pricing") && last3.includes("faq")) {
      s.push({ kind: "convert", text: "You're between Pricing and FAQ — strong signal to add a money-back line right under the price." });
    } else if (last3.includes("logos") && last3.includes("testimonial")) {
      s.push({ kind: "brand", text: "Trust pass: logos + testimonial in a row — interleave them as a single proof rail to halve scroll." });
    } else if (last3.includes("cta") && (last3.includes("hero") || last3.includes("headline"))) {
      s.push({ kind: "convert", text: "Hero ↔ CTA jumps suggest you're tuning conversion — mirror the headline verb inside the button label." });
    }
  }

  // ── Device-aware nudge
  if (device === "Mobile") s.push({ kind: "layout", text: `Mobile preview on — keep H1 under 32 chars (yours: ${headline1.length}) so it stays one line.` });
  else if (device === "Tablet" && preset.layout === "dashboard") s.push({ kind: "layout", text: "Tablet + dashboard layout: stack the stat grid to 2×2 below 820px or it crowds the hero." });

  // ── Brand / accent
  const accentTip: Record<AccentKey, Suggestion> = {
    neon:    { kind: "brand", text: `${ACCENTS.neon.label} pops on near-black — try a midnight hero to make it sing.` },
    crimson: { kind: "brand", text: `${ACCENTS.crimson.label} reads as urgency — pair with serif headlines for editorial gravitas.` },
    teal:    { kind: "brand", text: `${ACCENTS.teal.label} lands as trust — a thin gold rule on the CTA earns fintech polish.` },
    violet:  { kind: "brand", text: `${ACCENTS.violet.label} wants atmosphere — push hero contrast and add film grain.` },
    indigo:  { kind: "brand", text: `${ACCENTS.indigo.label} is the safe default — break it with a warm secondary on the CTA to stand out.` },
    coral:   { kind: "brand", text: `${ACCENTS.coral.label} is warm and consumer — pair with rounded type and avoid serif headlines.` },
    sage:    { kind: "brand", text: `${ACCENTS.sage.label} is calm — let it carry a single CTA, not the whole UI, or the page goes flat.` },
    gold:    { kind: "brand", text: `${ACCENTS.gold.label} is luxury — keep it to hairlines and CTAs; flood-fills cheapen it fast.` },
    ink:     { kind: "brand", text: `${ACCENTS.ink.label} is editorial — let typography do the work and skip extra accents.` },
  };
  if (accentTip[accent]) s.push(accentTip[accent]);

  // ── Preset-specific anchor
  const presetTips: Record<string, Suggestion> = {
    smilist:   { kind: "convert", text: "Local search: add a city-picker chip strip below the hero to capture geo-intent." },
    northwind: { kind: "convert", text: "B2B trust: surface SOC 2 + customer count in the hero, not just below the fold." },
    field:     { kind: "brand", text: "DTC narrative: a 90s product video loop in the hero beats a static visual." },
    verdant:   { kind: "copy", text: "Outcome-led: lead with the result ('–9 lbs in 12 weeks'), not the program." },
    nocturne:  { kind: "layout", text: "Nightlife wants atmosphere — kill the stats strip, let the hero breathe." },
    atlas:     { kind: "convert", text: "Founders skim: put APY in 72pt monospace right next to the CTA." },
    ember:     { kind: "brand", text: "Fine dining: drop the pricing block — reservations beat plans here." },
    pulse:     { kind: "convert", text: "Esports: live player count next to CTA adds urgency and proof at once." },
  };
  const tip = presetTips[preset.id];
  if (tip) s.push(tip);

  // Always include one perf nudge so the panel doesn't go empty
  s.push({ kind: "perf", text: `Lighthouse 98 · ${preset.brand} ships in 47s — keep visuals under 120kb to hold it.` });

  // De-dupe by text, cap at 4
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const sg of s) {
    if (seen.has(sg.text)) continue;
    seen.add(sg.text);
    out.push(sg);
    if (out.length >= 4) break;
  }
  return out;
}
const SUGGEST_LABEL: Record<Suggestion["kind"], string> = {
  copy: "Copy",
  layout: "Layout",
  brand: "Brand",
  perf: "Perf",
  convert: "Convert",
};


const LAYERS: { t: string; key: LayerKey; lvl: number; target: LayerKey }[] = [
  { t: "Page", key: "page", lvl: 0, target: "nav" },
  { t: "Nav", key: "nav", lvl: 1, target: "nav" },
  { t: "Hero", key: "hero", lvl: 1, target: "hero" },
  { t: "Headline", key: "headline", lvl: 2, target: "hero" },
  { t: "Subhead", key: "subhead", lvl: 2, target: "hero" },
  { t: "Visual", key: "visual", lvl: 2, target: "hero" },
  { t: "Stats", key: "stats", lvl: 1, target: "stats" },
  { t: "Features", key: "features", lvl: 1, target: "features" },
  { t: "Testimonial", key: "testimonial", lvl: 1, target: "testimonial" },
  { t: "Logos", key: "logos", lvl: 1, target: "logos" },
  { t: "Pricing", key: "pricing", lvl: 1, target: "pricing" },
  { t: "FAQ", key: "faq", lvl: 1, target: "faq" },
  { t: "CTA", key: "cta", lvl: 1, target: "cta" },
  { t: "Footer", key: "footer", lvl: 1, target: "footer" },
];

// Canvas width per device. Desktop fills the EXACT slot between the 200px +
// 240px sidebars (--studio-w is set on the stage card) with a 12px inset each
// side, so the wrapped page sits flush against the panels — no dead work-area
// gutter. Below lg the sidebars hide and the auto-switch effect flips the
// device to Tablet/Mobile anyway.
const DEVICE_WIDTH: Record<Device, string> = {
  Desktop: "calc(var(--studio-w, 100vw) - 464px)",
  Tablet: "min(780px, 86vw)",
  Mobile: "min(390px, 84vw)",
};

function useSegment(
  p: MotionValue<number>,
  start: number,
  end: number,
  reveal?: MotionValue<number>,
) {
  const opacity = useTransform(
    reveal ? [p, reveal] : [p, p],
    ([pv, rv]: number[]) => {
      const mid = start + (end - start) * 0.4;
      const local =
        pv <= start ? 0 : pv >= mid ? 1 : (pv - start) / (mid - start);
      return Math.max(local, reveal ? rv : 0);
    },
  );
  const y = useTransform(
    reveal ? [p, reveal] : [p, p],
    ([pv, rv]: number[]) => {
      const local = pv <= start ? 24 : pv >= end ? 0 : 24 * (1 - (pv - start) / (end - start));
      return reveal ? local * (1 - rv) : local;
    },
  );
  return { opacity, y };
}

export function BuildSection() {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device>("Desktop");
  const [activeLayer, setActiveLayer] = useState<LayerKey>("hero");
  const [recentLayers, setRecentLayers] = useState<LayerKey[]>(["hero"]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [canvasActive, setCanvasActive] = useState(false);

  // Auto-switch device based on viewport width until the user manually picks
  // one. Mirrors the breakpoint where the sidebars hide (lg = 1024px). At
  // narrow viewports the chrome's sidebars disappear and the canvas auto-
  // tilts toward Tablet then Mobile so the preview always feels native.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasInteracted) return;
    const pick = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("Mobile");
      else if (w < 1024) setDevice("Tablet");
      else setDevice("Desktop");
    };
    pick();
    window.addEventListener("resize", pick);
    return () => window.removeEventListener("resize", pick);
  }, [hasInteracted]);
  const [pulseTick, setPulseTick] = useState(0);

  // Release canvas scroll-capture when the user clicks outside the canvas.
  useEffect(() => {
    if (!canvasActive) return;
    const onDown = (e: PointerEvent) => {
      if (canvasRef.current && !canvasRef.current.contains(e.target as Node)) {
        setCanvasActive(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [canvasActive]);

  // Demo config state
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const extras = getExtras(presetId);
  const [accent, setAccent] = useState<AccentKey>(preset.accent);
  const [headline1, setHeadline1Raw] = useState<string>(preset.headline1);
  const [headline2, setHeadline2Raw] = useState<string>(preset.headline2);

  // ── Per-block freeform transforms (scale + translate) + edit log
  const [blockTx, setBlockTx] = useState<Record<string, BlockTx>>({});
  const [recentEdits, setRecentEdits] = useState<string[]>([]);
  const recordEdit = (s: string) => {
    setRecentEdits((r) => {
      const next = [...r, s];
      return next.length > 6 ? next.slice(next.length - 6) : next;
    });
  };
  const setBlockTransform = (key: LayerKey, next: BlockTx) => {
    setBlockTx((m) => ({ ...m, [key]: next }));
  };

  const setHeadline1 = (v: string) => {
    if (v !== headline1) recordEdit(`rewrote headline·1 to "${v.slice(0, 40)}"`);
    setHeadline1Raw(v);
  };
  const setHeadline2 = (v: string) => {
    if (v !== headline2) recordEdit(`rewrote headline·2 to "${v.slice(0, 40)}"`);
    setHeadline2Raw(v);
  };

  const onPickPreset = (id: string) => {
    const next = PRESETS.find((pr) => pr.id === id);
    if (!next) return;
    setPresetId(id);
    setAccent(next.accent);
    setHeadline1Raw(next.headline1);
    setHeadline2Raw(next.headline2);
    setRecentLayers(["hero"]);
    setBlockTx({});
    setRecentEdits([`switched preset to ${next.brand} (${next.category})`]);
  };

  const edited = headline1 !== preset.headline1 || headline2 !== preset.headline2;


  const focusKey = hasInteracted
    ? ((LAYERS.find((l) => l.key === activeLayer)?.target ?? null) as LayerKey | null)
    : null;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const p = useTransform(scrollYProgress, [0.04, 0.95], [0, 1]);

  const builderP = useTransform(p, [0.74, 0.94], [0, 1]);
  const reveal = useTransform(p, [0.66, 0.78], [0, 1]);

  const stage1 = useSegment(p, 0.02, 0.08, reveal);
  // Scrubbed headline typing (parity with the old AssembleScene): characters
  // reveal with scroll across the stage-3 window — typing forward, untyping
  // when the visitor scrolls back — then the fully-typed headline becomes
  // the inline-editable element.
  const [typedChars, setTypedChars] = useState(0);
  // The ghost cursor "clicks Publish" near the end of the pin — the toolbar
  // button flips to "Published \u2713" with a live-URL toast.
  const [published, setPublished] = useState(false);
  useMotionValueEvent(p, "change", (v) => {
    const t = Math.max(0, Math.min(1, (v - 0.14) / (0.42 - 0.14)));
    setTypedChars(Math.round(t * (headline1.length + headline2.length)));
    setPublished(v >= 0.93);
  });

  const stage2 = useSegment(p, 0.07, 0.14, reveal);
  const stage3 = useSegment(p, 0.14, 0.24, reveal);
  const stage4 = useSegment(p, 0.22, 0.32, reveal);
  const stage5 = useSegment(p, 0.3, 0.42, reveal);
  const stage6 = useSegment(p, 0.4, 0.52, reveal);
  const stage7 = useSegment(p, 0.5, 0.6, reveal);
  const stage8 = useSegment(p, 0.58, 0.68, reveal);
  const stampOpacity = useTransform(p, [0.68, 0.74, 0.82], [0, 1, 0]);
  const stampScale = useTransform(p, [0.68, 0.74], [0.7, 1]);

  const leftPanelX = useTransform(builderP, [0, 1], [-100, 0]);
  const leftPanelOpacity = useTransform(builderP, [0, 0.4, 1], [0, 1, 1]);
  const rightPanelX = useTransform(builderP, [0, 1], [100, 0]);
  const rightPanelOpacity = useTransform(builderP, [0, 0.4, 1], [0, 1, 1]);
  const toolbarY = useTransform(builderP, [0, 1], [-40, 0]);
  const toolbarOpacity = useTransform(builderP, [0, 0.4, 1], [0, 1, 1]);
  const statusY = useTransform(builderP, [0, 1], [40, 0]);
  const statusOpacity = useTransform(builderP, [0, 0.4, 1], [0, 1, 1]);

  // No end-of-wrap shrink (was 0.82): the frame is sized to the exact panel
  // slot, so any residual scale would reopen the gap between page and panels.
  const baseScale = useTransform(p, [0, 0.5], [0.96, 1]);
  const frameRotate = useTransform(p, [0, 0.74, 1], [0.4, 0, 0]);
  const frameY = useTransform(builderP, [0, 1], [0, 8]);
  const frameX = useTransform(builderP, [0, 1], [0, -20]);

  const captionIndex = useTransform(p, (v): number => {
    if (v < 0.08) return 0;
    if (v < 0.2) return 1;
    if (v < 0.36) return 2;
    if (v < 0.54) return 3;
    if (v < 0.7) return 4;
    if (v < 0.86) return 5;
    return 6;
  });

  const CAPTIONS = [
    // The first caption reads as the PROMPT that produced this page — the
    // connective tissue between the hero's prompt card and the assembly.
    { k: "Prompt", v: `\u201cA landing page for ${preset.brand}.\u201d` },
    { k: "Frame", v: "Empty canvas." },
    { k: "Compose", v: "Brand voice and layout in." },
    { k: "Populate", v: "Sections, visuals, proof." },
    { k: "Convert", v: "CTA and offer tuned." },
    { k: "Ship", v: "Live in 47 seconds." },
    { k: "Edit", v: "Open in the studio." },
  ];

  const onPickLayer = (key: LayerKey) => {
    setActiveLayer(key);
    setHasInteracted(true);
    setPulseTick((t) => t + 1);
    setRecentLayers((r) => {
      const next = [...r, key];
      return next.length > 6 ? next.slice(next.length - 6) : next;
    });
    const target = LAYERS.find((l) => l.key === key)?.target ?? key;
    const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block="${target}"]`);
    if (el && canvasRef.current && canvasActive) {
      canvasRef.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
  };

  // Accent overrides: scope --indigo + --indigo-soft on the canvas so every
  // bg-indigo / text-indigo / ring-indigo inside picks up the active accent.
  const accentStyle = {
    ["--indigo" as string]: ACCENTS[accent].color,
    ["--indigo-soft" as string]: ACCENTS[accent].soft,
  } as CSSProperties;

  return (
    <section id="build" ref={ref} className="relative bg-background">
      <div className="relative h-[650vh]">
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          {/* Stage — a CONTAINED studio card, not full bleed (July 2026,
              parity with the scroll-saga original's contained feel): the
              chrome (toolbar / panels / status bar) positions absolutely
              against THIS box, so bounding + centering it makes the builder
              wrap hug the demo page with the cream section visible around
              it. --studio-w drives the Desktop canvas width so the panels
              sit tight against the page (canvas = card − panels − gutter). */}
          <div
            className="relative mx-auto mb-5 mt-16 w-[min(1320px,calc(100vw-48px))] flex-1"
            style={{ ["--studio-w" as string]: "min(1320px, calc(100vw - 48px))" } as CSSProperties}
          >
            {/* Stage captions — the intro headline is gone (the section
                starts assembling straight off the hero), so the ticker
                floats at the stage's top-right and hands off to the studio
                toolbar as the wrap begins. */}
            <motion.div
              className="pointer-events-none absolute right-2 top-0 z-30 hidden min-w-[260px] flex-col gap-1 text-right md:flex"
              style={{ opacity: useTransform(p, [0, 0.06, 0.7, 0.78], [0, 1, 1, 0]) }}
            >
              <CaptionTicker index={captionIndex} captions={CAPTIONS} />
            </motion.div>
            <GhostCursor p={p} />
            <BuilderShell
              published={published}
              leftPanelX={leftPanelX}
              leftPanelOpacity={leftPanelOpacity}
              rightPanelX={rightPanelX}
              rightPanelOpacity={rightPanelOpacity}
              toolbarY={toolbarY}
              toolbarOpacity={toolbarOpacity}
              statusY={statusY}
              statusOpacity={statusOpacity}
              builderP={builderP}
              device={device}
              setDevice={(d) => {
                setHasInteracted(true);
                setDevice(d);
              }}
              activeLayer={activeLayer}
              onPickLayer={onPickLayer}
              accent={accent}
              setAccent={setAccent}
              headline1={headline1}
              setHeadline1={setHeadline1}
              headline2={headline2}
              setHeadline2={setHeadline2}
              preset={preset}
              presetId={presetId}
              onPickPreset={onPickPreset}
              recentLayers={recentLayers}
              recentEdits={recentEdits}
              edited={edited}
            />

            <motion.div
              style={{
                scale: baseScale,
                rotate: frameRotate,
                y: frameY,
                x: frameX,
                width: DEVICE_WIDTH[device],
              }}
              transition={{ width: { type: "spring", stiffness: 140, damping: 22 } }}
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-[48%]"
            >
              {/* Browser frame */}
              <motion.div
                style={{ ...stage1, ...accentStyle }}
                className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_60px_160px_-40px_rgba(15,23,42,0.25),0_0_0_1px_rgba(0,0,0,0.02)]"
              >
              <BlockContext.Provider value={{ txMap: blockTx, setTx: (k, n) => setBlockTransform(k as LayerKey, n), recordEdit, accentColor: ACCENTS[accent].color }}>


                {/* Chrome */}
                <div className="flex items-center gap-2 border-b border-black/[0.05] bg-[oklch(0.985_0.002_280)] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
                  <div className="mx-auto flex items-center gap-2 rounded-md bg-white/80 px-3 py-1 font-mono-display text-[10px] tracking-tight text-muted-foreground/70 ring-1 ring-black/[0.04]">
                    <span className="h-1.5 w-1.5 rounded-full bg-sage/80" />
                    {preset.domain}
                  </div>
                </div>

                {/* Canvas — scroll is locked until the user clicks inside, so
                    the outer page scroll isn't hijacked while passing over it. */}
                <div
                  ref={canvasRef}
                  onPointerDown={() => setCanvasActive(true)}
                  className={`@container relative flex h-[calc(100vh-300px)] flex-col ${canvasActive ? "overflow-y-auto" : "overflow-y-hidden"} overflow-x-hidden scroll-smooth`}
                  style={{ background: preset.pageBg ?? "#ffffff" }}
                >
                  {/* Nav */}
                  <FocusBlock blockKey="nav" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "nav")}>
                    <motion.div
                      style={stage2}
                      className="flex items-center justify-between border-b border-black/[0.04] px-5 py-3.5 @[640px]:px-8 @[640px]:py-4"
                    >
                      {preset.id === "lpstudio" ? (
                        <img src={lpLockup} alt="LP Studio" style={{ height: 16, width: "auto", display: "block" }} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-md bg-indigo" />
                          <span className="font-display text-[13px] font-semibold tracking-tight">{preset.brand}</span>
                        </div>
                      )}
                      <div className="hidden items-center gap-6 text-[11px] text-foreground/60 @[640px]:flex">
                        {preset.nav.map((n) => (
                          <span key={n}>{n}</span>
                        ))}
                      </div>
                      <div className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white">{preset.navCta ?? "Book"}</div>
                    </motion.div>
                  </FocusBlock>

                  {/* Hero — varies per preset.layout */}
                  <FocusBlock blockKey="hero" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "hero")}>
                    <HeroBody
                      layout={preset.layout}
                      preset={preset}
                      extras={extras}
                      headline1={headline1}
                      setHeadline1={setHeadline1}
                      headline2={headline2}
                      setHeadline2={setHeadline2}
                      typedChars={typedChars}
                      stage3={stage3}
                      stage4={stage4}
                      stage5={stage5}
                    />
                  </FocusBlock>

                  {/* Stats strip */}
                  <FocusBlock blockKey="stats" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "stats")}>
                    <motion.div
                      style={stage6}
                      className="mx-5 mt-12 grid grid-cols-2 border-y border-black/[0.07] @[520px]:grid-cols-4 @[640px]:mx-10"
                    >
                      {extras.stats.map((s) => (
                        <div key={s.l} className="px-3 py-6 text-center">
                          <div className="font-display text-[24px] font-[620] tracking-[-0.03em] text-[oklch(0.1_0.01_270)] @[640px]:text-[28px]">{s.v}</div>
                          <div className="mt-1 font-mono-display text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground/65">{s.l}</div>
                        </div>
                      ))}
                    </motion.div>
                  </FocusBlock>

                  {/* Feature grid */}
                  <FocusBlock blockKey="features" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "features")}>
                    <motion.div
                      style={stage6}
                      className="grid grid-cols-1 gap-4 px-5 pt-12 @[520px]:grid-cols-3 @[640px]:px-10"
                    >
                      {preset.features.map((f) => (
                        <div key={f.t} className="rounded-2xl bg-white p-5 text-left shadow-[0_1px_2px_rgba(2,6,23,0.05),0_10px_28px_-16px_rgba(2,6,23,0.12)] ring-1 ring-black/[0.06]">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo/[0.09] text-indigo">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2M7.8 16.2l-2.2 2.2" />
                            </svg>
                          </span>
                          <div className="mt-3.5 font-display text-[13.5px] font-semibold tracking-tight">{f.t}</div>
                          <div className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{f.d}</div>
                        </div>
                      ))}
                    </motion.div>
                  </FocusBlock>

                  {/* Testimonial */}
                  <FocusBlock blockKey="testimonial" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "testimonial")}>
                    <motion.div
                      style={stage7}
                      className="mx-5 mt-12 overflow-hidden rounded-3xl bg-[oklch(0.13_0.012_270)] p-7 text-white @[640px]:mx-10 @[640px]:p-9"
                    >
                      <div className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-white/50">★★★★★ · Verified</div>
                      <blockquote className="mt-3 font-display text-[15px] font-[500] leading-snug tracking-[-0.015em] text-balance text-white/95 @[640px]:text-[18px]">
                        "{extras.testimonial.quote}"
                      </blockquote>
                      <div className="mt-4 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo to-indigo-soft ring-1 ring-white/10" />
                        <div className="text-[11px] leading-tight">
                          <div className="font-semibold text-white">{extras.testimonial.author}</div>
                          <div className="text-white/50">{extras.testimonial.role}</div>
                        </div>
                      </div>
                    </motion.div>
                  </FocusBlock>

                  {/* Logos */}
                  <FocusBlock blockKey="logos" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "logos")}>
                    <motion.div
                      style={stage7}
                      className="mt-10 px-5 @[640px]:px-10"
                    >
                      <div className="text-center font-mono-display text-[8.5px] uppercase tracking-[0.24em] text-muted-foreground/55">
                        Trusted by teams at
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
                        {preset.logos.map((l) => (
                          <span key={l} className="font-display text-[12px] font-semibold tracking-tight text-foreground/35">
                            {l}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  </FocusBlock>

                  {/* Pricing */}
                  <FocusBlock blockKey="pricing" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "pricing")}>
                    <motion.div
                      style={stage8}
                      className="px-5 pt-14 @[640px]:px-10"
                    >
                      <div className="text-center">
                        <div className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">Pricing</div>
                        <h4 className="mt-1 font-display text-[20px] font-[560] tracking-[-0.03em] @[640px]:text-[26px]">Simple, transparent plans.</h4>
                      </div>
                      <div className="mt-5 grid grid-cols-1 gap-3 @[520px]:grid-cols-3">
                        {extras.pricing.map((t) => (
                          <div
                            key={t.name}
                            className={`relative rounded-2xl p-4 ring-1 transition ${
                              t.highlight
                                ? "bg-white ring-indigo shadow-[0_20px_50px_-20px_var(--indigo,oklch(0.55_0.24_275))]"
                                : "bg-[oklch(0.985_0.002_280)] ring-black/[0.05]"
                            }`}
                          >
                            {t.highlight && (
                              <span className="absolute -top-2 left-4 rounded-full bg-indigo px-2 py-0.5 font-mono-display text-[9px] uppercase tracking-wider text-white">
                                Popular
                              </span>
                            )}
                            <div className="font-display text-[12px] font-semibold tracking-tight text-foreground/70">{t.name}</div>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="font-display text-[22px] font-[600] tracking-[-0.02em]">{t.price}</span>
                              <span className="text-[11px] text-muted-foreground">{t.per}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{t.blurb}</p>
                            <ul className="mt-3 space-y-1.5">
                              {t.features.map((f) => (
                                <li key={f} className="flex items-start gap-1.5 text-[11px] text-foreground/75">
                                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                            <div
                              className={`mt-4 w-full rounded-full px-3 py-1.5 text-center text-[11px] font-medium ${
                                t.highlight ? "bg-indigo text-white" : "border border-black/10 text-foreground/80"
                              }`}
                            >
                              {t.cta}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </FocusBlock>

                  {/* FAQ */}
                  <FocusBlock blockKey="faq" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "faq")}>
                    <motion.div style={stage8} className="px-5 pt-14 @[640px]:px-10">
                      <div className="grid gap-6 @[640px]:grid-cols-12">
                        <div className="@[640px]:col-span-4">
                          <div className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">FAQ</div>
                          <h4 className="mt-1 font-display text-[20px] font-[560] tracking-[-0.03em] @[640px]:text-[24px]">
                            Questions, answered.
                          </h4>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Still curious? <span className="text-indigo">Talk to the team →</span>
                          </p>
                        </div>
                        <div className="@[640px]:col-span-8">
                          <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.06] bg-white">
                            {extras.faq.map((f) => (
                              <details key={f.q} className="group p-4 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex cursor-pointer items-center justify-between gap-3 font-display text-[12px] font-semibold tracking-tight text-foreground/90">
                                  {f.q}
                                  <span className="text-indigo transition group-open:rotate-45">+</span>
                                </summary>
                                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{f.a}</p>
                              </details>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </FocusBlock>

                  {/* CTA bar */}
                  <FocusBlock blockKey="cta" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "cta")}>
                    <motion.div
                      style={stage8}
                      className="mx-5 mt-14 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo to-[color-mix(in_oklab,var(--indigo,#3C38B8)_70%,black)] p-7 text-white @[640px]:mx-10 @[640px]:p-9"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="font-display text-[20px] font-[600] tracking-[-0.025em] @[640px]:text-[26px]">{preset.ctaTitle}</div>
                          <div className="mt-1 text-[12px] text-white/70">{preset.ctaSub}</div>
                        </div>
                        <span className="rounded-full bg-white px-5 py-2 text-[12px] font-medium text-[oklch(0.13_0.012_270)]">{preset.ctaButton}</span>
                      </div>
                    </motion.div>
                  </FocusBlock>

                  {/* Footer */}
                  <FocusBlock blockKey="footer" focusKey={focusKey} pulseTick={pulseTick} style={orderStyle(preset.layout, "footer")}>
                    <motion.div
                      style={stage8}
                      className="mt-12 border-t border-black/[0.06] bg-[oklch(0.985_0.002_280)] px-5 py-8 @[640px]:px-10"
                    >
                      <div className="grid grid-cols-2 gap-6 @[520px]:grid-cols-5">
                        <div className="col-span-2 @[520px]:col-span-1">
                          {preset.id === "lpstudio" ? (
                            <img src={lpLockup} alt="LP Studio" style={{ height: 13, width: "auto", display: "block" }} />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="h-4 w-4 rounded bg-indigo" />
                              <span className="font-display text-[12px] font-semibold tracking-tight">{preset.brand}</span>
                            </div>
                          )}
                          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">© 2026 {preset.brand}. All rights reserved.</p>
                        </div>
                        {extras.footer.map((col) => (
                          <div key={col.title}>
                            <div className="font-mono-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">{col.title}</div>
                            <ul className="mt-2 space-y-1.5 text-[11px] text-foreground/70">
                              {col.links.map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-4 text-[10px] text-muted-foreground">
                        <span>{preset.domain}</span>
                        <span className="flex items-center gap-3">
                          <span>Privacy</span>
                          <span>Terms</span>
                          <span>Cookies</span>
                        </span>
                      </div>
                    </motion.div>
                  </FocusBlock>
                </div>
              </BlockContext.Provider>
              </motion.div>


              {/* Shipped stamp */}
              <motion.div
                style={{ opacity: stampOpacity, scale: stampScale }}
                className="pointer-events-none absolute -right-4 -top-4 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-medium text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                Shipped · 47s
              </motion.div>

            </motion.div>

            {/* Progress rail */}
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
              <ProgressRail p={p} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


// ── Ghost cursor ─────────────────────────────────────────────────────────────
// Ported from AssembleSceneV2, re-choreographed July 2026: the pointer enters
// FIRST and focus-clicks the headline (like placing a text cursor) — THEN the
// headline types under it. After the hero settles it clicks the primary CTA,
// then rides up into the studio chrome and clicks Publish (the toolbar flips
// to "Published \u2713" on the same beat). Targets are MEASURED from the live
// DOM each frame via [data-cursor] anchors — never guessed percentages — so
// clicks land exactly on the elements at any width, canvas scroll, or frame
// transform. Isolated component: per-frame updates re-render only itself.

const CURSOR_STOPS: { at: number; target: string }[] = [
  { at: 0.055, target: "headline" }, // fade in, gliding toward the headline
  { at: 0.115, target: "headline" }, // arrive -> focus click, typing begins
  { at: 0.46, target: "headline" },  // parked while the headline types out
  { at: 0.56, target: "cta" },       // glide to the primary CTA
  { at: 0.63, target: "cta" },       // dwell through the click
  { at: 0.9, target: "publish" },    // up into the chrome
  { at: 0.985, target: "publish" },
];
/** [start, end] click-pulse windows: headline focus, CTA, Publish. */
const CURSOR_CLICKS: [number, number][] = [
  [0.118, 0.155],
  [0.575, 0.625],
  [0.9, 0.95],
];

function GhostCursor({ p }: { p: MotionValue<number> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ x: 0.5, y: 0.4, visible: 0, clicking: 0 });

  // One extra re-measure a couple of frames after each scroll event: a jump
  // scroll (anchor link, programmatic) fires a single event while transforms
  // are still settling, which would freeze the cursor mid-glide. Continuous
  // scrolling re-measures every event anyway.
  const settleRaf = useRef(0);
  const compute = (v: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const visible =
      v < 0.05 || v > 0.985 ? 0 : Math.min(1, (v - 0.05) / 0.03, (0.985 - v) / 0.03);
    if (visible === 0) {
      setSt((s0) => (s0.visible === 0 ? s0 : { ...s0, visible: 0 }));
      return;
    }
    const stage = wrap.getBoundingClientRect();
    // Anchor centers as stage fractions, measured live (tracks canvas scroll
    // and every frame transform). Missing anchors (other preset layouts)
    // resolve to null and the cursor holds its previous position.
    const anchorPos = (name: string): { x: number; y: number } | null => {
      const el = wrap.parentElement?.querySelector<HTMLElement>(`[data-cursor="${name}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return {
        x: (r.left + r.width / 2 - stage.left) / stage.width,
        y: (r.top + r.height / 2 - stage.top) / stage.height,
      };
    };

    let x = st.x;
    let y = st.y;
    for (let i = 0; i < CURSOR_STOPS.length - 1; i++) {
      const a = CURSOR_STOPS[i];
      const b = CURSOR_STOPS[i + 1];
      if (v >= a.at && v <= b.at) {
        const pa = anchorPos(a.target);
        const pb = anchorPos(b.target);
        if (pa && pb) {
          const t = (v - a.at) / (b.at - a.at);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          x = pa.x + (pb.x - pa.x) * e;
          y = pa.y + (pb.y - pa.y) * e;
        } else if (pb) {
          x = pb.x;
          y = pb.y;
        }
        break;
      }
      if (v > b.at) {
        const pb = anchorPos(b.target);
        if (pb) {
          x = pb.x;
          y = pb.y;
        }
      }
    }
    let clicking = 0;
    for (const [cs, ce] of CURSOR_CLICKS) {
      if (v >= cs && v <= ce) clicking = (v - cs) / (ce - cs);
    }
    setSt({ x, y: Math.max(0.005, y), visible, clicking });
  };
  useMotionValueEvent(p, "change", (v) => {
    compute(v);
    cancelAnimationFrame(settleRaf.current);
    settleRaf.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => compute(p.get())),
    );
  });

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-40" aria-hidden>
      {st.visible > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${st.x * 100}%`,
            top: `${st.y * 100}%`,
            opacity: st.visible,
          }}
        >
          {st.clicking > 0 && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 6,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "rgba(75,71,229,0.18)",
                  transform: `translate(-50%, -50%) scale(${0.6 + st.clicking * 1.8})`,
                  opacity: (1 - st.clicking) * 0.9,
                  filter: "blur(2px)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  border: "2px solid var(--indigo, #3C38B8)",
                  transform: `translate(-50%, -50%) scale(${1 + st.clicking * 4})`,
                  opacity: 1 - st.clicking,
                }}
              />
            </>
          )}
          <svg width="22" height="24" viewBox="0 0 20 22" fill="none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
            <path
              d="M2 2 L2 16 L6 12.5 L8.5 18.5 L11 17.5 L8.5 11.5 L14 11 Z"
              fill="#25214D"
              stroke="#FFFFFF"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function BuilderShell({
  published,
  leftPanelX,
  leftPanelOpacity,
  rightPanelX,
  rightPanelOpacity,
  toolbarY,
  toolbarOpacity,
  statusY,
  statusOpacity,
  builderP,
  device,
  setDevice,
  activeLayer,
  onPickLayer,
  accent,
  setAccent,
  headline1,
  setHeadline1,
  headline2,
  setHeadline2,
  preset,
  presetId,
  onPickPreset,
  recentLayers,
  recentEdits,
  edited,
}: {
  leftPanelX: MotionValue<number>;
  leftPanelOpacity: MotionValue<number>;
  rightPanelX: MotionValue<number>;
  rightPanelOpacity: MotionValue<number>;
  toolbarY: MotionValue<number>;
  toolbarOpacity: MotionValue<number>;
  statusY: MotionValue<number>;
  statusOpacity: MotionValue<number>;
  builderP: MotionValue<number>;
  device: Device;
  setDevice: (d: Device) => void;
  activeLayer: LayerKey;
  onPickLayer: (k: LayerKey) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  headline1: string;
  setHeadline1: (v: string) => void;
  headline2: string;
  setHeadline2: (v: string) => void;
  preset: Preset;
  presetId: string;
  onPickPreset: (id: string) => void;
  recentLayers: LayerKey[];
  recentEdits: string[];
  edited: boolean;
  /** Scroll-driven publish moment — flips the toolbar button + toast. */
  published: boolean;
}) {

  const bgOpacity = useTransform(builderP, [0, 0.5, 1], [0, 0.5, 1]);
  const pointerEvents = useTransform(builderP, (v) => (v > 0.6 ? "auto" : "none"));

  // ── AI suggestions. Falls back to the local heuristic until we ship a
  //    public AI Suggest endpoint. Flip USE_LIVE_AI = true once
  //    POST /api/public/ai-suggest exists returning { suggestions: AISuggestion[] }.
  const USE_LIVE_AI = false;
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  useEffect(() => {
    if (!USE_LIVE_AI) {
      setAiSuggestions(null);
      return;
    }
    let cancelled = false;
    setAiLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/public/ai-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layer: activeLayer,
            recent: recentLayers.slice(-5),
            recentEdits: recentEdits.slice(-5),
            headline1,
            headline2,
            subhead: preset.subhead,
            accent,
            device,
            presetBrand: preset.brand,
            presetCategory: preset.category,
            presetLayout: preset.layout,
            edited,
          }),
        });
        if (!res.ok) throw new Error(`AI suggest failed: ${res.status}`);
        const data = (await res.json()) as { suggestions: AISuggestion[] };
        if (!cancelled) setAiSuggestions(data.suggestions);
      } catch {
        if (!cancelled) setAiSuggestions(null);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeLayer, recentLayers, recentEdits, headline1, headline2, accent, device, preset.id, preset.brand, preset.category, preset.layout, preset.subhead, edited]);


  const scriptedSuggestions = getSuggestions({ layer: activeLayer, recent: recentLayers, headline1, headline2, accent, preset, device, edited });
  const displayedSuggestions: Suggestion[] = (aiSuggestions ?? scriptedSuggestions) as Suggestion[];


  return (
    <>
      {/* Studio backdrop tint */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 rounded-3xl bg-[oklch(0.97_0.004_280)] ring-1 ring-black/[0.07] shadow-[0_48px_140px_-48px_rgba(15,23,42,0.28)]"
      />

      {/* Top toolbar */}
      <motion.div
        style={{ y: toolbarY, opacity: toolbarOpacity, pointerEvents }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between rounded-t-3xl border-b border-black/[0.06] bg-white/80 px-5 py-2.5 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <img src={lpLockup} alt="LP Studio" style={{ height: 15, width: "auto", display: "block" }} />
          <span className="hidden h-3 w-px bg-black/10 sm:block" />
          <div className="hidden max-w-[44vw] items-center gap-0.5 overflow-x-auto sm:flex">
            {PRESETS.map((pr) => {
              const active = pr.id === presetId;
              return (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => onPickPreset(pr.id)}
                  className={`shrink-0 cursor-pointer rounded-md px-2 py-1 font-mono-display text-[10px] tracking-tight transition-colors ${
                    active ? "bg-ink text-white" : "text-muted-foreground hover:bg-black/[0.04]"
                  }`}
                  title={pr.category}
                >
                  {pr.brand}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(["Desktop", "Tablet", "Mobile"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`cursor-pointer rounded-md px-2 py-1 font-mono-display text-[10px] tracking-tight transition-colors ${
                device === d ? "bg-ink text-white" : "text-muted-foreground hover:bg-black/[0.04]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-md border border-black/[0.08] px-2.5 py-1 font-mono-display text-[10px] text-foreground/70 sm:inline">Preview</span>
          <span
            data-cursor="publish"
            className="relative rounded-md px-3 py-1 font-display text-[11px] font-medium text-white transition-colors duration-300"
            style={{ backgroundColor: published ? "oklch(0.62 0.11 155)" : ACCENTS[accent].color }}
          >
            {published ? "Published \u2713" : "Publish"}
            {published && (
              <span className="absolute right-0 top-[130%] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 font-mono-display text-[9px] tracking-tight text-white shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]">
                Live · {preset.domain}/skip-the-brief
              </span>
            )}
          </span>
        </div>
      </motion.div>

      {/* Left panel — layers */}
      <motion.div
        style={{ x: leftPanelX, opacity: leftPanelOpacity, pointerEvents }}
        className="absolute bottom-10 left-0 top-12 z-20 hidden w-[200px] border-r border-black/[0.06] bg-white/80 backdrop-blur-xl lg:block"
      >
        <div className="border-b border-black/[0.05] px-4 py-2.5 font-mono-display text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Layers
        </div>
        <div className="space-y-0.5 p-2 text-[11px] text-foreground/70">
          {LAYERS.map((l) => {
            const active = l.key === activeLayer;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => onPickLayer(l.key)}
                style={{ paddingLeft: 8 + l.lvl * 12 }}
                className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left transition-colors ${
                  active ? "text-foreground" : "hover:bg-black/[0.03]"
                }`}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: active ? ACCENTS[accent].color : "oklch(0.13 0.012 270 / 0.3)" }}
                />
                <span
                  className="tracking-tight"
                  style={active ? { color: ACCENTS[accent].color } : undefined}
                >
                  {l.t}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Right panel — inspector */}
      <motion.div
        style={{ x: rightPanelX, opacity: rightPanelOpacity, pointerEvents }}
        className="absolute bottom-10 right-0 top-12 z-20 hidden w-[240px] border-l border-black/[0.06] bg-white/80 backdrop-blur-xl lg:block"
      >
        <div className="border-b border-black/[0.05] px-4 py-2.5 font-mono-display text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Inspector — {LAYERS.find((l) => l.key === activeLayer)?.t ?? "Hero"}
        </div>
        <div className="space-y-4 p-4 text-[11px]">
          <div>
            <div className="font-mono-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">Headline · line 1</div>
            <input
              value={headline1}
              onChange={(e) => setHeadline1(e.target.value)}
              onFocus={() => onPickLayer("headline")}
              className="mt-1.5 w-full rounded-md border border-black/[0.08] bg-white px-2 py-1.5 text-[11px] text-foreground/90 tracking-tight outline-none transition focus:border-[var(--accent-c)] focus:ring-2 focus:ring-[var(--accent-c)]/20"
              style={{ ["--accent-c" as string]: ACCENTS[accent].color } as CSSProperties}
              spellCheck={false}
            />
          </div>
          <div>
            <div className="font-mono-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">Headline · accent line</div>
            <input
              value={headline2}
              onChange={(e) => setHeadline2(e.target.value)}
              onFocus={() => onPickLayer("headline")}
              className="mt-1.5 w-full rounded-md border border-black/[0.08] bg-white px-2 py-1.5 text-[11px] tracking-tight outline-none transition focus:ring-2"
              style={{
                color: ACCENTS[accent].color,
                ["--accent-c" as string]: ACCENTS[accent].color,
              } as CSSProperties}
              spellCheck={false}
            />
          </div>
          <div>
            <div className="font-mono-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">Accent</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
                const active = k === accent;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAccent(k)}
                    title={ACCENTS[k].label}
                    className={`h-5 w-5 cursor-pointer rounded-md transition ${active ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100"}`}
                    style={{
                      backgroundColor: ACCENTS[k].color,
                      boxShadow: active ? `0 0 0 2px white, 0 0 0 4px ${ACCENTS[k].color}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div>
            <div className="font-mono-display text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">Preset</div>
            <div className="mt-1.5 text-[11px] tracking-tight text-foreground/80">
              {preset.brand}
              <span className="ml-1 text-muted-foreground/70">· {preset.category}</span>
            </div>
          </div>
          <div
            className="rounded-lg border p-2.5"
            style={{
              borderColor: `color-mix(in oklab, ${ACCENTS[accent].color} 22%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${ACCENTS[accent].color} 5%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono-display text-[9px] uppercase tracking-[0.18em]" style={{ color: ACCENTS[accent].color }}>
                <span>✦ AI suggest</span>
                {aiLoading && (
                  <span className="flex items-center gap-[3px]" aria-label="thinking">
                    <span
                      className="h-[3px] w-[3px] rounded-full"
                      style={{ backgroundColor: ACCENTS[accent].color, animation: "ai-dot 1.2s ease-in-out infinite", animationDelay: "0ms" }}
                    />
                    <span
                      className="h-[3px] w-[3px] rounded-full"
                      style={{ backgroundColor: ACCENTS[accent].color, animation: "ai-dot 1.2s ease-in-out infinite", animationDelay: "180ms" }}
                    />
                    <span
                      className="h-[3px] w-[3px] rounded-full"
                      style={{ backgroundColor: ACCENTS[accent].color, animation: "ai-dot 1.2s ease-in-out infinite", animationDelay: "360ms" }}
                    />
                  </span>
                )}
              </div>
              <span className="font-mono-display text-[9px] uppercase tracking-wider text-muted-foreground/60">
                {aiLoading ? "thinking…" : aiSuggestions ? "live · gemini" : `live · ${LAYERS.find((l) => l.key === activeLayer)?.t ?? "Hero"}`}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {aiLoading && !aiSuggestions
                ? Array.from({ length: 3 }).map((_, i) => (
                    <li
                      key={`skel-${i}`}
                      className="flex items-center gap-1.5 rounded-md bg-white/60 p-1.5 ring-1 ring-black/[0.04]"
                    >
                      <span
                        className="h-3 w-10 shrink-0 rounded-sm opacity-60"
                        style={{ backgroundColor: `color-mix(in oklab, ${ACCENTS[accent].color} 14%, transparent)` }}
                      />
                      <span className="flex items-center gap-[3px]" aria-hidden>
                        <span className="h-[4px] w-[4px] rounded-full bg-foreground/40" style={{ animation: "ai-dot 1.2s ease-in-out infinite", animationDelay: `${i * 120}ms` }} />
                        <span className="h-[4px] w-[4px] rounded-full bg-foreground/40" style={{ animation: "ai-dot 1.2s ease-in-out infinite", animationDelay: `${i * 120 + 180}ms` }} />
                        <span className="h-[4px] w-[4px] rounded-full bg-foreground/40" style={{ animation: "ai-dot 1.2s ease-in-out infinite", animationDelay: `${i * 120 + 360}ms` }} />
                      </span>
                    </li>
                  ))
                : displayedSuggestions.map((sg, i) => (
                    <li
                      key={`${sg.kind}-${i}-${sg.text.slice(0, 12)}`}
                      className="flex items-start gap-1.5 rounded-md bg-white/60 p-1.5 text-[10.5px] leading-snug text-foreground/80 ring-1 ring-black/[0.04] animate-fade-in"
                    >
                      <span
                        className="mt-[1px] shrink-0 rounded-sm px-1 py-px font-mono-display text-[8.5px] uppercase tracking-wider"
                        style={{
                          color: ACCENTS[accent].color,
                          backgroundColor: `color-mix(in oklab, ${ACCENTS[accent].color} 12%, transparent)`,
                        }}
                      >
                        {SUGGEST_LABEL[sg.kind]}
                      </span>
                      <span>{sg.text}</span>
                    </li>
                  ))}
            </ul>

          </div>
        </div>
      </motion.div>

      {/* Bottom status bar */}
      <motion.div
        style={{ y: statusY, opacity: statusOpacity, pointerEvents }}
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between rounded-b-3xl border-t border-black/[0.06] bg-white/80 px-5 py-2 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 font-mono-display text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Live · synced
          </span>
          <span className="hidden sm:inline">4 collaborators</span>
          <span className="hidden sm:inline">v 1.0.3</span>
          <span className="font-mono-display text-[10px] uppercase tracking-wider text-foreground/50">{device}</span>
        </div>
        <div className="flex items-center gap-3 font-mono-display text-[10px] text-muted-foreground">
          <span className="hidden sm:inline">Lighthouse 98</span>
          <span className="hidden sm:inline">CLS 0.01</span>
          <span style={{ color: ACCENTS[accent].color }}>⌘K</span>
        </div>
      </motion.div>
    </>
  );
}

function FocusBlock({
  blockKey,
  label,
  focusKey,
  pulseTick,
  style,
  children,
}: {
  blockKey: LayerKey;
  label?: string;
  focusKey: LayerKey | null;
  pulseTick: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const active = blockKey === focusKey;
  const displayLabel = label ?? blockKey;
  const ctx = useContext(BlockContext);
  const tx: BlockTx = ctx?.txMap[blockKey] ?? { scale: 1, dx: 0, dy: 0 };

  // Drag refs for move + resize
  const dragState = useRef<{
    mode: "move" | "resize" | null;
    startX: number;
    startY: number;
    start: BlockTx;
  }>({ mode: null, startX: 0, startY: 0, start: { scale: 1, dx: 0, dy: 0 } });

  const beginDrag = (mode: "move" | "resize") => (e: ReactPointerEvent) => {
    if (!ctx) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...tx } };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = dragState.current;
    if (!s.mode || !ctx) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.mode === "move") {
      const nx = Math.max(-160, Math.min(160, s.start.dx + dx));
      const ny = Math.max(-240, Math.min(240, s.start.dy + dy));
      ctx.setTx(blockKey, { ...s.start, dx: nx, dy: ny });
    } else {
      const delta = (dx + dy) / 240; // diagonal feel
      const ns = Math.max(0.6, Math.min(1.4, s.start.scale + delta));
      ctx.setTx(blockKey, { ...s.start, scale: ns });
    }
  };
  const endDrag = (e: ReactPointerEvent) => {
    const s = dragState.current;
    if (!s.mode || !ctx) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const final = ctx.txMap[blockKey] ?? { scale: 1, dx: 0, dy: 0 };
    const changed = final.scale !== s.start.scale || final.dx !== s.start.dx || final.dy !== s.start.dy;
    if (changed) {
      if (s.mode === "move") {
        ctx.recordEdit(`moved ${String(blockKey)} block by ${Math.round(final.dx - s.start.dx)}px·x, ${Math.round(final.dy - s.start.dy)}px·y`);
      } else {
        ctx.recordEdit(`resized ${String(blockKey)} block to ${Math.round(final.scale * 100)}%`);
      }
    }
    dragState.current = { mode: null, startX: 0, startY: 0, start: { scale: 1, dx: 0, dy: 0 } };
  };

  const transformed = tx.scale !== 1 || tx.dx !== 0 || tx.dy !== 0;

  return (
    <motion.div
      data-block={blockKey}
      style={{
        ...style,
        transform: transformed ? `translate(${tx.dx}px, ${tx.dy}px) scale(${tx.scale})` : undefined,
        transformOrigin: "top center",
        transition: dragState.current.mode ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      animate={
        active
          ? {
              boxShadow:
                "0 0 0 2px var(--indigo), 0 22px 60px -28px color-mix(in oklab, var(--indigo) 45%, transparent)",
              backgroundColor: "color-mix(in oklab, var(--indigo) 4%, transparent)",
            }
          : {
              boxShadow: "0 0 0 0px transparent",
              backgroundColor: "transparent",
            }
      }
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="relative scroll-mt-3 rounded-2xl"
    >
      {active && (
        <>
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute -top-[18px] left-0 z-30 rounded-md px-1.5 py-0.5 font-mono-display text-[9px] font-medium uppercase tracking-wider text-white"
            style={{ backgroundColor: "var(--indigo)" }}
          >
            {displayLabel}
            {transformed && (
              <span className="ml-1.5 opacity-70">
                {tx.scale !== 1 && `· ${Math.round(tx.scale * 100)}%`}
                {(tx.dx !== 0 || tx.dy !== 0) && ` · ${Math.round(tx.dx)},${Math.round(tx.dy)}`}
              </span>
            )}
          </motion.span>

          {/* Move handle — top center */}
          <span
            role="button"
            aria-label="Drag to move block"
            title="Drag to move"
            onPointerDown={beginDrag("move")}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={(e) => {
              e.stopPropagation();
              ctx?.setTx(blockKey, { scale: 1, dx: 0, dy: 0 });
              ctx?.recordEdit(`reset ${String(blockKey)} block transform`);
            }}
            className="absolute -top-[10px] left-1/2 z-30 flex h-5 w-9 -translate-x-1/2 cursor-grab items-center justify-center rounded-full text-white shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)] active:cursor-grabbing"
            style={{ backgroundColor: "var(--indigo)", touchAction: "none" }}
          >
            <span className="h-[3px] w-[3px] rounded-full bg-white/90" />
            <span className="mx-[3px] h-[3px] w-[3px] rounded-full bg-white/90" />
            <span className="h-[3px] w-[3px] rounded-full bg-white/90" />
          </span>

          {/* Resize handles — four corners */}
          {(
            ["tl", "tr", "bl", "br"] as const
          ).map((corner) => (
            <span
              key={corner}
              role="button"
              aria-label={`Resize ${corner}`}
              onPointerDown={beginDrag("resize")}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={`absolute z-30 h-2.5 w-2.5 rounded-sm border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] ${
                corner === "tl" ? "-top-[5px] -left-[5px] cursor-nwse-resize" :
                corner === "tr" ? "-top-[5px] -right-[5px] cursor-nesw-resize" :
                corner === "bl" ? "-bottom-[5px] -left-[5px] cursor-nesw-resize" :
                                  "-bottom-[5px] -right-[5px] cursor-nwse-resize"
              }`}
              style={{ borderColor: "var(--indigo)", touchAction: "none" }}
            />
          ))}

          <motion.span
            key={pulseTick}
            initial={{ opacity: 0.4, scale: 1 }}
            animate={{ opacity: 0, scale: 1.015 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ boxShadow: "0 0 0 2px var(--indigo)" }}
          />
        </>
      )}
      {children}
    </motion.div>
  );
}





function CaptionTicker({
  index,
  captions,
}: {
  index: MotionValue<number>;
  captions: { k: string; v: string }[];
}) {
  return (
    <div className="relative h-[44px] overflow-hidden">
      <motion.div
        style={{ y: useTransform(index, (i) => `-${i * 44}px`) }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      >
        {captions.map((c) => (
          <div key={c.k} className="flex h-[44px] flex-col justify-center">
            <span className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
              {c.k}
            </span>
            <span className="font-display text-[15px] font-medium tracking-tight text-foreground">{c.v}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ProgressRail({ p }: { p: MotionValue<number> }) {
  const w = useTransform(p, [0, 1], ["0%", "100%"]);
  return (
    <div className="flex w-[280px] items-center gap-3">
      <span className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">build</span>
      <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <motion.div style={{ width: w }} className="h-full bg-ink" />
      </div>
      <motion.span
        style={{ opacity: useTransform(p, [0, 0.05, 1], [0.4, 1, 1]) }}
        className="font-mono-display text-[10px] tracking-tight text-foreground/60"
      >
        47s
      </motion.span>
    </div>
  );
}

// Editable — click any bound headline to edit it directly in the preview.
// Uses contentEditable so wrapping/styling stays identical to static text.
function Editable({
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerText !== value) el.innerText = value;
  }, [value]);
  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => {
        const next = e.currentTarget.innerText.replace(/\s+/g, " ").trim();
        if (next !== value) onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLSpanElement).blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.innerText = value;
          (e.currentTarget as HTMLSpanElement).blur();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`cursor-text rounded-[3px] outline-none transition-colors hover:bg-indigo/[0.06] focus:bg-indigo/[0.08] focus:ring-2 focus:ring-indigo/40 ${className}`}
    />
  );
}

// HeroBody renders one of five distinct hero archetypes. Same data, very
// different composition — so switching presets feels like switching pages,
// not just swapping copy.
function HeroBody({
  layout,
  preset,
  extras,
  headline1,
  setHeadline1,
  headline2,
  setHeadline2,
  typedChars,
  stage3,
  stage4,
  stage5,
}: {
  layout: HeroLayout;
  preset: Preset;
  extras: Extras;
  headline1: string;
  setHeadline1: (v: string) => void;
  headline2: string;
  setHeadline2: (v: string) => void;
  /** Scroll-scrubbed character count for the typing reveal; >= total = done. */
  typedChars: number;
  stage3: { opacity: MotionValue<number>; y: MotionValue<number> };
  stage4: { opacity: MotionValue<number>; y: MotionValue<number> };
  stage5: { opacity: MotionValue<number>; y: MotionValue<number> };
}) {

  const Eyebrow = (
    <motion.div
      style={stage3}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 font-mono-display text-[9px] uppercase tracking-[0.18em] text-foreground/60"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-indigo" />
      {extras.eyebrow}
    </motion.div>
  );
  const typingDone = typedChars >= headline1.length + headline2.length;
  const h1Typed = headline1.slice(0, Math.min(typedChars, headline1.length));
  const h2Typed = headline2.slice(0, Math.max(0, typedChars - headline1.length));
  const Caret = (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.85, repeat: Infinity }}
      className="ml-1 inline-block h-[0.72em] w-[3px] translate-y-[0.08em] rounded-sm bg-indigo"
      aria-hidden
    />
  );
  const Headline = (
    <motion.h3
      style={stage3}
      data-cursor="headline"
      className="font-display text-[28px] font-[600] leading-[0.98] tracking-[-0.04em] text-[oklch(0.1_0.01_270)] @[520px]:text-[38px] @[700px]:text-[52px]"
    >
      {typingDone ? (
        <>
          <Editable value={headline1} onChange={setHeadline1} ariaLabel="Edit headline line 1" />
          <br />
          <Editable value={headline2} onChange={setHeadline2} ariaLabel="Edit headline line 2" className="text-indigo" />
        </>
      ) : (
        <>
          <span>{h1Typed}</span>
          {typedChars <= headline1.length && Caret}
          <br />
          <span className="text-indigo">{h2Typed}</span>
          {typedChars > headline1.length && Caret}
        </>
      )}
    </motion.h3>
  );
  const Sub = (
    <motion.p
      style={stage4}
      className="mt-4 text-[12px] leading-relaxed text-muted-foreground @[640px]:mt-5 @[640px]:text-[13px]"
    >
      {preset.subhead}
    </motion.p>
  );
  const Ctas = (
    <motion.div style={stage4} className="mt-5 flex flex-wrap items-center gap-2 @[640px]:mt-6 @[640px]:gap-3">
      <span className="rounded-full bg-ink px-4 py-2 text-[11px] font-medium text-white">{preset.primaryCta}</span>
      <span className="rounded-full border border-black/[0.1] px-4 py-2 text-[11px] font-medium text-foreground/70">{preset.ghostCta}</span>
    </motion.div>
  );
  const visual = (height: string) => (
    <motion.div
      style={stage5}
      className={`overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-soft/40 via-indigo/20 to-coral/20 shadow-[0_32px_80px_-32px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.05] ${height}`}
    >
      <div className="relative h-full w-full">
        {preset.heroImage && (
          <>
            <img
              src={preset.heroImage}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Bottom scrim keeps the live-signal card legible on any photo. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          </>
        )}
        <div className="absolute right-3.5 top-3.5 rounded-full bg-white/85 px-2.5 py-1 font-mono-display text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/65 shadow-sm ring-1 ring-black/[0.05] backdrop-blur-md">
          {preset.badge}
        </div>
        <div className="absolute bottom-3.5 left-3.5 flex items-center gap-3 rounded-2xl bg-white/85 py-2.5 pl-3 pr-4 text-left shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.05] backdrop-blur-md">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo" />
          </span>
          <span>
            <span className="block font-mono-display text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground/70">{preset.nextLabel}</span>
            <span className="mt-0.5 block font-display text-[12.5px] font-semibold tracking-tight">{preset.nextValue}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );

  if (layout === "splitLeft") {
    return (
      <div className="grid grid-cols-12 gap-5 px-5 pt-7 @[640px]:gap-8 @[640px]:px-10 @[640px]:pt-10">
        <div className="order-2 col-span-12 @[640px]:order-1 @[640px]:col-span-5">{visual("h-[180px] @[640px]:h-[220px]")}</div>
        <div className="order-1 col-span-12 @[640px]:order-2 @[640px]:col-span-7">
          {Eyebrow}
          <div className="mt-3">{Headline}</div>
          {Sub}
          {Ctas}
        </div>
      </div>
    );
  }

  if (layout === "centered") {
    return (
      <div className="relative px-5 pt-11 text-center @[640px]:px-10 @[640px]:pt-14">
        {/* Soft top wash — good pages set the hero on a breath of color. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--indigo,#3C38B8)_7%,transparent),transparent_70%)]"
        />
        <div className="relative">
          <div className="flex justify-center">{Eyebrow}</div>
          <div className="mx-auto mt-5 max-w-2xl">{Headline}</div>
          <motion.p style={stage4} className="mx-auto mt-4 max-w-[440px] text-[12.5px] leading-relaxed text-muted-foreground @[640px]:text-[14px]">
            {preset.subhead}
          </motion.p>
          <motion.div style={stage4} className="mt-6 flex flex-wrap items-center justify-center gap-2.5 @[640px]:mt-7 @[640px]:gap-3">
            <span data-cursor="cta" className="rounded-full bg-indigo px-5 py-2.5 text-[11.5px] font-semibold text-white shadow-[0_14px_36px_-12px_var(--indigo,#3C38B8)]">{preset.primaryCta}</span>
            <span className="rounded-full border border-black/[0.1] bg-white px-5 py-2.5 text-[11.5px] font-medium text-foreground/70">{preset.ghostCta}</span>
          </motion.div>
          <div className="mt-9">{visual("h-[230px] @[640px]:h-[300px]")}</div>
        </div>
      </div>
    );
  }

  if (layout === "fullBleed") {
    return (
      <div className="px-5 pt-7 @[640px]:px-10 @[640px]:pt-10">
        <motion.div
          style={stage5}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.13_0.012_270)] via-[color-mix(in_oklab,var(--indigo,oklch(0.55_0.24_275))_50%,black)] to-black ring-1 ring-black/20"
        >
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_30%,color-mix(in_oklab,var(--indigo)_38%,transparent),transparent_60%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative z-10 flex flex-col gap-6 p-6 @[640px]:gap-8 @[640px]:p-9">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-2.5 py-1 font-mono-display text-[9px] uppercase tracking-[0.2em] text-white/70 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo" />
                {extras.eyebrow}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 font-mono-display text-[9px] uppercase tracking-wider text-white/80 backdrop-blur">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                {preset.badge}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-6 @[640px]:gap-8">
              <div className="col-span-12 @[640px]:col-span-7">
                <motion.h3
                  style={stage3}
                  className="font-display text-[28px] font-[560] leading-[1.0] tracking-[-0.035em] text-white @[520px]:text-[36px] @[700px]:text-[52px]"
                >
                  {<Editable value={headline1} onChange={setHeadline1} ariaLabel="Edit headline line 1" />}
                  <br />
                  {<Editable value={headline2} onChange={setHeadline2} ariaLabel="Edit headline line 2" className="text-indigo" />}
                </motion.h3>
                <motion.p style={stage4} className="mt-3 max-w-md text-[12px] leading-relaxed text-white/70 @[640px]:text-[13px]">
                  {preset.subhead}
                </motion.p>
                <motion.div style={stage4} className="mt-5 flex flex-wrap items-center gap-2 @[640px]:gap-3">
                  <span className="rounded-full bg-white px-4 py-2 text-[11px] font-medium text-[oklch(0.13_0.012_270)]">{preset.primaryCta}</span>
                  <span className="rounded-full border border-white/25 px-4 py-2 text-[11px] font-medium text-white/80">{preset.ghostCta}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-white/50">
                    <span className="h-1 w-1 rounded-full bg-white/40" />
                    No credit card required
                  </span>
                </motion.div>
              </div>

              <motion.div style={stage4} className="col-span-12 @[640px]:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                    </div>
                    <span className="font-mono-display text-[9px] uppercase tracking-wider text-white/40">live</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {preset.features.slice(0, 3).map((f, i) => (
                      <div key={f.t} className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2 ring-1 ring-white/5">
                        <span
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium"
                          style={{ background: "color-mix(in oklab, var(--indigo) 30%, transparent)", color: "white" }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-medium text-white">{f.t}</div>
                          <div className="truncate text-[10px] text-white/50">{f.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div style={stage4} className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              {extras.stats.slice(0, 3).map((s) => (
                <div key={s.l}>
                  <div className="font-display text-[18px] font-[600] tracking-[-0.02em] text-white @[640px]:text-[22px]">{s.v}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50 @[640px]:text-[10px]">{s.l}</div>
                </div>
              ))}
            </motion.div>

            <motion.div style={stage4} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4">
              <span className="font-mono-display text-[9px] uppercase tracking-[0.2em] text-white/40">As seen in</span>
              {preset.logos.slice(0, 5).map((l) => (
                <span key={l} className="text-[11px] font-medium text-white/55">{l}</span>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (layout === "dashboard") {
    return (
      <div className="grid grid-cols-12 gap-5 px-5 pt-7 @[640px]:gap-8 @[640px]:px-10 @[640px]:pt-10">
        <div className="col-span-12 @[640px]:col-span-6">
          {Eyebrow}
          <div className="mt-3">{Headline}</div>
          {Sub}
          {Ctas}
        </div>
        <motion.div style={stage5} className="col-span-12 grid grid-cols-2 gap-2 @[640px]:col-span-6">
          {extras.stats.slice(0, 4).map((s, i) => (
            <div
              key={s.l}
              className={`rounded-xl p-3 ring-1 @[640px]:p-4 ${
                i === 0
                  ? "bg-[oklch(0.13_0.012_270)] ring-black/10"
                  : "bg-[oklch(0.985_0.002_280)] ring-black/[0.05]"
              }`}
            >
              <div
                className="font-display text-[20px] font-[600] tracking-[-0.02em] @[640px]:text-[26px]"
                style={i === 0 ? { color: "var(--indigo)" } : undefined}
              >
                {s.v}
              </div>
              <div className={`mt-0.5 text-[10px] uppercase tracking-wider ${i === 0 ? "text-white/60" : "text-muted-foreground/70"}`}>{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>
    );
  }

  // splitRight (default)
  return (
    <div className="grid grid-cols-12 gap-5 px-5 pt-7 @[640px]:gap-8 @[640px]:px-10 @[640px]:pt-10">
      <div className="col-span-12 @[640px]:col-span-7">
        {Eyebrow}
        <div className="mt-3">{Headline}</div>
        <div className="max-w-md">{Sub}</div>
        {Ctas}
      </div>
      <div className="col-span-12 @[640px]:col-span-5">{visual("h-[160px] @[640px]:h-[180px]")}</div>
    </div>
  );
}
