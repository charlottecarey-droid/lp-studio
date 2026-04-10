import { Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyVersusBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyVersusBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyVersusBlockProps) => void;
}

function CircledX() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="#EF4444" strokeWidth="1.5" />
      <path d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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
        {(props.eyebrow || props.headline) && (
          <div className="text-center mb-14">
            {props.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-widest text-[#C7E738] mb-4">
                <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
              </p>
            )}
            {props.headline && (
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] tracking-tight">
                <InlineText value={props.headline} onUpdate={field("headline")} />
              </h2>
            )}
          </div>
        )}

        {/* Card grid — relative so the VS badge can be centered */}
        <div className="relative grid md:grid-cols-2">
          {/* VS badge */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-[#C7E738] items-center justify-center shadow-lg">
            <span className="text-[#003A30] text-xs font-black tracking-wide">VS</span>
          </div>

          {/* Left card — cream */}
          <div className="bg-[#F4F2EE] rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none p-10 md:p-12 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              <InlineText value={props.leftLabel} onUpdate={field("leftLabel")} />
            </span>
            <h3 className="text-3xl font-bold text-[#003A30] mb-3">
              <InlineText value={props.leftTitle} onUpdate={field("leftTitle")} />
            </h3>
            <p className="text-slate-500 text-base leading-relaxed mb-6">
              <InlineText value={props.leftDesc} onUpdate={field("leftDesc")} />
            </p>
            <ul className="flex-1 divide-y divide-slate-200">
              {(props.leftBullets ?? []).map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-base text-slate-600 py-3.5">
                  <CircledX />
                  <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet("leftBullets", i, v) : undefined} />
                </li>
              ))}
            </ul>
            {props.leftCtaText && (
              <button
                onClick={() => safeNavigate(props.leftCtaUrl)}
                className="mt-8 self-start text-[#003A30] text-xs font-bold uppercase tracking-wider border border-[#003A30]/30 rounded-full px-6 py-3 hover:border-[#003A30] transition-colors"
              >
                <InlineText value={props.leftCtaText} onUpdate={field("leftCtaText")} />
              </button>
            )}
          </div>

          {/* Right card — dark green */}
          <div className="rounded-b-3xl md:rounded-r-3xl md:rounded-bl-none p-10 md:p-12 flex flex-col" style={{ backgroundColor: "#004D40" }}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#C7E738] mb-4">
              <InlineText value={props.rightLabel} onUpdate={field("rightLabel")} />
            </span>
            <h3 className="text-3xl font-bold text-white mb-3">
              <InlineText value={props.rightTitle} onUpdate={field("rightTitle")} />
            </h3>
            <p className="text-green-100/70 text-base leading-relaxed mb-6">
              <InlineText value={props.rightDesc} onUpdate={field("rightDesc")} />
            </p>
            <ul className="flex-1 divide-y divide-white/10">
              {(props.rightBullets ?? []).map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-base text-green-50 py-3.5">
                  <Check className="w-4 h-4 text-[#C7E738] shrink-0" strokeWidth={2.5} />
                  <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet("rightBullets", i, v) : undefined} />
                </li>
              ))}
            </ul>
            {props.rightCtaText && (
              <button
                onClick={() => safeNavigate(props.rightCtaUrl)}
                className="mt-8 self-start text-white text-xs font-bold uppercase tracking-wider border border-white/40 rounded-full px-6 py-3 hover:border-white hover:bg-white/10 transition-colors"
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
