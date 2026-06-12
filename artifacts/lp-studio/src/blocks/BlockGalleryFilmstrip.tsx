import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryFilmstripBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { ArrowRight } from "lucide-react";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Gallery Filmstrip — continuous editorial strip.
 *
 * One fixed-height, drag/scroll-snap filmstrip whose frames vary in width
 * (each image's `aspect` class — or a curated default rhythm of portrait /
 * wide / square frames) so the strip reads like a contact sheet, not a row of
 * uniform tiles. Frames are rounded-2xl with a low-alpha ring; captions
 * reveal on hover/focus (always visible in the builder for inline editing).
 * Edge fades frame the strip; all motion is disabled under
 * prefers-reduced-motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: GalleryFilmstripBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryFilmstripBlockProps) => void;
}

/** Curated width rhythm (via aspect-ratio on a fixed-height strip) so
 *  consecutive frames vary: wide → portrait → standard → square → cinema. */
const FRAME_RHYTHM = [
  "aspect-[16/10]",
  "aspect-[3/4]",
  "aspect-[4/3]",
  "aspect-square",
  "aspect-[21/10]",
  "aspect-[4/5]",
];

export function BlockGalleryFilmstrip({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const isBuilder = !!onFieldChange;

  const accent = pickContrastingColor(accentBase, surface.base, [brand.primaryColor], 3.0);
  const linkColor = pickContrastingColor(
    accentBase,
    surface.base,
    [brand.primaryColor, surface.isDark ? "#E2E8F0" : "#0f172a"],
    4.5,
  );
  const muted = `color-mix(in srgb, ${ink} 60%, transparent)`;
  const hairline = surface.isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)";
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

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
      className={`group/cta inline-flex items-center gap-2 text-sm sm:text-base font-semibold ${focusRing}`}
      style={{ color: linkColor, fontFamily: BODY, outlineColor: accent }}
    >
      {props.ctaLabel || "View the full album"}
      <ArrowRight className={`w-4 h-4 ${reduced ? "" : "transition-transform duration-300 group-hover/cta:translate-x-1"}`} aria-hidden="true" />
    </CtaButton>
  ) : null;

  return (
    <section
      className="relative w-full py-16 sm:py-24 overflow-hidden"
      style={{ background: surface.background, color: ink, fontFamily: BODY }}
    >
      {/* ── Header rail: headline left, counter + CTA right. ── */}
      <Reveal disabled={isBuilder} className="container relative z-10 mx-auto px-6 max-w-7xl mb-8 sm:mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex items-baseline gap-5 min-w-0">
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
            className="font-bold tracking-tight leading-[1.05]"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(1.75rem, 3.6vw, 2.75rem)" }} />
          {images.length > 0 && (
            <span
              className="hidden sm:inline text-xs font-semibold tabular-nums tracking-[0.18em] shrink-0"
              style={{ color: muted, fontVariantNumeric: "tabular-nums" }}
              aria-hidden="true"
            >
              {String(images.length).padStart(2, "0")} FRAMES
            </span>
          )}
        </div>
        {cta && <div className="hidden md:block shrink-0">{cta}</div>}
      </Reveal>

      <div className="relative z-10">
        {/* Edge fades framing the strip. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 md:w-24 z-20"
          aria-hidden="true"
          style={{ background: `linear-gradient(to right, ${surface.base}, transparent)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 md:w-24 z-20"
          aria-hidden="true"
          style={{ background: `linear-gradient(to left, ${surface.base}, transparent)` }}
        />

        <div className="w-full overflow-x-auto pb-6 hide-scrollbar cursor-grab active:cursor-grabbing snap-x snap-mandatory">
          <ul className="flex items-stretch gap-3 sm:gap-4 px-6 md:px-12 w-max h-[260px] sm:h-[340px] lg:h-[420px] list-none m-0">
            {images.map((img, i) => {
              const frame = img.aspect || FRAME_RHYTHM[i % FRAME_RHYTHM.length];
              const captionVisible = isBuilder
                ? "opacity-100 translate-y-0"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 " +
                  (reduced ? "" : "translate-y-1 group-hover:translate-y-0 group-focus-within:translate-y-0");
              return (
                <li key={img.id} className="h-full shrink-0 snap-start">
                  <figure
                    tabIndex={img.caption && !isBuilder ? 0 : undefined}
                    aria-label={img.caption || undefined}
                    className={`group relative h-full ${frame} rounded-2xl overflow-hidden m-0 ${focusRing} ${reduced ? "" : "transition-shadow duration-500 hover:shadow-2xl"}`}
                    style={{
                      boxShadow: surface.isDark
                        ? "0 14px 36px -18px rgba(0,0,0,0.7)"
                        : "0 10px 30px -16px rgba(15,23,42,0.18)",
                      outlineColor: accent,
                    }}
                  >
                    <InlineImage
                      src={img.src}
                      alt={img.alt || img.caption || ""}
                      onUpdate={onFieldChange ? (src: string) => updateImage(i, { src }) : undefined}
                      onAltUpdate={onFieldChange ? (alt: string) => updateImage(i, { alt }) : undefined}
                      className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 ease-out group-hover:scale-[1.04]"}`}
                      wrapperClassName="block absolute inset-0 w-full h-full"
                    />
                    {/* Low-alpha ring on top of the image. */}
                    <div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      aria-hidden="true"
                      style={{ boxShadow: `inset 0 0 0 1px ${surface.isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)"}` }}
                    />
                    {(img.caption || onFieldChange) && (
                      <figcaption
                        className={`absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-12 pointer-events-none ${captionVisible} ${reduced ? "" : "transition-all duration-300"}`}
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)" }}
                      >
                        <InlineText
                          as="p"
                          value={img.caption ?? ""}
                          onUpdate={onFieldChange ? (v: string) => updateImage(i, { caption: v }) : undefined}
                          className="text-white text-[13px] sm:text-sm font-medium tracking-wide pointer-events-auto"
                          style={{ fontFamily: BODY }} />
                      </figcaption>
                    )}
                  </figure>
                </li>
              );
            })}
            {images.length === 0 && isBuilder && (
              <li
                className="h-full aspect-[4/3] rounded-2xl border border-dashed flex items-center justify-center text-sm shrink-0"
                style={{ borderColor: hairline, color: muted }}
              >
                Add images from the panel
              </li>
            )}
          </ul>
        </div>
      </div>

      {cta && <div className="container relative z-10 mx-auto px-6 max-w-7xl mt-2 md:hidden">{cta}</div>}
    </section>
  );
}
