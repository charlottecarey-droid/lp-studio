import {
  Check, Shield, Zap, Globe, Layers, MessageSquare, Database,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import { Fragment } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesComparisonChecklistBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;


interface Props {
  props: FeaturesComparisonChecklistBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesComparisonChecklistBlockProps) => void;
}

export function BlockFeaturesComparisonChecklist({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
  const showBespokeCard = props.showBespokeCard ?? true;
  const categories = props.categories ?? [];
  const isBuilder = !!onFieldChange;

  const update = <K extends keyof FeaturesComparisonChecklistBlockProps>(key: K, value: FeaturesComparisonChecklistBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateFeature = (
    catIndex: number,
    featIndex: number,
    patch: Partial<FeaturesComparisonChecklistBlockProps["categories"][number]["features"][number]>,
  ) => {
    if (!onFieldChange) return;
    onFieldChange({
      ...props,
      categories: categories.map((cat, ci) =>
        ci === catIndex
          ? { ...cat, features: cat.features.map((f, fi) => (fi === featIndex ? { ...f, ...patch } : f)) }
          : cat,
      ),
    });
  };

  const updateCategory = (catIndex: number, patch: Partial<FeaturesComparisonChecklistBlockProps["categories"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, categories: categories.map((cat, ci) => (ci === catIndex ? { ...cat, ...patch } : cat)) });
  };

  return (
    <section className="relative flex w-full flex-col items-center overflow-hidden px-6 py-24" style={{ background: surface.background, color: text }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 w-full max-w-5xl">
        <div className="mb-16 text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-3 text-sm font-bold uppercase tracking-widest"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h3"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mb-6 text-3xl font-extrabold tracking-tight md:text-5xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mx-auto max-w-2xl text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 border-b border-neutral-200 bg-neutral-50 px-6 py-4 md:grid-cols-[1fr_200px] md:px-8">
            <InlineText
              as="div"
              value={props.featureColumnLabel ?? "Feature & Description"}
              onUpdate={onFieldChange ? (v) => update("featureColumnLabel", v) : undefined}
              className="text-sm font-semibold uppercase tracking-wider text-neutral-500"
              style={{ fontFamily: BODY }} />
            <InlineText
              as="div"
              value={props.includedColumnLabel ?? "Included"}
              onUpdate={onFieldChange ? (v) => update("includedColumnLabel", v) : undefined}
              className="hidden text-center text-sm font-semibold uppercase tracking-wider text-neutral-500 md:block"
              style={{ fontFamily: BODY }} />
          </div>

          <div className="divide-y divide-neutral-100">
            {categories.map((category, catIndex) => (
              <Fragment key={catIndex}>
                <div className="bg-neutral-50/50 px-6 py-3 md:px-8">
                  <InlineText
                    as="h4"
                    value={category.title}
                    onUpdate={onFieldChange ? (v) => updateCategory(catIndex, { title: v }) : undefined}
                    className="text-sm font-semibold text-neutral-900"
                    style={{ fontFamily: DISPLAY }} />
                </div>
                {category.features.map((feature, featIndex) => {
                  return (
                    <motion.div
                      key={featIndex}
                      className="group grid grid-cols-1 items-center gap-4 px-6 py-5 transition-colors hover:bg-neutral-50 md:grid-cols-[1fr_200px] md:px-8 md:py-6"
                      initial={isBuilder ? false : { opacity: 0, y: 12 }}
                      whileInView={isBuilder ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={isBuilder ? undefined : { duration: 0.45, delay: featIndex * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
                          <IconOrImage value={feature.icon} fallback={Layers} className="h-5 w-5" />
                        </div>
                        <div>
                          <InlineText
                            as="h4"
                            value={feature.name}
                            onUpdate={onFieldChange ? (v) => updateFeature(catIndex, featIndex, { name: v }) : undefined}
                            className="text-base font-semibold text-neutral-900"
                            style={{ fontFamily: DISPLAY }} />
                          <InlineText
                            as="p"
                            value={feature.description}
                            onUpdate={onFieldChange ? (v) => updateFeature(catIndex, featIndex, { description: v }) : undefined}
                            className="mt-1 max-w-lg text-sm leading-relaxed text-neutral-500"
                            style={{ fontFamily: BODY }}
                            multiline />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
                          <Check className="h-5 w-5 stroke-[3]" />
                        </div>
                        <span className="text-sm font-medium text-neutral-600 md:hidden">Included in all plans</span>
                      </div>
                    </motion.div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {showBespokeCard && (
          <div className="mt-12 flex flex-col items-center gap-6 rounded-2xl p-8 ring-1 sm:flex-row sm:justify-between" style={{ backgroundColor: tint, "--tw-ring-color": `${accent}33` } as React.CSSProperties}>
            <div>
              {(props.bespokeHeading || onFieldChange) && (
                <InlineText
                  as="h4"
                  value={props.bespokeHeading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("bespokeHeading", v) : undefined}
                  className="text-lg font-semibold text-neutral-900"
                  style={{ fontFamily: DISPLAY }} />
              )}
              {(props.bespokeSubheading || onFieldChange) && (
                <InlineText
                  as="p"
                  value={props.bespokeSubheading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("bespokeSubheading", v) : undefined}
                  className="mt-1 text-sm text-neutral-600"
                  style={{ fontFamily: BODY }}
                  multiline />
              )}
            </div>
            {(props.bespokeButtonLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.bespokeButtonUrl}
                brand={brand}
                source="features-comparison-checklist-bespoke"
                className="inline-flex shrink-0 items-center justify-center rounded-md px-8 py-4 text-base font-semibold"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
              >
                {props.bespokeButtonLabel || "Contact sales"}
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
                    source="features-comparison-checklist-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-comparison-checklist-cta-secondary"
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
