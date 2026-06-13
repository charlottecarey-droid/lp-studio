import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";

const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Stat Counter Band — type "stat-counter-band"
 *
 * Full-width metrics band: 3–4 oversized stats (clamped ~64–96px numerals in
 * the brand numbers/display font) that count up when scrolled into view.
 * Affixes like "$", "%", "+", "M+" are preserved while only the numeric core
 * animates. Numbers render with tabular-nums so width never jitters. Under
 * prefers-reduced-motion the final values render immediately.
 * -------------------------------------------------------------------------- */

export interface StatCounterItem {
  /** Display value with optional affixes, e.g. "99.2%", "$4M+", "350+". */
  value: string;
  /** Short label under the numeral (2–5 words). */
  label: string;
  /** Optional small line-icon (Lucide name or image URL/data-URI) shown
   *  top-left of the stat in the `cards`/`outlined` styles. Ignored otherwise. */
  icon?: string;
}

export type StatCounterBackground = "brand-dark" | "mesh" | "light";

/**
 * Structural treatment for the stats:
 *  - "plain"    — bare numerals on the band (the original, default rendering).
 *  - "cards"    — each stat in a rounded soft-fill card (fill derived from the
 *                 section surface so it works on light AND dark bands), with an
 *                 optional small line-icon top-left.
 *  - "outlined" — same card layout but transparent fill + a hairline border.
 *  - "divided"  — no cards; stats separated by thin hairline rules (vertical on
 *                 desktop, horizontal when stacked on mobile).
 */
export type StatCounterStyle = "plain" | "cards" | "outlined" | "divided";

export interface StatCounterBandBlockProps {
  /** Optional one-line kicker rendered above the stats (the section heading). */
  kicker?: string;
  stats: StatCounterItem[];
  /** "brand-dark" = brand-primary gradient, "mesh" = light with faint accent
   *  mesh, "light" = flat light surface. Default "brand-dark". */
  background?: StatCounterBackground;
  /** Section background override (hex). Wins over `background` presets. */
  bgColor?: string;
  /** Accent override (hex). Defaults to the brand accent. */
  accentColor?: string;
  /** Thin top/bottom hairline borders. Default true. */
  showBorders?: boolean;
  /** Structural treatment for the stats. Default "plain" (original rendering). */
  statStyle?: StatCounterStyle;
  /** Count-up duration in ms. Default 1600. */
  durationMs?: number;
}

interface Props {
  props: StatCounterBandBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: StatCounterBandBlockProps) => void;
}

export interface ParsedStatValue {
  /** Non-numeric lead-in, e.g. "$" in "$4M+". */
  prefix: string;
  /** The numeric core to animate, or null when no number was found. */
  num: number | null;
  /** Everything after the numeric core, e.g. "M+" or "%". */
  suffix: string;
  /** Decimal places in the original value (preserved while animating). */
  decimals: number;
  /** Whether the original used thousands separators ("12,000"). */
  grouped: boolean;
}

/** Parse a display stat like "99.2%", "$4M+", "350+", "12,000+" into an
 *  animatable numeric core plus verbatim prefix/suffix affixes. Pure —
 *  unit-tested in BlockStatCounterBand.parse.test.ts. */
