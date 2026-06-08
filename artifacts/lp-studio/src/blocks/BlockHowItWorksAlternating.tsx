import {
  LayoutTemplate, MousePointerClick, Zap, Layers, TrendingUp, Rocket,
  Sparkles, Settings, BarChart3, CheckCircle2, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksAlternatingBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";


interface Props {
  props: HowItWorksAlternatingBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksAlternatingBlockProps) => void;
}

/** Decorative abstract product panel shown on each step's "visual" side.
 *  Faithful to the mockup's CSS placeholder (no real imagery). */
function DecorativePanel({ accent, tint }: { accent: string; tint: string }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      <div className="flex h-full w-full flex-col gap-4 bg-neutral-100 p-6">
        <div className="flex h-8 w-full items-center gap-4 rounded-md border border-neutral-200 bg-white px-4 shadow-sm">
          <div className="h-3 w-24 rounded-full bg-neutral-200" />
          <div className="h-3 w-16 rounded-full bg-neutral-200" />
          <div className="h-3 w-16 rounded-full bg-neutral-200" />
          <div className="ml-auto h-4 w-8 rounded-md" style={{ backgroundColor: tint }} />
        </div>
        <div className="flex flex-1 gap-4">
          <div className="flex w-40 flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 h-4 w-24 rounded-full bg-neutral-800" />
            <div className="h-16 w-full rounded-md border border-neutral-200 bg-neutral-100" />
            <div className="relative h-16 w-full rounded-md border-2" style={{ borderColor: accent, backgroundColor: tint }}>
              <div className="absolute right-2 top-2 h-4 w-4 rounded-full" style={{ backgroundColor: accent }} />
            </div>
            <div className="h-16 w-full rounded-md border border-neutral-200 bg-neutral-100" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-6 rounded-md border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="h-8 w-3/4 rounded-md bg-neutral-200" />
            <div className="h-4 w-1/2 rounded-full bg-neutral-200" />
            <div className="mt-4 flex h-28 w-full items-center justify-center rounded-lg border" style={{ borderColor: tint, backgroundColor: tint }}>
              <div className="h-8 w-16 rounded-md" style={{ backgroundColor: accent }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlockHowItWorksAlternating({ props, brand, onFieldChange }: Props) {
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

  const update = <K extends keyof HowItWorksAlternatingBlockProps>(key: K, value: HowItWorksAlternatingBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksAlternatingBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="w-full px-6 py-24 sm:py-32 lg:px-8" style={{ backgroundColor: bg, color: text }}>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mx-auto mb-20 max-w-2xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-base font-semibold leading-7"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-6 text-lg leading-8"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="flex flex-col gap-24">
          {steps.map((step, index) => {
            const isReversed = index % 2 !== 0;
            return (
              <div
                key={index}
                className={`flex flex-col items-center gap-12 lg:gap-20 ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"}`}
              >
                <div className="flex flex-col items-start lg:w-1/2">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: tint, color: accent }}>
                    <IconOrImage value={step.icon} fallback={LayoutTemplate} className="h-6 w-6" />
                  </div>
                  <InlineText
                    as="h3"
                    value={step.title}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                    className="mb-4 text-2xl font-bold tracking-tight"
                    style={{ fontFamily: DISPLAY }} />
                  <InlineText
                    as="p"
                    value={step.description}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                    className="mb-8 text-lg leading-relaxed"
                    style={{ color: muted, fontFamily: BODY }}
                    multiline />
                  <ul className="flex flex-col gap-3">
                    {(step.features ?? []).map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: accent }} />
                        <InlineText
                          as="span"
                          value={feature}
                          onUpdate={onFieldChange ? (v) => updateStep(index, { features: (step.features ?? []).map((f, fi) => (fi === i ? v : f)) }) : undefined}
                          style={{ color: muted, fontFamily: BODY }} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-full lg:w-1/2">
                  <DecorativePanel accent={accent} tint={tint} />
                </div>
              </div>
            );
          })}
        </div>

        {showCta && (
          <div className="mt-24 border-t pt-16" style={{ borderColor: `${text}1a` }}>
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
                    source="how-it-works-alternating-cta"
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
                    source="how-it-works-alternating-cta-secondary"
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
