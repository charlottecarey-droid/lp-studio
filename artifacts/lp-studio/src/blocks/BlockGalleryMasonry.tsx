import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryMasonryBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem, GlowOrbs, GridOverlay, NoiseOverlay } from "@/lib/premium-toolkit";

interface Props {
  props: GalleryMasonryBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryMasonryBlockProps) => void;
}

export function BlockGalleryMasonry({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const isBuilder = !!onFieldChange;

  const images = props.images ?? [];

  const update = <K extends keyof GalleryMasonryBlockProps>(
    key: K,
    value: GalleryMasonryBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateImage = (i: number, patch: Partial<GalleryMasonryBlockProps["images"][number]>) => {
    if (!onFieldChange) return;
    const next = images.map((img, idx) => (idx === i ? { ...img, ...patch } : img));
    onFieldChange({ ...props, images: next });
  };

  return (
    <section className="relative w-full py-24 sm:py-32 flex flex-col items-center overflow-hidden" style={{ background: surface.background, color: ink }}>
      {surface.isDark ? (
        <>
          <GlowOrbs colors={[accent, brand.primaryColor ?? accent]} opacity={0.26} blur={130} />
          <GridOverlay color="rgba(255,255,255,0.05)" opacity={0.6} />
          <NoiseOverlay opacity={0.04} />
        </>
      ) : (
        <GlowOrbs colors={[accent, brand.primaryColor ?? accent]} blend="normal" opacity={0.09} blur={150} />
      )}

      <div className="container relative z-10 mx-auto px-6 max-w-6xl">
        <Reveal disabled={isBuilder} className="text-center mb-16 max-w-2xl mx-auto">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-widest mb-4 block"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("subheadline", v) : undefined}
              className="text-lg"
              style={{ color: muted, fontFamily: BODY }} />
          )}
        </Reveal>

        <RevealStagger disabled={isBuilder} stagger={0.08} className="columns-1 sm:columns-2 lg:columns-3 gap-6">
          {images.map((img, idx) => (
            <RevealItem key={img.id} disabled={isBuilder} className="break-inside-avoid mb-6">
              <div className={`relative overflow-hidden rounded-2xl ${img.aspect || "aspect-[4/3]"} group shadow-sm ring-1 ring-black/5 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1`}>
                <InlineImage
                  src={img.src}
                  alt={img.alt || img.caption || ""}
                  onUpdate={onFieldChange ? (src: string) => updateImage(idx, { src }) : undefined}
                  onAltUpdate={onFieldChange ? (alt: string) => updateImage(idx, { alt }) : undefined}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  wrapperClassName="block absolute inset-0 w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 p-5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
                    <p className="text-white text-sm font-medium tracking-wide" style={{ fontFamily: BODY }}>{img.caption}</p>
                  </div>
                )}
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={isBuilder} delay={0.1} className="mt-16 flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="gallery-masonry-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold transition-transform duration-300 hover:scale-105"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Join our team"}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
