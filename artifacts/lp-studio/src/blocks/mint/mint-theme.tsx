/**
 * Mint theme — shared by the "DSO Page (Light)" block family (mint-*), Nov 2026.
 *
 * The second "Dandy for DSOs" artifact Charlotte designed, in the Ramp /
 * Apple register: a 980px reading column on white alternating with pale
 * grey bands, one full-bleed photo band, feature rows that alternate image
 * and text, centred display headlines with a lime highlight under one
 * phrase, quiet chevron links instead of big buttons, tinted rounded cards
 * (mint, soft lime, grey, deep green), small floating "UI" cards, and
 * motion limited to fade-up and a gentle image scale.
 *
 * Every colour derives from the tenant brand through the shared section
 * surface system and the ABM palette resolver: the "green" is the brand
 * primary, the "lime" is the brand accent, the mint and soft lime are
 * light mixes of those two, the grey band is the "light-gray" preset.
 */
import type { CSSProperties, ReactNode } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor, contrastTextColor, relativeLuminance, DEFAULT_BRAND } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { resolveAbmPalette, type AbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { CtaButton } from "@/components/CtaButton";
import { InlineText } from "@/components/InlineText";
import type { AbmCtaProps } from "@/blocks/abm/AbmCta";
import { cn } from "@/lib/utils";

export { useForestReveal as useMintReveal, ForestNumber as MintNumber, forestAnchorClick as mintAnchorClick, FOREST_EASE as MINT_EASE, FOREST_CTA_DEFAULTS as MINT_CTA_DEFAULTS } from "@/blocks/forest/forest-theme";

export const MINT_DISPLAY = BRAND_DISPLAY_STACK;
export const MINT_BODY = BRAND_BODY_STACK;
export const MINT_NUMBERS = BRAND_NUMBERS_STACK;

/** The style keys every mint-* block exposes (shared with the abm/forest families). */
export type MintStyleProps = AbmStyleProps;
/** The CTA field set (primary suite + secondary + button colour overrides). */
export type MintCtaProps = AbmCtaProps;

export interface MintPalette extends AbmPalette {
  /** The brand primary as a solid ("green"): pills, check dots, link ink on light surfaces. */
  green: string;
  /** The brand primary sunk toward black ("green-deep"): the photo band and player chrome. */
  deep: string;
  /** Lime accent as a solid (highlight bars, lime pill). */
  lime: string;
  /** Ink that reads on a solid lime fill. */
  onLime: string;
  /** Ink that reads on a solid green fill. */
  onGreen: string;
  /** Pale tint of the primary ("mint") for cards and UI mock stages. */
  mint: string;
  /** A step darker mint for bars and tracks. */
  mint2: string;
  /** Pale tint of the accent ("lime-soft") for cards. */
  limeSoft: string;
  /** The pale grey band / card surface. */
  grey: string;
  /** Hairline on light surfaces. */
  line: string;
  /** The ink pair the artifact uses on light surfaces. */
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  /** Warm cream + its muted variant for copy on green/deep surfaces. */
  cream: string;
  creamMuted: string;
}

export const MINT_GREY = "#F5F5F3";

/** Resolve the family palette for a block. `fallbackBg` is used when the block has neither a preset nor a custom colour. */
export function resolveMintPalette(props: MintStyleProps, brand: BrandConfig, fallbackBg = "#FFFFFF"): MintPalette {
  const pal = resolveAbmPalette(props, brand, fallbackBg);
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accentHex = props.accentColor && isValidHex(props.accentColor) ? props.accentColor : (isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor);
  // A pale brand primary cannot carry cream text; sink it until it can.
  // mixHex(a, b, amount) keeps `amount` of a: 55% primary over black.
  const green = relativeLuminance(primary) > 0.25 ? mixHex(primary, "#000000", 0.55) : primary;
  const deep = mixHex(green, "#000000", 0.66);
  const lime = accentHex;
  const onLime = relativeLuminance(lime) < 0.4 ? "#FFFFFF" : green;
  const onGreen = "#FFFCEF";
  const ink = pal.dark ? pal.text : (props.textColor && isValidHex(props.textColor) ? props.textColor : "#1D1D1F");
  const inkMuted = pal.dark ? pal.muted : "#6E6E73";
  const inkSubtle = pal.dark ? pal.muted : "#A1A1A6";
  return {
    ...pal,
    green,
    deep,
    lime,
    onLime,
    onGreen,
    mint: mixHex(green, "#FFFFFF", 0.07),
    mint2: mixHex(green, "#FFFFFF", 0.14),
    limeSoft: mixHex(lime, "#FFFFFF", 0.22),
    grey: MINT_GREY,
    line: pal.dark ? pal.hairline : "#E5E5E3",
    ink,
    inkMuted,
    inkSubtle,
    cream: "#FFFCEF",
    creamMuted: "rgba(255,252,239,0.7)",
  };
}

/** The reading column (980px) and the wide column (1200px) with the artifact's gutters. */
export const MINT_WRAP = "mx-auto w-full max-w-[980px] px-4 md:px-8";
export const MINT_WIDE = "mx-auto w-full max-w-[1200px] px-4 md:px-8";

/** Vertical rhythm of a standard band. */
export const MINT_SECTION_PAD: CSSProperties = { paddingBlock: "clamp(80px, 9vw, 130px)" };

/** Centred display headline: brand display face, light weight, tight tracking. */
export function mintDisplay(size: string, color: string, weight = 400): CSSProperties {
  return { fontFamily: MINT_DISPLAY, fontSize: size, lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: weight, color, margin: 0, textWrap: "balance" } as CSSProperties;
}

/** The artifact's `.sub`: centred support copy, 40ch, muted. */
export function mintSub(color: string): CSSProperties {
  return { fontFamily: MINT_BODY, fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)", lineHeight: 1.45, color, maxWidth: "40ch", marginTop: 18, textWrap: "pretty" } as CSSProperties;
}

/** Lime highlight bar under a phrase (the artifact's `.hl`). */
export function mintHighlight(lime: string, alpha = 1): CSSProperties {
  const bar = alpha < 1 ? `color-mix(in srgb, ${lime} ${Math.round(alpha * 100)}%, transparent)` : lime;
  return { background: `linear-gradient(180deg, transparent 62%, ${bar} 62%, ${bar} 92%, transparent 92%)`, padding: "0 0.06em" };
}

export const MINT_CSS = `
  .mint-link { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; text-decoration: none; }
  .mint-link::after { content: ""; width: 7px; height: 7px; border-right: 1.6px solid currentColor; border-top: 1.6px solid currentColor; transform: rotate(45deg); margin-left: 4px; transition: transform .4s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .mint-link:hover::after { transform: rotate(45deg) translate(2px,-2px); } }
  .mint-btn { border: 0; transition: background .3s, transform .5s cubic-bezier(.16,1,.3,1), filter .3s; cursor: pointer; }
  @media (hover: hover) { .mint-btn:hover { transform: translateY(-1px); filter: brightness(1.06); } }
  .mint-card { transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .5s cubic-bezier(.16,1,.3,1), border-color .3s; }
  @media (hover: hover) { .mint-card:hover { transform: translateY(-3px); } }
  @media (prefers-reduced-motion: reduce) { .mint-link::after, .mint-btn, .mint-btn:hover, .mint-card, .mint-card:hover { transition: none; transform: none; } }
`;

/** The quiet chevron link ("Read the story ›"). */
export function MintLink({ href, color, className, style, children, onClick, size = 15 }: { href?: string; color: string; className?: string; style?: CSSProperties; children: ReactNode; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; size?: number }) {
  return (
    <a href={href || "#"} onClick={onClick} className={cn("mint-link", className)} style={{ color, fontFamily: MINT_BODY, fontSize: size, ...style }}>
      {children}
    </a>
  );
}

/** Kicker with a lime dot in front (feature rows, the router cross). */
export function MintKicker({ palette, className, style, children, uppercase = false }: { palette: MintPalette; className?: string; style?: CSSProperties; children: ReactNode; uppercase?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-medium", uppercase ? "text-[12px] font-semibold uppercase tracking-[0.1em]" : "text-[14px]", className)} style={{ color: palette.dark ? palette.lime : palette.green, fontFamily: MINT_BODY, ...style }}>
      <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: palette.lime }} />
      <span>{children}</span>
    </span>
  );
}

