import { cn } from "@/lib/utils";
import type { StatCalloutBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: StatCalloutBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: StatCalloutBlockProps) => void;
}

export function BlockStatCallout({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const field = (key: keyof StatCalloutBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  return (
    <section className={cn("w-full bg-[#003A30] px-6 text-center", sectionPy)}>
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <div className="text-8xl md:text-[10rem] font-display font-bold leading-none mb-6" style={{ color: LIME }}>
          <InlineText value={props.stat} onUpdate={field("stat")} className="font-display font-bold" style={{ color: LIME }} />
        </div>
        <InlineText as="p" value={props.description} onUpdate={field("description")} className="text-xl md:text-2xl text-white font-medium max-w-xl mx-auto mb-8 leading-relaxed" multiline />
        {props.footnote && <InlineText as="p" value={props.footnote} onUpdate={field("footnote")} className="text-sm text-white/50 max-w-lg mx-auto" />}
      </div>
    </section>
  );
}
