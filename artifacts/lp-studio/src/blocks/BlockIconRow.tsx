import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { IconRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { IconOrImage } from "@/lib/icon-value";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: IconRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: IconRowBlockProps) => void;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function BlockIconRow({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const items = props.items ?? [];
  const cols = props.columns ?? (items.length >= 4 ? 4 : (items.length as 2 | 3) || 3);

  const editing = !!onFieldChange;

  const update = <K extends keyof IconRowBlockProps>(key: K, value: IconRowBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateItem = (i: number, patch: Partial<IconRowBlockProps["items"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  };

  const renderItem = (it: IconRowBlockProps["items"][number], i: number) => (
    <div className="group flex flex-col items-center text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg"
        style={{ backgroundColor: `${accent}14`, color: accent, ["--tw-ring-color" as string]: `${accent}29` }}
      >
        <IconOrImage value={it.icon} className="h-6 w-6" alt={it.title} />
      </div>
      <InlineText as="h3" value={it.title} onUpdate={editing ? (v) => updateItem(i, { title: v }) : undefined} className="text-lg font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
      {it.text !== undefined && (
        <InlineText as="p" value={it.text} onUpdate={editing ? (v) => updateItem(i, { text: v }) : undefined} className="mt-2 text-sm leading-relaxed" style={{ color: muted }} />
      )}
    </div>
  );

  const grid = `grid grid-cols-1 gap-x-8 gap-y-12 ${COL_CLASS[cols] ?? COL_CLASS[3]}`;

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-24" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}1a, transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        {(props.eyebrow !== undefined || props.heading !== undefined || props.subheading !== undefined) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {props.eyebrow !== undefined && (
              <InlineText as="p" value={props.eyebrow} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
            )}
            {props.heading !== undefined && (
              <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
            )}
            {props.subheading !== undefined && (
              <InlineText as="p" value={props.subheading} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mt-3 text-base" style={{ color: muted }} />
            )}
          </div>
        )}
        {editing ? (
          <div className={grid}>
            {items.map((it, i) => (
              <div key={i}>{renderItem(it, i)}</div>
            ))}
          </div>
        ) : (
          <RevealStagger className={grid}>
            {items.map((it, i) => (
              <RevealItem key={i}>{renderItem(it, i)}</RevealItem>
            ))}
          </RevealStagger>
        )}
      </div>
    </section>
  );
}
