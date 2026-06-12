import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import type { CaseStudyCardGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

/* ----------------------------------------------------------------------------
 * Case Study — Card Grid (2026 redesign)
 *
 * Customer-story cards with deliberately varied surfaces (alternating subtle
 * accent washes), a real logo-slot treatment (contained + padded, never
 * stretched — and never auto-filled with stock photos: empty slots fall back
 * to the company name alone), the metric set oversized in the brand numbers
 * font, hover lift, and an optional accent-tinted featured card that spans two
 * columns. All color brand-derived; motion off in builder + reduced-motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CaseStudyCardGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyCardGridBlockProps) => void;
}

export function BlockCaseStudyCardGrid({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FAFAF8");
  const dark = surface.isDark;
  const ink = props.textColor || surface.color || (dark ? "#F6F7F9" : "#0B0B0F");
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const NUMBERS = BRAND_NUMBERS_FONT;
  const muted = dark ? "rgba(246,247,249,0.62)" : "rgba(11,11,15,0.6)";
  const accentInk = pickContrastingColor(accent, surface.base, [primary, ink], 3.0);
  const reduced = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduced;

  // Card surface: tenant override wins; otherwise adapt to the section.
  const customSurface = props.surfaceColor?.trim();
  const cardSurface = customSurface || (dark ? "rgba(255,255,255,0.05)" : "#FFFFFF");
  const cardIsDark = customSurface ? relativeLuminance(customSurface) < 0.4 : dark;
  const cardInk = cardIsDark ? "#F6F7F9" : "#0B0B0F";
  const cardMuted = cardIsDark ? "rgba(246,247,249,0.62)" : "rgba(11,11,15,0.6)";
  const cardBorder = cardIsDark ? "rgba(255,255,255,0.1)" : "rgba(11,11,15,0.08)";
  const metricColor = customSurface
    ? pickContrastingColor(accent, customSurface, [primary, cardInk], 3.0)
    : accentInk;

  const cards = props.cards ?? [];
  const isLogo = props.displayMode === "logo";

  // These are customer/company *logo* slots. For AI-invented placeholder
  // companies we usually have no real logo (the image pipeline no longer
  // auto-fills a stock photo here, which used to render as a "tiny image where
  // an icon should be"). Show the logo/icon box only when a real image exists,
  // or in the builder so the editor keeps the Replace affordance; otherwise the
  // card header falls back to the company name alone.
  const hasCardImage = (c: { imageUrl?: string }) =>
    typeof c.imageUrl === "string" && c.imageUrl.trim().length > 0;
  const showCardImage = (c: { imageUrl?: string }) => hasCardImage(c) || !!onFieldChange;

  const update = <K extends keyof CaseStudyCardGridBlockProps>(
    key: K,
    value: CaseStudyCardGridBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateCard = (
    i: number,
    patch: Partial<CaseStudyCardGridBlockProps["cards"][number]>,
  ) => {
    if (!onFieldChange) return;
    const next = cards.map((card, idx) => (idx === i ? { ...card, ...patch } : card));
    onFieldChange({ ...props, cards: next });
  };

  return (
    <section
      className="relative w-full overflow-hidden py-20 sm:py-28 lg:py-32"
      style={{ background: surface.background, fontFamily: BODY }}
    >
      <style>{`
        .cscg-card { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.35s ease; }
        @media (hover: hover) {
          .cscg-card:hover {
            transform: translateY(-5px);
            border-color: color-mix(in srgb, ${accentInk} 38%, ${cardBorder});
            box-shadow: 0 0 0 1px color-mix(in srgb, ${accentInk} 18%, transparent),
              ${cardIsDark ? "0 28px 56px -24px rgba(0,0,0,0.75)" : "0 26px 52px -20px rgba(15,23,42,0.24)"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cscg-card, .cscg-card:hover { transform: none; transition: none; }
        }
      `}</style>
      <div className="container relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <Reveal disabled={!animate} className="mb-14 max-w-3xl md:mb-20">
          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
            className="mb-5 font-bold tracking-tight"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4vw, 3.25rem)", lineHeight: 1.08 }}
            multiline />
          {(props.subheading || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheading ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
              className="max-w-2xl text-base leading-relaxed sm:text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </Reveal>

        <RevealStagger disabled={!animate} className="mb-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {cards.map((card, i) => {
            const featured = !!card.featured;
            // Varied surfaces: featured gets an accent wash; every third
            // regular card gets a whisper of accent tint to break uniformity.
            const washed = !featured && i % 3 === 1;
            const bgStyle = featured
              ? `linear-gradient(150deg, color-mix(in srgb, ${metricColor} ${cardIsDark ? 22 : 9}%, ${cardSurface}), ${cardSurface} 70%)`
              : washed
                ? `color-mix(in srgb, ${metricColor} ${cardIsDark ? 8 : 3.5}%, ${cardSurface})`
                : cardSurface;
            return (
            <RevealItem
              key={i}
              disabled={!animate}
              className={`cscg-card group relative flex h-full flex-col overflow-hidden rounded-3xl border p-7 sm:p-8 ${featured ? "md:col-span-2" : ""}`}
              style={{
                background: bgStyle,
                borderColor: featured ? `color-mix(in srgb, ${metricColor} 35%, ${cardBorder})` : cardBorder,
                color: cardInk,
                boxShadow: cardIsDark
                  ? "0 20px 44px -26px rgba(0,0,0,0.7)"
                  : "0 1px 2px rgba(15,23,42,0.04), 0 18px 40px -30px rgba(15,23,42,0.24)",
              }}
            >
              <div className="relative z-10 flex h-full flex-col">
                {/* ── Header: logo slot (contained, padded, never stretched) ── */}
                {isLogo ? (
                  <div className="mb-7 flex flex-col gap-4 border-b pb-7" style={{ borderColor: cardBorder }}>
                    {showCardImage(card) && (
                      <div
                        className="flex h-16 w-full max-w-[200px] items-center justify-center rounded-xl px-5 py-3"
                        style={{ backgroundColor: cardIsDark ? "rgba(255,255,255,0.07)" : "rgba(11,11,15,0.035)" }}
                      >
                        <InlineImage
                          src={card.imageUrl}
                          alt={card.imageAlt || `${card.company} logo`}
                          onUpdate={onFieldChange ? (src: string) => updateCard(i, { imageUrl: src }) : undefined}
                          onAltUpdate={onFieldChange ? (alt: string) => updateCard(i, { imageAlt: alt }) : undefined}
                          className="h-auto max-h-9 w-auto max-w-[150px] object-contain"
                          wrapperClassName="inline-flex max-h-full items-center justify-center"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <InlineText
                      as="span"
                      value={card.company}
                      onUpdate={onFieldChange ? (v: string) => updateCard(i, { company: v }) : undefined}
                      className="text-lg font-bold tracking-tight"
                      style={{ color: cardInk, fontFamily: DISPLAY }} />
                  </div>
                ) : (
                  <div className="mb-7 flex items-center gap-3 border-b pb-7" style={{ borderColor: cardBorder }}>
                    {showCardImage(card) && (
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl p-2"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${metricColor} 10%, transparent)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${metricColor} 18%, transparent)`,
                        }}
                      >
                        <InlineImage
                          src={card.imageUrl}
                          alt={card.imageAlt || `${card.company} logo`}
                          onUpdate={onFieldChange ? (src: string) => updateCard(i, { imageUrl: src }) : undefined}
                          onAltUpdate={onFieldChange ? (alt: string) => updateCard(i, { imageAlt: alt }) : undefined}
                          className="h-full w-full object-contain"
                          wrapperClassName="block h-full w-full"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <InlineText
                      as="span"
                      value={card.company}
                      onUpdate={onFieldChange ? (v: string) => updateCard(i, { company: v }) : undefined}
                      className="text-lg font-bold tracking-tight"
                      style={{ color: cardInk, fontFamily: DISPLAY }} />
                  </div>
                )}

                {/* ── Result narrative ── */}
                <div className="flex-grow">
                  <InlineText
                    as="h3"
                    value={card.result}
                    onUpdate={onFieldChange ? (v: string) => updateCard(i, { result: v }) : undefined}
                    className={`mb-8 font-medium leading-relaxed ${featured ? "text-lg sm:text-xl max-w-xl" : "text-[15px] sm:text-base"}`}
                    style={{ color: cardInk, fontFamily: BODY }}
                    multiline />
                </div>

                {/* ── Oversized metric in the brand numbers font ── */}
                <div className="mb-8">
                  <div
                    className="mb-2 font-bold tabular-nums"
                    style={{
                      color: metricColor,
                      fontFamily: NUMBERS,
                      fontSize: featured ? "clamp(2.75rem, 5vw, 3.75rem)" : "clamp(2.25rem, 3.5vw, 2.9rem)",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {onFieldChange ? (
                      <InlineText
                        as="span"
                        value={card.metricValue}
                        onUpdate={(v: string) => updateCard(i, { metricValue: v })}
                        style={{ fontFamily: NUMBERS }} />
                    ) : reduced ? (
                      <span>{card.metricValue}</span>
                    ) : (
                      <StatCounter value={card.metricValue} style={{ fontFamily: NUMBERS }} />
                    )}
                  </div>
                  <InlineText
                    as="div"
                    value={card.metricLabel}
                    onUpdate={onFieldChange ? (v: string) => updateCard(i, { metricLabel: v }) : undefined}
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: cardMuted, fontFamily: BODY }} />
                </div>

                <CtaButton
                  ctaAction="url"
                  ctaUrl={card.linkUrl}
                  brand={brand}
                  source="case-study-card-grid-story"
                  className="inline-flex items-center gap-2 self-start text-sm font-bold transition-all group-hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ color: metricColor, fontFamily: BODY, ["--tw-ring-color" as string]: metricColor }}
                >
                  View story <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CtaButton>
              </div>
            </RevealItem>
            );
          })}
        </RevealStagger>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={!animate} className="flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="case-study-card-grid-cta"
              className="inline-flex items-center justify-center gap-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ color: accentInk, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
            >
              {props.ctaLabel || "Explore all customer stories"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
