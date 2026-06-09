import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CtaSplitImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: CtaSplitImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaSplitImageBlockProps) => void;
}

export function BlockCtaSplitImage({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const text = props.textColor ?? surface.color ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#64748b", "#94a3b8"]);
  const border = `${text}26`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof CtaSplitImageBlockProps>(key: K, value: CtaSplitImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const copy = (
    <div
      className="flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20"
      style={{ color: text, fontFamily: BODY }}
    >
      <div className="mx-auto w-full max-w-xl lg:mx-0">
        {(props.eyebrow || onFieldChange) && (
          <InlineText
            as="p"
            value={props.eyebrow ?? ""}
            onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
            className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: accent }}
          />
        )}
        <InlineText
          as="h2"
          value={props.heading}
          onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
          className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.75rem]"
          style={{ color: text, fontFamily: DISPLAY }}
        />
        {(props.subheading || onFieldChange) && (
          <InlineText
            as="p"
            value={props.subheading ?? ""}
            onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
            className="mt-5 max-w-prose text-base leading-relaxed sm:text-lg"
            style={{ color: muted }}
            multiline
          />
        )}
        {(props.ctaPrimaryLabel || props.ctaSecondaryLabel || onFieldChange) && (
          <div className="mt-9 flex flex-wrap items-center gap-4">
            {(props.ctaPrimaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaPrimaryUrl}
                brand={brand}
                source="cta-split-image-primary"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
              >
                {props.ctaPrimaryLabel || "Get started today"}
                <ArrowRight className="h-4 w-4" />
              </CtaButton>
            )}
            {(props.ctaSecondaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaSecondaryUrl}
                brand={brand}
                source="cta-split-image-secondary"
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold transition-transform hover:-translate-y-0.5"
                style={{ borderColor: border, color: text, fontFamily: BODY }}
              >
                {props.ctaSecondaryLabel || "View documentation"}
              </CtaButton>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const media = (
    <div className="flex items-stretch p-6 sm:p-10 lg:p-10">
      <div className="relative w-full overflow-hidden rounded-3xl shadow-2xl">
        <div className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[28rem]">
          <InlineImage
            src={props.imageUrl ?? ""}
            alt={props.imageAlt || props.heading || "Feature image"}
            onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
            className="h-full w-full object-cover"
            wrapperClassName="block h-full w-full"
          />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/10" />
      </div>
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden" style={{ background: surface.background }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-2 lg:grid-cols-2 lg:gap-8">
        <div className="order-2 lg:order-1">{media}</div>
        <div className="order-1 lg:order-2">{copy}</div>
      </div>
    </section>
  );
}
