import React from "react";

const CREAM = "#f6f5ee";
const INK = "#0d1f15";
const ACCENT = "#c8e84e";
const MUTED = "rgba(13,31,21,0.6)";
const HAIRLINE = "rgba(13,31,21,0.12)";

const DISPLAY = "'Bagoss Standard', 'Times New Roman', Georgia, serif";
const SANS =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const TOC = [
  { num: "01", label: "Situation" },
  { num: "02", label: "Signal" },
  { num: "03", label: "Cost" },
  { num: "04", label: "Shift" },
  { num: "05", label: "Math" },
  { num: "06", label: "Proof" },
  { num: "07", label: "Plan" },
];

const SITUATION_STATS = [
  { value: "$30k+", label: "Scanner CAPEX", desc: "Average upfront cost per office, just for hardware." },
  { value: "4–6", label: "Vendor sprawl", desc: "Average number of lab partners a typical DSO manages." },
  { value: "6–8%", label: "Remake rate", desc: "Industry average, resulting in unbillable chair time." },
];

const COST_TILES = [
  { num: "01", stat: "7.2%", label: "Average Remake Rate", desc: "Every remake costs an estimated $350 in unbillable chair time." },
  { num: "02", stat: "1,200", label: "Lost Chair Hours / Yr", desc: "Based on a 10-office DSO relying on analog impressions." },
  { num: "03", stat: "$35k", label: "Scanner CAPEX", desc: "Upfront capital per office that could be deployed for growth." },
  { num: "04", stat: "12+", label: "Fragmented Vendors", desc: "Creating inconsistent quality and opaque unit economics." },
];

const SHIFT_ROWS = [
  { category: "Turnaround Time", yesterday: "2–3 weeks, unpredictable", dandy: "5–7 days, guaranteed" },
  { category: "First-Time-Right Rate", yesterday: "~92% industry average", dandy: "99% digital precision" },
  { category: "Doctor Experience", yesterday: "Analog impressions, blind delivery", dandy: "100% digital, full case visibility" },
  { category: "Data & Visibility", yesterday: "Zero central oversight", dandy: "Real-time DSO analytics dashboard" },
  { category: "Partnership Model", yesterday: "Transactional vendor", dandy: "Strategic growth partner (Zero CAPEX)" },
];

const MATH_SUPPORTING = [
  { value: "1,450", label: "Est. Monthly Restorations" },
  { value: "4,200", label: "Chair Hours Saved / Yr" },
  { value: "+14%", label: "Est. Gross Margin Uplift" },
  { value: "Immediate", label: "Payback Period", caption: "Zero CAPEX model" },
];

const SECONDARY_QUOTES = [
  {
    quote:
      "Rolling out Dandy across 80 locations took less time than a single traditional hardware procurement cycle. The training is phenomenal.",
    name: "Marcus Thorne",
    title: "VP Operations, Heartland Dental Partners",
  },
  {
    quote:
      "Real-time visibility into lab spend and remake rates across all our clinics has been a game-changer for our finance team.",
    name: "Elena Rostova",
    title: "CFO, Pacific Coast DSO",
  },
];

const PLAN_STEPS = [
  { num: "01", title: "Scope Pilot", time: "Week 1", desc: "Select 5 representative offices to establish baseline metrics." },
  { num: "02", title: "Onboard & Train", time: "Weeks 2–4", desc: "Scanner delivery and in-person clinical training by Dandy experts." },
  { num: "03", title: "Measure Impact", time: "Month 2", desc: "Track case acceptance, turnaround times, and doctor satisfaction." },
  { num: "04", title: "Org-wide Rollout", time: "Month 3+", desc: "Phased deployment across all remaining practices." },
];

