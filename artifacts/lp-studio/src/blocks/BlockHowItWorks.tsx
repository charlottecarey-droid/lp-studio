import { cn } from "@/lib/utils";
import type { HowItWorksBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, contrastTextColor, pickContrastingColor, relativeLuminance, resolveHeadingColor, isValidHex, DEFAULT_BRAND } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: HowItWorksBlockProps;
  brand: BrandConfig;
  /** Resolved section background (from blockSettings.bgColor). Defaults to
   *  the block's hardcoded white when unset, so text colors can be derived
   *  against the actual surface and stay legible on dark sections. */
  bgColor?: string;
  onFieldChange?: (updated: HowItWorksBlockProps) => void;
}

export function BlockHowItWorks({ props, brand, bgColor, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  // Derive text colors from the block's actual background so the headline,
  // step titles, and step descriptions stay legible on any section bg. The
  // block renders `bg-white` by default; blockSettings.bgColor (if set)
  // overrides it via the wrapper. Explicit editor overrides
  // (blockSettings.headlineColor / bodyColor) still win because they paint
  // via `!important` CSS variables that beat these inline styles.
  const sectionBg = isValidHex(bgColor ?? "") ? (bgColor as string) : "#ffffff";
  const isDarkBg = relativeLuminance(sectionBg) < 0.4;
  const headingColor = pickContrastingColor(
    resolveHeadingColor(brand, isDarkBg),
    sectionBg,
    [isDarkBg ? "#ffffff" : "#0f172a", contrastTextColor(sectionBg)],
    4.5,
  );
  const descColor = pickContrastingColor(
    isDarkBg ? "#CBD5E1" : "#4A6358",
    sectionBg,
    [isDarkBg ? "#e2e8f0" : "#334155", contrastTextColor(sectionBg)],
    4.5,
  );
  // The step circle defaults to a brand-primary fill. Derive its number color
  // from the actual fill so it never renders e.g. a blue number on a blue
  // circle when the brand's accent and primary are the same hue.
  const circleBgHex = isValidHex(props.circleBg ?? "")
    ? (props.circleBg as string)
    : isValidHex(brand.primaryColor)
      ? brand.primaryColor
      : DEFAULT_BRAND.primaryColor;
  const circleBg = props.circleBg ?? "var(--brand-primary)";
  const circleText = isValidHex(props.circleText ?? "")
    ? (props.circleText as string)
    : contrastTextColor(circleBgHex);

  const updateStep = (index: number, field: "title" | "description" | "number", value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: props.steps.map((step, i) => i === index ? { ...step, [field]: value } : step) });
  };

  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display text-center mb-12 lg:mb-16", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY, color: headingColor }} />
        )}
        <div className="grid md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-[2px] bg-slate-100 z-0" />
          {props.steps.map((step, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full font-display font-bold text-2xl flex items-center justify-center mb-6 shadow-xl border-4 border-white" style={{ backgroundColor: circleBg, color: circleText, fontFamily: DISPLAY }}>
                {step.number}
              </div>
              <InlineText as="h3" value={step.title} onUpdate={onFieldChange ? (v) => updateStep(i, "title", v) : undefined} className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "mb-4", getHeadingWeightClass(brand))} style={{ fontFamily: DISPLAY, color: headingColor }} />
              <InlineText as="p" value={step.description} onUpdate={onFieldChange ? (v) => updateStep(i, "description", v) : undefined} className={cn(getBodySizeClass(brand), "lg:text-lg leading-relaxed")} multiline style={{ fontFamily: BODY, color: descColor }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
