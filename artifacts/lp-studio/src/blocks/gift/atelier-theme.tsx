/**
 * Atelier — the light, luxury-retail layout of the Holiday Gift family
 * (gift-hero / gift-picker / gift-form / gift-note with `layout: "atelier"`).
 *
 * Modelled on high-end gifting retail (warm sand backdrops, chocolate
 * boxes, deep satin ribbon, cream leather tags, an italic serif): instead
 * of the Classic layout's dark forest + snow, the page is warm and quiet,
 * typography does the work, and the ribbon is the one saturated colour.
 *
 * The ribbon defaults to the tenant's brand primary when it is dark enough
 * to read as satin (Dandy forest is perfect), else a deep forest. Everything
 * else is a fixed "paper and leather" palette — the wrapping, not the brand.
 */
import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, relativeLuminance } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { INVITE_BODY } from "@/lib/invite-theme";
import { cn } from "@/lib/utils";

export type GiftLayout = "classic" | "atelier";

export const GIFT_LAYOUT_LABELS: Record<GiftLayout, { label: string; hint: string }> = {
  classic: { label: "Classic — dark forest, snow and gold", hint: "Night-time and festive: dark brand surface, snowfall, gold ribbon, cream cards." },
  atelier: { label: "Atelier — light luxury retail", hint: "Warm sand and ivory, chocolate gift boxes, satin ribbon in your brand colour, leather tags, serif type." },
};

export const ATELIER_SERIF = `"Instrument Serif", "Fraunces", Georgia, "Times New Roman", serif`;
export const ATELIER_BODY = INVITE_BODY;

export interface AtelierStyleProps {
  /** Section background (blank = warm sand / ivory by block). */
  bgColor?: string;
  /** Ribbon colour (blank = brand primary when dark, else deep forest). */
  accentColor?: string;
  textColor?: string;
}

export interface AtelierPalette {
  /** The section's own surface. */
  bg: string;
  sand: string;
  ivory: string;
  paper: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  ribbon: string;
  ribbonDark: string;
  ribbonLight: string;
  box: string;
  boxDark: string;
  boxLight: string;
  tag: string;
  /** Solid button fill + its text. */
  button: string;
  onButton: string;
}

export const ATELIER_SAND = "#EFE5DA";
export const ATELIER_IVORY = "#FBF8F3";
export const ATELIER_PAPER = "#F6F0E8";
const INK = "#2B1F17";
const FOREST = "#1F3B31";

const hex = (v: string | undefined): v is string => !!v && isValidHex(v);

export function resolveAtelierPalette(props: AtelierStyleProps, brand: BrandConfig, surface: "sand" | "ivory" | "paper" = "sand"): AtelierPalette {
  const surfaces = { sand: ATELIER_SAND, ivory: ATELIER_IVORY, paper: ATELIER_PAPER } as const;
  const bg = hex(props.bgColor) ? props.bgColor : surfaces[surface];
  const primary = hex(brand.primaryColor) ? brand.primaryColor : FOREST;
  const ribbon = hex(props.accentColor) ? props.accentColor : relativeLuminance(primary) < 0.12 ? primary : FOREST;
  const ink = hex(props.textColor) && relativeLuminance(props.textColor) < 0.2 ? props.textColor : INK;
  return {
    bg,
    sand: ATELIER_SAND,
    ivory: ATELIER_IVORY,
    paper: ATELIER_PAPER,
    ink,
    muted: "rgba(43,31,23,0.68)",
    faint: "rgba(43,31,23,0.46)",
    line: "rgba(43,31,23,0.14)",
    ribbon,
    ribbonDark: mixHex(ribbon, "#000000", 0.62),
    ribbonLight: mixHex(ribbon, "#FFFFFF", 0.72),
    box: "#5B4131",
    boxDark: "#3A281E",
    boxLight: "#7A5A45",
    tag: "#EADCC9",
    button: ink,
    onButton: ATELIER_IVORY,
  };
}

/** Small-caps eyebrow: wide tracking, hairline rule on the left. */
export function AtelierEyebrow({ children, palette, align = "left", className }: { children: ReactNode; palette: AtelierPalette; align?: "left" | "center"; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.32em]", align === "center" ? "justify-center" : "justify-start", className)} style={{ color: palette.muted, fontFamily: ATELIER_BODY }}>
      <span aria-hidden="true" className="block h-px w-8" style={{ background: palette.ribbon }} />
      <span>{children}</span>
      {align === "center" && <span aria-hidden="true" className="block h-px w-8" style={{ background: palette.ribbon }} />}
    </p>
  );
}

