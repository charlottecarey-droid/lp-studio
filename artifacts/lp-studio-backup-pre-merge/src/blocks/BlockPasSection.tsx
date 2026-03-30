import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PasSectionBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";

interface Props {
  props: PasSectionBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSectionBlockProps) => void;
}

export function BlockPasSection({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const updateBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    const newBullets = props.bullets.map((b, i) => (i === index ? value : b));
    onFieldChange({ ...props, bullets: newBullets });
  };

  return (
    <section className={cn("w-full bg-[#003A30] text-white px-6", sectionPy)}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
        <div className="md:w-1/2 space-y-6">
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display leading-tight", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} />
          <InlineText as="p" value={props.body} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, body: v }) : undefined} className={cn(getBodySizeClass(brand), "text-white/80 leading-relaxed")} multiline />
        </div>
        <div className="md:w-1/2">
          <ul className="space-y-4">
            {props.bullets?.map((bullet, i) => (
              <li key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <AlertTriangle className="w-6 h-6 text-[#C7E738] shrink-0 mt-0.5" />
                <InlineText as="span" value={bullet} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} className="text-white/90 font-medium leading-relaxed" multiline />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
