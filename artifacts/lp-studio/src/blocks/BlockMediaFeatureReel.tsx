import { useState } from "react";
import * as LucideIcons from "lucide-react";
import { Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaFeatureReelBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, RevealStagger, RevealItem } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Media Feature Reel — showreel player with a numbered chapter strip.
 *
 * A wide glass-chromed player frame (rounded-2xl, low-alpha ring, layered
 * shadow, optional faux address-bar label) holds the poster + contrast-safe
 * play affordance; below it the feature captions run as numbered "chapters"
 * (01 / 02 / 03) divided by hairlines — horizontal momentum rather than a
 * uniform icon grid. Clicking play opens the lightbox; the play control only
 * renders when a video exists (the bad-data guard is preserved).
 * -------------------------------------------------------------------------- */

interface Props {
  props: MediaFeatureReelBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaFeatureReelBlockProps) => void;
}

export function BlockMediaFeatureReel({ props, brand, onFieldChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;

  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const accent = pickContrastingColor(accentBase, surface.base, [brand.primaryColor], 3.0);
  // The play button floats over the poster's dark scrim — resolve against a
  // generic dark surface, not the section background.
  const playBg = pickContrastingColor(accentBase, "#0a0a0a", [brand.primaryColor, "#FFFFFF"], 3.0);
  const onPlay = pickContrastingColor(undefined, playBg, ["#FFFFFF", "#0F172A"]);
  const numberColor = pickContrastingColor(
    accentBase,
    surface.base,
    [brand.primaryColor, surface.isDark ? "#E2E8F0" : "#0f172a"],
    4.5,
  );
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const hairline = surface.isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

  const features = props.features ?? [];
  const hasVideo = !!(props.videoUrl && props.videoUrl.trim() !== "");

  const update = <K extends keyof MediaFeatureReelBlockProps>(
    key: K,
    value: MediaFeatureReelBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateFeature = (i: number, patch: Partial<MediaFeatureReelBlockProps["features"][number]>) => {
    if (!onFieldChange) return;
    const next = features.map((feat, idx) => (idx === i ? { ...feat, ...patch } : feat));
    onFieldChange({ ...props, features: next });
  };

  const chromeBg = surface.isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF";

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
            background: `radial-gradient(60% 50% at 50% 20%, color-mix(in srgb, ${accentBase} 14%, transparent) 0%, transparent 72%)`,
          }}
        />
      )}

      <div className="container relative z-10 mx-auto px-6 md:px-10 max-w-6xl">
        {/* ── Heading: left-set with measured width. ── */}
        <Reveal disabled={isBuilder} className="max-w-3xl mb-10 sm:mb-14">
          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
            className="font-bold tracking-tight leading-[1.05]"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }} />
        </Reveal>

        {/* ── Glass-chromed player frame. ── */}
        <Reveal disabled={isBuilder} delay={0.08}>
          <div
            className="relative rounded-2xl overflow-hidden border"
            style={{
              backgroundColor: chromeBg,
              borderColor: hairline,
              boxShadow: surface.isDark
                ? "0 1px 0 rgba(255,255,255,0.05) inset, 0 32px 64px -24px rgba(0,0,0,0.8)"
                : "0 1px 2px rgba(15,23,42,0.05), 0 28px 60px -24px rgba(15,23,42,0.22)",
            }}
          >
            {/* Chrome bar. */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: hairline }}>
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FF5F57" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FEBC2E" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28C840" }} />
              </span>
              <span
                className="flex-1 max-w-xs mx-auto text-center text-[11px] truncate rounded-md px-3 py-1"
                style={{
                  color: muted,
                  backgroundColor: surface.isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
                }}
              >
                <InlineText
                  as="span"
                  value={props.frameLabel ?? ""}
                  onUpdate={onFieldChange ? (v: string) => update("frameLabel", v) : undefined}
                />
              </span>
              <span className="w-12" aria-hidden="true" />
            </div>

            {/* Poster + play. */}
            <div className="group relative aspect-video w-full overflow-hidden bg-black/20">
              <InlineImage
                src={props.posterUrl}
                alt={props.heading || "Feature reel poster"}
                onUpdate={onFieldChange ? (src: string) => update("posterUrl", src) : undefined}
                className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 group-hover:scale-[1.03]"}`}
                wrapperClassName="block absolute inset-0 w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" aria-hidden="true" />
              {(hasVideo || isBuilder) && (
                <button
                  type="button"
                  onClick={() => hasVideo && setModalOpen(true)}
                  aria-label="Play video"
                  className={`absolute inset-0 flex items-center justify-center ${focusRing}`}
                  style={{ cursor: hasVideo ? "pointer" : "default", outlineColor: playBg }}
                >
                  <span
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center backdrop-blur-md ${reduced ? "" : "transition-transform duration-300 group-hover:scale-105"}`}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${playBg} 92%, transparent)`,
                      color: onPlay,
                      boxShadow: `0 0 0 8px color-mix(in srgb, ${playBg} 18%, transparent), 0 18px 40px -10px rgba(0,0,0,0.5)`,
                    }}
                  >
                    <Play className="h-7 w-7 sm:h-8 sm:w-8 ml-1" fill="currentColor" aria-hidden="true" />
                  </span>
                </button>
              )}
            </div>
          </div>
        </Reveal>

        {/* ── Numbered chapter strip. ── */}
        {features.length > 0 && (
          <RevealStagger
            disabled={isBuilder}
            stagger={0.08}
            className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 border-t"
            style={{ borderColor: hairline }}
          >
            {features.map((feat, i) => (
              <RevealItem
                key={i}
                disabled={isBuilder}
                className="relative flex flex-col items-start text-left py-6 md:py-8 pr-6 md:px-6 md:first:pl-0 border-b md:border-b-0 last:border-b-0"
                style={{ borderColor: hairline }}
              >
                {/* Hairline divider between chapters on md+. */}
                {i > 0 && (
                  <span
                    className="hidden md:block absolute left-0 top-6 bottom-6 w-px"
                    aria-hidden="true"
                    style={{ backgroundColor: hairline }}
                  />
                )}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-xs font-semibold tabular-nums tracking-[0.2em]"
                    style={{ color: numberColor, fontVariantNumeric: "tabular-nums" }}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`,
                      color: accent,
                    }}
                    aria-hidden="true"
                  >
                    <IconOrImage value={feat.icon} fallback={LucideIcons.Sparkles} className="w-4 h-4" />
                  </span>
                </div>
                <InlineText
                  as="h3"
                  value={feat.title}
                  onUpdate={onFieldChange ? (v: string) => updateFeature(i, { title: v }) : undefined}
                  className="text-base sm:text-lg font-semibold leading-snug mb-1.5"
                  style={{ color: ink, fontFamily: DISPLAY }} />
                <InlineText
                  as="p"
                  value={feat.desc}
                  onUpdate={onFieldChange ? (v: string) => updateFeature(i, { desc: v }) : undefined}
                  className="text-sm leading-relaxed"
                  style={{ color: muted }} />
              </RevealItem>
            ))}
          </RevealStagger>
        )}

        {(props.ctaLabel || props.ctaSecondaryLabel || onFieldChange) && (
          <div className="flex flex-wrap items-center gap-x-7 gap-y-4 mt-10 sm:mt-12">
            {(props.ctaLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaUrl}
                brand={brand}
                source="media-feature-reel-cta"
                className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold ${focusRing} ${reduced ? "" : "transition-transform duration-300 hover:-translate-y-0.5"}`}
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
              >
                {props.ctaLabel || "Watch the reel"}
              </CtaButton>
            )}
            {(props.ctaSecondaryLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaSecondaryUrl}
                brand={brand}
                source="media-feature-reel-cta-secondary"
                className={`inline-flex items-center justify-center gap-2 text-base font-semibold underline-offset-4 hover:underline ${focusRing}`}
                style={{ backgroundColor: "transparent", color: numberColor, fontFamily: BODY, outlineColor: accent }}
              >
                {props.ctaSecondaryLabel || "Read the docs"}
              </CtaButton>
            )}
          </div>
        )}
      </div>

      <VideoModal
        open={modalOpen && hasVideo}
        onClose={() => setModalOpen(false)}
        videoUrl={props.videoUrl}
        posterUrl={props.posterUrl}
        ariaLabel={props.heading || "Video"}
      />
    </section>
  );
}
