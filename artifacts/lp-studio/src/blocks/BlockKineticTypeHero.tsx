import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
import { CtaButton } from "@/components/CtaButton";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

/**
 * Kinetic Type Hero — an editorial statement hero built from pure typography.
 * Near-full-viewport, massive clamp()'d display type whose words rise into
 * view with a staggered reveal on mount (reduced motion: instant), one
 * accent-colored italic/underlined word (configurable index), a small
 * overline kicker, a bottom-edge subhead row with the CTAs inline, and an
 * optional thin marquee strip of short phrases along the very bottom
 * (reduced motion: static). No image required — it looks great with any
 * brand font on light or dark.
 *
 * Props interface is exported from this file (registration manifest) — the
 * wiring agent re-homes it into `@/lib/block-types` when registering.
 */
export interface KineticTypeHeroBlockProps
  extends CtaModalConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  /** Surface theme. `bgColor` (HeroBrandStyleConfig) overrides the preset hex. */
  theme?: "light" | "dark";
  /** Small overline kicker above the headline. Empty hides it. */
  kicker?: string;
  headline: string;
  /** Zero-based index of the accent-styled word in the headline. Out-of-range
   *  (or unset) accents the LAST word. Negative disables the accent. */
  accentWordIndex?: number;
  /** Treatment of the accent word. Default "italic". */
  accentStyle?: "italic" | "underline";
  subheadline?: string;
  /** Short phrases for the thin marquee strip along the bottom edge. */
  marqueePhrases?: string[];
  /** Show the bottom marquee strip. Default true. */
  showMarquee?: boolean;
}