/** The 16px green check dot used in the comparison column and floating cards. */
export function MintCheckDot({ palette, lime = false, className }: { palette: MintPalette; lime?: boolean; className?: string }) {
  const bg = lime ? palette.lime : palette.green;
  const stroke = lime ? palette.onLime : "#FFFFFF";
  return (
    <span aria-hidden className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full", className)} style={{ background: bg }}>
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
    </span>
  );
}

export const MINT_PILL = "mint-btn inline-flex items-center justify-center rounded-full px-[26px] py-[14px] text-[15px] font-medium leading-none whitespace-nowrap no-underline";
export const MINT_PILL_SM = "mint-btn inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium leading-none whitespace-nowrap no-underline";

/** Primary pill fill + label colours, honouring per-block overrides. `tone` picks the artifact's green or lime pill. */
export function resolveMintButtonColors(props: MintCtaProps, palette: MintPalette, tone: "green" | "lime" = "green"): { bg: string; text: string } {
  const override = props.ctaButtonColor && isValidHex(props.ctaButtonColor) ? props.ctaButtonColor : undefined;
  const bg = override ?? (tone === "lime" ? palette.lime : palette.green);
  const textPref = props.ctaButtonTextColor && isValidHex(props.ctaButtonTextColor) ? props.ctaButtonTextColor : undefined;
  const anchor = isValidHex(bg) ? bg : palette.base;
  const text = pickContrastingColor(textPref, anchor, [tone === "lime" ? palette.onLime : palette.onGreen, contrastTextColor(anchor)], 4.5);
  return { bg, text };
}

