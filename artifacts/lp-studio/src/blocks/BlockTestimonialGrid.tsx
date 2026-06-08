import { Star, Quote, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { TestimonialGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: TestimonialGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: TestimonialGridBlockProps) => void;
}

export function BlockTestimonialGrid({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#F8FAFC";
  const text = props.textColor ?? "#0F172A";
  const headlineColor = props.headlineColor ?? text;
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  // Section-level colors sit directly on the section background.
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const border = `${text}1f`;
  // Cards sit on `surface`, which contrasts with the section background. Every
  // in-card color must therefore be derived from the card surface (not the
  // section bg/text), or a dark AI section yields dark text on a dark card.
  const surface = pickContrastingColor(undefined, bg, ["#FFFFFF", "#1E293B"]);
  const cardText = pickContrastingColor(props.textColor, surface, ["#0F172A", "#F8FAFC"]);
  const cardMuted = pickContrastingColor(undefined, surface, ["#64748B", "#94A3B8"]);
  const cardBorder = `${cardText}1f`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;

  // CTA button styling. Each field is an optional override; when unset we
  // derive a contrast-aware default from the CTA band background (`bg`) so the
  // secondary button never renders illegible white-on-light text.
  const ctaBandText = pickContrastingColor(undefined, bg, ["#0F172A", "#FFFFFF"]);
  const primaryBg = props.ctaPrimaryBgColor ?? accent;
  const primaryText = props.ctaPrimaryTextColor ?? pickContrastingColor(undefined, primaryBg, ["#FFFFFF", "#0f172a"]);
  const secondaryText = props.ctaSecondaryTextColor ?? ctaBandText;
  const secondaryBorder = props.ctaSecondaryBorderColor ?? `${ctaBandText}33`;

  const testimonials = props.testimonials ?? [];

  const update = <K extends keyof TestimonialGridBlockProps>(key: K, value: TestimonialGridBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTestimonial = (i: number, patch: Partial<TestimonialGridBlockProps["testimonials"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, testimonials: testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  return (
    <section className="w-full py-24 sm:py-32 px-6 lg:px-8 flex flex-col justify-center" style={{ backgroundColor: bg, color: text }}>
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-16 lg:gap-20">
        <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="text-3xl md:text-5xl font-extrabold tracking-tight"
            style={{ color: headlineColor, fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="text-lg md:text-xl leading-relaxed mt-2"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t, i) => (
            <div
              key={t.id || i}
              className="relative flex flex-col p-8 rounded-3xl border shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
              style={{ backgroundColor: surface, borderColor: cardBorder }}
            >
              <Quote className="absolute top-8 right-8 w-12 h-12" style={{ color: cardBorder, opacity: 0.6 }} strokeWidth={1} />

              {(t.rating ?? 5) > 0 && (
                <div className="flex items-center gap-1 mb-6 z-10" style={{ color: accent }}>
                  {Array.from({ length: t.rating ?? 5 }).map((_, s) => (
                    <Star key={s} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              )}

              <InlineText
                as="p"
                value={t.quote}
                onUpdate={onFieldChange ? (v) => updateTestimonial(i, { quote: v }) : undefined}
                className="text-lg leading-relaxed mb-8 flex-1 z-10"
                style={{ color: cardText, fontFamily: BODY }}
                multiline />

              <div className="flex items-center gap-4 mt-auto z-10 pt-4 border-t" style={{ borderColor: cardBorder }}>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ backgroundColor: `${accent}1a`, color: accent }}
                >
                  {t.avatarInitials || t.author.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <InlineText
                    as="span"
                    value={t.author}
                    onUpdate={onFieldChange ? (v) => updateTestimonial(i, { author: v }) : undefined}
                    className="font-semibold text-base"
                    style={{ color: cardText, fontFamily: BODY }} />
                  <span className="text-sm font-medium" style={{ color: cardMuted, fontFamily: BODY }}>
                    <InlineText
                      as="span"
                      value={t.role}
                      onUpdate={onFieldChange ? (v) => updateTestimonial(i, { role: v }) : undefined}
                      className="inline"
                      style={{ color: cardMuted }} />
                    {", "}
                    <InlineText
                      as="span"
                      value={t.company}
                      onUpdate={onFieldChange ? (v) => updateTestimonial(i, { company: v }) : undefined}
                      className="inline"
                      style={{ color: cardMuted }} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showCta && (
          <div className="mt-4 pt-10 border-t" style={{ borderColor: border }}>
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
                    source="testimonial-grid-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: primaryBg, color: primaryText, fontFamily: BODY }}
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
                    source="testimonial-grid-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: secondaryBorder, color: secondaryText, fontFamily: BODY }}
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
