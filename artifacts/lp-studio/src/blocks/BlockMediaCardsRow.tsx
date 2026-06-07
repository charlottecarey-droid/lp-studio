import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaCardsRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: MediaCardsRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaCardsRowBlockProps) => void;
}

export function BlockMediaCardsRow({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const surface = pickContrastingColor(undefined, bg, ["#FFFFFF", "#1E293B"]);
  const border = `${ink}14`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const cards = props.cards ?? [];
  const colClass = cards.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  const update = <K extends keyof MediaCardsRowBlockProps>(key: K, value: MediaCardsRowBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateCard = (i: number, patch: Partial<MediaCardsRowBlockProps["cards"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
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
        <div className={`grid grid-cols-1 gap-8 ${colClass}`}>
          {cards.map((c, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-2xl border shadow-sm" style={{ backgroundColor: surface, borderColor: border }}>
              <InlineImage
                src={c.imageUrl ?? ""}
                alt={c.imageAlt || c.heading || "Card image"}
                onUpdate={onFieldChange ? (src) => updateCard(i, { imageUrl: src }) : undefined}
                className="aspect-[16/10] w-full object-cover"
                wrapperClassName="block w-full"
              />
              <div className="flex flex-1 flex-col p-6">
                <InlineText as="h3" value={c.heading} onUpdate={onFieldChange ? (v) => updateCard(i, { heading: v }) : undefined} className="text-lg font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
                {c.text !== undefined && (
                  <InlineText as="p" value={c.text} onUpdate={onFieldChange ? (v) => updateCard(i, { text: v }) : undefined} className="mt-2 text-sm leading-relaxed" style={{ color: muted }} />
                )}
                {c.linkLabel && (
                  <a href={c.linkUrl || "#"} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}>
                    {c.linkLabel}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
