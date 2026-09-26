import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  GLOW_BODY,
  GLOW_DISPLAY,
  GLOW_NUMBERS,
  DISPLAY_TRACKING,
  glowBackground,
  resolveGlowPalette,
} from "@/lib/glow-media";
import { mixHex } from "@/lib/section-ink";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Benchmark Bars — type "benchmark-bars"
 *
 * "Outperforms …" — a left-aligned headline + body, a small chart caption, and
 * a row of 2–4 tall cards that ARE the bars: each card fills from the bottom to
 * its `value` (0–100). The highlighted card (yours) fills with the accent glow;
 * the others fill with a neutral tint and show a delta ("+10.1 pts") floating
 * just above their fill. Optional footnote for methodology.
 * -------------------------------------------------------------------------- */

export interface BenchmarkBar {
  label: string;
  /** Fill height as a percentage of the card, 0–100. */
  value: number;
  /** Small figure shown above the fill on non-highlighted bars, e.g. "+10.1 pts". */
  delta?: string;
  highlighted?: boolean;
}

export interface BenchmarkBarsBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  /** Tiny italic caption above the chart, e.g. "Agent performance across identical tasks". */
  chartLabel?: string;
  bars: BenchmarkBar[];
  footnote?: string;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: BenchmarkBarsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenchmarkBarsBlockProps) => void;
}

export const BENCHMARK_BARS_DEFAULT_PROPS: BenchmarkBarsBlockProps = {
  eyebrow: "",
  headline: "Outperforms general-purpose tools on real-world tasks.",
  subheadline: "A purpose-built environment — model, connectors, skills, and domain systems together — handles a wider and deeper range of work than a general assistant.",
  chartLabel: "Performance across identical tasks",
  bars: [
    { label: "Our platform", value: 100, highlighted: true },
    { label: "General-purpose tool A", value: 72, delta: "+10.1 pts" },
    { label: "General-purpose tool B", value: 46, delta: "+31.7 pts" },
  ],
  footnote: "Percentage-point gaps are based on the average share of evaluation criteria met across the same task set, with each tool run in its own environment under comparable settings.",
};

export function BlockBenchmarkBars({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGlowPalette(props, brand);
  const isEditor = !!onFieldChange;
  const bars = props.bars && props.bars.length > 0 ? props.bars : BENCHMARK_BARS_DEFAULT_PROPS.bars;

  const field = (key: keyof BenchmarkBarsBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as BenchmarkBarsBlockProps[typeof key] })
      : undefined;
  const updateBar = onFieldChange
    ? (i: number, patch: Partial<BenchmarkBar>) =>
        onFieldChange({ ...props, bars: bars.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) })
    : undefined;

  const cardBg = pal.dark ? mixHex("#FFFFFF", pal.bg, 0.05) : mixHex("#FFFFFF", pal.bg, 0.55);
  const neutralFill = pal.dark ? mixHex("#FFFFFF", pal.bg, 0.1) : mixHex("#000000", pal.bg, 0.05);
  const cols = bars.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : bars.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section className="bbr relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}>
      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-3xl flex flex-col gap-4 mb-10 lg:mb-14">
          {(props.eyebrow || isEditor) && (
            <p className="text-[11px] uppercase tracking-[0.24em] font-semibold" style={{ color: pal.eyebrow }}>
              <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </p>
          )}
          {(props.headline || isEditor) && (
            <h2
              className="font-semibold leading-[1.06]"
              style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
            >
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || isEditor) && (
            <p className="text-base lg:text-lg leading-relaxed max-w-[56ch]" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </div>

        {(props.chartLabel || isEditor) && (
          <p className="text-xs italic mb-4" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.chartLabel ?? ""} onUpdate={field("chartLabel")} />
          </p>
        )}

        <div className={cn("grid grid-cols-1 gap-4 lg:gap-5", cols)} role="img" aria-label={props.chartLabel || props.headline}>
          {bars.map((bar, i) => {
            const value = Math.max(0, Math.min(100, Number(bar.value) || 0));
            const highlighted = !!bar.highlighted;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-3xl min-h-[360px] lg:min-h-[420px]"
                style={{ background: cardBg, border: `1px solid ${pal.cardBorder}` }}
              >
                {/* Fill — animates up from zero; static render pins the rest height via style. */}
                <motion.div
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: `${value}%`,
                    background: highlighted
                      ? glowBackground({ glow: pal.glow, panel: mixHex(pal.glow, cardBg, 0.16), dark: pal.dark }, "bottom-left", 1.1)
                      : neutralFill,
                    borderTop: highlighted ? "none" : `1px solid ${pal.cardBorder}`,
                  }}
                  initial={reduced ? false : anim({ height: 0 })}
                  whileInView={reduced ? undefined : { height: `${value}%` }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 1.1, delay: Math.min(i * 0.12, 0.5), ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Label sits at the top of the fill; on a near-full bar it drops
                      to the bottom so the delta pinned above the fill can't cover it. */}
                  <div
                    className={cn("p-5 lg:p-6 text-sm font-medium", value >= 80 && !highlighted && bar.delta ? "absolute inset-x-0 bottom-0" : "")}
                    style={{ color: highlighted ? "#0B0B0F" : pal.text }}
                  >
                    <InlineText as="span" value={bar.label} onUpdate={updateBar ? (v) => updateBar(i, { label: v }) : undefined} />
                  </div>
                </motion.div>

                {(bar.delta || (isEditor && !highlighted)) && (
                  <div
                    className="absolute inset-x-0 flex items-end justify-center pb-4 pointer-events-none"
                    style={{ bottom: `min(${value}%, calc(100% - 5rem))`, height: "5rem" }}
                  >
                    <span
                      className="font-semibold tabular-nums pointer-events-auto"
                      style={{ fontFamily: GLOW_NUMBERS, fontSize: "clamp(1.5rem, 2.4vw, 2rem)", letterSpacing: "-0.03em" }}
                    >
                      <InlineText as="span" value={bar.delta ?? ""} onUpdate={updateBar ? (v) => updateBar(i, { delta: v }) : undefined} />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(props.footnote || isEditor) && (
          <p className="mt-6 text-xs leading-relaxed max-w-5xl" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.footnote ?? ""} onUpdate={field("footnote")} multiline />
          </p>
        )}
      </div>
    </section>
  );
}
