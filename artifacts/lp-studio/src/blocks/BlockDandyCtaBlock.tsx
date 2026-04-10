import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyCtaBlockProps) => void;
}

export function BlockDandyCtaBlock({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FDFCFA";
  const alignment = props.alignment ?? "center";

  const field = (key: keyof DandyCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const alignClass = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right",
  }[alignment];

  const btnAlignClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[alignment];

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className={cn("max-w-3xl mx-auto px-6 md:px-10 flex flex-col gap-6", alignClass)}>
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className="text-4xl md:text-5xl font-bold text-[#003A30] leading-[1.1] tracking-tight">
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className="text-lg text-slate-600 leading-relaxed">
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}
        <div className={cn("flex flex-wrap gap-4 mt-2", btnAlignClass)}>
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className="bg-[#C7E738] text-[#003A30] font-bold px-10 py-4 rounded-xl text-base hover:brightness-105 transition-all"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className="border-2 border-[#003A30] text-[#003A30] font-semibold px-10 py-4 rounded-xl text-base hover:bg-[#003A30] hover:text-white transition-all"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}
        </div>
        {props.disclaimer && (
          <p className="text-sm text-slate-400 mt-1">
            <InlineText value={props.disclaimer} onUpdate={field("disclaimer")} />
          </p>
        )}
      </div>
    </section>
  );
}
