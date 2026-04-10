import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyColumnsV2BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&h=500&fit=crop";

interface Props {
  props: DandyColumnsV2BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyColumnsV2BlockProps) => void;
}

export function BlockDandyColumnsV2({ props, brand, onFieldChange }: Props) {
  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  const updateBullet = (i: number, bi: number, v: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => {
      if (idx !== i) return item;
      const bullets = [...(item.bullets ?? [])];
      bullets[bi] = v;
      return { ...item, bullets };
    });
    onFieldChange({ ...props, items });
  };

  return (
    <section className="w-full py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="mb-14 max-w-2xl">
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-[#006651] mb-3">
                <InlineText value={props.eyebrow} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined} />
              </p>
            )}
            {props.headline && (
              <h2 className={cn("text-4xl md:text-5xl font-bold text-[#003A30] leading-[1.1] tracking-tight mb-4", getHeadingWeightClass(brand))}>
                <InlineText value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} />
              </h2>
            )}
            {props.subheadline && (
              <p className="text-slate-600 text-lg leading-relaxed">
                <InlineText value={props.subheadline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, subheadline: v }) : undefined} />
              </p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-10 md:gap-12">
          {(props.items ?? []).map((item, i) => (
            <div key={i} className="flex flex-col">
              <div className="rounded-2xl overflow-hidden mb-7 aspect-[3/2] bg-slate-100">
                <img
                  src={item.imageUrl || PLACEHOLDER}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <h3 className="text-2xl font-bold text-[#003A30] mb-3">
                <InlineText value={item.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} />
              </h3>
              <p className="text-slate-600 text-base leading-relaxed mb-4">
                <InlineText value={item.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} />
              </p>
              {(item.bullets ?? []).length > 0 && (
                <ul className="space-y-2 mb-6 flex-1">
                  {(item.bullets ?? []).map((b, bi) => (
                    <li key={bi} className="text-base text-slate-500 flex items-start gap-2">
                      <span className="mt-2 w-2 h-2 rounded-full bg-[#C7E738] shrink-0" />
                      <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, bi, v) : undefined} />
                    </li>
                  ))}
                </ul>
              )}
              {item.ctaText && (
                <button
                  onClick={() => safeNavigate(item.ctaUrl)}
                  className="mt-auto inline-flex items-center gap-2.5 border-2 border-[#003A30] rounded-xl px-6 py-3.5 text-base font-semibold text-[#003A30] hover:bg-[#003A30] hover:text-white transition-colors w-fit"
                >
                  <span className="w-7 h-7 rounded border border-current flex items-center justify-center shrink-0">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                  <InlineText value={item.ctaText} onUpdate={onFieldChange ? (v) => updateItem(i, "ctaText", v) : undefined} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
