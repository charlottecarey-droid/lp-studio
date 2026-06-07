import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { StatBackedFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: StatBackedFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: StatBackedFinalCtaBlockProps) => void;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function BlockStatBackedFinalCta({ props, brand, onFieldChange }: Props) {
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const bg = props.bgColor ?? "#0F172A";
  const ink = props.textColor ?? pickContrastingColor(undefined, bg, ["#FFFFFF", "#0F172A"]);
  const muted = `${ink}B3`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const stats = props.stats ?? [];
  const cols = stats.length >= 4 ? 4 : (stats.length as 2 | 3) || 3;

  const update = <K extends keyof StatBackedFinalCtaBlockProps>(key: K, value: StatBackedFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateStat = (i: number, patch: Partial<StatBackedFinalCtaBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="w-full px-6 py-20 sm:py-28" style={{ backgroundColor: bg, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto max-w-4xl text-center">
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
        )}
        <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }} />
        {(props.subheading || onFieldChange) && (
          <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: muted }} multiline />
        )}
        <div className={`mt-12 grid grid-cols-1 gap-8 ${COL_CLASS[cols] ?? COL_CLASS[3]}`}>
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <InlineText as="div" value={s.value} onUpdate={onFieldChange ? (v) => updateStat(i, { value: v }) : undefined} className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: accent, fontFamily: DISPLAY }} />
              <InlineText as="p" value={s.label} onUpdate={onFieldChange ? (v) => updateStat(i, { label: v }) : undefined} className="mt-2 text-sm font-medium" style={{ color: muted }} />
            </div>
          ))}
        </div>
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-12">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="stat-backed-final-cta"
              className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          </div>
        )}
      </div>
    </section>
  );
}
