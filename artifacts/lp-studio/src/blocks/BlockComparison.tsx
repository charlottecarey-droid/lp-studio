import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getButtonClasses } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: ComparisonBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ComparisonBlockProps) => void;
}

export function BlockComparison({ props, brand, onCtaClick, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;

  const updateOldBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, oldWayBullets: props.oldWayBullets.map((b, i) => (i === index ? value : b)) });
  };

  const updateNewBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, newWayBullets: props.newWayBullets.map((b, i) => (i === index ? value : b)) });
  };

  return (
    <section className={cn("w-full bg-slate-50 px-6", sectionPy)}>
      <div className="max-w-6xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className="text-4xl md:text-5xl font-display font-bold text-center text-[#003A30] mb-16" />
        )}
        <div className="grid md:grid-cols-2 gap-8 items-stretch mb-16">
          <div className="bg-slate-100 rounded-3xl p-8 md:p-12 opacity-80 flex flex-col">
            <div className="mb-8">
              <span className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-2 block">OLD WAY</span>
              <InlineText as="h3" value={props.oldWayLabel} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, oldWayLabel: v }) : undefined} className="text-2xl font-bold text-[#003A30]" />
            </div>
            <ul className="space-y-6 flex-1">
              {props.oldWayBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                  <InlineText as="span" value={bullet} onUpdate={onFieldChange ? (v) => updateOldBullet(i, v) : undefined} className="text-[#4A6358] font-medium leading-relaxed" multiline />
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#003A30] rounded-3xl p-8 md:p-12 flex flex-col ring-2 ring-[#C7E738]/20 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C7E738] opacity-[0.03] blur-3xl rounded-full" />
            <div className="mb-8 relative z-10">
              <span className="text-sm font-bold tracking-widest text-[#C7E738] uppercase mb-2 block">NEW WAY</span>
              <InlineText as="h3" value={props.newWayLabel} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, newWayLabel: v }) : undefined} className="text-2xl font-bold text-white" />
            </div>
            <ul className="space-y-6 flex-1 relative z-10">
              {props.newWayBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <CheckCircle2 className="w-6 h-6 text-[#C7E738] shrink-0 mt-0.5" />
                  <InlineText as="span" value={bullet} onUpdate={onFieldChange ? (v) => updateNewBullet(i, v) : undefined} className="text-white/90 font-medium leading-relaxed" multiline />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="text-center">
          <button onClick={onCtaClick} className={getButtonClasses(brand, "inline-flex items-center")} style={{ backgroundColor: LIME, color: FOREST }}>
            <InlineText value={props.ctaText} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaText: v }) : undefined} />
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
}
