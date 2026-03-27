import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, type BrandConfig } from "@/lib/brand-config";
import type { FullBleedHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { ChiliPiperModal } from "./ChiliPiperModal";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  props: FullBleedHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: FullBleedHeroBlockProps) => void;
  animationsEnabled?: boolean;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}

function hexToRgbParts(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function BlockFullBleedHero({ props, brand, onCtaClick, onFieldChange, animationsEnabled = true, pageId, variantId, sessionId }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;
  const isChiliPiper = props.ctaAction === "chilipiper" && !!props.chilipiperUrl;

  const handleCtaClick = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (isChiliPiper) { setCpOpen(true); return; }
    if (props.ctaUrl && props.ctaUrl !== "#") window.open(props.ctaUrl, "_blank");
  };

  // React does not reliably pass `muted` as a DOM attribute on <video>.
  // Setting it imperatively via ref ensures autoplay works in all browsers.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (!el) return;
    el.muted = true;
    if (props.videoAutoplay ?? true) {
      el.play().catch(() => {});
    }
  }, [props.backgroundVideoUrl, props.videoAutoplay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let scrollTarget: HTMLElement | Window = window;

    let parent = el.parentElement;
    while (parent) {
      const { overflowY } = getComputedStyle(parent);
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollTarget = parent;
        break;
      }
      parent = parent.parentElement;
    }

    const getScrollTop = () =>
      scrollTarget === window
        ? window.scrollY
        : (scrollTarget as HTMLElement).scrollTop;

    const onScroll = () => setScrolled(getScrollTop() > 20);

    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scrollTarget.removeEventListener("scroll", onScroll);
  }, []);

  const field = (key: keyof FullBleedHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const minH =
    props.minHeight === "full" ? "min-h-screen"
    : props.minHeight === "large" ? "min-h-[85vh]"
    : "min-h-[70vh]";

  const contentAlign =
    props.contentAlignment === "center" ? "items-center text-center"
    : props.contentAlignment === "right" ? "items-end text-right"
    : "items-start text-left";

  const overlayOpacity = ((props.overlayOpacity ?? 50) / 100).toFixed(2);
  const headerBg = props.headerScrolledBg || FOREST;
  const headerRgb = hexToRgbParts(headerBg);

  return (
    <>
    <div ref={containerRef} className="relative w-full font-sans">
      {/* Sticky transparent → opaque header */}
      <header
        className="sticky top-0 z-50 transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: scrolled
            ? `rgba(${headerRgb}, 0.96)`
            : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          boxShadow: scrolled ? "0 1px 0 rgba(255,255,255,0.06)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Logo */}
          <a href={props.logoUrl || "#"} className="shrink-0">
            {props.logoImageUrl ? (
              <img src={props.logoImageUrl} alt="Logo" className="h-8 w-auto" />
            ) : (
              <img
                src={dandyLogoUrl}
                alt="Dandy"
                className="h-8 w-auto"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            )}
          </a>

          {/* Nav links */}
          {props.navLinks && props.navLinks.length > 0 && (
            <nav className="hidden md:flex items-center gap-6 flex-1">
              {props.navLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  className="text-sm font-medium text-white/90 hover:text-white transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* Header CTA */}
          {props.headerCtaText && (
            <a
              href={props.headerCtaUrl || "#"}
              className={getButtonClasses(brand, "shrink-0 text-sm")}
              style={{ backgroundColor: LIME, color: FOREST }}
            >
              {props.headerCtaText}
            </a>
          )}
        </div>
      </header>

      {/* Full-bleed background section */}
      <div
        className={cn("relative w-full flex items-center overflow-hidden -mt-16", minH)}
        style={
          props.backgroundType !== "video"
            ? {
                backgroundImage: props.backgroundImageUrl
                  ? `url(${props.backgroundImageUrl})`
                  : undefined,
                backgroundColor: props.backgroundImageUrl ? undefined : FOREST,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : { backgroundColor: FOREST }
        }
      >
        {/* Video background — ref callback sets muted imperatively (React JSX muted prop is unreliable) */}
        {props.backgroundType === "video" && props.backgroundVideoUrl && (
          <video
            key={props.backgroundVideoUrl}
            ref={attachVideo}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            src={props.backgroundVideoUrl}
            autoPlay={props.videoAutoplay ?? true}
            muted
            loop
            playsInline
          />
        )}

        {/* Dark overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: FOREST,
            opacity: overlayOpacity,
          }}
        />

        {/* Hero content */}
        <div
          className={cn(
            "relative z-10 max-w-7xl mx-auto w-full px-6 pt-24 pb-20 flex flex-col gap-7",
            contentAlign
          )}
        >
          <InlineText
            as="h1"
            value={props.headline}
            onUpdate={field("headline")}
            className={cn("font-display leading-[1.05] max-w-4xl drop-shadow-sm", getHeadlineSizeClass(props.headlineSize, brand.h1Size ?? "xl"), getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))}
            style={{ color: props.headlineColor || "#ffffff" }}
          />

          {props.subheadline && (
            <InlineText
              as="p"
              value={props.subheadline}
              onUpdate={field("subheadline")}
              className={cn(getBodySizeClass(brand), "max-w-2xl leading-relaxed")}
              style={{ color: props.subheadlineColor || "rgba(255,255,255,0.8)" }}
              multiline
            />
          )}

          <motion.div
            className={cn("flex flex-col sm:flex-row gap-3 pt-2", props.contentAlignment === "center" && "justify-center", props.contentAlignment === "right" && "justify-end")}
            initial={animationsEnabled ? { opacity: 0, y: 16 } : undefined}
            animate={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
            transition={animationsEnabled ? { duration: 0.55, ease: EASE, delay: 0.22 } : undefined}
          >
            <motion.button
              onClick={handleCtaClick}
              className={getButtonClasses(brand, "inline-flex items-center justify-center")}
              style={{ backgroundColor: LIME, color: FOREST }}
              whileHover={animationsEnabled ? { scale: 1.04, y: -1 } : undefined}
              whileTap={animationsEnabled ? { scale: 0.96 } : undefined}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
              <ArrowRight className="w-4 h-4 ml-2 shrink-0" />
            </motion.button>

            {props.secondaryCtaText && (
              <motion.a
                href={props.secondaryCtaUrl || "#"}
                className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/40 text-white text-sm font-semibold hover:border-white/70 hover:bg-white/10 transition-colors"
                whileHover={animationsEnabled ? { scale: 1.04, y: -1 } : undefined}
                whileTap={animationsEnabled ? { scale: 0.96 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
              >
                {props.secondaryCtaText}
              </motion.a>
            )}
          </motion.div>

          {props.showSocialProof && props.socialProofText && (
            <p className="text-white/60 text-sm font-medium mt-1">
              {props.socialProofText}
            </p>
          )}
        </div>
      </div>
    </div>
    {cpOpen && props.chilipiperUrl && (
      <ChiliPiperModal
        url={props.chilipiperUrl}
        pageId={pageId}
        variantId={variantId}
        sessionId={sessionId}
        onClose={() => setCpOpen(false)}
      />
    )}
    </>
  );
}
