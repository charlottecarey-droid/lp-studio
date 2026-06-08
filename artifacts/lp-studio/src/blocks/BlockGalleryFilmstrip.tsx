import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryFilmstripBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { ArrowRight } from "lucide-react";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, GlowOrbs, GridOverlay, NoiseOverlay } from "@/lib/premium-toolkit";

interface Props {
  props: GalleryFilmstripBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryFilmstripBlockProps) => void;
}

export function BlockGalleryFilmstrip({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const isBuilder = !!onFieldChange;

  const images = props.images ?? [];

  const update = <K extends keyof GalleryFilmstripBlockProps>(
    key: K,
    value: GalleryFilmstripBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateImage = (i: number, patch: Partial<GalleryFilmstripBlockProps["images"][number]>) => {
    if (!onFieldChange) return;
    const next = images.map((img, idx) => (idx === i ? { ...img, ...patch } : img));
    onFieldChange({ ...props, images: next });
  };

  const cta = (props.ctaLabel || onFieldChange) ? (
    <CtaButton
      ctaAction="url"
      ctaUrl={props.ctaUrl}
      brand={brand}
      source="gallery-filmstrip-cta"
      className="group/cta inline-flex items-center gap-2 text-base font-semibold"
      style={{ color: accent, fontFamily: BODY }}
    >
      {props.ctaLabel || "View the full album"}
      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
    </CtaButton>
  ) : null;

  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden" style={{ background: surface.background, color: ink }}>
      {surface.isDark ? (
        <>
          <GlowOrbs colors={[accent, brand.primaryColor ?? accent]} opacity={0.24} blur={140} />
          <GridOverlay color="rgba(255,255,255,0.05)" opacity={0.5} />
          <NoiseOverlay opacity={0.04} />
        </>
      ) : (
        <GlowOrbs colors={[accent, brand.primaryColor ?? accent]} blend="normal" opacity={0.08} blur={160} />
      )}

      <Reveal disabled={isBuilder} className="container relative z-10 mx-auto px-6 max-w-7xl mb-12 flex justify-between items-end gap-6">
        <InlineText
          as="h2"
          value={props.headline}
          onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
          className="text-3xl md:text-4xl font-extrabold tracking-tight"
          style={{ color: ink, fontFamily: DISPLAY }} />
        {cta && <div className="hidden md:block shrink-0">{cta}</div>}
      </Reveal>

      <div className="relative z-10">
        {/* Edge fades to frame the filmstrip premium-style */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 md:w-20 z-20" style={{ background: `linear-gradient(to right, ${surface.base}, transparent)`, opacity: surface.isDark ? 0.6 : 1 }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 md:w-20 z-20" style={{ background: `linear-gradient(to left, ${surface.base}, transparent)`, opacity: surface.isDark ? 0.6 : 1 }} />
        <div className="w-full overflow-x-auto pb-8 hide-scrollbar cursor-grab active:cursor-grabbing snap-x snap-mandatory">
          <div className="flex gap-6 px-6 md:px-12 w-max">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="relative w-[300px] sm:w-[400px] md:w-[500px] aspect-[4/3] rounded-3xl overflow-hidden shrink-0 snap-center shadow-xl ring-1 ring-black/5 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 group"
              >
                <InlineImage
                  src={img.src}
                  alt={img.alt || img.caption}
                  onUpdate={onFieldChange ? (src: string) => updateImage(i, { src }) : undefined}
                  onAltUpdate={onFieldChange ? (alt: string) => updateImage(i, { alt }) : undefined}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
                  wrapperClassName="block absolute inset-0 w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 pointer-events-none transition-opacity duration-500 group-hover:opacity-95" />
                <div className="absolute bottom-6 left-6 right-6 pointer-events-none translate-y-1 transition-transform duration-500 group-hover:translate-y-0">
                  <p className="text-white text-lg font-medium tracking-wide" style={{ fontFamily: BODY }}>
                    {img.caption}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cta && <div className="container relative z-10 mx-auto px-6 max-w-7xl mt-2 md:hidden">{cta}</div>}
    </section>
  );
}
