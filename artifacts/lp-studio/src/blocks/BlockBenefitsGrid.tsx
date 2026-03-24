import { Zap, ScanLine, RefreshCcw, HeadphonesIcon, BarChart2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BenefitsGridBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, ScanLine, RefreshCcw, HeadphonesIcon, BarChart2, DollarSign,
};

const CARD_SPRING = { type: "spring" as const, stiffness: 320, damping: 22 };
const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  props: BenefitsGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsGridBlockProps) => void;
  animationsEnabled?: boolean;
}

export function BlockBenefitsGrid({ props, brand, onFieldChange, animationsEnabled = true }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];

  const updateItem = (index: number, field: "title" | "description", value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: props.items.map((item, i) => i === index ? { ...item, [field]: value } : item) });
  };

  return (
    <section className={cn("w-full bg-white px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display text-center text-[#003A30] mb-16 max-w-3xl mx-auto leading-tight", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} />
        )}
        <div className={cn("grid gap-8", {
          2: "grid-cols-1 sm:grid-cols-2",
          3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
        }[props.columns ?? 3])}>
          {props.items.map((benefit, i) => {
            const Icon = ICON_MAP[benefit.icon] || Zap;
            return (
              <motion.div
                key={i}
                className="flex flex-col p-8 rounded-2xl bg-white border border-slate-100 shadow-sm"
                initial={animationsEnabled ? { opacity: 0, y: 32 } : undefined}
                whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, amount: 0.12 }}
                transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: i * 0.07 } : undefined}
                whileHover={animationsEnabled ? { y: -6, scale: 1.015, boxShadow: "0 20px 40px rgba(0,0,0,0.10)" } : undefined}
                whileTap={animationsEnabled ? { scale: 0.99 } : undefined}
                style={animationsEnabled ? undefined : { transition: "box-shadow 0.2s" }}
              >
                <div className="w-14 h-14 rounded-full bg-[#E8F5F2] flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-[#003A30]" />
                </div>
                <InlineText as="h3" value={benefit.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "text-[#003A30] mb-3", getHeadingWeightClass(brand))} />
                <InlineText as="p" value={benefit.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} className={cn(getBodySizeClass(brand), "text-[#4A6358] leading-relaxed")} multiline />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
