import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
  relativeLuminance,
} from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Glass Pricing Tiers — modern 2–4 tier pricing with glass / soft-shadow
 * cards, a featured tier with an accent border-glow, and an accessible
 * monthly/annual toggle with an animated price swap.
 *
 * Props are defined here (exported) so the block is fully self-contained;
 * the matching panel imports them from this file.
 * -------------------------------------------------------------------------- */

export interface GlassPricingTier {
  /** Plan name, e.g. "Growth". */
  name: string;
  /** Price shown when the monthly period is selected, e.g. "$49". */
  monthlyPrice: string;
  /** Price shown when the annual period is selected (usually the discounted
   *  per-month rate, e.g. "$39"). Falls back to `monthlyPrice` when unset. */
  annualPrice?: string;
  /** Suffix rendered after the price, e.g. "/mo". Empty hides it. */
  period?: string;
  /** One-line plan description under the price. */
  description?: string;
  /** Optional "Everything in Starter, plus" divider above the feature list. */
  inheritsLabel?: string;
  features: string[];
  ctaText?: string;
  ctaUrl?: string;
  /** "solid" paints the runtime-contrast-resolved CTA fill; "ghost" renders
   *  a quiet outline button. Defaults: solid for the featured tier, ghost
   *  otherwise. */
  ctaVariant?: "solid" | "ghost";
  /** Exactly one tier should be featured — elevated, accent glow, badge. */
  featured?: boolean;
  /** Badge text shown on the featured card, e.g. "Most popular". */
  badge?: string;
}

export interface GlassPricingTiersBlockProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  /** Show the monthly/annual billing toggle. Default true. */
  showToggle?: boolean;
  monthlyLabel?: string;
  annualLabel?: string;
  /** Savings chip shown beside the annual option, e.g. "Save 20%". */
  annualSavingsLabel?: string;
  /** Small caption under annual prices, e.g. "billed annually". */
  annualNote?: string;
  /** Initially selected period. Default "monthly". */
  defaultPeriod?: "monthly" | "annual";
  tiers: GlassPricingTier[];
  /** Optional reassurance footnote row, e.g. "No CAPEX. Cancel anytime." */
  footnote?: string;
  /** "dark" = glass cards on a deep surface; "light" = soft-shadow cards on
   *  a light surface. A custom `bgColor` overrides and the variant is then
   *  derived from its luminance. Default "dark". */
  variant?: "light" | "dark";
  bgColor?: string;
  accentColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

interface Props {
  props: GlassPricingTiersBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GlassPricingTiersBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

const DARK_SURFACE = "#080B12";
const LIGHT_SURFACE = "#F8FAFC";

export const GLASS_PRICING_DEFAULT_TIERS: GlassPricingTier[] = [
  {
    name: "Starter",
    monthlyPrice: "$0",
    annualPrice: "$0",
    period: "/mo",
    description: "Everything you need to launch your first project.",
    features: ["Up to 3 projects", "Core analytics dashboard", "Community support", "1 team seat"],
    ctaText: "Start for free",
    ctaUrl: "#",
    ctaVariant: "ghost",
  },
  {
    name: "Growth",
    monthlyPrice: "$49",
    annualPrice: "$39",
    period: "/mo",
    description: "For teams shipping fast and scaling what works.",
    inheritsLabel: "Everything in Starter, plus",
    features: [
      "Unlimited projects",
      "Advanced analytics & reports",
      "Priority support",
      "Up to 10 team seats",
      "Custom domains",
    ],
    ctaText: "Start 14-day trial",
    ctaUrl: "#",
    ctaVariant: "solid",
    featured: true,
    badge: "Most popular",
  },
  {
    name: "Scale",
    monthlyPrice: "$149",
    annualPrice: "$119",
    period: "/mo",
    description: "Security, control, and support for serious scale.",
    inheritsLabel: "Everything in Growth, plus",
    features: [
      "SSO & SCIM provisioning",
      "Dedicated success manager",
      "99.99% uptime SLA",
      "Unlimited team seats",
    ],
    ctaText: "Talk to sales",
    ctaUrl: "#",
    ctaVariant: "ghost",
  },
];

const GRID_COLS: Record<number, string> = {
  1: "lg:grid-cols-1 lg:max-w-md",
  2: "lg:grid-cols-2 lg:max-w-4xl",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function BlockGlassPricingTiers({ props, brand, onFieldChange, pageId, variantId }: Props) {
  const prefersReducedMotion = useReducedMotion();

  // ── Surface + dark/light resolution. A custom bgColor wins; otherwise the
  // variant picks a curated deep-dark or near-white surface. ──
  const customBg = props.bgColor && isValidHex(props.bgColor) ? props.bgColor : undefined;
  const variant = props.variant ?? "dark";
  const surfaceHex = customBg ?? (variant === "light" ? LIGHT_SURFACE : DARK_SURFACE);
  const isDark = relativeLuminance(surfaceHex) < 0.4;
  const text = isDark ? "#FFFFFF" : "#0F172A";
  const mutedText = isDark ? "rgba(255,255,255,0.62)" : "rgba(15,23,42,0.62)";
  const faintText = isDark ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.5)";
  const hairline = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)";

