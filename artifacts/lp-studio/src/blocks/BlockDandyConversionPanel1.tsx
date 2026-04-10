import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyConversionPanel1BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyConversionPanel1BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyConversionPanel1BlockProps) => void;
}

export function BlockDandyConversionPanel1({ props, brand, onFieldChange }: Props) {
  const style = props.style ?? "teal";

  const field = (key: keyof DandyConversionPanel1BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const bgMap: Record<string, string> = {
    teal: "#003A30",
    lime: "#C7E738",
    medium: "#006651",
    white: "#FFFFFF",
  };
  const textMap: Record<string, { eyebrow: string; heading: string; sub: string; divider: string }> = {
    teal:   { eyebrow: "text-[#C7E738]", heading: "text-white",      sub: "text-green-100/70",   divider: "border-white/10" },
    lime:   { eyebrow: "text-[#006651]", heading: "text-[#003A30]",  sub: "text-[#004d3f]/70",   divider: "border-[#003A30]/10" },
    medium: { eyebrow: "text-[#C7E738]", heading: "text-white",      sub: "text-green-100/70",   divider: "border-white/10" },
    white:  { eyebrow: "text-[#006651]", heading: "text-[#003A30]",  sub: "text-slate-500",      divider: "border-slate-200" },
  };

  const bg = props.bgColor ?? bgMap[style] ?? bgMap.teal;
  const colors = textMap[style] ?? textMap.teal;

  const primaryBtnCls = style === "lime"
    ? "bg-[#003A30] text-[#C7E738] hover:bg-[#004d3f]"
    : "bg-[#C7E738] text-[#003A30] hover:brightness-105";

  const secondaryBtnCls = style === "lime" || style === "white"
    ? "border-2 border-[#003A30] text-[#003A30] hover:bg-[#003A30] hover:text-white"
    : "border-2 border-white text-white hover:bg-white hover:text-[#003A30]";

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-4xl mx-auto px-6 md:px-10 text-center flex flex-col items-center gap-6">
        {props.eyebrow && (
          <p className={cn("text-xs font-bold uppercase tracking-widest", colors.eyebrow)}>
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className={cn("text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight", colors.heading)}>
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className={cn("text-lg leading-relaxed max-w-2xl", colors.sub)}>
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className={cn("font-bold px-10 py-4 rounded-xl text-base transition-all", primaryBtnCls)}
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className={cn("font-semibold px-10 py-4 rounded-xl text-base transition-all", secondaryBtnCls)}
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}
        </div>

        {(props.stats ?? []).length > 0 && (
          <div className={cn("flex flex-wrap justify-center gap-x-14 gap-y-5 mt-8 pt-10 border-t w-full", colors.divider)}>
            {(props.stats ?? []).map((s, i) => (
              <div key={i} className="text-center">
                <div className={cn("text-3xl font-bold", colors.heading)}>{s.value}</div>
                <div className={cn("text-sm mt-0.5", colors.sub)}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
