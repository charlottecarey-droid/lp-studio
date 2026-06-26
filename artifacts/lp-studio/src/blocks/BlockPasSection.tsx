import { cn } from "@/lib/utils";
import type { PasSectionBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import {
  SECTION_PY,
  getHeadingWeightClass,
  getHeadingLetterSpacingClass,
  getBodySizeClass,
  contrastTextColor,
  pickContrastingColor,
  isValidHex,
  DEFAULT_BRAND,
} from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Reveal, AccentGlow } from "@/lib/premium-toolkit";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/* ----------------------------------------------------------------------------
 * PAS — Section: Problem-Agitate-Solve on a brand-primary surface.
 * Split layout: headline + subheadline on one side, the pain points on the
 * other as refined glass cards (alert-triangle markers in gradient chips).
 * A surface-aware accent glow + a soft depth gradient give the band dimension,
 * and an optional accent-tinted solution panel closes the beat with a forward
 * cue. Colors are derived from the brand primary fill and type uses the brand
 * display/body fonts, so the block stays fully brand-aware. All motion is gated
 * to the published page (disabled in the builder for stable editing).
 * -------------------------------------------------------------------------- */

interface Props {
  props: PasSectionBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSectionBlockProps) => void;
}

export function BlockPasSection({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  // This section is painted with the brand primary. Derive text + accent
  // colors from that actual fill so copy stays legible for light-primary
  // brands and tints never render accent-on-primary (blue on blue).
  const primaryHex = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const onPrimary = contrastTextColor(primaryHex);
  const isDarkSurface = onPrimary === "#ffffff";
  const accentOnPrimary = pickContrastingColor(brand.accentColor, primaryHex, [onPrimary], 3.0);

  const reduce = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduce;

  const update = <K extends keyof PasSectionBlockProps>(key: K, value: PasSectionBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    const newBullets = props.bullets.map((b, i) => (i === index ? value : b));
    onFieldChange({ ...props, bullets: newBullets });
  };

  const bullets = props.bullets ?? [];
  const showBullets = bullets.length > 0 || !!onFieldChange;

  // Surface-derived tints for the glass cards + chips, scaled by surface tone.
  const cardBg = `color-mix(in srgb, ${onPrimary} ${isDarkSurface ? "8%" : "5%"}, transparent)`;
  const cardBorder = `color-mix(in srgb, ${onPrimary} ${isDarkSurface ? "16%" : "11%"}, transparent)`;
  const cardShadow = `0 1px 2px color-mix(in srgb, ${primaryHex} 30%, transparent), 0 26px 50px -34px color-mix(in srgb, ${isDarkSurface ? "#000000" : primaryHex} 55%, transparent)`;
  const chipBg = `linear-gradient(135deg, color-mix(in srgb, ${accentOnPrimary} 24%, transparent), color-mix(in srgb, ${accentOnPrimary} 10%, transparent))`;
  const chipBorder = `1px solid color-mix(in srgb, ${accentOnPrimary} 34%, transparent)`;
  const chipInner = `inset 0 1px 0 color-mix(in srgb, ${onPrimary} 16%, transparent)`;

  return (
    <section
      className={cn("relative w-full overflow-hidden bg-[var(--brand-primary)] px-6", sectionPy)}
      style={{ color: onPrimary }}
    >
      {/* Depth: surface-aware accent glow + a soft vertical vignette. */}
      <AccentGlow color={accentOnPrimary} isDark={isDarkSurface} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, ${onPrimary} ${isDarkSurface ? "6%" : "4%"}, transparent), transparent 60%)`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-2 lg:items-start">
          {/* Left — eyebrow pill + headline + subheadline. */}
          <Reveal disabled={!animate} y={20}>
            <div>
              {props.eyebrow && (
                <div
                  className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
                  style={{
                    borderColor: `color-mix(in srgb, ${accentOnPrimary} 32%, transparent)`,
                    background: `color-mix(in srgb, ${accentOnPrimary} 10%, transparent)`,
                  }}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: accentOnPrimary }}
                  />
                  <InlineText
                    as="span"
                    value={props.eyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                    className="text-[11px] font-bold uppercase tracking-[0.24em]"
                    style={{ color: accentOnPrimary, fontFamily: BODY }}
                  />
                </div>
              )}
              <InlineText
                as="h2"
                value={props.headline}
                onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
                className={cn(
                  getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"),
                  "text-balance font-display leading-[1.06]",
                  getHeadingWeightClass(brand),
                  getHeadingLetterSpacingClass(brand),
                )}
                style={{ fontFamily: DISPLAY }}
              />
              {/* Short accent rule for a crafted hierarchy beat. */}
              <div
                aria-hidden
                className="mt-7 h-px w-16 rounded-full"
                style={{ background: `linear-gradient(90deg, ${accentOnPrimary}, transparent)` }}
              />
              <InlineText
                as="p"
                value={props.body}
                onUpdate={onFieldChange ? (v) => update("body", v) : undefined}
                className={cn(getBodySizeClass(brand), "mt-6 max-w-[55ch] leading-relaxed lg:text-lg")}
                multiline
                style={{ fontFamily: BODY, color: `color-mix(in srgb, ${onPrimary} 80%, transparent)` }}
              />
            </div>
          </Reveal>

          {/* Right — pain points as refined glass cards (alert-triangle chips). */}
          {showBullets && (
            <ul className="flex flex-col gap-4">
              {bullets.map((bullet, i) => (
                <li key={i}>
                  <Reveal disabled={!animate} delay={0.06 * (i + 1)} y={16}>
                    <div
                      className="group flex items-start gap-4 rounded-2xl border p-4 transition-transform duration-300 motion-safe:hover:-translate-y-0.5 sm:p-5"
                      style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: chipBg, border: chipBorder, boxShadow: chipInner }}
                      >
                        <AlertTriangle
                          className="h-[18px] w-[18px]"
                          style={{ color: accentOnPrimary }}
                          strokeWidth={2.25}
                        />
                      </span>
                      <InlineText
                        as="span"
                        value={bullet}
                        onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined}
                        className="block flex-1 self-center text-base font-medium leading-relaxed"
                        multiline
                        style={{ fontFamily: BODY, color: `color-mix(in srgb, ${onPrimary} 92%, transparent)` }}
                      />
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Solve — optional closing line in a distinct accent panel with a
            forward cue that resolves the agitation beat. */}
        {props.solutionText && (
          <Reveal disabled={!animate} delay={0.12} y={20}>
            <div
              className="relative mt-14 flex items-start gap-5 overflow-hidden rounded-[1.75rem] border p-6 sm:p-8"
              style={{
                background: `color-mix(in srgb, ${accentOnPrimary} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${accentOnPrimary} 32%, transparent)`,
              }}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex"
                style={{ background: chipBg, border: chipBorder, boxShadow: chipInner }}
              >
                <ArrowRight className="h-5 w-5" style={{ color: accentOnPrimary }} strokeWidth={2.5} />
              </span>
              <InlineText
                as="p"
                value={props.solutionText ?? ""}
                onUpdate={onFieldChange ? (v) => update("solutionText", v) : undefined}
                className="self-center text-lg font-semibold leading-snug sm:text-xl"
                multiline
                style={{ fontFamily: DISPLAY, color: onPrimary }}
              />
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
