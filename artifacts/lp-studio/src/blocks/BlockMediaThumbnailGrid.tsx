import { useState } from "react";
import { Play } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MediaThumbnailGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: MediaThumbnailGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MediaThumbnailGridBlockProps) => void;
}

export function BlockMediaThumbnailGrid({ props, brand, onFieldChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const surface = resolveSectionSurface(props, "#F8FAFC");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);

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

  return (
    <section className="w-full py-24 sm:py-32" style={{ background: surface.background, color: ink }}>
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div className="max-w-2xl">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
                className="text-sm font-bold uppercase tracking-[0.18em] mb-4 block"
                style={{ color: accent, fontFamily: BODY }} />
            )}
            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v: string) => update("heading", v) : undefined}
              className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
              style={{ color: ink, fontFamily: DISPLAY }} />
            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v: string) => update("subheading", v) : undefined}
                className="text-lg"
                style={{ color: muted, fontFamily: BODY }} />
            )}
          </div>

          {(props.ctaLabel || onFieldChange) && (
            <div className="shrink-0 hidden md:block">
              <CtaButton
                ctaAction="url"
                ctaUrl={props.ctaUrl}
                brand={brand}
                source="media-thumbnail-grid-cta"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold underline-offset-4 hover:underline"
                style={{ backgroundColor: "transparent", color: accent, fontFamily: BODY }}
              >
                {props.ctaLabel || "Browse all videos"}
              </CtaButton>
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map((vid, i) => {
            const hasVideo = !!(vid.videoUrl && vid.videoUrl.trim() !== "");
            return (
              <div key={vid.id ?? i} className="group flex flex-col">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-5 border shadow-sm" style={{ borderColor: "#E2E8F0" }}>
                  <InlineImage
                    src={vid.posterUrl}
                    alt={vid.title || "Video thumbnail"}
                    onUpdate={onFieldChange ? (src: string) => updateVideo(i, { posterUrl: src }) : undefined}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    wrapperClassName="block absolute inset-0 w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black/20 transition-colors duration-300 group-hover:bg-black/30 pointer-events-none" />

                  {/* Duration Badge */}
                  {vid.duration && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-semibold backdrop-blur-sm">
                      {vid.duration}
                    </div>
                  )}

                  {/* Play Button */}
                  <button
                    type="button"
                    onClick={() => hasVideo && setOpenIdx(i)}
                    aria-label="Play video"
                    className="absolute inset-0 flex items-center justify-center opacity-0 scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100"
                    style={{ cursor: hasVideo ? "pointer" : "default" }}
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: accent, color: onAccent }}
                    >
                      <Play className="h-6 w-6 ml-1" fill="currentColor" />
                    </div>
                  </button>
                </div>

                <InlineText
                  as="h3"
                  value={vid.title}
                  onUpdate={onFieldChange ? (v: string) => updateVideo(i, { title: v }) : undefined}
                  className="text-xl font-semibold leading-snug transition-colors duration-200 group-hover:opacity-80"
                  style={{ color: ink, fontFamily: DISPLAY }} />
              </div>
            );
          })}
        </div>

        {/* Mobile CTA */}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-12 md:hidden flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="media-thumbnail-grid-cta-mobile"
              className="inline-flex items-center justify-center gap-2 text-base font-semibold underline-offset-4 hover:underline"
              style={{ backgroundColor: "transparent", color: accent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Browse all videos"}
            </CtaButton>
          </div>
        )}
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
