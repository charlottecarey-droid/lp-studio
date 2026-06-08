import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { StatRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: StatRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: StatRowBlockProps) => void;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function BlockStatRow({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const stats = props.stats ?? [];
  const cols = stats.length >= 4 ? 4 : (stats.length as 2 | 3) || 3;

  const update = <K extends keyof StatRowBlockProps>(key: K, value: StatRowBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateStat = (i: number, patch: Partial<StatRowBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section className="w-full py-20 sm:py-24" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto px-6 md:px-12">
        {(props.eyebrow !== undefined || props.heading !== undefined) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {props.eyebrow !== undefined && (
              <InlineText as="p" value={props.eyebrow} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
            )}
            {props.heading !== undefined && (
              <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 gap-8 ${COL_CLASS[cols] ?? COL_CLASS[3]}`}>
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <InlineText as="div" value={s.value} onUpdate={onFieldChange ? (v) => updateStat(i, { value: v }) : undefined} className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: accent, fontFamily: DISPLAY }} />
              <InlineText as="p" value={s.label} onUpdate={onFieldChange ? (v) => updateStat(i, { label: v }) : undefined} className="mt-2 text-sm font-medium" style={{ color: muted }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
