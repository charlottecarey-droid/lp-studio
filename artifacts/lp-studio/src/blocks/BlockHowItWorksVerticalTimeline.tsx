import {
  Palette, Users, Zap, BarChart3, Plug, Wand2, Rocket, Settings,
  Layers, TrendingUp, Sparkles, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksVerticalTimelineBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";


interface Props {
  props: HowItWorksVerticalTimelineBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksVerticalTimelineBlockProps) => void;
}

export function BlockHowItWorksVerticalTimeline({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}1a`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const steps = props.steps ?? [];

  const update = <K extends keyof HowItWorksVerticalTimelineBlockProps>(key: K, value: HowItWorksVerticalTimelineBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksVerticalTimelineBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="relative w-full overflow-hidden px-6 py-24 sm:py-32 lg:px-8" style={{ background: surface.background, color: text }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-16 max-w-2xl">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-base font-semibold uppercase leading-7 tracking-wide"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="p"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-4 text-lg leading-8"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="relative">
          <div className="absolute left-[27px] bottom-4 top-4 w-px overflow-hidden" style={{ backgroundColor: `${text}1a` }} aria-hidden="true">
            <motion.div
              className="h-full w-full origin-top"
              style={{ background: `linear-gradient(180deg, ${accent}, ${accent}33)` }}
              initial={isBuilder ? false : { scaleY: 0 }}
              whileInView={isBuilder ? undefined : { scaleY: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={isBuilder ? undefined : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
          </div>

          <div className="flex flex-col gap-12 sm:gap-16">
            {steps.map((step, index) => {
              return (
                <motion.div
                  key={index}
                  className="group relative flex items-start gap-8"
                  initial={isBuilder ? false : { opacity: 0, x: -16 }}
                  whileInView={isBuilder ? undefined : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={isBuilder ? undefined : { duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border shadow-sm ring-8 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: surface.base, borderColor: `${accent}33`, color: accent, ["--tw-ring-color" as string]: surface.base }}
                  >
                    <span className="text-lg font-bold">{index + 1}</span>
                  </div>

                  <div className="flex flex-col pt-3 sm:pt-4">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
                        <IconOrImage value={step.icon} fallback={Palette} className="h-4 w-4" />
                      </div>
                      <InlineText
                        as="h3"
                        value={step.title}
                        onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                        className="text-xl font-semibold"
                        style={{ fontFamily: DISPLAY }} />
                    </div>
                    <InlineText
                      as="p"
                      value={step.description}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                      className="max-w-xl text-base leading-7"
                      style={{ color: muted, fontFamily: BODY }}
                      multiline />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {((props.primaryButtonLabel || props.secondaryButtonLabel) || onFieldChange) && (
          <div className="mt-20 flex flex-wrap items-center gap-4">
            {(props.primaryButtonLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.primaryButtonUrl}
                brand={brand}
                source="how-it-works-vertical-timeline-primary"
                className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold shadow-sm"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
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
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-semibold"
                style={{ color: muted, fontFamily: BODY }}
              >
                {props.secondaryButtonLabel || "View examples"}
                <ArrowRight className="h-4 w-4" />
              </CtaButton>
            )}
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
                    source="how-it-works-vertical-timeline-cta"
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
                    source="how-it-works-vertical-timeline-cta-secondary"
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
