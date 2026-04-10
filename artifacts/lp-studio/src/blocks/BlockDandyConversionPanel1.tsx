import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { DandyConversionPanel1BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyConversionPanel1BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyConversionPanel1BlockProps) => void;
}

export function BlockDandyConversionPanel1({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const style = props.style ?? "teal";

  const field = (key: keyof DandyConversionPanel1BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const bgMap: Record<string, string> = {
    teal: "#003A30",
    lime: "#C7E738",
    medium: "#006651",
    white: "#FFFFFF",
  };
  const textMap: Record<string, { heading: string; sub: string }> = {
    teal: { heading: "text-white", sub: "text-green-200" },
    lime: { heading: "text-[#003A30]", sub: "text-[#004d3f]" },
    medium: { heading: "text-white", sub: "text-green-100" },
    white: { heading: "text-[#003A30]", sub: "text-slate-600" },
  };

  const bg = props.bgColor ?? bgMap[style];
  const { heading: headingColor, sub: subColor } = textMap[style] ?? textMap.teal;

  const primaryBtnCls = style === "lime"
    ? "bg-[#003A30] text-[#C7E738] hover:bg-[#004d3f]"
    : "bg-[#C7E738] text-[#003A30] hover:brightness-105";

  const secondaryBtnCls = style === "lime"
    ? "border-2 border-[#003A30] text-[#003A30] hover:bg-[#003A30] hover:text-white"
    : "border-2 border-white text-white hover:bg-white hover:text-[#003A30]";

  return (
    <section className={cn("w-full", sectionPy)} style={{ backgroundColor: bg }}>
      <div className="max-w-4xl mx-auto px-6 text-center flex flex-col items-center gap-5">
        {props.eyebrow && (
          <p className={cn("text-xs font-bold uppercase tracking-widest", style === "lime" ? "text-[#006651]" : "text-[#C7E738]")}>
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className={cn("text-3xl md:text-4xl font-bold leading-tight", headingColor)}>
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className={cn("text-base leading-relaxed max-w-2xl", subColor)}>
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className={cn("font-bold px-8 py-3.5 rounded-lg text-sm transition-all", primaryBtnCls)}
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className={cn("font-semibold px-8 py-3.5 rounded-lg text-sm transition-all", secondaryBtnCls)}
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}
        </div>

        {/* Optional trust stat row */}
        {(props.stats ?? []).length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 mt-6 pt-6 border-t border-white/20 w-full">
            {(props.stats ?? []).map((s, i) => (
              <div key={i} className="text-center">
                <div className={cn("text-2xl font-bold", headingColor)}>{s.value}</div>
                <div className={cn("text-xs", subColor)}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
