import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasStatAgitateBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
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
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
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
    <section className="w-full py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto px-6 md:px-12">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
          )}
          <InlineText as="h2" value={props.problemHeading} onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.problemBody || onFieldChange) && (
            <InlineText as="p" value={props.problemBody ?? ""} onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </div>
        <div className={`grid grid-cols-1 gap-8 ${COL_CLASS[cols] ?? COL_CLASS[3]}`}>
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <InlineText as="div" value={s.value} onUpdate={onFieldChange ? (v) => updateStat(i, { value: v }) : undefined} className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: accent, fontFamily: DISPLAY }} />
              <InlineText as="p" value={s.label} onUpdate={onFieldChange ? (v) => updateStat(i, { label: v }) : undefined} className="mt-2 text-sm font-medium" style={{ color: muted }} />
            </div>
          ))}
        </div>
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
