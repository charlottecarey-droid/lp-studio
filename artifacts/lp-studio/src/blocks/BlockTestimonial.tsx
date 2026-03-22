import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";

interface Props {
  props: TestimonialBlockProps;
  brand: BrandConfig;
}

export function BlockTestimonial({ props, brand }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  return (
    <section className={cn("w-full bg-[#F0F7F4] px-6 relative overflow-hidden", sectionPy)}>
      <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
        <Quote className="w-16 h-16 text-[#C7E738] mb-8 opacity-50" />
        <blockquote className="text-2xl md:text-4xl font-display font-medium text-[#003A30] leading-snug mb-10">
          "{props.quote}"
        </blockquote>
        <div className="flex flex-col items-center">
          <strong className="text-lg text-[#003A30]">{props.author}</strong>
          <span className="text-[#4A6358]">{props.role}</span>
          {props.practiceName && (
            <span className="text-sm text-[#4A6358] mt-1 opacity-80">{props.practiceName}</span>
          )}
        </div>
      </div>
    </section>
  );
}
