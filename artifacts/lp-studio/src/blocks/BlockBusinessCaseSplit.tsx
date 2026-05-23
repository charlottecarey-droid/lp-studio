import React from "react";
import { ArrowRight, Check, Quote, Minus, TrendingUp, Users } from "lucide-react";
import type { BusinessCaseSplitBlockProps, BusinessCaseSignalCard } from "../lib/block-types/dso-blocks";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";
import type { BrandConfig } from "../lib/brand-config";
import { BrandLogo } from "../components/BrandLogo";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const SIGNAL_ICONS: Record<NonNullable<BusinessCaseSignalCard["icon"]>, React.FC<{ className?: string }>> = {
  "trending-up": TrendingUp,
  "users": Users,
  "quote": Quote,
};

interface Props {
  props: BusinessCaseSplitBlockProps;
  /** Tenant brand config. Drives default colors, fonts, logo, and the
   *  "With <brandName>" label so the same template renders correctly
   *  for any DSO. Per-block props still win. */
  brand?: BrandConfig;
}

export function BlockBusinessCaseSplit({ props, brand }: Props) {
  const bg = props.bgColor ?? brand?.pageBackground ?? "#f6f5ee";
  const ink = props.inkColor ?? brand?.primaryColor ?? "#0f2a1c";
  const dark = props.darkColor ?? brand?.primaryColor ?? "#0d1f15";
  const accent = props.accentColor ?? brand?.accentColor ?? "#c8e84e";
  const accentInk = props.accentInkColor ?? brand?.ctaText ?? "#0d1f15";

  const brandName = brand?.brandName?.trim() || "Dandy";
  const logoAlt = props.logoAlt || brandName;

  return (
    <div
      className="min-h-screen text-slate-800 font-sans"
      style={{ background: bg, fontFamily: BODY }}
    >
      {/* 1. Hero — split */}
      <section className="relative w-full h-[720px] flex overflow-hidden" style={{ background: dark }}>
        <div className="w-full md:w-[55%] h-full flex flex-col justify-between p-12 lg:p-20 z-10">
          <nav className="flex items-center justify-between">
            {brand ? (
              <BrandLogo brand={brand} url={props.logoUrl} alt={logoAlt} tone="onDark" className="h-7 w-auto" />
            ) : (
              <img src={props.logoUrl || "/dandy-logo-white.svg"} alt={logoAlt} className="h-7 w-auto" />
            )}
            <div className="px-4 py-1.5 rounded-full border border-white/20 text-white/80 text-xs font-medium uppercase tracking-wider">
              {props.forCompanyLabel}
            </div>
          </nav>

          <div className="max-w-2xl mt-12">
            {props.heroEyebrow && (
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px w-8" style={{ background: accent }} />
                <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: accent }}>
                  {props.heroEyebrow}
                </span>
              </div>
            )}
            <h1
              className="text-white text-5xl lg:text-6xl xl:text-7xl leading-[1.05] tracking-tight mb-8"
              style={{ fontFamily: DISPLAY }}
            >
              {props.heroHeadline}
            </h1>
            <p className="text-white/70 text-lg md:text-xl font-light leading-relaxed max-w-xl mb-12">
              {props.heroSubhead}
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <a
                href={props.heroPrimaryCtaUrl}
                className="px-8 py-4 text-sm font-semibold tracking-wide uppercase transition-colors duration-300 hover:opacity-90"
                style={{ background: accent, color: accentInk }}
              >
                {props.heroPrimaryCtaText}
              </a>
              <a
                href={props.heroSecondaryCtaUrl}
                className="text-white/70 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors"
              >
                {props.heroSecondaryCtaText} <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="hidden md:block w-[45%] h-full absolute right-0 top-0">
          {props.heroImageUrl && (
            <>
              <img
                src={props.heroImageUrl}
                alt=""
                className="w-full h-full object-cover object-center mix-blend-luminosity opacity-80"
              />
              <div className="absolute inset-0 mix-blend-overlay" style={{ background: `${dark}33` }} />
              <div
                className="absolute inset-y-0 left-0 w-32"
                style={{ background: `linear-gradient(to right, ${dark}, transparent)` }}
              />
            </>
          )}
        </div>
      </section>

      {/* 2. The Situation */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          {props.situationEyebrow && (
            <span className="text-black/40 text-xl italic" style={{ fontFamily: DISPLAY }}>
              {props.situationEyebrow}
            </span>
          )}
          <h2 className="text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.situationHeading}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5 space-y-6">
            <p className="text-xl leading-relaxed text-slate-700 font-light">{props.situationBody}</p>
            {props.situationBodyExtra && (
              <p className="text-xl leading-relaxed text-slate-700 font-light">{props.situationBodyExtra}</p>
            )}
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex flex-col justify-center gap-8">
            {props.situationStats.map((s, i) => (
              <div key={i} className="border-l-2 pl-6 py-1" style={{ borderColor: accent }}>
                <div className="text-3xl mb-2" style={{ color: ink, fontFamily: DISPLAY }}>{s.value}</div>
                <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. The Signal */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16 flex-wrap">
          {props.signalEyebrow && (
            <span className="text-black/40 text-xl italic" style={{ fontFamily: DISPLAY }}>
              {props.signalEyebrow}
            </span>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">THE SIGNAL</span>
            <ArrowRight className="w-4 h-4" style={{ color: accent }} />
            <span className="text-2xl md:text-3xl" style={{ color: ink, fontFamily: DISPLAY }}>
              {props.signalHeading}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {props.signalCards.map((card, i) => {
            if (card.attribution) {
              return (
                <div
                  key={i}
                  className="p-10 shadow-sm flex flex-col justify-between text-white relative overflow-hidden"
                  style={{ background: ink }}
                >
                  <div
                    className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4"
                    style={{ color: accent }}
                  >
                    <Quote className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <p
                      className="text-xl italic leading-snug mb-8 text-white/90"
                      style={{ fontFamily: DISPLAY }}
                    >
                      "{card.body}"
                    </p>
                    <div
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: accent }}
                    >
                      {card.attribution}
                    </div>
                  </div>
                </div>
              );
            }
            const Icon = SIGNAL_ICONS[card.icon ?? "trending-up"];
            return (
              <div key={i} className="bg-white p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="mb-6" style={{ color: accent }}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-4xl mb-4" style={{ color: ink, fontFamily: DISPLAY }}>{card.stat}</h3>
                  <p className="text-slate-600 leading-relaxed">{card.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. The Cost of Inaction */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          {props.costEyebrow && (
            <span className="text-black/40 text-xl italic" style={{ fontFamily: DISPLAY }}>
              {props.costEyebrow}
            </span>
          )}
          <h2 className="text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.costHeading}
          </h2>
        </div>
        {props.costSubhead && (
          <p className="text-lg text-slate-600 max-w-2xl mb-16 -mt-8">{props.costSubhead}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-16">
          {props.costItems.map((item, i) => (
            <div key={i}>
              <div
                className="text-5xl mb-4 border-b-2 border-black/5 pb-4"
                style={{ color: ink, fontFamily: DISPLAY }}
              >
                {item.stat}
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">{item.label}</h4>
              <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. The Paradigm Shift — split bullets */}
      <section className="px-12 lg:px-20 py-24 lg:py-32" style={{ background: dark }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-20">
            {props.shiftEyebrow && (
              <span className="text-white/30 text-xl italic" style={{ fontFamily: DISPLAY }}>
                {props.shiftEyebrow}
              </span>
            )}
            <h2 className="text-white text-4xl lg:text-5xl" style={{ fontFamily: DISPLAY }}>
              {props.shiftHeading}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            <div className="pb-16 lg:pb-0 lg:pr-16">
              <h3 className="text-white/50 text-sm font-bold tracking-[0.2em] uppercase mb-12 flex items-center gap-3">
                <Minus className="w-4 h-4" /> The Old Way
              </h3>
              <ul className="space-y-10">
                {props.shiftOldBullets.map((b, i) => (
                  <li key={i}>
                    <div className="text-white/80 font-medium mb-2">{b.title}</div>
                    <div className="text-white/40 text-sm">{b.body}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-16 lg:pt-0 lg:pl-16">
              <h3
                className="text-sm font-bold tracking-[0.2em] uppercase mb-12 flex items-center gap-3"
                style={{ color: accent }}
              >
                <Check className="w-4 h-4" /> With {brandName}
              </h3>
              <ul className="space-y-10">
                {props.shiftNewBullets.map((b, i) => (
                  <li key={i}>
                    <div className="text-white font-medium mb-2 text-lg">{b.title}</div>
                    <div className="text-white/70 text-sm">{b.body}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. The Math */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center justify-between mb-16 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {props.mathEyebrow && (
              <span className="text-black/40 text-xl italic" style={{ fontFamily: DISPLAY }}>
                {props.mathEyebrow}
              </span>
            )}
            <h2 className="text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }}>
              {props.mathHeading}
            </h2>
          </div>
          <p className="text-slate-500 text-sm italic">{props.mathSubhead}</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm p-8 lg:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 border-b border-slate-100 pb-12">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Number of Offices
              </label>
              <div
                className="text-2xl border-b border-slate-300 pb-2"
                style={{ color: ink, fontFamily: DISPLAY }}
              >
                {props.mathOfficeCount}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {props.mathVolumeLabel}
              </label>
              <div
                className="text-2xl border-b border-slate-300 pb-2"
                style={{ color: ink, fontFamily: DISPLAY }}
              >
                {props.mathVolumeValue}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {props.mathStats.map((s, i) => {
              const isLast = i === props.mathStats.length - 1;
              return (
                <div
                  key={i}
                  className="p-6"
                  style={{
                    // Alternating row bg: slight ink-tint of the page bg
                    // so the table stripe darkens with brand instead of
                    // locking to Dandy's cream.
                    background: isLast ? dark : `color-mix(in srgb, ${ink} 5%, ${bg})`,
                    color: isLast ? "#fff" : undefined,
                  }}
                >
                  <div
                    className="text-sm font-bold uppercase tracking-wider mb-4"
                    style={{ color: isLast ? accent : "#475569" }}
                  >
                    {s.label}
                  </div>
                  <div className="text-3xl mb-2" style={{ color: isLast ? "#fff" : ink, fontFamily: DISPLAY }}>
                    {s.value}
                  </div>
                  {s.caption && (
                    <p className="text-xs" style={{ color: isLast ? "rgba(255,255,255,0.7)" : "#64748b" }}>
                      {s.caption}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. The Proof */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto border-b border-black/10">
        <div className="flex items-center gap-4 mb-16">
          {props.proofEyebrow && (
            <span className="text-black/40 text-xl italic" style={{ fontFamily: DISPLAY }}>
              {props.proofEyebrow}
            </span>
          )}
          <h2 className="text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.proofHeading}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            <Quote className="w-12 h-12 mb-8" style={{ color: accent }} />
            <h3
              className="text-3xl lg:text-4xl leading-tight mb-8"
              style={{ color: ink, fontFamily: DISPLAY }}
            >
              "{props.proofFeatured.quote}"
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-full h-full bg-slate-300" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{props.proofFeatured.name}</div>
                <div className="text-slate-500 text-xs">{props.proofFeatured.title}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-12 lg:border-l lg:border-slate-200 lg:pl-12">
            {props.proofSecondary.map((t, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="w-12 h-px bg-slate-200" />}
                <div>
                  <p
                    className="text-lg italic leading-relaxed mb-6"
                    style={{ color: ink, fontFamily: DISPLAY }}
                  >
                    "{t.quote}"
                  </p>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                    <div className="text-slate-500 text-xs">{t.title}</div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* 8. The Plan */}
      <section className="px-12 lg:px-20 py-24 lg:py-32 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-20">
          {props.planEyebrow && (
            <span className="text-black/40 text-xl italic" style={{ fontFamily: DISPLAY }}>
              {props.planEyebrow}
            </span>
          )}
          <h2 className="text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.planHeading}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
          <div className="hidden lg:block absolute top-6 left-6 right-6 h-px bg-slate-200 z-0" />
          {props.planSteps.map((step, i) => (
            <div key={i} className="relative z-10">
              <div
                className="w-12 h-12 border-2 rounded-full flex items-center justify-center text-xl mb-6"
                style={{ background: bg, borderColor: ink, color: ink, fontFamily: DISPLAY }}
              >
                {step.num}
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">{step.title}</h4>
              <div
                className="text-xs font-bold inline-block px-2 py-1 mb-4"
                style={{ color: accent, background: dark }}
              >
                {step.timeframe}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="py-24 lg:py-32 px-12 lg:px-20 text-center" style={{ background: dark }}>
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <div className="w-16 h-1 mb-12" style={{ background: accent }} />
          <h2
            className="text-white text-4xl lg:text-6xl leading-tight mb-8"
            style={{ fontFamily: DISPLAY }}
          >
            {props.finalCtaHeading}
          </h2>
          <p className="text-white/70 text-lg lg:text-xl font-light mb-12 max-w-xl">
            {props.finalCtaSubhead}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <a
              href={props.finalCtaPrimaryUrl}
              className="px-10 py-5 text-sm font-bold tracking-wide uppercase transition-colors duration-300 w-full sm:w-auto hover:opacity-90"
              style={{ background: accent, color: accentInk }}
            >
              {props.finalCtaPrimaryText}
            </a>
            <a
              href={props.finalCtaSecondaryUrl}
              className="text-white/60 hover:text-white text-sm font-medium transition-colors underline underline-offset-4"
            >
              {props.finalCtaSecondaryText}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BlockBusinessCaseSplit;
