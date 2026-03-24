import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoSectionBlockProps } from "@/lib/block-types";
import { getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, type BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: VideoSectionBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
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
};

export function BlockVideoSection({ props, brand, onCtaClick }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const bgClass = BG_CLASSES[props.backgroundStyle] ?? BG_CLASSES.white;
  const aspectClass = ASPECT_CLASSES[props.aspectRatio] ?? ASPECT_CLASSES["16/9"];
  const isDark = props.backgroundStyle === "dark";
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
          <video
            src={props.videoUrl}
            className="w-full block"
            style={{ display: "block" }}
            autoPlay={props.videoAutoplay ?? true}
            muted={props.videoAutoplay ?? true}
            loop={props.videoAutoplay ?? true}
            playsInline
            controls={!hasOverlay && !(props.videoAutoplay ?? true)}
            preload="metadata"
          />
        ) : (
          <div className="relative w-full aspect-video">
            <iframe
              src={props.videoUrl}
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
          <video
            src={props.videoUrl}
            className="w-full h-full object-cover"
            autoPlay={autoplay}
            muted={autoplay}
            loop={autoplay}
            playsInline
            controls={!autoplay}
            preload="metadata"
          />
        ) : (
          <iframe
            src={props.videoUrl}
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
          onClick={onCtaClick}
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

  if (isSplit) {
    return (
      <section className={cn("w-full px-6 md:px-10", bgClass, sectionPy)}>
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
    );
  }

  return (
    <section className={cn("w-full px-6 md:px-10", bgClass, sectionPy)}>
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
              onClick={onCtaClick}
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
  );
}
