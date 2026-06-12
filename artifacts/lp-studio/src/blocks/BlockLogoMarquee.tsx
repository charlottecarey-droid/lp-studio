import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LogoMarqueeBlockProps, SocialProofLogo } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ─────────────────────────────────────────────────────────────────────────────
 * Logo Marquee — continuous horizontal logo ribbon(s) with edge fade masks.
 * 2026 treatment: logos at a consistent height in muted grayscale that restore
 * to full color on hover/focus, optional counter-scrolling second row, pause on
 * hover, and a prefers-reduced-motion fallback that renders a STATIC centered
 * grid (never a frozen marquee). Loop + second-row duplicates are aria-hidden
 * so screen readers hear each logo exactly once.
 *
 * Backward compatible with the registered `logo-marquee` props shape
 * (LogoMarqueeBlockProps). New OPTIONAL fields are layered on via
 * LogoMarqueeWallProps below; fold them into generic-blocks.ts when convenient.
 * Logos are TENANT-supplied customer marks — EXCLUDED from AI image fill.
 * ──────────────────────────────────────────────────────────────────────────── */

/** A marquee logo. `name` doubles as alt text; `imageUrl` is the mark itself
 *  (letter-mark fallback when unset); `href` makes the logo a link. */
export type MarqueeLogo = SocialProofLogo & {
  /** Optional click-through URL — renders the logo as a focusable link. */
  href?: string;
};

/** Widened props accepted by this block. All additions are optional, so every
 *  existing page payload remains valid. */
export type LogoMarqueeWallProps = Omit<LogoMarqueeBlockProps, "logos"> & {
  logos?: MarqueeLogo[];
  /** Pause the scroll while the ribbon is hovered. Default true. */
  pauseOnHover?: boolean;
};

const DEFAULT_LOGOS: MarqueeLogo[] = [
  { name: "Northwind" },
  { name: "Lumina" },
  { name: "Vertex" },
  { name: "Cobalt" },
  { name: "Mirador" },
  { name: "Solstice" },
  { name: "Equinox" },
  { name: "Zenith" },
];

const SPEED_SECONDS: Record<NonNullable<LogoMarqueeBlockProps["speed"]>, number> = {
  slow: 60,
  medium: 40,
  fast: 24,
};

interface Props {
  props: LogoMarqueeBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: LogoMarqueeBlockProps) => void;
}