  // ── Runtime-contrast-resolved colors (never hardcode brand vars on fills).
  // Accent for borders/icons/eyebrow must read against the section surface;
  // CTA fills go through pickCtaButtonColors like every compliant block. ──
  const accentPref = props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  const accent = pickContrastingColor(accentPref ?? brand.accentColor, surfaceHex, [brand.primaryColor, isDark ? "#A5B4FC" : "#4F46E5"], 3.0);
  const ctaPick = pickCtaButtonColors(brand, surfaceHex);
  const badgeBg = accent;
  const badgeText = contrastTextColor(badgeBg);

  // ── Fonts (panel override → brand tokens). ──
  useBlockFonts(props.headlineFont, props.bodyFont);
  const DISPLAY = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_FONT
    : BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_FONT
    : BRAND_BODY_FONT;

  // ── Billing period toggle. ──
  const [period, setPeriod] = useState<"monthly" | "annual">(props.defaultPeriod ?? "monthly");
  const showToggle = props.showToggle !== false;
  const monthlyLabel = props.monthlyLabel ?? "Monthly";
  const annualLabel = props.annualLabel ?? "Annual";

  const tiers = props.tiers && props.tiers.length > 0 ? props.tiers : GLASS_PRICING_DEFAULT_TIERS;
  const cols = GRID_COLS[Math.min(Math.max(tiers.length, 1), 4)];

  // ── Field helpers (inline editing in the builder). ──
  const field = (key: keyof GlassPricingTiersBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateTier = onFieldChange
    ? (i: number, patch: Partial<GlassPricingTier>) =>
        onFieldChange({ ...props, tiers: tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) })
    : undefined;
  const updateFeature = onFieldChange
    ? (i: number, fi: number, v: string) =>
        onFieldChange({
          ...props,
          tiers: tiers.map((t, idx) =>
            idx === i ? { ...t, features: t.features.map((f, j) => (j === fi ? v : f)) } : t,
          ),
        })
    : undefined;

