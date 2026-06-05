import { useMemo, useState } from "react";
import { useInView } from "../hooks/useInView";

// BuildScene — the interactive "Watch a page assemble" editor, ported from
// the Lovable design (charlottecarey-droid/scroll-saga-lp BuildSection.tsx)
// but trimmed to the parts that demo well on first scroll:
//   - 8 fictional brand presets, switchable from a tab strip
//   - Live preview frame that re-renders the whole hero on preset switch
//   - Headline editor (both lines) — typing updates the preview in real time
//   - 9 accent color swatches — clicking re-paints the brand color everywhere
//   - AI SUGGEST panel — per-preset realistic critique (static here; the real
//     product calls the API; later we can swap the source for a live LLM call)
//
// Why static AI suggestions for now: the live call (Lovable's gateway in their
// version, our OpenAI proxy in ours) needs a server function, rate limiting,
// and review of who's eating tokens for marketing-page anonymous visitors.
// Static suggestions get the visual + tactile feeling of the product without
// shipping a public-facing LLM endpoint. We can swap the SUGGESTIONS lookup
// for a fetch call later — interface is unchanged.

type AccentKey =
  | "indigo"
  | "coral"
  | "sage"
  | "gold"
  | "ink"
  | "violet"
  | "teal"
  | "crimson"
  | "neon";

const ACCENTS: Record<AccentKey, { hex: string; soft: string; label: string }> = {
  indigo: { hex: "#4B47E5", soft: "rgba(75,71,229,0.10)", label: "Indigo" },
  coral: { hex: "#E26B4F", soft: "rgba(226,107,79,0.10)", label: "Coral" },
  sage: { hex: "#6B9171", soft: "rgba(107,145,113,0.12)", label: "Sage" },
  gold: { hex: "#C8923D", soft: "rgba(200,146,61,0.12)", label: "Gold" },
  ink: { hex: "#1A1815", soft: "rgba(26,24,21,0.08)", label: "Ink" },
  violet: { hex: "#8E5BE5", soft: "rgba(142,91,229,0.10)", label: "Violet" },
  teal: { hex: "#3FAFA6", soft: "rgba(63,175,166,0.12)", label: "Teal" },
  crimson: { hex: "#C4413A", soft: "rgba(196,65,58,0.10)", label: "Crimson" },
  neon: { hex: "#A6E22E", soft: "rgba(166,226,46,0.18)", label: "Neon" },
};

interface Preset {
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
  statLabel: string;
  statValue: string;
  accent: AccentKey;
  stats: { v: string; l: string }[];
}

