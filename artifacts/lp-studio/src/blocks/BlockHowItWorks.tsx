import { cn } from "@/lib/utils";
import type { HowItWorksBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: HowItWorksBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksBlockProps) => void;
}

export function BlockHowItWorks({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const updateStep = (index: number, field: "title" | "description" | "number", value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: props.steps.map((step, i) => i === index ? { ...step, [field]: value } : step) });
  };

  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-6xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className="text-3xl md:text-5xl font-display font-bold text-center text-[#003A30] mb-20" />
        )}
        <div className="grid md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-[2px] bg-slate-100 z-0" />
          {props.steps.map((step, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#003A30] text-[#C7E738] font-display font-bold text-2xl flex items-center justify-center mb-6 shadow-xl border-4 border-white">
                {step.number}
              </div>
              <InlineText as="h3" value={step.title} onUpdate={onFieldChange ? (v) => updateStep(i, "title", v) : undefined} className="text-xl font-bold text-[#003A30] mb-4" />
              <InlineText as="p" value={step.description} onUpdate={onFieldChange ? (v) => updateStep(i, "description", v) : undefined} className="text-[#4A6358] leading-relaxed" multiline />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
