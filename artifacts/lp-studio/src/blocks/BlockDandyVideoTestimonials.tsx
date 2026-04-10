import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyVideoTestimonialsBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=400&h=700&fit=crop";

const PLAY_SVG = (
  <svg fill="none" height="72" viewBox="0 0 100 100" width="72" xmlns="http://www.w3.org/2000/svg">
    <path d="m64.8276 49.2692c.5632.3248.5632 1.1368 0 1.4616l-22.8104 13.1549c-.5632.3248-1.2672-.0812-1.2672-.7308v-26.3098c0-.6496.704-1.0556 1.2672-.7308z" fill="#fdfcfa"/>
    <rect height="98.6" rx="23.3" stroke="#fdfcfa" strokeOpacity=".25" strokeWidth="1.4" width="98.6" x=".7" y=".7"/>
  </svg>
);

interface Props {
  props: DandyVideoTestimonialsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVideoTestimonialsBlockProps) => void;
}

export function BlockDandyVideoTestimonials({ props, brand, onFieldChange }: Props) {
  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  const items = props.items ?? [];

  return (
    <section className="w-full py-20 md:py-28 bg-[#FDFCFA]">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="mb-12 max-w-2xl">
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

        <div className="flex gap-5 overflow-x-auto pb-4 -mx-6 px-6 md:-mx-10 md:px-10 scrollbar-none">
          {items.map((item, i) => (
            <div
              key={i}
              className="relative shrink-0 rounded-3xl overflow-hidden cursor-pointer group shadow-xl"
              style={{ width: "260px", aspectRatio: "9/16" }}
            >
              <img
                src={item.imageUrl || PLACEHOLDER_IMG}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200">
                  {PLAY_SVG}
                </div>
              </div>

              {/* Caption */}
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-white text-base font-semibold leading-tight">
                  <InlineText value={item.name} onUpdate={onFieldChange ? (v) => updateItem(i, "name", v) : undefined} />
                </p>
                {item.practiceName && (
                  <p className="text-white/65 text-sm mt-1">
                    <InlineText value={item.practiceName} onUpdate={onFieldChange ? (v) => updateItem(i, "practiceName", v) : undefined} />
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
