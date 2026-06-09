import {
  LayoutTemplate, MousePointerClick, Zap, Layers, TrendingUp, Rocket,
  Sparkles, Settings, BarChart3, CheckCircle2, ArrowRight, ImageIcon,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksAlternatingBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";


interface Props {
  props: HowItWorksAlternatingBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksAlternatingBlockProps) => void;
}

/** Real product/feature image shown on each step's "visual" side. Renders the
 *  step's image when present; otherwise a neutral image placeholder (populated by
 *  the image-fill pipeline or uploaded in the builder). */
function StepImage({ image, alt, accent, tint }: { image?: string; alt: string; accent: string; tint: string }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-xl ring-1 ring-black/5">
      {image ? (
        <img src={image} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ backgroundColor: tint }}>
          <ImageIcon className="h-10 w-10" style={{ color: accent, opacity: 0.5 }} />
        </div>
      )}
    </div>
  );
}

export function BlockHowItWorksAlternating({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FAFAFA");
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

  const update = <K extends keyof HowItWorksAlternatingBlockProps>(key: K, value: HowItWorksAlternatingBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksAlternatingBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="relative w-full overflow-hidden px-6 py-24 sm:py-32 lg:px-8" style={{ background: surface.background, color: text }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto w-full max-w-7xl">
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
              <motion.div
                key={index}
                className={`flex flex-col items-center gap-12 lg:gap-20 ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"}`}
                initial={isBuilder ? false : { opacity: 0, y: 32 }}
                whileInView={isBuilder ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={isBuilder ? undefined : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="group flex flex-col items-start lg:w-1/2">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
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
                <motion.div
                  className="w-full lg:w-1/2"
                  initial={isBuilder ? false : { opacity: 0, scale: 0.96 }}
                  whileInView={isBuilder ? undefined : { opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={isBuilder ? undefined : { duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <StepImage image={step.image} alt={step.title} accent={accent} tint={tint} />
                </motion.div>
              </motion.div>
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
