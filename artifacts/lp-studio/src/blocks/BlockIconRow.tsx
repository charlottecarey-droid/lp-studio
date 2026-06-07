import * as LucideIcons from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { IconRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: IconRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: IconRowBlockProps) => void;
}

type IconComp = React.ComponentType<{ className?: string }>;
function resolveIcon(name?: string): IconComp {
  const map = LucideIcons as unknown as Record<string, IconComp>;
  return (name ? map[name] : undefined) ?? LucideIcons.Sparkles;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function BlockIconRow({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const items = props.items ?? [];
  const cols = props.columns ?? (items.length >= 4 ? 4 : (items.length as 2 | 3) || 3);

  const update = <K extends keyof IconRowBlockProps>(key: K, value: IconRowBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateItem = (i: number, patch: Partial<IconRowBlockProps["items"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  };

  return (
    <section className="w-full py-20 sm:py-24" style={{ backgroundColor: bg, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto px-6 md:px-12">
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
        <div className={`grid grid-cols-1 gap-8 ${COL_CLASS[cols] ?? COL_CLASS[3]}`}>
          {items.map((it, i) => {
            const Icon = resolveIcon(it.icon);
            return (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1A`, color: accent }}>
                  <Icon className="h-5 w-5" />
                </div>
                <InlineText as="h3" value={it.title} onUpdate={onFieldChange ? (v) => updateItem(i, { title: v }) : undefined} className="text-lg font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
                {it.text !== undefined && (
                  <InlineText as="p" value={it.text} onUpdate={onFieldChange ? (v) => updateItem(i, { text: v }) : undefined} className="mt-2 text-sm leading-relaxed" style={{ color: muted }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
