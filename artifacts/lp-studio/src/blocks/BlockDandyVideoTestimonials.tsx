import { useState, useEffect } from "react";
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
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  const items = props.items ?? [];
  const activeItem = activeIdx !== null ? items[activeIdx] : null;

  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveIdx(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIdx]);

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
              <h2 className={cn("text-4xl md:text-5xl font-bold text-[var(--brand-primary)] leading-[1.1] tracking-tight mb-4", getHeadingWeightClass(brand))}>
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
              role="button"
              tabIndex={0}
              onClick={() => { if (item.videoSrc || item.videoId) setActiveIdx(i); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && (item.videoSrc || item.videoId)) { e.preventDefault(); setActiveIdx(i); } }}
              className="relative shrink-0 rounded-3xl overflow-hidden cursor-pointer group shadow-xl focus:outline-none focus:ring-2 focus:ring-[#003A30]/40"
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

      {activeItem && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setActiveIdx(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveIdx(null); }}
            aria-label="Close video"
            className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            className="relative bg-black rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: "min(92vw, 480px)", aspectRatio: "9/16", maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeItem.videoSrc ? (
              <video
                key={activeItem.videoSrc}
                src={activeItem.videoSrc}
                poster={activeItem.imageUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : activeItem.videoId ? (
              <iframe
                src={`https://fast.wistia.net/embed/iframe/${activeItem.videoId}?autoPlay=true`}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="w-full h-full border-0"
                title={activeItem.name}
              />
            ) : null}
          </div>
          <div className="absolute bottom-6 left-0 right-0 text-center text-white pointer-events-none">
            <p className="text-base font-semibold">{activeItem.name}</p>
            {activeItem.practiceName && (
              <p className="text-white/65 text-sm mt-1">{activeItem.practiceName}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
