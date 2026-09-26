/**
 * Invite theme — shared by the "Invite" block family (invite-demo-hero,
 * invite-details, invite-agenda, invite-showcase, invite-proof,
 * invite-reserve): a dark, editorial, invitation-style conversion page
 * modelled on Dandy's lab-tour event pages (deep brand-dark surface, display
 * type at a light weight, one accent, hairline rules, letter-spaced kickers).
 *
 * Every color derives from the tenant brand: the surface is the brand primary
 * sunk toward black (Dandy forest → deep forest), the accent is the brand
 * accent contrast-guarded on that surface, inks are near-white. Tenants with
 * a light primary still get a dark editorial page (the sink is by luminance).
 */
import type { CSSProperties, ReactNode } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";

export const INVITE_DISPLAY = BRAND_DISPLAY_STACK;
export const INVITE_BODY = BRAND_BODY_STACK;
export const INVITE_NUMBERS = BRAND_NUMBERS_STACK;

export interface InviteStyleProps {
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

export interface InvitePalette {
  bg: string;
  /** A hair lighter than bg — cards, panels, form fields. */
  panel: string;
  /** A hair lighter again — hover / active surfaces. */
  panelRaised: string;
  text: string;
  muted: string;
  faint: string;
  hairline: string;
  accent: string;
  /** Ink that reads on a solid accent fill (buttons). */
  onAccent: string;
}

const hex = (v: string | undefined): v is string => !!v && isValidHex(v);

export function resolveInvitePalette(props: InviteStyleProps, brand: BrandConfig): InvitePalette {
  const primary = hex(brand.primaryColor) ? brand.primaryColor : "#0F172A";
  // Sink the primary toward black until it is a true dark surface. A light
  // primary (pastel brands) sinks further so the page stays editorial-dark.
  let bg = hex(props.bgColor) ? props.bgColor : mixHex(primary, "#000000", 0.4);
  if (!hex(props.bgColor) && relativeLuminance(bg) > 0.08) bg = mixHex(primary, "#000000", 0.18);
  const dark = relativeLuminance(bg) < 0.35;
  const text = hex(props.textColor) && pickContrastingColor(props.textColor, bg, [], 4.5) === props.textColor
    ? props.textColor
    : dark ? "#FFFFFF" : "#0B0B0F";
  const brandAccent = hex(brand.accentColor) ? brand.accentColor : "#D9E84A";
  const accent = pickContrastingColor(hex(props.accentColor) ? props.accentColor : brandAccent, bg, [brandAccent, dark ? "#D9E84A" : primary, text], 3.0);
  const onAccent = relativeLuminance(accent) < 0.4 ? "#FFFFFF" : "#0B0B0F";
  const rgb = dark ? "255,255,255" : "11,11,15";
  return {
    bg,
    panel: dark ? mixHex("#FFFFFF", bg, 0.045) : mixHex("#000000", bg, 0.03),
    panelRaised: dark ? mixHex("#FFFFFF", bg, 0.08) : mixHex("#000000", bg, 0.06),
    text,
    muted: `rgba(${rgb},0.7)`,
    faint: `rgba(${rgb},0.5)`,
    hairline: `rgba(${rgb},0.14)`,
    accent,
    onAccent,
  };
}

/** Letter-spaced kicker with hairline rules on either side ("— YOU'RE INVITED —"),
 *  or a single left rule when `align="left"`. */
export function Kicker({ children, palette, align = "center", style }: { children: ReactNode; palette: InvitePalette; align?: "center" | "left"; style?: CSSProperties }) {
  const rule = <span aria-hidden="true" className="block h-px w-6" style={{ background: palette.accent, opacity: 0.8 }} />;
  return (
    <p
      className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] ${align === "center" ? "justify-center" : "justify-start"}`}
      style={{ color: palette.accent, fontFamily: INVITE_BODY, ...style }}
    >
      {rule}
      <span>{children}</span>
      {align === "center" && rule}
    </p>
  );
}

/** Display headline styles shared across the family (light weight, tight). */
export function displayStyle(size: string, extra?: CSSProperties): CSSProperties {
  return { fontFamily: INVITE_DISPLAY, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.02, fontSize: size, ...extra };
}

/** Pill button styles: solid accent or hairline ghost. */
export function pillStyle(palette: InvitePalette, variant: "solid" | "ghost" = "solid"): CSSProperties {
  return variant === "solid"
    ? { background: palette.accent, color: palette.onAccent, boxShadow: `0 10px 30px -14px ${palette.accent}` }
    : { background: "transparent", color: palette.text, border: `1px solid ${palette.hairline}` };
}

export const INVITE_PILL_CLASS = "inv-pill inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold";

export const INVITE_CSS = `
  .inv-pill { transition: transform .25s cubic-bezier(.16,1,.3,1), filter .25s ease; }
  @media (hover: hover) { .inv-pill:hover { transform: translateY(-1px); filter: brightness(1.05); } }
  @media (prefers-reduced-motion: reduce) { .inv-pill, .inv-pill:hover { transition: none; transform: none; } }
`;
