import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { DandySideImageV6BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&h=600&fit=crop";

interface Props {
  props: DandySideImageV6BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySideImageV6BlockProps) => void;
}

export function BlockDandySideImageV6({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const reversed = props.imagePosition === "left";
  const bg = props.bgColor ?? "#FDFCFA";

  const field = (key: keyof DandySideImageV6BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    const bullets = [...(props.bullets ?? [])];
    bullets[i] = v;
    onFieldChange({ ...props, bullets });
  };

  const textCol = (
    <div className="flex flex-col justify-center gap-5">
      {props.eyebrow && (
        <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
          <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
        </p>
      )}
      <h2 className="text-3xl md:text-4xl font-bold text-[#003A30] leading-tight">
        <InlineText value={props.headline} onUpdate={field("headline")} />
      </h2>
      {props.subheadline && (
        <p className="text-base text-slate-600 leading-relaxed max-w-lg">
          <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
        </p>
      )}
      {(props.bullets ?? []).length > 0 && (
        <ul className="space-y-3">
          {(props.bullets ?? []).map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[#C7E738] flex items-center justify-center">
                <Check className="w-3 h-3 text-[#003A30]" />
              </span>
              <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} />
            </li>
          ))}
        </ul>
      )}
      {props.ctaText && (
        <div className="flex flex-wrap gap-3 mt-2">
          <button
            onClick={() => safeNavigate(props.ctaUrl)}
            className="bg-[#C7E738] text-[#003A30] font-bold px-6 py-3 rounded-lg text-sm hover:brightness-105 transition-all"
          >
            <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
          </button>
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className="border-2 border-[#003A30] text-[#003A30] font-semibold px-6 py-3 rounded-lg text-sm hover:bg-[#003A30] hover:text-white transition-all"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  const imageCol = (
    <div className="relative">
      <img
        src={props.imageUrl || PLACEHOLDER}
        alt={props.headline}
        className="w-full rounded-2xl object-cover shadow-xl"
        style={{ maxHeight: 520 }}
      />
      {props.badgeText && (
        <div className="absolute -bottom-4 -right-4 bg-[#C7E738] text-[#003A30] font-bold text-sm px-5 py-3 rounded-xl shadow-lg">
          <InlineText value={props.badgeText} onUpdate={field("badgeText")} />
        </div>
      )}
    </div>
  );

  return (
    <section className={cn("w-full", sectionPy)} style={{ backgroundColor: bg }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className={cn("grid md:grid-cols-2 gap-12 md:gap-16 items-center", reversed && "")}>
          {reversed ? (
            <>
              <div className="order-2 md:order-1">{imageCol}</div>
              <div className="order-1 md:order-2">{textCol}</div>
            </>
          ) : (
            <>
              <div>{textCol}</div>
              <div>{imageCol}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
