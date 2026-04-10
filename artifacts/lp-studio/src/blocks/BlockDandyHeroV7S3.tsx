import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyHeroV7S3BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { safeNavigate } from "@/lib/safe-url";

const BG_PLACEHOLDER = "https://www.meetdandy.com/wp-content/uploads/2025/05/dandy-hero-bg.jpg";

interface Props {
  props: DandyHeroV7S3BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyHeroV7S3BlockProps) => void;
}

export function BlockDandyHeroV7S3({ props, onFieldChange }: Props) {
  const [email, setEmail] = useState("");
  const bg = props.bgColor ?? "#003A30";
  const bgImage = props.backgroundImageUrl ?? BG_PLACEHOLDER;

  const field = (key: keyof DandyHeroV7S3BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.formAction) safeNavigate(props.formAction + (email ? `?email=${encodeURIComponent(email)}` : ""));
  };

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: bg, minHeight: 560 }}
    >
      {bgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})`, opacity: props.bgImageOpacity ?? 0.18 }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center text-center py-24 px-6 max-w-4xl mx-auto">
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#C7E738] mb-4">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5">
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h1>
        {props.subheadline && (
          <p className="text-lg text-green-100 leading-relaxed mb-8 max-w-2xl">
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}

        {/* Inline form */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={props.inputPlaceholder ?? "Enter your work email"}
            className="flex-1 px-5 py-3.5 rounded-lg text-slate-900 bg-white text-sm font-medium outline-none border-2 border-transparent focus:border-[#C7E738] transition-colors"
            required
          />
          <button
            type="submit"
            className="bg-[#C7E738] text-[#003A30] font-bold px-7 py-3.5 rounded-lg text-sm whitespace-nowrap hover:brightness-105 transition-all shrink-0"
          >
            <InlineText value={props.ctaText ?? "Get Started"} onUpdate={field("ctaText")} />
          </button>
        </form>

        {props.formDisclaimer && (
          <p className="mt-3 text-xs text-green-200 opacity-70">
            <InlineText value={props.formDisclaimer} onUpdate={field("formDisclaimer")} />
          </p>
        )}

        {/* Trust bar */}
        {(props.trustItems ?? []).length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {(props.trustItems ?? []).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-white">
                <span className="text-[#C7E738] font-bold text-lg">{item.value}</span>
                <span className="text-green-200 text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
