import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyColumnsV3BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";

const PLACEHOLDER_ICON = "https://www.meetdandy.com/wp-content/uploads/2025/06/col-type-1.svg";

interface Props {
  props: DandyColumnsV3BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyColumnsV3BlockProps) => void;
}

export function BlockDandyColumnsV3({ props, brand, onFieldChange }: Props) {
  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  return (
    <section className="w-full py-20 md:py-28 bg-[#FDFCFA]">
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

        <div className="grid md:grid-cols-3 gap-12 md:gap-16">
          {(props.items ?? []).map((item, i) => (
            <div key={i} className="flex flex-col gap-5">
              <div className="w-16 h-16 flex items-center justify-center">
                <img
                  src={item.imageUrl || PLACEHOLDER_ICON}
                  alt=""
                  className="w-16 h-16 object-contain"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#C7E738] font-bold text-2xl leading-none">{String(i + 1).padStart(2, "0")}.</span>
                <h3 className="text-xl font-bold text-[#003A30] leading-tight">
                  <InlineText value={item.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} />
                </h3>
              </div>
              <p className="text-slate-600 text-base leading-relaxed">
                <InlineText value={item.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
