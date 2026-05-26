import { cn } from "@/lib/utils";
import type { StatCalloutBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { useCountUp } from "@/hooks/use-count-up";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT, BRAND_NUMBERS_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;
const NUMBERS = BRAND_NUMBERS_FONT;

interface Props {
  props: StatCalloutBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: StatCalloutBlockProps) => void;
  animationsEnabled?: boolean;
}

function parseNumeric(value: string): { num: number; prefix: string; suffix: string } | null {
  const match = value.match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ""));
  return { num, prefix: match[1], suffix: match[3] };
}

function AnimatedStat({ value, enabled, className, style }: { value: string; enabled: boolean; className?: string; style?: React.CSSProperties }) {
  const parsed = parseNumeric(value);
  const [count, countRef] = useCountUp(parsed?.num ?? 0, 1600, enabled && !!parsed);

  if (!parsed || !enabled) return <span className={className} style={{ ...(style), fontFamily: NUMBERS }}>{value}</span>;

  const display = `${parsed.prefix}${count.toLocaleString()}${parsed.suffix}`;
  return <span ref={countRef} className={className} style={{ ...(style), fontFamily: NUMBERS }}>{display}</span>;
}

export function BlockStatCallout({ props, brand, onFieldChange, animationsEnabled = true }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const field = (key: keyof StatCalloutBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const countUpActive = (props.countUpEnabled ?? true) && animationsEnabled && !onFieldChange;

  return (
    <section className={cn("w-full bg-[var(--brand-primary)] px-6 text-center", sectionPy)}>
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <div className={cn("text-8xl md:text-[10rem] font-display leading-none mb-6", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ color: LIME, fontFamily: NUMBERS }}>
          {onFieldChange ? (
            <InlineText value={props.stat} onUpdate={field("stat")} className={cn("font-display", getHeadingWeightClass(brand))} style={{ color: LIME, fontFamily: NUMBERS }} />
          ) : (
            <AnimatedStat
              value={props.stat}
              enabled={countUpActive}
              className={cn("font-display", getHeadingWeightClass(brand))}
              style={{ color: LIME, fontFamily: NUMBERS }}
            />
          )}
        </div>
        <InlineText as="p" value={props.description} onUpdate={field("description")} className={cn(getBodySizeClass(brand), "text-white max-w-xl mx-auto mb-8 leading-relaxed")} multiline style={{ fontFamily: BODY }} />
        {props.footnote && <InlineText as="p" value={props.footnote} onUpdate={field("footnote")} className="text-sm text-white/50 max-w-lg mx-auto" style={{ fontFamily: BODY }} />}
      </div>
    </section>
  );
}
