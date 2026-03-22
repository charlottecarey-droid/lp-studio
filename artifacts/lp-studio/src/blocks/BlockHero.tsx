import { ArrowRight, ShieldCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses, type BrandConfig } from "@/lib/brand-config";
import type { HeroBlockProps } from "@/lib/block-types";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

const DEFAULT_IMAGE = "/dandy-platform.webp";

interface Props {
  props: HeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

export function BlockHero({ props, brand, onCtaClick }: Props) {
  const LIME = props.ctaColor || brand.accentColor;
  const FOREST = brand.primaryColor;
  const isDark = props.backgroundStyle === "dark";
  const isMinimal = props.layout === "minimal";
  const isSplit = props.layout === "split" || props.layout === "split-right";
  const isSplitRight = props.layout === "split-right";

  const resolvedImage = props.imageUrl && props.imageUrl.trim() !== "" ? props.imageUrl : DEFAULT_IMAGE;
  const resolvedMedia = props.mediaUrl && props.mediaUrl.trim() !== "" ? props.mediaUrl : "";

  const renderMedia = () => {
    if (props.heroType === "none") return null;

    if (props.heroType === "dandy-video" || (props.heroType === "static-image" && resolvedMedia)) {
      const videoSrc = resolvedMedia || "";
      if (!videoSrc) return renderImage();
      return (
        <div className="relative w-full aspect-[16/9] z-10 rounded-xl overflow-hidden shadow-2xl">
          <iframe src={videoSrc} className="w-full h-full border-0" title="Demo Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    }

    return renderImage();
  };

  const renderImage = () => (
    <div className="relative w-full z-10">
      <img
        src={resolvedImage}
        alt="Product showcase"
        className="w-full h-auto object-contain rounded-xl shadow-2xl"
        loading="lazy"
      />
    </div>
  );

  const textContent = (
    <div className={cn(
      "space-y-8 z-10",
      !isSplit && "max-w-4xl mx-auto flex flex-col items-center",
      isSplitRight && "text-right flex flex-col items-end"
    )}>
      <h1 className={cn(
        "font-display font-bold tracking-tight leading-[1.05]",
        isMinimal ? "text-5xl md:text-6xl lg:text-7xl" : "text-4xl md:text-6xl lg:text-7xl",
        isDark ? "text-white" : "text-[#003A30]"
      )}>
        {props.headline}
      </h1>
      {props.subheadline && (
        <p className={cn(
          "text-lg md:text-xl leading-relaxed font-sans",
          isDark ? "text-white/80" : "text-[#003A30]/70",
          !isSplit && "max-w-2xl"
        )}>
          {props.subheadline}
        </p>
      )}
      <div className={cn(
        "flex flex-col gap-4 w-full sm:w-auto pt-2",
        !isSplit && "items-center",
        isSplitRight && "items-end"
      )}>
        <button
          onClick={onCtaClick}
          className={getButtonClasses(brand, "inline-flex items-center justify-center")}
          style={{ backgroundColor: LIME, color: FOREST }}
        >
          {props.ctaText}
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
        {props.showSocialProof && (
          <div className={cn(
            "flex items-center gap-2 text-sm font-medium opacity-80",
            !isSplit && "justify-center"
          )}>
            <ShieldCheck className="w-4 h-4" />
            <span>{props.socialProofText}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn(
      "w-full font-sans selection:bg-[#C7E738] selection:text-[#003A30]",
      isDark ? "bg-[#003A30] text-white" : "bg-white text-slate-900"
    )}>
      <div className="min-h-[70vh] flex flex-col">
        <nav className="w-full px-6 pt-1 pb-[7px] flex items-center justify-between z-40 relative" style={{ backgroundColor: brand.navBgColor }}>
          <img src={dandyLogoUrl} alt="Dandy" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          <a
            href={brand.navCtaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={getButtonClasses(brand)}
            style={{ backgroundColor: LIME, color: FOREST }}
          >
            {brand.navCtaText}
          </a>
        </nav>

        <section className={cn(
          "relative w-full px-6 flex flex-col items-center justify-center flex-1 py-16 lg:py-24",
          isDark ? "bg-[#003A30]" : "bg-white"
        )}>
          {isSplit ? (
            <div className={cn(
              "max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
            )}>
              {isSplitRight ? (
                <>
                  <div className="relative">{renderMedia()}</div>
                  {textContent}
                </>
              ) : (
                <>
                  {textContent}
                  <div className="relative">{renderMedia()}</div>
                </>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto w-full flex flex-col items-center text-center">
              {textContent}
            </div>
          )}

          <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none select-none">
            <div className={cn("w-px h-6 rounded-full", isDark ? "bg-white/20" : "bg-[#003A30]/15")} />
            <div className="animate-bounce">
              <ChevronDown className={cn("w-5 h-5", isDark ? "text-white/30" : "text-[#003A30]/30")} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
