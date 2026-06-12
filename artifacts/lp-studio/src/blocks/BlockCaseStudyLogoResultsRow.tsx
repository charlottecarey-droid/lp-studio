import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CaseStudyLogoResultsRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

/* ----------------------------------------------------------------------------
 * Case Study — Logo Results Row (2026 redesign)
 *
 * A tight premium proof band: customer logos held at one consistent height
 * (contained, never stretched), one oversized key metric each in the brand
 * numbers font, and low-alpha vertical dividers between columns. Reads cleanly
 * on light and dark sections; empty logo slots fall back to the company name
 * (never a stray photo). Motion off in builder + reduced-motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CaseStudyLogoResultsRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyLogoResultsRowBlockProps) => void;
}

export function BlockCaseStudyLogoResultsRow({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const dark = surface.isDark;
  const ink = props.textColor || surface.color || (dark ? "#F6F7F9" : "#0B0B0F");
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const NUMBERS = BRAND_NUMBERS_FONT;
  const muted = dark ? "rgba(246,247,249,0.62)" : "rgba(11,11,15,0.6)";
  const accentInk = pickContrastingColor(accent, surface.base, [primary, ink], 3.0);
  const onAccent = pickContrastingColor(undefined, accentInk, ["#FFFFFF", "#0f172a"]);
  const hairline = dark ? "rgba(255,255,255,0.1)" : "rgba(11,11,15,0.09)";
  const reduced = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduced;

  const results = props.results ?? [];
  const isLogo = props.displayMode === "logo";

  const update = <K extends keyof CaseStudyLogoResultsRowBlockProps>(
    key: K,
    value: CaseStudyLogoResultsRowBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateResult = (
    i: number,
    patch: Partial<CaseStudyLogoResultsRowBlockProps["results"][number]>,
  ) => {
    if (!onFieldChange) return;
    const next = results.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
    onFieldChange({ ...props, results: next });
  };

  return (
    <section
      className="relative w-full overflow-hidden border-y py-14 sm:py-16 lg:py-20"
      style={{ background: surface.background, borderColor: hairline, fontFamily: BODY }}
    >
      <div className="container relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        {(props.heading || onFieldChange) && (
          <Reveal disabled={!animate}>
            <InlineText
              as="h2"
              value={props.heading ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="mb-12 text-center text-[11px] font-semibold uppercase tracking-[0.26em] sm:mb-14"
              style={{ color: muted, fontFamily: BODY }} />
          </Reveal>
        )}

        <RevealStagger
          disabled={!animate}
          className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-4 lg:gap-y-0"
        >
          {results.map((item, i) => {
            const hasLogo = !!item.logoUrl?.trim() || !!onFieldChange;
            return (
              <RevealItem
                key={i}
                disabled={!animate}
                className={`group flex flex-col px-1 sm:px-6 ${isLogo ? "items-center text-center" : ""} ${
                  i % 2 === 1 ? "sm:border-l" : ""
                } ${i > 0 ? "lg:border-l" : "lg:border-l-0"}`}
                style={{ borderColor: hairline }}
              >
                {/* Logo at a consistent height — contained, never stretched.
                    Empty customer-logo slots must NOT leave a gap or show a
                    stray photo — the company name is the fallback. */}
                {isLogo ? (
                  <>
                    {hasLogo && (
                      <div className="mb-4 flex h-10 w-full items-center justify-center" style={{ color: ink }}>
                        <InlineImage
                          src={item.logoUrl}
                          alt={item.logoAlt || `${item.company} logo`}
                          onUpdate={onFieldChange ? (src: string) => updateResult(i, { logoUrl: src }) : undefined}
                          onAltUpdate={onFieldChange ? (alt: string) => updateResult(i, { logoAlt: alt }) : undefined}
                          className="h-auto max-h-10 w-auto max-w-[150px] object-contain"
                          wrapperClassName="inline-flex max-h-full items-center justify-center"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <InlineText
                      as="h3"
                      value={item.company}
                      onUpdate={onFieldChange ? (v: string) => updateResult(i, { company: v }) : undefined}
                      className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: muted, fontFamily: BODY }} />
                  </>
                ) : (
                  <div className="mb-5 flex items-center gap-2.5">
                    {hasLogo && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden" style={{ color: ink }}>
                        <InlineImage
                          src={item.logoUrl}
                          alt={item.logoAlt || `${item.company} logo`}
                          onUpdate={onFieldChange ? (src: string) => updateResult(i, { logoUrl: src }) : undefined}
                          onAltUpdate={onFieldChange ? (alt: string) => updateResult(i, { logoAlt: alt }) : undefined}
                          className="h-full w-full object-contain"
                          wrapperClassName="block h-full w-full"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <InlineText
                      as="h3"
                      value={item.company}
                      onUpdate={onFieldChange ? (v: string) => updateResult(i, { company: v }) : undefined}
                      className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: muted, fontFamily: BODY }} />
                  </div>
                )}

                {/* Oversized key metric in the brand numbers font */}
                <div
                  className="mb-2.5 font-bold tabular-nums"
                  style={{
                    color: accentInk,
                    fontFamily: NUMBERS,
                    fontSize: "clamp(2rem, 3.2vw, 2.75rem)",
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {onFieldChange ? (
                    <InlineText
                      as="span"
                      value={item.metricValue}
                      onUpdate={(v: string) => updateResult(i, { metricValue: v })}
                      style={{ fontFamily: NUMBERS }} />
                  ) : reduced ? (
                    <span>{item.metricValue}</span>
                  ) : (
                    <StatCounter value={item.metricValue} style={{ fontFamily: NUMBERS }} />
                  )}
                </div>

                <InlineText
                  as="p"
                  value={item.outcome}
                  onUpdate={onFieldChange ? (v: string) => updateResult(i, { outcome: v }) : undefined}
                  className="text-sm font-medium leading-relaxed sm:text-[15px]"
                  style={{ color: ink, fontFamily: BODY }}
                  multiline />
              </RevealItem>
            );
          })}
        </RevealStagger>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={!animate} className="mt-12 border-t pt-10 text-center sm:mt-14" style={{ borderColor: hairline }}>
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="case-study-logo-results-row-cta"
              className="cslrr-cta inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: accentInk, color: onAccent, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
            >
              {props.ctaLabel || "Read the case studies"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaButton>
            <style>{`
              .cslrr-cta { transition: transform 0.2s ease; }
              @media (hover: hover) { .cslrr-cta:hover { transform: translateY(-2px); } }
              @media (prefers-reduced-motion: reduce) { .cslrr-cta, .cslrr-cta:hover { transform: none; transition: none; } }
            `}</style>
          </Reveal>
        )}
      </div>
    </section>
  );
}
