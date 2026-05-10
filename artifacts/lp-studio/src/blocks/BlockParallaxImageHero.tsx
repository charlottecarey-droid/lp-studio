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
      <em
        style={{ color: accentColor, fontStyle: "italic", fontWeight: "inherit" }}
      >
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
  const parallaxStrength = Math.max(0, Math.min(1, props.parallaxStrength ?? 0.35));
  const minH = props.minHeight === "large" ? "85vh" : "100vh";

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
      // Distance from top of section to top of viewport (positive when scrolled past)
      const offset = -rect.top;
      // Only animate while section is in/near viewport
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      const translate = offset * parallaxStrength;
      img.style.transform = `translate3d(0, ${translate}px, 0) scale(${1 + parallaxStrength * 0.5})`;
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
      {/* Parallax image layer (oversized to allow translation without exposing edges) */}
      <div
        ref={imageRef}
        className="absolute inset-0 will-change-transform"
        style={{
          backgroundImage: props.imageUrl ? `url("${props.imageUrl}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          transform: `scale(${1 + parallaxStrength * 0.5})`,
          top: `-${parallaxStrength * 50}%`,
          bottom: `-${parallaxStrength * 50}%`,
        }}
      />

      {/* Empty-state placeholder when no image set */}
      {!props.imageUrl && (
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

      {/* Editor-only image picker */}
      {isEditor && (
        <div className="absolute top-4 right-4 z-30">
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
              style={{ color: textColor }}
            >
              {isEditor ? (
                <InlineText
                  as="span"
                  value={props.headline ?? ""}
                  onUpdate={f("headline")}
                />
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

        {/* Bottom row: CTA (left) + brand mark (right) */}
        <div className="flex items-end justify-between gap-4 px-6 sm:px-10 lg:px-16 pb-6 sm:pb-8 lg:pb-10">
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
            />
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>

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
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
