import { cn } from "@/lib/utils";
import type { TrustBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";

interface Props {
  props: TrustBarBlockProps;
  brand: BrandConfig;
}

export function BlockTrustBar({ props, brand }: Props) {
  return (
    <section className="w-full bg-[#F8FAF9] py-12 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x-0 md:divide-x divide-slate-200">
        {props.items.map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center px-4">
            <span className={cn("text-3xl md:text-4xl font-display text-[#003A30] mb-1", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}>{item.value}</span>
            <span className="text-sm text-[#4A6358] font-medium uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
