import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass } from "@/lib/brand-config";
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
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = props.items ?? [];
  const activeItem = items[activeIdx] ?? null;

  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const updated = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items: updated });
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const idx = Math.min(
      Math.floor(latest * items.length),
      items.length - 1,
    );
    setActiveIdx(Math.max(0, idx));
  });

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{ height: `${items.length * 100}vh` }}
      className="relative"
    >
      {/* sticky panel */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden bg-[#FDFCFA]">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-10">

          {/* section header (shows above columns always) */}
          {(props.eyebrow || props.headline || props.subheadline) && (
            <div className="mb-10 max-w-2xl">
              {props.eyebrow && (
                <p className="text-xs font-bold uppercase tracking-widest text-[#006651] mb-2">
                  <InlineText value={props.eyebrow} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined} />
                </p>
              )}
              {props.headline && (
                <h2 className={cn("text-3xl md:text-4xl font-bold text-[#003A30] leading-tight mb-2", getHeadingWeightClass(brand))}>
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

          <div className="grid md:grid-cols-[1fr_1fr] gap-12 md:gap-20 items-center">
            {/* Left: stacked items — active one expands */}
            <div className="flex flex-col divide-y divide-slate-200">
              {items.map((item, i) => {
                const isActive = i === activeIdx;
                return (
                  <div
                    key={i}
                    className={cn(
                      "py-7 transition-all duration-300 cursor-pointer",
                      isActive ? "opacity-100" : "opacity-30 hover:opacity-50"
                    )}
                    onClick={() => setActiveIdx(i)}
                  >
                    {/* Progress bar */}
                    {isActive && (
                      <div className="h-0.5 w-full bg-slate-100 mb-5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[#C7E738] rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: items.length * 2, ease: "linear" }}
                          key={activeIdx}
                        />
                      </div>
                    )}
                    <h3 className={cn("text-xl font-bold text-[#003A30] mb-0 leading-snug", isActive && "mb-3")}>
                      <InlineText value={item.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} />
                    </h3>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="text-slate-600 text-base leading-relaxed mb-3">
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
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right: image changes with active item */}
            <div className="hidden md:block">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] bg-slate-100"
              >
                <img
                  src={activeItem?.imageUrl || PLACEHOLDER}
                  alt={activeItem?.title ?? ""}
                  className="w-full h-full object-cover"
                />
              </motion.div>
              {/* dots */}
              <div className="flex gap-2 justify-center mt-5">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      "rounded-full transition-all",
                      i === activeIdx ? "w-6 h-2 bg-[#003A30]" : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
