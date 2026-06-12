import { Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsAlternatingRowsBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Benefits — Alternating Rows: editorial zig-zag section. Asymmetric 5/7 rows
 * (copy column vs. media column), each led by an optional uppercase kicker,
 * an h3 title and a measure-limited body, with a checklist and inline link.
 * The media side renders a real image (rounded-2xl, ring, soft layered shadow,
 * slightly rotated accent tint mat behind it) or a CSS product mockup
 * fallback. Surface-aware (light/dark presets) and brand-accent driven, with
 * scroll reveals fully disabled in the builder and under reduced motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: BenefitsAlternatingRowsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsAlternatingRowsBlockProps) => void;
}

/** Decorative abstract product panel shown when a row has no real image. */
function DecorativePanel({
  accent,
  dark,
}: {
  accent: string;
  dark: boolean;
}) {
  const line = dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.08)";
  const block = dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.07)";
  const strong = dark ? "rgba(255,255,255,0.85)" : "rgba(11,11,15,0.82)";
  const tile = `color-mix(in srgb, ${accent} 8%, transparent)`;
  return (
    <div
      className="relative flex aspect-[4/3] w-full flex-col overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: dark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
        borderColor: line,
      }}
    >
      <div className="flex h-11 items-center gap-1.5 border-b px-4" style={{ borderColor: line }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: block }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 rounded-md" style={{ backgroundColor: strong }} />
          <div className="h-7 w-20 rounded-md" style={{ backgroundColor: accent }} />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[0, 1, 2].map((c) => (
            <div key={c} className="flex flex-col gap-2.5 rounded-xl p-3" style={{ backgroundColor: tile }}>
              <div className="h-3.5 w-10 rounded" style={{ backgroundColor: block }} />
              <div className="h-2.5 w-full rounded" style={{ backgroundColor: block }} />
              <div className="h-2.5 w-2/3 rounded" style={{ backgroundColor: block }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex flex-1 items-end gap-2">
          {[40, 60, 35, 75, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                backgroundColor: i % 2 === 0 ? accent : tile,
                opacity: i % 2 === 0 ? 0.85 : 1,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BlockBenefitsAlternatingRows({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;

  const surface = resolveSectionSurface(props, "#FFFFFF");
  const dark = surface.isDark;
  const text = props.textColor ?? surface.color ?? (dark ? "#F6F7F9" : "#0B0B0F");
  const accentRaw = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accent = pickContrastingColor(accentRaw, surface.base, [primary], 3.0);
  const eyebrowColor = pickContrastingColor(accentRaw, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const muted = dark ? "rgba(246,247,249,0.62)" : "rgba(11,11,15,0.62)";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.10)";
  const showCta = props.showCta ?? true;

  const update = <K extends keyof BenefitsAlternatingRowsBlockProps>(key: K, value: BenefitsAlternatingRowsBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateRow = (i: number, patch: Partial<BenefitsAlternatingRowsBlockProps["rows"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, rows: props.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 sm:py-24 md:px-10 lg:py-28"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative mx-auto w-full max-w-[1200px]">
        {/* ── Section header — left-aligned, editorial. ── */}
        <div className="mb-16 max-w-3xl lg:mb-24">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.26em]"
              style={{ color: eyebrowColor }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="font-bold tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.06 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-4 max-w-2xl text-base leading-relaxed lg:text-lg"
              style={{ color: muted }}
              multiline />
          )}
        </div>

        {/* ── Alternating rows: 5/7 asymmetric split, varied rhythm. ── */}
        <div className="flex flex-col gap-20 md:gap-28 lg:gap-32">
          {props.rows.map((row, index) => {
            const isReversed = index % 2 !== 0;
            return (
              <motion.div
                key={index}
                className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-12 lg:gap-16"
                initial={still ? false : { opacity: 0, y: 28 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={still ? undefined : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Copy column */}
                <div className={cn("flex flex-col justify-center md:col-span-5", isReversed && "md:order-last")}>
                  {(row.kicker || onFieldChange) && (
                    <InlineText
                      as="p"
                      value={row.kicker ?? ""}
                      onUpdate={onFieldChange ? (v) => updateRow(index, { kicker: v }) : undefined}
                      className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
                      style={{ color: eyebrowColor }} />
                  )}
                  {!row.kicker && (row.icon || onFieldChange) && (
                    <div
                      className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                        color: accent,
                      }}
                      aria-hidden="true"
                    >
                      <IconOrImage value={row.icon} fallback={Zap} className="h-5 w-5" />
                    </div>
                  )}
                  <InlineText
                    as="h3"
                    value={row.title}
                    onUpdate={onFieldChange ? (v) => updateRow(index, { title: v }) : undefined}
                    className="mb-4 text-2xl font-bold leading-snug tracking-tight md:text-[1.75rem]"
                    style={{ fontFamily: DISPLAY }}
                    multiline />
                  <InlineText
                    as="p"
                    value={row.description}
                    onUpdate={onFieldChange ? (v) => updateRow(index, { description: v }) : undefined}
                    className="mb-7 max-w-[52ch] text-base leading-relaxed md:text-lg"
                    style={{ color: muted }}
                    multiline />
                  {row.features.length > 0 && (
                    <ul className="mb-7 flex flex-col gap-3.5">
                      {row.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} aria-hidden="true" />
                          <InlineText
                            as="span"
                            value={feature}
                            className="text-[15px] leading-relaxed"
                            onUpdate={onFieldChange ? (v) => updateRow(index, { features: row.features.map((f, fi) => (fi === i ? v : f)) }) : undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {(row.linkLabel || onFieldChange) && (
                    <div>
                      <a
                        href={row.linkUrl || "#"}
                        className="group inline-flex items-center gap-2 rounded-md text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"
                        style={{ color: accent, outlineColor: accent }}
                      >
                        <InlineText
                          as="span"
                          value={row.linkLabel ?? ""}
                          onUpdate={onFieldChange ? (v) => updateRow(index, { linkLabel: v }) : undefined} />
                        <ArrowRight className={cn("h-4 w-4", !reduced && "transition-transform group-hover:translate-x-1")} aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Media column — image with tilted tint mat, or CSS mockup. */}
                <div className={cn("relative md:col-span-7", isReversed && "md:order-first")}>
                  <div
                    className={cn(
                      "absolute -inset-3 hidden rounded-[2rem] md:block lg:-inset-5",
                      isReversed ? "rotate-[1.2deg]" : "rotate-[-1.2deg]",
                    )}
                    style={{ backgroundColor: `color-mix(in srgb, ${accentRaw} ${dark ? 14 : 7}%, transparent)` }}
                    aria-hidden="true"
                  />
                  <div className="relative">
                    {row.image && row.image.trim() ? (
                      <InlineImage
                        src={row.image}
                        alt={row.imageAlt ?? row.title}
                        className={cn(
                          "aspect-[4/3] w-full rounded-2xl object-cover ring-1",
                          dark ? "ring-white/10" : "ring-black/10",
                        )}
                        wrapperClassName="block w-full rounded-2xl"
                        style={{
                          boxShadow: dark
                            ? "0 28px 56px -24px rgba(0,0,0,0.7)"
                            : "0 1px 2px rgba(15,15,20,0.05), 0 24px 48px -20px rgba(15,15,20,0.18)",
                        }}
                        onUpdate={onFieldChange ? (url) => updateRow(index, { image: url }) : undefined}
                        onAltUpdate={onFieldChange ? (v) => updateRow(index, { imageAlt: v }) : undefined}
                        focalPoint={row.imageFocal}
                        onFocalUpdate={onFieldChange ? (v) => updateRow(index, { imageFocal: v }) : undefined}
                      />
                    ) : (
                      <div
                        className="rounded-2xl"
                        style={{
                          boxShadow: dark
                            ? "0 28px 56px -24px rgba(0,0,0,0.7)"
                            : "0 1px 2px rgba(15,15,20,0.05), 0 24px 48px -20px rgba(15,15,20,0.14)",
                        }}
                      >
                        <DecorativePanel accent={accent} dark={dark} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-20 border-t pt-16 md:mt-28 lg:mt-32 lg:pt-20" style={{ borderColor: hairline }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                    style={{ color: eyebrowColor }} />
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
                    className="max-w-xl text-base leading-relaxed md:text-lg"
                    style={{ color: muted }}
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
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
                    source="benefits-alternating-rows-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: `${text}33`, color: text, outlineColor: accent }}
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
