import { Star, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { TestimonialGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { balancedGridItemClasses } from "@/lib/grid-balance";
import { cn } from "@/lib/utils";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/* ----------------------------------------------------------------------------
 * Testimonial Grid — centered header over a responsive card grid that breaks
 * the monotony: card surfaces alternate (plain / soft accent tint), optional
 * featured cards span two columns with larger display-type quotes, stars are
 * small and accent-tinted, avatars support photos with an initials fallback,
 * and the cards stagger-reveal (static under prefers-reduced-motion). The old
 * uniform accent top-border is gone.
 * -------------------------------------------------------------------------- */

interface Props {
  props: TestimonialGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: TestimonialGridBlockProps) => void;
}

/** "Maya Chen" → "MC"; single word → first two letters; empty → "•". */
function initialsOf(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function BlockTestimonialGrid({ props, brand, onFieldChange }: Props) {
  const bgSurface = resolveSectionSurface(props, "#F8FAFC");
  const text = props.textColor ?? bgSurface.color ?? "#0F172A";
  const headlineColor = props.headlineColor ?? text;
  // Brand-derived accent: panel override → brand accent → brand primary.
  const accent = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#0F172A";
  // Section-level colors sit directly on the section background.
  const muted = pickContrastingColor(undefined, bgSurface.base, ["#64748B", "#94A3B8"]);
  const border = `color-mix(in srgb, ${text} 12%, transparent)`;
  const showCta = props.showCta ?? true;
  const reduce = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduce;

  // Cards sit on `cardBg`, which contrasts with the section background. Every
  // in-card color must therefore be derived from the card surface (not the
  // section bg/text), or a dark AI section yields dark text on a dark card.
  const cardBg = props.cardBgColor ?? pickContrastingColor(undefined, bgSurface.base, ["#FFFFFF", "#1E293B"]);
  const cardText = pickContrastingColor(props.textColor, cardBg, ["#0F172A", "#F8FAFC"]);
  const cardMuted = pickContrastingColor(undefined, cardBg, ["#64748B", "#94A3B8"]);
  const cardBorder = `color-mix(in srgb, ${cardText} 9%, transparent)`;

  // CTA button styling. Each field is an optional override; when unset we
  // derive a contrast-aware default from the CTA band background so the
  // secondary button never renders illegible white-on-light text.
  const ctaBandText = pickContrastingColor(undefined, bgSurface.base, ["#0F172A", "#FFFFFF"]);
  const primaryBg = props.ctaPrimaryBgColor ?? accent;
  const primaryText = props.ctaPrimaryTextColor ?? pickContrastingColor(undefined, primaryBg, ["#FFFFFF", "#0f172a"]);
  const secondaryText = props.ctaSecondaryTextColor ?? ctaBandText;
  const secondaryBorder = props.ctaSecondaryBorderColor ?? `color-mix(in srgb, ${ctaBandText} 22%, transparent)`;

  const testimonials = props.testimonials ?? [];

  /* Last-row balancing (doubled-track grid, see grid-balance.ts): the grid
   * renders md:grid-cols-4 / lg:grid-cols-6 (2 tracks per visual cell — md is
   * 2-up, lg 3-up) so an incomplete last row is centered instead of leaving a
   * bottom-left orphan card. A `featured` card counts as 2 cells. */
  const placementClasses = balancedGridItemClasses(
    testimonials.map((t) => (t.featured === true ? 2 : 1)),
    [
      { prefix: "md", cols: 2 },
      { prefix: "lg", cols: 3 },
    ],
  );

  const update = <K extends keyof TestimonialGridBlockProps>(key: K, value: TestimonialGridBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTestimonial = (i: number, patch: Partial<TestimonialGridBlockProps["testimonials"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, testimonials: testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-16 sm:py-20 lg:px-8 lg:py-24"
      style={{ background: bgSurface.background, color: text }}
    >
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 md:gap-12">
        {/* ── Centered header ── */}
        <Reveal disabled={!animate} className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-[11px] font-bold uppercase tracking-[0.22em]"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="font-bold tracking-tight"
            style={{ color: headlineColor, fontFamily: DISPLAY, fontSize: "clamp(1.875rem, 4vw, 2.75rem)", lineHeight: 1.1 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-1 text-base leading-relaxed md:text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </Reveal>

        {/* ── Varied card grid ── */}
        <RevealStagger disabled={!animate} className="grid grid-cols-1 gap-5 md:grid-cols-4 lg:grid-cols-6 lg:gap-6">
          {testimonials.map((t, i) => {
            const featured = t.featured === true;
            // Break the monotony: when no explicit card color is set, every
            // third card gets a soft accent wash instead of the plain surface.
            const tinted = !featured && !props.cardBgColor && i % 3 === 1;
            const surfaceStyle: React.CSSProperties = {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              boxShadow: `0 1px 2px color-mix(in srgb, ${cardText} 4%, transparent), 0 16px 40px -28px color-mix(in srgb, ${cardText} 26%, transparent)`,
              ...(tinted
                ? { background: `color-mix(in srgb, ${accent} ${bgSurface.isDark ? "12%" : "6%"}, ${cardBg})` }
                : null),
              ...(featured
                ? {
                    border: `1.5px solid color-mix(in srgb, ${accent} 50%, transparent)`,
                    boxShadow: `0 0 0 4px color-mix(in srgb, ${accent} 8%, transparent), 0 16px 40px -28px color-mix(in srgb, ${cardText} 28%, transparent)`,
                  }
                : null),
            };
            return (
              <RevealItem
                key={t.id || i}
                className={cn(placementClasses[i])}
              >
                <figure
                  className={cn(
                    "flex h-full flex-col rounded-2xl border transition-transform duration-300 motion-safe:hover:-translate-y-1",
                    featured ? "p-8 md:p-10" : "p-6 md:p-7",
                  )}
                  style={surfaceStyle}
                >
                  {(t.rating ?? 5) > 0 && (
                    <div
                      role="img"
                      aria-label={`Rated ${Math.min(5, t.rating ?? 5)} out of 5 stars`}
                      className="mb-4 flex items-center gap-1"
                    >
                      {Array.from({ length: Math.min(5, t.rating ?? 5) }).map((_, s) => (
                        <Star key={s} aria-hidden className="h-3.5 w-3.5 fill-current" style={{ color: accent }} />
                      ))}
                    </div>
                  )}

                  <InlineText
                    as="blockquote"
                    value={t.quote}
                    onUpdate={onFieldChange ? (v) => updateTestimonial(i, { quote: v }) : undefined}
                    className={cn("flex-1 text-balance", featured && "font-medium tracking-tight")}
                    style={{
                      color: cardText,
                      fontFamily: featured ? DISPLAY : BODY,
                      fontSize: featured ? "clamp(1.125rem, 2.2vw, 1.5rem)" : "0.9375rem",
                      lineHeight: featured ? 1.35 : 1.6,
                    }}
                    multiline />

                  <figcaption className="mt-6 flex items-center gap-3">
                    {t.avatarUrl ? (
                      <InlineImage
                        src={t.avatarUrl}
                        alt={`${t.author} portrait`}
                        onUpdate={onFieldChange ? (url) => updateTestimonial(i, { avatarUrl: url }) : undefined}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        wrapperClassName="shrink-0"
                        style={{ border: `1px solid ${cardBorder}` }}
                        loading="lazy"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
          <Reveal disabled={!animate} className="border-t pt-10" style={{ borderColor: border }}>
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
                    source="testimonial-grid-cta"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-sm transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
                      focusRing,
                    )}
                    style={{ backgroundColor: primaryBg, color: primaryText, fontFamily: BODY, outlineColor: accent }}
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
                    source="testimonial-grid-cta-secondary"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-base font-semibold transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
                      focusRing,
                    )}
                    style={{ borderColor: secondaryBorder, color: secondaryText, fontFamily: BODY, outlineColor: accent }}
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
