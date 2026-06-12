import { Star, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { QuoteWithImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal } from "@/lib/premium-toolkit";
import { cn } from "@/lib/utils";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/* ----------------------------------------------------------------------------
 * Quote with Image — editorial split. A tall rounded portrait column with the
 * quote card overlapping it (negative margin at lg+, pulled up over the image
 * on mobile). Display-serif quote, subtle accent stars, tight attribution
 * stack, compact in-card CTA. Image side configurable via `imageSide`.
 * -------------------------------------------------------------------------- */

interface Props {
  props: QuoteWithImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: QuoteWithImageBlockProps) => void;
}

export function BlockQuoteWithImage({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#0F172A";
  // Brand-derived accent: panel override → brand accent → brand primary.
  const accent = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#0F172A";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  // The quote card contrasts with the section: white card on light sections,
  // deep slate card on dark ones — all in-card colors derive from the card.
  const cardBg = pickContrastingColor(undefined, surface.base, ["#FFFFFF", "#1E293B"]);
  const cardText = pickContrastingColor(props.textColor, cardBg, ["#0F172A", "#F8FAFC"]);
  const cardMuted = pickContrastingColor(undefined, cardBg, ["#64748B", "#94A3B8"]);
  const cardBorder = `color-mix(in srgb, ${cardText} 10%, transparent)`;
  const showCta = props.showCta ?? true;
  const rating = props.rating ?? 5;
  const imageRight = props.imageSide === "right";
  const reduce = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduce;

  const update = <K extends keyof QuoteWithImageBlockProps>(key: K, value: QuoteWithImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <section
      className="relative w-full overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:py-24"
      style={{ background: surface.background, color: text }}
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <figure className="grid grid-cols-1 items-center lg:grid-cols-12">
          {/* ── Image column ── */}
          <Reveal
            disabled={!animate}
            className={cn("relative lg:col-span-6", imageRight ? "lg:order-2" : "")}
          >
            <div
              className="relative w-full overflow-hidden rounded-2xl lg:rounded-3xl aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/5]"
              style={{ boxShadow: `0 32px 64px -36px color-mix(in srgb, ${text} 45%, transparent)` }}
            >
              <InlineImage
                src={props.imageUrl ?? ""}
                alt={props.imageAlt || props.author}
                onUpdate={onFieldChange ? (url) => update("imageUrl", url) : undefined}
                onAltUpdate={onFieldChange ? (alt) => update("imageAlt", alt) : undefined}
                focalPoint={props.imageFocal}
                onFocalUpdate={onFieldChange ? (v) => update("imageFocal", v) : undefined}
                className="absolute inset-0 h-full w-full object-cover"
                wrapperClassName="absolute inset-0"
                loading="lazy"
              />
            </div>
          </Reveal>

          {/* ── Quote card — overlaps the image at lg+, pulls up over it on mobile ── */}
          <Reveal
            disabled={!animate}
            delay={0.1}
            className={cn(
              "relative z-10 lg:col-span-6",
              "-mt-12 px-4 sm:-mt-16 sm:px-8 lg:mt-0 lg:px-0",
              imageRight ? "lg:order-1 lg:-mr-16 xl:-mr-20" : "lg:-ml-16 xl:-ml-20",
            )}
          >
            <div
              className="rounded-2xl border p-7 sm:p-9 lg:rounded-3xl lg:p-12"
              style={{
                background: cardBg,
                borderColor: cardBorder,
                boxShadow: `0 1px 2px color-mix(in srgb, ${cardText} 4%, transparent), 0 24px 56px -28px color-mix(in srgb, ${cardText} 30%, transparent)`,
              }}
            >
              {(props.eyebrow || onFieldChange) && (
                <InlineText
                  as="span"
                  value={props.eyebrow ?? ""}
                  onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                  className="mb-5 block text-[11px] font-bold uppercase tracking-[0.22em]"
                  style={{ color: accent, fontFamily: BODY }} />
              )}

              {rating > 0 && (
                <div
                  role="img"
                  aria-label={`Rated ${Math.min(5, rating)} out of 5 stars`}
                  className="mb-5 flex items-center gap-1"
                >
                  {Array.from({ length: Math.min(5, rating) }).map((_, i) => (
                    <Star key={i} aria-hidden className="h-4 w-4 fill-current" style={{ color: accent }} />
                  ))}
                </div>
              )}

              {/* Hanging accent quote mark + display quote */}
              <span
                aria-hidden
                className="pointer-events-none block select-none leading-[0.5]"
                style={{ fontFamily: DISPLAY, fontSize: "3.5rem", color: accent, opacity: 0.3 }}
              >
                &ldquo;
              </span>
              <InlineText
                as="blockquote"
                value={props.quote}
                onUpdate={onFieldChange ? (v) => update("quote", v) : undefined}
                className="mt-1 text-balance font-medium tracking-tight"
                style={{
                  color: cardText,
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
                  lineHeight: 1.3,
                }}
                multiline />

              <figcaption className="mt-7 flex items-center gap-3.5 border-t pt-6" style={{ borderColor: cardBorder }}>
                <span
                  aria-hidden
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ background: `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 30%, transparent))` }}
                />
                <span className="flex min-w-0 flex-col">
                  <InlineText
                    as="span"
                    value={props.author}
                    onUpdate={onFieldChange ? (v) => update("author", v) : undefined}
                    className="text-base font-semibold leading-tight"
                    style={{ color: cardText, fontFamily: BODY }} />
                  <span className="mt-0.5 text-sm leading-tight" style={{ color: cardMuted, fontFamily: BODY }}>
                    <InlineText
                      as="span"
                      value={props.role}
                      onUpdate={onFieldChange ? (v) => update("role", v) : undefined}
                      className="inline"
                      style={{ color: cardMuted }} />
                    {" · "}
                    <InlineText
                      as="span"
                      value={props.company}
                      onUpdate={onFieldChange ? (v) => update("company", v) : undefined}
                      className="inline font-medium"
                      style={{ color: cardMuted }} />
                  </span>
                </span>
              </figcaption>

              {showCta && (
                <div className="mt-7 flex flex-col gap-4">
                  {(props.ctaHeading || props.ctaSubheading || onFieldChange) && (
                    <div className="flex flex-col gap-1.5">
                      {(props.ctaHeading || onFieldChange) && (
                        <InlineText
                          as="h3"
                          value={props.ctaHeading ?? ""}
                          onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                          className="text-lg font-bold tracking-tight md:text-xl"
                          style={{ color: cardText, fontFamily: DISPLAY }} />
                      )}
                      {(props.ctaSubheading || onFieldChange) && (
                        <InlineText
                          as="p"
                          value={props.ctaSubheading ?? ""}
                          onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                          className="text-sm leading-relaxed md:text-base"
                          style={{ color: cardMuted, fontFamily: BODY }}
                          multiline />
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {(props.ctaPrimaryLabel || onFieldChange) && (
                      <CtaButton
                        ctaAction="url"
                        ctaUrl={props.ctaPrimaryUrl}
                        brand={brand}
                        source="quote-with-image-cta"
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-transform duration-200 motion-safe:hover:-translate-y-0.5 sm:text-base",
                          focusRing,
                        )}
                        style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
                      >
                        {props.ctaPrimaryLabel || "Book a demo"}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </CtaButton>
                    )}
                    {(props.ctaSecondaryLabel || onFieldChange) && (
                      <CtaButton
                        ctaAction="url"
                        ctaUrl={props.ctaSecondaryUrl}
                        brand={brand}
                        source="quote-with-image-cta-secondary"
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-transform duration-200 motion-safe:hover:-translate-y-0.5 sm:text-base",
                          focusRing,
                        )}
                        style={{ borderColor: `color-mix(in srgb, ${cardText} 22%, transparent)`, color: cardText, fontFamily: BODY, outlineColor: accent }}
                      >
                        {props.ctaSecondaryLabel || "Learn more"}
                      </CtaButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </figure>
      </div>
    </section>
  );
}
