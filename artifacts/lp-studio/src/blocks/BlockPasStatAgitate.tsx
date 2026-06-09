import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasStatAgitateBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { StatCounter } from "./StatCounter";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: PasStatAgitateBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasStatAgitateBlockProps) => void;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function BlockPasStatAgitate({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#0F172A");
  const ink = props.textColor ?? surface.color ?? pickContrastingColor(undefined, surface.base, ["#FFFFFF", "#0F172A"]);
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = `${ink}B3`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const stats = props.stats ?? [];
  const cols = stats.length >= 4 ? 4 : (stats.length as 2 | 3) || 3;

  const update = <K extends keyof PasStatAgitateBlockProps>(key: K, value: PasStatAgitateBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateStat = (i: number, patch: Partial<PasStatAgitateBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-10 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
          )}
          <InlineText as="h2" value={props.problemHeading} onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.problemBody || onFieldChange) && (
            <InlineText as="p" value={props.problemBody ?? ""} onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </div>
        {(() => {
          const gridClass = `grid grid-cols-1 gap-8 ${COL_CLASS[cols] ?? COL_CLASS[3]}`;
          const statItem = (s: PasStatAgitateBlockProps["stats"][number], i: number) => (
            <div className="text-center">
              <div className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: accent, fontFamily: DISPLAY }}>
                {onFieldChange ? (
                  <InlineText as="span" value={s.value} onUpdate={(v) => updateStat(i, { value: v })} />
                ) : (
                  <StatCounter value={s.value} />
                )}
              </div>
              <InlineText as="p" value={s.label} onUpdate={onFieldChange ? (v) => updateStat(i, { label: v }) : undefined} className="mt-2 text-sm font-medium" style={{ color: muted }} />
            </div>
          );
          return onFieldChange ? (
            <div className={gridClass}>
              {stats.map((s, i) => (
                <div key={i}>{statItem(s, i)}</div>
              ))}
            </div>
          ) : (
            <RevealStagger className={gridClass}>
              {stats.map((s, i) => (
                <RevealItem key={i}>{statItem(s, i)}</RevealItem>
              ))}
            </RevealStagger>
          );
        })()}
        {(props.solutionHeading || props.solutionBody || props.ctaLabel || onFieldChange) && (
          <div className="mx-auto mt-14 max-w-3xl text-center">
            {(props.solutionHeading || onFieldChange) && (
              <InlineText as="h3" value={props.solutionHeading ?? ""} onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined} className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: ink, fontFamily: DISPLAY }} />
            )}
            {(props.solutionBody || onFieldChange) && (
              <InlineText as="p" value={props.solutionBody ?? ""} onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
            )}
            {(props.ctaLabel || onFieldChange) && (
              <div className="mt-8">
                <CtaButton
                  {...pickCtaModalConfig(props)}
                  ctaAction={props.ctaAction ?? "url"}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  videoUrl={props.videoUrl}
                  videoPosterUrl={props.videoPosterUrl}
                  brand={brand}
                  source="pas-stat-agitate-cta"
                  className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
                  style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                >
                  {props.ctaLabel || "Get started"}
                </CtaButton>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
