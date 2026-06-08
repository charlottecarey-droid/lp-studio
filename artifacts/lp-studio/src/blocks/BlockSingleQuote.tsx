import { Quote, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { SingleQuoteBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: SingleQuoteBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SingleQuoteBlockProps) => void;
}

export function BlockSingleQuote({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const border = `${text}1f`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;

  const update = <K extends keyof SingleQuoteBlockProps>(key: K, value: SingleQuoteBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section
      className="relative flex w-full flex-col items-center justify-center overflow-hidden px-6 py-24 sm:px-12 md:py-32"
      style={{ background: surface.background, color: text }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
        <div className="mb-10 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}12` }}>
          <Quote className="h-10 w-10" style={{ color: accent }} />
        </div>

        <InlineText
          as="blockquote"
          value={props.quote}
          onUpdate={onFieldChange ? (v) => update("quote", v) : undefined}
          className="mb-12 max-w-4xl text-3xl font-medium leading-snug tracking-tight sm:text-4xl md:text-5xl md:leading-tight"
          style={{ color: text, fontFamily: DISPLAY }}
          multiline />

        <div className="flex flex-col items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold tracking-tight shadow-sm"
            style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
          >
            {props.avatarInitials || props.author.charAt(0)}
          </div>
          <div className="flex flex-col">
            <InlineText
              as="span"
              value={props.author}
              onUpdate={onFieldChange ? (v) => update("author", v) : undefined}
              className="text-lg font-bold"
              style={{ color: text, fontFamily: BODY }} />
            <span className="text-base" style={{ color: muted, fontFamily: BODY }}>
              <InlineText
                as="span"
                value={props.role}
                onUpdate={onFieldChange ? (v) => update("role", v) : undefined}
                className="inline"
                style={{ color: muted }} />
              {", "}
              <InlineText
                as="span"
                value={props.company}
                onUpdate={onFieldChange ? (v) => update("company", v) : undefined}
                className="inline font-medium"
                style={{ color: text }} />
            </span>
          </div>
        </div>

        {showCta && (
          <div className="mt-20 flex w-full flex-col items-center pt-20">
            <div className="mb-16 h-px w-full max-w-md" style={{ backgroundColor: border }} />
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
                    source="single-quote-cta"
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
                    source="single-quote-cta-secondary"
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
