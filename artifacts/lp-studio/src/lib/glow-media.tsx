/**
 * Glow media toolkit — shared by the "Stack" block family (glow-video-hero,
 * video-step-showcase, glow-stat-band, video-zigzag, benchmark-bars,
 * video-card-trio, glow-final-cta).
 *
 * The family's signature is product video that reads as a GRAPHIC rather
 * than an embedded player: the clip sits inside a soft gradient-glow panel,
 * is blended into that panel (multiply on light surfaces / screen on dark, so
 * a white-UI screen recording loses its rectangle), and fades out along its
 * bottom edge. No controls, no chrome, muted, looping, playing only while on
 * screen.
 *
 * Contract notes:
 *  - Visibility is never gated on the video: an image poster, or the built-in
 *    placeholder graphic, always renders. Play/pause on intersection is video
 *    PACING, a deliberate fail-open exclusion (see lib/reveal-fallback.ts).
 *  - Under StaticRenderContext (template previews, thumbnails, builder canvas)
 *    the video still mounts muted/looping — the first frame is the poster.
 *  - Every color decision derives from the resolved section surface through
 *    `resolveGlowPalette`, so brand palettes that flip a "light" block dark
 *    still get AA inks.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
  relativeLuminance,
} from "@/lib/brand-config";
import { mixHex, resolveSectionInk } from "@/lib/section-ink";
import { useStaticRender } from "@/lib/reveal-fallback";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "@/lib/video-utils";
import { extractWistiaId } from "@/lib/wistia";
import { InlineImage } from "@/components/InlineImage";
import { Volume2, VolumeX } from "lucide-react";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";

export const GLOW_DISPLAY = BRAND_DISPLAY_STACK;
export const GLOW_BODY = BRAND_BODY_STACK;
export const GLOW_NUMBERS = BRAND_NUMBERS_STACK;

/** Warm off-white page surface the family defaults to (Ramp-style paper). */
export const GLOW_LIGHT_BG = "#F5F4F0";
/** Near-black band surface. */
export const GLOW_DARK_BG = "#121212";

/** How media is composited into its glow panel. "auto" = multiply on light,
 *  screen on dark. "none" = ordinary opaque media. */
export type MediaBlend = "auto" | "multiply" | "screen" | "none";
export type MediaAspect = "16/9" | "4/3" | "3/2" | "1/1" | "21/9";
export type MediaPlayMode = "inview" | "hover" | "always";

export const MEDIA_ASPECT_CSS: Record<MediaAspect, string> = {
  "16/9": "16 / 9",
  "4/3": "4 / 3",
  "3/2": "3 / 2",
  "1/1": "1 / 1",
  "21/9": "21 / 9",
};

/* ── Palette ─────────────────────────────────────────────────────────────── */

export interface GlowStyleProps {
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  glowColor?: string;
  ctaButtonColor?: string;
  ctaButtonTextColor?: string;
}

export interface GlowPalette {
  /** Resolved solid section surface (hex). */
  bg: string;
  dark: boolean;
  text: string;
  muted: string;
  hairline: string;
  /** Accent for chips / links / small emphasis — ≥ 3:1 on the surface. */
  accent: string;
  /** Eyebrow / small-caps ink — ≥ 4.5:1 on the surface. */
  eyebrow: string;
  /** Free glow tint (no contrast need — it's decoration). */
  glow: string;
  /** Solid base a glow panel is painted on (a shade off the section). */
  panel: string;
  /** Card surface for bordered cards sitting on the section. */
  card: string;
  cardBorder: string;
  cta: { bg: string; text: string };
}

const hex = (v: string | undefined): v is string => !!v && isValidHex(v);