/** Serif display style. */
export function serifStyle(size: string, extra?: CSSProperties): CSSProperties {
  return { fontFamily: ATELIER_SERIF, fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 0.98, fontSize: size, ...extra };
}

/** Rectangular, tracked-uppercase solid button (the luxury-retail CTA). */
export const ATELIER_BUTTON_CLASS = "atl-btn inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-[2px] px-8 text-[12px] font-semibold uppercase tracking-[0.2em]";
/** Underlined text link CTA. */
export const ATELIER_LINK_CLASS = "atl-link inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em]";

export const ATELIER_CSS = `
  .atl-btn { transition: background-color .3s ease, transform .3s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .atl-btn:hover { transform: translateY(-1px); } }
  .atl-link { background-image: linear-gradient(currentColor, currentColor); background-size: 100% 1px; background-position: 0 100%; background-repeat: no-repeat; padding-bottom: 4px; transition: background-size .35s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .atl-link:hover { background-size: 40% 1px; } }
  .atl-zoom { transition: transform 1.2s cubic-bezier(.16,1,.3,1); }
  @media (hover: hover) { .atl-card:hover .atl-zoom { transform: scale(1.035); } }
  .atl-field { background: transparent; border: 0; border-bottom: 1px solid rgba(43,31,23,0.22); border-radius: 0; padding: 10px 0; font-size: 15px; outline: none; width: 100%; transition: border-color .25s ease; }
  .atl-field::placeholder { color: rgba(43,31,23,0.38); }
  .atl-tag { transform-origin: 50% 0; animation: atl-sway 7s ease-in-out infinite alternate; }
  @keyframes atl-sway { from { transform: rotate(-5deg); } to { transform: rotate(3deg); } }
  @media (prefers-reduced-motion: reduce) {
    .atl-btn, .atl-link, .atl-zoom, .atl-tag { transition: none !important; animation: none !important; }
  }
`;

/**
 * A satin ribbon band: a strip with a soft sheen running along it, so it
 * reads as fabric rather than a flat stripe.
 */
export function SatinBand({ palette, orientation = "vertical", className, style }: { palette: AtelierPalette; orientation?: "vertical" | "horizontal"; className?: string; style?: CSSProperties }) {
  const dir = orientation === "vertical" ? "90deg" : "180deg";
  return (
    <div
      aria-hidden="true"
      data-atl-ribbon={orientation}
      className={cn("pointer-events-none absolute", className)}
      style={{
        background: `linear-gradient(${dir}, ${palette.ribbonDark} 0%, ${palette.ribbon} 18%, ${mixHex(palette.ribbon, "#FFFFFF", 0.82)} 46%, ${palette.ribbon} 64%, ${palette.ribbonDark} 100%)`,
        boxShadow: "0 10px 24px -14px rgba(0,0,0,0.55)",
        ...style,
      }}
    />
  );
}

/** A tied satin bow with two tails (SVG; colours from the ribbon). */
export function SatinBow({ palette, className, style }: { palette: AtelierPalette; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const sheen = `atl-bow-sheen-${id}`;
  const fold = `atl-bow-fold-${id}`;
  return (
    <svg viewBox="0 0 200 170" aria-hidden="true" data-atl-bow="true" className={cn("pointer-events-none", className)} style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.28))", ...style }}>
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.ribbonDark} />
          <stop offset="0.38" stopColor={palette.ribbon} />
          <stop offset="0.55" stopColor={mixHex(palette.ribbon, "#FFFFFF", 0.78)} />
          <stop offset="0.75" stopColor={palette.ribbon} />
          <stop offset="1" stopColor={palette.ribbonDark} />
        </linearGradient>
        <linearGradient id={fold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.ribbonDark} stopOpacity="0.9" />
          <stop offset="1" stopColor={palette.ribbonDark} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* tails */}
      <path d="M94 66 C 82 96, 64 128, 40 164 L 62 166 C 82 132, 98 100, 104 70 Z" fill={`url(#${sheen})`} />
      <path d="M106 66 C 120 98, 140 126, 168 158 L 148 166 C 124 134, 108 102, 98 70 Z" fill={`url(#${sheen})`} />
      {/* loops */}
      <path d="M100 58 C 74 18, 14 12, 12 46 C 10 78, 66 86, 100 62 Z" fill={`url(#${sheen})`} />
      <path d="M100 58 C 126 18, 186 12, 188 46 C 190 78, 134 86, 100 62 Z" fill={`url(#${sheen})`} />
      {/* inner folds */}
      <path d="M100 60 C 80 40, 46 34, 34 46 C 52 46, 78 54, 100 62 Z" fill={`url(#${fold})`} />
      <path d="M100 60 C 120 40, 154 34, 166 46 C 148 46, 122 54, 100 62 Z" fill={`url(#${fold})`} />
      {/* knot */}
      <rect x="88" y="48" width="24" height="24" rx="9" fill={`url(#${sheen})`} stroke={palette.ribbonDark} strokeOpacity="0.35" />
    </svg>
  );
}

