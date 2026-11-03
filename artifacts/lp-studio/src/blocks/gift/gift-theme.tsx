/**
 * Gift theme — shared by the Holiday Gift block family (gift-hero,
 * gift-picker, gift-form, gift-note): the "pick your gift" page a sales rep
 * sends a prospect for the holidays.
 *
 * It is the Invite/Kit dark editorial idiom (brand primary sunk toward
 * black, light product tiles, one accent) with a holiday layer on top: a
 * warm cream card surface, a soft gold used for ribbons, sparkles and the
 * gift tag, and an optional slow snowfall. The gold and cream are fixed
 * (they are the "wrapping paper", not brand colours); everything else still
 * derives from the tenant brand so the family works for any tenant.
 */
import type { CSSProperties, ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { INVITE_BODY, INVITE_CSS, resolveInvitePalette, type InvitePalette, type InviteStyleProps } from "@/lib/invite-theme";
import { cn } from "@/lib/utils";

export type GiftStyleProps = InviteStyleProps;

export interface GiftPalette extends InvitePalette {
  /** Warm gold: ribbons, sparkles, the gift tag string. */
  gold: string;
  /** Gold at low alpha for hairlines and glows on the dark surface. */
  goldSoft: string;
  /** The cream "card stock" surface (picker cards, the form card, the note). */
  cream: string;
  /** Ink on the cream surface. */
  creamInk: string;
  /** Muted ink on the cream surface. */
  creamMuted: string;
  /** Hairline on the cream surface. */
  creamLine: string;
}

export const GIFT_GOLD = "#E8CC8A";
export const GIFT_CREAM = "#FBF7EE";
export const GIFT_TILE = "#F6F1E6";

export function resolveGiftPalette(props: GiftStyleProps, brand: BrandConfig): GiftPalette {
  const pal = resolveInvitePalette(props, brand);
  return {
    ...pal,
    gold: GIFT_GOLD,
    goldSoft: "rgba(232,204,138,0.28)",
    cream: GIFT_CREAM,
    creamInk: "#14211C",
    creamMuted: "rgba(20,33,28,0.64)",
    creamLine: "rgba(20,33,28,0.12)",
  };
}

/** Letter-spaced kicker with a sparkle on either side. */
export function GiftKicker({ children, palette, align = "center", style }: { children: ReactNode; palette: GiftPalette; align?: "center" | "left"; style?: CSSProperties }) {
  const spark = <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0" style={{ color: palette.gold }} strokeWidth={2} />;
  return (
    <p
      className={cn("flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em]", align === "center" ? "justify-center" : "justify-start")}
      style={{ color: palette.gold, fontFamily: INVITE_BODY, ...style }}
    >
      {spark}
      <span>{children}</span>
      {align === "center" && spark}
    </p>
  );
}

/**
 * Slow snowfall over a section. Pure CSS (no per-frame JS): flakes are
 * positioned deterministically from their index so SSR and the client agree,
 * and the animation is dropped under prefers-reduced-motion (the flakes then
 * sit still as faint dots). Set `count={0}` to remove the layer entirely.
 */
export function Snowfall({ count = 26, className }: { count?: number; className?: string }) {
  if (count <= 0) return null;
  const flakes = Array.from({ length: count }, (_, i) => {
    const left = ((i * 37) % 100) + ((i * 7) % 5) * 0.3;
    const size = 2 + ((i * 13) % 4);
    const duration = 11 + ((i * 29) % 9);
    const delay = -(((i * 17) % 23) * 0.9);
    const opacity = 0.28 + ((i * 11) % 5) * 0.08;
    const sway = 7 + ((i * 5) % 6);
    return (
      <span
        key={i}
        className="gift-flake"
        style={{
          left: `${left}%`,
          width: size,
          height: size,
          opacity,
          animationDuration: `${duration}s, ${sway}s`,
          animationDelay: `${delay}s, ${delay / 2}s`,
        }}
      />
    );
  });
  return (
    <div aria-hidden="true" data-gift-snow={count} className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {flakes}
    </div>
  );
}

/** A tied ribbon drawn over a tile: two bands crossing at the top-right with a bow. */
export function RibbonOverlay({ palette, bow = true }: { palette: GiftPalette; bow?: boolean }) {
  const band: CSSProperties = {
    background: `linear-gradient(90deg, ${palette.gold} 0%, #F3E2B4 50%, ${palette.gold} 100%)`,
    boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 6px 14px -8px rgba(0,0,0,0.45)",
  };
  return (
    <div aria-hidden="true" data-gift-ribbon="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-[62%] w-[7%]" style={band} />
      <div className="absolute inset-x-0 top-[30%] h-[7%]" style={band} />
      {bow && (
        <svg viewBox="0 0 100 60" className="absolute left-[52.5%] top-[19%] w-[26%]" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
          <defs>
            <linearGradient id="gift-bow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F3E2B4" />
              <stop offset="1" stopColor={palette.gold} />
            </linearGradient>
          </defs>
          <path d="M50 30 C38 10 10 8 10 26 C10 40 36 40 50 30 Z" fill="url(#gift-bow)" stroke="rgba(0,0,0,0.08)" />
          <path d="M50 30 C62 10 90 8 90 26 C90 40 64 40 50 30 Z" fill="url(#gift-bow)" stroke="rgba(0,0,0,0.08)" />
          <path d="M50 30 L36 56 L44 56 L50 40 L56 56 L64 56 Z" fill={palette.gold} stroke="rgba(0,0,0,0.08)" />
          <circle cx="50" cy="30" r="7" fill="#F3E2B4" stroke="rgba(0,0,0,0.1)" />
        </svg>
      )}
    </div>
  );
}

/** The little cream gift tag that hangs off a tile corner. */
export function GiftTag({ to, from, palette, className }: { to?: ReactNode; from?: ReactNode; palette: GiftPalette; className?: string }) {
  return (
    <div aria-hidden="true" data-gift-tag="true" className={cn("gift-tag absolute flex flex-col items-start", className)} style={{ transformOrigin: "top left" }}>
      <span className="ml-[22px] block h-9 w-px" style={{ background: palette.gold }} />
      <div className="relative rounded-md px-4 py-3 pl-9" style={{ background: palette.cream, color: palette.creamInk, boxShadow: "0 18px 30px -18px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.05)", fontFamily: INVITE_BODY }}>
        <span className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full" style={{ background: palette.bg, boxShadow: `inset 0 0 0 2px ${palette.gold}` }} />
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: palette.creamMuted }}>{to}</span>
        <span className="block text-[13px] font-medium" style={{ letterSpacing: "-0.01em" }}>{from}</span>
      </div>
    </div>
  );
}

