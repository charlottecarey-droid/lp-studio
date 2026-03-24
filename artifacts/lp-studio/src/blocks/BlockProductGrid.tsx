import { cn } from "@/lib/utils";
import type { ProductGridBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";

interface Props {
  props: ProductGridBlockProps;
  brand: BrandConfig;
  animationsEnabled?: boolean;
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function BlockProductGrid({ props, brand, animationsEnabled = true }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const cols = props.columns ?? 3;
  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          {props.headline && (
            <h2 className={cn(getHeadlineSizeClass(undefined, brand.h2Size ?? "lg"), "font-display text-[#003A30] mb-6", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}>{props.headline}</h2>
          )}
          {props.subheadline && (
            <p className={cn(getBodySizeClass(brand), "text-[#4A6358] leading-relaxed")}>{props.subheadline}</p>
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
              whileHover={animationsEnabled ? { y: -6, scale: 1.015, boxShadow: "0 20px 40px rgba(0,0,0,0.10)" } : undefined}
            >
              <div className="w-full h-52 overflow-hidden bg-slate-50">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "text-[#003A30] mb-2", getHeadingWeightClass(brand))}>{item.title}</h3>
                <p className="text-[#4A6358] text-sm leading-relaxed flex-1">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