/** A cream leather tag with stitching, a punched hole and debossed lettering. */
export function LeatherTag({ palette, line1, line2, className, style, sway = true }: { palette: AtelierPalette; line1?: ReactNode; line2?: ReactNode; className?: string; style?: CSSProperties; sway?: boolean }) {
  return (
    <div aria-hidden={!line1 && !line2 ? true : undefined} data-atl-tag="true" className={cn("relative flex flex-col items-center", sway && "atl-tag", className)} style={style}>
      <span className="block h-6 w-[2px]" style={{ background: palette.ribbonDark, opacity: 0.8 }} />
      <div
        className="relative flex min-w-[118px] flex-col items-center gap-1 rounded-[10px] px-5 pb-5 pt-7 text-center"
        style={{
          background: `radial-gradient(120% 90% at 30% 10%, #F4EADC 0%, ${palette.tag} 60%, ${mixHex(palette.tag, "#7A5A45", 0.86)} 100%)`,
          boxShadow: "0 18px 30px -18px rgba(43,31,23,0.7), inset 0 0 0 1px rgba(43,31,23,0.06)",
          fontFamily: ATELIER_BODY,
        }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-[5px] rounded-[7px]" style={{ border: "1px dashed rgba(43,31,23,0.22)" }} />
        <span aria-hidden="true" className="absolute left-1/2 top-2.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full" style={{ background: palette.ribbonDark, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)" }} />
        {line1 && <span className="text-[9px] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(43,31,23,0.5)", textShadow: "0 1px 0 rgba(255,255,255,0.55)" }}>{line1}</span>}
        {line2 && <span className="text-[17px] leading-tight" style={{ fontFamily: ATELIER_SERIF, fontStyle: "italic", color: "rgba(43,31,23,0.82)", textShadow: "0 1px 0 rgba(255,255,255,0.5)" }}>{line2}</span>}
      </div>
    </div>
  );
}

/**
 * Three chocolate gift boxes tied with satin ribbon and leather tags — the
 * Atelier stand-in for product photography (hero art, empty gift tiles).
 * `variant="single"` draws one box for small tiles.
 */
