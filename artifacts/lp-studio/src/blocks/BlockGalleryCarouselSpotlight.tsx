import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryCarouselSpotlightBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Gallery Carousel Spotlight — cinematic single-image stage.
 *
 * One large rounded-2xl slide takes center stage with the adjacent slides
 * peeking in from the edges (dimmed + slightly scaled down) behind soft
 * edge-fade masks. Slides glide horizontally on navigation (instant swap
 * under prefers-reduced-motion). A refined caption bar below the stage holds
 * the live caption, a tabular slide counter, dot indicators and arrow
 * controls — all keyboard-accessible with visible focus rings.
 * -------------------------------------------------------------------------- */

interface Props {
  props: GalleryCarouselSpotlightBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryCarouselSpotlightBlockProps) => void;
}

export function BlockGalleryCarouselSpotlight({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const isBuilder = !!onFieldChange;

  // Contrast-resolved tones (per brand-config rules — never paint a raw brand
  // color onto a surface it can vanish into).
  const accent = pickContrastingColor(accentBase, surface.base, [brand.primaryColor], 3.0);
  const eyebrowColor = pickContrastingColor(
    accentBase,
    surface.base,
    [brand.primaryColor, surface.isDark ? "#E2E8F0" : "#0f172a"],
    4.5,
  );
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const hairline = surface.isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

  const images = props.images ?? [];
  const count = images.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);
  const active = images[safeIndex];

  const handlePrev = () => setActiveIndex(count === 0 ? 0 : (safeIndex - 1 + count) % count);
  const handleNext = () => setActiveIndex(count === 0 ? 0 : (safeIndex + 1) % count);

  const update = <K extends keyof GalleryCarouselSpotlightBlockProps>(
    key: K,
    value: GalleryCarouselSpotlightBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateImage = (i: number, patch: Partial<GalleryCarouselSpotlightBlockProps["images"][number]>) => {
    if (!onFieldChange) return;
    const next = images.map((img, idx) => (idx === i ? { ...img, ...patch } : img));
    onFieldChange({ ...props, images: next });
  };

  /** Signed shortest distance from the active slide (wrap-aware), so the
   *  previous/next slides peek in from each side of the stage. */
  const offsetFor = (idx: number) => {
    if (count === 0) return 0;
    const rel = (idx - safeIndex + count) % count;
    return rel > count / 2 ? rel - count : rel;
  };

  const slideTransition = reduced
    ? undefined
    : "transform 0.65s cubic-bezier(0.16,1,0.3,1), opacity 0.65s ease";

  const arrowStyle = {
    color: ink,
    borderColor: hairline,
    backgroundColor: surface.isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
    outlineColor: accent,
  };

  return (
    <section
      className="relative w-full py-20 sm:py-28 overflow-hidden"
      style={{ background: surface.background, color: ink, fontFamily: BODY }}
    >
      {/* Faint accent wash anchored behind the stage (dark surfaces only). */}
      {surface.isDark && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(55% 45% at 50% 35%, color-mix(in srgb, ${accentBase} 14%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="container relative z-10 mx-auto px-6 max-w-6xl">
        {/* ── Header rail: kicker + headline left, copy capped for measure. ── */}
        <Reveal disabled={isBuilder} className="max-w-3xl mb-10 sm:mb-14">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
              className="text-[11px] font-semibold uppercase tracking-[0.26em] mb-4 block"
              style={{ color: eyebrowColor }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
            className="font-bold tracking-tight leading-[1.05] mb-4"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4.2vw, 3.25rem)" }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("subheadline", v) : undefined}
              className="text-base sm:text-lg leading-relaxed max-w-2xl"
              style={{ color: muted }} />
          )}
        </Reveal>
      </div>

      {/* ── Cinematic stage: active slide centered, neighbors peeking. ── */}
      <div className="relative z-10" role="group" aria-roledescription="carousel" aria-label={props.headline || "Image carousel"}>
        {/* Edge-fade masks framing the spotlight. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-24 lg:w-40 z-20"
          aria-hidden="true"
          style={{ background: `linear-gradient(to right, ${surface.base}, transparent)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-24 lg:w-40 z-20"
          aria-hidden="true"
          style={{ background: `linear-gradient(to left, ${surface.base}, transparent)` }}
        />

        <div className="relative mx-auto w-[88%] sm:w-[78%] max-w-4xl aspect-[16/9]">
          {images.map((img, idx) => {
            const offset = offsetFor(idx);
            const isActive = offset === 0;
            const isPeek = Math.abs(offset) === 1;
            return (
              <div
                key={img.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${idx + 1} of ${count}`}
                aria-hidden={!isActive}
                className={`absolute inset-0 rounded-2xl overflow-hidden ${isActive ? "" : "pointer-events-none"}`}
                style={{
                  transform: `translateX(${offset * 104}%) scale(${isActive ? 1 : 0.94})`,
                  opacity: isActive ? 1 : isPeek ? 0.35 : 0,
                  zIndex: isActive ? 2 : 1,
                  transition: slideTransition,
                  boxShadow: isActive
                    ? surface.isDark
                      ? "0 30px 70px -28px rgba(0,0,0,0.85)"
                      : "0 28px 60px -24px rgba(15,23,42,0.30)"
                    : "none",
                }}
              >
                <div
                  className="absolute inset-0 rounded-2xl z-10 pointer-events-none"
                  aria-hidden="true"
                  style={{ boxShadow: `inset 0 0 0 1px ${surface.isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)"}` }}
                />
                <InlineImage
                  src={img.src}
                  alt={img.alt || img.caption || ""}
                  onUpdate={onFieldChange && isActive ? (src: string) => updateImage(idx, { src }) : undefined}
                  onAltUpdate={onFieldChange && isActive ? (alt: string) => updateImage(idx, { alt }) : undefined}
                  className="absolute inset-0 w-full h-full object-cover"
                  wrapperClassName="block absolute inset-0 w-full h-full bg-black/10"
                />
              </div>
            );
          })}
          {count === 0 && isBuilder && (
            <div
              className="absolute inset-0 rounded-2xl border border-dashed flex items-center justify-center text-sm"
              style={{ borderColor: hairline, color: muted }}
            >
              Add images from the panel to fill the spotlight
            </div>
          )}
        </div>
      </div>

      {/* ── Caption bar: counter + live caption, dots + arrows. ── */}
      <div className="container relative z-10 mx-auto px-6 max-w-6xl">
        <div
          className="mx-auto w-full max-w-4xl mt-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-t pt-5"
          style={{ borderColor: hairline }}
        >
          <div className="flex items-baseline gap-4 min-w-0 flex-1">
            {count > 0 && (
              <span
                className="shrink-0 text-xs font-semibold tabular-nums tracking-[0.18em]"
                style={{ color: eyebrowColor, fontVariantNumeric: "tabular-nums" }}
                aria-hidden="true"
              >
                {String(safeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </span>
            )}
            {(active?.caption || onFieldChange) && (
              <InlineText
                as="p"
                value={active?.caption ?? ""}
                onUpdate={onFieldChange && active ? (v: string) => updateImage(safeIndex, { caption: v }) : undefined}
                className="truncate text-sm sm:text-base font-medium"
                style={{ color: ink, fontFamily: DISPLAY }} />
            )}
          </div>

          {count > 1 && (
            <div className="flex items-center gap-5 shrink-0">
              {/* Dots */}
              <div className="flex items-center gap-2" role="group" aria-label="Choose slide">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={img.caption ? `Go to slide: ${img.caption}` : `Go to slide ${idx + 1}`}
                    aria-current={idx === safeIndex}
                    className={`h-1.5 rounded-full ${focusRing} ${reduced ? "" : "transition-all duration-300"} ${idx === safeIndex ? "w-6" : "w-1.5"}`}
                    style={{
                      backgroundColor: idx === safeIndex ? accent : hairline,
                      outlineColor: accent,
                    }}
                  />
                ))}
              </div>
              {/* Arrows */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous slide"
                  className={`w-9 h-9 rounded-full border flex items-center justify-center ${focusRing} ${reduced ? "" : "transition-colors duration-200 hover:opacity-80"}`}
                  style={arrowStyle}
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next slide"
                  className={`w-9 h-9 rounded-full border flex items-center justify-center ${focusRing} ${reduced ? "" : "transition-colors duration-200 hover:opacity-80"}`}
                  style={arrowStyle}
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={isBuilder} delay={0.1} className="mt-12 flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="gallery-carousel-spotlight-cta"
              className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold ${focusRing} ${reduced ? "" : "transition-transform duration-300 hover:-translate-y-0.5"}`}
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
            >
              {props.ctaLabel || "Request a demo"}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
