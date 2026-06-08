import { useEffect, useState } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import { BrandLogo, brandHasLogo, brandLogoToneForText } from "@/components/BrandLogo";
import type { TransparentOverlayNavBlockProps } from "@/lib/block-types";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: TransparentOverlayNavBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: TransparentOverlayNavBlockProps) => void;
}

export function BlockTransparentOverlayNav({ props, brand }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const scrolledBg = props.scrolledBgColor ?? "#0f172a";
  const overlayText = props.overlayTextColor ?? "#ffffff";
  const solidText = props.textColor ?? pickContrastingColor(undefined, scrolledBg, ["#ffffff", "#0f172a"]);
  const text = scrolled ? solidText : overlayText;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const logoText = props.logoText || brand.brandName || "Brand";

  return (
    <div className="sticky top-0 z-50 w-full" style={{ fontFamily: BODY }}>
      {props.announcementText && (
        <a
          href={props.announcementUrl || "#"}
          className="block w-full px-6 py-2 text-center text-xs font-semibold"
          style={{ backgroundColor: accent, color: onAccent }}
        >
          {props.announcementText}
        </a>
      )}
      <header
        className="w-full transition-colors duration-300"
        style={{
          backgroundColor: scrolled ? scrolledBg : "transparent",
          boxShadow: scrolled ? "0 1px 0 rgba(255,255,255,0.08)" : "none",
        }}
      >
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            {brandHasLogo(brand, props.logoUrl) ? (
              <BrandLogo brand={brand} url={props.logoUrl} tone={brandLogoToneForText(text)} alt={logoText} className="h-8 w-auto" />
            ) : (
              <span className="text-xl font-extrabold tracking-tight" style={{ color: text, fontFamily: DISPLAY }}>
                {logoText}
              </span>
            )}
            <nav className="hidden items-center gap-7 md:flex">
              {(props.links ?? []).map((l, i) => (
                <a
                  key={i}
                  href={l.url || "#"}
                  className="text-sm font-medium opacity-85 transition-opacity hover:opacity-100"
                  style={{ color: text }}
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
          {props.ctaLabel && (
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="transparent-overlay-nav-cta"
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent }}
            >
              {props.ctaLabel}
            </CtaButton>
          )}
        </div>
      </header>
    </div>
  );
}
