import { UserPlus, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksHorizontalStepperBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * How It Works — Horizontal Stepper (2026 redesign)
 *
 * Refined stepper: a connected progress line threads through accent number
 * nodes, with a compact card under each node. Steps reveal sequentially as the
 * row scrolls into view (all visible immediately in the builder and under
 * prefers-reduced-motion). On mobile the stepper rotates vertical with a left
 * connector rail — no horizontal scrolling. All color is brand-derived.
 * -------------------------------------------------------------------------- */

interface Props {
  props: HowItWorksHorizontalStepperBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksHorizontalStepperBlockProps) => void;
}

export function BlockHowItWorksHorizontalStepper({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const dark = surface.isDark;
  const text = props.textColor || surface.color || (dark ? "#F6F7F9" : "#0B0B0F");
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accentInk = pickContrastingColor(accent, surface.base, [primary, text], 3.0);
  const eyebrowColor = pickContrastingColor(accent, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const onAccent = pickContrastingColor(undefined, accentInk, ["#FFFFFF", "#0f172a"]);
  const muted = dark ? "rgba(246,247,249,0.64)" : "rgba(11,11,15,0.62)";
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.1)";
  const cardBg = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(11,11,15,0.08)";
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const animate = !isBuilder && !reduced;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const steps = props.steps ?? [];
  const trustItems = props.trustItems ?? [];

  const update = <K extends keyof HowItWorksHorizontalStepperBlockProps>(key: K, value: HowItWorksHorizontalStepperBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksHorizontalStepperBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-16 sm:py-20 lg:px-8 lg:py-28"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {/* ── Header row: copy left, optional CTA right ── */}
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end lg:mb-20">
          <div className="max-w-2xl">
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
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.8rem, 3.6vw, 2.9rem)", lineHeight: 1.1 }}
              multiline />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
                className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            )}
          </div>
          {(props.headerCtaLabel || onFieldChange) && (
            <CtaButton
              ctaAction="url"
              ctaUrl={props.headerCtaUrl}
              brand={brand}
              source="how-it-works-horizontal-stepper-header-cta"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: accentInk, color: onAccent, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
            >
              {props.headerCtaLabel || "Start free trial"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaButton>
          )}
        </div>

        {/* ── Stepper: vertical rail on mobile, connected horizontal line on md+ ── */}
        <div className="relative">
          {/* Desktop progress line, threaded through the node centers */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-[22px] hidden h-px md:block"
            style={{ backgroundColor: hairline }}
          >
            <motion.div
              className="h-full w-full origin-left"
              style={{ background: `linear-gradient(90deg, ${accentInk}, color-mix(in srgb, ${accentInk} 35%, transparent))` }}
              initial={animate ? { scaleX: 0 } : false}
              whileInView={animate ? { scaleX: 1 } : undefined}
              viewport={{ once: true, amount: 0.4 }}
              transition={animate ? { duration: 1.1, ease: [0.22, 1, 0.36, 1] } : undefined} />
          </div>
          {/* Mobile connector rail */}
          <div
            aria-hidden="true"
            className="absolute bottom-6 left-[21px] top-6 w-px md:hidden"
            style={{ background: `linear-gradient(180deg, ${accentInk}, color-mix(in srgb, ${accentInk} 25%, transparent))` }}
          />

          <ol className="relative flex list-none flex-col gap-10 p-0 md:grid md:auto-cols-fr md:grid-flow-col md:gap-5">
            {steps.map((step, index) => (
              <motion.li
                key={index}
                className="relative flex gap-5 md:flex-col md:gap-0"
                initial={animate ? { opacity: 0, y: 22 } : false}
                whileInView={animate ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, amount: 0.3 }}
                transition={animate ? { duration: 0.55, delay: index * 0.14, ease: [0.22, 1, 0.36, 1] } : undefined}
              >
                {/* Accent node on the line */}
                <span
                  className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: accentInk,
                    color: onAccent,
                    fontFamily: DISPLAY,
                    boxShadow: `0 0 0 5px ${surface.base}, 0 0 0 6px color-mix(in srgb, ${accentInk} 35%, transparent)`,
                  }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                {/* Compact card under the node */}
                <div
                  className="min-w-0 flex-1 rounded-2xl border p-5 md:mt-7 md:flex-none"
                  style={{
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    boxShadow: dark
                      ? "0 16px 36px -22px rgba(0,0,0,0.65)"
                      : "0 1px 2px rgba(15,23,42,0.04), 0 14px 34px -24px rgba(15,23,42,0.2)",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${accentInk} 12%, transparent)`,
                        color: accentInk,
                      }}
                      aria-hidden="true"
                    >
                      <IconOrImage value={step.icon} fallback={UserPlus} className="h-4 w-4" />
                    </span>
                    <InlineText
                      as="h3"
                      value={step.title}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                      className="text-base font-bold tracking-tight sm:text-lg"
                      style={{ fontFamily: DISPLAY }} />
                  </div>
                  <InlineText
                    as="p"
                    value={step.description}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                    className="text-sm leading-relaxed"
                    style={{ color: muted, fontFamily: BODY }}
                    multiline />
                </div>
              </motion.li>
            ))}
          </ol>
        </div>

        {/* ── Trust badges ── */}
        {(trustItems.length > 0 || onFieldChange) && (
          <div className="mt-14 flex flex-col items-center justify-center gap-3 border-t pt-7 text-sm font-medium md:flex-row md:gap-4" style={{ borderColor: hairline, color: muted }}>
            {trustItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: accentInk }} aria-hidden="true" />
                  <InlineText
                    as="span"
                    value={item}
                    onUpdate={onFieldChange ? (v) => update("trustItems", trustItems.map((t, ti) => (ti === i ? v : t))) : undefined}
                    style={{ fontFamily: BODY }} />
                </span>
                {i < trustItems.length - 1 && (
                  <span className="hidden md:inline" aria-hidden="true" style={{ color: `color-mix(in srgb, ${text} 28%, transparent)` }}>•</span>
                )}
              </div>
            ))}
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
                    source="how-it-works-horizontal-stepper-cta"
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
                    source="how-it-works-horizontal-stepper-cta-secondary"
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
