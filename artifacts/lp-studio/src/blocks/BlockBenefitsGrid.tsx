import { Zap, ScanLine, RefreshCcw, HeadphonesIcon, BarChart2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BenefitsGridBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, ScanLine, RefreshCcw, HeadphonesIcon, BarChart2, DollarSign,
};

interface Props {
  props: BenefitsGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsGridBlockProps) => void;
}

export function BlockBenefitsGrid({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const updateItem = (index: number, field: "title" | "description", value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: props.items.map((item, i) => i === index ? { ...item, [field]: value } : item) });
  };

  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className="text-3xl md:text-5xl font-display font-bold text-center text-[#003A30] mb-16 max-w-3xl mx-auto leading-tight" />
        )}
        <div className={cn("grid gap-8", props.columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
          {props.items.map((benefit, i) => {
            const Icon = ICON_MAP[benefit.icon] || Zap;
            return (
              <div key={i} className="flex flex-col p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-full bg-[#E8F5F2] flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-[#003A30]" />
                </div>
                <InlineText as="h3" value={benefit.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} className="text-xl font-bold text-[#003A30] mb-3" />
                <InlineText as="p" value={benefit.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} className="text-[#4A6358] leading-relaxed" multiline />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
