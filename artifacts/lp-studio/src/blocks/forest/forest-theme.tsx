/**
 * Forest theme — shared by the "DSO Page" block family (forest-*), Nov 2026.
 *
 * The family is the premium "Dandy for DSOs" page Charlotte designed as an
 * artifact: full-bleed bands alternating white / warm sand / deep forest, a
 * 1240px content column, display type set light with tight tracking, lime
 * pill buttons set in small uppercase tracking, hairline rules, letter-spaced
 * eyebrows with a short rule in front, round soft-shadow cards, count-up
 * numbers, a sticky scrollytelling section and a canvas "convergence" moment.
 *
 * Every colour derives from the tenant brand through the shared section
 * surface system (`backgroundStyle` preset + custom `bgColor`) and the ABM
 * palette resolver, so the same blocks read correctly for any brand: the
 * "forest" is the brand primary, the "lime" is the brand accent, the sand is
 * the "muted" preset. Nothing here is Dandy-specific.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { useInView, type TargetAndTransition } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor, contrastTextColor, relativeLuminance } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { resolveAbmPalette, type AbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { useAnimInitial, useRevealFallback } from "@/lib/reveal-fallback";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { CtaButton } from "@/components/CtaButton";
import { InlineText } from "@/components/InlineText";
import { StatCounter } from "@/blocks/StatCounter";
import type { AbmCtaProps } from "@/blocks/abm/AbmCta";
import { cn } from "@/lib/utils";

export const FOREST_DISPLAY = BRAND_DISPLAY_STACK;
export const FOREST_BODY = BRAND_BODY_STACK;
export const FOREST_NUMBERS = BRAND_NUMBERS_STACK;
export const FOREST_EASE = [0.16, 1, 0.3, 1] as const;

/** The style keys every forest-* block exposes (shared with the abm family). */
export type ForestStyleProps = AbmStyleProps;

/** The CTA field set (primary suite + secondary + button colour overrides). */
export type ForestCtaProps = AbmCtaProps;

export const FOREST_CTA_DEFAULTS: ForestCtaProps = {
  ctaText: "",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "",
  ctaSecondaryUrl: "#",
  ctaSecondaryAction: "url",
};

export interface ForestPalette extends AbmPalette {
  /** The section surface sunk toward black — the "green-deep" band behind heroes, the convergence stage and the close. */
  deep: string;
  /** Ink on dark surfaces that should read as warm cream rather than pure white. */
  cream: string;
  /** The accent as a translucent tint (badges, table highlight column). */
  accentTint: string;
  /** Ink that reads on a solid accent fill (the lime pill). */
  onAccent: string;
  /** Soft card shadow + hover shadow for the section's surface. */
  shadowCard: string;
  shadowHover: string;
  shadowElev: string;
}

/** The warm sand the artifact uses for its light bands — the family default for "muted" sections. */
export const FOREST_SAND = "#F6F4EE";
export const FOREST_BONE = "#FBFAF6";

/**
 * Resolve the family palette for a block. `fallbackBg` is used when the block
 * has neither a preset nor a custom colour (white, sand, or the brand primary).
 */
export function resolveForestPalette(props: ForestStyleProps, brand: BrandConfig, fallbackBg = "#FFFFFF"): ForestPalette {
  const pal = resolveAbmPalette(props, brand, fallbackBg);
  // mixHex(a, b, amount) keeps `amount` of a: 66% of the surface over black (the artifact's green-deep).
  const deep = pal.dark ? mixHex(pal.base, "#000000", 0.66) : pal.base;
  const cream = pal.dark ? "#FFFCEF" : pal.text;
  const accentHex = isValidHex(pal.accentDeco) ? pal.accentDeco : pal.accent;
  const onAccent = isValidHex(accentHex) ? (relativeLuminance(accentHex) < 0.4 ? "#FFFFFF" : (isValidHex(brand.primaryColor) && relativeLuminance(brand.primaryColor) < 0.25 ? brand.primaryColor : "#0B1410")) : "#0B1410";
  return {
    ...pal,
    deep,
    cream,
    accentTint: `color-mix(in srgb, ${accentHex} 14%, transparent)`,
    onAccent,
    shadowCard: pal.dark ? "0 1px 3px rgba(0,0,0,.3), 0 4px 16px rgba(0,0,0,.25)" : "0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.03)",
    shadowHover: pal.dark ? "0 4px 12px rgba(0,0,0,.35), 0 18px 44px rgba(0,0,0,.4)" : "0 4px 12px rgba(0,0,0,.06), 0 18px 44px rgba(0,0,0,.08)",
    shadowElev: "0 10px 36px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.04)",
  };
}

