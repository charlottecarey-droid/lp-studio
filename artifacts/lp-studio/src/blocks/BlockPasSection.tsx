import { cn } from "@/lib/utils";
import type { PasSectionBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import {
  SECTION_PY,
  getHeadingWeightClass,
  getHeadingLetterSpacingClass,
  getBodySizeClass,
  contrastTextColor,
  pickContrastingColor,
  isValidHex,
  DEFAULT_BRAND,
} from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { AlertTriangle } from "lucide-react";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/* ----------------------------------------------------------------------------
 * PAS — Section: Problem-Agitate-Solve on a brand-primary surface.
 * Split layout: headline + subheadline on one side, the pain points on the
 * other as an icon list (alert-triangle markers by default). Colors are derived
 * from the brand primary fill and the type uses the brand display/body fonts, so
 * the block stays fully brand-aware. An optional accent-tinted solution panel
 * closes the beat full-width below.
 * -------------------------------------------------------------------------- */

interface Props {
  props: PasSectionBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSectionBlockProps) => void;
}

export function BlockPasSection({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  // This section is painted with the brand primary. Derive text + accent
  // colors from that actual fill so copy stays legible for light-primary
  // brands and tints never render accent-on-primary (blue on blue).
  const primaryHex = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const onPrimary = contrastTextColor(primaryHex);
  const accentOnPrimary = pickContrastingColor(brand.accentColor, primaryHex, [onPrimary], 3.0);

  const update = <K extends keyof PasSectionBlockProps>(key: K, value: PasSectionBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    const newBullets = props.bullets.map((b, i) => (i === index ? value : b));
    onFieldChange({ ...props, bullets: newBullets });
  };

  const bullets = props.bullets ?? [];
  const showBullets = bullets.length > 0 || !!onFieldChange;

  return (
    <section className={cn("w-full bg-[var(--brand-primary)] px-6", sectionPy)} style={{ color: onPrimary }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-2 lg:items-start">
          {/* Left — headline + subheadline. */}
          <div>
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="p"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                className="mb-5 text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: accentOnPrimary, fontFamily: BODY }}
              />
            )}
            <InlineText
              as="h2"
              value={props.headline}
              onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
              className={cn(
                getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"),
                "text-balance font-display leading-[1.06]",
                getHeadingWeightClass(brand),
                getHeadingLetterSpacingClass(brand),
              )}
              style={{ fontFamily: DISPLAY }}
            />
            <InlineText
              as="p"
              value={props.body}
              onUpdate={onFieldChange ? (v) => update("body", v) : undefined}
              className={cn(getBodySizeClass(brand), "mt-6 max-w-[55ch] leading-relaxed lg:text-lg")}
              multiline
              style={{ fontFamily: BODY, color: `color-mix(in srgb, ${onPrimary} 80%, transparent)` }}
            />
          </div>

          {/* Right — pain points as an icon list (alert-triangle markers). */}
          {showBullets && (
            <ul className="flex flex-col gap-6 lg:pt-1.5">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accentOnPrimary} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${accentOnPrimary} 30%, transparent)`,
                    }}
                  >
                    <AlertTriangle className="h-[18px] w-[18px]" style={{ color: accentOnPrimary }} strokeWidth={2.25} />
                  </span>
                  <InlineText
                    as="span"
                    value={bullet}
                    onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined}
                    className="block flex-1 text-base font-medium leading-relaxed"
                    multiline
                    style={{ fontFamily: BODY, color: `color-mix(in srgb, ${onPrimary} 92%, transparent)` }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Solve — optional closing line in a visually distinct tinted panel. */}
        {(props.solutionText || onFieldChange) && (
          <div
            className="mt-14 rounded-2xl border p-6 sm:p-8"
            style={{
              background: `color-mix(in srgb, ${onPrimary} 7%, transparent)`,
              borderColor: `color-mix(in srgb, ${accentOnPrimary} 35%, transparent)`,
            }}
          >
            <InlineText
              as="p"
              value={props.solutionText ?? ""}
              onUpdate={onFieldChange ? (v) => update("solutionText", v) : undefined}
              className="text-lg font-semibold leading-snug sm:text-xl"
              multiline
              style={{ fontFamily: DISPLAY, color: onPrimary }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
