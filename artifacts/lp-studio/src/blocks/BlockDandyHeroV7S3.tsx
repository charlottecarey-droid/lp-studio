import { useState } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyHeroV7S3BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandyHeroV7S3BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyHeroV7S3BlockProps) => void;
}

export function BlockDandyHeroV7S3({ props, onFieldChange }: Props) {
  const [email, setEmail] = useState("");
  const bg = props.bgColor ?? "#003A30";
  const bgImage = props.backgroundImageUrl;

  const field = (key: keyof DandyHeroV7S3BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.formAction) safeNavigate(props.formAction + (email ? `?email=${encodeURIComponent(email)}` : ""));
  };

  return (
    <section
      className="relative w-full overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: bg, minHeight: "min(85vh, 780px)" }}
    >
      {bgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})`, opacity: props.bgImageOpacity ?? 0.15 }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center text-center py-24 md:py-32 px-6 w-full max-w-4xl mx-auto">
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#C7E738] mb-5">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h1>
        {props.subheadline && (
          <p className="text-xl text-green-100/80 leading-relaxed mb-10 max-w-2xl">
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}

        {/* Inline email form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col sm:flex-row gap-3 shadow-2xl">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={props.inputPlaceholder ?? "Enter your work email"}
            className="flex-1 px-6 py-4 rounded-xl text-slate-900 bg-white text-base font-medium outline-none border-2 border-transparent focus:border-[#C7E738] transition-colors"
            required
          />
          <button
            type="submit"
            className="bg-[#C7E738] text-[#003A30] font-bold px-8 py-4 rounded-xl text-base whitespace-nowrap hover:brightness-105 transition-all shrink-0"
          >
            <InlineText value={props.ctaText ?? "Get Started"} onUpdate={field("ctaText")} />
          </button>
        </form>

        {props.formDisclaimer && (
          <p className="mt-4 text-sm text-green-200/60">
            <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} />
          </p>
        )}

        {/* Trust stat bar */}
        {(props.trustItems ?? []).length > 0 && (
          <div className="mt-14 flex flex-wrap justify-center gap-x-12 gap-y-4 pt-10 border-t border-white/10 w-full">
            {(props.trustItems ?? []).map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-3xl font-bold text-[#C7E738]">{item.value}</span>
                <span className="text-sm text-green-200/70">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
