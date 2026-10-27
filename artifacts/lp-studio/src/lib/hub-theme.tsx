/**
 * Hub theme — shared by the "Content Hub" block family (hub-hero,
 * hub-featured, hub-library, hub-support): an ungated resource library
 * (PDFs, videos, links) that reads like a premium editorial site rather than
 * a file listing.
 *
 * STYLE PRESETS ("canned looks", Oct 2026). One `theme` prop, same value on
 * every hub block of a page, decides the whole look — surfaces, type, pills,
 * cards, kickers, the hero layout, the library layout:
 *
 *   site      "Brand site"     — the tenant's marketing-site idiom (built on
 *                                 meetdandy.com): a brand-dark top bar, an
 *                                 off-white hero with the headline in the brand
 *                                 primary, uppercase letter-spaced pills,
 *                                 hairline white cards, a dark featured panel,
 *                                 a tinted support close. DEFAULT.
 *   midnight  "Editorial dark" — the Invite / lab-tour idiom: brand-dark hero
 *                                 with a halo + grid, paper library, dark close.
 *   gallery   "Gallery"        — image-first, white, plain oversized display
 *                                 title, flat borderless cards with big
 *                                 thumbnails, chip labels (Figma-library-like).
 *   mono      "Index"          — the minimal list: white, a compact hero, the
 *                                 library as hairline rows (kind · title ·
 *                                 meta · action), outline featured box.
 *
 * Every colour still derives from the tenant brand and is AA-guarded against
 * the surface it sits on, so a brand with a luminous accent (Dandy lime) gets
 * the accent as a FILL (play discs, pills, with dark ink on top) and a darker,
 * legible tone for accent TEXT. `surface` / colour props remain per-block
 * overrides on top of the preset.
 */
