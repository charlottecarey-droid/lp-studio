import type { CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Rocket,
  Gauge,
  Globe,
  Heart,
  Star,
  Layers,
  BarChart3,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  isValidHex,
  relativeLuminance,
  pickCtaButtonColors,
  pickOutlineButtonColors,
  pickContrastingColor,
} from "@/lib/brand-config";
import type {
  CtaModalConfig,
  HeroCtaConfig,
  HeroBrandStyleConfig,
} from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

/**
 * Bento Mosaic Hero — a light-or-dark switchable split hero. The left ~45%
 * carries big editorial type (eyebrow + headline + subhead + CTAs); the right
 * is a 2-column bento mosaic: a large image tile, a stat tile, an accent
 * icon tile, and a mini-testimonial tile. Cards are glass on dark / soft-
 * shadow on light, enter with a gentle stagger, and lift subtly on hover.
 * The mosaic stacks to a 2-col grid under the text on mobile.
 *
 * Props interface is exported from this file (registration manifest) — the
 * wiring agent re-homes it into `@/lib/block-types` when registering.
 */
export interface BentoMosaicHeroBlockProps
  extends CtaModalConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  /** Surface theme. `bgColor` (HeroBrandStyleConfig) overrides the preset hex. */
  theme?: "dark" | "light";
  /** Small kicker above the headline. Empty hides it. */
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Large image tile (spans the mosaic width). */
  imageTileUrl?: string;
  imageTileAlt?: string;
  /** Stat tile: big number + label. */
  statValue?: string;
  statLabel?: string;
  /** Accent tile: lucide icon name + short phrase. */
  accentIcon?: string;
  accentPhrase?: string;
  /** Mini-testimonial tile: quote + attribution. */
  quoteText?: string;
  quoteAuthor?: string;
  quoteRole?: string;
}

interface Props {
  props: BentoMosaicHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: BentoMosaicHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

const DARK_SURFACE = "#0A0A0F";
const LIGHT_SURFACE = "#FAFAF8";
const ACCENT_FALLBACK = "#6366F1";
const DISPLAY_FALLBACK = "'Inter', ui-sans-serif, system-ui, sans-serif";

/** Curated lucide set for the accent tile icon. */
const TILE_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Zap,
  Shield,
  Rocket,
  Gauge,
  Globe,
  Heart,
  Star,
  Layers,
  BarChart3,
  CheckCircle2,
};

function resolveIcon(name?: string): LucideIcon {
  return (name && TILE_ICONS[name]) || Sparkles;
}

