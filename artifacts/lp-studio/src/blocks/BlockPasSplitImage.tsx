import { ArrowRight, Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { PasSplitImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * PAS — Split Image: image column (rounded-2xl, subtle ring + soft layered
 * shadow) beside copy with clearly differentiated PAS beats — display
 * problem statement, accent-ruled agitate pull-quote, accent-tinted solution
 * panel, then a runtime-contrast pill CTA.
 * -------------------------------------------------------------------------- */

interface Props {
  props: PasSplitImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSplitImageBlockProps) => void;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockPasSplitImage({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const base = surface.base;
  const ink = props.textColor ?? surface.color ?? pickContrastingColor(undefined, base, ["#0f172a", "#ffffff"]);
  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  const accentRaw =
    accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : brand.primaryColor);
  const accent = pickContrastingColor(accentRaw, base, [brand.primaryColor, ink], 3.0);
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const cta = accentPref
    ? (() => {
        const bg = pickContrastingColor(accentPref, base, [brand.accentColor, brand.primaryColor], 3.0);
        return { bg, text: pickContrastingColor(brand.ctaText, bg, [contrastTextColor(bg)], 4.5) };
      })()
    : pickCtaButtonColors(brand, base);
  const onCta = cta.text;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const mediaRight = (props.mediaSide ?? "right") === "right";

  const update = <K extends keyof PasSplitImageBlockProps>(key: K, value: PasSplitImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const copy = (
    <div className="flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20" style={{ color: ink, fontFamily: BODY }}>
      <div className="mx-auto w-full max-w-xl lg:mx-0">
        {/* Problem — eyebrow + display statement. */}
        {(props.eyebrow || onFieldChange) && (
          <InlineText
            as="p"
            value={props.eyebrow ?? ""}
            onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
            className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.26em]"
            style={{ color: accent }}
          />
        )}
        <InlineText
          as="h2"
          value={props.problemHeading}
          onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined}
          className="text-balance font-bold leading-[1.06] tracking-tight"
          style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 3.8vw, 2.875rem)" }}
        />
        {(props.problemBody || onFieldChange) && (
          <InlineText
            as="p"
            value={props.problemBody ?? ""}
            onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined}
            className="mt-5 max-w-prose text-base leading-relaxed sm:text-lg"
            style={{ color: muted }}
            multiline
          />
        )}
        {/* Agitate — accent-ruled pull-quote beat. */}
        {(props.agitateBody || onFieldChange) && (
          <InlineText
            as="p"
            value={props.agitateBody ?? ""}
            onUpdate={onFieldChange ? (v) => update("agitateBody", v) : undefined}
            className="mt-6 max-w-prose border-l-2 pl-5 text-base font-medium leading-relaxed sm:text-lg"
            style={{ color: ink, borderColor: `color-mix(in srgb, ${accent} 55%, transparent)` }}
            multiline
          />
        )}
        {/* Solve — visually distinct accent-tinted panel. */}
        {(props.solutionHeading || props.solutionBody || onFieldChange) && (
          <div
            className="mt-9 rounded-2xl border p-6 sm:p-7"
            style={{
              background: `linear-gradient(160deg, color-mix(in srgb, ${accentRaw} 10%, transparent), color-mix(in srgb, ${accentRaw} 3%, transparent))`,
              borderColor: `color-mix(in srgb, ${accentRaw} 26%, transparent)`,
            }}
          >
            {(props.solutionHeading || onFieldChange) && (
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: cta.bg, color: onCta }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <InlineText
                  as="h3"
                  value={props.solutionHeading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined}
                  className="text-lg font-bold leading-snug sm:text-xl"
                  style={{ color: ink, fontFamily: DISPLAY }}
                />
              </div>
            )}
            {(props.solutionBody || onFieldChange) && (
              <InlineText
                as="p"
                value={props.solutionBody ?? ""}
                onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined}
                className="mt-2.5 text-base leading-relaxed"
                style={{ color: muted }}
                multiline
              />
            )}
          </div>
        )}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-9">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="pas-split-image-cta"
              className={`group inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
              style={{
                backgroundColor: cta.bg,
                color: cta.text,
                fontFamily: BODY,
                outlineColor: accent,
                boxShadow: `0 16px 40px -16px color-mix(in srgb, ${cta.bg} 55%, transparent)`,
              }}
            >
              {props.ctaLabel || "Get started"}
              <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
            </CtaButton>
          </div>
        )}
      </div>
    </div>
  );

  const media = (
    <div className="flex items-stretch p-6 sm:p-10 lg:p-10">
      <div className="relative w-full overflow-hidden rounded-2xl shadow-[0_2px_8px_-2px_rgba(15,15,20,0.08),0_32px_64px_-28px_rgba(15,15,20,0.35)]">
        <div className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[28rem]">
          <InlineImage
            src={props.imageUrl ?? ""}
            alt={props.imageAlt || props.problemHeading || "Section image"}
            onUpdate={onFieldChange ? (src) => update("imageUrl", src) : undefined}
            className="h-full w-full object-cover"
            wrapperClassName="block h-full w-full"
          />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" />
      </div>
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden" style={{ background: surface.background }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-8%] h-80 w-80 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accentRaw} 9%, transparent), transparent 70%)` }}
      />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-2 lg:grid-cols-2 lg:gap-8">
        {mediaRight ? (
          <>
            <div className="order-2 lg:order-1">{copy}</div>
            <div className="order-1 lg:order-2">{media}</div>
          </>
        ) : (
          <>
            <div className="order-1">{media}</div>
            <div className="order-2">{copy}</div>
          </>
        )}
      </div>
    </section>
  );
}
