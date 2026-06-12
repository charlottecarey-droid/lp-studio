import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryCarouselSpotlightBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, GlowOrbs, GridOverlay, NoiseOverlay } from "@/lib/premium-toolkit";

interface Props {
  props: GalleryCarouselSpotlightBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryCarouselSpotlightBlockProps) => void;
}

export function BlockGalleryCarouselSpotlight({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const isBuilder = !!onFieldChange;

  const images = props.images ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = images.length === 0 ? 0 : Math.min(activeIndex, images.length - 1);
  const active = images[safeIndex];

  const handlePrev = () =>
    setActiveIndex((prev) => (prev === 0 ? Math.max(images.length - 1, 0) : prev - 1));
  const handleNext = () =>
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  const update = <K extends keyof GalleryCarouselSpotlightBlockProps>(
    key: K,
    value: GalleryCarouselSpotlightBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateImage = (i: number, patch: Partial<GalleryCarouselSpotlightBlockProps["images"][number]>) => {
    if (!onFieldChange) return;
    const next = images.map((img, idx) => (idx === i ? { ...img, ...patch } : img));
    onFieldChange({ ...props, images: next });
  };

  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden" style={{ background: surface.background, color: ink }}>
      {surface.isDark ? (
        <>
          <GlowOrbs colors={[accent, brand.primaryColor ?? accent]} opacity={0.26} blur={140} />
          <GridOverlay color="rgba(255,255,255,0.05)" opacity={0.5} />
          <NoiseOverlay opacity={0.04} />
        </>
      ) : (
        <GlowOrbs colors={[accent, brand.primaryColor ?? accent]} blend="normal" opacity={0.09} blur={160} />
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

        <div className="flex flex-col gap-10">
          <div className="group relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black ring-1 ring-black/10">
            {/* Soft accent glow behind the spotlight frame */}
            <div className="pointer-events-none absolute -inset-8 -z-10 opacity-60" style={{ background: `radial-gradient(60% 60% at 50% 50%, ${accent}33, transparent 70%)`, filter: "blur(40px)" }} />
            {active && (
              <InlineImage
                src={active.src}
                alt={active.alt || active.caption || ""}
                onUpdate={onFieldChange ? (src: string) => updateImage(safeIndex, { src }) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => updateImage(safeIndex, { alt }) : undefined}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
                wrapperClassName="block absolute inset-0 w-full h-full"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <p className="text-white text-xl font-medium" style={{ fontFamily: BODY }}>{active?.caption}</p>
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition hover:scale-110 z-10"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition hover:scale-110 z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="flex gap-6 overflow-x-auto px-2 py-2 snap-x hide-scrollbar justify-center">
            {images.map((img, idx) => (
              <button
                type="button"
                key={img.id}
                onClick={() => setActiveIndex(idx)}
                className={`relative shrink-0 w-32 aspect-video rounded-xl overflow-hidden transition-all duration-300 snap-center ${safeIndex === idx ? "scale-105" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
                style={safeIndex === idx ? { boxShadow: `0 0 0 4px ${surface.base}, 0 0 0 8px ${accent}` } : {}}
                aria-label={img.caption || `View image ${idx + 1}`}
              >
                {img.src ? (
                  <img src={img.src} alt={img.alt || img.caption || ""} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 bg-black/10" />
                )}
              </button>
            ))}
          </div>
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={isBuilder} delay={0.1} className="mt-16 flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="gallery-carousel-spotlight-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold transition-transform duration-300 hover:scale-105"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Request a demo"}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
