import { Layers, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsBentoBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { SectionDecor } from "@/lib/premium-toolkit";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Benefits — Bento Grid: the LIGHT, airy bento. Soft brand-tinted card washes
 * (accent / primary mixed at 4–8%), hairline rings, generous padding, and a
 * 2×2 hero tile + small tiles + one wide tile — no glass, no dark mesh, no
 * heavy shadows, so it reads clearly apart from glass-bento-features. Header
 * splits headline left / subheadline right on desktop. Scroll reveals and the
 * gentle hover lift are disabled in the builder and under reduced motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: BenefitsBentoBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsBentoBlockProps) => void;
}

/** Layout span per tile index: tile 0 = large hero (2×2), tile 4 = wide. */
function spanFor(index: number): string {
  if (index === 0) return "@3xl:col-span-2 @3xl:row-span-2";
  if (index === 4) return "@3xl:col-span-2";
  return "";
}

export function BlockBenefitsBento({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;

  const surface = resolveSectionSurface(props, "#FAFAFA", brand);
  const dark = surface.isDark;
  const ink = resolveSectionInk(props, surface);
  const text = ink.text;
  const accentRaw = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accent = pickContrastingColor(accentRaw, surface.base, [primary], 3.0);
  const eyebrowColor = pickContrastingColor(accentRaw, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const muted = ink.muted;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const hairline = ink.hairline;
  const showCta = props.showCta ?? true;

  // ── Soft tinted card washes — varied brand-derived hues at low strength. ──
  const cardBase = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const ring = dark ? "rgba(255,255,255,0.09)" : "rgba(11,11,15,0.07)";
  const tintFor = (i: number): string => {
    if (dark) {
      const mixes = [
        `color-mix(in srgb, ${accentRaw} 14%, ${cardBase})`,
        cardBase,
        `color-mix(in srgb, ${accentRaw} 8%, ${cardBase})`,
        cardBase,
        `color-mix(in srgb, ${accentRaw} 18%, ${cardBase})`,
      ];
      return mixes[i % mixes.length];
    }
    const mixes = [
      `color-mix(in srgb, ${accentRaw} 7%, #FFFFFF)`,
      `color-mix(in srgb, ${primary} 5%, #FFFFFF)`,
      `color-mix(in srgb, ${accentRaw} 4%, #FFFFFF)`,
      "#FFFFFF",
      `color-mix(in srgb, ${accentRaw} 8%, #FFFFFF)`,
    ];
    return mixes[i % mixes.length];
  };

  const update = <K extends keyof BenefitsBentoBlockProps>(key: K, value: BenefitsBentoBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTile = (i: number, patch: Partial<BenefitsBentoBlockProps["tiles"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, tiles: props.tiles.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  return (
    <section
      className="bbento-section @container relative w-full overflow-hidden px-6 py-24 sm:py-28 lg:px-10"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <style>{`
        .bbento-card { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
        @media (hover: hover) {
          .bbento-card:hover {
            transform: translateY(-3px);
            box-shadow: inset 0 0 0 1px ${ring}, 0 14px 32px -16px ${dark ? "rgba(0,0,0,0.6)" : "rgba(15,15,20,0.14)"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bbento-card, .bbento-card:hover { transition: none; transform: none; }
        }
      `}</style>
      <SectionDecor accent={accentRaw} isDark={dark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto max-w-[1200px]">
        {/* ── Split header: headline left, subheadline right (container-tracked). ── */}
        <div className="mb-12 @4xl:mb-16 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] @4xl:items-end @4xl:gap-12">
          <div>
            {(props.eyebrow || onFieldChange) && (
              <div className="mb-4 flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 shrink-0" style={{ backgroundColor: accent }} />
                <InlineText
                  as="p"
                  value={props.eyebrow ?? ""}
                  onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                  className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                  style={{ color: eyebrowColor }} />
              </div>
            )}
            <InlineText
              as="h2"
              value={props.headline}
              onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
              className="max-w-2xl font-bold tracking-tight"
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4vw, 3rem)", lineHeight: 1.08 }}
              multiline />
          </div>
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-4 max-w-xl text-base leading-relaxed @4xl:mt-0 @4xl:pb-1.5 @4xl:text-lg"
              style={{ color: muted }}
              multiline />
          )}
        </div>

        {/* ── Tinted bento grid. ── */}
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3 @4xl:gap-5">
          {props.tiles.map((tile, i) => {
            const isHero = i === 0;
            const isWide = i === 4;
            return (
              <motion.div
                key={i}
                className={cn(
                  "bbento-card relative flex flex-col overflow-hidden rounded-[1.75rem]",
                  isHero ? "p-7 sm:p-9 @3xl:justify-end" : isWide ? "p-7 sm:p-8" : "p-6 sm:p-7",
                  spanFor(i),
                )}
                style={{ backgroundColor: tintFor(i), boxShadow: `inset 0 0 0 1px ${ring}` }}
                initial={still ? false : { opacity: 0, y: 20 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={still ? undefined : { duration: 0.55, delay: Math.min(i * 0.07, 0.4), ease: [0.16, 1, 0.3, 1] }}
              >
                {(isHero || isWide) && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full"
                    style={{
                      background: `radial-gradient(circle, color-mix(in srgb, ${accentRaw} ${isHero ? 20 : 12}%, transparent) 0%, transparent 68%)`,
                    }}
                  />
                )}
                <div
                  className={cn(
                    "relative mb-5 flex items-center justify-center rounded-2xl",
                    isHero ? "h-12 w-12 sm:h-14 sm:w-14" : "h-11 w-11",
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`,
                    color: accent,
                    boxShadow: `inset 0 0 0 1px ${accent}1f`,
                  }}
                  aria-hidden="true"
                >
                  <IconOrImage value={tile.icon} fallback={Layers} className={isHero ? "h-6 w-6" : "h-5 w-5"} />
                </div>
                <InlineText
                  as="h3"
                  value={tile.title}
                  onUpdate={onFieldChange ? (v) => updateTile(i, { title: v }) : undefined}
                  className={cn("font-semibold leading-snug tracking-tight", isHero ? "text-xl sm:text-2xl" : "text-base sm:text-lg")}
                  style={{ fontFamily: DISPLAY }} />
                <InlineText
                  as="p"
                  value={tile.description}
                  onUpdate={onFieldChange ? (v) => updateTile(i, { description: v }) : undefined}
                  className={cn("mt-2.5 leading-relaxed", isHero ? "max-w-md text-sm sm:text-base" : "text-sm")}
                  style={{ color: muted }}
                  multiline />
              </motion.div>
            );
          })}
        </div>

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-20 border-t pt-14 lg:mt-24" style={{ borderColor: hairline }}>
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
                    source="benefits-bento-cta"
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
                    source="benefits-bento-cta-secondary"
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
