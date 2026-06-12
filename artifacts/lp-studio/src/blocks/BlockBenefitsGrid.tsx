import { Zap, ScanLine, RefreshCcw, HeadphonesIcon, BarChart2, DollarSign, Users, MessageCircle, Bot, Activity, Clipboard, Bell, Package, Monitor, BookOpen, Star, CheckCircle } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import { cn } from "@/lib/utils";
import type { BenefitsGridBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineImage } from "@/components/InlineImage";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;


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
  const isBuilder = !!onFieldChange;
  const accent = brand.primaryColor ?? "#4f46e5";

  const updateItem = (index: number, field: "title" | "description", value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: props.items.map((item, i) => i === index ? { ...item, [field]: value } : item) });
  };

  const updateItemImage = (index: number, url: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: props.items.map((item, i) => i === index ? { ...item, image: url } : item) });
  };

  return (
    <section className={cn("relative w-full overflow-hidden bg-white px-6", sectionPy)}>
      <SectionDecor accent={accent} isDark={false} disabled={isBuilder} />
      <div className="relative z-10 max-w-7xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display text-center text-[var(--brand-heading-on-light)] mb-12 lg:mb-16 max-w-3xl mx-auto leading-tight", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }} />
        )}
        <div className={cn("grid gap-8", {
          2: "grid-cols-1 sm:grid-cols-2",
          3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
        }[props.columns ?? 3])}>
          {props.items.map((benefit, i) => {
            const hasImage = !!benefit.image;
            return (
              <motion.div
                key={i}
                className={cn(
                  "group flex flex-col rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(15,15,20,0.04),0_10px_30px_-12px_rgba(15,15,20,0.08)]",
                  hasImage ? "overflow-hidden" : "p-8",
                )}
                initial={animationsEnabled ? { opacity: 0, y: 32 } : undefined}
                whileInView={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, amount: 0.12 }}
                transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: i * 0.07 } : undefined}
                whileHover={(props.hoverLift ?? true) ? { y: -5, scale: 1.01, boxShadow: "0 1px 2px rgba(15,15,20,0.04), 0 20px 44px -14px rgba(15,15,20,0.16)" } : undefined}
                whileTap={(props.hoverLift ?? true) ? { scale: 0.99 } : undefined}
                style={(props.hoverLift ?? true) ? undefined : { transition: "box-shadow 0.2s" }}
              >
                {hasImage ? (
                  // When generation supplies a real photo for this benefit, lead
                  // the card with the image and overlay the lucide icon as a
                  // small badge so the iconography is preserved.
                  <div className="relative w-full h-44 overflow-hidden bg-slate-50">
                    <InlineImage
                      src={benefit.image ?? ""}
                      alt={benefit.imageAlt ?? benefit.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      wrapperClassName="block w-full h-full"
                      onUpdate={onFieldChange ? (url) => updateItemImage(i, url) : undefined}
                    />
                    <div className="absolute bottom-3 left-3 w-11 h-11 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-sm ring-1 ring-black/[0.06]">
                      <IconOrImage value={benefit.icon} fallback={Zap} className="w-6 h-6 text-[var(--brand-primary)]" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                    style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 9%, transparent)" }}
                  >
                    <IconOrImage value={benefit.icon} fallback={Zap} className="w-6 h-6 text-[var(--brand-primary)]" />
                  </div>
                )}
                <div className={cn(hasImage && "p-8 pt-6 flex flex-col flex-1")}>
                  <InlineText as="h3" value={benefit.title} onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined} className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "text-[var(--brand-heading-on-light)] mb-3", getHeadingWeightClass(brand))} style={{ fontFamily: DISPLAY }} />
                  <InlineText as="p" value={benefit.description} onUpdate={onFieldChange ? (v) => updateItem(i, "description", v) : undefined} className={cn(getBodySizeClass(brand), "lg:text-lg leading-relaxed text-[rgb(var(--brand-text-rgb)/0.68)]")} style={{ fontFamily: BODY }} multiline />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
