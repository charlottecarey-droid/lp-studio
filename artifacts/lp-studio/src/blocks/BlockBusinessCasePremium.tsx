import React from "react";
import { ArrowRight, Check, Quote, Minus, Activity, Clock, LayoutGrid, Inbox } from "lucide-react";
import type { BusinessCasePremiumBlockProps } from "../lib/block-types/dso-blocks";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const SITUATION_ICONS = [Inbox, Activity, LayoutGrid, Clock];

interface Props {
  props: BusinessCasePremiumBlockProps;
}

/**
 * Premium Editorial — visually mirrors the Centered Business Case template
 * but seeded with PDS-style content (inbound demand → clinical challenges →
 * operational layer → insights → math → proof → plan → CTA).
 *
 * Renders up to 4 situationStats and signalCards so it can express richer
 * PDS-style content while remaining prop-compatible with the rest of the
 * Business Case family.
 */
export function BlockBusinessCasePremium({ props }: Props) {
  const bg = props.bgColor ?? "#f6f5ee";
  const ink = props.inkColor ?? "#0d1f15";
  const dark = props.darkColor ?? "#0d1f15";
  const accent = props.accentColor ?? "#c8e84e";
  const accentInk = props.accentInkColor ?? "#0d1f15";

  const logoSrc = props.logoUrl || "/dandy-logo-white.svg";
  const logoAlt = props.logoAlt || "Dandy";

  const heroStats = (props.situationStats ?? []).slice(0, 4);

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{ background: bg, color: ink, fontFamily: BODY }}
    >
      {/* 1. Hero — centered, dark, with inline KPI strip */}
      <section
        className="relative flex flex-col justify-center items-center text-center px-6 py-20 min-h-[760px] overflow-hidden"
        style={{ background: dark, color: bg }}
      >
        <div className="absolute top-0 w-full p-6 flex justify-between items-center max-w-7xl mx-auto">
          <img src={logoSrc} alt={logoAlt} className="h-7 w-auto" />
          <div
            className="text-xs uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full"
            style={{ color: accent, fontFamily: BODY }}
          >
            {props.forCompanyLabel}
          </div>
        </div>

        <div className="max-w-4xl mx-auto flex flex-col items-center z-10 mt-16">
          {props.heroEyebrow && (
            <>
              <div className="w-12 h-[2px] mb-8" style={{ background: accent }} />
              <h2
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-6"
                style={{ color: accent, fontFamily: BODY }}
              >
                {props.heroEyebrow}
              </h2>
            </>
          )}
          <h1
            className="text-5xl md:text-7xl font-medium leading-[1.1] mb-8 max-w-4xl"
            style={{ fontFamily: DISPLAY }}
          >
            {props.heroHeadline}
          </h1>
          <p
            className="text-lg md:text-xl max-w-2xl mb-12 font-light"
            style={{ color: `${bg}b0`, fontFamily: BODY }}
          >
            {props.heroSubhead}
          </p>
          <div className="flex flex-col items-center gap-6">
            <a
              href={props.heroPrimaryCtaUrl}
              className="px-8 py-4 rounded-none font-medium transition-colors flex items-center gap-2 text-sm uppercase tracking-wider hover:opacity-90"
              style={{ background: accent, color: accentInk, fontFamily: BODY }}
            >
              {props.heroPrimaryCtaText} <ArrowRight className="w-4 h-4" />
            </a>
            {props.heroSecondaryCtaText && (
              <a
                href={props.heroSecondaryCtaUrl}
                className="transition-colors text-sm underline underline-offset-4"
                style={{ color: `${bg}80`, fontFamily: BODY }}
              >
                {props.heroSecondaryCtaText} →
              </a>
            )}
          </div>

          {heroStats.length > 0 && (
            <div
              className="mt-16 pt-10 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-left border-t"
              style={{ borderColor: `${bg}22` }}
            >
              {heroStats.map((s, i) => (
                <div key={i}>
                  <div
                    className="text-3xl md:text-4xl mb-2"
                    style={{ color: accent, fontFamily: DISPLAY }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="text-xs font-semibold tracking-widest uppercase"
                    style={{ color: `${bg}b0`, fontFamily: BODY }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. Situation / Demand — light, headline + lede + KPI cards */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            {props.situationEyebrow && (
              <div
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-gray-500"
                style={{ fontFamily: BODY }}
              >
                {props.situationEyebrow}
              </div>
            )}
            <h2 className="text-4xl mb-6" style={{ color: ink, fontFamily: DISPLAY }}>
              {props.situationHeading}
            </h2>
            <p
              className="text-lg text-gray-700 leading-relaxed mb-6"
              style={{ fontFamily: BODY }}
            >
              {props.situationBody}
            </p>
            {props.situationBodyExtra && (
              <p
                className="text-lg text-gray-700 leading-relaxed"
                style={{ fontFamily: BODY }}
              >
                {props.situationBodyExtra}
              </p>
            )}
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {heroStats.map((s, i) => {
              const Icon = SITUATION_ICONS[i] ?? Activity;
              return (
                <div
                  key={i}
                  className="bg-white p-8 border border-gray-200 flex flex-col justify-between"
                >
                  <div>
                    <Icon className="w-6 h-6 mb-4" style={{ color: accent }} />
                    <div
                      className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-2"
                      style={{ fontFamily: BODY }}
                    >
                      {s.label}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-3xl mb-2"
                      style={{ color: ink, fontFamily: DISPLAY }}
                    >
                      {s.value}
                    </div>
                    {s.description && (
                      <div
                        className="text-sm text-gray-600"
                        style={{ fontFamily: BODY }}
                      >
                        {s.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <hr className="border-t border-black/10 max-w-7xl mx-auto" />

      {/* 3. Signal / Clinical challenges — dark slab grid */}
      <section
        className="py-24 px-6 lg:px-16 max-w-7xl mx-auto my-24"
        style={{ background: "#0f2a1c", color: bg }}
      >
        <div className="mb-16">
          {props.signalEyebrow && (
            <h2
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: accent, fontFamily: BODY }}
            >
              {props.signalEyebrow} →
            </h2>
          )}
          <h3
            className="text-4xl md:text-5xl max-w-3xl leading-tight"
            style={{ fontFamily: DISPLAY }}
          >
            {props.signalHeading}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {props.signalCards.map((card, i) => {
            if (card.attribution) {
              return (
                <div key={i} className="border border-white/20 p-8 bg-white/5 relative">
                  <Quote
                    className="w-8 h-8 absolute top-6 left-6"
                    style={{ color: `${accent}4d` }}
                  />
                  <p
                    className="text-lg italic relative z-10 pt-4 mb-6"
                    style={{ fontFamily: DISPLAY }}
                  >
                    "{card.body}"
                  </p>
                  <div
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: accent, fontFamily: BODY }}
                  >
                    {card.attribution}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="border border-white/20 p-8">
                {card.stat && (
                  <div
                    className="text-4xl mb-4"
                    style={{ color: accent, fontFamily: DISPLAY }}
                  >
                    {card.stat}
                  </div>
                )}
                <p className="text-lg" style={{ fontFamily: BODY }}>{card.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Cost / Operational layer */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          {props.costEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-gray-500"
              style={{ fontFamily: BODY }}
            >
              {props.costEyebrow}
            </div>
          )}
          <h2 className="text-4xl mb-6" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.costHeading}
          </h2>
          {props.costSubhead && (
            <p
              className="text-xl text-gray-600 max-w-2xl mx-auto"
              style={{ fontFamily: BODY }}
            >
              {props.costSubhead}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {props.costItems.map((item, idx) => (
            <div
              key={idx}
              className="relative pt-12 border-t-2"
              style={{ borderColor: ink }}
            >
              <div
                className="absolute top-0 left-0 -mt-[14px] pr-4 text-xl text-gray-400 italic"
                style={{ background: bg, fontFamily: DISPLAY }}
              >
                {item.num ?? String(idx + 1).padStart(2, "0")}
              </div>
              <div className="text-5xl mb-2" style={{ color: ink, fontFamily: DISPLAY }}>
                {item.stat}
              </div>
              <div
                className="font-semibold text-sm tracking-wider uppercase mb-3 text-gray-500"
                style={{ fontFamily: BODY }}
              >
                {item.label}
              </div>
              <p className="text-gray-600" style={{ fontFamily: BODY }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Shift / "See everything" — comparison table */}
      <section className="py-24 bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            {props.shiftEyebrow && (
              <div
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-gray-500"
                style={{ fontFamily: BODY }}
              >
                {props.shiftEyebrow}
              </div>
            )}
            <h2 className="text-4xl" style={{ color: ink, fontFamily: DISPLAY }}>
              {props.shiftHeading}
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-8 mb-8 border-b border-gray-200 pb-4">
            <div
              className="col-span-4 font-semibold text-sm uppercase tracking-wider text-gray-400"
              style={{ fontFamily: BODY }}
            >
              Category
            </div>
            <div
              className="col-span-4 font-semibold text-sm uppercase tracking-wider text-gray-400"
              style={{ fontFamily: BODY }}
            >
              Before Dandy
            </div>
            <div
              className="col-span-4 font-semibold text-sm uppercase tracking-wider"
              style={{ color: ink, fontFamily: BODY }}
            >
              With Dandy
            </div>
          </div>

          {props.shiftRows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 py-6 border-b border-gray-100 last:border-0 items-center"
            >
              <div
                className="col-span-1 md:col-span-4 text-xl"
                style={{ color: ink, fontFamily: DISPLAY }}
              >
                {row.category}
              </div>
              <div
                className="col-span-1 md:col-span-4 text-gray-500 flex items-start gap-2"
                style={{ fontFamily: BODY }}
              >
                <Minus className="w-4 h-4 mt-1 shrink-0" /> {row.oldWay}
              </div>
              <div
                className="col-span-1 md:col-span-4 p-4 border-l-4 font-medium flex items-start gap-2"
                style={{ background: bg, borderColor: accent, color: ink, fontFamily: BODY }}
              >
                <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: accent }} /> {row.withDandy}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Math */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          {props.mathEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-gray-500"
              style={{ fontFamily: BODY }}
            >
              {props.mathEyebrow}
            </div>
          )}
          <h2 className="text-4xl mb-4" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.mathHeading}
          </h2>
          <p className="text-xl text-gray-600" style={{ fontFamily: BODY }}>
            {props.mathSubhead}
          </p>
        </div>

        <div className="p-8 md:p-12" style={{ background: dark, color: bg }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 pb-12 border-b border-white/20">
            <div>
              <label
                className="block text-xs uppercase tracking-widest mb-2"
                style={{ color: accent, fontFamily: BODY }}
              >
                Number of Offices
              </label>
              <div
                className="text-3xl border-b border-white/30 pb-2"
                style={{ fontFamily: DISPLAY }}
              >
                {props.mathOfficeCount}
              </div>
            </div>
            <div>
              <label
                className="block text-xs uppercase tracking-widest mb-2"
                style={{ color: accent, fontFamily: BODY }}
              >
                {props.mathVolumeLabel}
              </label>
              <div
                className="text-3xl border-b border-white/30 pb-2"
                style={{ fontFamily: DISPLAY }}
              >
                {props.mathVolumeValue}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {props.mathStats.map((s, i) => (
              <div key={i}>
                <div
                  className="text-gray-400 text-sm mb-2"
                  style={{ fontFamily: BODY }}
                >
                  {s.label}
                </div>
                <div
                  className="text-4xl"
                  style={{ color: accent, fontFamily: DISPLAY }}
                >
                  {s.value}
                </div>
                {s.caption && (
                  <div
                    className="text-xs mt-1 text-gray-500"
                    style={{ fontFamily: BODY }}
                  >
                    {s.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Proof */}
      <section className="py-24 px-6" style={{ background: "#eae8dd" }}>
        <div className="max-w-7xl mx-auto">
          {props.proofEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-gray-500 text-center"
              style={{ fontFamily: BODY }}
            >
              {props.proofEyebrow}
            </div>
          )}
          <h2
            className="text-4xl mb-16 text-center"
            style={{ color: ink, fontFamily: DISPLAY }}
          >
            {props.proofHeading}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div
              className="md:col-span-7 bg-white p-10 md:p-16 border-t-4"
              style={{ borderColor: accent }}
            >
              <Quote className="w-12 h-12 text-gray-200 mb-6" />
              <p
                className="text-2xl md:text-3xl leading-relaxed mb-8"
                style={{ color: ink, fontFamily: DISPLAY }}
              >
                "{props.proofFeatured.quote}"
              </p>
              <div>
                <div
                  className="font-semibold text-lg"
                  style={{ fontFamily: BODY }}
                >
                  {props.proofFeatured.name}
                </div>
                <div className="text-gray-500" style={{ fontFamily: BODY }}>
                  {props.proofFeatured.title}
                </div>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col gap-8">
              {props.proofSecondary.map((t, i) => (
                <div key={i} className="bg-white p-8">
                  <p
                    className="text-xl italic text-gray-700 mb-6"
                    style={{ fontFamily: DISPLAY }}
                  >
                    "{t.quote}"
                  </p>
                  <div>
                    <div
                      className="font-semibold text-sm"
                      style={{ fontFamily: BODY }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="text-xs text-gray-500"
                      style={{ fontFamily: BODY }}
                    >
                      {t.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Plan */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="mb-16">
          {props.planEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-gray-500"
              style={{ fontFamily: BODY }}
            >
              {props.planEyebrow}
            </div>
          )}
          <h2 className="text-4xl mb-4" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.planHeading}
          </h2>
          {props.planSubhead && (
            <p className="text-xl text-gray-600" style={{ fontFamily: BODY }}>
              {props.planSubhead}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {props.planSteps.map((step, i) => (
            <div key={i} className="relative">
              <div
                className="text-7xl font-bold opacity-30 mb-4"
                style={{ color: accent, fontFamily: DISPLAY }}
              >
                {step.num}
              </div>
              <h4 className="font-bold text-lg mb-2" style={{ fontFamily: BODY }}>
                {step.title}
              </h4>
              <p
                className="text-gray-600 text-sm mb-4 min-h-[60px]"
                style={{ fontFamily: BODY }}
              >
                {step.description}
              </p>
              <div
                className="text-xs uppercase tracking-widest font-semibold border-t border-gray-200 pt-4"
                style={{ fontFamily: BODY }}
              >
                {step.timeframe}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="text-center py-32 px-6" style={{ background: dark }}>
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          {props.finalCtaEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-6"
              style={{ color: accent, fontFamily: BODY }}
            >
              {props.finalCtaEyebrow}
            </div>
          )}
          <h2
            className="text-4xl md:text-6xl mb-6 leading-tight"
            style={{ color: bg, fontFamily: DISPLAY }}
          >
            {props.finalCtaHeading}
          </h2>
          <p
            className="text-lg mb-10"
            style={{ color: `${bg}b0`, fontFamily: BODY }}
          >
            {props.finalCtaSubhead}
          </p>
          <div className="flex flex-col items-center gap-6">
            <a
              href={props.finalCtaPrimaryUrl}
              className="px-8 py-4 rounded-none font-medium transition-colors flex items-center gap-2 text-sm uppercase tracking-wider hover:opacity-90"
              style={{ background: accent, color: accentInk, fontFamily: BODY }}
            >
              {props.finalCtaPrimaryText} <ArrowRight className="w-4 h-4" />
            </a>
            {props.finalCtaSecondaryText && (
              <a
                href={props.finalCtaSecondaryUrl}
                className="transition-colors text-sm underline underline-offset-4"
                style={{ color: `${bg}80`, fontFamily: BODY }}
              >
                {props.finalCtaSecondaryText}
              </a>
            )}
          </div>
        </div>

        {(props.footerLeftLabel || props.footerRightLabel) && (
          <div
            className="max-w-7xl mx-auto mt-24 pt-6 border-t flex justify-between text-xs uppercase tracking-widest"
            style={{ borderColor: `${bg}22`, color: `${bg}66`, fontFamily: BODY }}
          >
            <span>{props.footerLeftLabel}</span>
            <span>{props.footerRightLabel}</span>
          </div>
        )}
      </section>
    </div>
  );
}

export default BlockBusinessCasePremium;
