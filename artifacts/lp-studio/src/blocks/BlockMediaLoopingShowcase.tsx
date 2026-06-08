import { useState } from "react";
import { Play } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaLoopingShowcaseBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

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
  const [modalOpen, setModalOpen] = useState(false);

  const surface = resolveSectionSurface(props, "#000000");
  const ink = props.textColor ?? surface.color ?? "#FFFFFF";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const muted = props.mutedColor ?? pickContrastingColor(undefined, surface.base, ["#94A3B8", "#64748B"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);

  const hasVideo = !!(props.videoUrl && props.videoUrl.trim() !== "");
  const nativeBg = hasVideo && isNativeVideo(props.videoUrl);

  const update = <K extends keyof MediaLoopingShowcaseBlockProps>(
    key: K,
    value: MediaLoopingShowcaseBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  return (
    <section
      className="relative w-full min-h-[600px] sm:min-h-[800px] flex items-center justify-center overflow-hidden"
      style={{ background: surface.background }}
    >
      {/* Background video (autoplay / muted / loop) with poster fallback */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {nativeBg ? (
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-60"
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
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : null}

        {/* Gradients to blend text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80" />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ background: `radial-gradient(circle at center, ${accent} 0%, transparent 60%)` }}
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 container mx-auto px-6 md:px-12 flex flex-col items-center justify-center text-center max-w-4xl py-24">
        <button
          type="button"
          onClick={() => hasVideo && setModalOpen(true)}
          aria-label="Play video"
          className="mb-8 w-20 h-20 rounded-full flex items-center justify-center border-2 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/10"
          style={{ borderColor: ink, color: ink, cursor: hasVideo ? "pointer" : "default" }}
        >
          <Play className="h-8 w-8 ml-1" fill="currentColor" />
        </button>

        <InlineText
          as="h2"
          value={props.heading}
          onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6"
          style={{ color: ink, fontFamily: DISPLAY }} />

        {(props.subheading || onFieldChange) && (
          <InlineText
            as="p"
            value={props.subheading ?? ""}
            onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
            className="text-lg sm:text-xl md:text-2xl font-medium mb-10 max-w-2xl"
            style={{ color: muted, fontFamily: BODY }} />
        )}

        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-4">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="media-looping-showcase-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Watch full film"}
            </CtaButton>
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
