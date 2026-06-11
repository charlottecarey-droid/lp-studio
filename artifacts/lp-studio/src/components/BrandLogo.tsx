import { useEffect, useState, type CSSProperties } from "react";
import { type BrandConfig, relativeLuminance } from "@/lib/brand-config";

export type BrandLogoTone = "onDark" | "onLight" | "onPrimary" | "onAccent";

const HEX6_RE = /^#[0-9a-f]{6}$/i;

/**
 * Brand marks that must NEVER be mask-recolored. The auto-recolor mask paints
 * the whole SVG silhouette one flat brand-primary color (great for a generic
 * monochrome wordmark), but it's wrong for a mark whose own color is part of
 * the brand — e.g. the Dandy mark would render as a solid brand-primary
 * (pink/coral) blob instead of its native green. These paths opt out explicitly
 * so they render as a plain `<img>` in their native colors on light surfaces,
 * regardless of the `logoAutoRecolor` setting.
 *
 * This opt-out is SCOPED to mask-recolor only. On a DARK surface these marks
 * still go through the pixel-sample-gated white-silhouette path below, so a
 * single-color mark (like Dandy's green) lightens to read on dark, while a
 * genuinely multi-color mark is left native by the sample.
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
  autoContrast = false,
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
  // Whitening a mark to a flat silhouette reads great for a dark monochrome
  // wordmark but DESTROYS a genuinely multi-color mark (renders it as a solid
  // white blob — the Clay-on-dark-footer bug). So whitening is a *candidate*
  // here, resolved below by the pixel-sample alone: it stays on by default (the
  // safety net for dark wordmarks) and is suppressed once a sample proves the
  // mark isn't predominantly dark (multi-color or light → already reads on dark).
  //
  // NOTE: `isKnownMulticolor` deliberately does NOT gate this. That set only
  // opts a mark out of the brand-primary *mask-recolor* (so the single-color
  // Dandy mark stays its native green on light surfaces instead of turning
  // pink). On a dark surface that same single-color mark SHOULD whiten to a
  // clean silhouette like it used to — and the sample correctly keeps it on
  // (Dandy green samples dark) while a true multi-color mark is suppressed.
  const whitenCandidate =
    onDarkSurface && !usingDedicatedDarkAsset && !autoRecolor;

  // Symmetric guard for the *light* direction (opt-in via `autoContrast`). A
  // non-recolorable logo on a light surface renders in its native colors — fine
  // for a normal dark/colored mark (e.g. a colorful Clay raster), but a
  // white/light wordmark vanishes ("white-on-white"). The previous heuristic
  // darkened *any* single logo with no `logoUrlDark` to a solid black
  // silhouette — which destroyed colored marks (rendered them as a black blob).
  // Instead we pixel-sample the mark's luminance (logos are same-origin storage
  // assets, so the canvas isn't tainted) and only darken a *predominantly light*
  // mark. Cross-origin taint / load failure → leave native (the safe default
  // for the common dark/colored logo).
  const darkenCandidate =
    autoContrast &&
    !onDarkSurface &&
    !isKnownMulticolor &&
    !(url && url.trim()) &&
    !brand.logoUrlDark?.trim() &&
    !autoRecolor;

  const [aspect, setAspect] = useState<number | null>(null);
  // Average luminance (0-1) of the mark's non-transparent pixels. null = not
  // yet sampled, or sampling unavailable (cross-origin canvas taint / load
  // error). Drives BOTH the light-surface darken guard and the dark-surface
  // whiten guard.
  const [markLum, setMarkLum] = useState<number | null>(null);

  const needsSample = darkenCandidate || whitenCandidate;

  useEffect(() => {
    if (!src || !needsSample) {
      setMarkLum(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = 32;
        const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
        const h = Math.max(1, Math.round(ratio * w)) || w;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setMarkLum(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 16) continue; // ignore transparent padding
          sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          count++;
        }
        setMarkLum(count > 0 ? sum / count : null);
      } catch {
        setMarkLum(null);
      }
    };
    img.onerror = () => { if (!cancelled) setMarkLum(null); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, needsSample]);

  if (!src) return null;

  // Light surface: darken only a *predominantly light* mark (a white wordmark
  // that would vanish "white-on-white"). Default off so a colored mark never
  // flashes to black before the sample resolves.
  const darkenForLight = darkenCandidate && markLum !== null && markLum > 0.7;
  // Dark surface: keep the white-silhouette safety net ON by default (so a dark
  // wordmark always reads, no flash), but SUPPRESS it once a sample proves the
  // mark isn't predominantly dark — i.e. it's multi-color or light and already
  // reads on dark. An unsampleable cross-origin mark stays whitened (uploading
  // a dedicated dark logo is the way to show such a mark in its native colors).
  const whitenForDark = whitenCandidate && !(markLum !== null && markLum >= 0.35);

  if (!autoRecolor) {
    const plainFilter = whitenForDark
      ? "brightness(0) invert(1)"
      : darkenForLight
        ? "brightness(0)"
        : undefined;
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={plainFilter ? { ...style, filter: plainFilter } : style}
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
