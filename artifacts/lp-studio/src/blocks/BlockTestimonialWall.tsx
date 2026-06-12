import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeroBrandStyleConfig } from "@/lib/block-types";
import type { BackgroundStyle } from "@/lib/bg-styles";
import { resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";
import { InlineText } from "@/components/InlineText";

/* ─────────────────────────────────────────────────────────────────────────────
 * Testimonial Wall — a masonry wall of 3–9 quote cards (CSS columns, 1/2/3
 * responsive). Part of the graduated generic SOCIAL-PROOF family (see
 * generic-blocks.ts): testimonial content is TENANT-supplied — avatars and
 * company logos are real customer assets and must NEVER be auto-filled by the
 * AI image service (fabricated faces/logos would be false proof). Cards fall
 * back to an initials circle / no logo until the tenant uploads assets, so the
 * block reads cleanly with zero configuration.
 *
 * NOTE: this props interface lives here (not in lib/block-types) so the block
 * compiles standalone before registration. When wiring the block into the
 * union/registry, re-export these types from generic-blocks.ts.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TestimonialWallItem {
  /** The testimonial quote, without surrounding quotation marks. */
  quote: string;
  /** Person's full name, e.g. "Dr. Maya Chen". */
  name: string;
  /** Role / company line, e.g. "Owner, Lakeside Dental". */
  role?: string;
  /** Avatar photo URL. Unset → an initials circle renders instead.
   *  Tenant-supplied — EXCLUDED from AI image fill. */
  avatarUrl?: string;
  /** Small company logo shown opposite the byline.
   *  Tenant-supplied — EXCLUDED from AI image fill. */
  logoUrl?: string;
  /** Alt text for the company logo. Falls back to "<name> company logo". */
  logoAlt?: string;
  /** Star rating 1–5. Omit to hide the star row. */
  rating?: number;
  /** Featured card: accent border, soft accent glow, larger quote type. */
  featured?: boolean;
}

export interface TestimonialWallBlockProps extends HeroBrandStyleConfig {
  backgroundStyle?: BackgroundStyle;
  /** Kicker above the heading, e.g. "Loved by modern teams". */
  eyebrow?: string;
  /** Section heading (rendered as an h2). */
  headline?: string;
  /** One- or two-line subhead under the heading. */
  subheadline?: string;
  /** 3–9 testimonial cards. */
  testimonials: TestimonialWallItem[];
  /** Maximum columns on desktop. Default 3. */
  columns?: 2 | 3;
}

/** Zero-config defaults — used by the block registry's defaultProps factory. */
export const TESTIMONIAL_WALL_DEFAULT_PROPS: TestimonialWallBlockProps = {
  eyebrow: "Wall of love",
  headline: "Teams stopped settling. Here's what happened.",
  subheadline: "Real words from the people who switched — unedited, unpaid, and still a little surprised.",
  columns: 3,
  testimonials: [
    {
      quote: "We migrated on a Friday afternoon expecting a lost weekend. By Monday the whole team had moved over on their own. I've never seen adoption happen by itself like that.",
      name: "Maya Chen",
      role: "VP Operations, Northwind",
      rating: 5,
      featured: true,
    },
    {
      quote: "The onboarding was the first one in years that didn't require a follow-up meeting to explain the onboarding.",
      name: "Jonas Petrov",
      role: "Head of Product, Lumina",
      rating: 5,
    },
    {
      quote: "Support answered in four minutes. On a Sunday. With the actual fix.",
      name: "Priya Raman",
      role: "Founder, Vertex Labs",
    },
    {
      quote: "Our reporting went from a quarterly chore to something the team checks every morning with coffee. That shift alone paid for the year.",
      name: "Daniel Okafor",
      role: "COO, Cobalt",
      rating: 5,
    },
    {
      quote: "I was the skeptic on the team. I'm writing this testimonial.",
      name: "Sofia Marquez",
      role: "Engineering Lead, Mirador",
    },
    {
      quote: "Switching felt risky until we saw the first week's numbers. Now the only debate is why we waited so long.",
      name: "Elliot Hayes",
      role: "Director of Growth, Solstice",
      rating: 5,
    },
  ],
};

interface Props {
  props: TestimonialWallBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: TestimonialWallBlockProps) => void;
}

/** "Maya Chen" → "MC"; single word → first two letters; empty → "•". */
function initialsOf(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function StarRow({ rating, dark }: { rating: number; dark: boolean }) {
  const filled = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <div
      role="img"
      aria-label={`Rated ${filled} out of 5 stars`}
      className="mb-4 flex items-center gap-1"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className="h-4 w-4"
          style={{
            color: i < filled ? "#f59e0b" : dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.15)",
            fill: i < filled ? "#f59e0b" : "transparent",
          }}
        />
      ))}
    </div>
  );
}