const PRESETS: Preset[] = [
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
    statLabel: "Next available",
    statValue: "Today, 3:40 PM · Brooklyn",
    accent: "indigo",
    stats: [
      { v: "16", l: "Cities, growing" },
      { v: "4.9★", l: "12K Google reviews" },
      { v: "<24h", l: "Avg booking lead" },
      { v: "94%", l: "Same-day open" },
    ],
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
    statLabel: "Pipeline value",
    statValue: "$1.2M · this quarter",
    accent: "coral",
    stats: [
      { v: "+42%", l: "Reply rate vs ctrl" },
      { v: "<8m", l: "Time to first reply" },
      { v: "2.1k", l: "Meetings booked" },
      { v: "SOC 2", l: "Type II certified" },
    ],
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
    statLabel: "Ships within",
    statValue: "24 hrs · free over $80",
    accent: "gold",
    stats: [
      { v: "18oz", l: "Waxed canvas" },
      { v: "Free", l: "Repairs, forever" },
      { v: "100%", l: "Carbon neutral" },
      { v: "OR", l: "Built in Portland" },
    ],
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
    statLabel: "Avg results",
    statValue: "–9 lbs in 12 weeks",
    accent: "sage",
    stats: [
      { v: "1:1", l: "Coach support" },
      { v: "78", l: "NPS · 6k members" },
      { v: "12wk", l: "Avg habit lock-in" },
      { v: "Free", l: "First week, no card" },
    ],
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
    statLabel: "On now",
    statValue: "Room 2 · Floating Points",
    accent: "violet",
    stats: [
      { v: "4", l: "Rooms tonight" },
      { v: "Vinyl", l: "Only, no laptops" },
      { v: "48h", l: "Members early access" },
      { v: "11pm", l: "Doors open" },
    ],
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
    statLabel: "APY today",
    statValue: "5.12% · auto-swept",
    accent: "teal",
    stats: [
      { v: "5.12%", l: "APY on idle cash" },
      { v: "8m", l: "Avg account open" },
      { v: "$5M", l: "FDIC coverage" },
      { v: "0", l: "Min balance" },
    ],
  },
  {
    id: "ember",
    brand: "Ember",
    domain: "ember.kitchen",
    category: "Fine dining",
    nav: ["Menu", "Reservations", "Cellar", "Private events"],
    headline1: "A tasting menu",
    headline2: "worth the trip.",
    subhead:
      "Twelve courses, wood-fired over Japanese binchotan, paired with low-intervention wines from a 600-bottle cellar.",
    primaryCta: "Reserve a table",
    ghostCta: "See the menu",
    badge: "★★ Michelin",
    statLabel: "Next seating",
    statValue: "Fri 8:15 PM · 2 left",
    accent: "crimson",
    stats: [
      { v: "12", l: "Courses, hand-plated" },
      { v: "600", l: "Bottles in cellar" },
      { v: "6wk", l: "Booked out" },
      { v: "★★", l: "Michelin" },
    ],
  },
  {
    id: "pulse",
    brand: "Pulse",
    domain: "pulse.gg",
    category: "Esports",
    nav: ["Tournaments", "Teams", "Watch", "Pro shop"],
    headline1: "Where the next",
    headline2: "GOATs are made.",
    subhead:
      "Daily ladders, weekend majors, and the deepest stat engine in competitive play. Climb the ranks or watch them climb.",
    primaryCta: "Enter the ladder",
    ghostCta: "Watch live",
    badge: "12.4M · online",
    statLabel: "Prize pool",
    statValue: "$2.4M · Major IX",
    accent: "neon",
    stats: [
      { v: "12.4M", l: "Players online" },
      { v: "$2.4M", l: "Major IX pool" },
      { v: "<1h", l: "Payouts settle" },
      { v: "Free", l: "To enter" },
    ],
  },
];

// AI SUGGEST critiques per preset — the kind of feedback a senior landing-page
// reviewer would give on the rendered hero. Static for now; swap to a live
// LLM call when we're ready to pay for tokens on anonymous traffic.
const SUGGESTIONS: Record<string, { tag: "Copy" | "Layout" | "Brand" | "Convert"; body: string }[]> = {
  smilist: [
    { tag: "Copy", body: '"Modern dentistry" reads clinical — lead with the "Same-day visits" benefit to give people a reason to switch.' },
    { tag: "Brand", body: "Indigo reads corporate for dental — warm the palette to a sage or coral accent to counter the clinical vibe." },
    { tag: "Convert", body: 'Move "Book online in under a minute" into the primary button. It\'s the only outcome that matters here.' },
    { tag: "Layout", body: "Split-right with the booking card works — pull the stat band closer to the fold to make the trust signals visible above the scroll." },
  ],
  northwind: [
    { tag: "Convert", body: "Both CTAs read equally — make Start free trial the dominant primary and demote Book a demo to a small text link." },
    { tag: "Copy", body: '"AI-native CRM" is a category claim — replace with the specific outcome: "Drafts your follow-ups in your voice."' },
    { tag: "Brand", body: 'SOC 2 badge belongs lower in the page — top-right is reserved for the social-proof hit ("$1.2M closed this quarter").' },
    { tag: "Layout", body: "Dashboard hero competes with the headline — shrink the chart, give the type more whitespace." },
  ],
  field: [
    { tag: "Copy", body: '"Lifetime guarantee" is the wedge — pull it into the headline. "Gear made for the long way home" is poetic but doesn\'t sell.' },
    { tag: "Brand", body: "Gold + waxed-cotton beige feels too soft — bump the gold saturation 8% to keep the CTA legible on cream." },
    { tag: "Convert", body: 'Shop the kit is good — pair it with the price-floor ("from $84") so the click intent is qualified.' },
    { tag: "Layout", body: "Split-left with the gear photo carries the brand — let the headline crowd it slightly for a more editorial feel." },
  ],
  verdant: [
    { tag: "Copy", body: '"Habits that stick" is a category claim — replace with the proof: "Members lose 9 lbs in 12 weeks, on average."' },
    { tag: "Convert", body: "Take the quiz is the right CTA — the page is selling discovery, not purchase. Move the price reveal to step 3 of the quiz." },
    { tag: "Brand", body: "Sage is correct for wellness — push the secondary to a warm gold for the testimonial cards." },
    { tag: "Layout", body: "Center-aligned works for the editorial feel; let the subhead breathe more — bump the line-height to 1.6." },
  ],
  nocturne: [
    { tag: "Layout", body: "Full-bleed dark works for nightlife — drop the nav opacity to 60% so it doesn't fight the hero photo." },
    { tag: "Copy", body: '"After-hours, engineered" is on-brand for residency curation — keep it. Subhead is too long; cut to 14 words.' },
    { tag: "Convert", body: "See tonight is the right primary — make the ghost CTA Listen in a soft button, not text, so phone-first users tap something." },
    { tag: "Brand", body: "Violet on black is right; consider a 1px neon-edge stroke on cards for that vinyl-room glow." },
  ],
  atlas: [
    { tag: "Copy", body: '"5.12% APY" is the only thing that matters — make it the headline, not the badge.' },
    { tag: "Convert", body: "Open an account is the right CTA — Talk to us should be a thin text link, not equal weight." },
    { tag: "Brand", body: "Teal is right for fintech-but-not-square — keep ink at 80% opacity for body so the page reads serious not techy." },
    { tag: "Layout", body: "Dashboard hero conveys the product — keep it but pull the APY stat ABOVE the dashboard so it's visible without scrolling." },
  ],
  ember: [
    { tag: "Copy", body: '"Worth the trip" is poetic — pair the headline with "12 courses, $245, Friday 8PM" so the commercial intent is clear.' },
    { tag: "Brand", body: "Crimson + cream works for fine dining — tighten the leading on the headline by –0.04em to feel editorial." },
    { tag: "Convert", body: "Reserve a table is right — Ghost CTA See the menu should be a small text link not equal weight." },
    { tag: "Layout", body: "Centered hero is correct — add a single chef photo BELOW the fold to humanize before the menu reveal." },
  ],
  pulse: [
    { tag: "Brand", body: "Neon on dark works for esports — but the contrast ratio on body text is borderline. Lift ink to 95% white." },
    { tag: "Copy", body: '"GOATs are made" is on-tone — Drop in needs more urgency. Try "Queue is open. Drop in →"' },
    { tag: "Convert", body: "Top 1% gets paid is the wedge — pull it into the hero subhead, not the CTA microcopy." },
    { tag: "Layout", body: "Split-left with the leaderboard works — tighten the hero stack so the prize-pool stat sits ABOVE the fold." },
  ],
};

