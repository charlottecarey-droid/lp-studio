import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyVideoTestimonialsBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=400&h=700&fit=crop";

const PLAY_SVG = (
  <svg fill="none" height="64" viewBox="0 0 100 100" width="64" xmlns="http://www.w3.org/2000/svg">
    <path d="m64.8276 49.2692c.5632.3248.5632 1.1368 0 1.4616l-22.8104 13.1549c-.5632.3248-1.2672-.0812-1.2672-.7308v-26.3098c0-.6496.704-1.0556 1.2672-.7308z" fill="#fdfcfa"/>
    <rect height="98.6" rx="23.3" stroke="#fdfcfa" strokeOpacity=".2" strokeWidth="1.4" width="98.6" x=".7" y=".7"/>
  </svg>
);

interface Props {
  props: DandyVideoTestimonialsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVideoTestimonialsBlockProps) => void;
}

export function BlockDandyVideoTestimonials({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  const items = props.items ?? [];

  return (
    <section className={cn("w-full bg-[#FDFCFA]", sectionPy)}>
      <div className="max-w-7xl mx-auto px-6">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="mb-10 max-w-2xl">
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

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-none">
          {items.map((item, i) => (
            <div
              key={i}
              className="relative shrink-0 rounded-2xl overflow-hidden cursor-pointer group"
              style={{ width: "200px", aspectRatio: "9/16" }}
            >
              <img
                src={item.imageUrl || PLACEHOLDER_IMG}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="opacity-90 group-hover:opacity-100 transition-opacity">
                  {PLAY_SVG}
                </div>
              </div>

              {/* Caption */}
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-semibold leading-tight">
                  <InlineText value={item.name} onUpdate={onFieldChange ? (v) => updateItem(i, "name", v) : undefined} />
                </p>
                <p className="text-white/70 text-xs mt-0.5">
                  <InlineText value={item.practiceName} onUpdate={onFieldChange ? (v) => updateItem(i, "practiceName", v) : undefined} />
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
