import { useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GallerySplitFeatureBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Gallery Split Feature — editorial hero + overlapping support shots.
 *
 * Asymmetric 5/7 split: a copy rail (vertical kicker rule, display headline,
 * CTA pair) beside a composed image cluster — one large hero frame with the
 * two supporting images overlapping its corners on a surface-colored "cutout"
 * border, plus a faint accent slab behind the hero for depth. On mobile the
 * supports fall into a tidy two-up row below the hero. All hover/entrance
 * motion is disabled under prefers-reduced-motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: GallerySplitFeatureBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GallerySplitFeatureBlockProps) => void;
}

export function BlockGallerySplitFeature({ props, brand, onFieldChange }: Props) {
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

  // Surface-colored cutout border so the overlapping cards read as if
  // punched through the hero frame.
  const cutout = `0 0 0 5px ${surface.base}`;
  const cardShadow = surface.isDark
    ? "0 18px 44px -20px rgba(0,0,0,0.75)"
    : "0 16px 40px -20px rgba(15,23,42,0.28)";

  return (
    <section
      className="relative w-full py-20 sm:py-28 lg:py-32 overflow-hidden"
      style={{ background: surface.background, color: ink, fontFamily: BODY }}
    >
      {surface.isDark && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(50% 45% at 85% 20%, color-mix(in srgb, ${accentBase} 13%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="container relative z-10 mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* ── Copy rail (5 cols): vertical kicker rule + headline + CTAs. ── */}
          <Reveal disabled={isBuilder} className="lg:col-span-5 flex flex-col">
            {(props.eyebrow || onFieldChange) && (
              <div className="flex items-center gap-3 mb-5">
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
              className="font-bold tracking-tight leading-[1.05] mb-5"
              style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2.1rem, 4.6vw, 3.5rem)" }} />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheadline", v) : undefined}
                className="text-base sm:text-lg leading-relaxed mb-9 max-w-xl"
                style={{ color: muted }} />
            )}
            {(props.ctaLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
                {(props.ctaLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaUrl}
                    brand={brand}
                    source="gallery-split-feature-cta"
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold ${focusRing} ${reduced ? "" : "transition-transform duration-300 hover:-translate-y-0.5"}`}
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
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
                    className={`group/cta inline-flex items-center gap-2 text-base font-semibold ${focusRing}`}
                    style={{ color: eyebrowColor, fontFamily: BODY, backgroundColor: "transparent", outlineColor: accent }}
                  >
                    {props.ctaSecondaryLabel || "Our mission"}
                    <ArrowRight className={`w-4 h-4 ${reduced ? "" : "transition-transform duration-300 group-hover/cta:translate-x-1"}`} aria-hidden="true" />
                  </CtaButton>
                )}
              </div>
            )}
          </Reveal>

          {/* ── Image cluster (7 cols): hero + overlapping support shots. ── */}
          <Reveal disabled={isBuilder} delay={0.08} className="lg:col-span-7">
            <div className="relative sm:pb-16 sm:pr-6 lg:pr-10">
              {/* Accent slab behind the hero for depth. */}
              <div
                className="hidden sm:block absolute -top-5 -right-1 lg:-right-2 w-2/5 h-2/5 rounded-2xl pointer-events-none"
                aria-hidden="true"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` }}
              />

              {/* Hero frame. */}
              <div
                className="group relative rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-[16/11]"
                style={{ boxShadow: cardShadow }}
              >
                <InlineImage
                  src={props.imageUrl}
                  alt={props.headline || ""}
                  onUpdate={onFieldChange ? (src: string) => update("imageUrl", src) : undefined}
                  className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 ease-out group-hover:scale-[1.03]"}`}
                  wrapperClassName="block absolute inset-0 w-full h-full"
                />
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  aria-hidden="true"
                  style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
                />
              </div>

              {/* Supporting shots: two-up row on mobile, overlapping cards on sm+. */}
              <div className="mt-4 grid grid-cols-2 gap-4 sm:mt-0 sm:block">
                <div
                  className={`group relative rounded-2xl overflow-hidden aspect-[4/3] sm:absolute sm:bottom-0 sm:left-0 lg:-left-4 sm:w-[38%] sm:aspect-[5/4] ${reduced ? "" : "sm:transition-transform sm:duration-500 sm:hover:-translate-y-1"}`}
                  style={{ boxShadow: `${cutout}, ${cardShadow}` }}
                >
                  <InlineImage
                    src={grid0?.src ?? ""}
                    alt={grid0?.alt || grid0?.caption || ""}
                    onUpdate={onFieldChange ? (src: string) => updateImage(0, { src }) : undefined}
                    onAltUpdate={onFieldChange ? (alt: string) => updateImage(0, { alt }) : undefined}
                    className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 ease-out group-hover:scale-[1.05]"}`}
                    wrapperClassName="block absolute inset-0 w-full h-full"
                  />
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    aria-hidden="true"
                    style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
                  />
                </div>
                <div
                  className={`group relative rounded-2xl overflow-hidden aspect-[4/3] sm:absolute sm:bottom-8 sm:right-0 sm:w-[30%] sm:aspect-square ${reduced ? "" : "sm:transition-transform sm:duration-500 sm:hover:-translate-y-1"}`}
                  style={{ boxShadow: `${cutout}, ${cardShadow}` }}
                >
                  <InlineImage
                    src={grid1?.src ?? ""}
                    alt={grid1?.alt || grid1?.caption || ""}
                    onUpdate={onFieldChange ? (src: string) => updateImage(1, { src }) : undefined}
                    onAltUpdate={onFieldChange ? (alt: string) => updateImage(1, { alt }) : undefined}
                    className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 ease-out group-hover:scale-[1.05]"}`}
                    wrapperClassName="block absolute inset-0 w-full h-full"
                  />
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    aria-hidden="true"
                    style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
                  />
                </div>
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}