import type { CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { contrastRatio, mixHex } from "@/lib/section-ink";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { resolveInvitePalette, type InvitePalette } from "@/lib/invite-theme";

export const HUB_DISPLAY = BRAND_DISPLAY_STACK;
export const HUB_BODY = BRAND_BODY_STACK;

export type HubTheme = "site" | "midnight" | "gallery" | "mono";
export const HUB_THEMES: HubTheme[] = ["site", "midnight", "gallery", "mono"];
export const DEFAULT_HUB_THEME: HubTheme = "site";

export const HUB_THEME_LABELS: Record<HubTheme, { label: string; hint: string }> = {
  site: { label: "Brand site", hint: "Your marketing-site look: dark top bar, light hero with the headline in the brand colour, uppercase pills, hairline cards." },
  midnight: { label: "Editorial dark", hint: "Brand-dark hero and close, paper library — the lab-tour / invitation idiom." },
  gallery: { label: "Gallery", hint: "Image-first: white, oversized display title, flat borderless cards with big thumbnails." },
  mono: { label: "Index", hint: "Minimal list: compact hero, the library as hairline rows, outline featured box." },
};

/** "light" = paper · "dark" = brand-dark · "tint" = paper tinted a little more toward the brand. */
export type HubSurface = "light" | "dark" | "tint";
export type HubBlockKind = "hero" | "featured" | "library" | "support";

export interface HubStyleProps {
  /** Style preset for the whole family. Blank = "site". Keep the same value on every hub block of a page. */
  theme?: HubTheme;
  /** Per-block override of the preset's surface. Blank = from the preset. */
  surface?: HubSurface;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

export interface HubTokens {
  theme: HubTheme;
  surfaces: Record<HubBlockKind, HubSurface>;
  /** Headline colour on light surfaces: near-black ink, or the brand primary (site idiom). */
  headingInk: "ink" | "primary";
  headingWeight: 400 | 500 | 600;
  headingTracking: string;
  headingLineHeight: number;
  buttonCase: "uppercase" | "none";
  buttonRadius: string;
  /** hairline = white card with a 1px border · flat = no box, big thumb · rows = list rows (library only; featured/cards fall back to hairline). */
  cardStyle: "hairline" | "flat" | "rows";
  cardRadius: number;
  thumbRatio: string;
  kicker: "rule" | "plain" | "chip" | "mono";
  topBar: "glass" | "solid" | "paper";
  featuredPanel: "dark" | "tinted" | "outline" | "split";
  heroLayout: "backdrop" | "split" | "centered" | "compact";
  sectionHeader: "rule" | "plain";
  railStyle: "pills" | "border";
}

const TOKENS: Record<HubTheme, HubTokens> = {
  site: {
    theme: "site",
    surfaces: { hero: "light", featured: "light", library: "light", support: "tint" },
    headingInk: "primary",
    headingWeight: 400,
    headingTracking: "-0.015em",
    headingLineHeight: 1.08,
    buttonCase: "uppercase",
    buttonRadius: "9999px",
    cardStyle: "hairline",
    cardRadius: 14,
    thumbRatio: "4 / 3",
    kicker: "chip",
    topBar: "solid",
    featuredPanel: "dark",
    heroLayout: "split",
    sectionHeader: "rule",
    railStyle: "border",
  },
  midnight: {
    theme: "midnight",
    surfaces: { hero: "dark", featured: "light", library: "light", support: "dark" },
    headingInk: "ink",
    headingWeight: 400,
    headingTracking: "-0.03em",
    headingLineHeight: 1.04,
    buttonCase: "none",
    buttonRadius: "9999px",
    cardStyle: "hairline",
    cardRadius: 20,
    thumbRatio: "16 / 10",
    kicker: "rule",
    topBar: "glass",
    featuredPanel: "dark",
    heroLayout: "backdrop",
    sectionHeader: "rule",
    railStyle: "border",
  },
  gallery: {
    theme: "gallery",
    surfaces: { hero: "light", featured: "light", library: "light", support: "tint" },
    headingInk: "ink",
    headingWeight: 500,
    headingTracking: "-0.035em",
    headingLineHeight: 1.0,
    buttonCase: "none",
    buttonRadius: "9999px",
    cardStyle: "flat",
    cardRadius: 18,
    thumbRatio: "3 / 2",
    kicker: "mono",
    topBar: "paper",
    featuredPanel: "split",
    heroLayout: "centered",
    sectionHeader: "plain",
    railStyle: "pills",
  },
  mono: {
    theme: "mono",
    surfaces: { hero: "light", featured: "light", library: "light", support: "light" },
    headingInk: "ink",
    headingWeight: 500,
    headingTracking: "-0.025em",
    headingLineHeight: 1.08,
    buttonCase: "none",
    buttonRadius: "10px",
    cardStyle: "rows",
    cardRadius: 12,
    thumbRatio: "16 / 10",
    kicker: "mono",
    topBar: "paper",
    featuredPanel: "outline",
    heroLayout: "compact",
    sectionHeader: "rule",
    railStyle: "border",
  },
};

export function resolveHubTheme(theme: string | undefined): HubTheme {
  return (HUB_THEMES as string[]).includes(theme ?? "") ? (theme as HubTheme) : DEFAULT_HUB_THEME;
}

export function hubTokens(theme: string | undefined): HubTokens {
  return TOKENS[resolveHubTheme(theme)];
}

export interface HubPalette {
  t: HubTokens;
  surface: HubSurface;
  isDark: boolean;
  bg: string;
  /** Cards / panels on this surface. */
  card: string;
  /** Hover / raised card surface. */
  cardRaised: string;
  /** Backdrop behind thumbnails / placeholder tiles. */
  cardTint: string;
  text: string;
  /** Display headlines (h1/h2/h3). The brand primary in the site idiom, else `text`. */
  heading: string;
  muted: string;
  faint: string;
  hairline: string;
  /** Accent as TEXT / thin strokes (AA-guarded against bg). */
  accent: string;
  /** Accent as a solid FILL (pills, play discs) + the ink that reads on it. */
  accentFill: string;
  onAccentFill: string;
  /** The brand-dark surface, for a dark panel sitting on a light section. */
  dark: InvitePalette;
}

const hex = (v: string | undefined): v is string => !!v && isValidHex(v);
const rgba = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * Resolve the palette for one block. `kind` is the block ("hero" …) — the
 * preset decides its surface unless `props.surface` overrides it. The legacy
 * form passes a surface ("light" / "dark") directly.
 */
export function resolveHubPalette(props: HubStyleProps, brand: BrandConfig, kind: HubBlockKind | HubSurface = "light"): HubPalette {
  const t = hubTokens(props.theme);
  const surface: HubSurface = props.surface ?? (kind in t.surfaces ? t.surfaces[kind as HubBlockKind] : (kind as HubSurface));
  const dark = resolveInvitePalette({ accentColor: props.accentColor, textColor: surface === "dark" ? props.textColor : undefined, bgColor: surface === "dark" ? props.bgColor : undefined }, brand);
  const primary = hex(brand.primaryColor) ? brand.primaryColor : "#0F172A";
  const brandAccent = hex(brand.accentColor) ? brand.accentColor : primary;
  const requestedAccent = hex(props.accentColor) ? props.accentColor : brandAccent;

  if (surface === "dark") {
    const onFill = relativeLuminance(dark.accent) < 0.4 ? "#FFFFFF" : "#0B0B0F";
    return {
      t,
      surface,
      isDark: true,
      bg: dark.bg,
      card: dark.panel,
      cardRaised: dark.panelRaised,
      cardTint: dark.panelRaised,
      text: dark.text,
      heading: dark.text,
      muted: dark.muted,
      faint: dark.faint,
      hairline: dark.hairline,
      accent: dark.accent,
      accentFill: dark.accent,
      onAccentFill: onFill,
      dark,
    };
  }

  // Paper. The site idiom starts from the brand's own page background; the
  // others from white (gallery / mono) or white tinted a hair toward the
  // primary (midnight). mixHex keeps the given share of the FIRST colour.
  const pageBg = hex(brand.pageBackground) && relativeLuminance(brand.pageBackground) > 0.8 ? brand.pageBackground : "#FDFCFA";
  const paper = t.theme === "site" ? pageBg : t.theme === "midnight" ? mixHex(primary, "#FFFFFF", 0.045) : "#FFFFFF";
  let bg = hex(props.bgColor) ? props.bgColor : surface === "tint" ? mixHex(primary, paper, t.theme === "midnight" ? 0.09 : 0.06) : paper;
  if (relativeLuminance(bg) < 0.35) {
    // A dark custom background flips the whole block to the dark branch.
    return resolveHubPalette({ ...props, surface: "dark", bgColor: bg }, brand, kind);
  }
  if (!hex(props.bgColor) && relativeLuminance(bg) < 0.72) bg = mixHex(primary, "#FFFFFF", 0.03);

  const brandText = hex(brand.textColor) ? brand.textColor : "";
  const requestedText = hex(props.textColor) ? props.textColor : t.theme === "site" && brandText ? brandText : "";
  const text = requestedText && contrastRatio(requestedText, bg) >= 4.5 ? requestedText : "#0B0B0F";
  const heading = t.headingInk === "primary" && contrastRatio(primary, bg) >= 4.5 ? primary : text;
  // Accent TEXT must read on paper: a luminous brand accent falls through to
  // the brand primary (Dandy: lime → forest).
  const accent = pickContrastingColor(requestedAccent, bg, [primary, text], 3.0);
  // Accent FILL keeps the brand's real accent (the disc / pill IS the brand
  // signal); ink on top is chosen by luminance.
  const accentFill = requestedAccent;
  const onAccentFill = relativeLuminance(accentFill) < 0.4 ? "#FFFFFF" : "#0B0B0F";
  const hairline = t.theme === "site" && hex(brand.borderColor) && relativeLuminance(brand.borderColor) > 0.6 ? brand.borderColor : rgba(text, 0.1);
  const cardTint = t.theme === "site" && hex(brand.cardBackground) && relativeLuminance(brand.cardBackground) > 0.6 && brand.cardBackground.toLowerCase() !== "#ffffff"
    ? brand.cardBackground
    : mixHex(primary, "#FFFFFF", t.theme === "gallery" ? 0.05 : 0.035);
  return {
    t,
    surface,
    isDark: false,
    bg,
    card: "#FFFFFF",
    cardRaised: mixHex(primary, "#FFFFFF", 0.02),
    cardTint,
    text,
    heading,
    muted: rgba(text, 0.7),
    faint: rgba(text, 0.5),
    hairline,
    accent,
    accentFill,
    onAccentFill,
    dark,
  };
}

/** Display headline styles shared across the family (weight / tracking from the preset). */
export function hubDisplayStyle(pal: HubPalette, size: string, extra?: CSSProperties): CSSProperties {
  return {
    fontFamily: HUB_DISPLAY,
    fontWeight: pal.t.headingWeight,
    letterSpacing: pal.t.headingTracking,
    lineHeight: pal.t.headingLineHeight,
    fontSize: size,
    color: pal.heading,
    ...extra,
  };
}

/** Kicker in the preset's idiom: a rule + letter-spaced caps (midnight), a
 *  brand-accent chip (site), a mono small-caps label (gallery / index), or
 *  plain caps. */
export function HubKicker({ children, palette, align = "left", style }: { children: React.ReactNode; palette: HubPalette; align?: "left" | "center"; style?: CSSProperties }) {
  const kind = palette.t.kicker;
  const justify = align === "center" ? "justify-center" : "justify-start";
  if (kind === "chip") {
    return (
      <p className={`flex items-center ${justify}`} style={{ fontFamily: HUB_BODY, ...style }}>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ background: palette.accentFill, color: palette.onAccentFill }}>
          {children}
        </span>
      </p>
    );
  }
  if (kind === "mono") {
    return (
      <p className={`flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] ${justify}`} style={{ color: palette.faint, fontFamily: `ui-monospace, SFMono-Regular, Menlo, monospace`, ...style }}>
        <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-sm" style={{ background: palette.accentFill }} />
        <span>{children}</span>
      </p>
    );
  }
  if (kind === "plain") {
    return (
      <p className={`flex items-center text-[11px] font-semibold uppercase tracking-[0.22em] ${justify}`} style={{ color: palette.accent, fontFamily: HUB_BODY, ...style }}>
        <span>{children}</span>
      </p>
    );
  }
  const rule = <span aria-hidden="true" className="block h-px w-6" style={{ background: palette.accent, opacity: 0.85 }} />;
  return (
    <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.26em] ${justify}`} style={{ color: palette.accent, fontFamily: HUB_BODY, ...style }}>
      {rule}
      <span>{children}</span>
      {align === "center" && rule}
    </p>
  );
}

export const HUB_PILL_CLASS = "hub-pill inline-flex min-h-[46px] items-center justify-center gap-2 px-6 py-3 font-semibold no-underline";
export const HUB_PILL_SM_CLASS = "hub-pill inline-flex min-h-[38px] items-center justify-center gap-2 px-4 py-2 font-semibold no-underline";

/** Pill style in the preset's idiom (radius + case + tracking) on top of the palette. */
export function hubPillStyle(palette: HubPalette, variant: "solid" | "ghost" = "solid", size: "md" | "sm" = "md"): CSSProperties {
  const t = palette.t;
  const type: CSSProperties = t.buttonCase === "uppercase"
    ? { textTransform: "uppercase", letterSpacing: "0.08em", fontSize: size === "sm" ? 12 : 13 }
    : { fontSize: size === "sm" ? 13 : 14 };
  const base: CSSProperties = { borderRadius: t.buttonRadius, ...type };
  if (variant === "solid") {
    return { ...base, background: palette.accentFill, color: palette.onAccentFill, boxShadow: t.theme === "midnight" ? `0 10px 30px -14px ${palette.accentFill}` : "none" };
  }
  const outline = palette.isDark ? palette.hairline : t.theme === "site" ? palette.heading : palette.hairline;
  return { ...base, background: "transparent", color: palette.isDark ? palette.text : palette.heading, border: `${t.theme === "site" ? 1.5 : 1}px solid ${outline}` };
}

export const HUB_CSS = `
  .hub-pill { transition: transform .25s cubic-bezier(.16,1,.3,1), filter .25s ease, background .2s ease; }
  @media (hover: hover) { .hub-pill:hover { transform: translateY(-1px); filter: brightness(1.04); } }
  .hub-card { transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s cubic-bezier(.16,1,.3,1), border-color .2s ease; }
  @media (hover: hover) { .hub-card:hover { transform: translateY(-4px); box-shadow: 0 28px 50px -30px rgba(0,0,0,0.35); } }
  .hub-card-flat .hub-thumb { transition: transform .5s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .hub-card-flat:hover .hub-thumb { transform: scale(1.025); } }
  .hub-row { transition: background .2s ease; }
  .hub-lines-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .hub-lines-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .hub-rail::-webkit-scrollbar { display: none; }
  .hub-rail { scrollbar-width: none; }
  @media (prefers-reduced-motion: reduce) { .hub-pill, .hub-pill:hover, .hub-card, .hub-card:hover, .hub-card-flat .hub-thumb { transition: none; transform: none; } }
`;
