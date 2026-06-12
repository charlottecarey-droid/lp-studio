import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { FullBleedFinalCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { Reveal } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * Final CTA — Full Bleed: the page's full-width closing argument. Defaults to
 * a deep near-black surface with one controlled brand-accent glow and a
 * vignette (or a tenant background image under a dark overlay), an oversized
 * display headline, and runtime-contrast pill buttons.
 * -------------------------------------------------------------------------- */

interface Props {
  props: FullBleedFinalCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FullBleedFinalCtaBlockProps) => void;
}

/** Deep default finale surface (used when no preset/bgColor/image is set). */
const SURFACE_HEX = "#060A13";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockFullBleedFinalCta({ props, brand, onFieldChange }: Props) {
  const hasImage = !!props.backgroundImageUrl;
  const surface = resolveSectionSurface(props, SURFACE_HEX);
  /** Solid the copy effectively sits on (image path = the dark overlay). */
  const base = hasImage ? "#0f172a" : surface.base;

  const ink =
    props.textColor ?? (hasImage ? "#ffffff" : surface.color ?? pickContrastingColor(undefined, base, ["#ffffff", "#0f172a"]));
  const muted = `color-mix(in srgb, ${ink} 70%, transparent)`;

  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  // Raw accent feeds the decorative glow; the eyebrow tint is contrast-checked.
  const accentRaw =
    accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : brand.primaryColor);
  const accent = pickContrastingColor(accentRaw, base, [brand.primaryColor, ink], 3.0);
  const cta = accentPref
    ? (() => {
        const bg = pickContrastingColor(accentPref, base, [brand.accentColor, brand.primaryColor], 3.0);
        return { bg, text: pickContrastingColor(brand.ctaText, bg, [contrastTextColor(bg)], 4.5) };
      })()
    : pickCtaButtonColors(brand, base);

  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const overlay = (props.overlayOpacity ?? 55) / 100;

  const update = <K extends keyof FullBleedFinalCtaBlockProps>(key: K, value: FullBleedFinalCtaBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const ctaContent = (
    <>
      {(props.eyebrow || onFieldChange) && (
        <InlineText
          as="p"
          value={props.eyebrow ?? ""}
          onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
          className="mb-6 text-[11px] font-bold uppercase tracking-[0.3em]"
          style={{ color: hasImage ? ink : accent, opacity: hasImage ? 0.9 : 1 }}
        />
      )}
      <InlineText
        as="h2"
        value={props.heading}
        onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
        className="text-balance font-bold leading-[1.03] tracking-tight"
        style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 7vw, 4.5rem)" }}
      />
      {(props.subheading || onFieldChange) && (
        <InlineText
          as="p"
          value={props.subheading ?? ""}
          onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
          style={{ color: muted }}
          multiline
        />
      )}
      <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {(props.ctaLabel || onFieldChange) && (
          <CtaButton
            {...pickCtaModalConfig(props)}
            ctaAction={props.ctaAction ?? "url"}
            ctaUrl={props.ctaUrl}
            chilipiperUrl={props.chilipiperUrl}
            videoUrl={props.videoUrl}
            videoPosterUrl={props.videoPosterUrl}
            brand={brand}
            source="full-bleed-final-cta-primary"
            className={`inline-flex w-full items-center justify-center rounded-full text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 sm:w-auto sm:text-lg ${FOCUS_RING}`}
            style={{
              backgroundColor: cta.bg,
              color: cta.text,
              fontFamily: BODY,
              outlineColor: accent,
              padding: "1.125rem 2.25rem",
              boxShadow: `0 20px 56px -18px color-mix(in srgb, ${hasImage ? cta.bg : accentRaw} 65%, transparent)`,
            }}
          >
            {props.ctaLabel || "Get started"}
          </CtaButton>
        )}
        {(props.ctaSecondaryLabel || onFieldChange) && (
          <CtaButton
            ctaAction="url"
            ctaUrl={props.ctaSecondaryUrl}
            brand={brand}
            source="full-bleed-final-cta-secondary"
            className={`inline-flex w-full items-center justify-center rounded-full border text-base font-semibold transition-colors sm:w-auto sm:text-lg ${FOCUS_RING}`}
            style={{
              borderColor: `color-mix(in srgb, ${ink} 26%, transparent)`,
              background: `color-mix(in srgb, ${ink} 6%, transparent)`,
              color: ink,
              fontFamily: BODY,
              outlineColor: accent,
              padding: "1.125rem 2.25rem",
            }}
          >
            {props.ctaSecondaryLabel || "Talk to sales"}
          </CtaButton>
        )}
      </div>
    </>
  );

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-28 sm:py-36"
      style={{ background: surface.background, fontFamily: BODY }}
    >
      {hasImage && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${props.backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      {hasImage && <div className="absolute inset-0" style={{ backgroundColor: `rgba(15,23,42,${overlay})` }} />}
      {!hasImage && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* One controlled brand glow above the headline… */}
          <div
            className="absolute left-1/2 top-[-30%] h-[80%] w-[70%] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${accentRaw} 26%, transparent), transparent 70%)` }}
          />
          {/* …a faint primary counter-glow below… */}
          <div
            className="absolute bottom-[-35%] right-[10%] h-[70%] w-[55%] rounded-full blur-3xl"
            style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${brand.primaryColor} 18%, transparent), transparent 70%)` }}
          />
          {/* …and a vignette to keep copy contrast steady. */}
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(85% 65% at 50% 45%, transparent 0%, color-mix(in srgb, ${base} 70%, transparent) 100%)` }}
          />
        </div>
      )}
      {onFieldChange ? (
        <div className="container relative z-10 mx-auto max-w-4xl text-center" style={{ color: ink }}>
          {ctaContent}
        </div>
      ) : (
        <Reveal className="container relative z-10 mx-auto max-w-4xl text-center" style={{ color: ink }}>
          {ctaContent}
        </Reveal>
      )}
    </section>
  );
}
