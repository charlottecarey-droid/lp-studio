import {
  Plug, Palette, Wand2, BarChart3, Zap, Rocket, Settings, Layers,
  TrendingUp, Sparkles, ArrowRight,
} from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksNumberedBentoBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Plug, Palette, Wand2, BarChart3, Zap, Rocket, Settings, Layers,
  TrendingUp, Sparkles,
};

interface Props {
  props: HowItWorksNumberedBentoBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksNumberedBentoBlockProps) => void;
}

export function BlockHowItWorksNumberedBento({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FAFAFA";
  const text = props.textColor ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}1a`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, bg, ["#525252", "#a3a3a3"]);
  const onAccentMuted = `${onAccent}cc`;
  const showCta = props.showCta ?? true;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const steps = props.steps ?? [];

  const update = <K extends keyof HowItWorksNumberedBentoBlockProps>(key: K, value: HowItWorksNumberedBentoBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksNumberedBentoBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="w-full px-6 py-24 sm:py-32 lg:px-8" style={{ backgroundColor: bg, color: text }}>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-16 max-w-2xl">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-3 text-sm font-semibold uppercase tracking-wider"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h3"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mb-6 text-4xl font-bold tracking-tight md:text-5xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = ICON_MAP[step.icon] || Plug;
            const isAccent = index === steps.length - 1;
            const span = index === 0 || index === steps.length - 1 ? "md:col-span-2" : "md:col-span-1";
            return (
              <div
                key={index}
                className={`group relative overflow-hidden rounded-3xl p-10 shadow-sm ring-1 transition-all hover:shadow-md ${span}`}
                style={
                  isAccent
                    ? { backgroundColor: accent, color: onAccent, boxShadow: `0 0 0 1px ${accent}` }
                    : { backgroundColor: "#ffffff", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }
                }
              >
                <div
                  className="pointer-events-none absolute -bottom-10 -right-10 select-none text-[12rem] font-black leading-none transition-transform duration-500 group-hover:-translate-x-4 group-hover:-translate-y-4"
                  style={{ color: isAccent ? `${onAccent}33` : "#f5f5f5" }}
                  aria-hidden="true"
                >
                  {index + 1}
                </div>
                <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                  <div
                    className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={isAccent ? { backgroundColor: `${onAccent}26`, color: onAccent } : { backgroundColor: tint, color: accent }}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="max-w-md">
                    <InlineText
                      as="h4"
                      value={step.title}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                      className="mb-3 text-2xl font-bold"
                      style={{ fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={step.description}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                      style={{ color: isAccent ? onAccentMuted : muted, fontFamily: BODY }}
                      multiline />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(props.buttonLabel || onFieldChange) && (
          <div className="mt-16 flex items-center justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.buttonUrl}
              brand={brand}
              source="how-it-works-numbered-bento-button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-base font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.buttonLabel || "Start building for free"}
              <ArrowRight className="h-5 w-5" />
            </CtaButton>
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
                    source="how-it-works-numbered-bento-cta"
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
                    source="how-it-works-numbered-bento-cta-secondary"
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
