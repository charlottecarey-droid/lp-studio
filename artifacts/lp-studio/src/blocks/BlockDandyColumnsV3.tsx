import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass } from "@/lib/brand-config";
import type { DandyColumnsV3BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: DandyColumnsV3BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyColumnsV3BlockProps) => void;
}

export function BlockDandyColumnsV3({ props, brand, onFieldChange }: Props) {
  const updateItem = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item);
    onFieldChange({ ...props, items });
  };

  // Section background honors the optional `backgroundStyle` preset. When it's
  // unset the block keeps its historical near-white tint so existing pages and
  // the builder default render unchanged. On a dark/brand preset the hardcoded
  // dark text would be illegible, so text colors flip to light. (Task #1127.)
  const dark = isDarkBg(props.backgroundStyle);
  const sectionStyle = props.backgroundStyle
    ? getBgStyle(props.backgroundStyle)
    : { background: "#FDFCFA" };
  const headingColor = dark ? "#ffffff" : "var(--brand-heading-on-light)";
  const bodyColor = dark ? "rgba(255,255,255,0.82)" : undefined;
  const eyebrowColor = dark ? "rgba(255,255,255,0.9)" : "#006651";

  return (
    <section className="w-full py-20 md:py-28" style={sectionStyle}>
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {(props.eyebrow || props.headline || props.subheadline) && (
          // `headerAlign` defaults to "left" so existing pages render unchanged.
          // When centered, `mx-auto` + `text-center` recentres the whole header
          // block (and its narrower max-width) over the 3-column grid below.
          <div
            className={cn(
              "mb-14 max-w-2xl",
              props.headerAlign === "center" ? "mx-auto text-center" : "",
            )}
          >
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ fontFamily: BODY, color: eyebrowColor }}>
                <InlineText value={props.eyebrow} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, eyebrow: v }) : undefined} style={{ fontFamily: BODY, color: eyebrowColor }}/>
              </p>
            )}
            {props.headline && (
              <h2 className={cn("text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-4", getHeadingWeightClass(brand))} style={{ fontFamily: DISPLAY, color: headingColor }}>
                <InlineText value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} style={{ fontFamily: DISPLAY, color: headingColor }}/>
              </h2>
            )}
            {props.subheadline && (
              <p className={cn("text-lg leading-relaxed", dark ? "" : "text-slate-600")} style={{ fontFamily: BODY, color: bodyColor }}>
                <InlineText value={props.subheadline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, subheadline: v }) : undefined} style={{ fontFamily: BODY, color: bodyColor }}/>
              </p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-12 md:gap-16">
          {(props.items ?? []).map((item, i) => (
            <div key={i} className="flex flex-col gap-5">
              {item.imageUrl && (
                <div className="w-16 h-16 flex items-center justify-center">
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-16 h-16 object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              <div
                className={cn(
                  "flex items-center",
                  props.numberGap === "tight" ? "gap-1" : props.numberGap === "loose" ? "gap-6" : "gap-4",
                )}
              >
                {(props.showNumbers ?? true) && (
                  <span className="font-bold text-2xl leading-none" style={{ color: props.numberColor ?? "var(--brand-accent)", fontFamily: BODY }}>
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                )}
                <h3 className="text-xl font-bold leading-tight" style={{ fontFamily: DISPLAY, color: headingColor }}>
                  <InlineText value={item.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} style={{ fontFamily: DISPLAY, color: headingColor }}/>
                </h3>
              </div>
              <p className={cn("text-base leading-relaxed", dark ? "" : "text-slate-600")} style={{ fontFamily: BODY, color: bodyColor }}>
                <InlineText value={item.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} style={{ fontFamily: BODY, color: bodyColor }}/>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