function SectionHeader({
  num,
  eyebrow,
  heading,
  lede,
}: {
  num: string;
  eyebrow: string;
  heading: string;
  lede?: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-20">
      <div className="lg:col-span-4">
        <div className="flex items-baseline gap-5">
          <span
            className="text-sm tracking-[0.18em] uppercase"
            style={{ color: MUTED, fontFamily: SANS }}
          >
            {num}
          </span>
          <span
            className="h-px flex-1 max-w-[120px]"
            style={{ background: HAIRLINE }}
            aria-hidden
          />
        </div>
        <div
          className="mt-4 text-xs tracking-[0.22em] uppercase"
          style={{ color: INK, fontFamily: SANS, fontWeight: 600 }}
        >
          {eyebrow}
        </div>
      </div>
      <div className="lg:col-span-8">
        <h2
          className="leading-[1.02] tracking-[-0.01em]"
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(36px, 4.6vw, 64px)",
            color: INK,
          }}
        >
          {heading}
        </h2>
        {lede && (
          <p
            className="mt-6 max-w-2xl"
            style={{
              fontFamily: SANS,
              fontSize: "clamp(16px, 1.2vw, 19px)",
              lineHeight: 1.55,
              color: MUTED,
            }}
          >
            {lede}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Premium() {
  return (
    <div
      style={{
        background: CREAM,
        color: INK,
        fontFamily: SANS,
        minHeight: "100vh",
      }}
    >
      <style>{`
        .pe-display { font-family: ${DISPLAY}; letter-spacing: -0.015em; }
        .pe-eyebrow { font-family: ${SANS}; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; font-size: 11px; }
        .pe-num-xxl {
          font-family: ${DISPLAY};
          font-size: clamp(72px, 9vw, 128px);
          line-height: 0.95;
          letter-spacing: -0.025em;
        }
        .pe-num-xl {
          font-family: ${DISPLAY};
          font-size: clamp(56px, 6vw, 88px);
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .pe-num-lg {
          font-family: ${DISPLAY};
          font-size: clamp(40px, 4.2vw, 64px);
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .pe-display-hero {
          font-family: ${DISPLAY};
          font-size: clamp(56px, 7vw, 112px);
          line-height: 0.98;
          letter-spacing: -0.025em;
          font-weight: 500;
        }
        .pe-hairline { background: ${HAIRLINE}; }
        .pe-link-underline {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .pe-link-underline::after {
          content: "";
          position: absolute; left: 0; right: 0; bottom: -4px;
          height: 1px; background: currentColor; opacity: 0.4;
        }
        .pe-fade-in {
          animation: peFade 0.7s ease-out both;
        }
        @keyframes peFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pe-hero-image-card {
          background:
            radial-gradient(120% 80% at 30% 20%, rgba(200,232,78,0.18), transparent 60%),
            linear-gradient(160deg, #15321f 0%, #0d1f15 55%, #0a1810 100%);
        }
        .pe-image-fallback::before {
          content: "";
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 80% at 30% 20%, rgba(200,232,78,0.18), transparent 60%),
            linear-gradient(160deg, #15321f 0%, #0d1f15 55%, #0a1810 100%);
        }
      `}</style>

      {/* Sticky-looking dark top nav */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{ background: INK, color: CREAM, borderBottom: `1px solid rgba(246,245,238,0.08)` }}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="pe-display"
              style={{ fontSize: 22, color: CREAM, letterSpacing: "-0.02em" }}
            >
              Dandy
            </span>
            <span
              className="ml-3 hidden sm:inline-block pe-eyebrow"
              style={{ color: "rgba(246,245,238,0.55)", fontSize: 10 }}
            >
              × Pacific Dental Services
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {["Situation", "Signal", "Math", "Proof", "Plan"].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="pe-eyebrow"
                style={{ color: "rgba(246,245,238,0.7)" }}
              >
                {l}
              </a>
            ))}
          </nav>
          <a
            href="#contact"
            className="pe-eyebrow"
            style={{
              background: ACCENT,
              color: INK,
              padding: "10px 18px",
              borderRadius: 999,
            }}
          >
            Schedule
          </a>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-24 lg:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left: copy */}
            <div className="lg:col-span-7 pe-fade-in">
              {/* For-tag */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 mb-10"
                style={{
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 999,
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: ACCENT }}
                />
                <span className="pe-eyebrow" style={{ color: INK }}>
                  For Pacific Dental Services
                </span>
              </div>

              {/* Kicker */}
              <div
                className="pe-eyebrow mb-6"
                style={{ color: MUTED }}
              >
                Field study · Q1 · Confidential
              </div>

              {/* Eyebrow */}
              <div className="flex items-center gap-4 mb-8">
                <span className="h-px w-10" style={{ background: INK }} />
                <span className="pe-eyebrow" style={{ color: INK }}>
                  The Business Case
                </span>
              </div>

              {/* Headline */}
              <h1 className="pe-display-hero" style={{ color: INK, maxWidth: "14ch" }}>
                Why PDS doctors keep finding Dandy.
              </h1>

              {/* Lede */}
              <p
                className="mt-10 max-w-xl"
                style={{
                  fontSize: "clamp(17px, 1.3vw, 21px)",
                  lineHeight: 1.55,
                  color: MUTED,
                }}
              >
                A consultative analysis of how a fully digital lab partner reshapes
                clinical outcomes, doctor retention, and EBITDA across the PDS network.
              </p>

              {/* CTAs */}
              <div className="mt-12 flex flex-wrap items-center gap-8">
                <a
                  href="#contact"
                  className="pe-eyebrow"
                  style={{
                    background: ACCENT,
                    color: INK,
                    padding: "16px 28px",
                    fontSize: 12,
                  }}
                >
                  Schedule a working session →
                </a>
                <a
                  href="#summary"
                  className="pe-link-underline"
                  style={{
                    fontFamily: SANS,
                    fontSize: 14,
                    color: INK,
                    fontWeight: 500,
                  }}
                >
                  Read the 5-min summary
                </a>
              </div>
            </div>

            {/* Right: tall portrait image card */}
            <div className="lg:col-span-5 pe-fade-in">
              <div
                className="relative w-full overflow-hidden pe-image-fallback pe-hero-image-card"
                style={{
                  aspectRatio: "3 / 4",
                  borderRadius: 2,
                  border: `1px solid ${HAIRLINE}`,
                }}
              >
                <img
                  src="/__mockup/images/dental-professional.png"
                  alt="Dental professional"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                {/* Caption overlay */}
                <div
                  className="absolute left-4 right-4 bottom-4 flex items-center justify-between"
                  style={{ color: CREAM }}
                >
                  <span className="pe-eyebrow" style={{ color: "rgba(246,245,238,0.85)" }}>
                    Field study, Q1
                  </span>
                  <span className="pe-eyebrow" style={{ color: "rgba(246,245,238,0.55)" }}>
                    Plate 01
                  </span>
                </div>
                {/* Hairline frame inside */}
                <div
                  className="absolute inset-3 pointer-events-none"
                  style={{ border: `1px solid rgba(246,245,238,0.15)` }}
                />
              </div>
              <div
                className="mt-4 flex items-baseline justify-between pe-eyebrow"
                style={{ color: MUTED }}
              >
                <span>Volume I</span>
                <span>2025 · No. 01</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hairline divider */}
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div className="h-px" style={{ background: HAIRLINE }} />
        </div>
      </section>

      {/* TABLE OF CONTENTS strip */}
      <section>
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div
            className="flex items-center justify-between gap-6 py-6 overflow-x-auto"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <span className="pe-eyebrow whitespace-nowrap" style={{ color: MUTED }}>
              Contents
            </span>
            <div className="flex items-center gap-7 lg:gap-10 whitespace-nowrap">
              {TOC.map((t, i) => (
                <a
                  key={t.num}
                  href={`#sec-${t.num}`}
                  className="flex items-baseline gap-2"
                  style={{ color: INK }}
                >
                  <span
                    className="pe-eyebrow"
                    style={{ color: MUTED, fontSize: 10 }}
                  >
                    {t.num}
                  </span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 15,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {t.label}
                  </span>
                  {i < TOC.length - 1 && (
                    <span
                      className="ml-7 lg:ml-10 hidden md:inline-block"
                      style={{ color: MUTED, fontSize: 12 }}
                    >
                      ·
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. SITUATION */}
      <section id="sec-01" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32">
        <SectionHeader
          num="01"
          eyebrow="The Situation"
          heading="The Situation"
          lede="DSOs operating at scale are hitting a structural ceiling. Legacy workflows demand massive upfront CAPEX for intraoral scanners, while a sprawl of local labs creates inconsistent clinical quality and unpredictable unit economics."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4 lg:col-start-5">
            <p
              style={{
                fontSize: "clamp(16px, 1.15vw, 18px)",
                lineHeight: 1.65,
                color: MUTED,
              }}
            >
              Meanwhile, clinical recruitment has never been more competitive.
              Top producers expect a modern, digital-first workflow that reduces
              chair time and eliminates frustrating remakes.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="mt-24 grid grid-cols-1 md:grid-cols-3"
          style={{ borderTop: `1px solid ${HAIRLINE}` }}
        >
          {SITUATION_STATS.map((s, i) => (
            <div
              key={s.label}
              className="py-10 md:py-12 px-0 md:px-8 first:md:pl-0 last:md:pr-0"
              style={{
                borderRight:
                  i < SITUATION_STATS.length - 1
                    ? `1px solid ${HAIRLINE}`
                    : "none",
                borderBottom:
                  i < SITUATION_STATS.length - 1
                    ? `1px solid ${HAIRLINE}`
                    : `1px solid ${HAIRLINE}`,
              }}
            >
              <div className="pe-num-xl" style={{ color: INK }}>
                {s.value}
              </div>
              <div
                className="pe-eyebrow mt-6"
                style={{ color: INK }}
              >
                {s.label}
              </div>
              <p
                className="mt-3 max-w-xs"
                style={{ fontSize: 14, lineHeight: 1.5, color: MUTED }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. SIGNAL */}
      <section id="sec-02" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <SectionHeader
          num="02"
          eyebrow="The Signal"
          heading="Doctors are demanding a better standard of care."
          lede="Across enterprise DSO partners, demand for Dandy is showing up in growth, recruiting conversations, and the words doctors use when they describe their workflow."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: HAIRLINE }}>
          <div className="p-10" style={{ background: CREAM }}>
            <div className="pe-num-lg" style={{ color: INK }}>+312%</div>
            <p
              className="mt-8"
              style={{ fontSize: 15, lineHeight: 1.55, color: MUTED, maxWidth: "28ch" }}
            >
              Growth in Dandy removables YoY across our enterprise DSO partners.
            </p>
            <div
              className="pe-eyebrow mt-10"
              style={{ color: MUTED }}
            >
              Growth · YoY
            </div>
          </div>
          <div className="p-10" style={{ background: CREAM }}>
            <div className="pe-num-lg" style={{ color: INK }}>1 in 3</div>
            <p
              className="mt-8"
              style={{ fontSize: 15, lineHeight: 1.55, color: MUTED, maxWidth: "28ch" }}
            >
              New clinical hires ask for Dandy by name during recruitment.
            </p>
            <div
              className="pe-eyebrow mt-10"
              style={{ color: MUTED }}
            >
              Recruiting · 2024
            </div>
          </div>
          <div className="p-10 flex flex-col" style={{ background: CREAM }}>
            <span
              className="pe-display"
              style={{ fontSize: 40, color: ACCENT, lineHeight: 1 }}
              aria-hidden
            >
              “
            </span>
            <p
              className="mt-2 italic"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(19px, 1.5vw, 23px)",
                lineHeight: 1.35,
                color: INK,
              }}
            >
              We were losing top producers because our legacy lab workflow
              frustrated them. Dandy reversed that overnight.
            </p>
            <div
              className="pe-eyebrow mt-auto pt-10"
              style={{ color: MUTED }}
            >
              VP of Clinical Ops · Top-10 DSO
            </div>
          </div>
        </div>
      </section>

      {/* 4. COST OF INACTION */}
      <section id="sec-03" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <SectionHeader
          num="03"
          eyebrow="Cost of Inaction"
          heading="The cost of inaction."
          lede="Standing still isn't neutral. It actively erodes margin and limits growth."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-20">
          {COST_TILES.map((t) => (
            <div key={t.num} style={{ borderTop: `1px solid ${INK}` }} className="pt-8">
              <div className="flex items-start justify-between">
                <span
                  className="pe-eyebrow"
                  style={{ color: MUTED }}
                >
                  {t.num}
                </span>
                <span
                  className="pe-eyebrow"
                  style={{ color: MUTED }}
                >
                  {t.label}
                </span>
              </div>
              <div className="pe-num-xxl mt-8" style={{ color: INK }}>
                {t.stat}
              </div>
              <p
                className="mt-8 max-w-md"
                style={{ fontSize: 16, lineHeight: 1.55, color: MUTED }}
              >
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. PARADIGM SHIFT */}
      <section id="sec-04" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <SectionHeader
          num="04"
          eyebrow="Paradigm Shift"
          heading="The paradigm shift."
          lede="A side-by-side reading of the legacy DSO lab workflow against the Dandy operating model."
        />

        {/* Header row */}
        <div
          className="grid grid-cols-12 gap-6 pb-6"
          style={{ borderBottom: `1px solid ${INK}` }}
        >
          <div className="col-span-4 pe-eyebrow" style={{ color: INK }}>Category</div>
          <div className="col-span-4 pe-eyebrow" style={{ color: MUTED }}>Yesterday</div>
          <div className="col-span-4 pe-eyebrow" style={{ color: INK }}>With Dandy</div>
        </div>

        {SHIFT_ROWS.map((r) => (
          <div
            key={r.category}
            className="grid grid-cols-12 gap-6 py-7 items-baseline"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <div
              className="col-span-12 md:col-span-4"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(20px, 1.6vw, 24px)",
                letterSpacing: "-0.01em",
                color: INK,
              }}
            >
              {r.category}
            </div>
            <div
              className="col-span-12 md:col-span-4"
              style={{ fontSize: 16, lineHeight: 1.5, color: MUTED }}
            >
              {r.yesterday}
            </div>
            <div className="col-span-12 md:col-span-4 flex items-start gap-3">
              <span
                className="mt-2 inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: ACCENT }}
                aria-hidden
              />
              <span
                style={{
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: INK,
                  fontWeight: 500,
                }}
              >
                {r.dandy}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* 6. THE MATH — dark */}
      <section
        id="sec-05"
        className="py-32"
        style={{
          background: INK,
          color: CREAM,
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          {/* Section header (dark variant) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-20">
            <div className="lg:col-span-4">
              <div className="flex items-baseline gap-5">
                <span
                  className="pe-eyebrow"
                  style={{ color: "rgba(246,245,238,0.5)" }}
                >
                  05
                </span>
                <span
                  className="h-px flex-1 max-w-[120px]"
                  style={{ background: "rgba(246,245,238,0.18)" }}
                />
              </div>
              <div
                className="mt-4 pe-eyebrow"
                style={{ color: ACCENT }}
              >
                The Math
              </div>
            </div>
            <div className="lg:col-span-8">
              <h2
                className="pe-display"
                style={{
                  fontSize: "clamp(36px, 4.6vw, 64px)",
                  color: CREAM,
                  lineHeight: 1.02,
                }}
              >
                The math.
              </h2>
              <p
                className="mt-6 max-w-2xl"
                style={{
                  fontSize: "clamp(16px, 1.2vw, 19px)",
                  lineHeight: 1.55,
                  color: "rgba(246,245,238,0.7)",
                }}
              >
                Modeled across PDS's network of <span style={{ color: CREAM }}>{`{{practice_count}}`}</span> offices.
              </p>
            </div>
          </div>

          {/* Hero stat */}
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end pb-16"
            style={{ borderBottom: `1px solid rgba(246,245,238,0.15)` }}
          >
            <div className="lg:col-span-7">
              <div className="pe-eyebrow" style={{ color: ACCENT }}>
                Incremental Cases / Month
              </div>
              <div
                className="mt-4"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(120px, 18vw, 260px)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.035em",
                  color: CREAM,
                  fontWeight: 500,
                }}
              >
                +185
              </div>
            </div>
            <div className="lg:col-span-5">
              <p
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(20px, 1.7vw, 26px)",
                  lineHeight: 1.35,
                  color: "rgba(246,245,238,0.85)",
                  maxWidth: "32ch",
                }}
              >
                Estimated incremental restorative cases per month — the
                compounding effect of digital workflow, doctor retention, and
                zero-CAPEX scanner deployment.
              </p>
            </div>
          </div>

          {/* Supporting stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 mt-16">
            {MATH_SUPPORTING.map((s, i) => (
              <div
                key={s.label}
                className="py-6 px-0 md:px-8 first:md:pl-0 last:md:pr-0"
                style={{
                  borderLeft:
                    i > 0 ? `1px solid rgba(246,245,238,0.15)` : "none",
                }}
              >
                <div
                  className="pe-eyebrow"
                  style={{ color: "rgba(246,245,238,0.55)" }}
                >
                  {s.label}
                </div>
                <div
                  className="mt-5"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(36px, 3.5vw, 56px)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: ACCENT,
                  }}
                >
                  {s.value}
                </div>
                {s.caption && (
                  <div
                    className="mt-3"
                    style={{
                      fontSize: 12,
                      color: "rgba(246,245,238,0.55)",
                    }}
                  >
                    {s.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. PROOF */}
      <section id="sec-06" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32">
        <SectionHeader
          num="06"
          eyebrow="The Proof"
          heading="The proof."
          lede="From CCOs to CFOs, the operators standardizing on Dandy describe the same outcome in their own words."
        />

        {/* Featured quote */}
        <figure
          className="py-16"
          style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <span
            className="pe-display"
            style={{ fontSize: 72, color: ACCENT, lineHeight: 0.8, display: "inline-block" }}
            aria-hidden
          >
            “
          </span>
          <blockquote
            className="mt-4 italic"
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(28px, 3.2vw, 46px)",
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              color: INK,
              maxWidth: "22ch",
            }}
          >
            Dandy didn't just digitize our labs; they fundamentally changed our
            unit economics. We've eliminated scanner CAPEX entirely, reduced
            remakes to near-zero, and our doctors couldn't be happier. It's the
            most compelling ROI equation in dental right now.
          </blockquote>
          <figcaption
            className="mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1"
          >
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 14,
                color: INK,
              }}
            >
              Dr. Sarah Jenkins
            </span>
            <span
              className="pe-eyebrow"
              style={{ color: MUTED }}
            >
              Chief Clinical Officer · Summit Smile Group (42 offices)
            </span>
          </figcaption>
        </figure>

        {/* Secondary quotes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px mt-16" style={{ background: HAIRLINE }}>
          {SECONDARY_QUOTES.map((q) => (
            <div key={q.name} className="p-10" style={{ background: CREAM }}>
              <p
                className="italic"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(18px, 1.5vw, 22px)",
                  lineHeight: 1.4,
                  color: INK,
                  maxWidth: "34ch",
                }}
              >
                “{q.quote}”
              </p>
              <div className="mt-10 flex items-baseline gap-3">
                <span
                  style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, color: INK }}
                >
                  {q.name}
                </span>
                <span className="pe-eyebrow" style={{ color: MUTED }}>
                  {q.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. PLAN */}
      <section id="sec-07" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <SectionHeader
          num="07"
          eyebrow="Activation Plan"
          heading="The activation plan."
          lede="A derisked, systematic rollout — 90 days from pilot to scale."
        />

        {/* Timeline with connecting hairline */}
        <div className="relative">
          <div
            className="hidden md:block absolute left-0 right-0 top-6 h-px"
            style={{ background: INK }}
            aria-hidden
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 relative">
            {PLAN_STEPS.map((s) => (
              <div key={s.num} className="relative">
                <span
                  className="hidden md:block absolute left-0 -top-[3px] w-1.5 h-1.5 rounded-full"
                  style={{ background: INK }}
                  aria-hidden
                />
                <div className="pt-10">
                  <div
                    className="pe-eyebrow"
                    style={{ color: MUTED }}
                  >
                    {s.num} · {s.time}
                  </div>
                  <h3
                    className="mt-5"
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: "clamp(22px, 1.8vw, 28px)",
                      letterSpacing: "-0.01em",
                      color: INK,
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="mt-4 max-w-xs"
                    style={{ fontSize: 14, lineHeight: 1.55, color: MUTED }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA — dark band */}
      <section
        id="contact"
        className="py-32 lg:py-40"
        style={{ background: INK, color: CREAM }}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8">
              <div
                className="pe-eyebrow mb-8"
                style={{ color: ACCENT }}
              >
                Next Step
              </div>
              <h2
                className="pe-display"
                style={{
                  fontSize: "clamp(48px, 6vw, 88px)",
                  lineHeight: 1,
                  color: CREAM,
                  letterSpacing: "-0.025em",
                  maxWidth: "16ch",
                }}
              >
                Let's build the business case for PDS.
              </h2>
              <p
                className="mt-10 max-w-xl"
                style={{
                  fontSize: "clamp(16px, 1.2vw, 19px)",
                  lineHeight: 1.55,
                  color: "rgba(246,245,238,0.7)",
                }}
              >
                Schedule a 45-minute working session with our enterprise team to
                run your specific numbers through our ROI model.
              </p>
            </div>
            <div className="lg:col-span-4 flex lg:items-end lg:justify-end">
              <div className="flex flex-col items-start gap-6">
                <a
                  href="#contact"
                  className="pe-eyebrow"
                  style={{
                    background: ACCENT,
                    color: INK,
                    padding: "18px 32px",
                    fontSize: 12,
                  }}
                >
                  Schedule a working session →
                </a>
                <a
                  href="#download"
                  className="pe-link-underline"
                  style={{
                    fontFamily: SANS,
                    fontSize: 14,
                    color: "rgba(246,245,238,0.7)",
                  }}
                >
                  or download the one-pager
                </a>
              </div>
            </div>
          </div>

          {/* Footer hairline */}
          <div
            className="mt-24 pt-8 flex flex-wrap items-center justify-between gap-4"
            style={{ borderTop: `1px solid rgba(246,245,238,0.15)` }}
          >
            <span className="pe-eyebrow" style={{ color: "rgba(246,245,238,0.5)" }}>
              Dandy × Pacific Dental Services
            </span>
            <span className="pe-eyebrow" style={{ color: "rgba(246,245,238,0.5)" }}>
              Confidential · 2025
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