export function GiftBoxArt({ palette, variant = "stack", className, style }: { palette: AtelierPalette; variant?: "stack" | "single"; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const g = (n: string) => `atl-${n}-${id}`;
  const ribbonV = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} fill={`url(#${g("rv")})`} />;
  const ribbonH = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} fill={`url(#${g("rh")})`} />;
  const box = (x: number, y: number, w: number, h: number, shade: string) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={shade} />
      <rect x={x} y={y} width={w} height={h} rx="3" fill={`url(#${g("light")})`} />
      <rect x={x} y={y} width={w} height="7" rx="2" fill={palette.boxLight} opacity="0.55" />
      <rect x={x} y={y + 7} width={w} height="1.5" fill={palette.boxDark} opacity="0.5" />
    </>
  );
  const bow = (cx: number, cy: number, s: number) => (
    <g transform={`translate(${cx - 100 * s} ${cy - 60 * s}) scale(${s})`}>
      <path d="M94 66 C 82 96, 64 128, 40 164 L 62 166 C 82 132, 98 100, 104 70 Z" fill={`url(#${g("bow")})`} />
      <path d="M106 66 C 120 98, 140 126, 168 158 L 148 166 C 124 134, 108 102, 98 70 Z" fill={`url(#${g("bow")})`} />
      <path d="M100 58 C 74 18, 14 12, 12 46 C 10 78, 66 86, 100 62 Z" fill={`url(#${g("bow")})`} />
      <path d="M100 58 C 126 18, 186 12, 188 46 C 190 78, 134 86, 100 62 Z" fill={`url(#${g("bow")})`} />
      <path d="M100 60 C 80 40, 46 34, 34 46 C 52 46, 78 54, 100 62 Z" fill={palette.ribbonDark} opacity="0.55" />
      <path d="M100 60 C 120 40, 154 34, 166 46 C 148 46, 122 54, 100 62 Z" fill={palette.ribbonDark} opacity="0.55" />
      <rect x="88" y="48" width="24" height="24" rx="9" fill={`url(#${g("bow")})`} />
    </g>
  );
  const tag = (x: number, y: number, rot: number, s = 1) => (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <rect x="-15" y="0" width="30" height="50" rx="5" fill={palette.tag} />
      <rect x="-12" y="3" width="24" height="44" rx="3.5" fill="none" stroke="rgba(43,31,23,0.25)" strokeDasharray="2 2" strokeWidth="0.8" />
      <circle cx="0" cy="8" r="2.4" fill={palette.ribbonDark} />
    </g>
  );
  return (
    <svg viewBox="0 0 600 480" role="img" aria-label="Gift boxes tied with satin ribbon" data-atl-boxes={variant} className={className} style={style}>
      <defs>
        <linearGradient id={g("rv")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={palette.ribbonDark} />
          <stop offset="0.2" stopColor={palette.ribbon} />
          <stop offset="0.5" stopColor={mixHex(palette.ribbon, "#FFFFFF", 0.8)} />
          <stop offset="0.75" stopColor={palette.ribbon} />
          <stop offset="1" stopColor={palette.ribbonDark} />
        </linearGradient>
        <linearGradient id={g("rh")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.ribbonDark} />
          <stop offset="0.2" stopColor={palette.ribbon} />
          <stop offset="0.5" stopColor={mixHex(palette.ribbon, "#FFFFFF", 0.8)} />
          <stop offset="0.75" stopColor={palette.ribbon} />
          <stop offset="1" stopColor={palette.ribbonDark} />
        </linearGradient>
        <linearGradient id={g("bow")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.ribbonDark} />
          <stop offset="0.4" stopColor={palette.ribbon} />
          <stop offset="0.56" stopColor={mixHex(palette.ribbon, "#FFFFFF", 0.76)} />
          <stop offset="0.76" stopColor={palette.ribbon} />
          <stop offset="1" stopColor={palette.ribbonDark} />
        </linearGradient>
        <linearGradient id={g("light")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id={g("shadow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2B1F17" stopOpacity="0.32" />
          <stop offset="1" stopColor="#2B1F17" stopOpacity="0" />
        </radialGradient>
      </defs>
      {variant === "single" ? (
        <>
          <ellipse cx="300" cy="402" rx="200" ry="22" fill={`url(#${g("shadow")})`} />
          {box(150, 150, 300, 250, palette.box)}
          {ribbonV(282, 150, 36, 250)}
          {ribbonH(150, 252, 300, 34)}
          {bow(300, 262, 0.82)}
          {tag(330, 296, -14, 1.25)}
        </>
      ) : (
        <>
          <ellipse cx="320" cy="438" rx="270" ry="26" fill={`url(#${g("shadow")})`} />
          {/* back, tall */}
          {box(178, 44, 266, 300, palette.boxDark)}
          {ribbonV(292, 44, 32, 300)}
          {ribbonH(178, 214, 266, 30)}
          {/* right, wide, slightly turned */}
          <g transform="rotate(-3 410 320)">
            {box(266, 196, 300, 230, palette.box)}
            {ribbonV(418, 196, 34, 230)}
            {ribbonH(266, 288, 300, 32)}
            {bow(436, 300, 0.72)}
            {tag(452, 332, -10, 1.1)}
          </g>
          {/* front, small */}
          <g transform="rotate(2 170 360)">
            {box(54, 282, 228, 168, palette.boxLight)}
            {ribbonV(152, 282, 30, 168)}
            {ribbonH(54, 346, 228, 28)}
            {bow(168, 356, 0.6)}
            {tag(150, 384, 16, 0.95)}
          </g>
        </>
      )}
    </svg>
  );
}

/**
 * Serif headline whose last line is set in italic (an editorial convention
 * that needs no markup). Each line is its own inline-editable span; edits
 * rebuild the multi-line string.
 */
export function splitHeadline(value: string): string[] {
  return (value || "").split("\n");
}
