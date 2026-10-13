/**
 * ABM account-page toolkit — the shared palette, type and small pieces behind
 * the "abm-*" block family (Oct 2026): a brand-aware replica of the
 * enterprise 1:1 account page idiom (Procore-style): a white site nav over a
 * dark split hero, white / warm-stone alternating sections, a kicker with an
 * accent dot, square-cornered accent buttons, arrow text links, big count-up
 * stats, a dark pull-quote card, logo rows and a dark ratings close.
 *
 * Every block resolves its surface through the shared background-preset
 * system (`backgroundStyle` dropdown + custom `bgColor`) and derives ALL inks
 * from the colour the section actually paints, so any brand — pale or dark —
 * stays legible. Nothing here is Procore-specific: the orange is the brand
 * accent, the black is a preset, the fonts are the brand's.
 */
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import {
  DEFAULT_BRAND,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
  pickOutlineButtonColors,
  relativeLuminance,
  resolveHeadingColor,
  resolveQuoteCardBg,
  type BrandConfig,
} from "@/lib/brand-config";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { contrastRatio, ensureAccentRegisters, mixHex, resolveSectionInk } from "@/lib/section-ink";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";

export const ABM_DISPLAY = BRAND_DISPLAY_STACK;
export const ABM_BODY = BRAND_BODY_STACK;
export const ABM_NUMBERS = BRAND_NUMBERS_STACK;
export const ABM_TRACKING = "-0.025em";

/** The style keys every abm-* block exposes (the background dropdown + inks). */
export interface AbmStyleProps {
  /** Shared background preset (white / light-gray / muted / dark / brand / black / gradient). */
  backgroundStyle?: string;
  /** Custom hex when no preset is chosen. */
  bgColor?: string;
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
}

export interface AbmPalette {
  /** CSS background value for the section (solid or gradient). */
  bg: string;
  /** Representative solid hex for contrast math. */
  base: string;
  dark: boolean;
  text: string;
  muted: string;
  hairline: string;
  heading: string;
  /** Accent as INK (kickers, links, icons) — AA against the surface. */
  accent: string;
  /** Accent as DECORATION (dots, underlines, tints) — only has to register. */
  accentDeco: string;
  /** Primary filled button on this surface. */
  cta: { bg: string; text: string };
  /** Outline / ghost button on this surface. */
  outline: { border: string; text: string };
  /** A quiet raised surface one step off the section (tab chips, icon tiles). */
  panel: string;
  /** A card surface that reads as "white" on light sections, lifted on dark. */
  card: string;
  /** The contrast "quote card" (dark brand primary on light sections, light on dark). */
  contrastCard: string;
  contrastCardDark: boolean;
}

/**
 * Resolve the family palette for a block. `fallbackBg` is the hex used when the
 * block has neither a preset nor a custom colour (each block picks the
 * reference page's surface: white, warm stone, or near-black).
 */
export function resolveAbmPalette(props: AbmStyleProps, brand: BrandConfig, fallbackBg = "#FFFFFF"): AbmPalette {
  const surface = resolveSectionSurface(props, fallbackBg, brand);
  const base = surface.base;
  const dark = surface.isDark;
  const ink = resolveSectionInk({ textColor: props.textColor }, surface);

  const brandAccent = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  const brandPrimary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accentPref = props.accentColor && isValidHex(props.accentColor) ? props.accentColor : brandAccent;
  const accent = pickContrastingColor(accentPref, base, [brandAccent, brandPrimary, ink.text], 4.5);
  const accentDeco = ensureAccentRegisters(accentPref, surface, 1.6);

  const headingPref = props.headingColor && isValidHex(props.headingColor) && contrastRatio(props.headingColor, base) >= 4.5
    ? props.headingColor
    : undefined;
  const heading = pickContrastingColor(headingPref, base, [resolveHeadingColor(brand, dark), ink.text], 4.5);

  const cta = pickCtaButtonColors(brand, base);
  const outline = pickOutlineButtonColors(brand, base);

  const panel = dark ? mixHex(base, "#FFFFFF", 0.9) : mixHex(base, "#000000", 0.955);
  const card = dark ? mixHex(base, "#FFFFFF", 0.92) : "#FFFFFF";
  const contrastCard = resolveQuoteCardBg(brand, accentPref, base);
  const contrastCardDark = isValidHex(contrastCard) ? relativeLuminance(contrastCard) < 0.4 : false;

  return {
    bg: surface.background,
    base,
    dark,
    text: ink.text,
    muted: ink.muted,
    hairline: ink.hairline,
    heading,
    accent,
    accentDeco,
    cta,
    outline,
    panel,
    card,
    contrastCard,
    contrastCardDark,
  };
}

/** Inks for text sitting on an arbitrary solid surface (cards, the quote card). */
export function inksOn(surfaceHex: string, preferred?: string): { text: string; muted: string; hairline: string } {
  const ink = resolveSectionInk({ textColor: preferred }, { base: isValidHex(surfaceHex) ? surfaceHex : "#FFFFFF" });
  return ink;
}

/** Display headline style: tight tracking, brand display face. */
export function displayStyle(size: string, color: string, weight = 600): CSSProperties {
  return { fontFamily: ABM_DISPLAY, fontSize: size, lineHeight: 1.08, letterSpacing: ABM_TRACKING, fontWeight: weight, color };
}

/** Section container used by every block. */
export const ABM_CONTAINER = "mx-auto w-full max-w-[1200px] px-6 lg:px-10";

/** The reference page's square-ish button: 6px radius, 16px/14px padding, 15px semibold. */
export const ABM_BUTTON_CLASS =
  "abm-btn inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-[15px] font-semibold leading-none no-underline";

export const ABM_CSS = `
  .abm-btn { transition: transform .22s cubic-bezier(.16,1,.3,1), filter .22s ease, box-shadow .22s ease; cursor: pointer; }
  @media (hover: hover) { .abm-btn:hover { transform: translateY(-1px); filter: brightness(1.05); } }
  .abm-link { transition: gap .2s ease, opacity .2s ease; }
  @media (hover: hover) { .abm-link:hover { opacity: .85; } .abm-link:hover svg { transform: translateX(2px); } }
  .abm-link svg { transition: transform .2s ease; }
  @media (prefers-reduced-motion: reduce) { .abm-btn, .abm-btn:hover, .abm-link svg { transition: none; transform: none; } }
`;

/** Kicker: small uppercase tracked label with an accent dot in front. */
export function AbmKicker({ palette, dot = true, className, children }: { palette: AbmPalette; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em]", className)} style={{ color: palette.accent, fontFamily: ABM_BODY }}>
      {dot && <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: palette.accentDeco }} />}
      <span>{children}</span>
    </div>
  );
}

/** Arrow text link ("Explore all integrations →"). */
export function AbmArrowLink({ href, color, className, children, onClick }: { href?: string; color: string; className?: string; children: ReactNode; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <a href={href || "#"} onClick={onClick} className={cn("abm-link inline-flex items-center gap-1.5 text-[15px] font-semibold no-underline", className)} style={{ color }}>
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}

/** Smooth-scroll helper for in-page anchors; other hrefs navigate normally. */
export function anchorClick(url?: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!url || !url.startsWith("#") || url.length < 2) return;
    const el = typeof document !== "undefined" ? document.getElementById(url.slice(1)) : null;
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
}

/** Initials for a headshot / logo fallback ("Dinakar Vadlamani" → "DV"). */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
