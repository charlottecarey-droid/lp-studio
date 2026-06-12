import { useState } from "react";
import { Play, ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaThumbnailGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Media Thumbnail Grid — tight, curated video wall.
 *
 * A dense grid of rounded-2xl video cards with low-alpha rings, a bottom
 * scrim, a glass duration chip and an always-visible (keyboard- and
 * touch-friendly) play affordance pinned to the lower-left of each poster.
 * Titles run below the card with a tabular index number, library-style.
 * Lightbox playback + empty-video guards preserved.
 * -------------------------------------------------------------------------- */

interface Props {
  props: MediaThumbnailGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaThumbnailGridBlockProps) => void;
}

export function BlockMediaThumbnailGrid({ props, brand, onFieldChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;

  const surface = resolveSectionSurface(props, "#F8FAFC");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const accent = pickContrastingColor(accentBase, surface.base, [brand.primaryColor], 3.0);
  const eyebrowColor = pickContrastingColor(
    accentBase,
    surface.base,
    [brand.primaryColor, surface.isDark ? "#E2E8F0" : "#0f172a"],
    4.5,
  );
  // Play chips float over the posters' dark scrim → resolve against dark.
  const playBg = pickContrastingColor(accentBase, "#0a0a0a", [brand.primaryColor, "#FFFFFF"], 3.0);
  const onPlay = pickContrastingColor(undefined, playBg, ["#FFFFFF", "#0F172A"]);
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const ringColor = surface.isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

  const videos = props.videos ?? [];

  const update = <K extends keyof MediaThumbnailGridBlockProps>(
    key: K,
    value: MediaThumbnailGridBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateVideo = (i: number, patch: Partial<MediaThumbnailGridBlockProps["videos"][number]>) => {
    if (!onFieldChange) return;
    const next = videos.map((vid, idx) => (idx === i ? { ...vid, ...patch } : vid));
    onFieldChange({ ...props, videos: next });
  };

  const activeVideo = openIdx !== null ? videos[openIdx] : undefined;

  const cta = (props.ctaLabel || onFieldChange) ? (
    <CtaButton
      ctaAction="url"
      ctaUrl={props.ctaUrl}
      brand={brand}
      source="media-thumbnail-grid-cta"
      className={`group/cta inline-flex items-center gap-2 text-sm sm:text-base font-semibold ${focusRing}`}
      style={{ backgroundColor: "transparent", color: eyebrowColor, fontFamily: BODY, outlineColor: accent }}
    >
      {props.ctaLabel || "Browse all videos"}
      <ArrowRight className={`w-4 h-4 ${reduced ? "" : "transition-transform duration-300 group-hover/cta:translate-x-1"}`} aria-hidden="true" />
    </CtaButton>
  ) : null;

  return (
    <section
      className="relative w-full py-16 sm:py-24 overflow-hidden"
      style={{ background: surface.background, color: ink, fontFamily: BODY }}
    >
      {surface.isDark && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(50% 42% at 80% 0%, color-mix(in srgb, ${accentBase} 12%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="container relative z-10 mx-auto px-6 md:px-10 max-w-7xl">
        {/* ── Header rail. ── */}
        <Reveal disabled={isBuilder} className="flex flex-col md:flex-row md:items-end justify-between mb-10 sm:mb-12 gap-6">
          <div className="max-w-2xl">
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
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="font-bold tracking-tight leading-[1.05] mb-3"
              style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(1.75rem, 3.6vw, 2.75rem)" }} />
            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
                className="text-base sm:text-lg leading-relaxed"
                style={{ color: muted }} />
            )}
          </div>
          {cta && <div className="shrink-0 hidden md:block pb-1">{cta}</div>}
        </Reveal>

        {/* ── Tight curated wall. ── */}
        <RevealStagger disabled={isBuilder} stagger={0.06} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {videos.map((vid, i) => {
            const hasVideo = !!(vid.videoUrl && vid.videoUrl.trim() !== "");
            return (
              <RevealItem key={vid.id ?? i} disabled={isBuilder} className="group flex flex-col">
                <div
                  className={`relative w-full aspect-video rounded-2xl overflow-hidden ${reduced ? "" : "transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-xl"}`}
                  style={{
                    boxShadow: surface.isDark
                      ? "0 10px 28px -16px rgba(0,0,0,0.65)"
                      : "0 8px 22px -14px rgba(15,23,42,0.16)",
                  }}
                >
                  <InlineImage
                    src={vid.posterUrl}
                    alt={vid.title || "Video thumbnail"}
                    onUpdate={onFieldChange ? (src: string) => updateVideo(i, { posterUrl: src }) : undefined}
                    className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 group-hover:scale-[1.04]"}`}
                    wrapperClassName="block absolute inset-0 w-full h-full"
                  />
                  {/* Bottom scrim keeps the chips legible on any poster. */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
                    aria-hidden="true"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}
                  />
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    aria-hidden="true"
                    style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
                  />

                  {/* Glass duration chip. */}
                  {vid.duration && (
                    <span className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-semibold tabular-nums backdrop-blur-sm">
                      {vid.duration}
                    </span>
                  )}

                  {/* Always-visible play affordance (keyboard + touch friendly). */}
                  {(hasVideo || isBuilder) && (
                    <button
                      type="button"
                      onClick={() => hasVideo && setOpenIdx(i)}
                      aria-label={vid.title ? `Play video: ${vid.title}` : "Play video"}
                      className={`absolute inset-0 ${focusRing}`}
                      style={{ cursor: hasVideo ? "pointer" : "default", outlineColor: playBg }}
                    >
                      <span
                        className={`absolute bottom-3 left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${reduced ? "" : "transition-transform duration-300 group-hover:scale-110"}`}
                        style={{ backgroundColor: playBg, color: onPlay }}
                        aria-hidden="true"
                      >
                        <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
                      </span>
                    </button>
                  )}
                </div>

                {/* Index + title, library-style. */}
                <div className="flex items-baseline gap-3 mt-3.5 px-0.5">
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.18em]"
                    style={{ color: muted, fontVariantNumeric: "tabular-nums" }}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <InlineText
                    as="h3"
                    value={vid.title}
                    onUpdate={onFieldChange ? (v: string) => updateVideo(i, { title: v }) : undefined}
                    className="text-base sm:text-lg font-semibold leading-snug"
                    style={{ color: ink, fontFamily: DISPLAY }} />
                </div>
              </RevealItem>
            );
          })}
        </RevealStagger>

        {/* Mobile CTA */}
        {cta && <div className="mt-10 md:hidden flex justify-start">{cta}</div>}
      </div>

      <VideoModal
        open={openIdx !== null && !!(activeVideo?.videoUrl && activeVideo.videoUrl.trim() !== "")}
        onClose={() => setOpenIdx(null)}
        videoUrl={activeVideo?.videoUrl}
        posterUrl={activeVideo?.posterUrl}
        ariaLabel={activeVideo?.title || "Video"}
      />
    </section>
  );
}
