import { ArrowRight, ShieldCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, type BrandConfig } from "@/lib/brand-config";
import type { HeroBlockProps } from "@/lib/block-types";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

const DEFAULT_IMAGE = "/dandy-platform.webp";
const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  props: HeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: HeroBlockProps) => void;
  animationsEnabled?: boolean;
  contentPaddingX?: string;
}

export function BlockHero({ props, brand, onCtaClick, onFieldChange, animationsEnabled = true, contentPaddingX }: Props) {
  const LIME = props.ctaColor || brand.accentColor;
  const FOREST = brand.primaryColor;
  const CTA_TEXT_COLOR = props.ctaTextColor || FOREST;
  const isFullWidth = props.buttonWidth === "full";
  const isDark = isDarkBg(props.backgroundStyle);
  const bgExtended = ["black", "gradient", "muted", "light-gray"].includes(props.backgroundStyle ?? "")
    ? getBgStyle(props.backgroundStyle)
    : undefined;
  const isSplit = props.layout === "split" || props.layout === "split-right";
  const isSplitRight = props.layout === "split-right";

  const resolvedImage = props.imageUrl && props.imageUrl.trim() !== "" ? props.imageUrl : DEFAULT_IMAGE;
  const resolvedMedia = props.mediaUrl && props.mediaUrl.trim() !== "" ? props.mediaUrl : "";

  const field = (key: keyof HeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const renderMedia = () => {
    if (props.heroType === "none") return null;
    if (props.heroType === "dandy-video" || (props.heroType === "static-image" && resolvedMedia)) {
      const videoSrc = resolvedMedia || "";
      if (!videoSrc) return renderImage();
      return (
        <div className={cn("relative w-full aspect-[16/9] z-10 rounded-xl overflow-hidden", props.imageShadow !== false ? "shadow-2xl" : "")}>
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
        className={cn("w-full h-auto object-contain rounded-xl", props.imageShadow !== false ? "shadow-2xl" : "")}
        loading="lazy"
      />
    </div>
  );

  const hAnim = animationsEnabled ? { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, ease: EASE, delay: 0 } } : {};
  const sAnim = animationsEnabled ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, ease: EASE, delay: 0.12 } } : {};
  const cAnim = animationsEnabled ? { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease: EASE, delay: 0.22 } } : {};
  const mAnim = animationsEnabled ? { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.8, ease: EASE, delay: 0.1 } } : {};

  const textContent = (
    <div className={cn("space-y-8 z-10", !isSplit && "max-w-4xl mx-auto flex flex-col items-center", isSplitRight && "text-right flex flex-col items-end")}>
      <motion.div {...hAnim}>
        <InlineText
          as="h1"
          value={props.headline}
          onUpdate={field("headline")}
          className={cn("font-display leading-[1.05]", getHeadlineSizeClass(props.headlineSize, brand.h1Size ?? "xl"), getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand), isDark ? "text-white" : "text-[#003A30]")}
        />
      </motion.div>
      {props.subheadline && (
        <motion.div {...sAnim}>
          <InlineText
            as="p"
            value={props.subheadline}
            onUpdate={field("subheadline")}
            className={cn(getBodySizeClass(brand), "leading-relaxed font-sans", isDark ? "text-white/80" : "text-[#003A30]/70", !isSplit && "max-w-2xl")}
            multiline
          />
        </motion.div>
      )}
      <motion.div {...cAnim}>
        <div className={cn("flex flex-col gap-4 pt-2", isFullWidth ? "w-full" : "w-fit", !isSplit && "items-center", isSplitRight && "items-end")}>
          <motion.button
            onClick={onCtaClick}
            className={getButtonClasses(brand, cn("inline-flex items-center justify-center", isFullWidth && "w-full"))}
            style={{ backgroundColor: LIME, color: CTA_TEXT_COLOR }}
            whileHover={animationsEnabled ? { scale: 1.04, y: -1 } : undefined}
            whileTap={animationsEnabled ? { scale: 0.96 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
            <ArrowRight className="w-4 h-4 ml-2" />
          </motion.button>
          {props.showSocialProof && (
            <div className={cn("flex items-center gap-2 text-sm font-medium opacity-80", !isSplit && "justify-center")}>
              <ShieldCheck className="w-4 h-4" />
              <InlineText as="span" value={props.socialProofText || ""} onUpdate={field("socialProofText")} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className={cn("w-full font-sans selection:bg-[#C7E738] selection:text-[#003A30]", isDark ? "bg-[#003A30] text-white" : "bg-white text-slate-900")} style={bgExtended}>
      <div className="min-h-[70vh] flex flex-col">
        <nav className="w-full px-6 pt-1 pb-[7px] flex items-center justify-between z-40 relative" style={{ backgroundColor: brand.navBgColor }}>
          <img src={dandyLogoUrl} alt="Dandy" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          <a href={brand.navCtaUrl} target="_blank" rel="noopener noreferrer" className={getButtonClasses(brand)} style={{ backgroundColor: LIME, color: FOREST }}>
            {brand.navCtaText}
          </a>
        </nav>
        <section
          className={cn("relative w-full flex flex-col items-center justify-center flex-1 py-16 lg:py-24", isDark ? "bg-[#003A30]" : "bg-white")}
          style={{ ...(contentPaddingX ? { paddingLeft: contentPaddingX, paddingRight: contentPaddingX } : { paddingLeft: "1.5rem", paddingRight: "1.5rem" }), ...(bgExtended ?? {}) }}
        >
          {isSplit ? (
            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {isSplitRight ? (
                <>
                  <motion.div {...mAnim} className="relative">{renderMedia()}</motion.div>
                  {textContent}
                </>
              ) : (
                <>
                  {textContent}
                  <motion.div {...mAnim} className="relative">{renderMedia()}</motion.div>
                </>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto w-full flex flex-col items-center text-center">{textContent}</div>
          )}
          <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none select-none">
            <div className={cn("w-px h-6 rounded-full", isDark ? "bg-white/20" : "bg-[#003A30]/15")} />
            <div className="animate-bounce"><ChevronDown className={cn("w-5 h-5", isDark ? "text-white/30" : "text-[#003A30]/30")} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}
