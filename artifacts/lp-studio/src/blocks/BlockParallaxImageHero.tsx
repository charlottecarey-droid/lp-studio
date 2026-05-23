import { useEffect, useRef, useState } from "react";
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
  const imageRef = useRef<HTMLDivElement>(null);
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
  const edgeFade = props.edgeFade ?? "none";
  const edgeFadeColor = props.edgeFadeColor || "#0a0a0a";
  const edgeFadeSize = Math.max(0, Math.min(60, props.edgeFadeSize ?? 25));
  const showFadeTop = edgeFade === "top" || edgeFade === "both";
  const showFadeBottom = edgeFade === "bottom" || edgeFade === "both";

  useEffect(() => {
    if (!animationsEnabled || isEditor) return;
    const sec = sectionRef.current;
    const img = imageRef.current;
    if (!sec || !img) return;
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Only animate while section is in/near viewport
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      // Centre-relative scroll progress: 0 when the section's centre is
      // at the viewport centre, negative as the section moves up past
      // it, positive while it's still below. Anchoring to the centre
      // gives a symmetric +/- translation range.
      const sectionCentre = rect.top + rect.height / 2;
      const viewportCentre = vh / 2;
      const offset = viewportCentre - sectionCentre;
      // At strength 1.0 we want the image to stay perfectly fixed in
      // screen space (classic "fixed background" parallax). The full
      // scroll range from "section enters viewport" to "section leaves
      // viewport" is (rect.height + vh); centred, that's ±(h+vh)/2.
      // So at strength 1.0 max travel needs to span the entire half-
      // range. The image div is 80% overscanned top + bottom (260% of
      // section height) so this fits comfortably without exposing the
      // edge. Travel scales linearly with strength below 1.0.
      const maxTravel = (rect.height + vh) / 2;
      const raw = offset * parallaxStrength;
      const translate = Math.max(-maxTravel, Math.min(maxTravel, raw));
      img.style.transform = `translate3d(0, ${translate}px, 0)`;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [animationsEnabled, isEditor, parallaxStrength]);

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
      {/* Parallax media layer. 80% overscan top + bottom so the image div
          is 260% of section height — large enough that even at strength
          1.0 (image perfectly fixed in screen space) the edge never
          exposes as you scroll a vh-tall section past the viewport. */}
      <div
        ref={imageRef}
        className="absolute inset-x-0 will-change-transform overflow-hidden"
        style={{
          backgroundImage: !props.videoUrl && props.imageUrl ? `url("${props.imageUrl}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          top: "-80%",
          bottom: "-80%",
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
            preload="metadata"
            aria-hidden
            className="w-full h-full object-cover"
          />
        )}
      </div>

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
