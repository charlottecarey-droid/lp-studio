import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

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
        <Quote className="w-16 h-16 text-[var(--brand-accent)] mb-8 opacity-50" />
        <blockquote className={cn("text-2xl md:text-4xl font-display text-[var(--brand-heading-on-light)] leading-snug mb-10", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }}>
          "<InlineText value={props.quote} onUpdate={field("quote")} className={cn("text-2xl md:text-4xl font-display text-[var(--brand-heading-on-light)] leading-snug", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} multiline style={{ fontFamily: DISPLAY }} />"
        </blockquote>
        <div className="flex flex-col items-center">
          <InlineText as="strong" value={props.author} onUpdate={field("author")} className={cn(getBodySizeClass(brand), "text-[var(--brand-heading-on-light)]")} style={{ fontFamily: BODY }} />
          <InlineText as="span" value={props.role} onUpdate={field("role")} className={cn("text-sm text-[#4A6358]")} style={{ fontFamily: BODY }} />
          {props.practiceName && <InlineText as="span" value={props.practiceName} onUpdate={field("practiceName")} className="text-sm text-[#4A6358] mt-1 opacity-80" style={{ fontFamily: BODY }} />}
        </div>
      </div>
    </section>
  );
}