export function parseStatValue(raw: string): ParsedStatValue {
  const match = (raw ?? "").match(/^([^0-9]*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
  if (!match) return { prefix: "", num: null, suffix: raw ?? "", decimals: 0, grouped: false };
  const numStr = match[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) {
    return { prefix: "", num: null, suffix: raw, decimals: 0, grouped: false };
  }
  const dot = numStr.indexOf(".");
  return {
    prefix: match[1],
    num,
    suffix: match[3],
    decimals: dot === -1 ? 0 : numStr.length - dot - 1,
    grouped: match[2].includes(","),
  };
}

/** Format an in-flight count-up frame back into the stat's display shape,
 *  re-applying decimals, thousands grouping, and both affixes. Pure. */
export function formatStatValue(parsed: ParsedStatValue, current: number): string {
  if (parsed.num === null) return parsed.suffix;
  let core: string;
  if (parsed.decimals > 0) {
    core = current.toFixed(parsed.decimals);
  } else {
    const rounded = Math.round(current);
    core = parsed.grouped ? rounded.toLocaleString("en-US") : String(rounded);
  }
  return `${parsed.prefix}${core}${parsed.suffix}`;
}

export const STAT_COUNTER_DEFAULT_PROPS: StatCounterBandBlockProps = {
  kicker: "The numbers behind the product",
  background: "brand-dark",
  showBorders: true,
  stats: [
    { value: "99.9%", label: "Uptime, every quarter" },
    { value: "12,000+", label: "Teams shipping daily" },
    { value: "$4M+", label: "Saved in ops costs" },
    { value: "4.9", label: "Average customer rating" },
  ],
};

function StatValue({
  value,
  color,
  reduced,
  durationMs,
  delay,
  onUpdate,
}: {
  value: string;
  color: string;
  reduced: boolean;
  durationMs: number;
  delay: number;
  onUpdate?: (v: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const parsed = parseStatValue(value);
  const animatable = parsed.num !== null && !reduced && !onUpdate;
  const [display, setDisplay] = useState(() =>
    animatable ? formatStatValue(parsed, 0) : value,
  );

  useEffect(() => {
    if (!animatable) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, parsed.num as number, {
      duration: durationMs / 1000,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(formatStatValue(parsed, latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, value, durationMs, delay]);

  const style = {
    fontFamily: NUMBERS,
    fontSize: "clamp(4rem, 8vw, 6rem)",
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color,
    fontVariantNumeric: "tabular-nums" as const,
  };

  // In the builder, render the editable raw value (no animation).
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

export function BlockStatCounterBand({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const background = props.background ?? "brand-dark";

  const primary = brand.primaryColor || "#0f172a";
  const accent = props.accentColor || brand.accentColor || "#3B82F6";

  // ── Resolve the band surface. ──
  let surfaceHex: string;
  let backgroundCss: string;
  if (props.bgColor) {
    surfaceHex = props.bgColor;
    backgroundCss = props.bgColor;
  } else if (background === "brand-dark") {
    // Deep brand-primary gradient — readable regardless of how light the
    // brand primary is, because we mix it well toward black.
    surfaceHex = "#0B0B10";
    backgroundCss = `linear-gradient(135deg, color-mix(in srgb, ${primary} 38%, #07070B) 0%, #07070B 60%, color-mix(in srgb, ${accent} 14%, #07070B) 100%)`;
  } else if (background === "mesh") {
    surfaceHex = "#FAFAF8";
    backgroundCss = `
      radial-gradient(46% 60% at 12% 0%, color-mix(in srgb, ${accent} 9%, transparent) 0%, transparent 70%),
      radial-gradient(44% 58% at 88% 100%, color-mix(in srgb, ${primary} 8%, transparent) 0%, transparent 70%),
      #FAFAF8
    `;
  } else {
    surfaceHex = "#FAFAF8";
    backgroundCss = "#FAFAF8";
  }

  const dark = relativeLuminance(surfaceHex) < 0.35;
  const ink = dark ? "#F6F7F9" : "#0B0B0F";
  const muted = dark ? "rgba(246,247,249,0.6)" : "rgba(11,11,15,0.6)";
  const numeralColor = pickContrastingColor(accent, surfaceHex, [primary, ink], 3.0);
  const kickerColor = pickContrastingColor(accent, surfaceHex, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.1)";

  const statStyle: StatCounterStyle = props.statStyle ?? "plain";

  // ── Card fill / border derived from the surface (NOT a hardcoded grey) so the
  // soft-card treatment reads on light AND dark bands. Nudge the surface a few
  // percent toward the ink: ~6% on light gives the ~#F6F7F8 reference tone; a
  // touch more on dark lifts the card just off the near-black band. The outline
  // variant uses a transparent fill + a low-alpha border off the same ink. ──
  const cardFill = mixHex(ink, surfaceHex, dark ? 0.08 : 0.06);
  const cardBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(11,11,15,0.08)";
  const iconColor = numeralColor;

  const stats =
    props.stats && props.stats.length > 0
      ? props.stats.slice(0, 4)
      : STAT_COUNTER_DEFAULT_PROPS.stats;
  const durationMs = props.durationMs ?? 1600;
  const showBorders = props.showBorders !== false;

  const updateStat = onFieldChange
    ? (i: number, patch: Partial<StatCounterItem>) =>
        onFieldChange({
          ...props,
          stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
        })
    : undefined;

  const cols =
    stats.length >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : stats.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: backgroundCss,
        color: ink,
        fontFamily: BODY,
        borderTop: showBorders ? `1px solid ${hairline}` : undefined,
        borderBottom: showBorders ? `1px solid ${hairline}` : undefined,
      }}
    >
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        {(props.kicker || onFieldChange) && (
          <h2
            className="text-center text-[12px] sm:text-[13px] uppercase tracking-[0.26em] font-semibold mb-12 lg:mb-16"
            style={{ color: kickerColor }}
          >
            <InlineText
              as="span"
              value={props.kicker ?? ""}
              onUpdate={
                onFieldChange ? (v) => onFieldChange({ ...props, kicker: v }) : undefined
              }
            />
          </h2>
        )}

        <div
          className={
            statStyle === "divided"
              ? // Stacked + horizontal rules on mobile; row + vertical rules on
                // sm+. The dividers generalize the showBorders hairline concept.
                `grid grid-cols-1 ${cols} divide-y sm:divide-y-0 sm:divide-x`
              : `grid grid-cols-1 ${cols} gap-y-12 gap-x-8 text-center`
          }
          style={statStyle === "divided" ? { borderColor: hairline } : undefined}
        >
          {stats.map((stat, i) => {
            const isCard = statStyle === "cards" || statStyle === "outlined";
            const showIcon = isCard && !!stat.icon;
            const inner = (
              <>
                {showIcon && (
                  <div
                    className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl"
                    style={
                      statStyle === "cards"
                        ? { backgroundColor: surfaceHex, color: iconColor }
                        : { border: `1px solid ${cardBorder}`, color: iconColor }
                    }
                    aria-hidden="true"
                  >
                    <IconOrImage value={stat.icon} className="h-5 w-5" />
                  </div>
                )}
                <StatValue
                  value={stat.value}
                  color={numeralColor}
                  reduced={reduced}
                  durationMs={durationMs}
                  delay={i * 0.12}
                  onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined}
                />
                <p
                  className="mt-4 text-sm sm:text-base font-medium tracking-wide"
                  style={{ color: muted }}
                >
                  <InlineText
                    as="span"
                    value={stat.label}
                    onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined}
                  />
                </p>
              </>
            );

            // Per-style wrapper classes/styles. Cards/outlined get generous
            // padding + gentle rounding and left-align so the icon slot reads as
            // top-left; divided pads the cell so the hairline has breathing room.
            const wrapperClass = isCard
              ? "rounded-2xl p-8 sm:p-9 text-left"
              : statStyle === "divided"
                ? "px-8 py-10 sm:py-2 text-center"
                : undefined;
            const wrapperStyle =
              statStyle === "cards"
                ? { backgroundColor: cardFill }
                : statStyle === "outlined"
                  ? { backgroundColor: "transparent", border: `1px solid ${cardBorder}` }
                  : undefined;

            return (
              <motion.div
                key={i}
                className={wrapperClass}
                style={wrapperStyle}
                initial={reduced ? false : { opacity: 0, y: 18 }}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                {inner}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
