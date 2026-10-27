/**
 * Hub theme — shared by the "Content Hub" block family (hub-hero,
 * hub-featured, hub-library, hub-support): an ungated resource library
 * (PDFs, videos, links) that reads like a premium editorial site rather than
 * a file listing.
 *
 * Two surfaces, both derived from the tenant brand:
 *   - DARK  — the Invite family's surface (brand primary sunk toward black):
 *             hero, the featured spotlight panel, the support close.
 *   - LIGHT — warm paper tinted a hair toward the brand primary, white cards
 *             with hairlines, ink near-black, accent contrast-guarded.
 *
 * Every colour is AA-guarded against the surface it sits on, so a brand with
 * a luminous accent (Dandy lime) gets the accent as a FILL (play discs,
 * pills, with dark ink on top) but a darker, legible tone for accent TEXT.
 */
import type { CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { resolveInvitePalette, type InvitePalette } from "@/lib/invite-theme";

export const HUB_DISPLAY = BRAND_DISPLAY_STACK;
export const HUB_BODY = BRAND_BODY_STACK;

export type HubSurface = "light" | "dark";

export interface HubStyleProps {
  /** "light" (paper) or "dark" (brand-dark). Blocks pick their own default. */
  surface?: HubSurface;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

export interface HubPalette {
  isDark: boolean;
  bg: string;
  /** Cards / panels on this surface. */
  card: string;
  /** Hover / raised card surface. */
  cardRaised: string;
  text: string;
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

export function resolveHubPalette(props: HubStyleProps, brand: BrandConfig, defaultSurface: HubSurface = "light"): HubPalette {
  const surface: HubSurface = props.surface ?? defaultSurface;
  const dark = resolveInvitePalette({ accentColor: props.accentColor, textColor: surface === "dark" ? props.textColor : undefined, bgColor: surface === "dark" ? props.bgColor : undefined }, brand);
  const primary = hex(brand.primaryColor) ? brand.primaryColor : "#0F172A";
  const brandAccent = hex(brand.accentColor) ? brand.accentColor : primary;
  const requestedAccent = hex(props.accentColor) ? props.accentColor : brandAccent;

  if (surface === "dark") {
    const onFill = relativeLuminance(dark.accent) < 0.4 ? "#FFFFFF" : "#0B0B0F";
    return {
      isDark: true,
      bg: dark.bg,
      card: dark.panel,
      cardRaised: dark.panelRaised,
      text: dark.text,
      muted: dark.muted,
      faint: dark.faint,
      hairline: dark.hairline,
      accent: dark.accent,
      accentFill: dark.accent,
      onAccentFill: onFill,
      dark,
    };
  }

  // Paper: a near-white tinted toward the brand primary (mixHex keeps the
  // given share of the FIRST colour, so 4.5% primary / 95.5% white). A custom
  // bgColor that is itself dark flips the whole surface to the dark branch.
  let bg = hex(props.bgColor) ? props.bgColor : mixHex(primary, "#FFFFFF", 0.045);
  if (relativeLuminance(bg) < 0.35) {
    return resolveHubPalette({ ...props, surface: "dark", bgColor: bg }, brand, "dark");
  }
  if (!hex(props.bgColor) && relativeLuminance(bg) < 0.8) bg = mixHex(primary, "#FFFFFF", 0.025);
  const text = hex(props.textColor) && pickContrastingColor(props.textColor, bg, [], 4.5) === props.textColor ? props.textColor : "#0B0B0F";
  // Accent TEXT must read on paper: a luminous brand accent falls through to
  // the brand primary (Dandy: lime → forest).
  const accent = pickContrastingColor(requestedAccent, bg, [primary, text], 3.0);
  // Accent FILL keeps the brand's real accent (the disc / pill IS the brand
  // signal); ink on top is chosen by luminance.
  const accentFill = requestedAccent;
  const onAccentFill = relativeLuminance(accentFill) < 0.4 ? "#FFFFFF" : "#0B0B0F";
  return {
    isDark: false,
    bg,
    card: "#FFFFFF",
    cardRaised: mixHex(primary, "#FFFFFF", 0.015),
    text,
    muted: "rgba(11,11,15,0.66)",
    faint: "rgba(11,11,15,0.46)",
    hairline: "rgba(11,11,15,0.10)",
    accent,
    accentFill,
    onAccentFill,
    dark,
  };
}

/** Display headline styles shared across the family (light weight, tight). */
export function hubDisplayStyle(size: string, extra?: CSSProperties): CSSProperties {
  return { fontFamily: HUB_DISPLAY, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.04, fontSize: size, ...extra };
}

/** Letter-spaced kicker with a short accent rule. */
export function HubKicker({ children, palette, align = "left", style }: { children: React.ReactNode; palette: HubPalette; align?: "left" | "center"; style?: CSSProperties }) {
  const rule = <span aria-hidden="true" className="block h-px w-6" style={{ background: palette.accent, opacity: 0.85 }} />;
  return (
    <p
      className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.26em] ${align === "center" ? "justify-center" : "justify-start"}`}
      style={{ color: palette.accent, fontFamily: HUB_BODY, ...style }}
    >
      {rule}
      <span>{children}</span>
      {align === "center" && rule}
    </p>
  );
}

export const HUB_PILL_CLASS = "hub-pill inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold no-underline";
export const HUB_PILL_SM_CLASS = "hub-pill inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold no-underline";

export function hubPillStyle(palette: HubPalette, variant: "solid" | "ghost" = "solid"): CSSProperties {
  return variant === "solid"
    ? { background: palette.accentFill, color: palette.onAccentFill, boxShadow: `0 10px 30px -14px ${palette.accentFill}` }
    : { background: "transparent", color: palette.text, border: `1px solid ${palette.hairline}` };
}

export const HUB_CSS = `
  .hub-pill { transition: transform .25s cubic-bezier(.16,1,.3,1), filter .25s ease, background .2s ease; }
  @media (hover: hover) { .hub-pill:hover { transform: translateY(-1px); filter: brightness(1.04); } }
  .hub-card { transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s cubic-bezier(.16,1,.3,1), border-color .2s ease; }
  @media (hover: hover) { .hub-card:hover { transform: translateY(-4px); box-shadow: 0 28px 50px -30px rgba(0,0,0,0.35); } }
  .hub-lines-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .hub-lines-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .hub-rail::-webkit-scrollbar { display: none; }
  .hub-rail { scrollbar-width: none; }
  @media (prefers-reduced-motion: reduce) { .hub-pill, .hub-pill:hover, .hub-card, .hub-card:hover { transition: none; transform: none; } }
`;