interface CtaButtonsProps {
  props: MintCtaProps;
  brand: BrandConfig;
  palette: MintPalette;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onLabelChange?: (key: "ctaText" | "ctaSecondaryText", value: string) => void;
  source: string;
  align?: "start" | "center";
  className?: string;
  primaryOnly?: boolean;
  size?: "md" | "sm";
  /** "pill" = filled pill (green by default, "lime" tone available); "link" = the quiet chevron link pair the artifact's hero uses. */
  style?: "pill" | "link";
  tone?: "green" | "lime";
  primaryPlaceholder?: string;
  secondaryPlaceholder?: string;
}

/** Primary + optional secondary CTA through the shared CtaButton suite, as pills or as chevron links. */
export function MintCtaButtons({ props, brand, palette, pageId, variantId, onCtaClick, onLabelChange, source, align = "center", className, primaryOnly, size = "md", style = "pill", tone = "green", primaryPlaceholder = "Talk to the team", secondaryPlaceholder = "See the proof" }: CtaButtonsProps) {
  const isEditor = !!onLabelChange;
  const modalCfg = pickCtaModalConfig(props);
  const primary = resolveMintButtonColors(props, palette, tone);
  const showPrimary = !!props.ctaText || isEditor;
  const showSecondary = !primaryOnly && (!!props.ctaSecondaryText || isEditor);
  if (!showPrimary && !showSecondary) return null;
  const pill = size === "sm" ? MINT_PILL_SM : MINT_PILL;
  const linkInk = palette.dark ? palette.lime : palette.green;
  const linkClass = "mint-link text-[17px]";
  const common = { brand, pageId, variantId, modalTheme: (palette.dark ? "dark" : "light") as "dark" | "light", ...modalCfg };

  return (
    <div className={cn("flex flex-wrap items-center", style === "link" ? "gap-x-8 gap-y-3" : "gap-3", align === "center" ? "justify-center" : "justify-start", className)}>
      {showPrimary && (
        <CtaButton
          {...common}
          ctaAction={props.ctaAction || "url"}
          ctaUrl={props.ctaUrl}
          chilipiperUrl={props.chilipiperUrl}
          videoUrl={props.videoUrl}
          videoPosterUrl={props.videoPosterUrl}
          onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
          source={`${source}-primary`}
          className={style === "link" ? linkClass : pill}
          style={style === "link" ? { background: "transparent", color: linkInk, fontFamily: MINT_BODY, padding: 0 } : { background: primary.bg, color: primary.text, fontFamily: MINT_BODY }}
        >
          <InlineText as="span" value={props.ctaText || primaryPlaceholder} onUpdate={onLabelChange ? (v) => onLabelChange("ctaText", v) : undefined} />
        </CtaButton>
      )}
      {showSecondary && (
        <CtaButton
          {...common}
          ctaAction={props.ctaSecondaryAction || "url"}
          ctaUrl={props.ctaSecondaryUrl}
          chilipiperUrl={props.secondaryChilipiperUrl}
          videoUrl={props.secondaryVideoUrl}
          onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
          source={`${source}-secondary`}
          className={style === "link" ? linkClass : pill}
          style={style === "link"
            ? { background: "transparent", color: linkInk, fontFamily: MINT_BODY, padding: 0 }
            : { background: "transparent", color: palette.dark ? palette.cream : palette.green, border: `1px solid ${palette.dark ? "rgba(255,252,239,0.3)" : palette.line}`, fontFamily: MINT_BODY }}
        >
          <InlineText as="span" value={props.ctaSecondaryText || secondaryPlaceholder} onUpdate={onLabelChange ? (v) => onLabelChange("ctaSecondaryText", v) : undefined} />
        </CtaButton>
      )}
    </div>
  );
}
