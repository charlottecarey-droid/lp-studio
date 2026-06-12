import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import type { CaseStudySpotlightFeatureBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

/* ----------------------------------------------------------------------------
 * Case Study — Spotlight Feature (2026 redesign)
 *
 * Magazine spotlight: an asymmetric 12-column split with a large photo area
 * (optional customer logo badge overlaid), the story headline + optional
 * pull-quote, the Challenge/Solution/Result narrative, and a metrics rail with
 * the headline number set oversized in the brand numbers font. The optional
 * `tintedPanel` wraps everything in an accent-tinted rounded panel. All color
 * brand-derived; motion off in builder + reduced-motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CaseStudySpotlightFeatureBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudySpotlightFeatureBlockProps) => void;
}

export function BlockCaseStudySpotlightFeature({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const dark = surface.isDark;
  const ink = props.textColor || surface.color || (dark ? "#F6F7F9" : "#0B0B0F");
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const NUMBERS = BRAND_NUMBERS_FONT;
  const reduced = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduced;
  const isBuilder = !!onFieldChange;
  const tinted = !!props.tintedPanel;

  // Composition surface — the section, or the accent-tinted panel.
  const panelBase = props.surfaceColor?.trim() || (dark ? "#101016" : "#FFFFFF");
  const compBase = tinted ? panelBase : surface.base;
  const compDark = tinted ? relativeLuminance(panelBase) < 0.4 : dark;
  const compInk = tinted ? (compDark ? "#F6F7F9" : "#0B0B0F") : ink;
  const muted = compDark ? "rgba(246,247,249,0.62)" : "rgba(11,11,15,0.6)";
  const accentInk = pickContrastingColor(accent, compBase, [primary, compInk], 3.0);
  const eyebrowColor = pickContrastingColor(accent, compBase, [primary, compDark ? "#E2E8F0" : "#0f172a"], 4.5);
  const hairline = compDark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.1)";

  const update = <K extends keyof CaseStudySpotlightFeatureBlockProps>(
    key: K,
    value: CaseStudySpotlightFeatureBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const sections: { label: string; key: "challenge" | "solution" | "result"; value: string }[] = [
    { label: "The Challenge", key: "challenge", value: props.challenge },
    { label: "The Solution", key: "solution", value: props.solution },
    { label: "The Result", key: "result", value: props.result },
  ];

  const showLogo = !!props.logoUrl?.trim() || isBuilder;
  const showQuote = !!props.quote?.trim() || isBuilder;

  const inner = (
    <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-14">
      {/* ── Visual column: large photo + logo badge (7/12, leads on lg) ── */}
      <Reveal disabled={!animate} className="relative lg:col-span-7">
        <div
          className="group relative h-full min-h-[280px] overflow-hidden rounded-3xl ring-1 sm:min-h-[380px] lg:min-h-[520px]"
          style={{
            backgroundColor: compDark ? "rgba(255,255,255,0.05)" : "rgba(11,11,15,0.04)",
            boxShadow: compDark
              ? "0 30px 70px -32px rgba(0,0,0,0.75)"
              : "0 1px 2px rgba(15,23,42,0.05), 0 30px 70px -36px rgba(15,23,42,0.32)",
            ["--tw-ring-color" as string]: compDark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.08)",
          }}
        >
          <InlineImage
            src={props.imageUrl}
            alt={props.imageAlt || `${props.company} feature photo`}
            onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
            onAltUpdate={onFieldChange ? (alt: string) => update("imageAlt", alt) : undefined}
            focalPoint={props.imageFocal}
            onFocalUpdate={onFieldChange ? (focal: string) => update("imageFocal", focal) : undefined}
            className="absolute inset-0 h-full w-full object-cover"
            wrapperClassName="absolute inset-0"
            loading="lazy"
          />
          {/* Customer logo badge — contained + padded, never stretched */}
          {showLogo && (
            <div
              className="absolute bottom-4 left-4 z-10 flex h-12 max-w-[180px] items-center justify-center rounded-xl px-4 py-2.5"
              style={{
                backgroundColor: "rgba(255,255,255,0.92)",
                boxShadow: "0 8px 24px -10px rgba(0,0,0,0.4)",
                backdropFilter: "blur(8px)",
              }}
            >
              <InlineImage
                src={props.logoUrl ?? ""}
                alt={props.logoAlt || `${props.company} logo`}
                onUpdate={onFieldChange ? (src: string) => update("logoUrl", src) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => update("logoAlt", alt) : undefined}
                className="h-auto max-h-7 w-auto max-w-[140px] object-contain"
                wrapperClassName="inline-flex max-h-full items-center justify-center"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </Reveal>

      {/* ── Editorial column (5/12) ── */}
      <Reveal disabled={!animate} delay={0.08} className="flex flex-col lg:col-span-5">
        <div className="mb-5 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-px w-8"
            style={{ backgroundColor: accentInk }}
          />
          <InlineText
            as="span"
            value={props.company}
            onUpdate={onFieldChange ? (v: string) => update("company", v) : undefined}
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: eyebrowColor, fontFamily: BODY }} />
        </div>

        <InlineText
          as="h2"
          value={props.headline}
          onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
          className="mb-6 font-bold tracking-tight"
          style={{ color: compInk, fontFamily: DISPLAY, fontSize: "clamp(1.7rem, 3.2vw, 2.6rem)", lineHeight: 1.12 }}
          multiline />

        {/* Optional magazine pull-quote */}
        {showQuote && (
          <blockquote
            className="mb-7 border-l-2 pl-4"
            style={{ borderColor: accentInk }}
          >
            <InlineText
              as="p"
              value={props.quote ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("quote", v) : undefined}
              className="text-lg font-medium leading-snug sm:text-xl"
              style={{ color: compInk, fontFamily: DISPLAY }}
              multiline />
          </blockquote>
        )}

        {/* Challenge / Solution / Result narrative */}
        <RevealStagger disabled={!animate} className="mb-8 space-y-5">
          {sections.map((s) => (
            <RevealItem key={s.key} disabled={!animate}>
              <h3
                className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: eyebrowColor, fontFamily: BODY }}
              >
                {s.label}
              </h3>
              <InlineText
                as="p"
                value={s.value}
                onUpdate={onFieldChange ? (v: string) => update(s.key, v) : undefined}
                className="text-[15px] leading-relaxed sm:text-base"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            </RevealItem>
          ))}
        </RevealStagger>

        {/* Metrics rail — oversized headline number, hairline-framed */}
        <div
          className="mb-8 mt-auto flex items-center gap-5 border-y py-6"
          style={{ borderColor: hairline }}
        >
          <div
            className="font-bold tabular-nums"
            style={{
              color: accentInk,
              fontFamily: NUMBERS,
              fontSize: "clamp(2.5rem, 4.5vw, 3.5rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {onFieldChange ? (
              <InlineText
                as="span"
                value={props.metricValue}
                onUpdate={(v: string) => update("metricValue", v)}
                style={{ fontFamily: NUMBERS }} />
            ) : reduced ? (
              <span>{props.metricValue}</span>
            ) : (
              <StatCounter value={props.metricValue} style={{ fontFamily: NUMBERS }} />
            )}
          </div>
          <span aria-hidden="true" className="h-10 w-px shrink-0" style={{ backgroundColor: hairline }} />
          <InlineText
            as="div"
            value={props.metricLabel}
            onUpdate={onFieldChange ? (v: string) => update("metricLabel", v) : undefined}
            className="max-w-[220px] text-sm font-medium leading-snug"
            style={{ color: muted, fontFamily: BODY }}
            multiline />
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <CtaButton
            ctaAction="url"
            ctaUrl={props.ctaUrl}
            brand={brand}
            source="case-study-spotlight-feature-cta"
            className="inline-flex items-center gap-2 self-start font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: accentInk, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
          >
            {props.ctaLabel || "Read the case study"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CtaButton>
        )}
      </Reveal>
    </div>
  );

  return (
    <section
      className="relative w-full overflow-hidden py-20 sm:py-24 lg:py-32"
      style={{ background: surface.background, fontFamily: BODY }}
    >
      <div className="container relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        {(props.eyebrow || onFieldChange) && (
          <Reveal disabled={!animate} className="mb-10">
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
              className="text-[11px] font-semibold uppercase tracking-[0.26em]"
              style={{
                color: pickContrastingColor(accent, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5),
                fontFamily: BODY,
              }} />
          </Reveal>
        )}

        {tinted ? (
          <div
            className="rounded-[2rem] border p-6 sm:p-10 lg:p-14"
            style={{
              background: `linear-gradient(150deg, color-mix(in srgb, ${accent} ${compDark ? 20 : 8}%, ${panelBase}), color-mix(in srgb, ${accent} ${compDark ? 9 : 3}%, ${panelBase}))`,
              borderColor: `color-mix(in srgb, ${accentInk} 18%, transparent)`,
              boxShadow: compDark
                ? "0 30px 70px -36px rgba(0,0,0,0.7)"
                : "0 1px 2px rgba(15,23,42,0.04), 0 30px 70px -44px rgba(15,23,42,0.3)",
            }}
          >
            {inner}
          </div>
        ) : (
          inner
        )}
      </div>
    </section>
  );
}
