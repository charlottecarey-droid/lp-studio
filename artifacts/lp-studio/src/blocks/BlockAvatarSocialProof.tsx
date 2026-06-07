import { Star } from "lucide-react";
import type { AvatarSocialProofBlockProps, SocialProofAvatar } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";

interface Props {
  props: AvatarSocialProofBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: AvatarSocialProofBlockProps) => void;
}

const DEFAULT_AVATARS: SocialProofAvatar[] = [
  { initials: "AR" },
  { initials: "MK" },
  { initials: "JL" },
  { initials: "TS" },
  { initials: "DP" },
];

const AVATAR_TINTS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

function Stars({ rating, max, color }: { rating: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of ${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const fillPct = Math.max(0, Math.min(1, rating - i)) * 100;
        return (
          <span key={i} className="relative inline-block" style={{ width: 18, height: 18 }}>
            <Star className="absolute inset-0" style={{ width: 18, height: 18, color: "#cbd5e1" }} strokeWidth={0} fill="currentColor" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <Star style={{ width: 18, height: 18, color }} strokeWidth={0} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function BlockAvatarSocialProof({ props }: Props) {
  const bg = props.bgColor || "#ffffff";
  const textColor = props.textColor || "#0f172a";
  const accent = props.accentColor || "var(--brand-accent, #6366f1)";
  const ratingMax = props.ratingMax && props.ratingMax > 0 ? props.ratingMax : 5;
  const avatars = props.avatars && props.avatars.length > 0 ? props.avatars : DEFAULT_AVATARS;
  const starColor = "#f59e0b";

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  return (
    <section className="w-full" style={{ backgroundColor: bg }}>
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-20 flex flex-col items-center gap-6 text-center">
        <div className="flex items-center">
          <div className="flex">
            {avatars.map((a, i) => (
              <div
                key={i}
                className="-ml-3 first:ml-0 flex h-12 w-12 items-center justify-center rounded-full ring-4 text-sm font-semibold text-white overflow-hidden"
                style={{ backgroundColor: AVATAR_TINTS[i % AVATAR_TINTS.length], boxShadow: `0 0 0 4px ${bg}` }}
              >
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span>{(a.initials || "").slice(0, 2).toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
          {props.extraCountLabel && (
            <div
              className="-ml-3 flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-sm font-bold text-white"
              style={{ backgroundColor: accent, boxShadow: `0 0 0 4px ${bg}` }}
            >
              {props.extraCountLabel}
            </div>
          )}
        </div>

        {(typeof props.rating === "number" || props.reviewSummary) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {typeof props.rating === "number" && <Stars rating={props.rating} max={ratingMax} color={starColor} />}
            <span className="text-sm font-medium" style={{ color: "#64748b", fontFamily: bodyFamily }}>
              {typeof props.rating === "number" && <strong style={{ color: textColor }}>{props.rating.toFixed(1)}</strong>}
              {props.reviewSummary ? ` ${props.reviewSummary}` : ""}
            </span>
          </div>
        )}

        <h2
          className="text-2xl md:text-4xl font-bold tracking-tight"
          style={{ color: textColor, fontFamily: headFamily }}
        >
          {props.headline}
        </h2>

        {props.testimonialQuote && (
          <figure className="mt-2 max-w-2xl">
            <blockquote
              className="text-lg md:text-xl leading-relaxed italic"
              style={{ color: "#334155", fontFamily: bodyFamily }}
            >
              &ldquo;{props.testimonialQuote}&rdquo;
            </blockquote>
            {props.testimonialAuthor && (
              <figcaption className="mt-3 text-sm font-semibold" style={{ color: "#64748b" }}>
                — {props.testimonialAuthor}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}
