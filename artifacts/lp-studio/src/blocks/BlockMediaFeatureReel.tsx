import { useState } from "react";
import * as LucideIcons from "lucide-react";
import { Play } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaFeatureReelBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: MediaFeatureReelBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaFeatureReelBlockProps) => void;
}

export function BlockMediaFeatureReel({ props, brand, onFieldChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);

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

  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden" style={{ backgroundColor: bg, color: ink }}>
      <div className="container relative z-10 mx-auto px-6 md:px-12 max-w-6xl text-center">
        <InlineText
          as="h2"
          value={props.heading}
          onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
          className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-16 max-w-3xl mx-auto"
          style={{ color: ink, fontFamily: DISPLAY }} />

        {/* Video Card — poster image with play overlay; clicking opens the video */}
        <div className="relative mx-auto max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl mb-20 group border-4 border-white/20">
          <div className="aspect-video relative w-full overflow-hidden">
            <InlineImage
              src={props.posterUrl}
              alt={props.heading || "Feature reel poster"}
              onUpdate={onFieldChange ? (src: string) => update("posterUrl", src) : undefined}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              wrapperClassName="block absolute inset-0 w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <button
              type="button"
              onClick={() => hasVideo && setModalOpen(true)}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center"
              style={{ cursor: hasVideo ? "pointer" : "default" }}
            >
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-md transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accent}E6`, color: onAccent }}
              >
                <Play className="h-8 w-8 sm:h-10 sm:w-10 ml-2" fill="currentColor" />
              </div>
            </button>
          </div>
        </div>

        {/* Feature Captions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
          {features.map((feat, i) => {
            return (
              <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                  <IconOrImage value={feat.icon} fallback={LucideIcons.Sparkles} className="w-5 h-5" />
                </div>
                <InlineText
                  as="h3"
                  value={feat.title}
                  onUpdate={onFieldChange ? (v: string) => updateFeature(i, { title: v }) : undefined}
                  className="text-xl font-bold mb-2"
                  style={{ color: ink, fontFamily: DISPLAY }} />
                <InlineText
                  as="p"
                  value={feat.desc}
                  onUpdate={onFieldChange ? (v: string) => updateFeature(i, { desc: v }) : undefined}
                  className="text-base"
                  style={{ color: muted, fontFamily: BODY }} />
              </div>
            );
          })}
        </div>

        {(props.ctaLabel || props.ctaSecondaryLabel || onFieldChange) && (
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            {(props.ctaLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaUrl}
                brand={brand}
                source="media-feature-reel-cta"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
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
                className="inline-flex items-center justify-center gap-2 text-base font-semibold underline-offset-4 hover:underline"
                style={{ backgroundColor: "transparent", color: accent, fontFamily: BODY }}
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
