import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";

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
  const dark = resolveSectionSurface({ backgroundStyle: props.backgroundStyle }, "#ffffff", brand).isDark;
  const sectionStyle = props.backgroundStyle
    ? getBgStyle(props.backgroundStyle)
    : { background: "color-mix(in srgb, var(--brand-primary) 4%, #ffffff)" };
  const headingColor = dark ? "#ffffff" : "var(--brand-heading-on-light)";
  const roleColor = dark ? "rgba(255,255,255,0.72)" : "rgb(var(--brand-text-rgb) / 0.65)";

  return (
    <section className={cn("w-full px-6 relative overflow-hidden", sectionPy)} style={sectionStyle}>
      <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-10"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 14%, transparent)" }}
          aria-hidden="true"
        >
          <Quote className={cn("w-7 h-7", dark ? "text-[var(--brand-eyebrow-on-dark)]" : "text-[var(--brand-eyebrow-on-light)]")} />
        </div>
        <blockquote className={cn("font-display leading-[1.2] tracking-tight text-balance mb-12", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY, color: headingColor, fontSize: "clamp(1.625rem, 3.4vw, 2.75rem)" }}>
          "<InlineText value={props.quote} onUpdate={field("quote")} className={cn("font-display leading-[1.2] tracking-tight", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} multiline style={{ fontFamily: DISPLAY, color: headingColor, fontSize: "inherit" }} />"
        </blockquote>
        <div
          className="w-10 h-px mb-6"
          style={{ backgroundColor: dark ? "rgba(255,255,255,0.25)" : "rgb(var(--brand-text-rgb) / 0.18)" }}
          aria-hidden="true"
        />
        <div className="flex flex-col items-center gap-0.5">
          <InlineText as="strong" value={props.author} onUpdate={field("author")} className={cn(getBodySizeClass(brand), "font-semibold")} style={{ fontFamily: BODY, color: headingColor }} />
          <InlineText as="span" value={props.role} onUpdate={field("role")} className="text-sm" style={{ fontFamily: BODY, color: roleColor }} />
          {props.practiceName && <InlineText as="span" value={props.practiceName} onUpdate={field("practiceName")} className="text-sm mt-0.5 opacity-80" style={{ fontFamily: BODY, color: roleColor }} />}
        </div>
      </div>
    </section>
  );
}
