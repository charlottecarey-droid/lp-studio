import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyVersusBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyVersusBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVersusBlockProps) => void;
}

export function BlockDandyVersus({ props, brand, onFieldChange }: Props) {
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
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#C7E738] mb-4 text-center">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        {props.headline && (
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-14 leading-[1.1] tracking-tight">
            <InlineText value={props.headline} onUpdate={field("headline")} />
          </h2>
        )}

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Left card — white */}
          <div className="bg-white rounded-3xl p-10 md:p-12 flex flex-col gap-5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              <InlineText value={props.leftLabel} onUpdate={field("leftLabel")} />
            </span>
            <h3 className="text-3xl font-bold text-[#003A30]">
              <InlineText value={props.leftTitle} onUpdate={field("leftTitle")} />
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              <InlineText value={props.leftDesc} onUpdate={field("leftDesc")} />
            </p>
            <ul className="space-y-3 flex-1">
              {(props.leftBullets ?? []).map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-base text-slate-500">
                  <X className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet("leftBullets", i, v) : undefined} />
                </li>
              ))}
            </ul>
            {props.leftCtaText && (
              <button
                onClick={() => safeNavigate(props.leftCtaUrl)}
                className="mt-2 border-2 border-[#003A30] text-[#003A30] rounded-xl px-8 py-4 text-base font-semibold hover:bg-[#003A30] hover:text-white transition-colors w-fit"
              >
                <InlineText value={props.leftCtaText} onUpdate={field("leftCtaText")} />
              </button>
            )}
          </div>

          {/* Right card — dark gradient */}
          <div className="rounded-3xl p-10 md:p-12 flex flex-col gap-5" style={{ background: "linear-gradient(135deg, #006651 0%, #003A30 100%)" }}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#C7E738]">
              <InlineText value={props.rightLabel} onUpdate={field("rightLabel")} />
            </span>
            <h3 className="text-3xl font-bold text-white">
              <InlineText value={props.rightTitle} onUpdate={field("rightTitle")} />
            </h3>
            <p className="text-green-100 text-base leading-relaxed">
              <InlineText value={props.rightDesc} onUpdate={field("rightDesc")} />
            </p>
            <ul className="space-y-3 flex-1">
              {(props.rightBullets ?? []).map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-base text-green-100">
                  <Check className="w-5 h-5 text-[#C7E738] mt-0.5 shrink-0" />
                  <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet("rightBullets", i, v) : undefined} />
                </li>
              ))}
            </ul>
            {props.rightCtaText && (
              <button
                onClick={() => safeNavigate(props.rightCtaUrl)}
                className="mt-2 bg-[#C7E738] text-[#003A30] rounded-xl px-8 py-4 text-base font-bold hover:brightness-110 transition-all w-fit"
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
