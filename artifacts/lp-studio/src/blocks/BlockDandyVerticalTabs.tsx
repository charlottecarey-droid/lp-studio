import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyVerticalTabsBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { ArrowRight } from "lucide-react";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1200&h=900&fit=crop";

interface Props {
  props: DandyVerticalTabsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVerticalTabsBlockProps) => void;
}

export function BlockDandyVerticalTabs({ props, brand, onFieldChange }: Props) {
  const [active, setActive] = useState(0);

  const updateTab = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const tabs = props.tabs.map((t, idx) => idx === i ? { ...t, [key]: value } : t);
    onFieldChange({ ...props, tabs });
  };

  const tabs = props.tabs ?? [];
  const activeTab = tabs[active] ?? null;

  return (
    <section className="w-full py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {(props.headline || props.subheadline) && (
          <div className="mb-14 max-w-2xl">
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

        <div className="grid md:grid-cols-[2fr_3fr] gap-12 md:gap-16 items-start">
          {/* Tab list */}
          <div className="flex flex-col divide-y divide-slate-100">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  "text-left py-8 transition-all",
                  i === active ? "opacity-100" : "opacity-35 hover:opacity-60"
                )}
              >
                <div className="flex items-start gap-4">
                  <span className={cn(
                    "mt-1.5 w-1.5 rounded-full shrink-0 transition-all",
                    i === active ? "bg-[#C7E738] self-stretch min-h-5" : "bg-transparent h-5"
                  )} />
                  <div>
                    <h3 className="text-xl font-bold text-[#003A30] mb-0 leading-snug">
                      <InlineText value={tab.title} onUpdate={onFieldChange ? (v) => updateTab(i, "title", v) : undefined} />
                    </h3>
                    {i === active && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-3"
                      >
                        <p className="text-base text-slate-600 leading-relaxed mb-4">
                          <InlineText value={tab.description} onUpdate={onFieldChange ? (v) => updateTab(i, "description", v) : undefined} />
                        </p>
                        {tab.ctaText && (
                          <button
                            onClick={(e) => { e.stopPropagation(); safeNavigate(tab.ctaUrl); }}
                            className="inline-flex items-center gap-2 text-base font-semibold text-[#003A30] hover:text-[#006651] transition-colors"
                          >
                            <InlineText value={tab.ctaText} onUpdate={onFieldChange ? (v) => updateTab(i, "ctaText", v) : undefined} />
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Image panel */}
          <div className="sticky top-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="rounded-3xl overflow-hidden aspect-[4/3] bg-slate-100 shadow-2xl"
              >
                {activeTab && (
                  <img
                    src={activeTab.imageUrl || PLACEHOLDER}
                    alt={activeTab.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
