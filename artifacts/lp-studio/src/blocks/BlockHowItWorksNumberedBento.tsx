import { Plug, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksNumberedBentoBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";

/* ----------------------------------------------------------------------------
 * How It Works — Numbered Bento (2026 redesign)
 *
 * A six-column bento of steps with intentionally varied tile footprints, big
 * zero-padded numerals set in the display font as design elements, an optional
 * real-image tile, and the last step rendered as the accent panel. Tile
 * surfaces adapt to light/dark sections; all color is brand-derived and the
 * staggered reveal is disabled in the builder and under reduced motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: HowItWorksNumberedBentoBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksNumberedBentoBlockProps) => void;
}

/** Varied tile footprints on the 6-col grid, keyed by step index and whether
 *  the optional image tile occupies the first row's remaining columns. */
function tileSpan(index: number, total: number, hasImageTile: boolean): string {
  if (hasImageTile) {
    // Row 1: step 0 (4 cols) + image tile (2 cols). Then alternate rhythms.
    if (index === 0) return "md:col-span-4";
    const rest = total - 1;
    const pos = index - 1;
    if (rest === 2) return "md:col-span-3";
    if (rest === 3) return pos === 2 ? "md:col-span-2" : "md:col-span-2";
    return pos % 4 < 2 ? "md:col-span-3" : "md:col-span-3";
  }
  if (total <= 2) return "md:col-span-3";
  if (total === 3) return index === 0 ? "md:col-span-4" : index === 1 ? "md:col-span-2" : "md:col-span-6";
  if (total === 4) return index === 0 || index === 3 ? "md:col-span-4" : "md:col-span-2";
  // 5+: 4/2 then 2/2/2 rows, repeating.
  const mod = index % 5;
  return mod === 0 ? "md:col-span-4" : mod === 1 ? "md:col-span-2" : "md:col-span-2";
}

export function BlockHowItWorksNumberedBento({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FAFAF8", brand);
  const dark = surface.isDark;
  const ink = resolveSectionInk(props, surface);
  const text = ink.text;
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accentInk = pickContrastingColor(accent, surface.base, [primary, text], 3.0);
  const eyebrowColor = pickContrastingColor(accent, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const onAccent = pickContrastingColor(undefined, accentInk, ["#FFFFFF", "#0f172a"]);
  const onAccentMuted = `color-mix(in srgb, ${onAccent} 78%, transparent)`;
  const muted = ink.muted;
  const hairline = ink.hairline;
  const tileBg = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const tileBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(11,11,15,0.07)";
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const animate = !isBuilder && !reduced;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const steps = props.steps ?? [];
  const hasImageTile = !!props.imageUrl?.trim() || isBuilder;

  const update = <K extends keyof HowItWorksNumberedBentoBlockProps>(key: K, value: HowItWorksNumberedBentoBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksNumberedBentoBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  const tileMotion = (order: number) => ({
    initial: animate ? { opacity: 0, y: 24 } : (false as const),
    whileInView: animate ? { opacity: 1, y: 0 } : undefined,
    viewport: { once: true, amount: 0.2 },
    transition: animate
      ? { duration: 0.55, delay: Math.min(order * 0.08, 0.4), ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
      : undefined,
  });

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 sm:py-24 lg:px-8 lg:py-32"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <style>{`
        .hiwnb-tile { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease; }
        @media (hover: hover) { .hiwnb-tile:hover { transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) {
          .hiwnb-tile, .hiwnb-tile:hover { transform: none; transition: none; }
        }
      `}</style>
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-14 max-w-2xl lg:mb-20">
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
            className="mb-5 font-bold tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4vw, 3.25rem)", lineHeight: 1.08 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:gap-5">
          {steps.map((step, index) => {
            const isAccent = index === steps.length - 1 && steps.length > 1;
            const numeral = String(index + 1).padStart(2, "0");
            const span = tileSpan(index, steps.length, hasImageTile);
            const order = hasImageTile && index > 0 ? index + 1 : index;
            const tiles = [
              <motion.div
                key={`step-${index}`}
                className={`hiwnb-tile group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl border p-7 sm:p-8 ${span}`}
                style={
                  isAccent
                    ? {
                        background: `linear-gradient(135deg, ${accentInk}, color-mix(in srgb, ${accentInk} 82%, #07070B))`,
                        color: onAccent,
                        borderColor: "transparent",
                        boxShadow: `0 24px 50px -22px color-mix(in srgb, ${accentInk} 55%, transparent)`,
                      }
                    : {
                        backgroundColor: tileBg,
                        borderColor: tileBorder,
                        boxShadow: dark
                          ? "0 18px 40px -24px rgba(0,0,0,0.7)"
                          : "0 1px 2px rgba(15,23,42,0.04), 0 14px 36px -26px rgba(15,23,42,0.22)",
                      }
                }
                {...tileMotion(order)}
              >
                {/* Oversized numeral as a design element */}
                <span
                  className="pointer-events-none absolute -bottom-7 -right-2 select-none font-black leading-none"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(7rem, 11vw, 10rem)",
                    letterSpacing: "-0.06em",
                    color: isAccent
                      ? `color-mix(in srgb, ${onAccent} 16%, transparent)`
                      : `color-mix(in srgb, ${accentInk} 9%, transparent)`,
                  }}
                  aria-hidden="true"
                >
                  {numeral}
                </span>
                <div className="relative z-10 flex items-center justify-between">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                    style={
                      isAccent
                        ? { backgroundColor: `color-mix(in srgb, ${onAccent} 18%, transparent)`, color: onAccent }
                        : {
                            backgroundColor: `color-mix(in srgb, ${accentInk} 12%, transparent)`,
                            color: accentInk,
                            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accentInk} 18%, transparent)`,
                          }
                    }
                    aria-hidden="true"
                  >
                    <IconOrImage value={step.icon} fallback={Plug} className="h-5 w-5" />
                  </span>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: isAccent ? onAccentMuted : eyebrowColor }}
                    aria-hidden="true"
                  >
                    Step {numeral}
                  </span>
                </div>
                <div className="relative z-10 mt-10 max-w-md">
                  <InlineText
                    as="h3"
                    value={step.title}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                    className="mb-2.5 text-xl font-bold tracking-tight sm:text-2xl"
                    style={{ fontFamily: DISPLAY }} />
                  <InlineText
                    as="p"
                    value={step.description}
                    onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                    className="text-sm leading-relaxed sm:text-base"
                    style={{ color: isAccent ? onAccentMuted : muted, fontFamily: BODY }}
                    multiline />
                </div>
              </motion.div>,
            ];
            // Optional real-image tile, slotted after the first step.
            if (index === 0 && hasImageTile) {
              tiles.push(
                <motion.div
                  key="image-tile"
                  className="hiwnb-tile relative min-h-[220px] overflow-hidden rounded-3xl border md:col-span-2"
                  style={{ borderColor: tileBorder, backgroundColor: tileBg }}
                  {...tileMotion(1)}
                >
                  <InlineImage
                    src={props.imageUrl ?? ""}
                    alt={props.imageAlt || props.headline || "How it works"}
                    className="absolute inset-0 h-full w-full object-cover"
                    wrapperClassName="absolute inset-0"
                    loading="lazy"
                    focalPoint={props.imageFocal}
                    onUpdate={onFieldChange ? (src) => update("imageUrl", src) : undefined}
                    onAltUpdate={onFieldChange ? (alt) => update("imageAlt", alt) : undefined}
                    onFocalUpdate={onFieldChange ? (focal) => update("imageFocal", focal) : undefined}
                  />
                </motion.div>,
              );
            }
            return tiles;
          })}
        </div>

        {(props.buttonLabel || onFieldChange) && (
          <div className="mt-14 flex items-center justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.buttonUrl}
              brand={brand}
              source="how-it-works-numbered-bento-button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-base font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: accentInk, color: onAccent, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
            >
              {props.buttonLabel || "Start building for free"}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </CtaButton>
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
                    source="how-it-works-numbered-bento-cta"
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
                    source="how-it-works-numbered-bento-cta-secondary"
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
