import { Quote, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import type { CaseStudyMetricTriptychBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { StatCounter } from "./StatCounter";

/* ----------------------------------------------------------------------------
 * Case Study — Metric Triptych (2026 redesign)
 *
 * Three oversized metrics set in the brand numbers font (tabular-nums,
 * count-up that goes static under prefers-reduced-motion), each anchored by a
 * one-line proof and separated by strong vertical hairline dividers, followed
 * by the customer pull-quote. The optional "panel" variant wraps the whole
 * composition in an accent-tinted rounded panel. All color brand-derived.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CaseStudyMetricTriptychBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CaseStudyMetricTriptychBlockProps) => void;
}

export function BlockCaseStudyMetricTriptych({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FAFAF8");
  const dark = surface.isDark;
  const ink = props.textColor || surface.color || (dark ? "#F6F7F9" : "#0B0B0F");
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const NUMBERS = BRAND_NUMBERS_FONT;
  const reduced = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduced;
  const isPanel = props.variant === "panel";

  // The composition surface: the section itself, or the accent-tinted panel.
  // `surfaceColor` (legacy "badge surface") now drives the panel base when the
  // panel variant is on. Recompute darkness so text stays legible either way.
  const panelBase = props.surfaceColor?.trim() || (dark ? "#101016" : "#FFFFFF");
  const panelBg = `linear-gradient(150deg, color-mix(in srgb, ${accent} ${dark ? 20 : 8}%, ${panelBase}), color-mix(in srgb, ${accent} ${dark ? 9 : 3}%, ${panelBase}))`;
  const compBase = isPanel ? panelBase : surface.base;
  const compDark = isPanel ? relativeLuminance(panelBase) < 0.4 : dark;
  const compInk = isPanel ? (compDark ? "#F6F7F9" : "#0B0B0F") : ink;
  const muted = compDark ? "rgba(246,247,249,0.62)" : "rgba(11,11,15,0.6)";
  const accentInk = pickContrastingColor(accent, compBase, [primary, compInk], 3.0);
  const divider = compDark ? "rgba(255,255,255,0.14)" : "rgba(11,11,15,0.12)";

  const metrics = props.metrics ?? [];

  const update = <K extends keyof CaseStudyMetricTriptychBlockProps>(
    key: K,
    value: CaseStudyMetricTriptychBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateMetric = (
    i: number,
    patch: Partial<CaseStudyMetricTriptychBlockProps["metrics"][number]>,
  ) => {
    if (!onFieldChange) return;
    const next = metrics.map((metric, idx) => (idx === i ? { ...metric, ...patch } : metric));
    onFieldChange({ ...props, metrics: next });
  };

  const inner = (
    <>
      {/* ── Company kicker ── */}
      <Reveal disabled={!animate} className="mb-12 flex flex-col items-center sm:mb-16">
        <span
          aria-hidden="true"
          className="mb-5 h-1 w-10 rounded-full"
          style={{ background: `linear-gradient(90deg, ${accentInk}, color-mix(in srgb, ${accentInk} 30%, transparent))` }}
        />
        <InlineText
          as="h2"
          value={props.company}
          onUpdate={onFieldChange ? (v: string) => update("company", v) : undefined}
          className="text-[12px] font-semibold uppercase tracking-[0.26em] sm:text-[13px]"
          style={{ color: compInk, fontFamily: BODY }} />
      </Reveal>

      {/* ── Oversized metrics with strong vertical dividers ── */}
      <RevealStagger disabled={!animate} className="mb-16 grid grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-y-0 sm:mb-20">
        {metrics.map((metric, i) => (
          <RevealItem
            key={i}
            disabled={!animate}
            className={`flex flex-col items-center px-6 text-center md:px-8 ${i > 0 ? "md:border-l" : ""}`}
            style={{ borderColor: divider }}
          >
            <div
              className="mb-4 font-bold tabular-nums"
              style={{
                color: accentInk,
                fontFamily: NUMBERS,
                fontSize: "clamp(3.25rem, 7vw, 5.25rem)",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {onFieldChange ? (
                <InlineText
                  as="span"
                  value={metric.value}
                  onUpdate={(v: string) => updateMetric(i, { value: v })}
                  style={{ fontFamily: NUMBERS }} />
              ) : reduced ? (
                <span>{metric.value}</span>
              ) : (
                <StatCounter value={metric.value} style={{ fontFamily: NUMBERS }} />
              )}
            </div>
            <InlineText
              as="h3"
              value={metric.label}
              onUpdate={onFieldChange ? (v: string) => updateMetric(i, { label: v }) : undefined}
              className="max-w-[240px] text-sm font-medium leading-snug sm:text-base"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          </RevealItem>
        ))}
      </RevealStagger>

      {/* ── Pull-quote + attribution ── */}
      <Reveal disabled={!animate} className="relative mx-auto mb-12 max-w-3xl sm:mb-14">
        <Quote
          className="mx-auto mb-6 h-9 w-9"
          style={{ color: `color-mix(in srgb, ${accentInk} 35%, transparent)` }}
          aria-hidden="true"
        />
        <blockquote>
          <InlineText
            as="p"
            value={props.quote}
            onUpdate={onFieldChange ? (v: string) => update("quote", v) : undefined}
            className="mb-8 font-medium leading-snug tracking-tight"
            style={{ color: compInk, fontFamily: DISPLAY, fontSize: "clamp(1.35rem, 2.6vw, 1.9rem)" }}
            multiline />
        </blockquote>
        <div className="flex flex-col items-center justify-center gap-0.5">
          <InlineText
            as="span"
            value={props.author}
            onUpdate={onFieldChange ? (v: string) => update("author", v) : undefined}
            className="text-base font-bold"
            style={{ color: compInk, fontFamily: BODY }} />
          <InlineText
            as="span"
            value={props.role}
            onUpdate={onFieldChange ? (v: string) => update("role", v) : undefined}
            className="text-sm font-medium"
            style={{ color: muted, fontFamily: BODY }} />
        </div>
      </Reveal>

      {(props.ctaLabel || onFieldChange) && (
        <Reveal disabled={!animate} className="border-t pt-9" style={{ borderColor: divider }}>
          <CtaButton
            ctaAction="url"
            ctaUrl={props.ctaUrl}
            brand={brand}
            source="case-study-metric-triptych-cta"
            className="inline-flex items-center justify-center gap-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: accentInk, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
          >
            {props.ctaLabel || "View full story"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CtaButton>
        </Reveal>
      )}
    </>
  );

  return (
    <section
      className="relative w-full overflow-hidden py-20 sm:py-28 lg:py-32"
      style={{ background: surface.background, fontFamily: BODY }}
    >
      <div className="container relative z-10 mx-auto max-w-6xl px-6 text-center md:px-10">
        {isPanel ? (
          <div
            className="rounded-[2rem] border px-6 py-14 sm:px-12 sm:py-16 lg:px-16 lg:py-20"
            style={{
              background: panelBg,
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