export default function BuildScene() {
  const { ref, inView } = useInView(0.05);

  const [activeId, setActiveId] = useState<string>("smilist");
  // Per-preset overrides for headline + accent — typing/clicking sets them,
  // switching presets resets to that preset's defaults.
  const [h1Override, setH1Override] = useState<string | null>(null);
  const [h2Override, setH2Override] = useState<string | null>(null);
  const [accentOverride, setAccentOverride] = useState<AccentKey | null>(null);

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === activeId) ?? PRESETS[0],
    [activeId],
  );

  // Effective values — overrides take precedence over preset defaults
  const h1 = h1Override ?? preset.headline1;
  const h2 = h2Override ?? preset.headline2;
  const accentKey = accentOverride ?? preset.accent;
  const accent = ACCENTS[accentKey];
  const suggestions = SUGGESTIONS[preset.id] ?? SUGGESTIONS.smilist;

  // Reset overrides when switching presets so each tab feels like a fresh
  // starting point (without this, headline edits would persist across brands
  // which is confusing and breaks the demo metaphor).
  function selectPreset(id: string) {
    setActiveId(id);
    setH1Override(null);
    setH2Override(null);
    setAccentOverride(null);
  }

  return (
    <section
      id="build"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{
        background: "var(--cream)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Section header */}
        <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
          <div className="max-w-2xl">
            <div className="marker marker-rule mb-6">01 / Watch it build</div>
            <h2
              className="font-display text-display-lg"
              style={{ color: "var(--ink)" }}
            >
              Watch a page assemble.
            </h2>
            <p
              className="mt-5 text-[17px] leading-[1.55] max-w-[560px]"
              style={{ color: "var(--ink-soft)" }}
            >
              Pick a brand below. Edit the headline. Swap the accent. The page
              re-paints in real time — same canvas your team will be using in
              the app.
            </p>
          </div>
          <div
            className="font-mono uppercase"
            style={{
              color: "var(--ink-mute)",
              fontSize: 10.5,
              letterSpacing: "0.16em",
              fontWeight: 600,
            }}
          >
            Live · interactive
            <span
              className="inline-block ml-2"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--coral)",
                boxShadow: "0 0 8px var(--coral)",
                animation: "pulse-dot 1.6s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        {/* Editor frame */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.7) inset, 0 40px 80px -34px rgba(26,24,21,0.30), 0 12px 28px -18px rgba(26,24,21,0.16)",
          }}
        >
          {/* Tenant tab strip */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto"
            style={{
              background: "var(--cream-2)",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            {PRESETS.map((p) => {
              const active = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  style={{
                    flexShrink: 0,
                    fontFamily: "JetBrains Mono, ui-monospace, monospace",
                    fontSize: 11.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--ink)" : "var(--ink-mute)",
                    background: active ? "var(--paper)" : "transparent",
                    border: `1px solid ${active ? "var(--hairline)" : "transparent"}`,
                    borderRadius: 6,
                    padding: "5px 10px",
                    cursor: "pointer",
                    transition: "all .15s",
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                  }}
                >
                  {p.brand}
                </button>
              );
            })}
            <span
              className="ml-auto font-mono uppercase flex items-center gap-2"
              style={{
                color: "var(--ink-mute)",
                fontSize: 10,
                letterSpacing: "0.14em",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <span style={{ color: "var(--sage)" }}>●</span> Shipped · 47s
              <span
                style={{
                  background: "linear-gradient(180deg, #5C58EB 0%, #4B47E5 100%)",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: 5,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  marginLeft: 4,
                  boxShadow: "0 4px 10px -2px rgba(75,71,229,0.4)",
                }}
              >
                Publish
              </span>
            </span>
          </div>

          {/* Body: preview + inspector */}
          <div className="grid md:grid-cols-[1fr_300px]">
            {/* PREVIEW — re-renders on preset/headline/accent change */}
            <div
              style={{
                background: "#FFFEFC",
                borderRight: "1px solid var(--hairline)",
                minHeight: 440,
              }}
            >
              {/* Brand nav row inside preview */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: accent.hex,
                      transition: "background .3s",
                    }}
                  />
                  <span
                    className="font-display"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: "#1A1815",
                    }}
                  >
                    {preset.brand}
                  </span>
                </div>
                <div
                  className="hidden md:flex items-center gap-5"
                  style={{
                    fontSize: 12.5,
                    color: "rgba(26,24,21,0.6)",
                  }}
                >
                  {preset.nav.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
                <span
                  style={{
                    background: "#1A1815",
                    color: "#fff",
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 500,
                  }}
                >
                  {preset.primaryCta.split(" ")[0]}
                </span>
              </div>

              {/* Hero block */}
              <div
                className="grid gap-6 px-6 py-7"
                style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "center" }}
              >
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 font-mono uppercase mb-3.5"
                    style={{
                      background: accent.soft,
                      color: accent.hex,
                      border: `1px solid ${accent.soft}`,
                      padding: "4px 11px",
                      borderRadius: 999,
                      fontSize: 9.5,
                      letterSpacing: "0.14em",
                      fontWeight: 700,
                      transition: "all .3s",
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: accent.hex,
                        transition: "background .3s",
                      }}
                    />
                    {preset.badge}
                  </span>
                  <h3
                    className="font-display"
                    style={{
                      fontSize: 30,
                      fontWeight: 600,
                      letterSpacing: "-0.025em",
                      lineHeight: 1.04,
                      color: "#1A1815",
                      margin: 0,
                    }}
                  >
                    <div>{h1}</div>
                    <div style={{ color: accent.hex, transition: "color .3s" }}>
                      {h2}
                    </div>
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: "rgba(26,24,21,0.6)",
                      lineHeight: 1.5,
                      maxWidth: 360,
                      margin: "10px 0 16px",
                    }}
                  >
                    {preset.subhead}
                  </p>
                  <div className="flex gap-2">
                    <span
                      style={{
                        background: "#1A1815",
                        color: "#fff",
                        padding: "8px 16px",
                        borderRadius: 7,
                        fontSize: 12.5,
                        fontWeight: 500,
                      }}
                    >
                      {preset.primaryCta}
                    </span>
                    <span
                      style={{
                        color: "#1A1815",
                        padding: "8px 16px",
                        borderRadius: 7,
                        fontSize: 12.5,
                        fontWeight: 500,
                        border: "1px solid rgba(26,24,21,0.18)",
                      }}
                    >
                      {preset.ghostCta}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    background: `linear-gradient(135deg, ${accent.soft}, color-mix(in srgb, ${accent.hex} 22%, transparent))`,
                    borderRadius: 12,
                    padding: 18,
                    minHeight: 140,
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "background .35s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "rgba(255,255,255,0.75)",
                      borderRadius: 999,
                      padding: "3px 10px",
                      fontSize: 10.5,
                      fontFamily: "JetBrains Mono, ui-monospace, monospace",
                      color: "rgba(26,24,21,0.6)",
                    }}
                  >
                    {preset.domain}
                  </span>
                  <div style={{ marginTop: 40 }}>
                    <div
                      className="font-mono uppercase"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        color: "rgba(26,24,21,0.55)",
                        fontWeight: 700,
                      }}
                    >
                      {preset.statLabel}
                    </div>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#1A1815",
                        marginTop: 4,
                        letterSpacing: "-0.014em",
                      }}
                    >
                      {preset.statValue}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat band */}
              <div
                className="grid gap-4 px-6 pb-5"
                style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
              >
                {preset.stats.map((s, i) => (
                  <div
                    key={i}
                    style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}
                  >
                    <div
                      className="font-display"
                      style={{
                        fontSize: 22,
                        fontWeight: 600,
                        color: "#1A1815",
                        letterSpacing: "-0.022em",
                      }}
                    >
                      {s.v}
                    </div>
                    <div
                      className="font-mono uppercase"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.12em",
                        color: "rgba(26,24,21,0.55)",
                        marginTop: 3,
                        fontWeight: 600,
                      }}
                    >
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INSPECTOR PANEL */}
            <div
              style={{
                padding: 18,
                background: "var(--paper)",
                fontSize: 13,
              }}
            >
              <div
                className="font-mono uppercase mb-3"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                Inspector — Hero
              </div>

              <label
                className="font-mono uppercase block mb-1.5"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.12em",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                Headline · line 1
              </label>
              <input
                type="text"
                value={h1}
                onChange={(e) => setH1Override(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "var(--paper)",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accent.hex)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--hairline)")}
              />

              <label
                className="font-mono uppercase block mt-3 mb-1.5"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.12em",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                Headline · accent line
              </label>
              <input
                type="text"
                value={h2}
                onChange={(e) => setH2Override(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "var(--paper)",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accent.hex)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--hairline)")}
              />

              <label
                className="font-mono uppercase block mt-4 mb-2"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.12em",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                Accent
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(9, 1fr)",
                  gap: 6,
                }}
              >
                {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
                  const isSelected = accentKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAccentOverride(k)}
                      title={ACCENTS[k].label}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 999,
                        background: ACCENTS[k].hex,
                        border: `2px solid ${isSelected ? "var(--ink)" : "transparent"}`,
                        cursor: "pointer",
                        padding: 0,
                        transition: "transform .12s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.1)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    />
                  );
                })}
              </div>

              <div
                className="font-mono mt-3"
                style={{
                  fontSize: 11,
                  color: "var(--ink-soft)",
                }}
              >
                {preset.brand} · {preset.category}
              </div>

              {/* AI SUGGEST */}
              <div
                className="mt-4 rounded-xl p-3.5"
                style={{ background: "var(--cream-2)" }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="font-mono uppercase inline-flex items-center gap-1.5"
                    style={{
                      fontSize: 9.5,
                      letterSpacing: "0.14em",
                      color: "var(--ink-soft)",
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "var(--coral)",
                        boxShadow: "0 0 6px var(--coral)",
                        animation: "pulse-dot 1.6s ease-in-out infinite",
                      }}
                    />
                    AI suggest
                  </span>
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      color: "var(--ink-mute)",
                      fontWeight: 700,
                    }}
                  >
                    Live · Gemini
                  </span>
                </div>
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.5,
                      color: "var(--ink-2)",
                      marginBottom: i === suggestions.length - 1 ? 0 : 8,
                    }}
                  >
                    <span
                      className="inline-block font-mono uppercase mr-1.5"
                      style={{
                        background: "var(--paper)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontSize: 8.5,
                        letterSpacing: "0.12em",
                        color: "var(--ink-mute)",
                        verticalAlign: 1,
                        fontWeight: 700,
                      }}
                    >
                      {s.tag}
                    </span>
                    {s.body}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </section>
  );
}
