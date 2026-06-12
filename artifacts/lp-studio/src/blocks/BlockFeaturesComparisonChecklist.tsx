import { Check, X, Layers, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import { Fragment } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesComparisonChecklistBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Features — Comparison Checklist: a premium feature table in a rounded-2xl
 * ring container with low-alpha zebra rows, brand-accent check chips and an
 * optional sticky column-header row. `showCompetitorColumn` upgrades it to a
 * two-column "us vs them" comparison (accent check chips vs muted cross
 * chips, per-row `themIncluded`). Surface-aware; reveals disabled in the
 * builder and under reduced motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: FeaturesComparisonChecklistBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesComparisonChecklistBlockProps) => void;
}

export function BlockFeaturesComparisonChecklist({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;

  const surface = resolveSectionSurface(props, "#FFFFFF", brand);
  const dark = surface.isDark;
  const ink = resolveSectionInk(props, surface);
  const text = ink.text;
  const accentRaw = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accent = pickContrastingColor(accentRaw, surface.base, [primary], 3.0);
  const eyebrowColor = pickContrastingColor(accentRaw, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const muted = ink.muted;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const hairline = ink.hairline;
  const showCta = props.showCta ?? true;
  const showBespokeCard = props.showBespokeCard ?? true;
  const categories = props.categories ?? [];

  const vsMode = props.showCompetitorColumn === true;
  const sticky = props.stickyHeader === true;
  const usLabel = props.usColumnLabel || brand.brandName || "Us";
  const themLabel = props.themColumnLabel || "Others";

  // ── Table surfaces. ──
  const tableBg = dark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const tableRing = dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.08)";
  const headerBg = dark ? "#16161D" : "#FAFAF8";
  const rowDivider = dark ? "rgba(255,255,255,0.07)" : "rgba(11,11,15,0.06)";
  const zebra = dark ? "rgba(255,255,255,0.025)" : "rgba(11,11,15,0.022)";
  const tableInk = dark ? "#F6F7F9" : "#0B0B0F";
  const tableMuted = dark ? "rgba(246,247,249,0.6)" : "rgba(11,11,15,0.58)";

  const update = <K extends keyof FeaturesComparisonChecklistBlockProps>(key: K, value: FeaturesComparisonChecklistBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateFeature = (
    catIndex: number,
    featIndex: number,
    patch: Partial<FeaturesComparisonChecklistBlockProps["categories"][number]["features"][number]>,
  ) => {
    if (!onFieldChange) return;
    onFieldChange({
      ...props,
      categories: categories.map((cat, ci) =>
        ci === catIndex
          ? { ...cat, features: cat.features.map((f, fi) => (fi === featIndex ? { ...f, ...patch } : f)) }
          : cat,
      ),
    });
  };

  const updateCategory = (catIndex: number, patch: Partial<FeaturesComparisonChecklistBlockProps["categories"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, categories: categories.map((cat, ci) => (ci === catIndex ? { ...cat, ...patch } : cat)) });
  };

  const gridCols = vsMode
    ? "md:grid-cols-[minmax(0,1fr)_130px_130px]"
    : "md:grid-cols-[minmax(0,1fr)_180px]";

  const CheckChip = ({ included, them }: { included: boolean; them?: boolean }) => (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full"
      style={
        included
          ? {
              backgroundColor: them
                ? (dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.07)")
                : `color-mix(in srgb, ${accent} 13%, transparent)`,
              color: them ? tableMuted : accent,
            }
          : {
              backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(11,11,15,0.05)",
              color: dark ? "rgba(246,247,249,0.45)" : "rgba(11,11,15,0.38)",
            }
      }
      aria-hidden="true"
    >
      {included ? <Check className="h-4 w-4 stroke-[3]" /> : <X className="h-4 w-4 stroke-[2.5]" />}
    </span>
  );

  return (
    <section
      className="relative flex w-full flex-col items-center overflow-hidden px-6 py-20 sm:py-24 lg:py-28"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative z-10 w-full max-w-5xl">
        {/* ── Section header. ── */}
        <div className="mb-12 text-center lg:mb-16">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.26em]"
              style={{ color: eyebrowColor }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mx-auto max-w-3xl font-bold tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.06 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mx-auto mt-4 max-w-2xl text-base leading-relaxed lg:text-lg"
              style={{ color: muted }}
              multiline />
          )}
        </div>

        {/* ── Comparison table. ── */}
        <div
          className="overflow-hidden rounded-2xl ring-1"
          style={{
            backgroundColor: tableBg,
            color: tableInk,
            "--tw-ring-color": tableRing,
            boxShadow: dark
              ? "0 24px 48px -24px rgba(0,0,0,0.7)"
              : "0 1px 2px rgba(15,15,20,0.04), 0 16px 40px -18px rgba(15,15,20,0.12)",
          } as React.CSSProperties}
        >
          {/* Column header row (optionally sticky). */}
          <div
            className={cn(
              "grid grid-cols-1 items-center gap-4 border-b px-6 py-4 md:px-8",
              gridCols,
              sticky && "sticky top-0 z-10",
            )}
            style={{ borderColor: rowDivider, backgroundColor: headerBg }}
          >
            <InlineText
              as="div"
              value={props.featureColumnLabel ?? "Feature & Description"}
              onUpdate={onFieldChange ? (v) => update("featureColumnLabel", v) : undefined}
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: tableMuted }} />
            {vsMode ? (
              <>
                <InlineText
                  as="div"
                  value={usLabel}
                  onUpdate={onFieldChange ? (v) => update("usColumnLabel", v) : undefined}
                  className="hidden text-center text-[11px] font-bold uppercase tracking-[0.18em] md:block"
                  style={{ color: accent }} />
                <InlineText
                  as="div"
                  value={themLabel}
                  onUpdate={onFieldChange ? (v) => update("themColumnLabel", v) : undefined}
                  className="hidden text-center text-[11px] font-semibold uppercase tracking-[0.18em] md:block"
                  style={{ color: tableMuted }} />
              </>
            ) : (
              <InlineText
                as="div"
                value={props.includedColumnLabel ?? "Included"}
                onUpdate={onFieldChange ? (v) => update("includedColumnLabel", v) : undefined}
                className="hidden text-center text-[11px] font-semibold uppercase tracking-[0.18em] md:block"
                style={{ color: tableMuted }} />
            )}
          </div>

          {categories.map((category, catIndex) => (
            <Fragment key={catIndex}>
              <div
                className="border-b px-6 py-3 md:px-8"
                style={{
                  borderColor: rowDivider,
                  backgroundColor: `color-mix(in srgb, ${accentRaw} ${dark ? 9 : 5}%, ${dark ? "transparent" : "#FFFFFF"})`,
                }}
              >
                <InlineText
                  as="h3"
                  value={category.title}
                  onUpdate={onFieldChange ? (v) => updateCategory(catIndex, { title: v }) : undefined}
                  className="text-sm font-semibold tracking-tight"
                  style={{ fontFamily: DISPLAY }} />
              </div>
              {category.features.map((feature, featIndex) => {
                const themIncluded = feature.themIncluded === true;
                return (
                  <motion.div
                    key={featIndex}
                    className={cn("grid grid-cols-1 items-center gap-4 border-b px-6 py-5 md:px-8", gridCols)}
                    style={{
                      borderColor: rowDivider,
                      backgroundColor: featIndex % 2 === 1 ? zebra : undefined,
                    }}
                    initial={still ? false : { opacity: 0, y: 10 }}
                    whileInView={still ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={still ? undefined : { duration: 0.4, delay: Math.min(featIndex * 0.04, 0.24), ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${accent} 11%, transparent)`,
                          color: accent,
                        }}
                        aria-hidden="true"
                      >
                        <IconOrImage value={feature.icon} fallback={Layers} className="h-5 w-5" />
                      </div>
                      <div>
                        <InlineText
                          as="h4"
                          value={feature.name}
                          onUpdate={onFieldChange ? (v) => updateFeature(catIndex, featIndex, { name: v }) : undefined}
                          className="text-[15px] font-semibold leading-snug tracking-tight sm:text-base"
                          style={{ fontFamily: DISPLAY }} />
                        <InlineText
                          as="p"
                          value={feature.description}
                          onUpdate={onFieldChange ? (v) => updateFeature(catIndex, featIndex, { description: v }) : undefined}
                          className="mt-1 max-w-lg text-sm leading-relaxed"
                          style={{ color: tableMuted }}
                          multiline />
                      </div>
                    </div>
                    {vsMode ? (
                      <>
                        <div className="flex items-center gap-2 md:justify-center">
                          <CheckChip included />
                          <span className="text-sm font-medium md:hidden" style={{ color: tableMuted }}>{usLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 md:justify-center">
                          <CheckChip included={themIncluded} them />
                          <span className="text-sm font-medium md:hidden" style={{ color: tableMuted }}>{themLabel}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 md:justify-center">
                        <CheckChip included />
                        <span className="text-sm font-medium md:hidden" style={{ color: tableMuted }}>Included in all plans</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* ── Bespoke / custom card. ── */}
        {showBespokeCard && (
          <div
            className="mt-10 flex flex-col items-center gap-6 rounded-2xl p-8 ring-1 sm:flex-row sm:justify-between"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentRaw} ${dark ? 12 : 6}%, ${dark ? "transparent" : "#FFFFFF"})`,
              "--tw-ring-color": `color-mix(in srgb, ${accent} 22%, transparent)`,
            } as React.CSSProperties}
          >
            <div>
              {(props.bespokeHeading || onFieldChange) && (
                <InlineText
                  as="h3"
                  value={props.bespokeHeading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("bespokeHeading", v) : undefined}
                  className="text-lg font-semibold tracking-tight"
                  style={{ fontFamily: DISPLAY }} />
              )}
              {(props.bespokeSubheading || onFieldChange) && (
                <InlineText
                  as="p"
                  value={props.bespokeSubheading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("bespokeSubheading", v) : undefined}
                  className="mt-1 text-sm leading-relaxed"
                  style={{ color: muted }}
                  multiline />
              )}
            </div>
            {(props.bespokeButtonLabel || onFieldChange) && (
              <CtaButton
                ctaAction="url"
                ctaUrl={props.bespokeButtonUrl}
                brand={brand}
                source="features-comparison-checklist-bespoke"
                className="inline-flex shrink-0 items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
              >
                {props.bespokeButtonLabel || "Contact sales"}
              </CtaButton>
            )}
          </div>
        )}

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-16 border-t pt-14 lg:mt-20" style={{ borderColor: hairline }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                    style={{ color: eyebrowColor }} />
                )}
                {(props.ctaHeading || onFieldChange) && (
                  <InlineText
                    as="h3"
                    value={props.ctaHeading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                    className="text-2xl font-bold tracking-tight md:text-3xl"
                    style={{ fontFamily: DISPLAY }} />
                )}
                {(props.ctaSubheading || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.ctaSubheading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                    className="max-w-xl text-base leading-relaxed md:text-lg"
                    style={{ color: muted }}
                    multiline />
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {(props.ctaPrimaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaPrimaryUrl}
                    brand={brand}
                    source="features-comparison-checklist-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-comparison-checklist-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: `${text}33`, color: text, outlineColor: accent }}
                  >
                    {props.ctaSecondaryLabel || "Talk to sales"}
                  </CtaButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
