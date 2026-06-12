import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { PasStatAgitateBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { StatCounter } from "./StatCounter";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * PAS — Stat Agitate: the agitation leads with one huge tabular-nums stat
 * (count-up on scroll-in, static under reduced motion) beside the problem
 * copy in an asymmetric two-column rhythm. Supporting stats run as a
 * hairline-divided row, and a closing solution line + pill CTA seals it.
 * -------------------------------------------------------------------------- */

interface Props {
  props: PasStatAgitateBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasStatAgitateBlockProps) => void;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockPasStatAgitate({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const surface = resolveSectionSurface(props, "#0F172A");
  const base = surface.base;
  const ink = props.textColor ?? surface.color ?? pickContrastingColor(undefined, base, ["#FFFFFF", "#0F172A"]);
  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  const accentRaw =
    accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : brand.primaryColor);
  const accent = pickContrastingColor(accentRaw, base, [brand.primaryColor, ink], 3.0);
  const muted = `color-mix(in srgb, ${ink} 68%, transparent)`;
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

  const update = <K extends keyof PasStatAgitateBlockProps>(key: K, value: PasStatAgitateBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateStat = (i: number, patch: Partial<PasStatAgitateBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  // Builder edits inline; published pages count up on scroll-in unless the
  // visitor prefers reduced motion (then the value renders statically).
  const statValue = (value: string, i: number) =>
    onFieldChange ? (
      <InlineText as="span" value={value} onUpdate={(v) => updateStat(i, { value: v })} />
    ) : reduced ? (
      <span>{value}</span>
    ) : (
      <StatCounter value={value} />
    );

  const hairline = `color-mix(in srgb, ${ink} 14%, transparent)`;

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      {/* Controlled corner glows in the brand accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accentRaw} 16%, transparent), transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accentRaw} 9%, transparent), transparent 70%)` }}
      />

      <div className="container relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          {/* The agitating number leads. */}
          {lead && (
            <div className="lg:col-span-5">
              <div
                className="font-bold leading-none tracking-tight"
                style={{
                  color: accent,
                  fontFamily: DISPLAY,
                  fontSize: "clamp(4.5rem, 11vw, 7.5rem)",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.03em",
                }}
              >
                {statValue(lead.value, 0)}
              </div>
              <InlineText
                as="p"
                value={lead.label}
                onUpdate={onFieldChange ? (v) => updateStat(0, { label: v }) : undefined}
                className="mt-4 max-w-xs text-sm font-semibold uppercase tracking-[0.16em]"
                style={{ color: muted }}
              />
            </div>
          )}

          {/* Problem copy beside it. */}
          <div className={lead ? "lg:col-span-7" : "lg:col-span-12"}>
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="p"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.26em]"
                style={{ color: accent }}
              />
            )}
            <InlineText
              as="h2"
              value={props.problemHeading}
              onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined}
              className="text-balance font-bold leading-[1.06] tracking-tight"
              style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}
            />
            {(props.problemBody || onFieldChange) && (
              <InlineText as="p" value={props.problemBody ?? ""} onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined} className="mt-5 max-w-[60ch] text-lg leading-relaxed" style={{ color: muted }} multiline />
            )}
          </div>
        </div>

        {/* Supporting stats — hairline-divided row. */}
        {rest.length > 0 && (
          <dl
            className="mt-14 grid grid-cols-1 gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-2 lg:grid-cols-3"
            style={{ borderColor: hairline }}
          >
            {rest.map((s, i) => (
              <div key={i}>
                <dd
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: accent, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}
                >
                  {statValue(s.value, i + 1)}
                </dd>
                <dt className="mt-2 text-sm font-medium leading-snug" style={{ color: muted }}>
                  <InlineText as="span" value={s.label} onUpdate={onFieldChange ? (v) => updateStat(i + 1, { label: v }) : undefined} />
                </dt>
              </div>
            ))}
          </dl>
        )}

        {/* The closing solution beat + CTA. */}
        {(props.solutionHeading || props.solutionBody || props.ctaLabel || onFieldChange) && (
          <div
            className="mt-14 flex flex-col gap-8 border-t pt-10 lg:flex-row lg:items-center lg:justify-between"
            style={{ borderColor: hairline }}
          >
            <div className="max-w-2xl">
              {(props.solutionHeading || onFieldChange) && (
                <InlineText as="h3" value={props.solutionHeading ?? ""} onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined} className="text-balance text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: ink, fontFamily: DISPLAY }} />
              )}
              {(props.solutionBody || onFieldChange) && (
                <InlineText as="p" value={props.solutionBody ?? ""} onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined} className="mt-3 text-base leading-relaxed sm:text-lg" style={{ color: muted }} multiline />
              )}
            </div>
            {(props.ctaLabel || onFieldChange) && (
              <div className="shrink-0">
                <CtaButton
                  {...pickCtaModalConfig(props)}
                  ctaAction={props.ctaAction ?? "url"}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  videoUrl={props.videoUrl}
                  videoPosterUrl={props.videoPosterUrl}
                  brand={brand}
                  source="pas-stat-agitate-cta"
                  className={`group inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
                  style={{
                    backgroundColor: cta.bg,
                    color: cta.text,
                    fontFamily: BODY,
                    outlineColor: accent,
                    boxShadow: `0 16px 40px -16px color-mix(in srgb, ${cta.bg} 55%, transparent)`,
                  }}
                >
                  {props.ctaLabel || "Get started"}
                  <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
                </CtaButton>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
