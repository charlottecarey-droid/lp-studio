import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { VideoSectionBlockProps } from "@/lib/block-types";
import { getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, type BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import { MuteToggleButton } from "@/components/MuteToggleButton";
import { ChiliPiperModal } from "./ChiliPiperModal";
import { safeNavigate } from "@/lib/safe-url";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

function toAutoEmbedUrl(url: string, autoplay: boolean, loop = false): string {
  if (!url || !autoplay) return url;
  try {
    // YouTube: convert watch?v= or youtu.be/ to embed if needed, then add params
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
      const id = ytMatch[1];
      const params = new URLSearchParams({ autoplay: "1", mute: "1", rel: "0" });
      if (loop) { params.set("loop", "1"); params.set("playlist", id); }
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }
    // Vimeo
    const vimeoMatch = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
    if (vimeoMatch) {
      const id = vimeoMatch[1];
      const params = new URLSearchParams({ autoplay: "1", muted: "1", background: loop ? "1" : "0" });
      if (loop) params.set("loop", "1");
      return `https://player.vimeo.com/video/${id}?${params.toString()}`;
    }
    // Already an embed URL — just append params
    const u = new URL(url);
    u.searchParams.set("autoplay", "1");
    u.searchParams.set("mute", "1");
    if (loop) { u.searchParams.set("loop", "1"); }
    return u.toString();
  } catch {
    return url;
  }
}

interface Props {
  props: VideoSectionBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}

const ASPECT_CLASSES: Record<string, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
};

const BG_CLASSES: Record<string, string> = {
  white: "bg-white text-slate-900",
  dark: "bg-[#003A30] text-white",
  "light-gray": "bg-slate-50 text-slate-900",
  muted: "bg-[hsl(42,18%,96%)] text-slate-900",
  "dandy-green": "bg-[#003A30] text-white",
  black: "bg-black text-white",
};

