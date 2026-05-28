import { useState, type CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";

export type BrandLogoTone = "onDark" | "onLight" | "onPrimary" | "onAccent";

interface Props {
  brand: BrandConfig;
  /** Override the brand logo URL (e.g. block prop overrides). */
  url?: string;
  /** Surface this logo will sit on. Drives the auto-recolor color when enabled. */
  tone?: BrandLogoTone;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Render a tenant's brand logo, optionally auto-recoloring monochrome SVGs to
 * match the surrounding surface via a CSS mask. When auto-recolor is off (or
 * the source isn't an SVG) renders a plain `<img>`.
 *
 * `tone` selects the foreground color used by the mask:
 *   - `onDark`     → white (logo on dark headers / nav)
 *   - `onLight`    → brand primary (logo on white / light surfaces)
 *   - `onPrimary`  → contrast color of brand primary (logo on a primary tile)
 *   - `onAccent`   → contrast color of brand accent (logo on an accent tile)
 *
 * Sizing: pass standard Tailwind size classes (`h-9 w-auto`, `w-40 h-auto`,
 * etc.) via `className`. We discover the SVG's natural aspect ratio from a
 * hidden `<img>` and apply it as `aspect-ratio` on the masked element so the
 * `auto` axis resolves correctly.
 */
export function BrandLogo({
  brand,
  url,
  tone = "onLight",
  alt = "Logo",
  className,
  style,
}: Props) {
  // Prefer the dark-surface logo on explicitly-dark surfaces when the tenant
  // has uploaded one. We only swap on `tone === "onDark"` — not on
  // `onPrimary`/`onAccent`, since brand primary or accent can be light, and
  // we'd otherwise serve a dark-painted asset onto a light tile. Auto-recolor
  // still wins for monochrome SVGs (handled below); the dark variant exists
  // specifically for multi-color marks and raster files that don't recolor
  // cleanly. Falls back to `logoUrl` when no dark variant is set.
  const brandSrc = tone === "onDark" && brand.logoUrlDark?.trim()
    ? brand.logoUrlDark.trim()
    : brand.logoUrl?.trim() ?? "";
  const src = (url && url.trim()) || brandSrc;
  const [aspect, setAspect] = useState<number | null>(null);
  if (!src) return null;

  const isSvg = src.toLowerCase().split("?")[0].endsWith(".svg");
  const autoRecolor = isSvg && (brand.logoAutoRecolor ?? true);

  if (!autoRecolor) {
    return <img src={src} alt={alt} className={className} style={style} />;
  }

  const color =
    tone === "onDark" ? "#ffffff"
    : tone === "onPrimary" ? "var(--brand-on-primary, #ffffff)"
    : tone === "onAccent" ? "var(--brand-on-accent, #000000)"
    : "var(--brand-primary, currentColor)";

  return (
    <span
      role="img"
      aria-label={alt}
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: color,
        aspectRatio: String(aspect ?? 4),
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    >
      {/* Off-screen probe to capture the SVG's natural aspect ratio so
          `h-N w-auto` / `w-N h-auto` resolves to the correct opposite axis. */}
      <img
        src={src}
        alt=""
        aria-hidden
        style={{ display: "none" }}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            const a = img.naturalWidth / img.naturalHeight;
            if (a && a !== aspect) setAspect(a);
          }
        }}
      />
    </span>
  );
}