/** Primary pill fill + label colours, honouring per-block overrides. */
export function resolveForestButtonColors(props: ForestCtaProps, palette: ForestPalette): { bg: string; text: string } {
  const override = props.ctaButtonColor && isValidHex(props.ctaButtonColor) ? props.ctaButtonColor : undefined;
  const bg = override ?? palette.cta.bg;
  const textPref = props.ctaButtonTextColor && isValidHex(props.ctaButtonTextColor) ? props.ctaButtonTextColor : undefined;
  const anchor = isValidHex(bg) ? bg : palette.base;
  const text = pickContrastingColor(textPref, anchor, [palette.cta.text, contrastTextColor(anchor)], 4.5);
  return { bg, text };
}

/** Section container used by every block (the artifact's 1240px column). */
export const FOREST_CONTAINER = "mx-auto w-full max-w-[1240px] px-4 md:px-10";

/** Vertical rhythm of a standard band. */
export const FOREST_SECTION_PAD: CSSProperties = { paddingBlock: "clamp(88px, 10vw, 152px)" };

/** The pill button: 999 radius, 13px uppercase tracked label. */
export const FOREST_PILL = "forest-btn inline-flex min-h-[50px] items-center justify-center gap-3 rounded-full px-[30px] py-[15px] text-[13px] font-semibold uppercase tracking-[0.06em] leading-none whitespace-nowrap no-underline";
export const FOREST_PILL_SM = "forest-btn inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full px-[22px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.06em] leading-none whitespace-nowrap no-underline";

export const FOREST_CSS = `
  .forest-btn { border: 1px solid transparent; transition: transform .5s cubic-bezier(.16,1,.3,1), box-shadow .5s cubic-bezier(.16,1,.3,1), filter .3s, background .3s, border-color .3s; cursor: pointer; }
  .forest-btn svg { transition: transform .5s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .forest-btn:hover { transform: translateY(-2px); filter: brightness(1.05); } .forest-btn:hover svg { transform: translateX(4px); } }
  .forest-card { transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s cubic-bezier(.16,1,.3,1), border-color .4s; }
  @media (hover: hover) { .forest-card:hover { transform: translateY(-4px); } }
  .forest-link { transition: opacity .2s ease; }
  .forest-link svg { transition: transform .4s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .forest-link:hover { opacity: .8; } .forest-link:hover svg { transform: translateX(4px); } }
  @media (prefers-reduced-motion: reduce) { .forest-btn, .forest-btn svg, .forest-card, .forest-link svg { transition: none; } .forest-btn:hover, .forest-card:hover { transform: none; } }
`;

/** Display headline style: the brand display face set light with tight tracking. */
export function forestDisplay(size: string, color: string, weight = 400): CSSProperties {
  return { fontFamily: FOREST_DISPLAY, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: weight, color, textWrap: "balance" } as CSSProperties;
}

/** Eyebrow: 11px uppercase tracked label with a short rule in front. */
export function ForestEyebrow({ palette, className, style, children, rule = true }: { palette: ForestPalette; className?: string; style?: CSSProperties; children: ReactNode; rule?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em]", className)} style={{ color: palette.accent, fontFamily: FOREST_BODY, ...style }}>
      {rule && <span aria-hidden className="inline-block h-px w-[18px] shrink-0" style={{ background: "currentColor", opacity: 0.6 }} />}
      <span>{children}</span>
    </span>
  );
}

/** Arrow text link ("Read the story →") in small uppercase tracking. */
export function ForestArrowLink({ href, color, className, children, onClick, external }: { href?: string; color: string; className?: string; children: ReactNode; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; external?: boolean }) {
  const Icon = external ? ArrowUpRight : ArrowRight;
  return (
    <a href={href || "#"} onClick={onClick} className={cn("forest-link inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] no-underline", className)} style={{ color, fontFamily: FOREST_BODY }}>
      {children}
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  );
}

/** Check mark used by the feature lists. */
export function ForestCheck({ color, className }: { color: string; className?: string }) {
  return <Check className={cn("h-[18px] w-[18px] shrink-0 mt-[3px]", className)} style={{ color }} strokeWidth={2.2} aria-hidden />;
}

