import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: TestimonialBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: TestimonialBlockProps) => void;
}

export function BlockTestimonial({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const field = (key: keyof TestimonialBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  return (
    <section className={cn("w-full bg-[#F0F7F4] px-6 relative overflow-hidden", sectionPy)}>
      <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
        <Quote className="w-16 h-16 text-[#C7E738] mb-8 opacity-50" />
        <blockquote className="text-2xl md:text-4xl font-display font-medium text-[#003A30] leading-snug mb-10">
          "<InlineText value={props.quote} onUpdate={field("quote")} className="text-2xl md:text-4xl font-display font-medium text-[#003A30] leading-snug" multiline />"
        </blockquote>
        <div className="flex flex-col items-center">
          <InlineText as="strong" value={props.author} onUpdate={field("author")} className="text-lg text-[#003A30]" />
          <InlineText as="span" value={props.role} onUpdate={field("role")} className="text-[#4A6358]" />
          {props.practiceName && <InlineText as="span" value={props.practiceName} onUpdate={field("practiceName")} className="text-sm text-[#4A6358] mt-1 opacity-80" />}
        </div>
      </div>
    </section>
  );
}
