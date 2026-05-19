import type { CaseStudiesBlockProps } from "../lib/block-types";
import type { BrandConfig } from "../lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "../lib/brand-config";
import { getHeadlineSizeClass } from "../lib/typography";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: CaseStudiesBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: CaseStudiesBlockProps) => void;
}

function Placeholder({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-200 flex items-center justify-center ${className ?? ""}`}>
      <ImageIcon className="w-10 h-10 text-slate-400" />
    </div>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BlockCaseStudies({ props, brand, animationsEnabled = true, onFieldChange }: Props) {
  const { headline, subheadline, backgroundStyle } = props;
  const items = props.items ?? [];
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const isDark = isDarkBg(backgroundStyle);
  const featured = items[0];
  const rest = items.slice(1);

  const field = (key: keyof CaseStudiesBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as CaseStudiesBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<CaseStudiesBlockProps["items"][number]>) =>
        onFieldChange({ ...props, items: items.map((it, idx) => idx === i ? { ...it, ...patch } : it) })
    : undefined;

  return (
    <section className={`${sectionPy}`} style={getBgStyle(backgroundStyle)}>
      <div className="max-w-7xl mx-auto px-6">
        {(headline || onFieldChange) && (
          <h2 className={`${getHeadlineSizeClass(undefined, brand.h2Size ?? "lg")} ${getHeadingWeightClass(brand)} ${getHeadingLetterSpacingClass(brand)} font-display mb-2`} style={{ fontFamily: DISPLAY }}>
            <InlineText value={headline ?? ""} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
          </h2>
        )}
        {(subheadline || onFieldChange) && (
          <p className={`${getBodySizeClass(brand)} lg:text-lg leading-relaxed ${isDark ? "text-white/70" : "text-slate-500"} mb-12 lg:mb-16`} style={{ fontFamily: BODY }}>
            <InlineText value={subheadline ?? ""} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
          </p>
        )}

        <div className={`grid grid-cols-1 gap-4 ${{
          2: "md:grid-cols-2",
          3: "md:grid-cols-3",
          4: "md:grid-cols-4",
        }[props.columns ?? 2]}`}>
          {featured && (
            <motion.a
              href={featured.url || "#"}
              className={`group relative ${(props.columns ?? 2) === 2 ? "row-span-2" : ""} rounded-xl overflow-hidden min-h-[400px] md:min-h-[520px] flex flex-col justify-end`}
              initial={animationsEnabled ? { opacity: 0, y: 24 } : undefined}
              whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, amount: 0.1 }}
              transition={animationsEnabled ? { duration: 0.6, ease: EASE } : undefined}
              whileHover={(props.hoverLift ?? true) ? { y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.14)" } : undefined}
            >
              {featured.image ? (
                <InlineImage
                  src={featured.image}
                  alt={featured.title}
                  className={cn("absolute inset-0 w-full h-full object-cover transition-transform duration-500", (props.hoverImageZoom ?? true) && "group-hover:scale-105")}
                  wrapperClassName="absolute inset-0"
                  onUpdate={updateItem ? (url) => updateItem(0, { image: url }) : undefined}
                />
              ) : (
                <Placeholder className="absolute inset-0 w-full h-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {featured.logoUrl && (
                <img
                  src={featured.logoUrl}
                  alt=""
                  className="absolute top-6 left-6 h-10 object-contain brightness-0 invert"
                />
              )}
              <div className="relative p-6 md:p-8">
                <h3 className={`${getHeadlineSizeClass(undefined, brand.h3Size ?? "md")} ${getHeadingWeightClass(brand)} text-white leading-snug mb-2`} style={{ fontFamily: DISPLAY }}>
                  <InlineText value={featured.title} onUpdate={updateItem ? (v) => updateItem(0, { title: v }) : undefined} style={{ fontFamily: DISPLAY }}/>
                </h3>
                {(featured.categories || updateItem) && (
                  <p className="text-xs uppercase tracking-wider text-white/60" style={{ fontFamily: BODY }}>
                    <InlineText value={featured.categories ?? ""} onUpdate={updateItem ? (v) => updateItem(0, { categories: v }) : undefined} style={{ fontFamily: BODY }}/>
                  </p>
                )}
              </div>
            </motion.a>
          )}

          {rest.map((item, i) => (
            <motion.a
              key={i}
              href={item.url || "#"}
              className="group relative rounded-xl overflow-hidden min-h-[250px] flex flex-col justify-end"
              initial={animationsEnabled ? { opacity: 0, y: 24 } : undefined}
              whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, amount: 0.1 }}
              transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: (i + 1) * 0.07 } : undefined}
              whileHover={(props.hoverLift ?? true) ? { y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.14)" } : undefined}
            >
              {item.image ? (
                <InlineImage
                  src={item.image}
                  alt={item.title}
                  className={cn("absolute inset-0 w-full h-full object-cover transition-transform duration-500", (props.hoverImageZoom ?? true) && "group-hover:scale-105")}
                  wrapperClassName="absolute inset-0"
                  onUpdate={updateItem ? (url) => updateItem(i + 1, { image: url }) : undefined}
                />
              ) : (
                <Placeholder className="absolute inset-0 w-full h-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              {item.logoUrl && (
                <img
                  src={item.logoUrl}
                  alt=""
                  className="absolute top-4 left-4 h-8 object-contain brightness-0 invert"
                />
              )}
              <div className="relative p-5">
                <h3 className={`${getHeadlineSizeClass(undefined, brand.h3Size ?? "sm")} ${getHeadingWeightClass(brand)} text-white leading-snug mb-1`} style={{ fontFamily: DISPLAY }}>
                  <InlineText value={item.title} onUpdate={updateItem ? (v) => updateItem(i + 1, { title: v }) : undefined} style={{ fontFamily: DISPLAY }}/>
                </h3>
                {(item.categories || updateItem) && (
                  <p className="text-[11px] uppercase tracking-wider text-white/60" style={{ fontFamily: BODY }}>
                    <InlineText value={item.categories ?? ""} onUpdate={updateItem ? (v) => updateItem(i + 1, { categories: v }) : undefined} style={{ fontFamily: BODY }}/>
                  </p>
                )}
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