/** Smooth-scroll helper for in-page anchors; other hrefs navigate normally. */
export function forestAnchorClick(url?: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!url || !url.startsWith("#") || url.length < 2) return;
    const el = typeof document !== "undefined" ? document.getElementById(url.slice(1)) : null;
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
}

/**
 * Fail-open reveal helper (see lib/reveal-fallback.ts): a section ref, a
 * `show` flag that flips when the section scrolls into view (or after the
 * watchdog), and `rise(delay)` props for framer `motion.*` elements.
 */
export function useForestReveal<T extends HTMLElement = HTMLElement>(margin = "-60px") {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, margin: margin as never });
  const force = useRevealFallback(inView);
  const show = inView || force;
  const anim = useAnimInitial();
  const rise = (delay = 0, y = 26) => ({
    initial: anim({ opacity: 0, y }),
    animate: show ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 1, delay, ease: FOREST_EASE },
  });
  const fade = (delay = 0) => ({
    initial: anim({ opacity: 0 }),
    animate: show ? { opacity: 1 } : undefined,
    transition: { duration: 0.8, delay, ease: FOREST_EASE },
  });
  return { ref, show, anim, rise, fade };
}

/** A hidden framer initial that renders the final frame under static render. */
export type ForestAnimInitial = (from: TargetAndTransition) => TargetAndTransition | false;

/**
 * A big number: counts up on the live page (StatCounter), stays a plain
 * editable span in the builder so the value can be typed in place.
 */
export function ForestNumber({ value, onUpdate, style, className }: { value: string; onUpdate?: (v: string) => void; style?: CSSProperties; className?: string }) {
  const base: CSSProperties = { fontFamily: FOREST_NUMBERS, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1, fontWeight: 400, ...style };
  if (onUpdate) return <InlineText as="span" value={value} onUpdate={onUpdate} className={className} style={base} />;
  return <span className={className} style={base}><StatCounter value={value} style={base} /></span>;
}

interface CtaButtonsProps {
  props: ForestCtaProps;
  brand: BrandConfig;
  palette: ForestPalette;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  /** Inline-edit hook for the two labels (editor only). */
  onLabelChange?: (key: "ctaText" | "ctaSecondaryText", value: string) => void;
  source: string;
  align?: "start" | "center";
  className?: string;
  primaryOnly?: boolean;
  size?: "md" | "sm";
  /** Primary label arrow (the artifact's hero + close buttons carry one). */
  arrow?: boolean;
  /** Secondary style: "ghost" = outlined pill (default), "link" = quiet text link. */
  secondaryStyle?: "ghost" | "link";
  primaryPlaceholder?: string;
  secondaryPlaceholder?: string;
}

/** Primary (lime pill) + optional secondary (ghost pill or text link) wired through the shared CtaButton suite. */
export function ForestCtaButtons({ props, brand, palette, pageId, variantId, onCtaClick, onLabelChange, source, align = "start", className, primaryOnly, size = "md", arrow = true, secondaryStyle = "ghost", primaryPlaceholder = "Talk to the team", secondaryPlaceholder = "See how it works" }: CtaButtonsProps) {
  const isEditor = !!onLabelChange;
  const modalCfg = pickCtaModalConfig(props);
  const primary = resolveForestButtonColors(props, palette);
  const showPrimary = !!props.ctaText || isEditor;
  const showSecondary = !primaryOnly && (!!props.ctaSecondaryText || isEditor);
  if (!showPrimary && !showSecondary) return null;
  const pill = size === "sm" ? FOREST_PILL_SM : FOREST_PILL;
  const ghostBorder = palette.dark ? "rgba(255,252,239,0.18)" : palette.hairline;

  return (
    <div className={cn("flex flex-wrap items-center gap-3.5", align === "center" ? "justify-center" : "justify-start", className)}>
      {showPrimary && (
        <CtaButton
          ctaAction={props.ctaAction || "url"}
          ctaUrl={props.ctaUrl}
          chilipiperUrl={props.chilipiperUrl}
          videoUrl={props.videoUrl}
          videoPosterUrl={props.videoPosterUrl}
          {...modalCfg}
          onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source={`${source}-primary`}
          modalTheme={palette.dark ? "dark" : "light"}
          className={pill}
          style={{ background: primary.bg, color: primary.text, fontFamily: FOREST_BODY }}
        >
          <InlineText as="span" value={props.ctaText || primaryPlaceholder} onUpdate={onLabelChange ? (v) => onLabelChange("ctaText", v) : undefined} />
          {arrow && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />}
        </CtaButton>
      )}
      {showSecondary && (
        <CtaButton
          ctaAction={props.ctaSecondaryAction || "url"}
          ctaUrl={props.ctaSecondaryUrl}
          chilipiperUrl={props.secondaryChilipiperUrl}
          videoUrl={props.secondaryVideoUrl}
          {...modalCfg}
          onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source={`${source}-secondary`}
          modalTheme={palette.dark ? "dark" : "light"}
          className={secondaryStyle === "link" ? "forest-link inline-flex items-center gap-2 text-[15px] font-medium no-underline" : pill}
          style={secondaryStyle === "link"
            ? { background: "transparent", color: palette.text, fontFamily: FOREST_BODY, padding: 0 }
            : { background: "transparent", color: palette.outline.text, border: `1px solid ${ghostBorder}`, fontFamily: FOREST_BODY }}
        >
          <InlineText as="span" value={props.ctaSecondaryText || secondaryPlaceholder} onUpdate={onLabelChange ? (v) => onLabelChange("ctaSecondaryText", v) : undefined} />
          {secondaryStyle === "link" && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />}
        </CtaButton>
      )}
    </div>
  );
}

