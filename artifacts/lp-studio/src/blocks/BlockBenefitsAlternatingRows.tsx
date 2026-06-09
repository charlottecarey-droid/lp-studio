import {
  Zap, Layers, TrendingUp, BarChart3, Users, ShieldCheck, CloudLightning,
  Globe2, Clock, Sparkles, CheckCircle2, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsAlternatingRowsBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;


interface Props {
  props: BenefitsAlternatingRowsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsAlternatingRowsBlockProps) => void;
}

/** Decorative abstract product panel shown on each row's "visual" side.
 *  Faithful to the mockup's CSS placeholder (no real imagery). */
function DecorativePanel({ accent, tint }: { accent: string; tint: string }) {
  return (
    <div className="relative flex h-full min-h-[320px] w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex h-12 items-center gap-1.5 border-b border-black/5 px-4">
        <div className="h-3 w-3 rounded-full bg-black/10" />
        <div className="h-3 w-3 rounded-full bg-black/10" />
        <div className="h-3 w-3 rounded-full bg-black/10" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded-md bg-black/80" />
          <div className="h-8 w-24 rounded-md" style={{ backgroundColor: accent }} />
        </div>
        <div className="grid grid-cols-3 gap-4 pt-2">
          {[0, 1, 2].map((c) => (
            <div key={c} className="flex flex-col gap-3 rounded-xl p-3" style={{ backgroundColor: tint }}>
              <div className="h-4 w-12 rounded bg-black/10" />
              <div className="h-3 w-full rounded bg-black/10" />
              <div className="h-3 w-2/3 rounded bg-black/10" />
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-1 items-end gap-2">
          {[40, 60, 35, 75, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: i % 2 === 0 ? accent : tint }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BlockBenefitsAlternatingRows({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;

  const update = <K extends keyof BenefitsAlternatingRowsBlockProps>(key: K, value: BenefitsAlternatingRowsBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateRow = (i: number, patch: Partial<BenefitsAlternatingRowsBlockProps["rows"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, rows: props.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };

  return (
    <section className="relative w-full overflow-hidden px-6 py-24 md:py-32 md:px-12" style={{ background: surface.background, color: text }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto w-full max-w-[1280px]">
        <div className="mx-auto mb-20 max-w-3xl text-center md:mb-28">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h3"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mb-6 text-3xl font-bold tracking-tight md:text-5xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="text-lg md:text-xl"
              style={{ color: muted, fontFamily: BODY }} />
          )}
        </div>

        <div className="flex flex-col gap-24 md:gap-40">
          {props.rows.map((row, index) => {
            const isReversed = index % 2 !== 0;
            return (
              <motion.div
                key={index}
                className={`flex flex-col items-center gap-12 md:gap-24 ${isReversed ? "md:flex-row-reverse" : "md:flex-row"}`}
                initial={isBuilder ? false : { opacity: 0, y: 32 }}
                whileInView={isBuilder ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={isBuilder ? undefined : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="group flex flex-1 flex-col justify-center">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
                    <IconOrImage value={row.icon} fallback={Zap} className="h-6 w-6" />
                  </div>
                  <InlineText
                    as="h4"
                    value={row.title}
                    onUpdate={onFieldChange ? (v) => updateRow(index, { title: v }) : undefined}
                    className="mb-4 text-2xl font-bold tracking-tight md:text-4xl"
                    style={{ fontFamily: DISPLAY }} />
                  <InlineText
                    as="p"
                    value={row.description}
                    onUpdate={onFieldChange ? (v) => updateRow(index, { description: v }) : undefined}
                    className="mb-8 text-lg"
                    style={{ color: muted, fontFamily: BODY }}
                    multiline />
                  <ul className="mb-8 flex flex-col gap-4">
                    {row.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: accent }} />
                        <InlineText
                          as="span"
                          value={feature}
                          onUpdate={onFieldChange ? (v) => updateRow(index, { features: row.features.map((f, fi) => (fi === i ? v : f)) }) : undefined}
                          style={{ fontFamily: BODY }} />
                      </li>
                    ))}
                  </ul>
                  {(row.linkLabel || onFieldChange) && (
                    <div>
                      <a
                        href={row.linkUrl || "#"}
                        className="group inline-flex items-center gap-2 font-medium"
                        style={{ color: accent, fontFamily: BODY }}
                      >
                        <InlineText
                          as="span"
                          value={row.linkLabel ?? ""}
                          onUpdate={onFieldChange ? (v) => updateRow(index, { linkLabel: v }) : undefined} />
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </a>
                    </div>
                  )}
                </div>

                <motion.div
                  className="relative w-full flex-1 md:w-1/2"
                  initial={isBuilder ? false : { opacity: 0, scale: 0.96 }}
                  whileInView={isBuilder ? undefined : { opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={isBuilder ? undefined : { duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="absolute inset-0 -m-8 rounded-[3rem] opacity-0 md:opacity-100" style={{ backgroundColor: tint }} />
                  <div className="relative">
                    {row.image && row.image.trim() ? (
                      <InlineImage
                        src={row.image}
                        alt={row.imageAlt ?? row.title}
                        className="aspect-[4/3] w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/10"
                        wrapperClassName="block w-full"
                        onUpdate={onFieldChange ? (url) => updateRow(index, { image: url }) : undefined}
                        onAltUpdate={onFieldChange ? (v) => updateRow(index, { imageAlt: v }) : undefined}
                        focalPoint={row.imageFocal}
                        onFocalUpdate={onFieldChange ? (v) => updateRow(index, { imageFocal: v }) : undefined}
                      />
                    ) : (
                      <DecorativePanel accent={accent} tint={tint} />
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {showCta && (
          <div className="mt-24 border-t pt-20 md:mt-40 md:pt-28" style={{ borderColor: `${text}1a` }}>
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
                    source="benefits-alternating-rows-cta"
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
                    source="benefits-alternating-rows-cta-secondary"
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
