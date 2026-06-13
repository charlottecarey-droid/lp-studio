import { Star, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, isValidHex } from "@/lib/brand-config";
import type { QuoteLibraryBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { cn } from "@/lib/utils";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/* ----------------------------------------------------------------------------
 * Quote Library — a mixed masonry wall. Left-aligned editorial header, CSS
 * columns with deliberately varied card treatments: one featured card (larger
 * display-type quote, accent ring), periodic soft accent-tinted cards, plain
 * cards in between. Avatars support photos with an initials fallback. Cards
 * stagger-reveal on scroll (static under prefers-reduced-motion).
 * -------------------------------------------------------------------------- */

interface Props {
  props: QuoteLibraryBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: QuoteLibraryBlockProps) => void;
}

/** "Maya Chen" → "MC"; single word → first two letters; empty → "•". */
function initialsOf(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function BlockQuoteLibrary({ props, brand, onFieldChange }: Props) {
  const bgSurface = resolveSectionSurface(props, "#F8FAFC");
  const text = props.textColor ?? bgSurface.color ?? "#0F172A";
  // Brand-derived accent: panel override → brand accent → brand primary.
  const accent = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#0F172A";
  const muted = pickContrastingColor(undefined, bgSurface.base, ["#64748B", "#94A3B8"]);
  const border = `color-mix(in srgb, ${text} 12%, transparent)`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;
  const reduce = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduce;

  // Card base contrasts with the section; a valid `cardBgColor` override wins.
  // In-card colors derive from the chosen surface so a custom color stays
  // readable; featured/tinted washes color-mix off `cardBg`/`accent` below.
  const cardOverride =
    props.cardBgColor && (isValidHex(props.cardBgColor) || props.cardBgColor.startsWith("var("))
      ? props.cardBgColor
      : undefined;
  const cardBg = cardOverride ?? pickContrastingColor(undefined, bgSurface.base, ["#FFFFFF", "#1E293B"]);
  const cardText = pickContrastingColor(undefined, cardBg, ["#0F172A", "#F8FAFC"]);
  const cardMuted = pickContrastingColor(undefined, cardBg, ["#64748B", "#94A3B8"]);
  const cardBorder = `color-mix(in srgb, ${cardText} 9%, transparent)`;

  const testimonials = props.testimonials ?? [];
  // One featured card by default (the first); explicit per-item flags win.
  const hasExplicitFeatured = testimonials.some((t) => t.featured !== undefined);

  const update = <K extends keyof QuoteLibraryBlockProps>(key: K, value: QuoteLibraryBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTestimonial = (i: number, patch: Partial<QuoteLibraryBlockProps["testimonials"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, testimonials: testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20"
      style={{ background: bgSurface.background, color: text }}
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 md:px-10">
        {/* ── Left-aligned editorial header ── */}
        <Reveal disabled={!animate} className="mb-10 max-w-2xl md:mb-12">
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
        </Reveal>

        {/* ── Mixed masonry wall ── */}
        <RevealStagger disabled={!animate} className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {testimonials.map((t, i) => {
            const featured = t.featured ?? (!hasExplicitFeatured && i === 0);
            // With a custom card color, only honor an explicit per-card tint —
            // don't auto-wash the chosen surface by position.
            const tinted = !featured && (cardOverride ? t.tinted === true : (t.tinted ?? i % 3 === 2));
            const cardStyle: React.CSSProperties = {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              boxShadow: `0 1px 2px color-mix(in srgb, ${cardText} 4%, transparent), 0 16px 40px -28px color-mix(in srgb, ${cardText} 28%, transparent)`,
              ...(tinted
                ? { background: `color-mix(in srgb, ${accent} ${bgSurface.isDark ? "12%" : "6%"}, ${cardBg})` }
                : null),
              ...(featured
                ? {
                    border: `1.5px solid color-mix(in srgb, ${accent} 50%, transparent)`,
                    boxShadow: `0 0 0 4px color-mix(in srgb, ${accent} 8%, transparent), 0 16px 40px -28px color-mix(in srgb, ${cardText} 30%, transparent)`,
                  }
                : null),
            };
            return (
              <RevealItem
                key={t.id || i}
                className="mb-5 break-inside-avoid"
              >
                <figure
                  className={cn(
                    "flex flex-col rounded-2xl border transition-transform duration-300 motion-safe:hover:-translate-y-1",
                    featured ? "gap-5 p-7 md:p-9" : "gap-4 p-6 md:p-7",
                  )}
                  style={cardStyle}
                >
                  {featured && (
                    <span
                      aria-hidden
                      className="pointer-events-none block select-none leading-[0.5]"
                      style={{ fontFamily: DISPLAY, fontSize: "3rem", color: accent, opacity: 0.3 }}
                    >
                      &ldquo;
                    </span>
                  )}
                  {t.rating ? (
                    <div
                      role="img"
                      aria-label={`Rated ${Math.min(5, t.rating)} out of 5 stars`}
                      className="flex items-center gap-1"
                    >
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          aria-hidden
                          className="h-3.5 w-3.5"
                          style={{
                            color: s < Math.min(5, t.rating!) ? accent : `color-mix(in srgb, ${cardText} 18%, transparent)`,
                            fill: s < Math.min(5, t.rating!) ? accent : "transparent",
                          }}
                        />
                      ))}
                    </div>
                  ) : null}

                  <InlineText
                    as="blockquote"
                    value={t.quote}
                    onUpdate={onFieldChange ? (v) => updateTestimonial(i, { quote: v }) : undefined}
                    className={cn("text-balance leading-relaxed", featured ? "font-medium tracking-tight" : "")}
                    style={{
                      color: cardText,
                      fontFamily: featured ? DISPLAY : BODY,
                      fontSize: featured ? "clamp(1.125rem, 2vw, 1.375rem)" : "0.9375rem",
                      lineHeight: featured ? 1.35 : 1.6,
                    }}
                    multiline />

                  <figcaption className="mt-auto flex items-center gap-3 pt-1">
                    {t.avatarUrl ? (
                      <InlineImage
                        src={t.avatarUrl}
                        alt={`${t.author} portrait`}
                        onUpdate={onFieldChange ? (url) => updateTestimonial(i, { avatarUrl: url }) : undefined}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                        wrapperClassName="shrink-0"
                        style={{ border: `1px solid ${cardBorder}` }}
                        loading="lazy"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
                        className="truncate text-sm font-semibold leading-tight"
                        style={{ color: cardText, fontFamily: BODY }} />
                      <span className="mt-0.5 truncate text-xs leading-tight" style={{ color: cardMuted, fontFamily: BODY }}>
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
                          className="inline"
                          style={{ color: cardMuted }} />
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </RevealItem>
            );
          })}
        </RevealStagger>

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
                    source="quote-library-cta"
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
                    source="quote-library-cta-secondary"
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
