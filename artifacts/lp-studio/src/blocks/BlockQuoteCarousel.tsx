import { useState, useEffect, useRef } from "react";
import { Star, ChevronLeft, ChevronRight, Quote, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { QuoteCarouselBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: QuoteCarouselBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: QuoteCarouselBlockProps) => void;
}

export function BlockQuoteCarousel({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FAFAFA";
  const text = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const surface = pickContrastingColor(undefined, bg, ["#FFFFFF", "#1E293B"]);
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const border = `${text}1f`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;

  const testimonials = props.testimonials ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeIndex = testimonials.length > 0 ? Math.min(activeIndex, testimonials.length - 1) : 0;

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };
  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };
  const handleDotClick = (index: number) => {
    if (isAnimating || index === safeIndex) return;
    setIsAnimating(true);
    setActiveIndex(index);
  };

  useEffect(() => {
    if (isAnimating) {
      timeoutRef.current = setTimeout(() => setIsAnimating(false), 500);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAnimating, activeIndex]);

  const update = <K extends keyof QuoteCarouselBlockProps>(key: K, value: QuoteCarouselBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTestimonial = (i: number, patch: Partial<QuoteCarouselBlockProps["testimonials"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, testimonials: testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  const current = testimonials[safeIndex];

  return (
    <section
      className="w-full py-24 sm:py-32 flex flex-col items-center relative overflow-hidden"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="container mx-auto px-6 md:px-12 max-w-5xl flex flex-col items-center">
        <div className="text-center max-w-2xl mb-16 sm:mb-24">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-widest mb-4 block"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: text, fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="text-lg md:text-xl"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        {current && (
          <div className="w-full relative flex items-center justify-center min-h-[360px] md:min-h-[300px]">
            <button
              onClick={handlePrevious}
              className="hidden md:flex absolute left-0 md:-left-6 lg:-left-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center border shadow-sm transition-transform hover:scale-105 z-10"
              style={{ backgroundColor: surface, borderColor: border, color: text }}
              aria-label="Previous quote"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="hidden md:flex absolute right-0 md:-right-6 lg:-right-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center border shadow-sm transition-transform hover:scale-105 z-10"
              style={{ backgroundColor: surface, borderColor: border, color: text }}
              aria-label="Next quote"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div className="relative w-full max-w-3xl overflow-hidden px-4 md:px-12 py-8">
              <div
                className={`flex flex-col items-center text-center transition-all duration-500 ease-in-out ${
                  isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
                }`}
              >
                <div
                  className="mb-8 p-4 rounded-2xl inline-flex items-center justify-center"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  <Quote className="w-8 h-8 md:w-10 md:h-10" />
                </div>

                {current.rating ? (
                  <div className="flex items-center gap-1 mb-6 text-amber-400">
                    {Array.from({ length: current.rating }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-current" />
                    ))}
                  </div>
                ) : null}

                <InlineText
                  as="blockquote"
                  value={current.quote}
                  onUpdate={onFieldChange ? (v) => updateTestimonial(safeIndex, { quote: v }) : undefined}
                  className="text-2xl md:text-3xl lg:text-4xl font-medium leading-tight md:leading-snug mb-10"
                  style={{ color: text, fontFamily: DISPLAY }}
                  multiline />

                <div className="flex flex-col items-center gap-4">
                  {current.avatarImage ? (
                    <img
                      src={current.avatarImage}
                      alt={current.author}
                      className="w-16 h-16 rounded-full object-cover border-2 shadow-sm"
                      style={{ borderColor: surface }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2 shadow-sm"
                      style={{ backgroundColor: `${accent}20`, color: accent, borderColor: surface }}
                    >
                      {current.avatarInitials || current.author.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <InlineText
                      as="span"
                      value={current.author}
                      onUpdate={onFieldChange ? (v) => updateTestimonial(safeIndex, { author: v }) : undefined}
                      className="text-lg font-bold"
                      style={{ color: text, fontFamily: BODY }} />
                    <span className="text-base mt-1" style={{ color: muted, fontFamily: BODY }}>
                      <InlineText
                        as="span"
                        value={current.role}
                        onUpdate={onFieldChange ? (v) => updateTestimonial(safeIndex, { role: v }) : undefined}
                        className="inline"
                        style={{ color: muted }} />
                      {", "}
                      <InlineText
                        as="span"
                        value={current.company}
                        onUpdate={onFieldChange ? (v) => updateTestimonial(safeIndex, { company: v }) : undefined}
                        className="inline font-semibold"
                        style={{ color: muted }} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {testimonials.length > 1 && (
          <div className="flex items-center justify-center gap-6 mt-12 md:mt-16">
            <button
              onClick={handlePrevious}
              className="md:hidden w-10 h-10 rounded-full flex items-center justify-center border shadow-sm"
              style={{ backgroundColor: surface, borderColor: border, color: text }}
              aria-label="Previous quote"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleDotClick(i)}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: i === safeIndex ? accent : border,
                    transform: i === safeIndex ? "scale(1.2)" : "scale(1)",
                  }}
                  aria-label={`Go to quote ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="md:hidden w-10 h-10 rounded-full flex items-center justify-center border shadow-sm"
              style={{ backgroundColor: surface, borderColor: border, color: text }}
              aria-label="Next quote"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {showCta && (
          <div className="mt-24 sm:mt-32 w-full pt-16 border-t" style={{ borderColor: border }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-xs font-bold uppercase tracking-[0.18em]"
                    style={{ color: accent, fontFamily: BODY }} />
                )}
                {(props.ctaHeading || onFieldChange) && (
                  <InlineText
                    as="h3"
                    value={props.ctaHeading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
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
              <div className="flex flex-wrap justify-center gap-3">
                {(props.ctaPrimaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaPrimaryUrl}
                    brand={brand}
                    source="quote-carousel-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                    <ArrowRight className="h-4 w-4" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="quote-carousel-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
                  >
                    {props.ctaSecondaryLabel || "Talk to sales"}
                  </CtaButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