/** The SVG fractal-noise grain the artifact lays over its dark bands (opacity .05). */
export const FOREST_GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

export function ForestGrain({ opacity = 0.05 }: { opacity?: number }) {
  return <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: FOREST_GRAIN, backgroundSize: "180px 180px", opacity, zIndex: 0 }} />;
}

/* ── v2 refinements (Nov 2026): rings, section header rows, chrome ── */

/** 1px inset ring that keeps light cards crisp on sand/white (the v2 `--ring`). */
export const FOREST_RING = "inset 0 0 0 1px rgba(0,38,31,.06)";
export const FOREST_RING_DARK = "inset 0 0 0 1px rgba(255,252,239,.12)";

/** Card surface for the section: white on light bands, lifted on dark; ring + the section's soft shadow. */
export function forestCard(palette: ForestPalette, opts: { lift?: boolean; radius?: number; background?: string } = {}): CSSProperties {
  return {
    background: opts.background ?? palette.card,
    borderRadius: opts.radius ?? 22,
    boxShadow: `${palette.dark ? FOREST_RING_DARK : FOREST_RING}, ${opts.lift ? palette.shadowHover : palette.shadowCard}`,
  };
}

/**
 * Section header row: eyebrow + headline (+ lede) left, a quiet uppercase
 * arrow link on the headline's baseline at the right (≥800px). Nodes in, so
 * blocks keep their own InlineText wiring.
 */
export function ForestSectionHeader({ eyebrow, headline, lede, link, className, gap = "clamp(32px, 4vw, 48px)" }: { eyebrow?: ReactNode; headline: ReactNode; lede?: ReactNode; link?: ReactNode; className?: string; gap?: string }) {
  return (
    <div className={cn("grid items-end gap-3.5 min-[800px]:grid-cols-[minmax(0,1fr)_auto]", className)} style={{ marginBottom: gap }}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-[18px]">{eyebrow}</div>}
        {headline}
        {lede}
      </div>
      {link && <div className="pb-1.5">{link}</div>}
    </div>
  );
}

/** Browser-window chrome strip (three dots, a title, a right-aligned meta) for UI frames. */
export function ForestChrome({ palette, title, right, className }: { palette: ForestPalette; title?: ReactNode; right?: ReactNode; className?: string }) {
  const onDark = palette.dark;
  return (
    <div className={cn("flex items-center gap-2 px-3.5 py-2.5 text-[11.5px] font-medium", className)} style={{ borderBottom: `1px solid ${onDark ? "rgba(255,252,239,0.12)" : palette.hairline}`, color: palette.muted, fontFamily: FOREST_BODY }}>
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: "#E6B9B0" }} />
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: "#EAD7A4" }} />
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: "#BFD8C8" }} />
      {title && <span className="ml-2 min-w-0 truncate">{title}</span>}
      {right && <span className="ml-auto whitespace-nowrap tabular-nums" style={{ opacity: 0.7 }}>{right}</span>}
    </div>
  );
}

/** Dash shown before a competitor cell ("— $40–75K") so the provider column's check reads as the contrast. */
export function ForestDash({ color }: { color: string }) {
  return <span aria-hidden className="mr-2 inline-block h-[2px] w-3.5 rounded-[1px] align-middle" style={{ background: color }} />;
}
