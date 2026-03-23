import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses, type BrandConfig } from "@/lib/brand-config";
import type { FullBleedHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

interface Props {
  props: FullBleedHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: FullBleedHeroBlockProps) => void;
}

function hexToRgbParts(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function BlockFullBleedHero({ props, brand, onCtaClick, onFieldChange }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;

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
        style={{
          backgroundImage: props.backgroundImageUrl
            ? `url(${props.backgroundImageUrl})`
            : undefined,
          backgroundColor: props.backgroundImageUrl ? undefined : FOREST,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
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
            className="font-display font-bold tracking-tight leading-[1.05] text-white text-5xl md:text-6xl lg:text-7xl max-w-4xl drop-shadow-sm"
          />

          {props.subheadline && (
            <InlineText
              as="p"
              value={props.subheadline}
              onUpdate={field("subheadline")}
              className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed"
              multiline
            />
          )}

          <div className={cn("flex flex-col sm:flex-row gap-3 pt-2", props.contentAlignment === "center" && "justify-center", props.contentAlignment === "right" && "justify-end")}>
            <button
              onClick={onCtaClick}
              className={getButtonClasses(brand, "inline-flex items-center justify-center")}
              style={{ backgroundColor: LIME, color: FOREST }}
            >
              <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
              <ArrowRight className="w-4 h-4 ml-2 shrink-0" />
            </button>

            {props.secondaryCtaText && (
              <a
                href={props.secondaryCtaUrl || "#"}
                className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/40 text-white text-sm font-semibold hover:border-white/70 hover:bg-white/10 transition-colors"
              >
                {props.secondaryCtaText}
              </a>
            )}
          </div>

          {props.showSocialProof && props.socialProofText && (
            <p className="text-white/60 text-sm font-medium mt-1">
              {props.socialProofText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
