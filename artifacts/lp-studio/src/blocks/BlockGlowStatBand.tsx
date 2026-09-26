import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { StatCounter } from "./StatCounter";
import {
  GLOW_BODY,
  GLOW_DARK_BG,
  GLOW_DISPLAY,
  GLOW_NUMBERS,
  DISPLAY_TRACKING,
  glowBackground,
  resolveGlowPalette,
} from "@/lib/glow-media";
import { mixHex } from "@/lib/section-ink";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Glow Stat Band — type "glow-stat-band"
 *
 * Full-width near-black band: a two-line headline, a row of 2–4 oversized
 * count-up stat cards painted with the accent glow (light cards on dark), and
 * an optional row of up to four short customer quotes with small avatars.
 * -------------------------------------------------------------------------- */

export interface GlowStatItem {
  /** Small kicker above the number, e.g. "Up to". */
  prefix?: string;
  /** The figure — affixes preserved by the count-up ("60%", "9x", "$1.2M"). */
  value: string;
  label: string;
}

export interface GlowStatQuote {
  quote: string;
  author: string;
  role?: string;
  avatarUrl?: string;
}

export interface GlowStatBandBlockProps {
  headline?: string;
  headlineLine2?: string;
  stats: GlowStatItem[];
  quotes?: GlowStatQuote[];
  showQuotes?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
}

interface Props {
  props: GlowStatBandBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GlowStatBandBlockProps) => void;
}

export const GLOW_STAT_BAND_DEFAULT_PROPS: GlowStatBandBlockProps = {
  headline: "Build your stack.",
  headlineLine2: "Unlock speed and capacity.",
  showQuotes: true,
  stats: [
    { prefix: "Up to", value: "60%", label: "faster cycle times for teams on the platform." },
    { prefix: "Up to", value: "9x", label: "faster recurring reporting and reconciliation." },
  ],
  quotes: [
    { quote: "The routine work is standardized now, so I can put my attention on what actually needs my judgment.", author: "Katie Lamb", role: "Operations Manager" },
    { quote: "We run multiple workflows at once and spend our time reviewing, not doing and then reviewing.", author: "John Ikos", role: "President" },
    { quote: "My role is shifting toward people. The tools systemize the work so I can focus on relationships.", author: "Tyler Otto", role: "Owner" },
    { quote: "Probably the biggest step up I've seen in my day-to-day work, because it actually executes.", author: "Jared Lee", role: "CFO" },
  ],
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function BlockGlowStatBand({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveGlowPalette(props, brand, GLOW_DARK_BG);
  const isEditor = !!onFieldChange;
  const stats = props.stats && props.stats.length > 0 ? props.stats : GLOW_STAT_BAND_DEFAULT_PROPS.stats;
  const quotes = props.showQuotes === false ? [] : props.quotes ?? [];

  // Stat cards are light "paper" cards regardless of band darkness, painted
  // with the glow; their ink is resolved against that paper.
  const paper = pal.dark ? "#F5F4F0" : mixHex("#FFFFFF", pal.bg, 0.7);
  const cardPal = { glow: pal.glow, panel: paper, dark: false };
  const cardInk = "#0B0B0F";
  const cardMuted = "rgba(11,11,15,0.66)";

  const field = (key: keyof GlowStatBandBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as GlowStatBandBlockProps[typeof key] })
      : undefined;
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<GlowStatItem>) =>
        onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;
  const updateQuote = onFieldChange
    ? (i: number, patch: Partial<GlowStatQuote>) =>
        onFieldChange({ ...props, quotes: quotes.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) })
    : undefined;

  const cols = stats.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : stats.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section className="gsb relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: GLOW_BODY }}>
      <div className="relative w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.headline || props.headlineLine2 || isEditor) && (
          <h2
            className="text-center font-semibold leading-[1.06] max-w-4xl mx-auto mb-12 lg:mb-16"
            style={{ fontFamily: GLOW_DISPLAY, letterSpacing: DISPLAY_TRACKING, fontSize: "clamp(2.1rem, 4.6vw, 3.6rem)" }}
          >
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            {(props.headlineLine2 || isEditor) && (
              <>
                <br />
                <InlineText as="span" value={props.headlineLine2 ?? ""} onUpdate={field("headlineLine2")} multiline />
              </>
            )}
          </h2>
        )}

        <div className={cn("grid grid-cols-1 gap-4 lg:gap-5", cols)}>
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={reduced ? false : anim({ opacity: 0, y: 20 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: Math.min(i * 0.08, 0.4), ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-3xl p-7 lg:p-9 min-h-[220px] flex flex-col"
              style={{ background: glowBackground(cardPal, i % 2 === 0 ? "bottom-left" : "bottom-right", 1), color: cardInk }}
            >
              {(stat.prefix || isEditor) && (
                <p className="text-sm font-medium" style={{ color: cardMuted }}>
                  <InlineText as="span" value={stat.prefix ?? ""} onUpdate={updateStat ? (v) => updateStat(i, { prefix: v }) : undefined} />
                </p>
              )}
              <div className="mt-auto pt-10">
                <div
                  className="font-semibold leading-none tabular-nums"
                  style={{ fontFamily: GLOW_NUMBERS, fontSize: "clamp(3rem, 6.5vw, 5.25rem)", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}
                >
                  {updateStat ? (
                    <InlineText as="span" value={stat.value} onUpdate={(v) => updateStat(i, { value: v })} />
                  ) : (
                    <StatCounter value={stat.value} />
                  )}
                </div>
                <p className="mt-3 text-sm lg:text-[15px] leading-snug max-w-[34ch]" style={{ color: cardMuted }}>
                  <InlineText as="span" value={stat.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} multiline />
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {quotes.length > 0 && (
          <ul className={cn("mt-14 lg:mt-20 grid grid-cols-1 gap-10 lg:gap-8", quotes.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : quotes.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {quotes.slice(0, 4).map((q, i) => (
              <motion.li
                key={i}
                initial={reduced ? false : anim({ opacity: 0, y: 16 })}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: Math.min(i * 0.07, 0.35), ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-4"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center text-xs font-semibold" style={{ background: `color-mix(in srgb, ${pal.glow} 30%, ${pal.bg})`, color: pal.text }}>
                  {q.avatarUrl || updateQuote ? (
                    <InlineImage
                      src={q.avatarUrl || ""}
                      alt={q.author}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onUpdate={updateQuote ? (url) => updateQuote(i, { avatarUrl: url }) : undefined}
                    />
                  ) : (
                    <span aria-hidden="true">{initials(q.author)}</span>
                  )}
                </div>
                <blockquote className="text-[15px] leading-relaxed" style={{ color: pal.text }}>
                  <InlineText as="span" value={`“${q.quote}”`} onUpdate={updateQuote ? (v) => updateQuote(i, { quote: v.replace(/^[“"]|[”"]$/g, "") }) : undefined} multiline />
                </blockquote>
                <p className="text-xs leading-snug" style={{ color: pal.muted }}>
                  <InlineText as="span" value={q.author} onUpdate={updateQuote ? (v) => updateQuote(i, { author: v }) : undefined} />
                  {(q.role || isEditor) && (
                    <>
                      {", "}
                      <InlineText as="span" value={q.role ?? ""} onUpdate={updateQuote ? (v) => updateQuote(i, { role: v }) : undefined} />
                    </>
                  )}
                </p>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
