import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass } from "@/lib/brand-config";
import type { DandySwitchbackBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { ArrowRight } from "lucide-react";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1200&h=800&fit=crop";

interface Props {
  props: DandySwitchbackBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySwitchbackBlockProps) => void;
}

export function BlockDandySwitchback({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const [activeIdx, setActiveIdx] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  const items = props.items ?? [];
  const activeItem = items[activeIdx] ?? null;

  return (
    <section className={cn("w-full bg-[#FDFCFA]", sectionPy)}>
      <div className="max-w-7xl mx-auto px-6">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="mb-12 max-w-2xl">
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-[#006651] mb-3">
                <InlineText value={props.eyebrow} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined} />
              </p>
            )}
            {props.headline && (
              <h2 className={cn("text-3xl md:text-4xl font-bold text-[#003A30] leading-tight mb-3", getHeadingWeightClass(brand))}>
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

        <div className="grid md:grid-cols-[1fr_1fr] gap-16 items-start">
          {/* Left: list items */}
          <div className="flex flex-col">
            {items.map((item, i) => (
              <div
                key={i}
                ref={el => { itemRefs.current[i] = el; }}
                className={cn(
                  "py-8 border-b border-slate-200 cursor-pointer transition-all",
                  i === activeIdx ? "opacity-100" : "opacity-40 hover:opacity-60"
                )}
                onClick={() => setActiveIdx(i)}
              >
                <h3 className="text-lg font-bold text-[#003A30] mb-2">
                  <InlineText value={item.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} />
                </h3>
                {i === activeIdx && (
                  <>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      <InlineText value={item.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} />
                    </p>
                    {item.ctaText && (
                      <button
                        onClick={(e) => { e.stopPropagation(); safeNavigate(item.ctaUrl); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#003A30] hover:text-[#006651] transition-colors"
                      >
                        <InlineText value={item.ctaText} onUpdate={onFieldChange ? (v) => updateItem(i, "ctaText", v) : undefined} />
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Right: sticky image */}
          <div className="sticky top-8">
            <div className="rounded-2xl overflow-hidden aspect-[3/2] bg-slate-100 shadow-xl">
              {activeItem && (
                <img
                  key={activeIdx}
                  src={activeItem.imageUrl || PLACEHOLDER}
                  alt={activeItem.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
