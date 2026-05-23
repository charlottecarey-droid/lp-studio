import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Quote, X as XIcon, Activity, Clock, LayoutGrid, Inbox } from "lucide-react";
import type { BusinessCasePremiumBlockProps } from "../lib/block-types/dso-blocks";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const SITUATION_ICONS = [Inbox, Activity, LayoutGrid, Clock];

const FOCUS_MAP: Record<NonNullable<BusinessCasePremiumBlockProps["heroImageFocus"]>, string> = {
  center: "center",
  top: "center top",
  bottom: "center bottom",
  left: "left center",
  right: "right center",
  "top-left": "left top",
  "top-right": "right top",
  "bottom-left": "left bottom",
  "bottom-right": "right bottom",
};

/** Tasteful scroll-reveal wrapper. Fades and lifts content into view once,
 *  honoring reduced-motion preference (framer-motion handles this). */
const Reveal: React.FC<
  React.PropsWithChildren<{ delay?: number; y?: number; className?: string }>
> = ({ children, delay = 0, y = 24, className }) => (
  <motion.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

interface Props {
  props: BusinessCasePremiumBlockProps;
}

/**
 * Premium Editorial — DSO business case block with two hero variants:
 *   - "centered" (default for legacy pages): full-bleed dark centered hero
 *   - "split-image-right": dark left column with the offer + full-bleed
 *     image on the right column with editorial overlays (plate label,
 *     caption). Falls back to a sophisticated gradient panel when no
 *     heroImageUrl is supplied.
 *
 * Renders previously-unused editorial chrome (kicker, volumeLabel,
 * issueLabel, plateLabel, heroImageCaption, mathHeroEyebrow/Stat/Description)
 * and an upgraded comparison table (zebra rows, dark "With Dandy" pillar,
 * stronger ink contrast).
 */
export function BlockBusinessCasePremium({ props }: Props) {
  const bg = props.bgColor ?? "#f6f5ee";
  const ink = props.inkColor ?? "#0d1f15";
  const dark = props.darkColor ?? "#0d1f15";
  const accent = props.accentColor ?? "#c8e84e";
  const accentInk = props.accentInkColor ?? "#0d1f15";
  const tableAccent = props.tableAccentColor ?? dark;

  const logoSrc = props.logoUrl || "/dandy-logo-white.svg";
  const logoAlt = props.logoAlt || "Dandy";

  const heroStats = (props.situationStats ?? []).slice(0, 4);
  const useSplitHero = (props.heroLayout ?? "centered") === "split-image-right";
  const forPillMode = props.forPillMode ?? "pill";
  const heroFocus = FOCUS_MAP[props.heroImageFocus ?? "center"];

  const renderForPill = () => {
    if (forPillMode === "hidden") return null;
    if (forPillMode === "logo" && props.forPillLogoUrl) {
      return (
        <img
          src={props.forPillLogoUrl}
          alt={props.forPillLogoAlt || ""}
          className="h-7 w-auto max-w-[180px] object-contain"
        />
      );
    }
    if (forPillMode === "cta" && props.forPillCtaText) {
      return (
        <a
          href={props.forPillCtaUrl || "#"}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-90"
          style={{ background: accent, color: accentInk, fontFamily: BODY }}
        >
          {props.forPillCtaText}
          <ArrowRight className="w-3 h-3" />
        </a>
      );
    }
    // default "pill"
    if (!props.forCompanyLabel) return null;
    return (
      <div
        className="text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1.5 rounded-full"
        style={{ background: `${accent}1f`, color: accent, fontFamily: BODY }}
      >
        {props.forCompanyLabel}
      </div>
    );
  };

  const renderHeaderBar = () => (
    <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center gap-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-6">
        <img src={logoSrc} alt={logoAlt} className="h-7 w-auto" />
        {(props.volumeLabel || props.issueLabel) && (
          <div
            className="hidden md:flex items-center gap-3 text-[10px] font-semibold tracking-[0.3em] uppercase"
            style={{ color: `${bg}80`, fontFamily: BODY }}
          >
            {props.volumeLabel && <span>{props.volumeLabel}</span>}
            {props.volumeLabel && props.issueLabel && (
              <span className="w-4 h-px" style={{ background: `${bg}33` }} />
            )}
            {props.issueLabel && <span>{props.issueLabel}</span>}
          </div>
        )}
      </div>
      {renderForPill()}
    </div>
  );

  const renderHeroTextCol = (align: "left" | "center") => (
    <div
      className={
        "flex flex-col z-10 " +
        (align === "center"
          ? "items-center text-center max-w-4xl mx-auto"
          : "items-start text-left max-w-xl")
      }
    >
      {props.kicker && (
        <div
          className="flex items-center gap-3 mb-8 text-[10px] font-semibold tracking-[0.3em] uppercase"
          style={{ color: `${bg}99`, fontFamily: BODY }}
        >
          <span className="w-8 h-px" style={{ background: accent }} />
          <span>{props.kicker}</span>
        </div>
      )}
      {props.heroEyebrow && (
        <>
          {!props.kicker && <div className="w-12 h-[2px] mb-8" style={{ background: accent }} />}
          <h2
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-6"
            style={{ color: accent, fontFamily: BODY }}
          >
            {props.heroEyebrow}
          </h2>
        </>
      )}
      <h1
        className={
          "font-medium leading-[1.05] mb-8 " +
          (align === "center"
            ? "text-5xl md:text-7xl max-w-4xl"
            : "text-5xl md:text-6xl xl:text-7xl")
        }
        style={{ fontFamily: DISPLAY }}
      >
        {props.heroHeadline}
      </h1>
      <p
        className={
          "text-lg md:text-xl font-light mb-12 " +
          (align === "center" ? "max-w-2xl" : "max-w-lg")
        }
        style={{ color: `${bg}b0`, fontFamily: BODY }}
      >
        {props.heroSubhead}
      </p>
      <div
        className={
          "flex flex-col gap-6 " + (align === "center" ? "items-center" : "items-start")
        }
      >
        <a
          href={props.heroPrimaryCtaUrl}
          className="group px-8 py-4 rounded-none font-medium transition-all duration-300 flex items-center gap-2 text-sm uppercase tracking-wider hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: accent, color: accentInk, fontFamily: BODY }}
        >
          {props.heroPrimaryCtaText}
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
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
    </div>
  );

  // Image column for split-image-right hero. Falls back to a sophisticated
  // dark gradient + diagonal hatch + accent rail when no image is supplied.
  const renderHeroImageCol = () => (
    <div className="group relative w-full h-full min-h-[420px] lg:min-h-[760px] overflow-hidden">
      {props.heroImageUrl ? (
        <>
          <img
            src={props.heroImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
            style={{ objectPosition: heroFocus }}
            loading="lazy"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, ${dark}33 0%, transparent 30%, transparent 60%, ${dark}cc 100%)`,
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${accent}1f 0%, transparent 55%), linear-gradient(135deg, ${dark} 0%, #15321f 100%)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, ${bg} 0, ${bg} 1px, transparent 1px, transparent 14px)`,
            }}
          />
          <div
            className="absolute right-0 top-1/4 bottom-1/4 w-1"
            style={{ background: accent }}
          />
        </div>
      )}

      {props.plateLabel && (
        <div
          className="absolute top-8 right-8 z-10 text-[10px] font-semibold tracking-[0.3em] uppercase px-3 py-1.5"
          style={{ color: accent, background: `${dark}cc`, fontFamily: BODY }}
        >
          {props.plateLabel}
        </div>
      )}

      {props.heroImageCaption && (
        <div className="absolute bottom-8 left-8 right-8 z-10">
          <div className="w-8 h-px mb-3" style={{ background: accent }} />
          <p
            className="text-sm md:text-base leading-snug font-light max-w-md"
            style={{ color: bg, fontFamily: BODY }}
          >
            {props.heroImageCaption}
          </p>
        </div>
      )}
    </div>
  );

  const renderHeroStatsStrip = (variant: "split" | "centered") => {
    if (heroStats.length === 0) return null;
    if (variant === "centered") {
      return (
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
                className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                style={{ color: `${bg}b0`, fontFamily: BODY }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="border-t" style={{ borderColor: `${bg}1a` }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {heroStats.map((s, i) => (
            <div key={i}>
              <div
                className="text-3xl md:text-4xl mb-2"
                style={{ color: accent, fontFamily: DISPLAY }}
              >
                {s.value}
              </div>
              <div
                className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                style={{ color: `${bg}b0`, fontFamily: BODY }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{ background: bg, color: ink, fontFamily: BODY }}
    >
      {/* 1. Hero */}
      {useSplitHero ? (
        <section className="relative overflow-hidden" style={{ background: dark, color: bg }}>
          {renderHeaderBar()}
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[760px]">
            <div className="flex items-center px-6 py-24 lg:px-16 lg:py-32 xl:pl-24">
              {renderHeroTextCol("left")}
            </div>
            <div className="relative">{renderHeroImageCol()}</div>
          </div>
          {renderHeroStatsStrip("split")}
        </section>
      ) : (
        <section
          className="relative flex flex-col justify-center items-center text-center px-6 py-20 min-h-[760px] overflow-hidden"
          style={{ background: dark, color: bg }}
        >
          {renderHeaderBar()}
          <div className="mt-16">{renderHeroTextCol("center")}</div>
          {renderHeroStatsStrip("centered")}
        </section>
      )}

      {/* 2. Situation / Demand */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <Reveal className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            {props.situationEyebrow && (
              <div
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ color: `${ink}80`, fontFamily: BODY }}
              >
                {props.situationEyebrow}
              </div>
            )}
            <h2 className="text-4xl mb-6" style={{ color: ink, fontFamily: DISPLAY }}>
              {props.situationHeading}
            </h2>
            <p
              className="text-lg leading-relaxed mb-6"
              style={{ color: `${ink}cc`, fontFamily: BODY }}
            >
              {props.situationBody}
            </p>
            {props.situationBodyExtra && (
              <p
                className="text-lg leading-relaxed"
                style={{ color: `${ink}cc`, fontFamily: BODY }}
              >
                {props.situationBodyExtra}
              </p>
            )}
            {props.situationImageUrl && (
              <div className="mt-8 border-t-2 pt-6 overflow-hidden group" style={{ borderColor: accent }}>
                <img
                  src={props.situationImageUrl}
                  alt=""
                  className="w-full h-64 object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                  style={{ objectPosition: heroFocus }}
                  loading="lazy"
                />
              </div>
            )}
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {heroStats.map((s, i) => {
              const Icon = SITUATION_ICONS[i] ?? Activity;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative bg-white p-8 border border-gray-200 flex flex-col justify-between transition-colors duration-300 hover:border-gray-300 overflow-hidden"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ background: accent }}
                  />
                  <div>
                    <Icon className="w-6 h-6 mb-4" style={{ color: accent }} />
                    <div
                      className="text-xs font-semibold tracking-[0.2em] uppercase mb-2"
                      style={{ color: `${ink}80`, fontFamily: BODY }}
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
                        className="text-sm"
                        style={{ color: `${ink}99`, fontFamily: BODY }}
                      >
                        {s.description}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      </section>

      <hr className="border-t border-black/10 max-w-7xl mx-auto" />

      {/* 3. Signal */}
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
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="group border border-white/20 p-8 bg-white/5 relative transition-colors duration-300 hover:bg-white/[0.08] hover:border-white/30 overflow-hidden"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ background: accent }}
                  />
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
                </motion.div>
              );
            }
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group border border-white/20 p-8 relative transition-colors duration-300 hover:bg-white/[0.05] hover:border-white/30 overflow-hidden"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ background: accent }}
                />
                {card.stat && (
                  <div
                    className="text-4xl mb-4"
                    style={{ color: accent, fontFamily: DISPLAY }}
                  >
                    {card.stat}
                  </div>
                )}
                <p className="text-lg" style={{ fontFamily: BODY }}>
                  {card.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 4. Cost / Operational layer */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          {props.costEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: `${ink}80`, fontFamily: BODY }}
            >
              {props.costEyebrow}
            </div>
          )}
          <h2 className="text-4xl mb-6" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.costHeading}
          </h2>
          {props.costSubhead && (
            <p
              className="text-xl max-w-2xl mx-auto"
              style={{ color: `${ink}99`, fontFamily: BODY }}
            >
              {props.costSubhead}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {props.costItems.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative pt-12 border-t-2 group transition-[border-color] duration-300"
              style={{ borderColor: ink }}
            >
              <div
                className="absolute top-0 left-0 -mt-[14px] pr-4 text-xl italic"
                style={{ background: bg, color: `${ink}66`, fontFamily: DISPLAY }}
              >
                {item.num ?? String(idx + 1).padStart(2, "0")}
              </div>
              <div className="text-5xl mb-2" style={{ color: ink, fontFamily: DISPLAY }}>
                {item.stat}
              </div>
              <div
                className="font-semibold text-xs tracking-[0.2em] uppercase mb-3"
                style={{ color: `${ink}80`, fontFamily: BODY }}
              >
                {item.label}
              </div>
              <p style={{ color: `${ink}99`, fontFamily: BODY }}>{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. Shift — premium comparison table */}
      <section className="py-24 bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            {props.shiftEyebrow && (
              <div
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ color: `${ink}80`, fontFamily: BODY }}
              >
                {props.shiftEyebrow}
              </div>
            )}
            <h2 className="text-4xl" style={{ color: ink, fontFamily: DISPLAY }}>
              {props.shiftHeading}
            </h2>
          </div>

          <div className="overflow-hidden border" style={{ borderColor: `${ink}1a` }}>
            {/* Header */}
            <div className="grid grid-cols-12">
              <div
                className="col-span-4 px-6 py-4 text-[10px] font-semibold tracking-[0.3em] uppercase"
                style={{ color: `${ink}99`, fontFamily: BODY }}
              >
                Category
              </div>
              <div
                className="col-span-4 px-6 py-4 text-[10px] font-semibold tracking-[0.3em] uppercase border-l"
                style={{ color: `${ink}99`, borderColor: `${ink}1a`, fontFamily: BODY }}
              >
                Before Dandy
              </div>
              <div
                className="col-span-4 px-6 py-4 text-[10px] font-semibold tracking-[0.3em] uppercase"
                style={{ background: tableAccent, color: accent, fontFamily: BODY }}
              >
                With Dandy
              </div>
            </div>

            {/* Rows */}
            {props.shiftRows.map((row, idx) => {
              const zebra = idx % 2 === 1;
              const rowBg = zebra ? `${ink}08` : "transparent";
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.45, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className="grid grid-cols-1 md:grid-cols-12 border-t group/row"
                  style={{ borderColor: `${ink}14` }}
                >
                  <div
                    className="col-span-1 md:col-span-4 px-6 py-6 text-lg md:text-xl flex items-center"
                    style={{ color: ink, background: rowBg, fontFamily: DISPLAY }}
                  >
                    {row.category}
                  </div>
                  <div
                    className="col-span-1 md:col-span-4 px-6 py-6 md:border-l flex items-start gap-3"
                    style={{
                      background: rowBg,
                      color: `${ink}b3`,
                      borderColor: `${ink}14`,
                      fontFamily: BODY,
                    }}
                  >
                    <XIcon
                      className="w-4 h-4 mt-1 shrink-0"
                      style={{ color: `${ink}66` }}
                    />
                    <span className="text-base leading-snug">{row.oldWay}</span>
                  </div>
                  <div
                    className="col-span-1 md:col-span-4 px-6 py-6 flex items-start gap-3 font-medium border-l-2"
                    style={{
                      background: tableAccent,
                      color: bg,
                      borderColor: accent,
                      fontFamily: BODY,
                    }}
                  >
                    <Check
                      className="w-4 h-4 mt-1 shrink-0"
                      style={{ color: accent }}
                    />
                    <span className="text-base leading-snug">{row.withDandy}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Math */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          {props.mathEyebrow && (
            <div
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: `${ink}80`, fontFamily: BODY }}
            >
              {props.mathEyebrow}
            </div>
          )}
          <h2 className="text-4xl mb-4" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.mathHeading}
          </h2>
          <p className="text-xl" style={{ color: `${ink}99`, fontFamily: BODY }}>
            {props.mathSubhead}
          </p>
        </div>

        <div className="p-8 md:p-12" style={{ background: dark, color: bg }}>
          {(props.mathHeroStat || props.mathHeroDescription) && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12 pb-12 border-b border-white/20 items-center">
              <div className="md:col-span-5">
                {props.mathHeroEyebrow && (
                  <div
                    className="text-[10px] uppercase tracking-[0.3em] mb-3 font-semibold"
                    style={{ color: accent, fontFamily: BODY }}
                  >
                    {props.mathHeroEyebrow}
                  </div>
                )}
                {props.mathHeroStat && (
                  <div
                    className="text-7xl md:text-8xl leading-none"
                    style={{ color: accent, fontFamily: DISPLAY }}
                  >
                    {props.mathHeroStat}
                  </div>
                )}
              </div>
              {props.mathHeroDescription && (
                <p
                  className="md:col-span-7 text-lg md:text-xl font-light leading-relaxed"
                  style={{ color: `${bg}cc`, fontFamily: BODY }}
                >
                  {props.mathHeroDescription}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 pb-12 border-b border-white/20">
            <div>
              <label
                className="block text-[10px] uppercase tracking-[0.3em] mb-2 font-semibold"
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
                className="block text-[10px] uppercase tracking-[0.3em] mb-2 font-semibold"
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
                  className="text-[10px] uppercase tracking-[0.2em] mb-2 font-semibold"
                  style={{ color: `${bg}99`, fontFamily: BODY }}
                >
                  {s.label}
                </div>
                <div
                  className="text-4xl border-b border-white/30 pb-2"
                  style={{ color: accent, fontFamily: DISPLAY }}
                >
                  {s.value}
                </div>
                {s.caption && (
                  <div
                    className="text-xs mt-2"
                    style={{ color: `${bg}66`, fontFamily: BODY }}
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
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4 text-center"
              style={{ color: `${ink}80`, fontFamily: BODY }}
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
              className="md:col-span-7 bg-white border-t-4 overflow-hidden"
              style={{ borderColor: accent }}
            >
              {props.proofImageUrl && (
                <div className="w-full aspect-[16/9] overflow-hidden group">
                  <img
                    src={props.proofImageUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                    style={{ objectPosition: heroFocus }}
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-10 md:p-16">
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
                    style={{ color: ink, fontFamily: BODY }}
                  >
                    {props.proofFeatured.name}
                  </div>
                  <div style={{ color: `${ink}80`, fontFamily: BODY }}>
                    {props.proofFeatured.title}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col gap-8">
              {props.proofSecondary.map((t, i) => (
                <div
                  key={i}
                  className="bg-white p-8 border-l-2"
                  style={{ borderColor: `${ink}22` }}
                >
                  <p
                    className="text-xl italic mb-6 leading-relaxed"
                    style={{ color: `${ink}cc`, fontFamily: DISPLAY }}
                  >
                    "{t.quote}"
                  </p>
                  <div>
                    <div
                      className="font-semibold text-sm"
                      style={{ color: ink, fontFamily: BODY }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: `${ink}80`, fontFamily: BODY }}
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
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: `${ink}80`, fontFamily: BODY }}
            >
              {props.planEyebrow}
            </div>
          )}
          <h2 className="text-4xl mb-4" style={{ color: ink, fontFamily: DISPLAY }}>
            {props.planHeading}
          </h2>
          {props.planSubhead && (
            <p className="text-xl" style={{ color: `${ink}99`, fontFamily: BODY }}>
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
              <h4
                className="font-bold text-lg mb-2"
                style={{ color: ink, fontFamily: BODY }}
              >
                {step.title}
              </h4>
              <p
                className="text-sm mb-4 min-h-[60px]"
                style={{ color: `${ink}99`, fontFamily: BODY }}
              >
                {step.description}
              </p>
              <div
                className="text-xs uppercase tracking-[0.2em] font-semibold border-t pt-4"
                style={{ color: ink, borderColor: `${ink}22`, fontFamily: BODY }}
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
          <p className="text-lg mb-10" style={{ color: `${bg}b0`, fontFamily: BODY }}>
            {props.finalCtaSubhead}
          </p>
          <div className="flex flex-col items-center gap-6">
            <a
              href={props.finalCtaPrimaryUrl}
              className="group px-8 py-4 rounded-none font-medium transition-all duration-300 flex items-center gap-2 text-sm uppercase tracking-wider hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: accent, color: accentInk, fontFamily: BODY }}
            >
              {props.finalCtaPrimaryText}
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
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
