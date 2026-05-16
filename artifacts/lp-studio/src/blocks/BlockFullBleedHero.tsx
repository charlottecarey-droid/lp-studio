import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { ArrowRight, ImageIcon } from "lucide-react";
import { MuteToggleButton } from "@/components/MuteToggleButton";
import { cn } from "@/lib/utils";
import { getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, type BrandConfig } from "@/lib/brand-config";
import type { FullBleedHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo } from "@/components/BrandLogo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { getHeadlineSizeClass } from "@/lib/typography";
import { motion } from "framer-motion";
import { ChiliPiperModal } from "./ChiliPiperModal";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { safeNavigate } from "@/lib/safe-url";

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
  /** Phase 2 overlay slot — recursively rendered nested children laid on top
   *  of the hero content. Mirrors `BlockHero`'s overlay slot so users can
   *  drop additional blocks (CTAs, badges, marquees) into the hero. */
  childrenSlot?: ReactNode;
}

function hexToRgbParts(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function BlockFullBleedHero({ props, brand, onCtaClick, onFieldChange, animationsEnabled = true, pageId, variantId, sessionId, childrenSlot }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;
  const isChiliPiper = props.ctaAction === "chilipiper" && !!props.chilipiperUrl;
  const isModalCta = props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper";

  const handleCtaClick = () => {
    if (isModalCta) { onCtaClick?.(); setModalOpen(true); return; }
    if (onCtaClick) { onCtaClick(); return; }
    if (isChiliPiper) { setCpOpen(true); return; }
    if (props.ctaUrl && props.ctaUrl !== "#") safeNavigate(props.ctaUrl, "_blank");
  };

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setVideoMuted(el.muted);
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
            <BrandLogo
              brand={brand}
              url={props.logoImageUrl}
              tone="onDark"
              alt={brand.brandName || "Logo"}
              className="h-8 w-auto"
            />
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
          <>
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
            <MuteToggleButton muted={videoMuted} onClick={toggleVideoMute} className="absolute bottom-4 right-4 z-20" />
          </>
        )}

        {/* Dark overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: props.overlayColor ?? FOREST,
            opacity: overlayOpacity,
          }}
        />

        {/* Inline background-image replace pill (builder mode, image bg only) */}
        {onFieldChange && props.backgroundType !== "video" && (
          <Popover open={bgPickerOpen} onOpenChange={setBgPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Replace background image"
                onClick={(e) => e.stopPropagation()}
                // top-12 (48px) clears the per-block hover toolbar that
                // sits at top-2 right-2 (BuilderEditor.SortableCanvasBlock).
                // Previously top-4 caused both controls to stack at the
                // same corner of the canvas card.
                className="absolute top-12 right-4 z-30 inline-flex items-center gap-1 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-black/85 transition"
              >
                <ImageIcon className="w-3 h-3" />
                Replace background
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-80 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <ImagePicker
                value={props.backgroundImageUrl ?? ""}
                onChange={(url) => {
                  onFieldChange({ ...props, backgroundImageUrl: url });
                  setBgPickerOpen(false);
                }}
                label="Replace background image"
              />
            </PopoverContent>
          </Popover>
        )}

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

          {childrenSlot && (
            <div data-block-overlay-slot="full-bleed-hero" className="mt-4 w-full">
              {childrenSlot}
            </div>
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
    {isModalCta && (
      <EmailCaptureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        email=""
        mode={props.ctaAction === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={props.modalChilipiperUrl}
        formSource={props.modalFormSource}
        linkedFormId={props.modalFormId}
        marketoBaseUrl={props.modalMarketoBaseUrl}
        marketoMunchkinId={props.modalMarketoMunchkinId}
        marketoFormId={props.modalMarketoFormId}
        chiliPiperConfig={props.modalChiliPiperHandoffUrl ? { url: props.modalChiliPiperHandoffUrl, mode: props.modalChiliPiperHandoffMode ?? "modal", fieldMap: props.modalChiliPiperHandoffFieldMap } : null}
        formConfig={{
          headline: props.modalHeadline,
          subheadline: props.modalSubheadline,
          submitText: props.modalSubmitText,
          successMessage: props.modalSuccessMessage,
          disclaimer: props.modalDisclaimer,
          showFirstName: props.modalShowFirstName,
          showLastName: props.modalShowLastName,
          showPhone: props.modalShowPhone,
          showCompany: props.modalShowCompany,
        }}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="full-bleed-hero"
      />
    )}
    </>
  );
}
