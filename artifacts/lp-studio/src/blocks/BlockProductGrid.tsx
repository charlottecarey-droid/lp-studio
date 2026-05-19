import { cn } from "@/lib/utils";
import type { ProductGridBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { getHeadlineSizeClass } from "@/lib/typography";
import { InlineImage } from "@/components/InlineImage";
import { InlineText } from "@/components/InlineText";
import { motion } from "framer-motion";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: ProductGridBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: ProductGridBlockProps) => void;
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function BlockProductGrid({ props, brand, animationsEnabled = true, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const cols = props.columns ?? 3;
  const updateItemImage = (i: number, url: string) => {
    if (!onFieldChange) return;
    const items = props.items.map((it, idx) => idx === i ? { ...it, image: url } : it);
    onFieldChange({ ...props, items });
  };
  const field = (key: keyof ProductGridBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ProductGridBlockProps[typeof key] }) : undefined;
  const updateItemText = onFieldChange
    ? (i: number, patch: Partial<ProductGridBlockProps["items"][number]>) =>
        onFieldChange({ ...props, items: props.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) })
    : undefined;
  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
          {props.headline && (
            <h2 className={cn(getHeadlineSizeClass(undefined, brand.h2Size ?? "lg"), "font-display text-[var(--brand-primary)] mb-6", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }}>
              <InlineText as="span" value={props.headline} onUpdate={field("headline")} multiline style={{ fontFamily: BODY }}/>
            </h2>
          )}
          {props.subheadline && (
            <p className={cn(getBodySizeClass(brand), "text-[#4A6358] leading-relaxed")} style={{ fontFamily: BODY }}>
              <InlineText as="span" value={props.subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </p>
          )}
        </div>
        <div className={cn("grid gap-8", GRID_COLS[cols] ?? GRID_COLS[3])}>
          {props.items.map((item, i) => (
            <motion.div
              key={i}
              className="group rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-white flex flex-col"
              initial={animationsEnabled ? { opacity: 0, y: 28 } : undefined}
              whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, amount: 0.1 }}
              transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: i * 0.07 } : undefined}
              whileHover={(props.hoverLift ?? true) ? { y: -6, scale: 1.015, boxShadow: "0 20px 40px rgba(0,0,0,0.10)" } : undefined}
            >
              <div className="w-full h-52 overflow-hidden bg-slate-50">
                <InlineImage
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className={cn("w-full h-full object-cover transition-transform duration-300", (props.hoverImageZoom ?? true) && "group-hover:scale-105")}
                  wrapperClassName="block w-full h-full"
                  onUpdate={onFieldChange ? (url) => updateItemImage(i, url) : undefined}
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "text-[var(--brand-primary)] mb-2", getHeadingWeightClass(brand))} style={{ fontFamily: DISPLAY }}>
                  <InlineText
                    as="span"
                    value={item.title}
                    onUpdate={updateItemText ? (v) => updateItemText(i, { title: v }) : undefined}
                  style={{ fontFamily: BODY }}/>
                </h3>
                <p className="text-[#4A6358] text-sm leading-relaxed flex-1" style={{ fontFamily: BODY }}>
                  <InlineText
                    as="span"
                    value={item.description}
                    onUpdate={updateItemText ? (v) => updateItemText(i, { description: v }) : undefined}
                    multiline
                  style={{ fontFamily: BODY }}/>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