interface Props {
  props: KineticTypeHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: KineticTypeHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

const LIGHT_SURFACE = "#FAFAF7";
const DARK_SURFACE = "#0B0B0E";
const DISPLAY_FALLBACK = "'Inter', ui-sans-serif, system-ui, sans-serif";

const DEFAULT_MARQUEE = [
  "Design-grade by default",
  "Ships in minutes",
  "Loved by 12,000+ teams",
  "Zero lock-in",
  "Built for momentum",
];

export function BlockKineticTypeHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const field = (key: keyof KineticTypeHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const isEditor = !!onFieldChange;
  const prefersReducedMotion = useReducedMotion();

  // ── Theme / surface resolution ────────────────────────────────
  const theme = props.theme ?? "light";
  const presetSurface = theme === "dark" ? DARK_SURFACE : LIGHT_SURFACE;
  const bg = props.bgColor || presetSurface;
  const surfaceHex = isValidHex(bg) ? bg : presetSurface;
  const isDark = relativeLuminance(surfaceHex) < 0.4;
  const defaultText = isDark ? "#F5F5F2" : "#111114";
  const text = props.textColor || defaultText;
  const mutedColor = isDark ? "rgba(245,245,242,0.6)" : "rgba(17,17,20,0.62)";

  // ── Fonts ─────────────────────────────────────────────────────
  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || DISPLAY_FALLBACK
    : `var(--brand-font-display, ${DISPLAY_FALLBACK})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // ── Runtime-resolved colors (contrast-guarded) ────────────────
  const picked = pickCtaButtonColors(brand, surfaceHex);
  const primaryBg = props.ctaButtonColor || picked.bg;
  const primaryText = props.ctaButtonTextColor || picked.text;
  const outline = pickOutlineButtonColors(brand, surfaceHex);
  // Accent word + kicker ink: the brand accent, stepped to a legible tint
  // when it collapses onto the surface. 3.0 = WCAG AA for large text.
  const explicitAccent =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : null;
  const accentInk = pickContrastingColor(
    explicitAccent ?? (isValidHex(brand.accentColor) ? brand.accentColor : null),
    surfaceHex,
    [brand.primaryColor],
    3.0,
  );

  // ── Resolved content (confident generic-SaaS defaults) ────────
  const kicker = props.kicker ?? "A new era of work";
  const headline = props.headline || "Make something people remember";
  const subheadline =
    props.subheadline ??
    "The design-grade platform for teams who care how it feels — not just that it works.";
  const ctaText = props.ctaText || "Start building";
  const accentStyle = props.accentStyle ?? "italic";
  const showMarquee = props.showMarquee !== false;
  const marqueePhrases =
    props.marqueePhrases && props.marqueePhrases.length > 0
      ? props.marqueePhrases
      : DEFAULT_MARQUEE;

  // ── Headline word split + accent resolution ───────────────────
  const words = headline.split(/\s+/).filter(Boolean);
  const rawIdx = props.accentWordIndex;
  const accentIdx =
    rawIdx === undefined
      ? words.length - 1
      : rawIdx < 0
        ? -1 // negative disables the accent treatment
        : Math.min(rawIdx, words.length - 1);

  const accentWordStyle: CSSProperties =
    accentStyle === "underline"
      ? {
          color: accentInk,
          textDecorationLine: "underline",
          textDecorationColor: accentInk,
          textDecorationThickness: "0.06em",
          textUnderlineOffset: "0.12em",
          textDecorationSkipInk: "auto",
        }
      : { color: accentInk, fontStyle: "italic" };

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

  const headlineStyle: CSSProperties = {
    fontFamily: headlineFamily,
    color: text,
    fontSize: "clamp(3rem, 10vw, 9.5rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.03em",
    fontWeight: "var(--brand-heading-weight, 700)" as never,
  };

  return (
    <section
      className="kth-hero relative flex min-h-[92vh] flex-col overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
    >
      <style>{`
        .kth-word-mask { display: inline-block; overflow: hidden; vertical-align: bottom; padding-bottom: 0.12em; margin-bottom: -0.12em; }
        @keyframes kth-marquee { to { transform: translateX(-50%); } }
        .kth-marquee-track {
          display: flex; width: max-content;
          animation: kth-marquee var(--kth-marquee-duration, 32s) linear infinite;
        }
        .kth-hero a:focus-visible, .kth-hero button:focus-visible {
          outline: 2px solid var(--kth-focus);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .kth-marquee-track { animation: none; }
        }
      `}</style>

      <div
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pt-20 sm:px-8 md:pt-28"
        style={{ "--kth-focus": accentInk } as CSSProperties}
      >
        {/* ── Kicker ── */}
        {(kicker || isEditor) && (
          <motion.div
            initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] md:mb-12"
            style={{ color: accentInk }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accentInk }}
              aria-hidden
            />
            <InlineText as="span" value={kicker} onUpdate={field("kicker")} />
          </motion.div>
        )}

        {/* ── Massive kinetic headline ── */}
        <h1 className="m-0 max-w-[14ch]" style={headlineStyle}>
          {isEditor ? (
            <InlineText as="span" value={headline} onUpdate={field("headline")} />
          ) : prefersReducedMotion ? (
            // Reduced motion: instant, fully-set type (no masks, no rise).
            words.map((word, i) => (
              <span key={i}>
                <span style={i === accentIdx ? accentWordStyle : undefined}>{word}</span>
                {i < words.length - 1 ? " " : null}
              </span>
            ))
          ) : (
            words.map((word, i) => (
              <span key={i} className="kth-word-mask" aria-hidden={false}>
                <motion.span
                  className="inline-block"
                  initial={{ y: "115%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.08 + i * 0.085,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={i === accentIdx ? accentWordStyle : undefined}
                >
                  {word}
                  {i < words.length - 1 ? " " : ""}
                </motion.span>
              </span>
            ))
          )}
        </h1>

        {/* ── Bottom edge: subhead row with inline CTAs ── */}
        <motion.div
          initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0.6, ease: "easeOut" }}
          className="mt-auto flex flex-col gap-8 border-t py-10 md:flex-row md:items-end md:justify-between md:py-12"
          style={{
            borderColor: isDark ? "rgba(245,245,242,0.14)" : "rgba(17,17,20,0.12)",
            marginTop: "clamp(3rem, 8vh, 6rem)",
          }}
        >
          {(subheadline || isEditor) && (
            <InlineText
              as="p"
              multiline
              value={subheadline}
              onUpdate={field("subheadline")}
              className="m-0 max-w-md text-lg leading-relaxed md:text-xl"
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
              source="kinetic-type-hero-primary"
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
                source="kinetic-type-hero-secondary"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border bg-transparent px-7 py-3.5 text-base font-semibold transition-colors"
                style={{ borderColor: outline.border, color: outline.text }}
              >
                <InlineText
                  as="span"
                  value={props.ctaSecondaryText || "Talk to us"}
                  onUpdate={field("ctaSecondaryText")}
                />
              </CtaButton>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Thin marquee strip along the very bottom (decorative) ── */}
      {showMarquee && marqueePhrases.length > 0 && (
        <div
          className="relative w-full overflow-hidden border-t py-3"
          aria-hidden
          style={{ borderColor: isDark ? "rgba(245,245,242,0.14)" : "rgba(17,17,20,0.12)" }}
        >
          <div
            className="kth-marquee-track"
            style={
              {
                "--kth-marquee-duration": `${Math.max(18, marqueePhrases.length * 7)}s`,
              } as CSSProperties
            }
          >
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center">
                {marqueePhrases.map((phrase, i) => (
                  <span
                    key={`${copy}-${i}`}
                    className="flex items-center gap-6 whitespace-nowrap pr-6 text-sm font-medium uppercase tracking-[0.14em]"
                    style={{ color: mutedColor }}
                  >
                    {phrase}
                    <span
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ backgroundColor: accentInk }}
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