function LogoMark({
  logo,
  grayscale,
  dark,
  family,
  textColor,
  accent,
  /** True for the seamless-loop / second-row duplicates: hidden from the
   *  accessibility tree and removed from the tab order. */
  decorative,
}: {
  logo: MarqueeLogo;
  grayscale: boolean;
  dark: boolean;
  family: string;
  textColor: string;
  accent: string;
  decorative?: boolean;
}) {
  const visual = logo.imageUrl ? (
    <img
      src={logo.imageUrl}
      alt={decorative ? "" : logo.name}
      loading="lazy"
      className={cn(
        "h-8 w-auto max-w-[160px] object-contain transition duration-300",
        grayscale && "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-focus-visible:grayscale-0 group-focus-visible:opacity-100",
      )}
    />
  ) : (
    <span
      className={cn(
        "flex items-center gap-2.5 whitespace-nowrap transition-opacity duration-300",
        grayscale && "opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100",
      )}
      style={{ color: textColor }}
      aria-hidden={decorative || undefined}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
        style={{ backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(100,116,139,0.12)" }}
      >
        {(logo.name || "").trim().charAt(0).toUpperCase() || "•"}
      </span>
      <span className="text-xl font-bold tracking-tight md:text-2xl" style={{ fontFamily: family }}>
        {logo.name}
      </span>
    </span>
  );

  if (logo.href) {
    return (
      <a
        href={logo.href}
        aria-hidden={decorative || undefined}
        tabIndex={decorative ? -1 : undefined}
        aria-label={logo.imageUrl ? undefined : logo.name}
        className="group inline-flex shrink-0 items-center rounded-md px-8 py-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 md:px-10"
        style={{ outlineColor: accent }}
      >
        {visual}
      </a>
    );
  }
  return (
    <span
      aria-hidden={decorative || undefined}
      className="group inline-flex shrink-0 items-center px-8 py-1 md:px-10"
    >
      {visual}
    </span>
  );
}

export function BlockLogoMarquee({ props, brand, animationsEnabled }: Props) {
  const p = props as LogoMarqueeWallProps;
  const surface = resolveSectionSurface(props, "#ffffff");
  const dark = surface.isDark;
  const textColor = props.textColor || surface.color || (dark ? "rgba(255,255,255,0.85)" : "#334155");
  const accent = props.accentColor || brand?.primaryColor || "var(--brand-accent, #4f46e5)";
  const grayscale = props.grayscale !== false;
  const twoRows = props.twoRows !== false;
  const pauseOnHover = p.pauseOnHover !== false;
  const duration = SPEED_SECONDS[props.speed ?? "medium"];
  const logos: MarqueeLogo[] = p.logos && p.logos.length > 0 ? p.logos : DEFAULT_LOGOS;

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  // Reduced motion (or page animations off) → static centered grid, NOT a
  // frozen marquee: a stopped ribbon clips logos at the edge masks and looks
  // broken. The CSS @media override below is belt-and-braces for the brief
  // window before React hydrates the matchMedia value.
  const reduceMotion = useReducedMotion() ?? false;
  const staticGrid = reduceMotion || animationsEnabled === false;

  const markProps = { grayscale, dark, family: headFamily, textColor, accent };

  /** One scrolling row. The second copy of the logo set (needed for the
   *  seamless loop) is decorative: aria-hidden + out of the tab order. The
   *  entire second ROW is also decorative — it repeats the same logos. */
  const Track = ({ reverse, decorativeRow }: { reverse?: boolean; decorativeRow?: boolean }) => (
    <div className="flex overflow-hidden" aria-hidden={decorativeRow || undefined}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          className="lmq-track flex min-w-full shrink-0 items-center justify-around"
          style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
        >
          {logos.map((logo, i) => (
            <LogoMark key={`${copy}-${i}`} logo={logo} decorative={decorativeRow || copy === 1} {...markProps} />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden" style={{ background: surface.background }}>
      {/* Faint accent bloom so the band reads designed, not default. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 h-52 w-[34rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accent} ${dark ? "16%" : "8%"}, transparent), transparent 70%)` }}
      />
      <style>{`
        @keyframes lmqScrollX {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .lmq-track { animation-name: lmqScrollX; animation-timing-function: linear; animation-iteration-count: infinite; }
        ${pauseOnHover ? ".lmq-band:hover .lmq-track, .lmq-band:focus-within .lmq-track { animation-play-state: paused; }" : ""}
        @media (prefers-reduced-motion: reduce) { .lmq-track { animation: none; } }
      `}</style>

      <div className="relative z-10 py-14 md:py-16">
        {props.eyebrow && (
          <div className="mb-10 flex flex-col items-center px-6">
            <h2
              className="text-center text-xs font-semibold uppercase tracking-[0.18em] md:text-sm"
              style={{ color: dark ? "rgba(255,255,255,0.6)" : "#64748b", fontFamily: bodyFamily }}
            >
              {props.eyebrow}
            </h2>
            <span
              aria-hidden="true"
              className="mt-3 h-0.5 w-10 rounded-full"
              style={{ background: `linear-gradient(to right, ${accent}, color-mix(in srgb, ${accent} 20%, transparent))` }}
            />
          </div>
        )}

        {staticGrid ? (
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-y-6 px-6">
            {logos.map((logo, i) => (
              <LogoMark key={i} logo={logo} {...markProps} />
            ))}
          </div>
        ) : (
          <div
            className="lmq-band relative flex w-full flex-col gap-7"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <Track />
            {twoRows && <Track reverse decorativeRow />}
          </div>
        )}
      </div>
    </section>
  );
}
