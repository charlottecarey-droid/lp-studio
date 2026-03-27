import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import type { ZigzagFeaturesBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { useState } from "react";
import { ChiliPiperModal } from "./ChiliPiperModal";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&h=600&fit=crop";

interface Props {
  props: ZigzagFeaturesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ZigzagFeaturesBlockProps) => void;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}

export function BlockZigzagFeatures({ props, brand, onFieldChange, pageId, variantId, sessionId }: Props) {
  const [cpRow, setCpRow] = useState<number | null>(null);

  const updateRow = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const rows = props.rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r);
    onFieldChange({ ...props, rows });
  };

  return (
    <>
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
                className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "md"), "leading-tight", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}
                style={{ color: brand.primaryColor }}
              />
              <InlineText
                as="p"
                value={row.body}
                onUpdate={onFieldChange ? (v) => updateRow(i, "body", v) : undefined}
                className={cn(getBodySizeClass(brand), "lg:text-lg leading-relaxed text-slate-600")}
                multiline
              />
              {row.ctaText && (
                <button
                  onClick={() => {
                    if (row.ctaAction === "chilipiper" && row.chilipiperUrl) {
                      setCpRow(i);
                    } else if (row.ctaUrl) {
                      window.open(row.ctaUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="inline-flex items-center gap-2 font-semibold text-sm hover:gap-3 transition-all bg-transparent border-none p-0 cursor-pointer"
                  style={{ color: brand.primaryColor }}
                >
                  <InlineText
                    value={row.ctaText}
                    onUpdate={onFieldChange ? (v) => updateRow(i, "ctaText", v) : undefined}
                  />
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
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
    {cpRow !== null && props.rows[cpRow]?.chilipiperUrl && (
      <ChiliPiperModal
        url={props.rows[cpRow].chilipiperUrl!}
        pageId={pageId}
        variantId={variantId}
        sessionId={sessionId}
        onClose={() => setCpRow(null)}
      />
    )}
    </>
  );
}
