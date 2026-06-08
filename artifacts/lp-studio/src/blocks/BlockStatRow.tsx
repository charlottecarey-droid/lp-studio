import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { StatRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { StatCounter } from "./StatCounter";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
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
  const editing = !!onFieldChange;

  const update = <K extends keyof StatRowBlockProps>(key: K, value: StatRowBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateStat = (i: number, patch: Partial<StatRowBlockProps["stats"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  const statItem = (s: StatRowBlockProps["stats"][number], i: number) => (
    <div className="flex flex-col items-center text-center">
      <div
        className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
        style={{ color: accent, fontFamily: DISPLAY }}
      >
        {editing ? (
          <InlineText as="span" value={s.value} onUpdate={(v) => updateStat(i, { value: v })} />
        ) : (
          <StatCounter value={s.value} />
        )}
      </div>
      <span
        className="mt-3 h-0.5 w-8 rounded-full"
        style={{ background: `linear-gradient(to right, ${accent}, ${accent}33)` }}
        aria-hidden
      />
      <InlineText
        as="p"
        value={s.label}
        onUpdate={editing ? (v) => updateStat(i, { label: v }) : undefined}
        className="mt-3 text-sm font-semibold uppercase tracking-[0.12em]"
        style={{ color: muted, fontFamily: BODY }}
      />
    </div>
  );

  const grid = `grid grid-cols-1 gap-y-12 gap-x-8 ${COL_CLASS[cols] ?? COL_CLASS[3]}`;

  return (
    <section
      className="relative w-full overflow-hidden py-20 sm:py-24"
      style={{ background: surface.background, color: ink, fontFamily: BODY }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}1f, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}14, transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        {(props.eyebrow !== undefined || props.heading !== undefined) && (
          <div className="mx-auto mb-14 max-w-2xl text-center">
            {props.eyebrow !== undefined && (
              <InlineText as="p" value={props.eyebrow} onUpdate={editing ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
            )}
            {props.heading !== undefined && (
              <InlineText as="h2" value={props.heading} onUpdate={editing ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
            )}
          </div>
        )}
        {editing ? (
          <div className={grid}>
            {stats.map((s, i) => (
              <div key={i}>{statItem(s, i)}</div>
            ))}
          </div>
        ) : (
          <RevealStagger className={grid}>
            {stats.map((s, i) => (
              <RevealItem key={i}>{statItem(s, i)}</RevealItem>
            ))}
          </RevealStagger>
        )}
      </div>
    </section>
  );
}
