import { Star, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RatingBadgesBlockProps, RatingBadge } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: RatingBadgesBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: RatingBadgesBlockProps) => void;
}

const DEFAULT_BADGES: RatingBadge[] = [
  { platform: "ReviewHub", rating: 4.9, reviewCount: "1,240 reviews", award: "Top Rated" },
  { platform: "SoftRank", rating: 4.8, reviewCount: "860 reviews", award: "Leader", featured: true },
  { platform: "TrustScore", rating: 4.9, reviewCount: "2,100 reviews", award: "Excellent" },
  { platform: "PeerVoice", rating: 4.7, reviewCount: "540 reviews", award: "High Performer" },
];

function Stars({ rating, max, size, color }: { rating: number; max: number; size: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of ${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const fillPct = Math.max(0, Math.min(1, rating - i)) * 100;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0"
              style={{ width: size, height: size, color: "#cbd5e1" }}
              strokeWidth={0}
              fill="currentColor"
            />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <Star style={{ width: size, height: size, color }} strokeWidth={0} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function BlockRatingBadges({ props }: Props) {
  const surface = resolveSectionSurface(props, "#f8fafc");
  const textColor = props.textColor || surface.color || "#0f172a";
  const accent = props.accentColor || "var(--brand-accent, #6366f1)";
  const ratingMax = props.ratingMax && props.ratingMax > 0 ? props.ratingMax : 5;
  const badges = props.badges && props.badges.length > 0 ? props.badges : DEFAULT_BADGES;
  const starColor = "#f59e0b";

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  return (
    <section className="w-full" style={{ background: surface.background }}>
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 flex flex-col items-center gap-10 md:gap-12">
        {props.eyebrow && (
          <h2
            className="text-center text-sm md:text-base font-semibold uppercase tracking-[0.16em]"
            style={{ color: "#64748b", fontFamily: bodyFamily }}
          >
            {props.eyebrow}
          </h2>
        )}
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge, i) => {
            const featured = !!badge.featured;
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col items-center gap-4 rounded-2xl border p-6 text-center transition-shadow",
                  featured ? "shadow-lg" : "shadow-sm",
                )}
                style={
                  featured
                    ? { backgroundColor: "#0f172a", borderColor: accent, color: "#ffffff" }
                    : { backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: textColor }
                }
              >
                <span
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{ fontFamily: bodyFamily, color: featured ? "#ffffff" : "#475569" }}
                >
                  {badge.platform}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold leading-none" style={{ fontFamily: headFamily }}>
                    {badge.rating.toFixed(1)}
                  </span>
                  <span className="text-base font-medium" style={{ color: featured ? "#94a3b8" : "#94a3b8" }}>
                    /{ratingMax}
                  </span>
                </div>
                <Stars rating={badge.rating} max={ratingMax} size={18} color={starColor} />
                {badge.reviewCount && (
                  <span className="text-sm" style={{ color: featured ? "#cbd5e1" : "#64748b" }}>
                    {badge.reviewCount}
                  </span>
                )}
                {badge.award && (
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={
                      featured
                        ? { backgroundColor: accent, color: "#ffffff" }
                        : { backgroundColor: "rgba(99,102,241,0.1)", color: accent }
                    }
                  >
                    <Award className="h-3.5 w-3.5" />
                    {badge.award}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
