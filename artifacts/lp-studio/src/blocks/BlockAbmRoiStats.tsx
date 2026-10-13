import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { StatCounter } from "./StatCounter";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, ABM_NUMBERS, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { AbmCtaButtons, ABM_CTA_DEFAULTS, type AbmCtaProps, type AbmCtaVariant } from "./abm/AbmCta";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM ROI Stats — type "abm-roi-stats"
 *
 * "The ROI of …": a centered headline, three big count-up percentages with a
 * one-line label each, a button (ink-coloured by default, like the reference
 * page's black "Get the ROI report") and a small footnote citing the source.
 * -------------------------------------------------------------------------- */

export interface AbmStat {
  value: string;
  label: string;
}

export interface AbmRoiStatsBlockProps extends AbmCtaProps, AbmStyleProps {
  headline?: string;
  stats: AbmStat[];
  footnote?: string;
  /** "ink" (default) = the section's text colour; "accent" = the brand CTA fill. */
  ctaVariant?: AbmCtaVariant;
  anchorId?: string;
}

interface Props {
  props: AbmRoiStatsBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AbmRoiStatsBlockProps) => void;
}

export const ABM_ROI_STATS_DEFAULT_PROPS: AbmRoiStatsBlockProps = {
  ...ABM_CTA_DEFAULTS,
  headline: "The ROI of one platform",
  stats: [
    { value: "95%", label: "see higher profit margins and an improved safety culture" },
    { value: "97%", label: "make faster, data-backed decisions" },
    { value: "95%", label: "report lower risk across projects" },
  ],
  ctaText: "Get the ROI report",
  ctaUrl: "#",
  ctaVariant: "ink",
  footnote: "* Annual customer ROI survey, enterprise edition",
  anchorId: "roi",
  backgroundStyle: "muted",
};

export function BlockAbmRoiStats({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#F5F1ED");
  const isEditor = !!onFieldChange;
  const stats = props.stats ?? [];

  const field = (key: keyof AbmRoiStatsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmRoiStatsBlockProps[typeof key] }) : undefined;
  const label = onFieldChange ? (key: "ctaText" | "ctaSecondaryText", v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<AbmStat>) => onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const cols = stats.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : stats.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <section id={props.anchorId || undefined} className="abm-roi-stats relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "flex flex-col items-center py-20 text-center lg:py-24")}>
        <motion.h2 {...reveal(0)} style={displayStyle("clamp(1.8rem, 3.2vw, 2.5rem)", pal.heading)}>
          <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} />
        </motion.h2>

        <div className={cn("mt-12 grid w-full max-w-5xl grid-cols-1 gap-10", cols)}>
          {stats.map((s, i) => (
            <motion.div key={i} {...reveal(0.06 + i * 0.06)} className="flex flex-col items-center px-2">
              <div className="text-[clamp(3rem,6vw,4.5rem)] font-bold leading-none tracking-tight" style={{ color: pal.heading, fontFamily: ABM_NUMBERS, letterSpacing: "-0.03em" }}>
                {isEditor ? (
                  <InlineText as="span" value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} />
                ) : (
                  <StatCounter value={s.value} />
                )}
              </div>
              <p className="mt-3 max-w-[26ch] text-[16px] leading-snug" style={{ color: pal.text }}>
                <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} multiline />
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div {...reveal(0.2)} className="mt-12">
          <AbmCtaButtons props={props} brand={brand} palette={pal} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} onLabelChange={label} source="abm-roi-stats" variant={props.ctaVariant ?? "ink"} align="center" />
        </motion.div>
        {(props.footnote || isEditor) && (
          <p className="mt-6 text-[11px]" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.footnote ?? ""} onUpdate={field("footnote")} />
          </p>
        )}
      </div>
    </section>
  );
}
