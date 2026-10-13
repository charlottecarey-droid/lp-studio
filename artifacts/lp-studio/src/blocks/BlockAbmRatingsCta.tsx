import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { AbmCtaButtons, ABM_CTA_DEFAULTS, type AbmCtaProps } from "./abm/AbmCta";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Ratings CTA — type "abm-ratings-cta"
 *
 * The dark close: "Ready to better manage mission-critical projects?" with the
 * CTA pair on the left, and a 2×2 grid of review-platform ratings on the
 * right — a platform logo (inverted to white on dark), filled stars and the
 * "4.6 (2,675)" score line. Near-black by default.
 * -------------------------------------------------------------------------- */

export interface AbmRating {
  platform: string;
  logoUrl?: string;
  logoAlt?: string;
  /** 0–5, decimals allowed. */
  rating: number;
  /** Review count as shown ("2,675", "46K"). */
  count?: string;
  url?: string;
}

export interface AbmRatingsCtaBlockProps extends AbmCtaProps, AbmStyleProps {
  headline?: string;
  subheadline?: string;
  ratings: AbmRating[];
  /** Force platform logos to the text ink (white on dark). Default follows the surface. */
  monochromeLogos?: boolean;
  /** Star colour. Blank = brand accent. */
  starColor?: string;
  anchorId?: string;
}

interface Props {
  props: AbmRatingsCtaBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AbmRatingsCtaBlockProps) => void;
}

export const ABM_RATINGS_CTA_DEFAULT_PROPS: AbmRatingsCtaBlockProps = {
  ...ABM_CTA_DEFAULTS,
  headline: "Ready to better manage\nmission-critical projects?",
  subheadline: "",
  ctaText: "Request a demo",
  ctaUrl: "#",
  ratings: [
    { platform: "Software Advice", rating: 4.5, count: "2,675" },
    { platform: "G2", rating: 4.6, count: "4,298" },
    { platform: "App Store", rating: 4.6, count: "46K" },
    { platform: "Google Play", rating: 3.8, count: "3,250" },
  ],
  anchorId: "demo",
  backgroundStyle: "black",
};

function Stars({ value, color, track }: { value: number; color: string; track: string }) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  const row = (c: string) => (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4" strokeWidth={0} fill={c} aria-hidden />)}
    </span>
  );
  return (
    <span className="relative inline-flex" aria-hidden>
      {row(track)}
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>{row(color)}</span>
    </span>
  );
}

export function BlockAbmRatingsCta({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#000000");
  const isEditor = !!onFieldChange;
  const ratings = props.ratings ?? [];
  const star = props.starColor && /^#[0-9a-f]{6}$/i.test(props.starColor) ? props.starColor : pal.accent;
  const monochrome = props.monochromeLogos ?? pal.dark;

  const field = (key: keyof AbmRatingsCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmRatingsCtaBlockProps[typeof key] }) : undefined;
  const label = onFieldChange ? (key: "ctaText" | "ctaSecondaryText", v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateRating = onFieldChange
    ? (i: number, patch: Partial<AbmRating>) => onFieldChange({ ...props, ratings: ratings.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-ratings-cta relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-24")}>
        <motion.div {...reveal(0)} className="lg:col-span-6">
          <h2 className="max-w-[18ch] whitespace-pre-line" style={displayStyle("clamp(2rem, 3.8vw, 3rem)", pal.heading, 700)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </h2>
          {(props.subheadline || isEditor) && (
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
          <div className="mt-8">
            <AbmCtaButtons props={props} brand={brand} palette={pal} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} onLabelChange={label} source="abm-ratings-cta" />
          </div>
        </motion.div>

        {ratings.length > 0 && (
          <motion.ul {...reveal(0.1)} className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:col-span-6">
            {ratings.map((r, i) => {
              const logo = r.logoUrl || isEditor ? (
                <InlineImage
                  src={r.logoUrl ?? ""}
                  alt={r.logoAlt || r.platform}
                  className="h-7 w-auto max-w-[180px] object-contain object-left"
                  style={{ filter: monochrome && r.logoUrl ? (pal.dark ? "brightness(0) invert(1)" : "brightness(0)") : undefined }}
                  loading="lazy"
                  onUpdate={updateRating ? (v) => updateRating(i, { logoUrl: v }) : undefined}
                  onAltUpdate={updateRating ? (v) => updateRating(i, { logoAlt: v }) : undefined}
                />
              ) : null;
              return (
                <li key={i} className="flex flex-col gap-3">
                  <div className="flex h-7 items-center">
                    {r.logoUrl ? (
                      r.url ? <a href={r.url} aria-label={r.platform} className="no-underline">{logo}</a> : logo
                    ) : (
                      <span className="flex items-center gap-3">
                        {isEditor && logo}
                        <span className="text-[17px] font-bold tracking-tight" style={{ color: pal.heading }}>
                          <InlineText as="span" value={r.platform} onUpdate={updateRating ? (v) => updateRating(i, { platform: v }) : undefined} />
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5" aria-label={`${r.platform}: ${r.rating} out of 5${r.count ? ` from ${r.count} reviews` : ""}`}>
                    <Stars value={r.rating} color={star} track={pal.hairline} />
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: pal.text }}>{Number.isFinite(r.rating) ? r.rating.toFixed(1) : ""}</span>
                    {(r.count || isEditor) && (
                      <span className="text-[13px] tabular-nums" style={{ color: pal.muted }}>
                        (<InlineText as="span" value={r.count ?? ""} onUpdate={updateRating ? (v) => updateRating(i, { count: v }) : undefined} />)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </section>
  );
}
