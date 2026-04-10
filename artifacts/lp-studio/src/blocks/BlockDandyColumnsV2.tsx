import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyColumnsV2BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=640&h=300&fit=crop";

interface Props {
  props: DandyColumnsV2BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyColumnsV2BlockProps) => void;
}

export function BlockDandyColumnsV2({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];

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
    <section className={cn("w-full bg-white", sectionPy)}>
      <div className="max-w-6xl mx-auto px-6">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="mb-12 max-w-2xl">
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-[#006651] mb-3">
                <InlineText value={props.eyebrow} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined} />
              </p>
            )}
            {props.headline && (
              <h2 className={cn("text-3xl md:text-4xl font-bold text-[#003A30] leading-tight mb-4", getHeadingWeightClass(brand))}>
                <InlineText value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} />
              </h2>
            )}
            {props.subheadline && (
              <p className="text-slate-600 text-base leading-relaxed">
                <InlineText value={props.subheadline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, subheadline: v }) : undefined} />
              </p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {(props.items ?? []).map((item, i) => (
            <div key={i} className="flex flex-col">
              <div className="rounded-xl overflow-hidden mb-5 aspect-[16/7] bg-slate-100">
                <img
                  src={item.imageUrl || PLACEHOLDER}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <h3 className="text-xl font-bold text-[#003A30] mb-2">
                <InlineText value={item.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} />
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-3">
                <InlineText value={item.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} />
              </p>
              {(item.bullets ?? []).length > 0 && (
                <ul className="space-y-1 mb-5 flex-1">
                  {(item.bullets ?? []).map((b, bi) => (
                    <li key={bi} className="text-sm text-slate-500 flex items-start gap-1.5">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C7E738] shrink-0" />
                      <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, bi, v) : undefined} />
                    </li>
                  ))}
                </ul>
              )}
              {item.ctaText && (
                <button
                  onClick={() => safeNavigate(item.ctaUrl)}
                  className="mt-auto inline-flex items-center gap-2 border border-[#003A30] rounded-lg px-4 py-2.5 text-sm font-semibold text-[#003A30] hover:bg-[#003A30] hover:text-white transition-colors w-fit"
                >
                  <span className="w-6 h-6 rounded border border-current flex items-center justify-center shrink-0">
                    <ArrowRight className="w-3 h-3" />
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
