import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { CtaStatBackedBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { StatCounter } from "./StatCounter";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * CTA — Stat Backed: leads with the number. The first stat renders as a huge
 * tabular-nums display figure (count-up on scroll-in, static under reduced
 * motion) in an asymmetric two-column rhythm beside the CTA copy; remaining
 * stats stack underneath as a hairline-divided list.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CtaStatBackedBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaStatBackedBlockProps) => void;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockCtaStatBacked({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const sectionBg = resolveSectionSurface(props, "#ffffff");
  // Legacy `surfaceColor` still paints the stat column as a panel when set.
  const surfaceHex =
    props.surfaceColor && isValidHex(props.surfaceColor) ? props.surfaceColor : undefined;
  const base = sectionBg.base;
  const statBase = surfaceHex ?? base;

  const ink = props.textColor ?? sectionBg.color ?? pickContrastingColor(undefined, base, ["#0f172a", "#ffffff"]);
  const statInk = surfaceHex ? pickContrastingColor(undefined, surfaceHex, ["#0f172a", "#ffffff"]) : ink;
  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  // Big numerals must stay legible on whatever surface they sit on.
  const statAccent = pickContrastingColor(
    accentPref ?? brand.accentColor,
    statBase,
    [brand.primaryColor, statInk],
    3.0,
  );
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const statMuted = `color-mix(in srgb, ${statInk} 60%, transparent)`;
  const cta = accentPref
    ? (() => {
        const bg = pickContrastingColor(accentPref, base, [brand.accentColor, brand.primaryColor], 3.0);
        return { bg, text: pickContrastingColor(brand.ctaText, bg, [contrastTextColor(bg)], 4.5) };
      })()
    : pickCtaButtonColors(brand, base);

  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const stats = props.stats ?? [];
  const lead = stats[0];
  const rest = stats.slice(1);

  const update = <K extends keyof CtaStatBackedBlockProps>(key: K, value: CtaStatBackedBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStat = (i: number, key: "value" | "label", value: string) => {
    if (!onFieldChange) return;
    const next = stats.map((stat, idx) => (idx === i ? { ...stat, [key]: value } : stat));
    onFieldChange({ ...props, stats: next });
  };

  // Builder edits inline; published pages tick up on scroll-in unless the
  // visitor prefers reduced motion (then the value renders statically).
  const statValue = (value: string, i: number) =>
    onFieldChange ? (
      <InlineText as="span" value={value} onUpdate={(v: string) => updateStat(i, "value", v)} />
    ) : reduced ? (
      <span>{value}</span>
    ) : (
      <StatCounter value={value} />
    );

  return (
    <section className="w-full py-20 sm:py-28" style={{ background: sectionBg.background, fontFamily: BODY }}>
      <div className="container mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Lead stat column — the number does the talking. */}
          <div className="lg:col-span-5">
            <div
              className={surfaceHex ? "rounded-3xl p-8 sm:p-10" : undefined}
              style={surfaceHex ? { backgroundColor: surfaceHex, color: statInk } : undefined}
            >
              {lead && (
                <div>
                  <div
                    className="font-bold leading-none tracking-tight"
                    style={{
                      color: statAccent,
                      fontFamily: DISPLAY,
                      fontSize: "clamp(4rem, 10vw, 6.75rem)",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {statValue(lead.value, 0)}
                  </div>
                  <InlineText
                    as="p"
                    value={lead.label}
                    onUpdate={onFieldChange ? (v: string) => updateStat(0, "label", v) : undefined}
                    className="mt-3 max-w-xs text-sm font-semibold uppercase tracking-[0.16em]"
                    style={{ color: statMuted }}
                  />
                </div>
              )}
              {rest.length > 0 && (
                <dl
                  className="mt-10 space-y-5 border-t pt-8"
                  style={{ borderColor: `color-mix(in srgb, ${statInk} 14%, transparent)` }}
                >
                  {rest.map((stat, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-6">
                      <dd
                        className="order-1 shrink-0 text-3xl font-bold tracking-tight"
                        style={{
                          color: statAccent,
                          fontFamily: DISPLAY,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {statValue(stat.value, i + 1)}
                      </dd>
                      <dt className="order-2 text-right text-sm leading-snug" style={{ color: statMuted }}>
                        <InlineText
                          as="span"
                          value={stat.label}
                          onUpdate={onFieldChange ? (v: string) => updateStat(i + 1, "label", v) : undefined}
                        />
                      </dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          {/* CTA copy column. */}
          <div className="lg:col-span-7">
            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="text-balance font-bold leading-[1.06] tracking-tight"
              style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2.125rem, 4.5vw, 3.5rem)" }}
            />
            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
                className="mt-5 max-w-xl text-lg leading-relaxed"
                style={{ color: muted }}
                multiline
              />
            )}
            {(props.ctaPrimaryLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {(props.ctaPrimaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaPrimaryUrl}
                    brand={brand}
                    source="cta-stat-backed-primary"
                    className={`group inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
                    style={{
                      backgroundColor: cta.bg,
                      color: cta.text,
                      fontFamily: BODY,
                      outlineColor: statAccent,
                      boxShadow: `0 16px 40px -16px color-mix(in srgb, ${cta.bg} 55%, transparent)`,
                    }}
                  >
                    {props.ctaPrimaryLabel || "Get a demo"}
                    <ArrowRight
                      className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="cta-stat-backed-secondary"
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-colors ${FOCUS_RING}`}
                    style={{
                      borderColor: `color-mix(in srgb, ${ink} 22%, transparent)`,
                      color: ink,
                      fontFamily: BODY,
                      outlineColor: statAccent,
                    }}
                  >
                    {props.ctaSecondaryLabel || "Talk to sales"}
                  </CtaButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