export function resolveGlowPalette(
  props: GlowStyleProps,
  brand: BrandConfig,
  fallbackBg: string = GLOW_LIGHT_BG,
): GlowPalette {
  const bg = hex(props.bgColor) ? props.bgColor : fallbackBg;
  const dark = relativeLuminance(bg) < 0.35;
  const ink = resolveSectionInk(props, { base: bg });
  const brandAccent = hex(brand.accentColor) ? brand.accentColor : "#3B82F6";
  const brandPrimary = hex(brand.primaryColor) ? brand.primaryColor : "#0F172A";
  const glow = hex(props.glowColor) ? props.glowColor : brandAccent;
  const accentPref = hex(props.accentColor) ? props.accentColor : brandAccent;
  const accent = pickContrastingColor(accentPref, bg, [brandPrimary, ink.text], 3.0);
  const eyebrow = pickContrastingColor(accentPref, bg, [brandPrimary, ink.text], 4.5);
  const panel = dark ? mixHex("#FFFFFF", bg, 0.07) : mixHex("#000000", bg, 0.035);
  const card = dark ? mixHex("#FFFFFF", bg, 0.05) : mixHex("#FFFFFF", bg, 0.6);
  const cardBorder = dark ? "rgba(255,255,255,0.09)" : "rgba(11,11,15,0.08)";

  let cta = pickCtaButtonColors(brand, bg);
  if (hex(props.ctaButtonColor)) {
    const b = props.ctaButtonColor;
    cta = {
      bg: b,
      text: pickContrastingColor(
        hex(props.ctaButtonTextColor) ? props.ctaButtonTextColor : undefined,
        b,
        [relativeLuminance(b) < 0.4 ? "#FFFFFF" : "#0B0B0F"],
        4.5,
      ),
    };
  } else if (hex(props.ctaButtonTextColor)) {
    cta = { ...cta, text: pickContrastingColor(props.ctaButtonTextColor, cta.bg, [cta.text], 4.5) };
  }

  return { bg, dark, text: ink.text, muted: ink.muted, hairline: ink.hairline, accent, eyebrow, glow, panel, card, cardBorder, cta };
}

export function resolveBlend(blend: MediaBlend | undefined, dark: boolean): CSSProperties["mixBlendMode"] {
  const b = blend ?? "auto";
  if (b === "none") return "normal";
  if (b === "auto") return dark ? "screen" : "multiply";
  return b;
}

/* ── Glow panel ──────────────────────────────────────────────────────────── */

export interface GlowPanelProps {
  palette: Pick<GlowPalette, "glow" | "panel" | "dark">;
  className?: string;
  style?: CSSProperties;
  /** Where the strongest glow sits. Default "bottom-left". */
  glowFrom?: "bottom-left" | "bottom-right" | "bottom" | "top";
  /** 0–1 glow strength. Default 0.9 on light, 0.55 on dark. */
  intensity?: number;
  radius?: number;
  children?: ReactNode;
}

export function glowBackground(
  palette: Pick<GlowPalette, "glow" | "panel" | "dark">,
  glowFrom: GlowPanelProps["glowFrom"] = "bottom-left",
  intensity?: number,
): string {
  const i = intensity ?? (palette.dark ? 0.55 : 0.9);
  const strong = `color-mix(in srgb, ${palette.glow} ${Math.round(72 * i)}%, transparent)`;
  const soft = `color-mix(in srgb, ${palette.glow} ${Math.round(34 * i)}%, transparent)`;
  const spots: Record<NonNullable<GlowPanelProps["glowFrom"]>, string> = {
    "bottom-left": `radial-gradient(70% 62% at 8% 104%, ${strong} 0%, transparent 68%), radial-gradient(42% 56% at 104% 44%, ${soft} 0%, transparent 70%)`,
    "bottom-right": `radial-gradient(70% 62% at 92% 104%, ${strong} 0%, transparent 68%), radial-gradient(42% 56% at -4% 44%, ${soft} 0%, transparent 70%)`,
    bottom: `radial-gradient(84% 70% at 50% 108%, ${strong} 0%, transparent 70%)`,
    top: `radial-gradient(84% 70% at 50% -8%, ${strong} 0%, transparent 70%)`,
  };
  return `${spots[glowFrom ?? "bottom-left"]}, ${palette.panel}`;
}

/** Rounded gradient-glow surface every media graphic sits on. */
export function GlowPanel({ palette, className, style, glowFrom, intensity, radius = 28, children }: GlowPanelProps) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        borderRadius: radius,
        background: glowBackground(palette, glowFrom, intensity),
        boxShadow: palette.dark
          ? "inset 0 1px 0 rgba(255,255,255,0.06)"
          : "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,15,20,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Placeholder graphic ─────────────────────────────────────────────────── */

export type PlaceholderVariant = "board" | "chart" | "list" | "sheet";

/**
 * Abstract product-UI graphic used when a slot has neither video nor image,
 * so an unconfigured block still reads as designed (catalog thumbnails, fresh
 * inserts, AI drafts before media is attached). Pure CSS; the shimmer is
 * disabled under reduced motion and static render.
 */
