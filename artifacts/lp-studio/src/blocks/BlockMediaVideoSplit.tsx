import { useState } from "react";
import { Play, CheckCircle2 } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaVideoSplitBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: MediaVideoSplitBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaVideoSplitBlockProps) => void;
}

export function BlockMediaVideoSplit({ props, brand, onFieldChange }: Props) {
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
    <section className="w-full py-24 sm:py-32 overflow-hidden" style={{ backgroundColor: bg, color: ink }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Content Side */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
                className="text-sm font-bold uppercase tracking-[0.18em] mb-6 block"
                style={{ color: accent, fontFamily: BODY }} />
            )}

            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6"
              style={{ color: ink, fontFamily: DISPLAY }} />

            {(props.description || onFieldChange) && (
              <InlineText
                as="p"
                value={props.description ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("description", v) : undefined}
                className="text-lg md:text-xl leading-relaxed mb-8"
                style={{ color: muted, fontFamily: BODY }} />
            )}

            {features.length > 0 && (
              <ul className="flex flex-col gap-4 mb-10">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 mt-0.5" style={{ color: accent }} />
                    <InlineText
                      as="span"
                      value={feature}
                      onUpdate={onFieldChange ? (v: string) => updateFeature(i, v) : undefined}
                      className="text-base font-medium"
                      style={{ color: ink, fontFamily: BODY }} />
                  </li>
                ))}
              </ul>
            )}

            {(props.ctaLabel || props.ctaSecondaryLabel || onFieldChange) && (
              <div className="mt-2 flex flex-wrap items-center gap-6">
                {(props.ctaLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaUrl}
                    brand={brand}
                    source="media-video-split-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
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
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold underline-offset-4 hover:underline"
                    style={{ backgroundColor: "transparent", color: accent, fontFamily: BODY }}
                  >
                    {props.ctaSecondaryLabel || "Learn more"}
                  </CtaButton>
                )}
              </div>
            )}
          </div>

          {/* Video Side */}
          <div className="relative order-1 lg:order-2 w-full aspect-video rounded-3xl overflow-hidden shadow-2xl group">
            <InlineImage
              src={props.posterUrl}
              alt={props.heading || "Video thumbnail"}
              onUpdate={onFieldChange ? (src: string) => update("posterUrl", src) : undefined}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              wrapperClassName="block absolute inset-0 w-full h-full"
            />

            {/* Scrim */}
            <div className="absolute inset-0 bg-black/30 transition-opacity duration-300 group-hover:bg-black/40 pointer-events-none" />

            {/* Play Button */}
            <button
              type="button"
              onClick={() => hasVideo && setModalOpen(true)}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center"
              style={{ cursor: hasVideo ? "pointer" : "default" }}
            >
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center backdrop-blur-md shadow-xl transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accent}E6`, color: onAccent }}
              >
                <Play className="h-8 w-8 sm:h-10 sm:w-10 ml-2" fill="currentColor" />
              </div>
            </button>
          </div>
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