export const GIFT_CSS = `
  ${INVITE_CSS}
  .gift-flake { position: absolute; top: -4%; border-radius: 999px; background: #fff; animation-name: gift-fall, gift-sway; animation-timing-function: linear, ease-in-out; animation-iteration-count: infinite, infinite; animation-direction: normal, alternate; will-change: transform; }
  @keyframes gift-fall { from { transform: translateY(0); } to { transform: translateY(112vh); } }
  @keyframes gift-sway { from { margin-left: -14px; } to { margin-left: 14px; } }
  .gift-tag { transform: rotate(-8deg); animation: gift-swing 6s ease-in-out infinite alternate; }
  @keyframes gift-swing { from { transform: rotate(-9deg); } to { transform: rotate(-4deg); } }
  .gift-sparkle { animation: gift-twinkle 2.6s ease-in-out infinite; }
  @keyframes gift-twinkle { 0%, 100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.1); } }
  @media (prefers-reduced-motion: reduce) {
    .gift-flake, .gift-tag, .gift-sparkle { animation: none !important; }
    .gift-tag { transform: rotate(-6deg); }
  }
`;

/** Decorative twinkling sparkles scattered over a dark section. */
export function SparkleField({ palette, count = 7 }: { palette: GiftPalette; count?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <Sparkles
          key={i}
          className="gift-sparkle absolute"
          strokeWidth={1.5}
          style={{
            left: `${(i * 41 + 9) % 94}%`,
            top: `${(i * 23 + 11) % 86}%`,
            width: 10 + ((i * 7) % 10),
            height: 10 + ((i * 7) % 10),
            color: palette.gold,
            animationDelay: `${(i * 0.7) % 2.6}s`,
          }}
        />
      ))}
    </div>
  );
}