export function PlaceholderUi({
  variant = "board",
  palette,
  className,
}: {
  variant?: PlaceholderVariant;
  palette: Pick<GlowPalette, "dark" | "accent" | "glow">;
  className?: string;
}) {
  const staticRender = useStaticRender();
  const card = palette.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.86)";
  const line = palette.dark ? "rgba(255,255,255,0.22)" : "rgba(11,11,15,0.14)";
  const lineSoft = palette.dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.07)";
  const border = palette.dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.06)";
  const rows = variant === "list" ? 5 : variant === "sheet" ? 6 : 3;

  return (
    <div className={cn("gm-ph absolute inset-0 flex items-end justify-center p-[6%] pointer-events-none select-none", className)} aria-hidden="true">
      <style>{`
        .gm-ph-shimmer { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%); transform: translateX(-100%); }
        .gm-ph-live .gm-ph-shimmer { animation: gm-ph-sweep 4.5s ease-in-out infinite; }
        @keyframes gm-ph-sweep { 0% { transform: translateX(-100%);} 60%, 100% { transform: translateX(100%);} }
        @media (prefers-reduced-motion: reduce) { .gm-ph-shimmer { animation: none !important; } }
      `}</style>
      <div
        className={cn("relative w-full h-full rounded-2xl overflow-hidden", !staticRender && "gm-ph-live")}
        style={{ background: card, border: `1px solid ${border}`, boxShadow: "0 24px 60px -30px rgba(15,15,20,0.35)" }}
      >
        <div className="gm-ph-shimmer" />
        {/* title bar */}
        <div className="flex items-center gap-2 px-[5%] pt-[4%] pb-[3%]" style={{ borderBottom: `1px solid ${border}` }}>
          <span className="block rounded-full" style={{ width: 10, height: 10, background: palette.accent }} />
          <span className="block rounded-full" style={{ height: 8, width: "22%", background: line }} />
          <span className="ml-auto block rounded-full" style={{ height: 14, width: "16%", background: `color-mix(in srgb, ${palette.glow} 55%, transparent)` }} />
        </div>
        {variant === "chart" ? (
          <div className="absolute left-[5%] right-[5%] bottom-[8%] top-[28%] flex items-end gap-[3%]">
            {[38, 56, 44, 72, 60, 84, 66, 92].map((h, i) => (
              <span
                key={i}
                className="block flex-1 rounded-t-md"
                style={{ height: `${h}%`, background: i === 7 ? palette.accent : lineSoft, opacity: i === 7 ? 1 : 0.9 }}
              />
            ))}
          </div>
        ) : (
          <div className="px-[5%] pt-[4%] space-y-[3.2%]">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-[3%]">
                <span className="block rounded-md shrink-0" style={{ width: 16, height: 16, background: i === 0 ? palette.accent : lineSoft }} />
                <span className="block rounded-full" style={{ height: 8, width: `${[46, 62, 38, 54, 44, 58][i % 6]}%`, background: i === 0 ? line : lineSoft }} />
                {variant !== "list" && (
                  <span className="ml-auto block rounded-full" style={{ height: 8, width: "12%", background: lineSoft }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Blend media ─────────────────────────────────────────────────────────── */

const EMBED_HOST_RE = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia\.com|wistia\.net)$/i;

/**
 * True only for third-party player links (YouTube / Vimeo / Loom / Wistia).
 * Everything else — including EXTENSION-LESS media-library uploads such as
 * `/api/storage/objects/uploads/<id>` — is played as a native <video>, which
 * is what the blend / edge-fade / in-view pacing contract needs.
 * (`isNativeVideoUrl` alone is extension-based and would misroute library
 * uploads into an <iframe>.)
 */
export function isEmbedVideoUrl(url: string): boolean {
  if (!url) return false;
  if (isNativeVideoUrl(url)) return false;
  if (extractWistiaId(url)) return true;
  try {
    const host = new URL(url, "http://local.invalid").hostname.replace(/^www\./, "");
    return EMBED_HOST_RE.test(host);
  } catch {
    return false;
  }
}

export interface BlendMediaProps {
  videoUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  blend?: MediaBlend;
  /** Fade the media out along its bottom edge into the panel. */
  edgeFade?: boolean;
  aspect?: MediaAspect;
  /** "cover" fills the frame; "contain" letterboxes (transparent bars blend away). */
  fit?: "cover" | "contain";
  /** inview (default): play while on screen. hover: play on pointer-over. always: never pause. */
  playMode?: MediaPlayMode;
  /** When false the video is paused regardless of mode (stepper inactive panels). */
  active?: boolean;
  /** Native video only: a small unmute pill (Ramp's "Play with sound"). */
  showSoundToggle?: boolean;
  soundToggleLabel?: string;
  palette: Pick<GlowPalette, "dark" | "accent" | "glow">;
  placeholder?: PlaceholderVariant;
  className?: string;
  style?: CSSProperties;
  title?: string;
  onImageUpdate?: (url: string) => void;
  onAltUpdate?: (alt: string) => void;
  onFocalUpdate?: (focal: string) => void;
}

/**
 * The family's media element: native video (autoplay/muted/loop, paused off
 * screen), a third-party embed, an inline-editable image, or the placeholder
 * graphic — blended into the glow panel it sits on.
 */
export function BlendMedia({
  videoUrl,
  imageUrl,
  imageAlt,
  imageFocal,
  blend,
  edgeFade = true,
  aspect = "16/9",
  fit = "cover",
  playMode = "inview",
  active = true,
  showSoundToggle,
  soundToggleLabel,
  palette,
  placeholder = "board",
  className,
  style,
  title,
  onImageUpdate,
  onAltUpdate,
  onFocalUpdate,
}: BlendMediaProps) {
  const staticRender = useStaticRender();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(playMode !== "inview");
  const [hovering, setHovering] = useState(false);
  const [muted, setMuted] = useState(true);

  const embed = !!videoUrl && isEmbedVideoUrl(videoUrl);
  const native = !!videoUrl && !embed;
  const mix = resolveBlend(blend, palette.dark);

  // Video PACING only — visibility never depends on this observer.
  useEffect(() => {
    if (!native || playMode !== "inview" || staticRender) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [native, playMode, staticRender]);

  const shouldPlay =
    native && active && (playMode === "always" || (playMode === "inview" && inView) || (playMode === "hover" && hovering));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (shouldPlay) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
      if (playMode === "hover") {
        try { v.currentTime = 0; } catch { /* not seekable yet */ }
      }
    }
  }, [shouldPlay, playMode, videoUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const mediaStyle: CSSProperties = {
    mixBlendMode: mix,
    objectFit: fit,
    objectPosition: imageFocal,
  };
  const fadeStyle: CSSProperties = edgeFade
    ? {
        WebkitMaskImage: "linear-gradient(to bottom, #000 74%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, #000 74%, transparent 100%)",
      }
    : {};

  const hasMedia = !!videoUrl || !!imageUrl || !!onImageUpdate;

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio: MEDIA_ASPECT_CSS[aspect], ...style }}
      onMouseEnter={playMode === "hover" ? () => setHovering(true) : undefined}
      onMouseLeave={playMode === "hover" ? () => setHovering(false) : undefined}
      onTouchStart={playMode === "hover" ? () => setHovering((h) => !h) : undefined}
    >
      {!hasMedia && <PlaceholderUi variant={placeholder} palette={palette} />}

      {hasMedia && (
        <div className="absolute inset-0" style={fadeStyle}>
          {native ? (
            <video
              ref={videoRef}
              key={videoUrl}
              src={videoUrl}
              poster={imageUrl || undefined}
              className="absolute inset-0 w-full h-full"
              style={mediaStyle}
              muted
              loop
              playsInline
              autoPlay={playMode === "always" || staticRender}
              preload={active ? "metadata" : "none"}
              aria-label={title}
            />
          ) : embed ? (
            <iframe
              src={active ? getAutoplayEmbedUrl(videoUrl as string) : undefined}
              className="absolute inset-0 w-full h-full border-0"
              style={{ mixBlendMode: mix }}
              title={title || "Product video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <InlineImage
              src={imageUrl || ""}
              alt={imageAlt ?? ""}
              wrapperClassName="absolute inset-0"
              className="absolute inset-0 w-full h-full"
              style={mediaStyle}
              loading="lazy"
              focalPoint={imageFocal}
              onUpdate={onImageUpdate}
              onAltUpdate={onAltUpdate}
              onFocalUpdate={onFocalUpdate}
            />
          )}
        </div>
      )}

      {native && showSoundToggle && !staticRender && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium backdrop-blur-md transition-colors"
            style={{
              background: palette.dark ? "rgba(255,255,255,0.14)" : "rgba(11,11,15,0.78)",
              color: "#FFFFFF",
              boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)",
            }}
            aria-pressed={!muted}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" aria-hidden /> : <Volume2 className="w-3.5 h-3.5" aria-hidden />}
            <span>{soundToggleLabel || (muted ? "Play with sound" : "Mute")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Small shared pieces ─────────────────────────────────────────────────── */

/** Section header lockup: optional eyebrow + headline + subheadline, centered
 *  or left. Children are the InlineText-wrapped nodes so each block keeps
 *  control of its field bindings. */
export function sectionShell(extra?: string): string {
  return cn("relative w-full max-w-[1200px] mx-auto px-6 lg:px-10", extra);
}

export const DISPLAY_TRACKING = "-0.035em";
