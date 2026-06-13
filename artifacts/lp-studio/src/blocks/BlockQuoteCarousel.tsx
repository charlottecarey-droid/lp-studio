import { useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, isValidHex } from "@/lib/brand-config";
import type { QuoteCarouselBlockProps } from "@/lib/block-types";
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
 * Quote Carousel — modern editorial slider. Large left-aligned quote cards on
 * a sliding track with a peek of the next slide, refined arrow/dot controls
 * (focus-visible rings), optional auto-advance that pauses on hover/focus and
 * is disabled under prefers-reduced-motion (which also makes slide changes
 * instant). Card surface is configurable via `cardTheme` (auto/light/dark).
 * -------------------------------------------------------------------------- */

interface Props {
  props: QuoteCarouselBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: QuoteCarouselBlockProps) => void;
}

/** "Maya Chen" → "MC"; single word → first two letters; empty → "•". */
function initialsOf(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function BlockQuoteCarousel({ props, brand, onFieldChange }: Props) {
  const bgSurface = resolveSectionSurface(props, "#FAFAFA");
  const text = props.textColor ?? bgSurface.color ?? "#0F172A";
  // Brand-derived accent: panel override → brand accent → brand primary.
  const accent = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#0F172A";
  const muted = pickContrastingColor(undefined, bgSurface.base, ["#64748B", "#94A3B8"]);
  const border = `color-mix(in srgb, ${text} 12%, transparent)`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;
  const reduce = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduce;

  // ── Card surface (cardTheme: auto derives contrast vs the section). A valid
  //    `cardBgColor` override wins over cardTheme; card ink then derives from
  //    the chosen surface so a custom card color stays readable. ──
  const cardTheme = props.cardTheme ?? "auto";
  const cardOverride =
    props.cardBgColor && (isValidHex(props.cardBgColor) || props.cardBgColor.startsWith("var("))
      ? props.cardBgColor
      : undefined;
  const cardBg =
    cardOverride ??
    (cardTheme === "light" ? "#FFFFFF"
    : cardTheme === "dark" ? "#0F172A"
    : pickContrastingColor(undefined, bgSurface.base, ["#FFFFFF", "#1E293B"]));
  const cardText = pickContrastingColor(undefined, cardBg, ["#0F172A", "#F8FAFC"]);
  const cardMuted = pickContrastingColor(undefined, cardBg, ["#64748B", "#94A3B8"]);
  const cardBorder = `color-mix(in srgb, ${cardText} 10%, transparent)`;

  const testimonials = props.testimonials ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = testimonials.length > 0 ? Math.min(activeIndex, testimonials.length - 1) : 0;

  const handlePrevious = () =>
    setActiveIndex((prev) => (prev <= 0 ? testimonials.length - 1 : prev - 1));
  const handleNext = () =>
    setActiveIndex((prev) => (prev >= testimonials.length - 1 ? 0 : prev + 1));

  // Auto-advance: opt-in, paused on hover/focus, never in the builder or
  // under prefers-reduced-motion.
  const autoAdvance = props.autoAdvance === true && !onFieldChange && !reduce && testimonials.length > 1;
  const intervalMs = Math.max(2500, props.autoAdvanceMs ?? 6000);
  useEffect(() => {
    if (!autoAdvance || paused) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev >= testimonials.length - 1 ? 0 : prev + 1));
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoAdvance, paused, intervalMs, testimonials.length]);

  const update = <K extends keyof QuoteCarouselBlockProps>(key: K, value: QuoteCarouselBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTestimonial = (i: number, patch: Partial<QuoteCarouselBlockProps["testimonials"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, testimonials: testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const arrowBtn = (dir: "prev" | "next") => (
    <button
      type="button"
      onClick={dir === "prev" ? handlePrevious : handleNext}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-transform motion-safe:hover:scale-105",
        focusRing,
      )}
      style={{ backgroundColor: cardBg, borderColor: border, color: cardText, outlineColor: accent }}
      aria-label={dir === "prev" ? "Previous quote" : "Next quote"}
    >
      {dir === "prev" ? <ChevronLeft className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
    </button>
  );

  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-24"
      style={{ background: bgSurface.background, color: text }}
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 md:px-10">
        {/* ── Header: left-aligned, arrows on the right ── */}
        <Reveal disabled={!animate} className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                className="mb-3 block text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: accent, fontFamily: BODY }} />
            )}
            <InlineText
              as="h2"
              value={props.headline}
              onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
              className="font-bold tracking-tight"
              style={{ color: text, fontFamily: DISPLAY, fontSize: "clamp(1.875rem, 4vw, 2.75rem)", lineHeight: 1.1 }}
              multiline />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
                className="mt-3 max-w-xl text-base leading-relaxed md:text-lg"
                style={{ color: muted, fontFamily: BODY }}
                multiline />
            )}
          </div>
          {testimonials.length > 1 && (
            <div className="hidden shrink-0 items-center gap-3 md:flex">
              {arrowBtn("prev")}
              {arrowBtn("next")}
            </div>
          )}
        </Reveal>

        {/* ── Sliding track with a peek of the next card ── */}
        {testimonials.length > 0 && (
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label={props.headline || "Customer quotes"}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            className="relative w-full overflow-hidden"
          >
            {/* NOTE: the gap must stay 1.5rem (gap-6) at every breakpoint — the
                track transform below assumes slide stride = 88% + 1.5rem. */}
            <div
              className="flex w-full gap-6"
              style={{
                transform: `translateX(calc(${-safeIndex} * (88% + 1.5rem)))`,
                transition: reduce ? "none" : "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {testimonials.map((t, i) => {
                const active = i === safeIndex;
                return (
                  <div
                    key={i}
                    aria-hidden={!active}
                    className="w-[88%] shrink-0"
                    style={{
                      opacity: active ? 1 : 0.45,
                      transition: reduce ? "none" : "opacity 0.55s ease",
                    }}
                  >
                    <figure
                      className="flex h-full flex-col rounded-3xl border p-7 sm:p-10 lg:p-12"
                      style={{
                        background: cardBg,
                        borderColor: cardBorder,
                        boxShadow: `0 1px 2px color-mix(in srgb, ${cardText} 4%, transparent), 0 24px 56px -32px color-mix(in srgb, ${cardText} 35%, transparent)`,
                      }}
                    >
                      {/* Hanging accent quote mark */}
                      <span
                        aria-hidden
                        className="pointer-events-none block select-none leading-[0.5]"
                        style={{ fontFamily: DISPLAY, fontSize: "3.5rem", color: accent, opacity: 0.3 }}
                      >
                        &ldquo;
                      </span>

                      {t.rating ? (
                        <div
                          role="img"
                          aria-label={`Rated ${Math.min(5, t.rating)} out of 5 stars`}
                          className="mt-2 flex items-center gap-1"
                        >
                          {Array.from({ length: Math.min(5, t.rating) }).map((_, s) => (
                            <Star key={s} aria-hidden className="h-4 w-4 fill-current" style={{ color: accent }} />
                          ))}
                        </div>
                      ) : null}

                      <InlineText
                        as="blockquote"
                        value={t.quote}
                        onUpdate={onFieldChange ? (v) => updateTestimonial(i, { quote: v }) : undefined}
                        className="mt-4 flex-1 text-balance font-medium tracking-tight"
                        style={{
                          color: cardText,
                          fontFamily: DISPLAY,
                          fontSize: "clamp(1.25rem, 2.6vw, 1.875rem)",
                          lineHeight: 1.3,
                        }}
                        multiline />

                      <figcaption className="mt-8 flex items-center gap-3.5 border-t pt-6" style={{ borderColor: cardBorder }}>
                        {t.avatarImage ? (
                          <InlineImage
                            src={t.avatarImage}
                            alt={`${t.author} portrait`}
                            onUpdate={onFieldChange ? (url) => updateTestimonial(i, { avatarImage: url }) : undefined}
                            className="h-11 w-11 shrink-0 rounded-full object-cover"
                            wrapperClassName="shrink-0"
                            style={{ border: `1px solid ${cardBorder}` }}
                            loading="lazy"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                            style={{
                              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                              color: accent,
                              fontFamily: BODY,
                            }}
                          >
                            {t.avatarInitials || initialsOf(t.author)}
                          </span>
                        )}
                        <span className="flex min-w-0 flex-col">
                          <InlineText
                            as="span"
                            value={t.author}
                            onUpdate={onFieldChange ? (v) => updateTestimonial(i, { author: v }) : undefined}
                            className="text-base font-semibold leading-tight"
                            style={{ color: cardText, fontFamily: BODY }} />
                          <span className="mt-0.5 text-sm leading-tight" style={{ color: cardMuted, fontFamily: BODY }}>
                            <InlineText
                              as="span"
                              value={t.role}
                              onUpdate={onFieldChange ? (v) => updateTestimonial(i, { role: v }) : undefined}
                              className="inline"
                              style={{ color: cardMuted }} />
                            {" · "}
                            <InlineText
                              as="span"
                              value={t.company}
                              onUpdate={onFieldChange ? (v) => updateTestimonial(i, { company: v }) : undefined}
                              className="inline font-medium"
                              style={{ color: cardMuted }} />
                          </span>
                        </span>
                      </figcaption>
                    </figure>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Controls: mobile arrows + dot pills ── */}
        {testimonials.length > 1 && (
          <div className="mt-8 flex items-center justify-center gap-5 md:justify-start">
            <span className="md:hidden">{arrowBtn("prev")}</span>
            <div className="flex items-center gap-2" aria-label="Choose quote">
              {testimonials.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  aria-current={i === safeIndex ? "true" : undefined}
                  className={cn("h-2.5 rounded-full", focusRing)}
                  style={{
                    width: i === safeIndex ? "1.75rem" : "0.625rem",
                    backgroundColor: i === safeIndex ? accent : border,
                    outlineColor: accent,
                    transition: reduce ? "none" : "width 0.3s ease, background-color 0.3s ease",
                  }}
                  aria-label={`Go to quote ${i + 1} of ${testimonials.length}: ${t.author}`}
                />
              ))}
            </div>
            <span className="md:hidden">{arrowBtn("next")}</span>
          </div>
        )}

        {/* ── Compact CTA band ── */}
        {showCta && (
          <Reveal disabled={!animate} className="mt-14 border-t pt-10" style={{ borderColor: border }}>
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex flex-col items-center gap-2.5">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-[11px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: accent, fontFamily: BODY }} />
                )}
                {(props.ctaHeading || onFieldChange) && (
                  <InlineText
                    as="h3"
                    value={props.ctaHeading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                    className="text-2xl font-bold tracking-tight md:text-3xl"
                    style={{ color: text, fontFamily: DISPLAY }} />
                )}
                {(props.ctaSubheading || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.ctaSubheading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                    className="max-w-xl text-base leading-relaxed"
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
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-sm transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
                      focusRing,
                    )}
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="quote-carousel-cta-secondary"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-base font-semibold transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
                      focusRing,
                    )}
                    style={{ borderColor: `color-mix(in srgb, ${text} 22%, transparent)`, color: text, fontFamily: BODY, outlineColor: accent }}
                  >
                    {props.ctaSecondaryLabel || "Talk to sales"}
                  </CtaButton>
                )}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
