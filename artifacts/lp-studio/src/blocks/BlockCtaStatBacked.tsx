import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CtaStatBackedBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { StatCounter } from "./StatCounter";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: CtaStatBackedBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaStatBackedBlockProps) => void;
}

export function BlockCtaStatBacked({ props, brand, onFieldChange }: Props) {
  const sectionBg = resolveSectionSurface(props, "#ffffff");
  const surface = props.surfaceColor ?? "#ffffff";
  const text = props.textColor ?? sectionBg.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const muted = pickContrastingColor(undefined, sectionBg.base, ["#64748b", "#94a3b8"]);
  const surfaceMuted = pickContrastingColor(undefined, surface, ["#64748b", "#94a3b8"]);
  const border = `${text}14`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const stats = props.stats ?? [];

  const update = <K extends keyof CtaStatBackedBlockProps>(key: K, value: CtaStatBackedBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStat = (i: number, key: "value" | "label", value: string) => {
    if (!onFieldChange) return;
    const next = stats.map((stat, idx) => (idx === i ? { ...stat, [key]: value } : stat));
    onFieldChange({ ...props, stats: next });
  };

  return (
    <section className="w-full py-24 sm:py-32" style={{ background: sectionBg.background }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start lg:items-center">
          <div className="lg:w-1/2">
            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8 leading-tight"
              style={{ color: text, fontFamily: DISPLAY }} />

            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
                className="text-lg md:text-xl mb-12 leading-relaxed max-w-lg"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            )}

            {(props.ctaPrimaryLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="flex flex-wrap items-center gap-4">
                {(props.ctaPrimaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaPrimaryUrl}
                    brand={brand}
                    source="cta-stat-backed-primary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Get a demo"}
                    <ArrowRight className="h-4 w-4" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="cta-stat-backed-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold"
                    style={{ borderColor: border, color: text, fontFamily: BODY }}
                  >
                    {props.ctaSecondaryLabel || "Talk to sales"}
                  </CtaButton>
                )}
              </div>
            )}
          </div>

          <div className="lg:w-1/2 w-full">
            {(() => {
              const gridClass = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6";
              const statCard = (stat: CtaStatBackedBlockProps["stats"][number], i: number) => (
                <div
                  className="flex h-full flex-col gap-2 p-8 md:p-10 rounded-3xl border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  style={{ backgroundColor: surface, borderColor: border }}
                >
                  <span className="text-5xl md:text-6xl font-black tracking-tight" style={{ color: accent, fontFamily: DISPLAY }}>
                    {onFieldChange ? (
                      <InlineText as="span" value={stat.value} onUpdate={(v: string) => updateStat(i, "value", v)} />
                    ) : (
                      <StatCounter value={stat.value} />
                    )}
                  </span>
                  <InlineText
                    as="span"
                    value={stat.label}
                    onUpdate={onFieldChange ? (v: string) => updateStat(i, "label", v) : undefined}
                    className="text-sm md:text-base font-bold uppercase tracking-[0.15em]"
                    style={{ color: surfaceMuted, fontFamily: BODY }} />
                </div>
              );
              return onFieldChange ? (
                <div className={gridClass}>
                  {stats.map((stat, i) => (
                    <div key={i}>{statCard(stat, i)}</div>
                  ))}
                </div>
              ) : (
                <RevealStagger className={gridClass}>
                  {stats.map((stat, i) => (
                    <RevealItem key={i}>{statCard(stat, i)}</RevealItem>
                  ))}
                </RevealStagger>
              );
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
