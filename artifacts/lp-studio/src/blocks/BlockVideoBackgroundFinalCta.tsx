import type { CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, resolveBrandColor } from "@/lib/brand-config";
import type { VideoBackgroundFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: VideoBackgroundFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: VideoBackgroundFinalCtaBlockProps) => void;
}

function hexToRgbParts(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

export function BlockVideoBackgroundFinalCta({ props, brand, onFieldChange }: Props) {
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const surface = resolveSectionSurface(props, "#0F172A");
  const ink = props.textColor ?? surface.color ?? "#FFFFFF";
  const muted = `${ink}D9`;
  const ctaButtonBg = props.ctaButtonColor || accent;
  const onAccent =
    props.ctaButtonTextColor ||
    pickContrastingColor(undefined, ctaButtonBg, ["#FFFFFF", "#0F172A"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  // Overlay tint over the video/poster. Color + opacity are adjustable; an
  // optional vertical gradient replaces the flat tint when chosen. Defaults
  // reproduce the previous hardcoded rgba(15,23,42,·) slate scrim.
  const overlayColor = resolveBrandColor(brand, props.overlayColor, "#0F172A");
  const overlayAlpha = Math.max(0, Math.min(100, props.overlayOpacity ?? 60)) / 100;
  const overlayRgb = hexToRgbParts(overlayColor);
  const overlayGradient = props.overlayGradient ?? "none";
  const overlayStyle: CSSProperties =
    overlayGradient === "top"
      ? { background: `linear-gradient(to bottom, rgba(${overlayRgb}, ${overlayAlpha}) 0%, transparent 100%)` }
      : overlayGradient === "bottom"
        ? { background: `linear-gradient(to top, rgba(${overlayRgb}, ${overlayAlpha}) 0%, transparent 100%)` }
        : overlayGradient === "both"
          ? { background: `linear-gradient(to bottom, rgba(${overlayRgb}, ${overlayAlpha}) 0%, transparent 40%, transparent 60%, rgba(${overlayRgb}, ${overlayAlpha}) 100%)` }
          : { backgroundColor: `rgba(${overlayRgb}, ${overlayAlpha})` };

  // Edge fade — blends the section's top/bottom into adjacent sections.
  const edgeFade = props.edgeFade ?? "none";
  const edgeFadeColor = props.edgeFadeColor || "#0a0a0a";
  const edgeFadeSize = Math.max(0, Math.min(60, props.edgeFadeSize ?? 25));
  const showFadeTop = edgeFade === "top" || edgeFade === "both";
  const showFadeBottom = edgeFade === "bottom" || edgeFade === "both";

  const update = <K extends keyof VideoBackgroundFinalCtaBlockProps>(key: K, value: VideoBackgroundFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="relative w-full overflow-hidden px-6 py-28 sm:py-36" style={{ background: surface.background, fontFamily: BODY }}>
      {props.backgroundVideoUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={props.backgroundVideoUrl}
          poster={props.posterUrl}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : props.posterUrl ? (
        <img src={props.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0" style={overlayStyle} />
      {showFadeTop && edgeFadeSize > 0 && (
        <div
          className="absolute inset-x-0 top-0 z-10 pointer-events-none"
          style={{ height: `${edgeFadeSize}%`, background: `linear-gradient(to bottom, ${edgeFadeColor} 0%, ${edgeFadeColor} 10%, transparent 100%)` }}
        />
      )}
      {showFadeBottom && edgeFadeSize > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
          style={{ height: `${edgeFadeSize}%`, background: `linear-gradient(to top, ${edgeFadeColor} 0%, ${edgeFadeColor} 10%, transparent 100%)` }}
        />
      )}
      <div className="container relative z-20 mx-auto max-w-3xl text-center" style={{ color: ink }}>
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-4 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink, opacity: 0.85 }} />
        )}
        <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl" style={{ color: ink, fontFamily: DISPLAY }} />
        {(props.subheading || onFieldChange) && (
          <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed md:text-xl" style={{ color: muted }} multiline />
        )}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-10">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="video-background-final-cta"
              className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-semibold shadow-lg"
              style={{ backgroundColor: ctaButtonBg, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          </div>
        )}
      </div>
    </section>
  );
}