export function BlockTestimonialWall({ props, brand, animationsEnabled, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const dark = surface.isDark;
  const accent = props.accentColor || "var(--brand-accent, #6366f1)";
  const sectionPy = brand ? SECTION_PY[brand.sectionPadding] : "py-20";
  const headingWeight = brand ? getHeadingWeightClass(brand) : "font-bold";
  const headingTracking = brand ? getHeadingLetterSpacingClass(brand) : "tracking-tight";

  const headingColor =
    props.textColor || (dark ? "var(--brand-heading-on-dark, #ffffff)" : "var(--brand-heading-on-light, #0f172a)");
  const quoteColor = props.textColor || (dark ? "rgba(255,255,255,0.92)" : "#1e293b");
  const mutedColor = dark ? "rgba(255,255,255,0.62)" : "#64748b";

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  const items =
    props.testimonials && props.testimonials.length > 0
      ? props.testimonials
      : TESTIMONIAL_WALL_DEFAULT_PROPS.testimonials;

  // Internal staggered scroll-reveal. Skipped in the builder canvas (content
  // must paint immediately for click-to-edit), when page animations are off,
  // and for prefers-reduced-motion. Hover lift is additionally killed in CSS
  // below so reduced-motion visitors get a fully static wall.
  const reduceMotion = useReducedMotion() ?? false;
  const reveal = animationsEnabled !== false && !reduceMotion && !onFieldChange;

  const field = (key: keyof TestimonialWallBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const itemField = (i: number, key: keyof TestimonialWallItem) =>
    onFieldChange
      ? (v: string) =>
          onFieldChange({
            ...props,
            testimonials: items.map((t, idx) => (idx === i ? { ...t, [key]: v } : t)),
          })
      : undefined;

  const colClass =
    (props.columns ?? 3) === 2 ? "columns-1 sm:columns-2" : "columns-1 sm:columns-2 lg:columns-3";

  const cardSurface: React.CSSProperties = dark
    ? {
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 16px 40px -24px rgba(0,0,0,0.5)",
      }
    : {
        background: "#ffffff",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 16px 40px -28px rgba(15,23,42,0.25)",
      };

  return (
    <section
      className={cn("relative w-full overflow-hidden px-6", sectionPy)}
      style={{ background: surface.background }}
    >
      {/* Faint accent mesh behind the glass cards on dark surfaces. */}
      {dark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(42rem 26rem at 18% 8%, color-mix(in srgb, ${accent} 14%, transparent), transparent 70%), radial-gradient(38rem 24rem at 85% 92%, color-mix(in srgb, ${accent} 10%, transparent), transparent 70%)`,
          }}
        />
      )}
      <style>{`
        .twall-card { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s cubic-bezier(0.22,1,0.36,1); }
        .twall-card:hover { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce) {
          .twall-card, .twall-card:hover { transform: none; transition: none; }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-6xl">
        {(props.eyebrow || props.headline || props.subheadline) && (
          <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center md:mb-16">
            {props.eyebrow && (
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] md:text-sm"
                style={{ color: accent, fontFamily: bodyFamily }}
              >
                <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: bodyFamily }} />
              </p>
            )}
            {props.headline && (
              <h2
                className={cn("text-3xl leading-tight md:text-4xl", headingWeight, headingTracking)}
                style={{ color: headingColor, fontFamily: headFamily }}
              >
                <InlineText value={props.headline} onUpdate={field("headline")} multiline style={{ fontFamily: headFamily }} />
              </h2>
            )}
            {props.subheadline && (
              <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: mutedColor, fontFamily: bodyFamily }}>
                <InlineText value={props.subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: bodyFamily }} />
              </p>
            )}
          </div>
        )}

        <div className={cn(colClass, "gap-5 md:gap-6")}>
          {items.map((t, i) => {
            const featured = !!t.featured;
            const card = (
              <figure
                className="twall-card rounded-2xl p-6 md:p-7"
                style={{
                  ...cardSurface,
                  ...(featured
                    ? {
                        border: `1.5px solid color-mix(in srgb, ${accent} 55%, transparent)`,
                        boxShadow: `0 0 0 4px color-mix(in srgb, ${accent} 8%, transparent), ${
                          dark
                            ? "0 16px 40px -24px rgba(0,0,0,0.5)"
                            : "0 16px 40px -28px rgba(15,23,42,0.25)"
                        }`,
                      }
                    : null),
                }}
              >
                {typeof t.rating === "number" && t.rating > 0 && <StarRow rating={t.rating} dark={dark} />}
                <blockquote
                  className={cn("leading-relaxed", featured ? "text-lg md:text-xl" : "text-[15px] md:text-base")}
                  style={{ color: quoteColor, fontFamily: bodyFamily }}
                >
                  <p>
                    "<InlineText value={t.quote} onUpdate={itemField(i, "quote")} multiline style={{ fontFamily: bodyFamily }} />"
                  </p>
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={`${t.name} portrait`}
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                      style={{ border: dark ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(15,23,42,0.08)" }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: `color-mix(in srgb, ${accent} ${dark ? "26%" : "14%"}, transparent)`,
                        color: dark ? "rgba(255,255,255,0.9)" : accent,
                        fontFamily: bodyFamily,
                      }}
                    >
                      {initialsOf(t.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex flex-col">
                    <InlineText
                      as="strong"
                      value={t.name}
                      onUpdate={itemField(i, "name")}
                      className="truncate text-sm font-semibold"
                      style={{ color: headingColor, fontFamily: bodyFamily }}
                    />
                    {t.role && (
                      <InlineText
                        as="span"
                        value={t.role}
                        onUpdate={itemField(i, "role")}
                        className="truncate text-xs"
                        style={{ color: mutedColor, fontFamily: bodyFamily }}
                      />
                    )}
                  </span>
                  {t.logoUrl && (
                    <img
                      src={t.logoUrl}
                      alt={t.logoAlt || `${t.name} company logo`}
                      loading="lazy"
                      className={cn("ml-auto h-5 w-auto max-w-[88px] shrink-0 object-contain", dark ? "opacity-80" : "opacity-60")}
                    />
                  )}
                </figcaption>
              </figure>
            );

            return reveal ? (
              <motion.div
                key={i}
                className="mb-5 break-inside-avoid md:mb-6"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: Math.min((i % 3) * 0.08 + Math.floor(i / 3) * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
              >
                {card}
              </motion.div>
            ) : (
              <div key={i} className="mb-5 break-inside-avoid md:mb-6">
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
