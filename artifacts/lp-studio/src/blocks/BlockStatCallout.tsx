import { cn } from "@/lib/utils";
import type { StatCalloutBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";

interface Props {
  props: StatCalloutBlockProps;
  brand: BrandConfig;
}

export function BlockStatCallout({ props, brand }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  return (
    <section className={cn("w-full bg-[#003A30] px-6 text-center", sectionPy)}>
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <div className="text-8xl md:text-[10rem] font-display font-bold leading-none mb-6" style={{ color: LIME }}>
          {props.stat}
        </div>
        <p className="text-xl md:text-2xl text-white font-medium max-w-xl mx-auto mb-8 leading-relaxed">
          {props.description}
        </p>
        {props.footnote && (
          <p className="text-sm text-white/50 max-w-lg mx-auto">{props.footnote}</p>
        )}
      </div>
    </section>
  );
}
