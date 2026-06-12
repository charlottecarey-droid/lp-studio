import { useState } from "react";
import { Palette, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksVerticalTimelineBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";

/* ----------------------------------------------------------------------------
 * How It Works — Vertical Timeline (2026 redesign)
 *
 * Premium timeline: a gradient connector line threads accent node dots, the
 * in-view step's dot carries a subtle pulse (static in the builder and under
 * prefers-reduced-motion), and content cards alternate sides of the line on
 * desktop while stacking right of a left rail on mobile. Generous measure,
 * brand-derived color throughout.
 * -------------------------------------------------------------------------- */

interface Props {
  props: HowItWorksVerticalTimelineBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksVerticalTimelineBlockProps) => void;
}

export function BlockHowItWorksVerticalTimeline({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF", brand);
  const dark = surface.isDark;
  const ink = resolveSectionInk(props, surface);
  const text = ink.text;
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accentInk = pickContrastingColor(accent, surface.base, [primary, text], 3.0);
  const eyebrowColor = pickContrastingColor(accent, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const onAccent = pickContrastingColor(undefined, accentInk, ["#FFFFFF", "#0f172a"]);
  const muted = ink.muted;
  const hairline = ink.hairline;
  const cardBg = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(11,11,15,0.08)";
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const animate = !isBuilder && !reduced;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const steps = props.steps ?? [];
  // Index of the step currently in view — its node dot pulses.
  const [activeStep, setActiveStep] = useState(0);

  const update = <K extends keyof HowItWorksVerticalTimelineBlockProps>(key: K, value: HowItWorksVerticalTimelineBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksVerticalTimelineBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 sm:py-28 lg:px-8"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <style>{`
        @keyframes hiwvt-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, ${accentInk} 38%, transparent); }
          55% { box-shadow: 0 0 0 9px color-mix(in srgb, ${accentInk} 0%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hiwvt-dot { animation: none !important; }
        }
      `}</style>
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mx-auto mb-16 max-w-2xl text-center lg:mb-24">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.26em]"
              style={{ color: eyebrowColor, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="font-bold tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4vw, 3.1rem)", lineHeight: 1.1 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        {/* ── Timeline: left rail on mobile, centered spine on lg ── */}
        <div className="relative">
          {/* Gradient connector line */}
          <div
            aria-hidden="true"
            className="absolute bottom-6 top-2 left-[11px] w-px -translate-x-1/2 lg:left-1/2"
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${accentInk} 0%, transparent), ${accentInk} 12%, ${accentInk} 78%, color-mix(in srgb, ${accentInk} 0%, transparent))`,
              opacity: dark ? 0.7 : 0.5,
            }}
          />

          <ol className="flex list-none flex-col gap-12 p-0 lg:gap-16">
            {steps.map((step, index) => {
              const onLeft = index % 2 === 0;
              const isActive = activeStep === index;
              return (
                <motion.li
                  key={index}
                  className="relative pl-10 lg:grid lg:grid-cols-[1fr_4rem_1fr] lg:items-center lg:pl-0"
                  initial={animate ? { opacity: 0, y: 24 } : false}
                  whileInView={animate ? { opacity: 1, y: 0 } : undefined}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={animate ? { duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] } : undefined}
                  onViewportEnter={animate ? () => setActiveStep(index) : undefined}
                >
                  {/* Node dot on the spine */}
                  <span
                    aria-hidden="true"
                    className="hiwvt-dot absolute left-[11px] top-7 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full lg:left-1/2 lg:top-1/2 lg:-translate-y-1/2"
                    style={{
                      backgroundColor: accentInk,
                      boxShadow: `0 0 0 4px ${surface.base}, 0 0 0 5px color-mix(in srgb, ${accentInk} 35%, transparent)`,
                      animation: animate && isActive ? "hiwvt-pulse 2.4s ease-in-out infinite" : "none",
                    }}
                  />

                  {/* Content card — alternates sides on lg */}
                  <div
                    className={`group rounded-2xl border p-6 sm:p-7 ${
                      onLeft ? "lg:col-start-1" : "lg:col-start-3"
                    }`}
                    style={{
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      boxShadow: dark
                        ? "0 18px 40px -26px rgba(0,0,0,0.7)"
                        : "0 1px 2px rgba(15,23,42,0.04), 0 16px 38px -28px rgba(15,23,42,0.22)",
                    }}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${accentInk} 12%, transparent)`,
                          color: accentInk,
                        }}
                        aria-hidden="true"
                      >
                        <IconOrImage value={step.icon} fallback={Palette} className="h-4 w-4" />
                      </span>
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: eyebrowColor }}
                        aria-hidden="true"
                      >
                        Step {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <InlineText
                      as="h3"
                      value={step.title}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                      className="mb-2.5 text-xl font-bold tracking-tight sm:text-[1.35rem]"
                      style={{ fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={step.description}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                      className="max-w-prose text-[15px] leading-relaxed sm:text-base"
                      style={{ color: muted, fontFamily: BODY }}
                      multiline />
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>

        {((props.primaryButtonLabel || props.secondaryButtonLabel) || onFieldChange) && (
          <div className="mt-16 flex flex-wrap items-center justify-center gap-4 lg:mt-20">
            {(props.primaryButtonLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.primaryButtonUrl}
                brand={brand}
                source="how-it-works-vertical-timeline-primary"
                className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: accentInk, color: onAccent, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
              >
                {props.primaryButtonLabel || "Start building for free"}
              </CtaButton>
            )}
            {(props.secondaryButtonLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.secondaryButtonUrl}
                brand={brand}
                source="how-it-works-vertical-timeline-secondary"
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ color: text, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
              >
                {props.secondaryButtonLabel || "View examples"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </CtaButton>
            )}
          </div>
        )}

        {/* ── Trailing CTA band (preserved behavior) ── */}
        {showCta && (
          <div className="mt-16 border-t pt-14 lg:mt-20" style={{ borderColor: hairline }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                    style={{ color: eyebrowColor, fontFamily: BODY }} />
                )}
                {(props.ctaHeading || onFieldChange) && (
                  <InlineText
                    as="h3"
                    value={props.ctaHeading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                    className="text-2xl font-bold tracking-tight md:text-3xl"
                    style={{ fontFamily: DISPLAY }} />
                )}
                {(props.ctaSubheading || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.ctaSubheading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                    className="max-w-xl text-base md:text-lg"
                    style={{ color: muted, fontFamily: BODY }}
                    multiline />
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {(props.ctaPrimaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaPrimaryUrl}
                    brand={brand}
                    source="how-it-works-vertical-timeline-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ backgroundColor: accentInk, color: onAccent, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="how-it-works-vertical-timeline-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ borderColor: `color-mix(in srgb, ${text} 22%, transparent)`, color: text, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
                  >
                    {props.ctaSecondaryLabel || "Talk to sales"}
                  </CtaButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
