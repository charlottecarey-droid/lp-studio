import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";
import type { ParallaxImageHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImagePicker } from "@/components/ImagePicker";
import { safeNavigate } from "@/lib/safe-url";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: ParallaxImageHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ParallaxImageHeroBlockProps) => void;
  animationsEnabled?: boolean;
}

function hexToRgbParts(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

function renderHeadlineWithAccent(headline: string, accent: string | undefined, accentColor: string) {
  if (!accent || !headline.includes(accent)) {
    return <>{headline}</>;
  }
  const idx = headline.indexOf(accent);
  const before = headline.slice(0, idx);
  const after = headline.slice(idx + accent.length);
  return (
    <>
      {before}
      <em style={{ color: accentColor, fontStyle: "italic", fontWeight: "inherit", fontSynthesis: "style", fontFamily: BODY }}>
        {accent}
      </em>
      {after}
    </>
  );
}

export function BlockParallaxImageHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  animationsEnabled = true,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const isEditor = !!onFieldChange;

  const accentColor = props.accentColor || brand.accentColor || "#C7E738";
  const textColor = props.textColor || "#FFFFFF";
  const overlayColor = props.overlayColor || "#000000";
  const overlayAlpha = Math.max(0, Math.min(100, props.overlayOpacity ?? 35)) / 100;
  // Default bumped 0.35 → 0.6 so the parallax effect is obvious out of
  // the box. At strength 1.0 the image is perfectly stationary in
  // screen space (true "fixed background" parallax); at 0.6 it moves
  // at ~40% of scroll speed — clearly slower than the page.
  const parallaxStrength = Math.max(0, Math.min(1, props.parallaxStrength ?? 0.6));
  // Expanded height presets — see ParallaxImageHeroBlockProps.minHeight.
  // Falls back to 100vh for unknown/legacy values so old pages stay full-bleed.
  const HEIGHT_MAP: Record<string, string> = {
    full: "100vh",
    large: "85vh",
    medium: "70vh",
    compact: "55vh",
    small: "40vh",
    slim: "28vh",
  };
  const minH = HEIGHT_MAP[props.minHeight ?? "full"] ?? "100vh";

  // Edge fade: a top and/or bottom gradient that resolves to a solid
  // color so the section can blend into the bg of whatever sits above
  // or below it. Sized as a percentage of the section so it scales with
  // the chosen height preset.
  // Media scale — 1.0 (default) renders the image at "natural cover"
  // (image is exactly viewport-sized, minimum zoom for full bleed).
  // Values > 1 zoom further in. Values < 1 are not useful here: the
  // image is already at its minimum zoom that keeps the section
  // fully covered, so going below 1 would only crop the image
  // further. Clamp at 1.0 lower bound.
  const mediaScale = Math.max(1, Math.min(2, props.mediaScale ?? 1));

  const edgeFade = props.edgeFade ?? "none";
  const edgeFadeColor = props.edgeFadeColor || "#0a0a0a";
  const edgeFadeSize = Math.max(0, Math.min(60, props.edgeFadeSize ?? 25));
  const showFadeTop = edgeFade === "top" || edgeFade === "both";
  const showFadeBottom = edgeFade === "bottom" || edgeFade === "both";

  // Parallax driven by framer-motion's scroll progress (same pattern as
  // ScrollAssembly / Switchback).
  //
  // Image-layer geometry: the image div is exactly viewport-height tall
  // (height: max(100%, 100vh) — clamped to at least 100vh so even
  // shorter section presets still get a full-viewport image, and to
  // 100% so taller presets stay covered). At cover sizing this means
  // the image fits the viewport with the minimum possible zoom — what
  // you actually see is the photo's natural framing rather than a
  // 2.6× crop. This is the fix for "everything is so big": previously
  // the layer was 260% of section height (top: -80%; bottom: -80%) to
  // give the parallax travel room, and cover-fitting an image into
  // that very tall box forced the heavy zoom.
  //
  // With a viewport-sized image we don't need overscan — instead we
  // translate the image up/down inside the section and let the
  // section's overflow-hidden clip whatever pokes outside. The math
  // below keeps the image always covering the on-screen portion of
  // the section: at every visible scroll position, the image's
  // coverage range strictly contains the section's visible range, so
  // the fallback bg never shows through.
  //
  // offset ["start end" → "end start"]: p=0 when the section's top
  // first touches viewport bottom, p=1 when the section's bottom
  // exits viewport top. The full window during which any pixel of
  // the section is on screen.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, (p) => {
    if (!animationsEnabled || isEditor) return 0;
    const sec = sectionRef.current;
    if (!sec) return 0;
    const h = sec.offsetHeight || 0;
    const vh = (typeof window !== "undefined" ? window.innerHeight : 0) || 1;
    // At strength 1.0 the image stays perfectly fixed in viewport
    // space (classic "fixed background" parallax). Full scroll range
    // through the section is (h + vh); the symmetric ±travel from the
    // centred point is therefore (h + vh) / 2.
    return (p - 0.5) * (h + vh) * parallaxStrength;
  });

  const handleCtaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onCtaClick) { onCtaClick(); return; }
    if (props.ctaUrl && props.ctaUrl !== "#") {
      safeNavigate(props.ctaUrl, "_self");
    }
  };

  const f = (k: keyof ParallaxImageHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [k]: v }) : undefined;

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{
        minHeight: minH,
        backgroundColor: "#0a0a0a",
        color: textColor,
      }}
    >
      {/* Parallax media layer. Centred vertically and sized to exactly
          viewport-height (clamped to at least the section so taller
          presets stay covered) — at cover sizing this gives the image
          its natural, minimum-zoom framing instead of the 2.6× crop
          the old overscan forced. The translate range below moves
          the image up/down by (h + vh)/2; the section's overflow-
          hidden clips anything that pokes out. */}
      <motion.div
        className="absolute inset-x-0 top-0 will-change-transform overflow-hidden"
        style={{
          height: "max(100%, 100vh)",
          y: parallaxY,
        }}
      >
        {/* Inner wrapper holds the actual media. Keeping the user-
            facing mediaScale transform on a separate element from the
            framer-motion y-transform on the parent keeps the two
            independent — the parallax travel range stays the same
            regardless of zoom. Defaults to scale 1.0 = natural fit. */}
        <div
          className="w-full h-full"
          style={{
            backgroundImage: !props.videoUrl && props.imageUrl ? `url("${props.imageUrl}")` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            transform: mediaScale !== 1 ? `scale(${mediaScale})` : undefined,
            transformOrigin: "center center",
          }}
        >
          {props.videoUrl && (
            <video
              key={props.videoUrl}
              src={props.videoUrl}
              poster={props.imageUrl || undefined}
              autoPlay={props.videoAutoplay !== false}
              muted
              loop
              playsInline
              aria-hidden
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </motion.div>

      {/* Empty-state placeholder when no media set */}
      {!props.imageUrl && !props.videoUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30">
          <ImageIcon className="w-16 h-16" />
        </div>
      )}

      {/* Overlay tint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: `rgba(${hexToRgbParts(overlayColor)}, ${overlayAlpha})`,
        }}
      />

      {/* Edge fade overlays — sit above the image + overlay tint but
          below the content (z-10) so the headline/CTAs stay crisp while
          the section's top/bottom edges melt into adjacent sections. */}
      {showFadeTop && edgeFadeSize > 0 && (
        <div
          className="absolute inset-x-0 top-0 z-10 pointer-events-none"
          style={{
            height: `${edgeFadeSize}%`,
            background: `linear-gradient(to bottom, ${edgeFadeColor} 0%, ${edgeFadeColor} 10%, transparent 100%)`,
          }}
        />
      )}
      {showFadeBottom && edgeFadeSize > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
          style={{
            height: `${edgeFadeSize}%`,
            background: `linear-gradient(to top, ${edgeFadeColor} 0%, ${edgeFadeColor} 10%, transparent 100%)`,
          }}
        />
      )}

      {/* Editor-only image picker */}
      {isEditor && (
        // top-12 (48px) clears the per-block hover toolbar that sits at
        // top-2 right-2 (BuilderEditor.SortableCanvasBlock). Previously
        // top-4 caused both controls to stack at the same corner.
        <div className="absolute top-12 right-4 z-30">
          <Popover open={bgPickerOpen} onOpenChange={setBgPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1.5 backdrop-blur"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Change image
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <ImagePicker
                value={props.imageUrl}
                onChange={(url) => {
                  onFieldChange?.({ ...props, imageUrl: url });
                  setBgPickerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Content layer */}
      <div
        className="relative z-20 flex flex-col h-full"
        style={{ minHeight: minH }}
      >
        {/* Top row: eyebrow (left) + reference label (right) */}
        <div className="flex items-start justify-between px-6 sm:px-10 lg:px-16 pt-6 sm:pt-8 lg:pt-10">
          <InlineText
            as="div"
            className="text-[11px] sm:text-xs tracking-[0.2em] uppercase opacity-90"
            value={props.eyebrow ?? ""}
            onUpdate={f("eyebrow")}
          />
          <InlineText
            as="div"
            className="text-[11px] sm:text-xs tracking-[0.2em] uppercase opacity-70"
            value={props.referenceLabel ?? ""}
            onUpdate={f("referenceLabel")}
          />
        </div>

        {/* Center-left headline */}
        <div className="flex-1 flex items-center px-6 sm:px-10 lg:px-16">
          <div className="max-w-[min(90%,900px)]">
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[1.05]",
                getHeadingWeightClass(brand),
                getHeadingLetterSpacingClass(brand),
              )}
              style={{ color: textColor, fontFamily: DISPLAY }}
            >
              {isEditor ? (
                <InlineText
                  as="span"
                  value={props.headline ?? ""}
                  onUpdate={f("headline")}
                style={{ fontFamily: DISPLAY }}/>
              ) : (
                renderHeadlineWithAccent(
                  props.headline ?? "",
                  props.headlineAccentWord,
                  accentColor,
                )
              )}
            </h1>
            {isEditor && (
              <div className="mt-3 text-xs opacity-60 italic">
                Tip: Edit "Accent word" in the right panel — that word will appear italic and in your accent color.
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: CTA (left) + brand mark (right).
            CTA hides entirely in viewer mode when ctaText is blank — that's
            the user's "off switch" for the link/arrow. In editor mode it
            always renders (with a placeholder) so the field is still
            reachable to add text back later. */}
        <div className="flex items-end justify-between gap-4 px-6 sm:px-10 lg:px-16 pb-6 sm:pb-8 lg:pb-10">
          {(isEditor || (props.ctaText ?? "").trim().length > 0) ? (
            <a
              href={props.ctaUrl || "#"}
              onClick={handleCtaClick}
              className="group inline-flex items-center gap-2 text-sm sm:text-base border-b border-white/70 pb-1 hover:border-white transition-colors"
              style={{ color: textColor }}
            >
              <InlineText
                as="span"
                value={props.ctaText ?? ""}
                onUpdate={f("ctaText")}
              style={{ fontFamily: BODY }}/>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          ) : (
            // Empty spacer keeps the brand mark right-aligned via justify-between.
            <span aria-hidden />
          )}

          <div className="flex items-center gap-2 text-2xl sm:text-3xl lg:text-4xl">
            {props.brandMarkLogoUrl ? (
              <img
                src={props.brandMarkLogoUrl}
                alt={props.brandMark || "Brand"}
                className="h-7 sm:h-8 lg:h-10 w-auto object-contain"
              />
            ) : (
              <InlineText
                as="span"
                className={cn(
                  "italic",
                  getHeadingWeightClass(brand),
                )}
                value={props.brandMark ?? ""}
                onUpdate={f("brandMark")}
              style={{ fontFamily: BODY }}/>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
