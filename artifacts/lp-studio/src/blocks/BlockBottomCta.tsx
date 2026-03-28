import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BottomCtaBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: BottomCtaBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: BottomCtaBlockProps) => void;
}

export function BlockBottomCta({ props, brand, onCtaClick, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;
  const field = (key: keyof BottomCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  return (
    <section className={cn("w-full bg-[#003A30] text-white px-6 text-center", sectionPy)}>
      <div className="max-w-3xl mx-auto">
        <InlineText as="h2" value={props.headline} onUpdate={field("headline")} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "xl"), "font-display mb-6", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} />
        {props.subheadline && <InlineText as="p" value={props.subheadline} onUpdate={field("subheadline")} className={cn(getBodySizeClass(brand), "text-white/80 mb-10")} multiline />}
        {props.ctaAction === "chilipiper" && props.chilipiperUrl ? (
          <ChiliPiperButton
            url={props.chilipiperUrl}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: LIME, color: FOREST }}
          >
            <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
            <ArrowRight className="w-4 h-4 ml-2" />
          </ChiliPiperButton>
        ) : (
          <motion.button
            onClick={onCtaClick}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: LIME, color: FOREST }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
            <ArrowRight className="w-4 h-4 ml-2" />
          </motion.button>
        )}
      </div>
    </section>
  );
}
