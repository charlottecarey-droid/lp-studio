import { Quote, Star, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { QuoteWithImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: QuoteWithImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: QuoteWithImageBlockProps) => void;
}

export function BlockQuoteWithImage({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const border = `${text}1f`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;
  const rating = props.rating ?? 5;
  const imageRight = props.imageSide === "right";

  const update = <K extends keyof QuoteWithImageBlockProps>(key: K, value: QuoteWithImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const imageCol = (
    <div className={`lg:col-span-5 ${imageRight ? "lg:order-2" : ""}`}>
      <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl transform transition-transform duration-700 hover:scale-[1.01]">
        <InlineImage
          src={props.imageUrl ?? ""}
          alt={props.imageAlt || props.author}
          onUpdate={onFieldChange ? (url) => update("imageUrl", url) : undefined}
          onAltUpdate={onFieldChange ? (alt) => update("imageAlt", alt) : undefined}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-8 left-8 text-white pointer-events-none">
          <p className="font-bold text-xl mb-1" style={{ fontFamily: BODY }}>{props.author}</p>
          <p className="text-white/80 font-medium" style={{ fontFamily: BODY }}>{props.role}, {props.company}</p>
        </div>
      </div>
    </div>
  );

  const contentCol = (
    <div className={`lg:col-span-7 flex flex-col justify-center ${imageRight ? "lg:order-1" : ""}`}>
      {(props.eyebrow || onFieldChange) && (
        <InlineText
          as="span"
          value={props.eyebrow ?? ""}
          onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
          className="text-sm font-bold uppercase tracking-[0.18em] mb-8 block"
          style={{ color: accent, fontFamily: BODY }} />
      )}

      {rating > 0 && (
        <div className="flex items-center gap-1.5 mb-8">
          {Array.from({ length: rating }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-current" style={{ color: accent }} />
          ))}
        </div>
      )}

      <div className="relative">
        <Quote className="absolute -top-6 -left-8 h-16 w-16 opacity-10 transform -scale-x-100" style={{ color: text }} />
        <InlineText
          as="h2"
          value={props.quote}
          onUpdate={onFieldChange ? (v) => update("quote", v) : undefined}
          className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-relaxed tracking-tight mb-10 relative z-10"
          style={{ color: text, fontFamily: DISPLAY }}
          multiline />
      </div>

      <div className="h-px w-full max-w-[120px] mb-12" style={{ backgroundColor: border }} />

      {showCta && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {(props.ctaHeading || onFieldChange) && (
              <InlineText
                as="h3"
                value={props.ctaHeading ?? ""}
                onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                className="text-xl font-extrabold tracking-tight md:text-2xl"
                style={{ color: text, fontFamily: DISPLAY }} />
            )}
            {(props.ctaSubheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.ctaSubheading ?? ""}
                onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                className="max-w-xl text-base md:text-lg"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {(props.ctaPrimaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaPrimaryUrl}
                brand={brand}
                source="quote-with-image-cta"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
              >
                {props.ctaPrimaryLabel || "Book a demo"}
                <ArrowRight className="h-4 w-4" />
              </CtaButton>
            )}
            {(props.ctaSecondaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaSecondaryUrl}
                brand={brand}
                source="quote-with-image-cta-secondary"
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
              >
                {props.ctaSecondaryLabel || "Learn more"}
              </CtaButton>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section className="w-full flex items-center justify-center py-24 sm:py-32" style={{ background: surface.background, color: text }}>
      <div className="container mx-auto px-6 md:px-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
          {imageCol}
          {contentCol}
        </div>
      </div>
    </section>
  );
}
