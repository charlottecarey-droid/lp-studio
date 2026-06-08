import { Star, ArrowRight, Quote } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { QuoteLibraryBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem, AccentGlow } from "@/lib/premium-toolkit";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: QuoteLibraryBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: QuoteLibraryBlockProps) => void;
}

export function BlockQuoteLibrary({ props, brand, onFieldChange }: Props) {
  const bgSurface = resolveSectionSurface(props, "#F8FAFC");
  const text = props.textColor ?? bgSurface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const surface = pickContrastingColor(undefined, bgSurface.base, ["#FFFFFF", "#1E293B"]);
  const muted = pickContrastingColor(undefined, bgSurface.base, ["#64748B", "#94A3B8"]);
  const border = `${text}1f`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;

  const testimonials = props.testimonials ?? [];
  const animate = !onFieldChange;

  const update = <K extends keyof QuoteLibraryBlockProps>(key: K, value: QuoteLibraryBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTestimonial = (i: number, patch: Partial<QuoteLibraryBlockProps["testimonials"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, testimonials: testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  return (
    <section className="relative w-full overflow-hidden py-24 sm:py-32 flex flex-col items-center" style={{ background: bgSurface.background, color: text }}>
      <AccentGlow color={accent} isDark={bgSurface.isDark} />
      <div className="relative z-10 container mx-auto px-6 max-w-7xl">
        <Reveal disabled={!animate} className="max-w-3xl mx-auto text-center mb-16 md:mb-24 flex flex-col items-center gap-4">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-[0.2em]"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight"
            style={{ color: text, fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="text-lg md:text-xl max-w-2xl mt-2"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </Reveal>

        <RevealStagger disabled={!animate} className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((t, i) => (
            <RevealItem
              key={t.id || i}
              className="group relative break-inside-avoid flex flex-col gap-6 overflow-hidden p-8 rounded-2xl shadow-sm border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-18px_rgba(15,23,42,0.22)]"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <Quote
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 select-none opacity-[0.06] transition-opacity duration-300 group-hover:opacity-[0.12]"
                style={{ color: accent }}
                strokeWidth={1}
              />
              {t.rating ? (
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className="w-4 h-4"
                      style={{
                        fill: s < t.rating! ? accent : "transparent",
                        color: s < t.rating! ? accent : border,
                      }}
                    />
                  ))}
                </div>
              ) : null}

              <InlineText
                as="blockquote"
                value={t.quote}
                onUpdate={onFieldChange ? (v) => updateTestimonial(i, { quote: v }) : undefined}
                className="text-lg font-medium leading-relaxed"
                style={{ color: text, fontFamily: BODY }}
                multiline />

              <div className="flex items-center gap-4 mt-auto pt-2">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  {t.avatarInitials || t.author.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <InlineText
                    as="span"
                    value={t.author}
                    onUpdate={onFieldChange ? (v) => updateTestimonial(i, { author: v }) : undefined}
                    className="font-bold text-sm"
                    style={{ color: text, fontFamily: BODY }} />
                  <span className="text-sm" style={{ color: muted, fontFamily: BODY }}>
                    <InlineText
                      as="span"
                      value={t.role}
                      onUpdate={onFieldChange ? (v) => updateTestimonial(i, { role: v }) : undefined}
                      className="inline"
                      style={{ color: muted }} />
                    {", "}
                    <InlineText
                      as="span"
                      value={t.company}
                      onUpdate={onFieldChange ? (v) => updateTestimonial(i, { company: v }) : undefined}
                      className="inline"
                      style={{ color: muted }} />
                  </span>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        {showCta && (
          <Reveal disabled={!animate} className="mt-24 pt-16 border-t" style={{ borderColor: border }}>
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
                    source="quote-library-cta"
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
                    source="quote-library-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
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