  const priceFor = (tier: GlassPricingTier) =>
    period === "annual" ? (tier.annualPrice ?? tier.monthlyPrice) : tier.monthlyPrice;

  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <section
      className="glass-pricing relative w-full overflow-hidden px-6 py-20 sm:py-28"
      style={{ background: surfaceHex, color: text, fontFamily: BODY }}
    >
      <style>{`
        .glass-pricing .gp-glow { transition: opacity 0.6s ease; }
        @media (prefers-reduced-motion: reduce) {
          .glass-pricing * { transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* Soft accent wash behind the featured card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[820px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${accent}, transparent 72%)`, opacity: isDark ? 0.14 : 0.1 }}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={field("eyebrow")}
              className="mb-4 text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: accent }}
            />
          )}
          <h2
            className="text-balance font-bold leading-[1.06] tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(2.25rem, 5vw, 3.5rem)" }}
          >
            <InlineText as="span" value={props.headline} onUpdate={field("headline")} multiline />
          </h2>
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={field("subheadline")}
              className="mt-4 text-base leading-relaxed sm:text-lg"
              style={{ color: mutedText }}
              multiline
            />
          )}
        </div>

        {/* Monthly / annual toggle */}
        {showToggle && (
          <div className="mb-12 flex justify-center sm:mb-16">
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex items-center gap-1 rounded-full p-1.5"
              style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
                border: `1px solid ${hairline}`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              {(["monthly", "annual"] as const).map((p) => {
                const active = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                      focusRing,
                    )}
                    style={{
                      background: active ? ctaPick.bg : "transparent",
                      color: active ? ctaPick.text : mutedText,
                      outlineColor: accent,
                    }}
                  >
                    {p === "monthly" ? monthlyLabel : annualLabel}
                    {p === "annual" && (props.annualSavingsLabel ?? "Save 20%") && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={
                          active
                            ? { background: `${ctaPick.text}22`, color: ctaPick.text }
                            : { background: `${accent}26`, color: accent }
                        }
                      >
                        {props.annualSavingsLabel ?? "Save 20%"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tier cards — stack on mobile (featured first), grid on desktop */}
        <div className={cn("mx-auto grid grid-cols-1 items-stretch gap-6 lg:gap-7", cols)}>
          {tiers.map((tier, i) => {
            const featured = !!tier.featured;
            const solidCta = (tier.ctaVariant ?? (featured ? "solid" : "ghost")) === "solid";
            const cardBg = isDark
              ? featured
                ? "linear-gradient(165deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))"
                : "rgba(255,255,255,0.04)"
              : "#FFFFFF";
            const cardBorder = featured ? accent : hairline;
            const cardShadow = isDark
              ? featured
                ? `0 0 0 1px ${accent}55, 0 24px 80px -24px ${accent}88, inset 0 1px 0 rgba(255,255,255,0.12)`
                : "inset 0 1px 0 rgba(255,255,255,0.07)"
              : featured
                ? `0 0 0 1px ${accent}40, 0 28px 70px -28px ${accent}66, 0 12px 36px -16px rgba(15,23,42,0.18)`
                : "0 16px 44px -24px rgba(15,23,42,0.16)";

            return (
              <article
                key={i}
                className={cn(
                  "relative flex flex-col rounded-3xl p-8 lg:p-9",
                  featured && "z-10 order-first lg:order-none lg:scale-[1.03]",
                )}
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: cardShadow,
                  ...(isDark
                    ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }
                    : undefined),
                }}
              >
                {/* Featured badge */}
                {featured && (tier.badge || onFieldChange) && (
                  <div
                    className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: badgeBg, color: badgeText, boxShadow: `0 8px 24px -8px ${accent}AA` }}
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    <InlineText
                      as="span"
                      value={tier.badge ?? "Most popular"}
                      onUpdate={updateTier ? (v) => updateTier(i, { badge: v }) : undefined}
                    />
                  </div>
                )}

                {/* Name */}
                <h3
                  className="text-sm font-semibold uppercase tracking-[0.18em]"
                  style={{ color: featured ? accent : mutedText }}
                >
                  <InlineText
                    as="span"
                    value={tier.name}
                    onUpdate={updateTier ? (v) => updateTier(i, { name: v }) : undefined}
                  />
                </h3>

                {/* Price (animated swap on toggle; instant under reduced motion) */}
                <div className="mt-5 flex min-h-[4.5rem] items-baseline gap-1.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`${i}-${period}`}
                      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="font-bold leading-none tracking-tight tabular-nums"
                      style={{ fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 4.5vw, 4rem)" }}
                    >
                      <InlineText
                        as="span"
                        value={priceFor(tier)}
                        onUpdate={
                          updateTier
                            ? (v) =>
                                updateTier(
                                  i,
                                  period === "annual" ? { annualPrice: v } : { monthlyPrice: v },
                                )
                            : undefined
                        }
                      />
                    </motion.span>
                  </AnimatePresence>
                  {(tier.period ?? "/mo") && (
                    <span className="text-base font-medium" style={{ color: faintText }}>
                      <InlineText
                        as="span"
                        value={tier.period ?? "/mo"}
                        onUpdate={updateTier ? (v) => updateTier(i, { period: v }) : undefined}
                      />
                    </span>
                  )}
                </div>
                {period === "annual" && tier.annualPrice && tier.annualPrice !== tier.monthlyPrice && (
                  <p className="mt-1 text-xs font-medium" style={{ color: faintText }}>
                    {props.annualNote ?? "billed annually"}
                  </p>
                )}

                {/* Description */}
                {(tier.description || onFieldChange) && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: mutedText }}>
                    <InlineText
                      as="span"
                      value={tier.description ?? ""}
                      onUpdate={updateTier ? (v) => updateTier(i, { description: v }) : undefined}
                      multiline
                    />
                  </p>
                )}

                {/* "Everything in X, plus" divider */}
                {(tier.inheritsLabel || onFieldChange) && (
                  <div className="mt-6 flex items-center gap-3">
                    <span
                      className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: faintText }}
                    >
                      <InlineText
                        as="span"
                        value={tier.inheritsLabel ?? ""}
                        onUpdate={updateTier ? (v) => updateTier(i, { inheritsLabel: v }) : undefined}
                      />
                    </span>
                    <span aria-hidden className="h-px flex-1" style={{ background: hairline }} />
                  </div>
                )}

                {/* Features */}
                <ul className={cn("flex-1 space-y-3", tier.inheritsLabel || onFieldChange ? "mt-4" : "mt-7")}>
                  {tier.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-3 text-sm leading-relaxed">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${accent}22` }}
                      >
                        <Check className="h-3 w-3" style={{ color: accent }} strokeWidth={3} />
                      </span>
                      <span style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.85)" }}>
                        <InlineText
                          as="span"
                          value={f}
                          onUpdate={updateFeature ? (v) => updateFeature(i, fi, v) : undefined}
                        />
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Per-tier CTA */}
                <CtaButton
                  ctaAction="url"
                  ctaUrl={tier.ctaUrl}
                  brand={brand}
                  pageId={pageId}
                  variantId={variantId}
                  source={`glass-pricing-tiers-${i}`}
                  className={cn(
                    "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5",
                    focusRing,
                  )}
                  style={
                    solidCta
                      ? { background: ctaPick.bg, color: ctaPick.text, outlineColor: accent }
                      : {
                          background: "transparent",
                          color: text,
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.18)"}`,
                          outlineColor: accent,
                        }
                  }
                >
                  <InlineText
                    as="span"
                    value={tier.ctaText ?? "Get started"}
                    onUpdate={updateTier ? (v) => updateTier(i, { ctaText: v }) : undefined}
                  />
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </CtaButton>
              </article>
            );
          })}
        </div>

        {/* Footnote */}
        {(props.footnote || onFieldChange) && (
          <p className="mt-10 text-center text-sm" style={{ color: faintText }}>
            <InlineText as="span" value={props.footnote ?? ""} onUpdate={field("footnote")} multiline />
          </p>
        )}
      </div>
    </section>
  );
}
