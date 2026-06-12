import { useEffect, useRef, useState } from "react";
import { TrendingUp, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsStatLedBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { parseStatValue, formatStatValue } from "./BlockStatCounterBand";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Benefits — Stat-Led: an asymmetric editorial ledger. The section header sits
 * in a left column; each benefit is a hairline-ruled row led by an oversized
 * numeral (brand numbers font, tabular-nums, counts up on scroll-in — static
 * in the builder and under prefers-reduced-motion) with the title +
 * description subordinate beside it. `headingAlign: "center"` keeps the
 * legacy centered-header stacking.
 * -------------------------------------------------------------------------- */

interface Props {
  props: BenefitsStatLedBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsStatLedBlockProps) => void;
}

/** Big numeral with count-up. Affixes ("+", "%", "x", "$") render verbatim;
 *  only the numeric core animates. Editable raw value in the builder. */
function StatNumeral({
  value,
  color,
  animated,
  delay,
  onUpdate,
}: {
  value: string;
  color: string;
  animated: boolean;
  delay: number;
  onUpdate?: (v: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const parsed = parseStatValue(value);
  const animatable = animated && parsed.num !== null && !onUpdate;
  const [display, setDisplay] = useState(() => (animatable ? formatStatValue(parsed, 0) : value));

  useEffect(() => {
    if (!animatable) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, parsed.num as number, {
      duration: 1.4,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(formatStatValue(parsed, latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, value, delay]);

  const style = {
    fontFamily: NUMBERS,
    fontSize: "clamp(3.25rem, 7vw, 5.5rem)",
    letterSpacing: "-0.04em",
    lineHeight: 0.95,
    color,
    fontVariantNumeric: "tabular-nums" as const,
  };

  if (onUpdate) {
    return (
      <span ref={ref} className="block font-bold tabular-nums" style={style}>
        <InlineText as="span" value={value} onUpdate={onUpdate} />
      </span>
    );
  }
  return (
    <span ref={ref} className="block font-bold tabular-nums" style={style}>
      {display}
    </span>
  );
}

export function BlockBenefitsStatLed({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;

  const surface = resolveSectionSurface(props, "#FFFFFF", brand);
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
  const centered = props.headingAlign === "center";
  const countUp = (props.countUp ?? true) && !still;

  const update = <K extends keyof BenefitsStatLedBlockProps>(key: K, value: BenefitsStatLedBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStat = (i: number, patch: Partial<BenefitsStatLedBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: props.stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  const header = (
    <div className={cn(centered ? "mx-auto mb-16 max-w-2xl text-center" : "max-w-xl")}>
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
        style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.2vw, 3.25rem)", lineHeight: 1.06 }}
        multiline />
      {(props.subheadline || onFieldChange) && (
        <InlineText
          as="p"
          value={props.subheadline ?? ""}
          onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
          className="mt-4 text-base leading-relaxed lg:text-lg"
          style={{ color: muted }}
          multiline />
      )}
    </div>
  );

  const statRows = (
    <div className="flex flex-col">
      {props.stats.map((stat, i) => (
        <motion.div
          key={i}
          className="grid grid-cols-1 items-center gap-5 border-t py-9 sm:grid-cols-[minmax(180px,auto)_1fr] sm:gap-10 lg:py-11"
          style={{ borderColor: hairline }}
          initial={still ? false : { opacity: 0, y: 18 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={still ? undefined : { duration: 0.5, delay: Math.min(i * 0.06, 0.3), ease: [0.16, 1, 0.3, 1] }}
        >
          <StatNumeral
            value={stat.stat}
            color={accent}
            animated={countUp}
            delay={Math.min(i * 0.1, 0.4)}
            onUpdate={onFieldChange ? (v) => updateStat(i, { stat: v }) : undefined}
          />
          <div className="flex items-start gap-4">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 11%, transparent)`,
                color: accent,
              }}
              aria-hidden="true"
            >
              <IconOrImage value={stat.icon} fallback={TrendingUp} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <InlineText
                as="h3"
                value={stat.title}
                onUpdate={onFieldChange ? (v) => updateStat(i, { title: v }) : undefined}
                className="mb-1.5 text-lg font-semibold leading-snug tracking-tight sm:text-xl"
                style={{ fontFamily: DISPLAY }} />
              <InlineText
                as="p"
                value={stat.description}
                onUpdate={onFieldChange ? (v) => updateStat(i, { description: v }) : undefined}
                className="max-w-[52ch] text-sm leading-relaxed sm:text-[15px]"
                style={{ color: muted }}
                multiline />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 sm:py-28 md:px-10"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative z-10 mx-auto w-full max-w-[1200px]">
        {centered ? (
          <>
            {header}
            {statRows}
          </>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-16">
            <div className="mb-14 lg:col-span-5 lg:mb-0">{header}</div>
            <div className="lg:col-span-7">{statRows}</div>
          </div>
        )}

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-16 border-t pt-14 lg:mt-24" style={{ borderColor: hairline }}>
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
                    source="benefits-stat-led-cta"
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
                    source="benefits-stat-led-cta-secondary"
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
