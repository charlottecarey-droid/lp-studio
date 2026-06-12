import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryMasonryBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Gallery Masonry — quiet, tightly-set photo wall.
 *
 * CSS-columns masonry with tight gutters, rounded-2xl frames, a low-alpha
 * inset ring on every tile and a hover lift + caption reveal (both disabled
 * under prefers-reduced-motion; captions stay visible in the builder for
 * inline editing). The header sits left on an accent kicker rule instead of
 * the old chunky centered stack.
 * -------------------------------------------------------------------------- */

interface Props {
  props: GalleryMasonryBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryMasonryBlockProps) => void;
}

export function BlockGalleryMasonry({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const isBuilder = !!onFieldChange;

  const accent = pickContrastingColor(accentBase, surface.base, [brand.primaryColor], 3.0);
  const eyebrowColor = pickContrastingColor(
    accentBase,
    surface.base,
    [brand.primaryColor, surface.isDark ? "#E2E8F0" : "#0f172a"],
    4.5,
  );
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const ringColor = surface.isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

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
    <section
      className="relative w-full py-20 sm:py-28 overflow-hidden"
      style={{ background: surface.background, color: ink, fontFamily: BODY }}
    >
      {surface.isDark && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(48% 40% at 16% 0%, color-mix(in srgb, ${accentBase} 12%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="container relative z-10 mx-auto px-6 max-w-6xl">
        {/* ── Header: kicker rule + left-set headline. ── */}
        <Reveal disabled={isBuilder} className="max-w-2xl mb-10 sm:mb-14">
          {(props.eyebrow || onFieldChange) && (
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px w-8 shrink-0" style={{ backgroundColor: accent }} aria-hidden="true" />
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
                className="text-[11px] font-semibold uppercase tracking-[0.26em] block"
                style={{ color: eyebrowColor }} />
            </div>
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
              className="text-base sm:text-lg leading-relaxed"
              style={{ color: muted }} />
          )}
        </Reveal>

        {/* ── Tight masonry wall. ── */}
        <RevealStagger disabled={isBuilder} stagger={0.06} className="columns-1 sm:columns-2 lg:columns-3 gap-3 sm:gap-4">
          {images.map((img, idx) => {
            const captionVisible = isBuilder
              ? "opacity-100 translate-y-0"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 " +
                (reduced ? "" : "translate-y-2 group-hover:translate-y-0 group-focus-within:translate-y-0");
            return (
              <RevealItem key={img.id} disabled={isBuilder} className="break-inside-avoid mb-3 sm:mb-4">
                <figure
                  tabIndex={img.caption && !isBuilder ? 0 : undefined}
                  aria-label={img.caption || undefined}
                  className={`group relative overflow-hidden rounded-2xl ${img.aspect || "aspect-[4/3]"} m-0 ${focusRing} ${reduced ? "" : "transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"}`}
                  style={{
                    boxShadow: surface.isDark
                      ? "0 8px 24px -14px rgba(0,0,0,0.6)"
                      : "0 6px 18px -12px rgba(15,23,42,0.14)",
                    outlineColor: accent,
                  }}
                >
                  <InlineImage
                    src={img.src}
                    alt={img.alt || img.caption || ""}
                    onUpdate={onFieldChange ? (src: string) => updateImage(idx, { src }) : undefined}
                    onAltUpdate={onFieldChange ? (alt: string) => updateImage(idx, { alt }) : undefined}
                    className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 group-hover:scale-[1.04]"}`}
                    wrapperClassName="block absolute inset-0 w-full h-full"
                  />
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    aria-hidden="true"
                    style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
                  />
                  {(img.caption || onFieldChange) && (
                    <figcaption
                      className={`absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-10 pointer-events-none ${captionVisible} ${reduced ? "" : "transition-all duration-300"}`}
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.66), transparent)" }}
                    >
                      <InlineText
                        as="p"
                        value={img.caption ?? ""}
                        onUpdate={onFieldChange ? (v: string) => updateImage(idx, { caption: v }) : undefined}
                        className="text-white text-[13px] font-medium tracking-wide pointer-events-auto"
                        style={{ fontFamily: BODY }} />
                    </figcaption>
                  )}
                </figure>
              </RevealItem>
            );
          })}
        </RevealStagger>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal disabled={isBuilder} delay={0.1} className="mt-12 sm:mt-16 flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="gallery-masonry-cta"
              className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold ${focusRing} ${reduced ? "" : "transition-transform duration-300 hover:-translate-y-0.5"}`}
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
            >
              {props.ctaLabel || "Join our team"}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
