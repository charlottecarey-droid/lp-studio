import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { ZigzagFeaturesBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&h=600&fit=crop";

interface Props {
  props: ZigzagFeaturesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ZigzagFeaturesBlockProps) => void;
}

export function BlockZigzagFeatures({ props, brand, onFieldChange }: Props) {
  const updateRow = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const rows = props.rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r);
    onFieldChange({ ...props, rows });
  };

  return (
    <section className={cn("w-full bg-white", SECTION_PY[brand.sectionPadding])}>
      <div className="max-w-7xl mx-auto px-6 space-y-20 lg:space-y-28">
        {props.rows.map((row, i) => {
          const isImageLeft = i % 2 === 0;
          const imageEl = (
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100 shadow-lg">
              <img
                src={row.imageUrl || PLACEHOLDER_IMAGE}
                alt={row.headline}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          );

          const textEl = (
            <div className="flex flex-col justify-center gap-5">
              {row.tag && (
                <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}>
                  <InlineText
                    value={row.tag}
                    onUpdate={onFieldChange ? (v) => updateRow(i, "tag", v) : undefined}
                  />
                </span>
              )}
              <InlineText
                as="h2"
                value={row.headline}
                onUpdate={onFieldChange ? (v) => updateRow(i, "headline", v) : undefined}
                className={cn(getHeadlineSizeClass(props.headlineSize, "md"), "font-bold leading-tight")}
                style={{ color: brand.primaryColor }}
              />
              <InlineText
                as="p"
                value={row.body}
                onUpdate={onFieldChange ? (v) => updateRow(i, "body", v) : undefined}
                className="text-base lg:text-lg leading-relaxed text-slate-600"
                multiline
              />
              {row.ctaText && (
                <a
                  href={row.ctaUrl || "#"}
                  className="inline-flex items-center gap-2 font-semibold text-sm hover:gap-3 transition-all"
                  style={{ color: brand.primaryColor }}
                >
                  <InlineText
                    value={row.ctaText}
                    onUpdate={onFieldChange ? (v) => updateRow(i, "ctaText", v) : undefined}
                  />
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </a>
              )}
            </div>
          );

          return (
            <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {isImageLeft ? (
                <>{imageEl}{textEl}</>
              ) : (
                <>{textEl}{imageEl}</>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
