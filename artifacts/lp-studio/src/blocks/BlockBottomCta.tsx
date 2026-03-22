import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BottomCtaBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getButtonClasses } from "@/lib/brand-config";

interface Props {
  props: BottomCtaBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

export function BlockBottomCta({ props, brand, onCtaClick }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;

  return (
    <section className={cn("w-full bg-[#003A30] text-white px-6 text-center", sectionPy)}>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">{props.headline}</h2>
        {props.subheadline && (
          <p className="text-xl text-white/80 mb-10">{props.subheadline}</p>
        )}
        <button
          onClick={onCtaClick}
          className={getButtonClasses(brand, "inline-flex items-center")}
          style={{ backgroundColor: LIME, color: FOREST }}
        >
          {props.ctaText}
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </section>
  );
}
