import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PasSectionBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, contrastTextColor, pickContrastingColor, isValidHex, DEFAULT_BRAND } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: PasSectionBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSectionBlockProps) => void;
}

export function BlockPasSection({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  // This section is painted with the brand primary. Derive text + accent
  // colors from that actual fill so copy stays legible for light-primary
  // brands and the alert icon never renders accent-on-primary (blue on blue).
  const primaryHex = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const onPrimary = contrastTextColor(primaryHex);
  const accentOnPrimary = pickContrastingColor(brand.accentColor, primaryHex, [onPrimary], 3.0);

  const updateBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    const newBullets = props.bullets.map((b, i) => (i === index ? value : b));
    onFieldChange({ ...props, bullets: newBullets });
  };

  return (
    <section className={cn("w-full bg-[var(--brand-primary)] px-6", sectionPy)} style={{ color: onPrimary }}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
        <div className="md:w-1/2 space-y-6">
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display leading-tight", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }} />
          <InlineText as="p" value={props.body} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, body: v }) : undefined} className={cn(getBodySizeClass(brand), "lg:text-lg leading-relaxed opacity-80")} multiline style={{ fontFamily: BODY }} />
        </div>
        <div className="md:w-1/2">
          <ul className="space-y-4">
            {props.bullets?.map((bullet, i) => (
              <li key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10" style={{ fontFamily: BODY }}>
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" style={{ color: accentOnPrimary }} />
                <InlineText as="span" value={bullet} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} className="font-medium leading-relaxed opacity-90" multiline style={{ fontFamily: BODY }}/>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
