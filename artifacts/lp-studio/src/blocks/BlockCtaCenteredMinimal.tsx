import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CtaCenteredMinimalBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: CtaCenteredMinimalBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaCenteredMinimalBlockProps) => void;
}

export function BlockCtaCenteredMinimal({ props, brand, onFieldChange }: Props) {
  const sectionBg = resolveSectionSurface(props, "#ffffff");
  const surface = props.surfaceColor ?? "#ffffff";
  const text = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface, ["#64748b", "#94a3b8"]);
  const border = `${text}14`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof CtaCenteredMinimalBlockProps>(key: K, value: CtaCenteredMinimalBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full px-6 py-32 sm:py-48" style={{ background: sectionBg.background }}>
      <div
        className="container mx-auto max-w-4xl rounded-[3rem] border border-black/5 p-12 text-center shadow-sm sm:p-24"
        style={{ backgroundColor: surface, borderColor: border }}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-8 block text-sm font-bold uppercase tracking-[0.2em]"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
            className="mb-8 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl"
            style={{ color: text, fontFamily: DISPLAY }} />
          {(props.subheading || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheading ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined}
              className="mb-12 text-lg leading-relaxed md:text-xl"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
          <div className="flex w-full flex-wrap justify-center gap-3">
            {(props.ctaPrimaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaPrimaryUrl}
                brand={brand}
                source="cta-centered-minimal-primary"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
              >
                {props.ctaPrimaryLabel || "Start building for free"}
                <ArrowRight className="h-4 w-4" />
              </CtaButton>
            )}
            {(props.ctaSecondaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaSecondaryUrl}
                brand={brand}
                source="cta-centered-minimal-secondary"
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                style={{ borderColor: border, color: text, fontFamily: BODY }}
              >
                {props.ctaSecondaryLabel || "Contact sales"}
              </CtaButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
