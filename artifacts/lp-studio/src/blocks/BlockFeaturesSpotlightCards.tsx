import { MousePointer2, ChevronRight, Layers, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesSpotlightCardsBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Features — Spotlight Cards: one flagship spotlight card (copy + button
 * beside a real image or a CSS builder mockup) above a grid of supporting
 * cards, each led by a large tinted icon area or an optional image, with an
 * accent glow on hover (disabled under reduced motion) and an optional
 * `featured` card treatment (accent-tinted surface + stronger ring). Varied
 * card heights are embraced; surface-aware light/dark.
 * -------------------------------------------------------------------------- */

interface Props {
  props: FeaturesSpotlightCardsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesSpotlightCardsBlockProps) => void;
}

/** Decorative builder-canvas mockup shown beside the spotlight feature. */
function BuilderMockup({ accent }: { accent: string }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-100 px-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
          <div className="h-3 w-3 rounded-full bg-neutral-200" />
        </div>
        <div className="h-6 w-32 rounded-md bg-neutral-100" />
        <div className="h-6 w-16 rounded-md" style={{ backgroundColor: accent }} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 shrink-0 border-r border-neutral-100 bg-neutral-50/50 p-4">
          <div className="mb-4 h-4 w-20 rounded bg-neutral-200" />
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-md bg-white p-2 shadow-sm ring-1 ring-neutral-200/50">
              <div className="h-6 w-6 rounded bg-neutral-100" />
              <div className="h-3 flex-1 rounded bg-neutral-200" />
            </div>
            <div className="flex items-center gap-3 rounded-md p-2">
              <div className="h-6 w-6 rounded bg-neutral-200" />
              <div className="h-3 flex-1 rounded bg-neutral-200" />
            </div>
            <div className="flex items-center gap-3 rounded-md p-2">
              <div className="h-6 w-6 rounded bg-neutral-200" />
              <div className="h-3 flex-1 rounded bg-neutral-200" />
            </div>
          </div>
        </div>
        <div className="flex-1 bg-neutral-100/50 p-6">
          <div className="relative flex h-full w-full flex-col gap-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <div className="h-32 w-full rounded-md border border-neutral-100 bg-neutral-50" />
            <div className="flex gap-4">
              <div className="h-48 flex-1 rounded-md border border-neutral-100 bg-neutral-50" />
              <div className="h-48 flex-1 rounded-md border border-neutral-100 bg-neutral-50" />
            </div>
            <div className="absolute right-12 top-12 flex items-center justify-center">
              <MousePointer2 className="h-6 w-6 drop-shadow-md" style={{ color: accent }} />
              <div className="ml-1 rounded px-2 py-1 text-[10px] font-medium text-white shadow-sm" style={{ backgroundColor: accent }}>
                Editing
              </div>
            </div>
          </div>
        </div>
        <div className="hidden w-56 shrink-0 border-l border-neutral-100 bg-white p-4 lg:block">
          <div className="mb-4 h-4 w-24 rounded bg-neutral-200" />
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-neutral-200" />
              <div className="h-8 w-full rounded border border-neutral-200 bg-neutral-50" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-neutral-200" />
              <div className="h-8 w-full rounded border border-neutral-200 bg-neutral-50" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded border border-neutral-200 bg-neutral-50" />
              <div className="h-8 flex-1 rounded border border-neutral-200 bg-neutral-50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlockFeaturesSpotlightCards({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;

  const surface = resolveSectionSurface(props, "#FAFAFA", brand);
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

  const cardBg = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const cardRing = dark ? "rgba(255,255,255,0.09)" : "rgba(11,11,15,0.07)";
  const cardShadow = dark
    ? "0 18px 40px -22px rgba(0,0,0,0.7)"
    : "0 1px 2px rgba(15,15,20,0.04), 0 10px 30px -12px rgba(15,15,20,0.10)";

  const update = <K extends keyof FeaturesSpotlightCardsBlockProps>(key: K, value: FeaturesSpotlightCardsBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateFeature = (i: number, patch: Partial<FeaturesSpotlightCardsBlockProps["secondaryFeatures"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, secondaryFeatures: props.secondaryFeatures.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  };

  return (
    <section
      className="fspc-section relative flex w-full justify-center overflow-hidden px-6 py-20 sm:py-24 lg:px-10 lg:py-32"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <style>{`
        .fspc-card {
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease;
        }
        @media (hover: hover) {
          .fspc-card:hover {
            transform: translateY(-4px);
            box-shadow:
              0 0 0 1px color-mix(in srgb, ${accent} 24%, transparent),
              0 0 30px -6px color-mix(in srgb, ${accent} 30%, transparent),
              ${dark ? "0 22px 44px -18px rgba(0,0,0,0.75)" : "0 16px 40px -14px rgba(15,15,20,0.16)"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fspc-card, .fspc-card:hover { transition: none; transform: none; }
        }
      `}</style>
      <div className="relative z-10 w-full max-w-[1280px]">
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
            style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.2vw, 3.25rem)", lineHeight: 1.06 }}
            multiline />
        </div>

        <div className="flex flex-col gap-5 lg:gap-6">
          {/* ── Spotlight card. ── */}
          <div
            className="grid grid-cols-1 overflow-hidden rounded-3xl ring-1 md:grid-cols-2"
            style={{
              backgroundColor: cardBg,
              "--tw-ring-color": cardRing,
              boxShadow: dark
                ? "0 28px 56px -24px rgba(0,0,0,0.75)"
                : "0 1px 2px rgba(15,15,20,0.05), 0 24px 56px -22px rgba(15,15,20,0.16)",
            } as React.CSSProperties}
          >
            <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                  color: accent,
                }}
                aria-hidden="true"
              >
                <IconOrImage value={props.spotlightIcon} fallback={Layers} className="h-6 w-6" />
              </div>
              <InlineText
                as="h3"
                value={props.spotlightTitle}
                onUpdate={onFieldChange ? (v) => update("spotlightTitle", v) : undefined}
                className="mb-4 text-2xl font-bold leading-snug tracking-tight md:text-3xl"
                style={{ fontFamily: DISPLAY }}
                multiline />
              <InlineText
                as="p"
                value={props.spotlightDescription}
                onUpdate={onFieldChange ? (v) => update("spotlightDescription", v) : undefined}
                className="mb-8 max-w-[50ch] text-base leading-relaxed lg:text-lg"
                style={{ color: muted }}
                multiline />
              {(props.spotlightButtonLabel || onFieldChange) && (
                <div>
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.spotlightButtonUrl}
                    brand={brand}
                    source="features-spotlight-cards-spotlight"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
                  >
                    {props.spotlightButtonLabel || "Try the builder"} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </CtaButton>
                </div>
              )}
            </div>
            {props.spotlightImage && props.spotlightImage.trim() ? (
              <div className="relative min-h-[320px] sm:min-h-[400px]">
                <InlineImage
                  src={props.spotlightImage}
                  alt={props.spotlightImageAlt ?? props.spotlightTitle}
                  className="absolute inset-0 h-full w-full object-cover"
                  wrapperClassName="absolute inset-0"
                  loading="lazy"
                  onUpdate={onFieldChange ? (url) => update("spotlightImage", url) : undefined}
                  onAltUpdate={onFieldChange ? (v) => update("spotlightImageAlt", v) : undefined}
                  focalPoint={props.spotlightImageFocal}
                  onFocalUpdate={onFieldChange ? (v) => update("spotlightImageFocal", v) : undefined}
                />
              </div>
            ) : (
              <div
                className="relative min-h-[320px] p-6 sm:min-h-[400px] sm:p-8"
                style={{ backgroundColor: `color-mix(in srgb, ${accentRaw} ${dark ? 12 : 6}%, ${dark ? "transparent" : "#FFFFFF"})` }}
              >
                <BuilderMockup accent={accent} />
              </div>
            )}
          </div>

          {/* ── Supporting cards — large icon/image areas, glow on hover. ── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {props.secondaryFeatures.map((feature, i) => {
              const hasImage = !!(feature.image && feature.image.trim());
              const featured = feature.featured === true;
              return (
                <motion.div
                  key={i}
                  className="fspc-card group flex flex-col overflow-hidden rounded-2xl ring-1"
                  style={{
                    backgroundColor: featured
                      ? `color-mix(in srgb, ${accentRaw} ${dark ? 14 : 6}%, ${cardBg})`
                      : cardBg,
                    "--tw-ring-color": featured
                      ? `color-mix(in srgb, ${accent} 35%, ${cardRing})`
                      : cardRing,
                    boxShadow: cardShadow,
                  } as React.CSSProperties}
                  initial={still ? false : { opacity: 0, y: 16 }}
                  whileInView={still ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={still ? undefined : { duration: 0.5, delay: Math.min(i * 0.06, 0.36), ease: [0.16, 1, 0.3, 1] }}
                >
                  {hasImage ? (
                    <InlineImage
                      src={feature.image ?? ""}
                      alt={feature.imageAlt ?? feature.title}
                      className={cn(
                        "h-40 w-full object-cover",
                        !reduced && "transition-transform duration-700 group-hover:scale-[1.03]",
                      )}
                      wrapperClassName="block w-full overflow-hidden"
                      loading="lazy"
                      onUpdate={onFieldChange ? (url) => updateFeature(i, { image: url }) : undefined}
                      onAltUpdate={onFieldChange ? (v) => updateFeature(i, { imageAlt: v }) : undefined}
                      focalPoint={feature.imageFocal}
                      onFocalUpdate={onFieldChange ? (v) => updateFeature(i, { imageFocal: v }) : undefined}
                    />
                  ) : (
                    /* Large tinted icon area. */
                    <div
                      className="flex h-28 items-center justify-center"
                      style={{ backgroundColor: `color-mix(in srgb, ${accentRaw} ${dark ? 14 : 7}%, ${dark ? "transparent" : "#FFFFFF"})` }}
                      aria-hidden="true"
                    >
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                          color: accent,
                        }}
                      >
                        <IconOrImage value={feature.icon} fallback={Layers} className="h-7 w-7" />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col p-6">
                    <InlineText
                      as="h3"
                      value={feature.title}
                      onUpdate={onFieldChange ? (v) => updateFeature(i, { title: v }) : undefined}
                      className="mb-2 text-base font-semibold leading-snug tracking-tight"
                      style={{ fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={feature.description}
                      onUpdate={onFieldChange ? (v) => updateFeature(i, { description: v }) : undefined}
                      className="text-sm leading-relaxed"
                      style={{ color: muted }}
                      multiline />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-16 border-t pt-14 lg:mt-24" style={{ borderColor: hairline }}>
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
                    source="features-spotlight-cards-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
                  >
                    {props.ctaPrimaryLabel || "Try the builder"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-spotlight-cards-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: `${text}33`, color: text, outlineColor: accent }}
                  >
                    {props.ctaSecondaryLabel || "See all features"}
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
