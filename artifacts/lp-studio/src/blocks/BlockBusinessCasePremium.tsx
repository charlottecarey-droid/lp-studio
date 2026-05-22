import React from "react";
import type { BusinessCasePremiumBlockProps } from "../lib/block-types/dso-blocks";

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

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Situation", href: "#sec-01" },
  { label: "Signal", href: "#sec-02" },
  { label: "Math", href: "#sec-05" },
  { label: "Proof", href: "#sec-06" },
  { label: "Plan", href: "#sec-07" },
];

interface Props {
  props: BusinessCasePremiumBlockProps;
}

function SectionHeader({
  num,
  eyebrow,
  heading,
  lede,
  ink,
  muted,
  hairline,
}: {
  num: string;
  eyebrow?: string;
  heading: string;
  lede?: string;
  ink: string;
  muted: string;
  hairline: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-20">
      <div className="lg:col-span-4">
        <div className="flex items-baseline gap-5">
          <span
            className="text-sm tracking-[0.18em] uppercase"
            style={{ color: muted, fontFamily: SANS }}
          >
            {num}
          </span>
          <span className="h-px flex-1 max-w-[120px]" style={{ background: hairline }} aria-hidden />
        </div>
        {eyebrow && (
          <div
            className="mt-4 text-xs tracking-[0.22em] uppercase"
            style={{ color: ink, fontFamily: SANS, fontWeight: 600 }}
          >
            {eyebrow}
          </div>
        )}
      </div>
      <div className="lg:col-span-8">
        <h2
          className="leading-[1.02] tracking-[-0.01em]"
          style={{ fontFamily: DISPLAY, fontSize: "clamp(36px, 4.6vw, 64px)", color: ink }}
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
              color: muted,
            }}
          >
            {lede}
          </p>
        )}
      </div>
    </div>
  );
}

