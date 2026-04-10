import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { DandyVersusBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyVersusBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVersusBlockProps) => void;
}

export function BlockDandyVersus({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const field = (key: keyof DandyVersusBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateBullet = (side: "leftBullets" | "rightBullets", i: number, v: string) => {
    if (!onFieldChange) return;
    const arr = [...(props[side] ?? [])];
    arr[i] = v;
    onFieldChange({ ...props, [side]: arr });
  };

  const bg = props.bgColor || "#003A30";

  return (
    <section className={cn("w-full", sectionPy)} style={{ backgroundColor: bg }}>
      <div className="max-w-6xl mx-auto px-6">
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#C7E738] mb-3 text-center">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        {props.headline && (
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-10 leading-tight">
            <InlineText value={props.headline} onUpdate={field("headline")} />
          </h2>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left card — white */}
          <div className="bg-white rounded-2xl p-8 flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              <InlineText value={props.leftLabel} onUpdate={field("leftLabel")} />
            </span>
            <h3 className="text-2xl font-bold text-[#003A30]">
              <InlineText value={props.leftTitle} onUpdate={field("leftTitle")} />
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              <InlineText value={props.leftDesc} onUpdate={field("leftDesc")} />
            </p>
            <ul className="space-y-2 flex-1">
              {(props.leftBullets ?? []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                  <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet("leftBullets", i, v) : undefined} />
                </li>
              ))}
            </ul>
            {props.leftCtaText && (
              <button
                onClick={() => safeNavigate(props.leftCtaUrl)}
                className="mt-2 border-2 border-[#003A30] text-[#003A30] rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-[#003A30] hover:text-white transition-colors w-fit"
              >
                <InlineText value={props.leftCtaText} onUpdate={field("leftCtaText")} />
              </button>
            )}
          </div>

          {/* Right card — dark gradient */}
          <div className="rounded-2xl p-8 flex flex-col gap-4" style={{ background: "linear-gradient(135deg, #006651 0%, #003A30 100%)" }}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#C7E738]">
              <InlineText value={props.rightLabel} onUpdate={field("rightLabel")} />
            </span>
            <h3 className="text-2xl font-bold text-white">
              <InlineText value={props.rightTitle} onUpdate={field("rightTitle")} />
            </h3>
            <p className="text-green-100 text-sm leading-relaxed">
              <InlineText value={props.rightDesc} onUpdate={field("rightDesc")} />
            </p>
            <ul className="space-y-2 flex-1">
              {(props.rightBullets ?? []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-green-100">
                  <Check className="w-4 h-4 text-[#C7E738] mt-0.5 shrink-0" />
                  <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet("rightBullets", i, v) : undefined} />
                </li>
              ))}
            </ul>
            {props.rightCtaText && (
              <button
                onClick={() => safeNavigate(props.rightCtaUrl)}
                className="mt-2 bg-[#C7E738] text-[#003A30] rounded-lg px-5 py-2.5 text-sm font-bold hover:brightness-110 transition-all w-fit"
              >
                <InlineText value={props.rightCtaText} onUpdate={field("rightCtaText")} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
