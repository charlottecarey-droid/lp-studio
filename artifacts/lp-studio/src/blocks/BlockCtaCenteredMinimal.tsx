import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { CtaCenteredMinimalBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * CTA — Centered Minimal: a tight statement CTA. Oversized display headline
 * on a subtly brand-tinted panel wrapped in a thin gradient ring (replacing
 * the old floating white card + oversized padding), a strong runtime-contrast
 * pill button with an arrow micro-interaction, and an optional reassurance
 * microcopy row.
 * -------------------------------------------------------------------------- */

interface Props {
  props: CtaCenteredMinimalBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaCenteredMinimalBlockProps) => void;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockCtaCenteredMinimal({ props, brand, onFieldChange }: Props) {
  const sectionBg = resolveSectionSurface(props, "#ffffff");
  // The legacy `surfaceColor` prop still paints the panel; otherwise the panel
  // is a barely-there brand tint of the section surface itself.
  const surfaceHex =
    props.surfaceColor && isValidHex(props.surfaceColor) ? props.surfaceColor : undefined;
  /** Representative solid the copy actually sits on (feeds contrast helpers). */
  const base = surfaceHex ?? sectionBg.base;

  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  // Raw accent for decorative tints (ring, glow) — legibility not required.
  const accentRaw =
    accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : brand.primaryColor);
  // Eyebrow / outline tint must actually contrast with the panel.
  const accent = pickContrastingColor(accentRaw, base, [brand.primaryColor, brand.accentColor], 3.0);
  const ink = props.textColor ?? pickContrastingColor(undefined, base, ["#0f172a", "#ffffff"]);
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  // Primary CTA fill + label are runtime-contrast-resolved against the panel.
  const cta = accentPref
    ? (() => {
        const bg = pickContrastingColor(accentPref, base, [brand.accentColor, brand.primaryColor], 3.0);
        return { bg, text: pickContrastingColor(brand.ctaText, bg, [contrastTextColor(bg)], 4.5) };
      })()
    : pickCtaButtonColors(brand, base);

  const panelBg = surfaceHex ?? `color-mix(in srgb, ${accentRaw} 5%, ${sectionBg.base})`;
  const ringGradient = `linear-gradient(135deg, color-mix(in srgb, ${accentRaw} 45%, transparent), color-mix(in srgb, ${accentRaw} 10%, transparent) 45%, color-mix(in srgb, ${ink} 12%, transparent))`;

  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;

  const update = <K extends keyof CtaCenteredMinimalBlockProps>(key: K, value: CtaCenteredMinimalBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full px-4 py-16 sm:px-6 sm:py-24" style={{ background: sectionBg.background }}>
      <style>{`
        .ccm-cta .ccm-arrow { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .ccm-cta:hover .ccm-arrow { transform: translateX(4px); }
        @media (prefers-reduced-motion: reduce) {
          .ccm-cta .ccm-arrow, .ccm-cta:hover .ccm-arrow { transition: none; transform: none; }
        }
      `}</style>
      <div className="mx-auto max-w-5xl rounded-[2rem] p-px" style={{ background: ringGradient }}>
        <div
          className="relative overflow-hidden rounded-[calc(2rem-1px)] px-6 py-14 text-center sm:px-14 sm:py-16 lg:px-20 lg:py-20"
          style={{ backgroundColor: panelBg, color: ink, fontFamily: BODY }}
        >
          {/* Quiet brand glow pinned to the top edge — decorative only. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${accentRaw} 16%, transparent), transparent)` }}
          />
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="span"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                className="mb-5 block text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: accent, fontFamily: BODY }}
              />
            )}
            <InlineText
              as="h2"
              value={props.heading}
              onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
              className="text-balance font-bold leading-[1.04] tracking-tight"
              style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2.5rem, 6vw, 4.25rem)" }}
            />
            {(props.subheading || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheading ?? ""}
                onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined}
                className="mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl"
                style={{ color: muted, fontFamily: BODY }}
                multiline
              />
            )}
            <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              {(props.ctaPrimaryLabel || onFieldChange) && (
                <CtaButton
                  ctaAction="url"
                  ctaUrl={props.ctaPrimaryUrl}
                  brand={brand}
                  source="cta-centered-minimal-primary"
                  className={`ccm-cta inline-flex w-full items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 sm:w-auto ${FOCUS_RING}`}
                  style={{
                    backgroundColor: cta.bg,
                    color: cta.text,
                    fontFamily: BODY,
                    outlineColor: accent,
                    boxShadow: `0 16px 40px -16px color-mix(in srgb, ${cta.bg} 60%, transparent)`,
                  }}
                >
                  {props.ctaPrimaryLabel || "Start building for free"}
                  <ArrowRight className="ccm-arrow h-4 w-4" aria-hidden />
                </CtaButton>
              )}
              {(props.ctaSecondaryLabel || onFieldChange) && (
                <CtaButton
                  ctaAction="url"
                  ctaUrl={props.ctaSecondaryUrl}
                  brand={brand}
                  source="cta-centered-minimal-secondary"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-colors sm:w-auto ${FOCUS_RING}`}
                  style={{
                    borderColor: `color-mix(in srgb, ${ink} 22%, transparent)`,
                    color: ink,
                    fontFamily: BODY,
                    outlineColor: accent,
                  }}
                >
                  {props.ctaSecondaryLabel || "Contact sales"}
                </CtaButton>
              )}
            </div>
            {(props.reassuranceText || onFieldChange) && (
              <InlineText
                as="p"
                value={props.reassuranceText ?? ""}
                onUpdate={onFieldChange ? (v) => update("reassuranceText", v) : undefined}
                className="mt-6 text-[13px] font-medium"
                style={{ color: muted, fontFamily: BODY }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
