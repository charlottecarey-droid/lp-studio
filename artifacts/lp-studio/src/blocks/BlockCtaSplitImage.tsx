import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CtaSplitImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: CtaSplitImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaSplitImageBlockProps) => void;
}

export function BlockCtaSplitImage({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const text = props.textColor ?? surface.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#64748b", "#94a3b8"]);
  const border = `${text}14`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof CtaSplitImageBlockProps>(key: K, value: CtaSplitImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="relative w-full overflow-hidden py-24 sm:py-32" style={{ background: surface.background }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="order-2 lg:order-1 relative aspect-[4/3] lg:aspect-square rounded-3xl overflow-hidden shadow-2xl">
            <InlineImage
              src={props.imageUrl ?? ""}
              alt={props.imageAlt || props.heading || "Feature image"}
              onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
              className="absolute inset-0 w-full h-full object-cover transform transition-transform duration-700 hover:scale-105"
              wrapperClassName="block absolute inset-0 w-full h-full"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-3xl pointer-events-none" />
          </div>

          <div className="order-1 lg:order-2 flex flex-col justify-center">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
                className="text-sm font-bold uppercase tracking-[0.15em] mb-6 block"
                style={{ color: accent, fontFamily: BODY }} />
            )}

            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight"
              style={{ color: text, fontFamily: DISPLAY }} />

            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
                className="text-lg md:text-xl mb-10 leading-relaxed max-w-xl"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            )}

            {(props.ctaPrimaryLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="flex flex-wrap items-center gap-4">
                {(props.ctaPrimaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaPrimaryUrl}
                    brand={brand}
                    source="cta-split-image-primary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Get started today"}
                    <ArrowRight className="h-4 w-4" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="cta-split-image-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold"
                    style={{ borderColor: border, color: text, fontFamily: BODY }}
                  >
                    {props.ctaSecondaryLabel || "View documentation"}
                  </CtaButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