export function BlockVideoSection({ props, brand, onCtaClick, pageId, variantId, sessionId }: Props) {
  const [cpOpen, setCpOpen] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) return;
    el.muted = true;
  }, []);

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setVideoMuted(el.muted);
  };

  const isChiliPiper = props.ctaAction === "chilipiper" && !!props.chilipiperUrl;

  const handleCtaClick = () => {
    onCtaClick?.();
    if (isChiliPiper) {
      setCpOpen(true);
    } else if (props.ctaUrl) {
      safeNavigate(props.ctaUrl, "_blank");
    }
  };
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const bgClass = BG_CLASSES[props.backgroundStyle] ?? BG_CLASSES.white;
  const aspectClass = ASPECT_CLASSES[props.aspectRatio] ?? ASPECT_CLASSES["16/9"];
  const isDark = isDarkBg(props.backgroundStyle);
  const bgGradientStyle = props.backgroundStyle === "gradient" ? getBgStyle("gradient") : undefined;
  const layout = props.layout ?? "full-width";
  const isSplit = layout === "split-left" || layout === "split-right";
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;

  const hasVideo = props.videoUrl && props.videoUrl.trim() !== "";
  const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
  const isNativeVideo = hasVideo && VIDEO_EXTS.some(ext => props.videoUrl.toLowerCase().split("?")[0].endsWith(ext));
  const fillContainer = props.fillContainer ?? false;

  if (fillContainer && hasVideo) {
    const hasOverlay = !!(props.overlayHeadline || props.overlaySubheadline || props.overlayCtaText);
    const vAlign = props.overlayVAlign ?? "center";
    const hAlign = props.overlayHAlign ?? "center";
    const textLight = props.overlayTextLight ?? true;

    const VALIGN_CLASS: Record<string, string> = {
      top: "items-start",
      center: "items-center",
      bottom: "items-end",
    };
    const HALIGN_CLASS: Record<string, string> = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    };
    const INNER_HALIGN: Record<string, string> = {
      left: "items-start",
      center: "items-center",
      right: "items-end",
    };

    return (
      <div className={cn("w-full relative", bgClass)}>
        {isNativeVideo ? (
          <>
            <video
              ref={attachVideo}
              src={props.videoUrl}
              className="w-full block"
              style={{ display: "block" }}
              autoPlay={props.videoAutoplay ?? true}
              muted
              loop={props.videoAutoplay ?? true}
              playsInline
              controls={!hasOverlay && !(props.videoAutoplay ?? true)}
              preload="metadata"
            />
            {(hasOverlay || (props.videoAutoplay ?? true)) && (
              <MuteToggleButton muted={videoMuted} onClick={toggleVideoMute} className="absolute bottom-4 right-4 z-20" />
            )}
          </>
        ) : (
          <div className="relative w-full aspect-video">
            <iframe
              src={toAutoEmbedUrl(props.videoUrl, props.videoAutoplay ?? true, true)}
              className="absolute inset-0 w-full h-full border-0"
              title="Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {hasOverlay && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col p-5 sm:p-8 md:p-12 gap-4",
              VALIGN_CLASS[vAlign],
              INNER_HALIGN[hAlign]
            )}
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 100%)" }}
          >
            <div className={cn("max-w-3xl flex flex-col gap-3", INNER_HALIGN[hAlign], HALIGN_CLASS[hAlign])}>
              {props.overlayHeadline && (
                <h2
                  className={cn("text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight", getHeadingWeightClass(brand))}
                  style={{ color: textLight ? "#ffffff" : FOREST }}
                >
                  {props.overlayHeadline}
                </h2>
              )}
              {props.overlaySubheadline && (
                <p
                  className="text-sm sm:text-base md:text-lg font-medium"
                  style={{ color: textLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)" }}
                >
                  {props.overlaySubheadline}
                </p>
              )}
              {props.overlayCtaText && (
                <motion.a
                  href={props.overlayCtaUrl ?? "#"}
                  className="inline-block mt-2 px-5 sm:px-7 py-2.5 sm:py-3 rounded-full font-bold text-sm"
                  style={{ backgroundColor: LIME, color: FOREST }}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                >
                  {props.overlayCtaText}
                </motion.a>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const autoplay = props.videoAutoplay ?? false;

  const videoElement = (
    <div className={cn("relative w-full rounded-xl overflow-hidden", aspectClass)}>
      {hasVideo ? (
        isNativeVideo ? (
          <>
            <video
              ref={attachVideo}
              src={props.videoUrl}
              className="w-full h-full object-cover"
              autoPlay={autoplay}
              muted
              loop={autoplay}
              playsInline
              controls={!autoplay}
              preload="metadata"
            />
            {autoplay && <MuteToggleButton muted={videoMuted} onClick={toggleVideoMute} className="absolute bottom-3 right-3 z-10" />}
          </>
        ) : (
          <iframe
            src={toAutoEmbedUrl(props.videoUrl, autoplay, autoplay)}
            className="w-full h-full border-0"
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            <p className="text-sm font-medium">Add a video URL in the property panel</p>
          </div>
        </div>
      )}
    </div>
  );

  const textElement = (
    <div className={cn(
      "flex flex-col justify-center",
      layout === "split-right" ? "text-left" : "text-right items-end"
    )}>
      {props.headline && (
        <h2 className={cn(
          getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"),
          "font-display mb-4 leading-tight",
          getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand),
          isDark ? "text-white" : "text-[#003A30]"
        )}>
          {props.headline}
        </h2>
      )}
      {props.subheadline && (
        <p className={cn(
          getBodySizeClass(brand), "leading-relaxed mb-6",
          isDark ? "text-white/70" : "text-[#003A30]/70"
        )}>
          {props.subheadline}
        </p>
      )}
      {props.ctaText && (
        <motion.button
          onClick={handleCtaClick}
          className={getButtonClasses(brand, "inline-flex items-center justify-center")}
          style={{ backgroundColor: LIME, color: FOREST }}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
        >
          {props.ctaText}
          <ArrowRight className="w-4 h-4 ml-2" />
        </motion.button>
      )}
    </div>
  );

  const modal = cpOpen && props.chilipiperUrl ? (
    <ChiliPiperModal
      url={props.chilipiperUrl}
      pageId={pageId}
      variantId={variantId}
      sessionId={sessionId}
      onClose={() => setCpOpen(false)}
    />
  ) : null;

  if (isSplit) {
    return (
      <>
        <section className={cn("w-full px-6 md:px-10", bgClass, sectionPy)} style={bgGradientStyle}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {layout === "split-left" ? (
                <>
                  {videoElement}
                  {textElement}
                </>
              ) : (
                <>
                  {textElement}
                  {videoElement}
                </>
              )}
            </div>
          </div>
        </section>
        {modal}
      </>
    );
  }

  return (
    <>
      <section className={cn("w-full px-6 md:px-10", bgClass, sectionPy)} style={bgGradientStyle}>
        <div className="max-w-5xl mx-auto">
          {(props.headline || props.subheadline) && (
            <div className="text-center max-w-3xl mx-auto mb-10">
              {props.headline && (
                <h2 className={cn(
                  getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"),
                  "font-display mb-4",
                  getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand),
                  isDark ? "text-white" : "text-[#003A30]"
                )}>
                  {props.headline}
                </h2>
              )}
              {props.subheadline && (
                <p className={cn(
                  getBodySizeClass(brand), "leading-relaxed",
                  isDark ? "text-white/70" : "text-[#003A30]/70"
                )}>
                  {props.subheadline}
                </p>
              )}
            </div>
          )}
          {videoElement}
          {props.ctaText && (
            <div className="text-center mt-8">
              <motion.button
                onClick={handleCtaClick}
                className={getButtonClasses(brand, "inline-flex items-center justify-center")}
                style={{ backgroundColor: LIME, color: FOREST }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
              >
                {props.ctaText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </motion.button>
            </div>
          )}
        </div>
      </section>
      {modal}
    </>
  );
}
