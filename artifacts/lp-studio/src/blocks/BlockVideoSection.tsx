import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoSectionBlockProps } from "@/lib/block-types";
import { getButtonClasses, type BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";

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
    return (
      <div className={cn("w-full", bgClass)}>
        {isNativeVideo ? (
          <video
            src={props.videoUrl}
            className="w-full block"
            style={{ display: "block" }}
            controls
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
      </div>
    );
  }

  const videoElement = (
    <div className={cn("relative w-full rounded-xl overflow-hidden", aspectClass)}>
      {hasVideo ? (
        isNativeVideo ? (
          <video
            src={props.videoUrl}
            className="w-full h-full object-cover"
            controls
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
          "text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4 leading-tight",
          isDark ? "text-white" : "text-[#003A30]"
        )}>
          {props.headline}
        </h2>
      )}
      {props.subheadline && (
        <p className={cn(
          "text-lg md:text-xl leading-relaxed mb-6",
          isDark ? "text-white/70" : "text-[#003A30]/70"
        )}>
          {props.subheadline}
        </p>
      )}
      {props.ctaText && (
        <button
          onClick={onCtaClick}
          className={getButtonClasses(brand, "inline-flex items-center justify-center")}
          style={{ backgroundColor: LIME, color: FOREST }}
        >
          {props.ctaText}
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
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
                "text-3xl md:text-5xl font-display font-bold mb-4",
                isDark ? "text-white" : "text-[#003A30]"
              )}>
                {props.headline}
              </h2>
            )}
            {props.subheadline && (
              <p className={cn(
                "text-lg md:text-xl leading-relaxed",
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
            <button
              onClick={onCtaClick}
              className={getButtonClasses(brand, "inline-flex items-center justify-center")}
              style={{ backgroundColor: LIME, color: FOREST }}
            >
              {props.ctaText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