export function BlockBentoMosaicHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const field = (key: keyof BentoMosaicHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const isEditor = !!onFieldChange;
  const prefersReducedMotion = useReducedMotion();

  // ── Theme / surface resolution ────────────────────────────────
  const theme = props.theme ?? "dark";
  const presetSurface = theme === "dark" ? DARK_SURFACE : LIGHT_SURFACE;
  const bg = props.bgColor || presetSurface;
  const surfaceHex = isValidHex(bg) ? bg : presetSurface;
  // A bgColor override flips the card treatment too — derive darkness from
  // the actual surface so glass cards never sit on a light override.
  const isDark = relativeLuminance(surfaceHex) < 0.4;
  const defaultText = isDark ? "#FFFFFF" : "#111114";
  const text = props.textColor || defaultText;
  const accent = props.accentColor || `var(--brand-accent, ${ACCENT_FALLBACK})`;

  // ── Fonts ─────────────────────────────────────────────────────
  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || DISPLAY_FALLBACK
    : `var(--brand-font-display, ${DISPLAY_FALLBACK})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // ── Runtime-resolved CTA + accent colors (contrast-guarded) ───
  const picked = pickCtaButtonColors(brand, surfaceHex);
  const primaryBg = props.ctaButtonColor || picked.bg;
  const primaryText = props.ctaButtonTextColor || picked.text;
  const outline = pickOutlineButtonColors(brand, surfaceHex);
  // Eyebrow / stat accent: brand accent stepped to a legible tint when it
  // collapses onto the surface (3.0 = WCAG AA for large text / UI).
  const accentInk = pickContrastingColor(
    isValidHex(brand.accentColor) ? brand.accentColor : null,
    surfaceHex,
    [brand.primaryColor],
    3.0,
  );

  // ── Card surface treatment: glass on dark / soft shadow on light ──
  const cardStyle: CSSProperties = isDark
    ? {
        backgroundColor: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 24px 48px -24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      }
    : {
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(17,17,20,0.06)",
        boxShadow: "0 24px 50px -22px rgba(17,17,20,0.18)",
      };
  const mutedColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(17,17,20,0.6)";

  // ── Entrance variants (reduced motion → none) ─────────────────
  const rise = (px: number) => (prefersReducedMotion ? 0 : px);
  const textVariants: Variants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: rise(24) },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };
  const mosaicVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.1, delayChildren: 0.15 } },
  };
  const tileVariants: Variants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: rise(20), scale: prefersReducedMotion ? 1 : 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  // ── Modal config pass-through ─────────────────────────────────
  const modalCfg = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
    modalChiliPiperHandoffUrl: props.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: props.modalChiliPiperHandoffMode,
    modalChiliPiperHandoffFieldMap: props.modalChiliPiperHandoffFieldMap,
    modalHeadline: props.modalHeadline,
    modalSubheadline: props.modalSubheadline,
    modalSubmitText: props.modalSubmitText,
    modalSuccessMessage: props.modalSuccessMessage,
    modalDisclaimer: props.modalDisclaimer,
    modalShowFirstName: props.modalShowFirstName,
    modalShowLastName: props.modalShowLastName,
    modalShowPhone: props.modalShowPhone,
    modalShowCompany: props.modalShowCompany,
  };

  // ── Resolved content (confident generic-SaaS defaults) ────────
  const eyebrow = props.eyebrow ?? "Meet the new standard";
  const headline = props.headline || "Everything your team ships, in one place";
  const subheadline =
    props.subheadline ??
    "Plan, build, and measure in a single workspace designed for speed — not for switching tabs.";
  const ctaText = props.ctaText || "Get started";
  const statValue = props.statValue ?? "4.9×";
  const statLabel = props.statLabel ?? "faster from idea to launch";
  const accentPhrase = props.accentPhrase ?? "Automations that clear your busywork";
  const quoteText =
    props.quoteText ?? "We replaced four tools in a week — and the team actually loves it.";
  const quoteAuthor = props.quoteAuthor ?? "Maya Chen";
  const quoteRole = props.quoteRole ?? "Head of Product, Arclight";
  const AccentIcon = resolveIcon(props.accentIcon);

  return (
    <section
      className="bmh-hero relative overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
    >
      <style>{`
        .bmh-tile { transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease; }
        @media (hover: hover) {
          .bmh-tile:hover { transform: translateY(-4px); }
        }
        .bmh-hero a:focus-visible, .bmh-hero button:focus-visible {
          outline: 2px solid var(--bmh-focus);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .bmh-tile, .bmh-tile:hover { transform: none; transition: none; }
        }
      `}</style>

      {/* Soft corner accent wash (decorative). */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `radial-gradient(ellipse 55% 50% at 85% 8%, color-mix(in srgb, ${accent} ${isDark ? "14%" : "9%"}, transparent), transparent 70%)`,
        }}
      />

      <div
        className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[45fr_55fr] lg:gap-16"
        style={{ "--bmh-focus": accentInk } as CSSProperties}
      >
        {/* ── Left: editorial type ── */}
        <motion.div
          variants={textVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {(eyebrow || isEditor) && (
            <div
              className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: accentInk }}
            >
              <span className="h-px w-8" style={{ backgroundColor: accentInk }} aria-hidden />
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
            </div>
          )}

          <h1
            className="mb-6 font-bold tracking-[-0.025em]"
            style={{
              fontFamily: headlineFamily,
              color: text,
              fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)",
              lineHeight: 1.05,
            }}
          >
            <InlineText as="span" value={headline} onUpdate={field("headline")} />
          </h1>

          {(subheadline || isEditor) && (
            <InlineText
              as="p"
              multiline
              value={subheadline}
              onUpdate={field("subheadline")}
              className="mb-9 max-w-lg text-lg leading-relaxed"
              style={{ color: mutedColor }}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaButton
              ctaAction={props.ctaAction || "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              {...modalCfg}
              onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="bento-mosaic-hero-primary"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryBg, color: primaryText }}
            >
              <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} />
              <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaButton>

            {(props.ctaSecondaryText || isEditor) && (
              <CtaButton
                ctaAction={props.ctaSecondaryAction || "url"}
                ctaUrl={props.ctaSecondaryUrl}
                chilipiperUrl={props.secondaryChilipiperUrl}
                videoUrl={props.secondaryVideoUrl}
                {...modalCfg}
                onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                source="bento-mosaic-hero-secondary"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border bg-transparent px-7 py-3.5 text-base font-semibold transition-colors"
                style={{ borderColor: outline.border, color: outline.text }}
              >
                <InlineText
                  as="span"
                  value={props.ctaSecondaryText || "See it in action"}
                  onUpdate={field("ctaSecondaryText")}
                />
              </CtaButton>
            )}
          </div>
        </motion.div>

        {/* ── Right: bento mosaic (stacks under the text on mobile) ── */}
        <motion.div
          className="grid grid-cols-2 gap-4"
          variants={mosaicVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Large image tile */}
          <motion.div
            variants={tileVariants}
            className="bmh-tile col-span-2 overflow-hidden rounded-3xl"
            style={cardStyle}
          >
            <div className="relative aspect-[16/9] w-full">
              {props.imageTileUrl || isEditor ? (
                <InlineImage
                  src={props.imageTileUrl ?? ""}
                  alt={props.imageTileAlt || "Product preview"}
                  wrapperClassName="block w-full h-full"
                  className="h-full w-full object-cover"
                  onUpdate={field("imageTileUrl")}
                  onAltUpdate={field("imageTileAlt")}
                />
              ) : (
                <div
                  className="h-full w-full"
                  aria-hidden
                  style={{
                    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accent} 30%, transparent), transparent 60%), linear-gradient(to top right, color-mix(in srgb, var(--brand-primary, #3b82f6) 22%, transparent), transparent)`,
                  }}
                />
              )}
            </div>
          </motion.div>

          {/* Stat tile */}
          <motion.div
            variants={tileVariants}
            className="bmh-tile flex min-h-[150px] flex-col justify-center gap-1.5 rounded-3xl p-6"
            style={cardStyle}
          >
            <InlineText
              as="div"
              value={statValue}
              onUpdate={field("statValue")}
              className="font-bold tracking-tight"
              style={{
                fontFamily: `var(--brand-font-numbers, ${headlineFamily})`,
                fontSize: "clamp(2.25rem, 4vw, 3.25rem)",
                lineHeight: 1,
                color: accentInk,
              }}
            />
            <InlineText
              as="div"
              value={statLabel}
              onUpdate={field("statLabel")}
              className="text-sm leading-snug"
              style={{ color: mutedColor }}
            />
          </motion.div>

          {/* Accent icon tile */}
          <motion.div
            variants={tileVariants}
            className="bmh-tile flex min-h-[150px] flex-col justify-between gap-4 rounded-3xl p-6"
            style={{
              ...cardStyle,
              backgroundColor: `color-mix(in srgb, ${accent} ${isDark ? "16%" : "10%"}, ${surfaceHex})`,
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)` }}
              aria-hidden
            >
              <AccentIcon className="h-5 w-5" style={{ color: accentInk }} />
            </div>
            <InlineText
              as="div"
              value={accentPhrase}
              onUpdate={field("accentPhrase")}
              className="text-sm font-semibold leading-snug"
              style={{ color: text }}
            />
          </motion.div>

          {/* Mini-testimonial tile */}
          <motion.figure
            variants={tileVariants}
            className="bmh-tile col-span-2 m-0 rounded-3xl p-6 md:p-7"
            style={cardStyle}
          >
            <blockquote className="m-0">
              <InlineText
                as="p"
                multiline
                value={quoteText}
                onUpdate={field("quoteText")}
                className="m-0 text-base leading-relaxed md:text-lg"
                style={{ color: text, fontFamily: headlineFamily }}
              />
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                aria-hidden
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
                  color: accentInk,
                }}
              >
                {(quoteAuthor || "•").charAt(0)}
              </span>
              <span className="text-sm">
                <InlineText
                  as="span"
                  value={quoteAuthor}
                  onUpdate={field("quoteAuthor")}
                  className="font-semibold"
                  style={{ color: text }}
                />
                {(quoteRole || isEditor) && (
                  <>
                    <span style={{ color: mutedColor }}> · </span>
                    <InlineText
                      as="span"
                      value={quoteRole}
                      onUpdate={field("quoteRole")}
                      style={{ color: mutedColor }}
                    />
                  </>
                )}
              </span>
            </figcaption>
          </motion.figure>
        </motion.div>
      </div>
    </section>
  );
}
