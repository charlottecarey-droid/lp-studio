import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import type { CtaGradientBannerBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * CTA — Gradient Banner: a tight, asymmetric banner painted with a crafted
 * brand-derived duotone gradient (accent → primary-derived deep stop) with a
 * subtle radial mesh + film-grain texture (pure CSS). Display type on the
 * left, contrast-resolved pill buttons on the right.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CtaGradientBannerBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaGradientBannerBlockProps) => void;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** WCAG contrast ratio from the exported relativeLuminance. */
function ratio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lo, hi] = la < lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix a hex toward black by `amt` (0..1) — derives the deep duotone stop. */
function deepen(hex: string, amt: number): string {
  const ch = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amt))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

/** Inline SVG film grain (feTurbulence) — static, CSS-only texture. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function BlockCtaGradientBanner({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");

  // ── Duotone gradient stops, all brand-derived. ──
  const gradFrom =
    props.accentColor && isValidHex(props.accentColor)
      ? props.accentColor
      : isValidHex(brand.accentColor)
        ? brand.accentColor
        : brand.primaryColor;
  const endPref =
    props.gradientEndColor && isValidHex(props.gradientEndColor)
      ? props.gradientEndColor
      : undefined;
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : deepen(gradFrom, 0.55);
  // Use the brand primary as the second hue when it's visually distinct from
  // the accent; otherwise deepen the accent so the duotone still reads.
  const gradTo = endPref ?? (ratio(primary, gradFrom) >= 1.25 ? primary : deepen(gradFrom, 0.55));

  // On-gradient ink: whichever of white/near-black stays legible on BOTH stops.
  const minContrast = (c: string) => Math.min(ratio(c, gradFrom), ratio(c, gradTo));
  const onBanner =
    props.textColor ?? (minContrast("#ffffff") >= minContrast("#0f172a") ? "#ffffff" : "#0f172a");
  // Primary button inverts the banner: ink-colored fill, gradient-hue label.
  const btnLabel = pickContrastingColor(gradFrom, onBanner, [gradTo, brand.primaryColor], 4.5);

  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof CtaGradientBannerBlockProps>(key: K, value: CtaGradientBannerBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full px-4 py-14 sm:px-6 sm:py-20" style={{ background: surface.background }}>
      <div className="mx-auto max-w-6xl">
        <div
          className="relative overflow-hidden rounded-[2rem] px-7 py-12 sm:px-12 sm:py-14 lg:px-16"
          style={{
            background: `linear-gradient(115deg, ${gradFrom}, ${gradTo})`,
            color: onBanner,
            fontFamily: BODY,
          }}
        >
          {/* Radial mesh accents in the two gradient hues. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(42% 60% at 12% 0%, color-mix(in srgb, ${onBanner} 14%, transparent) 0%, transparent 70%),
                radial-gradient(50% 70% at 95% 100%, color-mix(in srgb, ${gradTo} 55%, transparent) 0%, transparent 72%),
                radial-gradient(36% 55% at 70% -10%, color-mix(in srgb, ${gradFrom} 45%, transparent) 0%, transparent 70%)
              `,
            }}
          />
          {/* Film grain keeps the gradient from banding — static CSS texture. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
            style={{ backgroundImage: GRAIN }}
          />

          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-2xl">
              <InlineText
                as="h2"
                value={props.heading}
                onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
                className="text-balance font-bold leading-[1.06] tracking-tight"
                style={{ fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4.2vw, 3.25rem)" }}
              />
              {(props.subheading || onFieldChange) && (
                <InlineText
                  as="p"
                  value={props.subheading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined}
                  className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg"
                  style={{ color: `color-mix(in srgb, ${onBanner} 80%, transparent)`, fontFamily: BODY }}
                  multiline
                />
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              {(props.ctaPrimaryLabel || onFieldChange) && (
                <CtaButton
                  ctaAction="url"
                  ctaUrl={props.ctaPrimaryUrl}
                  brand={brand}
                  source="cta-gradient-banner-primary"
                  className={`group inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
                  style={{
                    backgroundColor: onBanner,
                    color: btnLabel,
                    fontFamily: BODY,
                    outlineColor: onBanner,
                    boxShadow: `0 18px 44px -18px color-mix(in srgb, ${gradTo} 80%, transparent)`,
                  }}
                >
                  {props.ctaPrimaryLabel || "Start for free"}
                  <ArrowRight
                    className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </CtaButton>
              )}
              {(props.ctaSecondaryLabel || onFieldChange) && (
                <CtaButton
                  ctaAction="url"
                  ctaUrl={props.ctaSecondaryUrl}
                  brand={brand}
                  source="cta-gradient-banner-secondary"
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-colors ${FOCUS_RING}`}
                  style={{
                    borderColor: `color-mix(in srgb, ${onBanner} 35%, transparent)`,
                    background: `color-mix(in srgb, ${onBanner} 8%, transparent)`,
                    color: onBanner,
                    fontFamily: BODY,
                    outlineColor: onBanner,
                  }}
                >
                  {props.ctaSecondaryLabel || "Talk to sales"}
                </CtaButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
