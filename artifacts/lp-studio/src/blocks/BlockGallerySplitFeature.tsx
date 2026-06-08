import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GallerySplitFeatureBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: GallerySplitFeatureBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GallerySplitFeatureBlockProps) => void;
}

export function BlockGallerySplitFeature({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);

  const images = props.images ?? [];

  const update = <K extends keyof GallerySplitFeatureBlockProps>(
    key: K,
    value: GallerySplitFeatureBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateImage = (i: number, patch: Partial<GallerySplitFeatureBlockProps["images"][number]>) => {
    if (!onFieldChange) return;
    const next = images.map((img, idx) => (idx === i ? { ...img, ...patch } : img));
    onFieldChange({ ...props, images: next });
  };

  const grid0 = images[0];
  const grid1 = images[1];

  return (
    <section className="w-full py-24 sm:py-32" style={{ background: surface.background, color: ink }}>
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          <div className="flex flex-col">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
                className="text-sm font-bold uppercase tracking-[0.18em] mb-6 block"
                style={{ color: accent, fontFamily: BODY }} />
            )}
            <InlineText
              as="h2"
              value={props.headline}
              onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]"
              style={{ color: ink, fontFamily: DISPLAY }} />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheadline", v) : undefined}
                className="text-lg md:text-xl leading-relaxed mb-10"
                style={{ color: muted, fontFamily: BODY }} />
            )}
            {(props.ctaLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="flex flex-wrap items-center gap-6">
                {(props.ctaLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaUrl}
                    brand={brand}
                    source="gallery-split-feature-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaLabel || "View open roles"}
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="gallery-split-feature-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold"
                    style={{ color: accent, fontFamily: BODY, backgroundColor: "transparent" }}
                  >
                    {props.ctaSecondaryLabel || "Our mission"}
                  </CtaButton>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 grid-rows-12 gap-4 h-[600px] w-full">
            <div className="col-span-8 row-span-12 relative rounded-3xl overflow-hidden shadow-xl">
              <InlineImage
                src={props.imageUrl}
                alt={props.headline || "Main gallery"}
                onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
                className="absolute inset-0 w-full h-full object-cover"
                wrapperClassName="block absolute inset-0 w-full h-full"
              />
            </div>
            <div className="col-span-4 row-span-6 relative rounded-2xl overflow-hidden shadow-lg">
              <InlineImage
                src={grid0?.src ?? ""}
                alt={grid0?.alt || grid0?.caption || "Gallery grid 1"}
                onUpdate={onFieldChange ? (src: string) => updateImage(0, { src }) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => updateImage(0, { alt }) : undefined}
                className="absolute inset-0 w-full h-full object-cover"
                wrapperClassName="block absolute inset-0 w-full h-full"
              />
            </div>
            <div className="col-span-4 row-span-6 relative rounded-2xl overflow-hidden shadow-lg">
              <InlineImage
                src={grid1?.src ?? ""}
                alt={grid1?.alt || grid1?.caption || "Gallery grid 2"}
                onUpdate={onFieldChange ? (src: string) => updateImage(1, { src }) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => updateImage(1, { alt }) : undefined}
                className="absolute inset-0 w-full h-full object-cover"
                wrapperClassName="block absolute inset-0 w-full h-full"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
