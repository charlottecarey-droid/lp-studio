import {
  Zap, Layers, TrendingUp, BarChart3, Users, ShieldCheck, CloudLightning,
  Globe2, Clock, Sparkles, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsStatLedBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;
const NUMBERS = BRAND_NUMBERS_FONT;


interface Props {
  props: BenefitsStatLedBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsStatLedBlockProps) => void;
}

export function BlockBenefitsStatLed({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
  const centered = props.headingAlign === "center";

  const update = <K extends keyof BenefitsStatLedBlockProps>(key: K, value: BenefitsStatLedBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStat = (i: number, patch: Partial<BenefitsStatLedBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: props.stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="flex w-full items-center justify-center px-4 py-24 sm:py-32 md:px-8" style={{ background: surface.background, color: text }}>
      <div className="mx-auto w-full max-w-[1200px]">
        <div className={`mb-20 max-w-2xl${centered ? " mx-auto text-center" : ""}`}>
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 block text-sm font-bold uppercase tracking-wider"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mb-6 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="text-lg md:text-xl"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 lg:gap-16">
          {props.stats.map((stat, i) => {
            return (
              <div key={i} className="group flex flex-col">
                <div className="mb-6 transition-transform duration-500 ease-out group-hover:-translate-y-2">
                  <InlineText
                    as="div"
                    value={stat.stat}
                    onUpdate={onFieldChange ? (v) => updateStat(i, { stat: v }) : undefined}
                    className="mb-2 text-7xl font-extrabold leading-none tracking-tighter lg:text-[7.5rem]"
                    style={{ color: accent, fontFamily: NUMBERS }} />
                </div>
                <div className="mb-8 h-px w-full" style={{ backgroundColor: `${text}1f` }} />
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: tint }}>
                    <IconOrImage value={stat.icon} fallback={TrendingUp} className="h-5 w-5" />
                  </div>
                  <div>
                    <InlineText
                      as="h3"
                      value={stat.title}
                      onUpdate={onFieldChange ? (v) => updateStat(i, { title: v }) : undefined}
                      className="mb-3 text-xl font-bold"
                      style={{ fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={stat.description}
                      onUpdate={onFieldChange ? (v) => updateStat(i, { description: v }) : undefined}
                      className="leading-relaxed"
                      style={{ color: muted, fontFamily: BODY }}
                      multiline />
                  </div>
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
                    source="benefits-stat-led-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
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
                    source="benefits-stat-led-cta-secondary"
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