export function BlockBusinessCasePremium({ props }: Props) {
  const bg = props.bgColor || "#f6f5ee";
  const ink = props.inkColor || "#0d1f15";
  const dark = props.darkColor || "#0d1f15";
  const accent = props.accentColor || "#c8e84e";
  const accentInk = props.accentInkColor || "#0d1f15";
  const muted = "rgba(13,31,21,0.6)";
  const hairline = "rgba(13,31,21,0.12)";

  const brandText = props.logoAlt || "Dandy";
  const heroImageUrl = props.heroImageUrl;
  const kicker = props.kicker;
  const volumeLabel = props.volumeLabel || "Volume I";
  const issueLabel = props.issueLabel || "2025 · No. 01";
  const plateLabel = props.plateLabel || "Plate 01";
  const heroImageCaption = props.heroImageCaption || "Field study, Q1";

  const mathHeroEyebrow = props.mathHeroEyebrow || "Incremental Cases / Month";
  const mathHeroStat = props.mathHeroStat || "+185";
  const mathHeroDescription =
    props.mathHeroDescription ||
    "Estimated incremental restorative cases per month — the compounding effect of digital workflow, doctor retention, and zero-CAPEX scanner deployment.";

  const finalCtaEyebrow = props.finalCtaEyebrow || "Next Step";
  const footerLeftLabel = props.footerLeftLabel || "Dandy × Partners";
  const footerRightLabel = props.footerRightLabel || "Confidential · 2025";

  // Eyebrow class
  const eyebrowStyle: React.CSSProperties = {
    fontFamily: SANS,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 600,
    fontSize: 11,
  };

  return (
    <div style={{ background: bg, color: ink, fontFamily: SANS, minHeight: "100vh" }}>
      <style>{`
        .pe-display { font-family: ${DISPLAY}; letter-spacing: -0.015em; }
        .pe-num-xxl { font-family: ${DISPLAY}; font-size: clamp(72px, 9vw, 128px); line-height: 0.95; letter-spacing: -0.025em; }
        .pe-num-xl { font-family: ${DISPLAY}; font-size: clamp(56px, 6vw, 88px); line-height: 1; letter-spacing: -0.02em; }
        .pe-num-lg { font-family: ${DISPLAY}; font-size: clamp(40px, 4.2vw, 64px); line-height: 1; letter-spacing: -0.02em; }
        .pe-display-hero { font-family: ${DISPLAY}; font-size: clamp(56px, 7vw, 112px); line-height: 0.98; letter-spacing: -0.025em; font-weight: 500; }
        .pe-link-underline { position: relative; display: inline-flex; align-items: center; gap: 8px; }
        .pe-link-underline::after { content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 1px; background: currentColor; opacity: 0.4; }
        .pe-hero-image-card {
          background:
            radial-gradient(120% 80% at 30% 20%, rgba(200,232,78,0.18), transparent 60%),
            linear-gradient(160deg, #15321f 0%, #0d1f15 55%, #0a1810 100%);
        }
      `}</style>

      {/* Sticky dark top nav */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{ background: dark, color: bg, borderBottom: `1px solid rgba(246,245,238,0.08)` }}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="pe-display"
              style={{ fontSize: 22, color: bg, letterSpacing: "-0.02em" }}
            >
              {brandText}
            </span>
            {props.forCompanyLabel && (
              <span
                className="ml-3 hidden sm:inline-block"
                style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.55)", fontSize: 10 }}
              >
                × {props.forCompanyLabel.replace(/^For\s+/i, "")}
              </span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.7)" }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <a
            href={props.heroPrimaryCtaUrl || "#contact"}
            style={{
              ...eyebrowStyle,
              background: accent,
              color: accentInk,
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
            <div className="lg:col-span-7">
              {props.forCompanyLabel && (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 mb-10"
                  style={{ border: `1px solid ${hairline}`, borderRadius: 999 }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: accent }}
                  />
                  <span style={{ ...eyebrowStyle, color: ink }}>{props.forCompanyLabel}</span>
                </div>
              )}

              {kicker && (
                <div className="mb-6" style={{ ...eyebrowStyle, color: muted }}>
                  {kicker}
                </div>
              )}

              {props.heroEyebrow && (
                <div className="flex items-center gap-4 mb-8">
                  <span className="h-px w-10" style={{ background: ink }} />
                  <span style={{ ...eyebrowStyle, color: ink }}>{props.heroEyebrow}</span>
                </div>
              )}

              <h1 className="pe-display-hero" style={{ color: ink, maxWidth: "14ch" }}>
                {props.heroHeadline}
              </h1>

              <p
                className="mt-10 max-w-xl"
                style={{
                  fontSize: "clamp(17px, 1.3vw, 21px)",
                  lineHeight: 1.55,
                  color: muted,
                }}
              >
                {props.heroSubhead}
              </p>

              <div className="mt-12 flex flex-wrap items-center gap-8">
                <a
                  href={props.heroPrimaryCtaUrl}
                  style={{
                    ...eyebrowStyle,
                    background: accent,
                    color: accentInk,
                    padding: "16px 28px",
                    fontSize: 12,
                  }}
                >
                  {props.heroPrimaryCtaText} →
                </a>
                {props.heroSecondaryCtaText && (
                  <a
                    href={props.heroSecondaryCtaUrl}
                    className="pe-link-underline"
                    style={{ fontFamily: SANS, fontSize: 14, color: ink, fontWeight: 500 }}
                  >
                    {props.heroSecondaryCtaText}
                  </a>
                )}
              </div>
            </div>

            {/* Right: tall portrait image card */}
            <div className="lg:col-span-5">
              <div
                className="relative w-full overflow-hidden pe-hero-image-card"
                style={{ aspectRatio: "3 / 4", borderRadius: 2, border: `1px solid ${hairline}` }}
              >
                {heroImageUrl && (
                  <img
                    src={heroImageUrl}
                    alt={props.heroHeadline || "Hero"}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div
                  className="absolute left-4 right-4 bottom-4 flex items-center justify-between"
                  style={{ color: bg }}
                >
                  <span style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.85)" }}>
                    {heroImageCaption}
                  </span>
                  <span style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.55)" }}>
                    {plateLabel}
                  </span>
                </div>
                <div
                  className="absolute inset-3 pointer-events-none"
                  style={{ border: `1px solid rgba(246,245,238,0.15)` }}
                />
              </div>
              <div
                className="mt-4 flex items-baseline justify-between"
                style={{ ...eyebrowStyle, color: muted }}
              >
                <span>{volumeLabel}</span>
                <span>{issueLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div className="h-px" style={{ background: hairline }} />
        </div>
      </section>

      {/* TABLE OF CONTENTS */}
      <section>
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div
            className="flex items-center justify-between gap-6 py-6 overflow-x-auto"
            style={{ borderBottom: `1px solid ${hairline}` }}
          >
            <span style={{ ...eyebrowStyle, color: muted, whiteSpace: "nowrap" }}>Contents</span>
            <div className="flex items-center gap-7 lg:gap-10 whitespace-nowrap">
              {TOC.map((t, i) => (
                <a
                  key={t.num}
                  href={`#sec-${t.num}`}
                  className="flex items-baseline gap-2"
                  style={{ color: ink }}
                >
                  <span style={{ ...eyebrowStyle, color: muted, fontSize: 10 }}>{t.num}</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 15, letterSpacing: "-0.01em" }}>
                    {t.label}
                  </span>
                  {i < TOC.length - 1 && (
                    <span
                      className="ml-7 lg:ml-10 hidden md:inline-block"
                      style={{ color: muted, fontSize: 12 }}
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
          eyebrow={props.situationEyebrow || "The Situation"}
          heading={props.situationHeading}
          lede={props.situationBody}
          ink={ink}
          muted={muted}
          hairline={hairline}
        />

        {props.situationBodyExtra && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-4 lg:col-start-5">
              <p
                style={{
                  fontSize: "clamp(16px, 1.15vw, 18px)",
                  lineHeight: 1.65,
                  color: muted,
                }}
              >
                {props.situationBodyExtra}
              </p>
            </div>
          </div>
        )}

        <div
          className="mt-24 grid grid-cols-1 md:grid-cols-3"
          style={{ borderTop: `1px solid ${hairline}` }}
        >
          {props.situationStats.map((s, i) => (
            <div
              key={i}
              className="py-10 md:py-12 px-0 md:px-8 first:md:pl-0 last:md:pr-0"
              style={{
                borderRight:
                  i < props.situationStats.length - 1 ? `1px solid ${hairline}` : "none",
                borderBottom: `1px solid ${hairline}`,
              }}
            >
              <div className="pe-num-xl" style={{ color: ink }}>
                {s.value}
              </div>
              <div className="mt-6" style={{ ...eyebrowStyle, color: ink }}>
                {s.label}
              </div>
              {s.description && (
                <p
                  className="mt-3 max-w-xs"
                  style={{ fontSize: 14, lineHeight: 1.5, color: muted }}
                >
                  {s.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. SIGNAL */}
      <section
        id="sec-02"
        className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32"
        style={{ borderTop: `1px solid ${hairline}` }}
      >
        <SectionHeader
          num="02"
          eyebrow={props.signalEyebrow || "The Signal"}
          heading={props.signalHeading}
          ink={ink}
          muted={muted}
          hairline={hairline}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: hairline }}>
          {props.signalCards.map((card, i) => {
            if (card.attribution) {
              return (
                <div key={i} className="p-10 flex flex-col" style={{ background: bg }}>
                  <span
                    className="pe-display"
                    style={{ fontSize: 40, color: accent, lineHeight: 1 }}
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
                      color: ink,
                    }}
                  >
                    {card.body}
                  </p>
                  <div className="mt-auto pt-10" style={{ ...eyebrowStyle, color: muted }}>
                    {card.attribution}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="p-10" style={{ background: bg }}>
                {card.stat && (
                  <div className="pe-num-lg" style={{ color: ink }}>
                    {card.stat}
                  </div>
                )}
                <p
                  className="mt-8"
                  style={{ fontSize: 15, lineHeight: 1.55, color: muted, maxWidth: "28ch" }}
                >
                  {card.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. COST OF INACTION */}
      <section
        id="sec-03"
        className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32"
        style={{ borderTop: `1px solid ${hairline}` }}
      >
        <SectionHeader
          num="03"
          eyebrow={props.costEyebrow || "Cost of Inaction"}
          heading={props.costHeading}
          lede={props.costSubhead}
          ink={ink}
          muted={muted}
          hairline={hairline}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-20">
          {props.costItems.map((t, idx) => (
            <div key={idx} style={{ borderTop: `1px solid ${ink}` }} className="pt-8">
              <div className="flex items-start justify-between">
                <span style={{ ...eyebrowStyle, color: muted }}>
                  {t.num ?? String(idx + 1).padStart(2, "0")}
                </span>
                {t.label && (
                  <span style={{ ...eyebrowStyle, color: muted }}>{t.label}</span>
                )}
              </div>
              <div className="pe-num-xxl mt-8" style={{ color: ink }}>
                {t.stat}
              </div>
              {t.description && (
                <p
                  className="mt-8 max-w-md"
                  style={{ fontSize: 16, lineHeight: 1.55, color: muted }}
                >
                  {t.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. PARADIGM SHIFT */}
      <section
        id="sec-04"
        className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32"
        style={{ borderTop: `1px solid ${hairline}` }}
      >
        <SectionHeader
          num="04"
          eyebrow={props.shiftEyebrow || "Paradigm Shift"}
          heading={props.shiftHeading}
          ink={ink}
          muted={muted}
          hairline={hairline}
        />

        <div
          className="grid grid-cols-12 gap-6 pb-6"
          style={{ borderBottom: `1px solid ${ink}` }}
        >
          <div className="col-span-4" style={{ ...eyebrowStyle, color: ink }}>
            Category
          </div>
          <div className="col-span-4" style={{ ...eyebrowStyle, color: muted }}>
            Yesterday
          </div>
          <div className="col-span-4" style={{ ...eyebrowStyle, color: ink }}>
            With {brandText}
          </div>
        </div>

        {props.shiftRows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-6 py-7 items-baseline"
            style={{ borderBottom: `1px solid ${hairline}` }}
          >
            <div
              className="col-span-12 md:col-span-4"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(20px, 1.6vw, 24px)",
                letterSpacing: "-0.01em",
                color: ink,
              }}
            >
              {r.category}
            </div>
            <div
              className="col-span-12 md:col-span-4"
              style={{ fontSize: 16, lineHeight: 1.5, color: muted }}
            >
              {r.oldWay}
            </div>
            <div className="col-span-12 md:col-span-4 flex items-start gap-3">
              <span
                className="mt-2 inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: accent }}
                aria-hidden
              />
              <span style={{ fontSize: 16, lineHeight: 1.5, color: ink, fontWeight: 500 }}>
                {r.withDandy}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* 6. MATH — dark */}
      <section
        id="sec-05"
        className="py-32"
        style={{ background: dark, color: bg, borderTop: `1px solid ${hairline}` }}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-20">
            <div className="lg:col-span-4">
              <div className="flex items-baseline gap-5">
                <span style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.5)" }}>05</span>
                <span
                  className="h-px flex-1 max-w-[120px]"
                  style={{ background: "rgba(246,245,238,0.18)" }}
                />
              </div>
              {(props.mathEyebrow || "The Math") && (
                <div className="mt-4" style={{ ...eyebrowStyle, color: accent }}>
                  {props.mathEyebrow || "The Math"}
                </div>
              )}
            </div>
            <div className="lg:col-span-8">
              <h2
                className="pe-display"
                style={{ fontSize: "clamp(36px, 4.6vw, 64px)", color: bg, lineHeight: 1.02 }}
              >
                {props.mathHeading}
              </h2>
              {props.mathSubhead && (
                <p
                  className="mt-6 max-w-2xl"
                  style={{
                    fontSize: "clamp(16px, 1.2vw, 19px)",
                    lineHeight: 1.55,
                    color: "rgba(246,245,238,0.7)",
                  }}
                >
                  {props.mathSubhead}
                </p>
              )}
            </div>
          </div>

          {/* Hero stat */}
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end pb-16"
            style={{ borderBottom: `1px solid rgba(246,245,238,0.15)` }}
          >
            <div className="lg:col-span-7">
              <div style={{ ...eyebrowStyle, color: accent }}>{mathHeroEyebrow}</div>
              <div
                className="mt-4"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(120px, 18vw, 260px)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.035em",
                  color: bg,
                  fontWeight: 500,
                }}
              >
                {mathHeroStat}
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
                {mathHeroDescription}
              </p>
            </div>
          </div>

          {/* Supporting stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 mt-16">
            {props.mathStats.map((s, i) => (
              <div
                key={i}
                className="py-6 px-0 md:px-8 first:md:pl-0 last:md:pr-0"
                style={{
                  borderLeft: i > 0 ? `1px solid rgba(246,245,238,0.15)` : "none",
                }}
              >
                <div style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.55)" }}>{s.label}</div>
                <div
                  className="mt-5"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(36px, 3.5vw, 56px)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: accent,
                  }}
                >
                  {s.value}
                </div>
                {s.caption && (
                  <div className="mt-3" style={{ fontSize: 12, color: "rgba(246,245,238,0.55)" }}>
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
          eyebrow={props.proofEyebrow || "The Proof"}
          heading={props.proofHeading}
          ink={ink}
          muted={muted}
          hairline={hairline}
        />

        <figure
          className="py-16"
          style={{ borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}` }}
        >
          <span
            className="pe-display"
            style={{ fontSize: 72, color: accent, lineHeight: 0.8, display: "inline-block" }}
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
              color: ink,
              maxWidth: "22ch",
            }}
          >
            {props.proofFeatured.quote}
          </blockquote>
          <figcaption className="mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 14, color: ink }}>
              {props.proofFeatured.name}
            </span>
            <span style={{ ...eyebrowStyle, color: muted }}>{props.proofFeatured.title}</span>
          </figcaption>
        </figure>

        {props.proofSecondary.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-px mt-16"
            style={{ background: hairline }}
          >
            {props.proofSecondary.map((q, i) => (
              <div key={i} className="p-10" style={{ background: bg }}>
                <p
                  className="italic"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(18px, 1.5vw, 22px)",
                    lineHeight: 1.4,
                    color: ink,
                    maxWidth: "34ch",
                  }}
                >
                  “{q.quote}”
                </p>
                <div className="mt-10 flex items-baseline gap-3">
                  <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, color: ink }}>
                    {q.name}
                  </span>
                  <span style={{ ...eyebrowStyle, color: muted }}>{q.title}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 8. PLAN */}
      <section
        id="sec-07"
        className="max-w-[1280px] mx-auto px-6 lg:px-10 py-32"
        style={{ borderTop: `1px solid ${hairline}` }}
      >
        <SectionHeader
          num="07"
          eyebrow={props.planEyebrow || "Activation Plan"}
          heading={props.planHeading}
          lede={props.planSubhead}
          ink={ink}
          muted={muted}
          hairline={hairline}
        />

        <div className="relative">
          <div
            className="hidden md:block absolute left-0 right-0 top-6 h-px"
            style={{ background: ink }}
            aria-hidden
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 relative">
            {props.planSteps.map((s, i) => (
              <div key={i} className="relative">
                <span
                  className="hidden md:block absolute left-0 -top-[3px] w-1.5 h-1.5 rounded-full"
                  style={{ background: ink }}
                  aria-hidden
                />
                <div className="pt-10">
                  <div style={{ ...eyebrowStyle, color: muted }}>
                    {s.num} · {s.timeframe}
                  </div>
                  <h3
                    className="mt-5"
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: "clamp(22px, 1.8vw, 28px)",
                      letterSpacing: "-0.01em",
                      color: ink,
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="mt-4 max-w-xs"
                    style={{ fontSize: 14, lineHeight: 1.55, color: muted }}
                  >
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA — dark */}
      <section id="contact" className="py-32 lg:py-40" style={{ background: dark, color: bg }}>
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8">
              {finalCtaEyebrow && (
                <div className="mb-8" style={{ ...eyebrowStyle, color: accent }}>
                  {finalCtaEyebrow}
                </div>
              )}
              <h2
                className="pe-display"
                style={{
                  fontSize: "clamp(48px, 6vw, 88px)",
                  lineHeight: 1,
                  color: bg,
                  letterSpacing: "-0.025em",
                  maxWidth: "16ch",
                }}
              >
                {props.finalCtaHeading}
              </h2>
              <p
                className="mt-10 max-w-xl"
                style={{
                  fontSize: "clamp(16px, 1.2vw, 19px)",
                  lineHeight: 1.55,
                  color: "rgba(246,245,238,0.7)",
                }}
              >
                {props.finalCtaSubhead}
              </p>
            </div>
            <div className="lg:col-span-4 flex lg:items-end lg:justify-end">
              <div className="flex flex-col items-start gap-6">
                <a
                  href={props.finalCtaPrimaryUrl}
                  style={{
                    ...eyebrowStyle,
                    background: accent,
                    color: accentInk,
                    padding: "18px 32px",
                    fontSize: 12,
                  }}
                >
                  {props.finalCtaPrimaryText} →
                </a>
                {props.finalCtaSecondaryText && (
                  <a
                    href={props.finalCtaSecondaryUrl}
                    className="pe-link-underline"
                    style={{
                      fontFamily: SANS,
                      fontSize: 14,
                      color: "rgba(246,245,238,0.7)",
                    }}
                  >
                    {props.finalCtaSecondaryText}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div
            className="mt-24 pt-8 flex flex-wrap items-center justify-between gap-4"
            style={{ borderTop: `1px solid rgba(246,245,238,0.15)` }}
          >
            <span style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.5)" }}>
              {footerLeftLabel}
            </span>
            <span style={{ ...eyebrowStyle, color: "rgba(246,245,238,0.5)" }}>
              {footerRightLabel}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BlockBusinessCasePremium;
