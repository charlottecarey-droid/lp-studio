import type { ResourcesBlockProps } from "../lib/block-types";
import type { BrandConfig } from "../lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "../lib/brand-config";
import { getHeadlineSizeClass } from "../lib/typography";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ImageIcon, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: ResourcesBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: ResourcesBlockProps) => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function BlockResources({ props, brand, animationsEnabled = true, onFieldChange }: Props) {
  const { headline, subheadline, columns, items, backgroundStyle } = props;
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const isDark = isDarkBg(backgroundStyle);
  const cardBg = isDark ? "bg-white/10" : "bg-white";

  const field = (key: keyof ResourcesBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ResourcesBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<ResourcesBlockProps["items"][number]>) =>
        onFieldChange({ ...props, items: items.map((it, idx) => idx === i ? { ...it, ...patch } : it) })
    : undefined;

  const GRID_COLS: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  };
  const gridCols = GRID_COLS[columns] ?? GRID_COLS[3];

  return (
    <section className={`${sectionPy}`} style={getBgStyle(backgroundStyle)}>
      <div className="max-w-7xl mx-auto px-6">
        {(headline || onFieldChange) && (
          <h2 className={`${getHeadlineSizeClass(undefined, brand.h2Size ?? "lg")} ${getHeadingWeightClass(brand)} ${getHeadingLetterSpacingClass(brand)} font-display mb-2`} style={{ fontFamily: DISPLAY }}>
            <InlineText value={headline ?? ""} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
          </h2>
        )}
        {(subheadline || onFieldChange) && (
          <p className={`${getBodySizeClass(brand)} lg:text-lg leading-relaxed mb-12 lg:mb-16 ${isDark ? "text-white/70" : "text-slate-500"}`} style={{ fontFamily: BODY }}>
            <InlineText value={subheadline ?? ""} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
          </p>
        )}

        <div className={`grid ${gridCols} gap-6`}>
          {items.map((item, i) => (
            <motion.a
              key={i}
              href={item.url || "#"}
              className={`group rounded-xl overflow-hidden ${cardBg} border flex flex-col`}
              style={isDark ? { borderColor: "rgba(255,255,255,0.08)" } : { borderColor: "rgb(241,245,249)" }}
              initial={animationsEnabled ? { opacity: 0, y: 28 } : undefined}
              whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, amount: 0.1 }}
              transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: i * 0.07 } : undefined}
              whileHover={animationsEnabled ? { y: -6, scale: 1.015, boxShadow: "0 20px 40px rgba(0,0,0,0.10)" } : undefined}
            >
              <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                {item.image ? (
                  <InlineImage
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    wrapperClassName="block w-full h-full"
                    onUpdate={updateItem ? (url) => updateItem(i, { image: url }) : undefined}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                {(item.category || updateItem) && (
                  <span className="text-xs uppercase tracking-wider font-medium mb-2" style={{ ...{color: brand.primaryColor}, ...{fontFamily: BODY} }}>
                    <InlineText value={item.category ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { category: v }) : undefined} style={{ fontFamily: BODY }}/>
                  </span>
                )}
                <h3 className={`${getHeadlineSizeClass(undefined, brand.h3Size ?? "sm")} ${getHeadingWeightClass(brand)} leading-snug mb-2 ${isDark ? "text-white" : "text-slate-900"}`} style={{ fontFamily: DISPLAY }}>
                  <InlineText value={item.title} onUpdate={updateItem ? (v) => updateItem(i, { title: v }) : undefined} style={{ fontFamily: DISPLAY }}/>
                </h3>
                {(item.description || updateItem) && (
                  <p className={`text-sm leading-relaxed flex-1 ${isDark ? "text-white/70" : "text-slate-500"}`} style={{ fontFamily: BODY }}>
                    <InlineText value={item.description ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { description: v }) : undefined} multiline style={{ fontFamily: BODY }}/>
                  </p>
                )}
                <div
                  className="mt-4 flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
                  style={{ color: brand.primaryColor }}
                >
                  Read more
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
