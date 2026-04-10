import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { DandyCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyCtaBlockProps) => void;
}

export function BlockDandyCtaBlock({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const bg = props.bgColor ?? "#FDFCFA";
  const alignment = props.alignment ?? "center";

  const field = (key: keyof DandyCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const alignClass = alignment === "left" ? "items-start text-left" : alignment === "right" ? "items-end text-right" : "items-center text-center";

  return (
    <section className={cn("w-full", sectionPy)} style={{ backgroundColor: bg }}>
      <div className={cn("max-w-3xl mx-auto px-6 flex flex-col gap-4", alignClass)}>
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className="text-3xl md:text-4xl font-bold text-[#003A30] leading-tight">
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}

        <div className={cn("flex flex-wrap gap-3 mt-2", alignment === "center" ? "justify-center" : alignment === "right" ? "justify-end" : "justify-start")}>
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className="bg-[#C7E738] text-[#003A30] font-bold px-8 py-3.5 rounded-lg text-sm hover:brightness-105 transition-all"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className="border-2 border-[#003A30] text-[#003A30] font-semibold px-8 py-3.5 rounded-lg text-sm hover:bg-[#003A30] hover:text-white transition-all"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}
        </div>

        {props.disclaimer && (
          <p className="text-xs text-slate-400 mt-1">
            <InlineText value={props.disclaimer} onUpdate={field("disclaimer")} />
          </p>
        )}
      </div>
    </section>
  );
}
