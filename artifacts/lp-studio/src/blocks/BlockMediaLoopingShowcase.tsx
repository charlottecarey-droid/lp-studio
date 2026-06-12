import { useState } from "react";
import { Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaLoopingShowcaseBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal, NoiseOverlay } from "@/lib/premium-toolkit";

/* ----------------------------------------------------------------------------
 * Media Looping Showcase — ambient full-bleed film section.
 *
 * A full-bleed, slow-burning background video (autoplay / muted / loop; the
 * poster image is shown instead under prefers-reduced-motion — same
 * convention as BlockCinematicVideoHero) with the copy set low-left like a
 * film title card: small caps kicker rule, oversized display heading, and a
 * glass "watch" affordance beside the CTA. Bad-data guards preserved: only
 * native video files render in the background, and the play control only
 * appears when a video URL exists.
 * -------------------------------------------------------------------------- */

interface Props {
  props: MediaLoopingShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaLoopingShowcaseBlockProps) => void;
}

const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
function isNativeVideo(url: string) {
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTS.some(ext => lower.endsWith(ext));
}

export function BlockMediaLoopingShowcase({ props, brand, onFieldChange }: Props) {
  const isBuilder = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const [modalOpen, setModalOpen] = useState(false);

  const surface = resolveSectionSurface(props, "#000000");
  const ink = props.textColor ?? surface.color ?? "#FFFFFF";
  const accentBase = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#4f46e5";
  // Copy sits over a dark scrim regardless of the section surface, so the
  // muted + accent tones resolve against a generic dark base.
  const muted = props.mutedColor ?? `color-mix(in srgb, ${ink} 68%, transparent)`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const accent = pickContrastingColor(accentBase, "#0a0a0a", [brand.primaryColor, "#FFFFFF"], 3.0);
  const kicker = pickContrastingColor(accentBase, "#0a0a0a", [brand.primaryColor, "#E2E8F0", "#FFFFFF"], 4.5);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

  const hasVideo = !!(props.videoUrl && props.videoUrl.trim() !== "");
  const nativeBg = hasVideo && isNativeVideo(props.videoUrl);
  // prefers-reduced-motion: never autoplay the ambient loop — hold on the
  // poster instead (BlockCinematicVideoHero convention).
  const playAmbient = nativeBg && !reduced;

  const update = <K extends keyof MediaLoopingShowcaseBlockProps>(
    key: K,
    value: MediaLoopingShowcaseBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  return (
    <section
      className="relative w-full min-h-[560px] sm:min-h-[720px] lg:min-h-[88vh] flex items-end overflow-hidden"
      style={{ background: surface.background }}
    >
      {/* ── Ambient background: video (or poster under reduced motion). ── */}
      <div className="absolute inset-0 w-full h-full overflow-hidden" aria-hidden="true">
        {playAmbient ? (
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-70"
            poster={props.posterUrl || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={props.videoUrl} type="video/mp4" />
          </video>
        ) : props.posterUrl ? (
          <img
            src={props.posterUrl}
            alt={props.heading || "Showcase background"}
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
        ) : null}

        {/* Title-card scrims: heavier toward the lower-left where the copy sits. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/30" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(100deg, rgba(0,0,0,0.55) 0%, transparent 55%)" }}
        />
        <div
          className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{ background: `radial-gradient(70% 60% at 20% 90%, ${accentBase} 0%, transparent 65%)` }}
        />
        <NoiseOverlay opacity={0.05} />
      </div>

      {/* ── Title-card copy, set low-left. ── */}
      <Reveal
        disabled={isBuilder}
        className="relative z-10 container mx-auto px-6 md:px-12 max-w-7xl pb-16 sm:pb-20 pt-28 sm:pt-40"
      >
        <div className="max-w-3xl flex flex-col items-start text-left">
          {/* Kicker rule — a quiet accent mark above the title card. */}
          <span className="block h-px w-12 mb-6" style={{ backgroundColor: kicker }} aria-hidden="true" />

          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
            className="font-bold tracking-tight leading-[1.02] mb-5 text-balance"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2.5rem, 6.5vw, 4.75rem)" }} />

          {(props.subheading || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheading ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
              className="text-base sm:text-lg md:text-xl leading-relaxed mb-9 max-w-2xl"
              style={{ color: muted, fontFamily: BODY }} />
          )}

          <div className="flex flex-wrap items-center gap-4">
            {(hasVideo || isBuilder) && (
              <button
                type="button"
                onClick={() => hasVideo && setModalOpen(true)}
                aria-label="Play video"
                className={`inline-flex items-center justify-center w-14 h-14 rounded-full border backdrop-blur-md ${focusRing} ${reduced ? "" : "transition-all duration-300 hover:bg-white/10 hover:scale-105"}`}
                style={{
                  borderColor: "rgba(255,255,255,0.28)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: ink,
                  cursor: hasVideo ? "pointer" : "default",
                  outlineColor: accent,
                }}
              >
                <Play className="h-5 w-5 ml-0.5" fill="currentColor" aria-hidden="true" />
              </button>
            )}

            {(props.ctaLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaUrl}
                brand={brand}
                source="media-looping-showcase-cta"
                className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold ${focusRing} ${reduced ? "" : "transition-transform duration-300 hover:-translate-y-0.5"}`}
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
              >
                {props.ctaLabel || "Watch full film"}
              </CtaButton>
            )}
          </div>
        </div>
      </Reveal>

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
