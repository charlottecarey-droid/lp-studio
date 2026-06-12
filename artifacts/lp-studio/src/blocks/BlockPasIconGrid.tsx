import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { PasIconGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { IconOrImage } from "@/lib/icon-value";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

/* ----------------------------------------------------------------------------
 * PAS — Icon Grid: problem statement, a tight grid of deliberately muted
 * pain-point cards (refined accent-tinted icon chips), then a highlighted
 * accent-tinted solution panel that closes with the CTA — varied card
 * emphasis instead of one flat repeated card.
 * -------------------------------------------------------------------------- */

interface Props {
  props: PasIconGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasIconGridBlockProps) => void;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockPasIconGrid({ props, brand, onFieldChange }: Props) {
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
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const items = props.items ?? [];
  const cols = props.columns ?? (items.length >= 4 ? 4 : 3);

  const update = <K extends keyof PasIconGridBlockProps>(key: K, value: PasIconGridBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateItem = (i: number, patch: Partial<PasIconGridBlockProps["items"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  };

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-24" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-8%] h-80 w-80 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accentRaw} 9%, transparent), transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: accent }}
            />
          )}
          <InlineText
            as="h2"
            value={props.problemHeading}
            onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined}
            className="text-balance font-bold leading-[1.06] tracking-tight"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}
          />
          {(props.problemBody || onFieldChange) && (
            <InlineText as="p" value={props.problemBody ?? ""} onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined} className="mx-auto mt-4 max-w-[60ch] text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </div>

        {(() => {
          const gridClass = `mx-auto grid max-w-6xl grid-cols-1 gap-4 ${COL_CLASS[cols] ?? COL_CLASS[3]}`;
          // Pain-point cards are deliberately muted — the solution panel below
          // carries the accent so the grid has a clear visual hierarchy.
          const itemCard = (it: PasIconGridBlockProps["items"][number], i: number) => (
            <div
              className="h-full rounded-2xl border p-6 transition-shadow duration-300 motion-safe:transition-all motion-safe:hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                borderColor: `color-mix(in srgb, ${ink} 10%, transparent)`,
                background: `color-mix(in srgb, ${ink} 3%, transparent)`,
              }}
            >
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
                }}
                aria-hidden="true"
              >
                <IconOrImage value={it.icon} className="h-5 w-5" style={{ color: accent }} alt={it.title} />
              </div>
              <InlineText as="h3" value={it.title} onUpdate={onFieldChange ? (v) => updateItem(i, { title: v }) : undefined} className="text-base font-semibold leading-snug sm:text-lg" style={{ color: ink, fontFamily: DISPLAY }} />
              {(it.text || onFieldChange) && (
                <InlineText as="p" value={it.text ?? ""} onUpdate={onFieldChange ? (v) => updateItem(i, { text: v }) : undefined} className="mt-2 text-sm leading-relaxed" style={{ color: muted }} multiline />
              )}
            </div>
          );
          return onFieldChange ? (
            <div className={gridClass}>
              {items.map((it, i) => (
                <div key={i}>{itemCard(it, i)}</div>
              ))}
            </div>
          ) : (
            <RevealStagger className={gridClass}>
              {items.map((it, i) => (
                <RevealItem key={i}>{itemCard(it, i)}</RevealItem>
              ))}
            </RevealStagger>
          );
        })()}

        {/* Solution — the one highlighted, accent-tinted panel. */}
        {(props.solutionHeading || props.solutionBody || props.ctaLabel || onFieldChange) && (
          <div
            className="mx-auto mt-12 max-w-3xl rounded-2xl border p-8 text-center sm:p-10"
            style={{
              background: `linear-gradient(160deg, color-mix(in srgb, ${accentRaw} 10%, transparent), color-mix(in srgb, ${accentRaw} 3%, transparent))`,
              borderColor: `color-mix(in srgb, ${accentRaw} 30%, transparent)`,
              boxShadow: `0 24px 56px -32px color-mix(in srgb, ${accentRaw} 50%, transparent)`,
            }}
          >
            {(props.solutionHeading || onFieldChange) && (
              <InlineText as="h3" value={props.solutionHeading ?? ""} onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined} className="text-balance text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: ink, fontFamily: DISPLAY }} />
            )}
            {(props.solutionBody || onFieldChange) && (
              <InlineText as="p" value={props.solutionBody ?? ""} onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined} className="mx-auto mt-3 max-w-[55ch] text-base leading-relaxed sm:text-lg" style={{ color: muted }} multiline />
            )}
            {(props.ctaLabel || onFieldChange) && (
              <div className="mt-7">
                <CtaButton
                  {...pickCtaModalConfig(props)}
                  ctaAction={props.ctaAction ?? "url"}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  videoUrl={props.videoUrl}
                  videoPosterUrl={props.videoPosterUrl}
                  brand={brand}
                  source="pas-icon-grid-cta"
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
        )}
      </div>
    </section>
  );
}
