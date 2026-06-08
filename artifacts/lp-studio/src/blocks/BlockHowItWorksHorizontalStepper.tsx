import {
  UserPlus, Zap, Rocket, Settings, Plug, Workflow, Sparkles,
  ShieldCheck, CheckCircle2, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksHorizontalStepperBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";


interface Props {
  props: HowItWorksHorizontalStepperBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksHorizontalStepperBlockProps) => void;
}

export function BlockHowItWorksHorizontalStepper({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FAFAFA";
  const text = props.textColor ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}1a`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, bg, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
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
    <section className="w-full px-4 py-24 md:px-8" style={{ backgroundColor: bg, color: text }}>
      <div className="container mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="h2"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                className="mb-3 text-sm font-bold uppercase tracking-wider"
                style={{ color: accent, fontFamily: BODY }} />
            )}
            <InlineText
              as="h3"
              value={props.headline}
              onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
              className="text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ fontFamily: DISPLAY }} />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
                className="mt-4 max-w-xl text-lg"
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
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.headerCtaLabel || "Start free trial"}
              <ArrowRight className="h-4 w-4" />
            </CtaButton>
          )}
        </div>

        <div className="relative">
          {/* Progress rail */}
          <div className="absolute left-0 top-8 -z-0 hidden h-[2px] w-full md:block" style={{ backgroundColor: `${text}1f` }} />

          <div className="relative z-10 grid snap-x snap-mandatory auto-cols-[80%] grid-flow-col gap-8 overflow-x-auto pb-2 md:auto-cols-auto md:grid-flow-row md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0">
            {steps.map((step, index) => {
              return (
                <div key={index} className="group relative flex snap-start flex-col items-center text-center md:items-start md:text-left">
                  <div className="mb-6 flex w-full items-center justify-center gap-4 md:mb-8 md:justify-start">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm transition-transform group-hover:scale-105 group-hover:shadow-md">
                      <IconOrImage value={step.icon} fallback={UserPlus} className="h-5 w-5" />
                      <div className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-sm" style={{ backgroundColor: tint, color: accent }}>
                        {index + 1}
                      </div>
                    </div>
                  </div>
                  <InlineText
                    as="h4"
                    value={step.title}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                    className="mb-2 text-xl font-bold"
                    style={{ fontFamily: DISPLAY }} />
                  <InlineText
                    as="p"
                    value={step.description}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                    className="leading-relaxed md:pr-6"
                    style={{ color: muted, fontFamily: BODY }}
                    multiline />
                </div>
              );
            })}
          </div>
        </div>

        {(trustItems.length > 0 || onFieldChange) && (
          <div className="mt-20 flex flex-col items-center justify-center gap-4 border-t pt-8 text-sm font-medium md:flex-row" style={{ borderColor: `${text}1a`, color: muted }}>
            {trustItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />
                  <InlineText
                    as="span"
                    value={item}
                    onUpdate={onFieldChange ? (v) => update("trustItems", trustItems.map((t, ti) => (ti === i ? v : t))) : undefined}
                    style={{ fontFamily: BODY }} />
                </span>
                {i < trustItems.length - 1 && <span className="hidden md:inline" style={{ color: `${text}40` }}>•</span>}
              </div>
            ))}
          </div>
        )}

        {showCta && (
          <div className="mt-20 border-t pt-16" style={{ borderColor: `${text}1a` }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-xs font-bold uppercase tracking-[0.18em]"
                    style={{ color: accent, fontFamily: BODY }} />
                )}
                {(props.ctaHeading || onFieldChange) && (
                  <InlineText
                    as="h3"
                    value={props.ctaHeading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                    <ArrowRight className="h-4 w-4" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="how-it-works-horizontal-stepper-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
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
