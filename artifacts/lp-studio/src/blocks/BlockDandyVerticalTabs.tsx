import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyVerticalTabsBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";
import { ArrowRight } from "lucide-react";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1200&h=800&fit=crop";

interface Props {
  props: DandyVerticalTabsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVerticalTabsBlockProps) => void;
}

export function BlockDandyVerticalTabs({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const [active, setActive] = useState(0);

  const updateTab = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const tabs = props.tabs.map((t, idx) => idx === i ? { ...t, [key]: value } : t);
    onFieldChange({ ...props, tabs });
  };

  const tabs = props.tabs ?? [];
  const activeTab = tabs[active] ?? null;

  return (
    <section className={cn("w-full bg-white", sectionPy)}>
      <div className="max-w-6xl mx-auto px-6">
        {(props.headline || props.subheadline) && (
          <div className="mb-10 max-w-2xl">
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

        <div className="grid md:grid-cols-[2fr_3fr] gap-10 items-start">
          {/* Tab list */}
          <div className="flex flex-col divide-y divide-slate-100">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  "text-left py-6 transition-all group",
                  i === active ? "opacity-100" : "opacity-40 hover:opacity-70"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-1 w-1 h-full rounded-full shrink-0 self-stretch min-h-4",
                    i === active ? "bg-[#C7E738]" : "bg-transparent"
                  )} />
                  <div>
                    <h3 className={cn("text-base font-bold text-[#003A30] mb-1", i === active && "text-[#003A30]")}>
                      <InlineText value={tab.title} onUpdate={onFieldChange ? (v) => updateTab(i, "title", v) : undefined} />
                    </h3>
                    {i === active && (
                      <>
                        <p className="text-sm text-slate-600 leading-relaxed mb-3">
                          <InlineText value={tab.description} onUpdate={onFieldChange ? (v) => updateTab(i, "description", v) : undefined} />
                        </p>
                        {tab.ctaText && (
                          <button
                            onClick={(e) => { e.stopPropagation(); safeNavigate(tab.ctaUrl); }}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#003A30] hover:text-[#006651] transition-colors"
                          >
                            <InlineText value={tab.ctaText} onUpdate={onFieldChange ? (v) => updateTab(i, "ctaText", v) : undefined} />
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Image panel */}
          <div className="sticky top-8 rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100 shadow-lg">
            {activeTab && (
              <img
                key={active}
                src={activeTab.imageUrl || PLACEHOLDER}
                alt={activeTab.title}
                className="w-full h-full object-cover transition-opacity duration-300"
                loading="lazy"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
