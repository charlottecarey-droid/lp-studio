import { ArrowUpRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { MagazineHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";

interface Props {
  props: MagazineHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MagazineHeroBlockProps) => void;
}

export function BlockMagazineHero({ props, brand, onCtaClick, onFieldChange }: Props) {
  const field = (key: keyof MagazineHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const accent = props.accentColor || brand.accentColor || "#FF6B35";
  const bg = props.bgColor || "#FAF7F2";
  const text = props.textColor || "#0A0A0A";

  return (
    <section
      className="relative overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-12 gap-12 lg:gap-16 items-end">
        <div className="lg:col-span-7 space-y-6">
          {(props.eyebrow || onFieldChange) && (
            <div className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] font-semibold">
              <span
                className="inline-block w-10 h-px"
                style={{ backgroundColor: accent }}
              />
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={field("eyebrow")}
              />
            </div>
          )}
          <InlineText
            as="h1"
            value={props.headline}
            onUpdate={field("headline")}
            className="font-serif leading-[0.95] tracking-tight"
            style={{
              fontSize: "clamp(2.75rem, 7.5vw, 6.5rem)",
              fontFamily: "'Playfair Display', 'Georgia', serif",
            }}
          />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              multiline
              value={props.subheadline ?? ""}
              onUpdate={field("subheadline")}
              className="text-base lg:text-lg max-w-xl leading-relaxed pt-2 pl-6 border-l-2"
              style={{ borderColor: accent, color: text, opacity: 0.78 }}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-4">
            <button
              type="button"
              onClick={() => {
                if (onCtaClick) return onCtaClick();
                if (props.ctaUrl && props.ctaUrl !== "#") {
                  window.location.href = props.ctaUrl;
                }
              }}
              className="inline-flex items-center gap-2 px-7 py-4 font-semibold rounded-full transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: text, color: bg }}
            >
              {props.ctaText}
              <ArrowUpRight className="w-4 h-4" />
            </button>
            {props.bylineLabel && (
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ opacity: 0.55 }}>
                {props.bylineLabel}
                {props.bylineValue && (
                  <div
                    className="text-sm normal-case tracking-normal mt-1 font-medium"
                    style={{ opacity: 1 }}
                  >
                    {props.bylineValue}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <div
            className="absolute -top-10 -left-6 w-40 h-40 rounded-full blur-2xl"
            style={{ backgroundColor: accent, opacity: 0.25 }}
          />
          {props.imageUrl ? (
            <InlineImage
              src={props.imageUrl}
              alt=""
              wrapperClassName="block w-full"
              className="relative aspect-[4/5] w-full object-cover rounded-md shadow-2xl rotate-1"
              onUpdate={field("imageUrl")}
            />
          ) : (
            <div
              className="relative aspect-[4/5] w-full rounded-md shadow-2xl rotate-1"
              style={{ backgroundColor: accent, opacity: 0.4 }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
