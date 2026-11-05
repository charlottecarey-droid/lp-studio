import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY, resolveForestPalette, type ForestStyleProps } from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Logos — type "forest-logos"  (DSO Page family, Nov 2026)
 *
 * The artifact's customers strip: a 44px-padded white band with a bottom
 * hairline, a 220px caption on the left and an infinite marquee on the right
 * (track duplicated, 42s linear, pauses on hover, masked edges). A logo is an
 * image (quiet at .55, full on hover) or, without one, a text wordmark in the
 * display face with a small rotated-square glyph in front — the artifact's
 * `.lg i`. Reduced motion renders a static wrapping row, never a frozen
 * ribbon. The second copy of the track is decorative (aria-hidden).
 * -------------------------------------------------------------------------- */

export interface ForestLogo {
  name: string;
  imageUrl?: string;
  imageAlt?: string;
  url?: string;
}

export interface ForestLogosBlockProps extends ForestStyleProps {
  /** Short line at the left of the strip (220px column on desktop). */
  caption?: string;
  /** 3–14 customer marks; no image = a display-face wordmark. */
  logos: ForestLogo[];
  /** Image logo height in px (18–64). Default 28. */
  logoHeight?: number;
  /** Seconds per loop (20–90). Default 42. */
  speed?: number;
  /** Resting opacity of each mark (0.3–1). Default 0.55; hover restores 1. */
  opacity?: number;
  /** Desaturate image logos. Default true. */
  grayscale?: boolean;
  anchorId?: string;
}

interface Props {
  props: ForestLogosBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestLogosBlockProps) => void;
}

export const FOREST_LOGOS_DEFAULT_PROPS: ForestLogosBlockProps = {
  caption: "Trusted by the groups that run lab strategy as a discipline, from 20 locations to 400.",
  logos: [
    { name: "Northwind Dental Partners" },
    { name: "Harbor Smiles Group" },
    { name: "Summit Dental Alliance" },
    { name: "Bluegrass Dental Partners" },
    { name: "Meridian Oral Health" },
    { name: "Lakeside Dental Group" },
    { name: "Cedar & Co. Dentistry" },
    { name: "Atlas Dental Partners" },
  ],
  logoHeight: 28,
  speed: 42,
  opacity: 0.55,
  grayscale: true,
  anchorId: "customers",
  backgroundStyle: "white",
};

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

export function BlockForestLogos({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_LOGOS_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;

  const logos = (p.logos ?? []).filter((l) => l.name?.trim() || l.imageUrl || isEditor).slice(0, 14);
  const height = clamp(p.logoHeight, 18, 64, 28);
  const speed = clamp(p.speed, 20, 90, 42);
  const opacity = clamp(p.opacity, 0.3, 1, 0.55);
  const grayscale = p.grayscale !== false;

  const field = (key: keyof ForestLogosBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestLogosBlockProps[typeof key] }) : undefined;
  const updateLogo = onFieldChange
    ? (i: number, patch: Partial<ForestLogo>) => onFieldChange({ ...props, logos: (p.logos ?? []).map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })
    : undefined;

  const markColor = pal.heading;

  /** One logo. `live` = the first copy of the track (editable, in the a11y tree); the duplicate is plain + aria-hidden.
   *  A render function, not a nested component, so InlineText keeps focus between keystrokes in the builder. */
  const renderMark = (logo: ForestLogo, i: number, live: boolean) => {
    const editable = live && isEditor;
    const inner = logo.imageUrl || editable ? (
      editable ? (
        <InlineImage
          src={logo.imageUrl ?? ""}
          alt={logo.imageAlt || logo.name}
          className="w-auto object-contain"
          style={{ height, maxWidth: height * 6, filter: grayscale && logo.imageUrl ? "grayscale(1)" : undefined }}
          onUpdate={updateLogo ? (v) => updateLogo(i, { imageUrl: v }) : undefined}
          onAltUpdate={updateLogo ? (v) => updateLogo(i, { imageAlt: v }) : undefined}
        />
      ) : (
        <img
          src={logo.imageUrl}
          alt={live ? logo.imageAlt || logo.name : ""}
          loading="lazy"
          className="w-auto object-contain"
          style={{ height, maxWidth: height * 6, filter: grayscale ? "grayscale(1)" : undefined }}
        />
      )
    ) : null;

    const wordmark = (!logo.imageUrl || editable) && (
      <span className="inline-flex items-center gap-2.5 whitespace-nowrap" style={{ fontFamily: FOREST_DISPLAY, fontSize: 21, letterSpacing: "-0.02em", color: markColor, lineHeight: 1 }}>
        <i aria-hidden className="inline-block h-[9px] w-[9px] shrink-0 rotate-45 rounded-[2px]" style={{ background: markColor, opacity: 0.5 }} />
        {live ? (
          <InlineText as="span" value={logo.name} onUpdate={updateLogo ? (v) => updateLogo(i, { name: v }) : undefined} />
        ) : (
          <span>{logo.name}</span>
        )}
      </span>
    );

    const body = (
      <>
        {inner}
        {wordmark}
      </>
    );
    const cls = "forest-lg inline-flex h-9 shrink-0 items-center gap-3";
    const style = { opacity, color: markColor } as const;
    if (logo.url && !isEditor) {
      return (
        <a key={i} href={logo.url} className={cn(cls, "no-underline")} style={style} aria-label={logo.name} aria-hidden={live ? undefined : true} tabIndex={live ? undefined : -1}>
          {body}
        </a>
      );
    }
    return (
      <span key={i} className={cls} style={style} aria-hidden={live ? undefined : true}>
        {body}
      </span>
    );
  };

  const copy = (live: boolean) => (
    <div className={cn("flex shrink-0 items-center gap-14", !live && "pl-14")} aria-hidden={live ? undefined : true}>
      {logos.map((l, i) => renderMark(l, i, live))}
    </div>
  );

  return (
    <section
      id={p.anchorId || undefined}
      data-block="forest-logos"
      className="forest-logos relative"
      aria-label="Customers"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, paddingBlock: 44, borderBottom: `1px solid ${pal.hairline}` }}
    >
      <style>{FOREST_CSS}</style>
      <style>{`
        @keyframes forest-marquee { to { transform: translateX(-50%); } }
        .forest-marquee { overflow: hidden; position: relative; -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
        .forest-marquee-track { display: flex; width: max-content; animation: forest-marquee var(--forest-marquee-speed, 42s) linear infinite; }
        .forest-marquee:hover .forest-marquee-track { animation-play-state: paused; }
        .forest-lg { transition: opacity .4s; }
        .forest-lg:hover, .forest-lg:focus-visible { opacity: 1 !important; }
        @media (prefers-reduced-motion: reduce) { .forest-marquee-track { animation: none; } }
      `}</style>
      <div className={cn(FOREST_CONTAINER, "grid gap-[22px] min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[900px]:items-center min-[900px]:gap-10")}>
        {(p.caption || isEditor) && (
          <p className="m-0 text-[13px] leading-[1.5]" style={{ color: pal.muted }}>
            <InlineText as="span" value={p.caption ?? ""} onUpdate={field("caption")} multiline />
          </p>
        )}
        {logos.length > 0 && (
          reduced ? (
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4 min-w-0">
              {logos.map((l, i) => renderMark(l, i, true))}
            </div>
          ) : (
            <div className="forest-marquee min-w-0">
              <div className="forest-marquee-track" style={{ ["--forest-marquee-speed" as string]: `${speed}s` } as React.CSSProperties}>
                {copy(true)}
                {copy(false)}
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
