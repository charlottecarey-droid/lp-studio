import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

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

  // Section background honors the optional `backgroundStyle` preset. When unset
  // the block keeps its historical near-white green tint so existing pages and
  // the builder default render unchanged. On a dark/brand preset the hardcoded
  // dark text would be illegible, so text colors flip to light. (Task #1127.)
  const dark = isDarkBg(props.backgroundStyle);
  const sectionStyle = props.backgroundStyle
    ? getBgStyle(props.backgroundStyle)
    : { background: "#F0F7F4" };
  const headingColor = dark ? "#ffffff" : "var(--brand-heading-on-light)";
  const roleColor = dark ? "rgba(255,255,255,0.72)" : "#4A6358";

  return (
    <section className={cn("w-full px-6 relative overflow-hidden", sectionPy)} style={sectionStyle}>
      <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
        <Quote className="w-16 h-16 text-[var(--brand-accent)] mb-8 opacity-50" />
        <blockquote className={cn("text-2xl md:text-4xl font-display leading-snug mb-10", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY, color: headingColor }}>
          "<InlineText value={props.quote} onUpdate={field("quote")} className={cn("text-2xl md:text-4xl font-display leading-snug", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} multiline style={{ fontFamily: DISPLAY, color: headingColor }} />"
        </blockquote>
        <div className="flex flex-col items-center">
          <InlineText as="strong" value={props.author} onUpdate={field("author")} className={getBodySizeClass(brand)} style={{ fontFamily: BODY, color: headingColor }} />
          <InlineText as="span" value={props.role} onUpdate={field("role")} className="text-sm" style={{ fontFamily: BODY, color: roleColor }} />
          {props.practiceName && <InlineText as="span" value={props.practiceName} onUpdate={field("practiceName")} className="text-sm mt-1 opacity-80" style={{ fontFamily: BODY, color: roleColor }} />}
        </div>
      </div>
    </section>
  );
}
