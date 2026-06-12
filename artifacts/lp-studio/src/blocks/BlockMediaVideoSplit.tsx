import { useState } from "react";
import { Play, Check } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaVideoSplitBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Media Video Split — editorial half-and-half.
 *
 * Asymmetric 5/7 editorial split: a copy rail (kicker rule, display heading,
 * refined check-chip feature list, CTA pair) beside a premium video frame —
 * rounded-2xl with a low-alpha ring, layered shadow and an offset accent slab
 * behind it. `mediaSide` (additive, default "right") flips the composition.
 * Poster fallback + empty-video guards preserved; the play affordance is
 * contrast-resolved and only rendered when a video exists.
 * -------------------------------------------------------------------------- */

interface Props {
  props: MediaVideoSplitBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaVideoSplitBlockProps) => void;
}

export function BlockMediaVideoSplit({ props, brand, onFieldChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;

  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const mediaLeft = props.mediaSide === "left";

  const accent = pickContrastingColor(accentBase, surface.base, [brand.primaryColor], 3.0);
  const eyebrowColor = pickContrastingColor(
    accentBase,
    surface.base,
    [brand.primaryColor, surface.isDark ? "#E2E8F0" : "#0f172a"],
    4.5,
  );
  // Play chip floats over the poster's scrim → resolve against dark.
  const playBg = pickContrastingColor(accentBase, "#0a0a0a", [brand.primaryColor, "#FFFFFF"], 3.0);
  const onPlay = pickContrastingColor(undefined, playBg, ["#FFFFFF", "#0F172A"]);
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const ringColor = surface.isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

  const features = props.features ?? [];
  const hasVideo = !!(props.videoUrl && props.videoUrl.trim() !== "");

  const update = <K extends keyof MediaVideoSplitBlockProps>(
    key: K,
    value: MediaVideoSplitBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateFeature = (i: number, value: string) => {
    if (!onFieldChange) return;
    const next = features.map((feat, idx) => (idx === i ? value : feat));
    onFieldChange({ ...props, features: next });
  };

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
            background: `radial-gradient(50% 45% at ${mediaLeft ? "15%" : "85%"} 30%, color-mix(in srgb, ${accentBase} 13%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="container relative z-10 mx-auto px-6 md:px-10 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* ── Copy rail (5 cols). ── */}
          <Reveal
            disabled={isBuilder}
            className={`flex flex-col justify-center order-2 lg:col-span-5 ${mediaLeft ? "lg:order-2" : "lg:order-1"}`}
          >
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
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="font-bold tracking-tight leading-[1.05] mb-5"
              style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4.2vw, 3.25rem)" }} />

            {(props.description || onFieldChange) && (
              <InlineText
                as="p"
                value={props.description ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("description", v) : undefined}
                className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl"
                style={{ color: muted }} />
            )}

            {features.length > 0 && (
              <ul className="flex flex-col gap-3.5 mb-9">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                        color: accent,
                      }}
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <InlineText
                      as="span"
                      value={feature}
                      onUpdate={onFieldChange ? (v: string) => updateFeature(i, v) : undefined}
                      className="text-[15px] sm:text-base font-medium leading-relaxed"
                      style={{ color: ink, fontFamily: BODY }} />
                  </li>
                ))}
              </ul>
            )}

            {(props.ctaLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
                {(props.ctaLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaUrl}
                    brand={brand}
                    source="media-video-split-cta"
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold ${focusRing} ${reduced ? "" : "transition-transform duration-300 hover:-translate-y-0.5"}`}
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
                  >
                    {props.ctaLabel || "Start your free trial"}
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="media-video-split-cta-secondary"
                    className={`inline-flex items-center justify-center gap-2 text-base font-semibold underline-offset-4 hover:underline ${focusRing}`}
                    style={{ backgroundColor: "transparent", color: eyebrowColor, fontFamily: BODY, outlineColor: accent }}
                  >
                    {props.ctaSecondaryLabel || "Learn more"}
                  </CtaButton>
                )}
              </div>
            )}
          </Reveal>

          {/* ── Video frame (7 cols) with offset accent slab. ── */}
          <Reveal
            disabled={isBuilder}
            delay={0.08}
            className={`relative order-1 lg:col-span-7 ${mediaLeft ? "lg:order-1" : "lg:order-2"}`}
          >
            {/* Offset accent slab behind the frame. */}
            <div
              className={`hidden sm:block absolute -bottom-4 w-3/5 h-2/5 rounded-2xl pointer-events-none ${mediaLeft ? "-left-4" : "-right-4"}`}
              aria-hidden="true"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` }}
            />

            <div
              className="group relative w-full aspect-video rounded-2xl overflow-hidden"
              style={{
                boxShadow: surface.isDark
                  ? "0 30px 70px -28px rgba(0,0,0,0.85)"
                  : "0 28px 60px -24px rgba(15,23,42,0.28)",
              }}
            >
              <InlineImage
                src={props.posterUrl}
                alt={props.heading || "Video thumbnail"}
                onUpdate={onFieldChange ? (src: string) => update("posterUrl", src) : undefined}
                className={`absolute inset-0 w-full h-full object-cover ${reduced ? "" : "transition-transform duration-700 group-hover:scale-[1.03]"}`}
                wrapperClassName="block absolute inset-0 w-full h-full"
              />

              {/* Scrim + ring. */}
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
                aria-hidden="true"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }}
              />
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                aria-hidden="true"
                style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
              />

              {/* Play affordance — only when a video exists (guard preserved). */}
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
                    aria-hidden="true"
                  >
                    <Play className="h-7 w-7 sm:h-8 sm:w-8 ml-1" fill="currentColor" />
                  </span>
                </button>
              )}
            </div>
          </Reveal>
        </div>
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
