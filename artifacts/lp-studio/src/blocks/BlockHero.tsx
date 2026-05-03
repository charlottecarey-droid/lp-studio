import { ArrowRight, ShieldCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, type BrandConfig } from "@/lib/brand-config";
import type { HeroBlockProps } from "@/lib/block-types";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  props: HeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: HeroBlockProps) => void;
  animationsEnabled?: boolean;
  contentPaddingX?: string;
  /** Pre-rendered nested blocks (overlay slot at the bottom of the hero). */
  childrenSlot?: ReactNode;
}

export function BlockHero({ props, brand, onCtaClick, onFieldChange, animationsEnabled = true, contentPaddingX, childrenSlot }: Props) {
  const LIME = props.ctaColor || brand.accentColor;
  const FOREST = brand.primaryColor;
  const CTA_TEXT_COLOR = props.ctaTextColor || FOREST;
  const isFullWidth = props.buttonWidth === "full";
  const isDark = isDarkBg(props.backgroundStyle);
  const bgExtended = ["black", "gradient", "muted", "light-gray"].includes(props.backgroundStyle ?? "")
    ? getBgStyle(props.backgroundStyle)
    : undefined;
  const requestedSplit = props.layout === "split" || props.layout === "split-right";

  // Image resolution rules:
  //   * non-empty value  → use it as-is
  //   * empty string ""  → explicit "no image" from seed catalog (generic
  //                        tenants) → render nothing (no Dandy leak)
  //   * undefined        → legacy / Dandy default behaviour → fall back to
  //                        the bundled /dandy-platform.webp product shot.
  const DANDY_FALLBACK_IMAGE = "/dandy-platform.webp";
  const resolvedImage =
    props.imageUrl === undefined
      ? DANDY_FALLBACK_IMAGE
      : props.imageUrl.trim() === ""
      ? ""
      : props.imageUrl;
  const resolvedMedia = props.mediaUrl && props.mediaUrl.trim() !== "" ? props.mediaUrl : "";

  // Honor the author-chosen layout regardless of media presence so saved
  // pages don't visually shift if an image is temporarily missing. When
  // there's no media, `renderMedia()` returns null and the split column
  // simply renders empty — better than collapsing the layout (which would
  // be a regression for Dandy templates that legitimately use split).
  // Previously the missing-media path fell back to the hardcoded
  // /dandy-platform.webp default, which leaked Dandy branding.
  const isSplit = requestedSplit;
  const isSplitRight = props.layout === "split-right";

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

  const renderImage = () => {
    // No image / no media → render nothing rather than a broken <img>.
    // Previously the code fell back to a hardcoded /dandy-platform.webp default,
    // which leaked the Dandy product shot into every generic-tenant hero.
    if (!resolvedImage) return null;
    return (
      <div className="relative w-full z-10">
        <InlineImage
          src={resolvedImage}
          alt="Product showcase"
          className={cn("w-full h-auto object-contain rounded-xl", props.imageShadow !== false ? "shadow-2xl" : "")}
          wrapperClassName="block w-full"
          onUpdate={field("imageUrl")}
          loading="lazy"
        />
      </div>
    );
  };

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
          className={cn("font-display leading-[1.05]", getHeadlineSizeClass(props.headlineSize, brand.h1Size ?? "xl"), getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand), isDark ? "text-white" : "text-[var(--brand-primary)]")}
        />
      </motion.div>
      {props.subheadline && (
        <motion.div {...sAnim}>
          <InlineText
            as="p"
            value={props.subheadline}
            onUpdate={field("subheadline")}
            className={cn(getBodySizeClass(brand), "leading-relaxed font-sans", isDark ? "text-white/80" : "text-[rgb(var(--brand-primary-rgb)/0.7)]", !isSplit && "max-w-2xl")}
            multiline
          />
        </motion.div>
      )}
      <motion.div {...cAnim}>
        <div className={cn("flex flex-col gap-4 pt-2", isFullWidth ? "w-full" : "w-fit", !isSplit && "items-center", isSplitRight && "items-end")}>
          {props.ctaAction === "chilipiper" && props.chilipiperUrl ? (
            <ChiliPiperButton
              url={props.chilipiperUrl}
              className={getButtonClasses(brand, cn("inline-flex items-center justify-center", isFullWidth && "w-full"))}
              style={{ backgroundColor: LIME, color: CTA_TEXT_COLOR }}
            >
              <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
              <ArrowRight className="w-4 h-4 ml-2" />
            </ChiliPiperButton>
          ) : (
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
          )}
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
    <div className={cn("w-full font-sans selection:bg-[var(--brand-accent)] selection:text-[var(--brand-primary)]", isDark ? "bg-[var(--brand-primary)] text-white" : "bg-white text-slate-900")} style={bgExtended}>
      <div className="min-h-[70vh] flex flex-col">
        <nav className="w-full px-6 pt-1 pb-[7px] flex items-center justify-between z-40 relative" style={{ backgroundColor: brand.navBgColor }}>
          <BrandLogo brand={brand} tone="onDark" alt={brand.brandName || "Logo"} className="h-8 w-auto" />
          <a href={brand.navCtaUrl} target="_blank" rel="noopener noreferrer" className={getButtonClasses(brand)} style={{ backgroundColor: LIME, color: FOREST }}>
            {brand.navCtaText}
          </a>
        </nav>
        <section
          className={cn("relative w-full flex flex-col items-center justify-center flex-1 py-16 lg:py-24", isDark ? "bg-[var(--brand-primary)]" : "bg-white")}
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
          {childrenSlot && (
            <div
              data-hero-overlay
              className="relative z-20 w-full max-w-7xl mx-auto mt-12"
              onClick={(e) => e.stopPropagation()}
            >
              {childrenSlot}
            </div>
          )}
          <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none select-none">
            <div className={cn("w-px h-6 rounded-full", isDark ? "bg-white/20" : "bg-[rgb(var(--brand-primary-rgb)/0.15)]")} />
            <div className="animate-bounce"><ChevronDown className={cn("w-5 h-5", isDark ? "text-white/30" : "text-[rgb(var(--brand-primary-rgb)/0.3)]")} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}
