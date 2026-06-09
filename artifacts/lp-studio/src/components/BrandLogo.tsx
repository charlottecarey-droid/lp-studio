import { useState, type CSSProperties } from "react";
import { type BrandConfig, relativeLuminance } from "@/lib/brand-config";

export type BrandLogoTone = "onDark" | "onLight" | "onPrimary" | "onAccent";

const HEX6_RE = /^#[0-9a-f]{6}$/i;

/**
 * Multi-color brand marks that must NEVER be mask-recolored. The auto-recolor
 * mask paints the whole SVG silhouette one flat color (great for monochrome
 * wordmarks), but it destroys multi-color logos — e.g. the Dandy mark renders
 * as a solid brand-primary (pink/coral) blob. These paths opt out explicitly so
 * they always render as a plain `<img>` in their native colors, regardless of
 * the `logoAutoRecolor` setting.
 */
const KNOWN_MULTICOLOR_LOGOS = new Set([
  "/dandy-logo.svg",
  "/dandy-logo-white.svg",
  "/dandy-logo-dark.svg",
]);

/**
 * A surface is "dark enough that we want the dark-mode logo asset" when its
 * relative luminance falls below ~0.4 (WCAG-ish). Used by `tone === "onPrimary"`
 * and `onAccent` so a brand whose primary/accent happens to be dark (Zoom
 * blue, etc.) doesn't render a dark-painted raster logo on a same-dark tile.
 */
function isDarkSurfaceForTone(brand: BrandConfig, tone: BrandLogoTone): boolean {
  if (tone === "onDark") return true;
  const hex =
    tone === "onPrimary" ? brand.primaryColor :
    tone === "onAccent" ? brand.accentColor :
    null;
  if (!hex || !HEX6_RE.test(hex)) return false;
  return relativeLuminance(hex) < 0.4;
}

/**
 * True when the brand has *any* logo asset configured (light or dark). Use this
 * to decide whether to render `<BrandLogo>` at all vs. falling back to a text
 * wordmark — `BrandLogo` itself renders `null` when no source resolves.
 */
export function brandHasLogo(brand: BrandConfig, override?: string): boolean {
  return !!(override?.trim() || brand.logoUrl?.trim() || brand.logoUrlDark?.trim());
}

/**
 * Pick the right logo tone for a surface given the *foreground/text* color that
 * sits on it. Light text implies a dark surface (→ `onDark`); dark text implies
 * a light surface (→ `onLight`). Non-hex / unknown colors fall back to
 * `onLight`, matching the default `BlockNavHeader` behavior.
 */
export function brandLogoToneForText(textColor?: string): BrandLogoTone {
  if (textColor && HEX6_RE.test(textColor) && relativeLuminance(textColor) > 0.5) {
    return "onDark";
  }
  return "onLight";
}

/**
 * Pick the logo tone for a section surface by its darkness. Dark surfaces
 * (including the brand gradient preset) → `onDark`, which selects the tenant's
 * dark-background ("light/white") logo asset; light surfaces → `onLight`.
 * Pair with `resolveSectionSurface(...).isDark` so a block's logo always
 * follows whatever background the editor picked.
 */
export function brandLogoToneForSurface(isDark: boolean): BrandLogoTone {
  return isDark ? "onDark" : "onLight";
}

interface Props {
  brand: BrandConfig;
  /** Override the brand logo URL (e.g. block prop overrides). */
  url?: string;
  /** Surface this logo will sit on. Drives the auto-recolor color when enabled. */
  tone?: BrandLogoTone;
  /**
   * Opt-in for callers that can sit on either a light *or* a dark surface
   * (e.g. footers). On a *dark* surface a non-recolorable logo is already
   * forced to a white silhouette so it always reads. With `autoContrast`, the
   * *light* direction is guarded too: a single white/light raster mark
   * (uploaded as the only logo, with no dedicated dark variant) is painted to a
   * dark silhouette instead of rendering invisibly "white-on-white". Off by
   * default so surfaces that intentionally show the native logo colors are
   * unaffected.
   */
  autoContrast?: boolean;
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
  // Prefer the dark-surface logo when (a) the tenant uploaded one AND (b)
  // the surface we're painting on is actually dark. We test luminance for
  // `onPrimary` / `onAccent` rather than blindly swapping, because brand
  // primary or accent can be light — in which case the light-mode asset
  // is still correct. Auto-recolor still wins for monochrome SVGs
  // (handled below); the dark variant exists for multi-color marks and
  // raster files that don't recolor cleanly. Falls back to `logoUrl`.
  const onDarkSurface = isDarkSurfaceForTone(brand, tone);
  const brandSrc = onDarkSurface && brand.logoUrlDark?.trim()
    ? brand.logoUrlDark.trim()
    : brand.logoUrl?.trim() ?? "";
  const src = (url && url.trim()) || brandSrc;
  const [aspect, setAspect] = useState<number | null>(null);
  if (!src) return null;

  const isSvg = src.toLowerCase().split("?")[0].endsWith(".svg");
  // Resolve the URL's pathname so a known multi-color mark is matched whether
  // it's referenced root-relative ("/dandy-logo.svg") or as an absolute URL.
  const pathname = (() => {
    try { return new URL(src, window.location.origin).pathname; }
    catch { return src; }
  })();
  const isKnownMulticolor = KNOWN_MULTICOLOR_LOGOS.has(pathname);
  // Runtime fallback stays `?? true` (no implicit behavior change for existing
  // monochrome-wordmark tenants); the multi-color opt-out is the only new gate.
  const autoRecolor = isSvg && !isKnownMulticolor && (brand.logoAutoRecolor ?? true);

  // A logo that can't be auto-recolored (raster file or a known multi-color
  // mark) renders as a plain `<img>` in its native colors. On a dark surface
  // that's typically a dark mark → invisible "dark-on-dark". When the tenant
  // hasn't supplied a dedicated dark asset (`logoUrlDark`) for us to swap in,
  // force the mark to a clean white silhouette via the same filter the partner
  // logos already use, so it always reads on dark headers/heroes.
  const usingDedicatedDarkAsset =
    onDarkSurface && !(url && url.trim()) && !!brand.logoUrlDark?.trim();
  const whitenForDark = onDarkSurface && !usingDedicatedDarkAsset;

  if (!autoRecolor) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={whitenForDark ? { ...style, filter: "brightness(0) invert(1)" } : style}
      />
    );
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
