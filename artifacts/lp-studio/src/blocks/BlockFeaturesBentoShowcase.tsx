import { Layers, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesBentoShowcaseBlockProps } from "@/lib/block-types";
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
 * Features — Bento Showcase: the product-feature MOSAIC. A 2×2 flagship media
 * tile (real screenshot bleeding to the card edge, or a CSS builder mockup)
 * plus compact supporting tiles, each with its own mini product visual.
 * Surface-aware: crisp white cards with layered shadows on light presets,
 * flat translucent cards (no glass blur, no gradient mesh — distinct from
 * glass-bento-features) on dark presets. Imagery emphasis distinguishes it
 * from the airy tinted benefits-bento. Hover lift + reveals are disabled in
 * the builder and under reduced motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: FeaturesBentoShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesBentoShowcaseBlockProps) => void;
}

/** Layout span per tile index: tile 0 is the flagship 2×2 media tile. */
function spanFor(index: number): string {
  if (index === 0) return "md:col-span-2 md:row-span-2";
  return "";
}

/** Decorative mini-mockup rendered at the bottom of each tile, keyed by index.
 *  Self-contained light "screenshot" panels, so they read correctly on both
 *  light and dark cards. `accent` themes the highlights. */
function TileMockup({ index, accent }: { index: number; accent: string }) {
  if (index === 0) {
    // Flagship: builder canvas with left nav, center canvas, right properties.
    return (
      <div className="relative mt-auto flex h-[280px] w-full overflow-hidden rounded-t-xl border border-b-0 border-neutral-200 bg-neutral-100 shadow-inner">
        <div className="w-48 shrink-0 border-r border-neutral-200 bg-white p-4">
          <div className="mb-4 h-3 w-16 rounded-full bg-neutral-200" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-full rounded-md bg-neutral-100" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="h-full w-full rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <div className="mb-6 h-8 w-2/3 rounded-lg bg-neutral-100" />
            <div className="mb-4 h-4 w-full rounded-full bg-neutral-100" />
            <div className="mb-8 h-4 w-4/5 rounded-full bg-neutral-100" />
            <div className="flex gap-4">
              <div className="h-10 w-24 rounded-lg" style={{ backgroundColor: accent }} />
              <div className="h-10 w-24 rounded-lg bg-neutral-200" />
            </div>
          </div>
        </div>
        <div className="hidden w-56 shrink-0 border-l border-neutral-200 bg-white p-4 lg:block">
          <div className="mb-6 h-3 w-20 rounded-full bg-neutral-200" />
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 h-2 w-12 rounded-full bg-neutral-200" />
              <div className="h-8 w-full rounded-md border border-neutral-200 bg-neutral-50" />
            </div>
            <div>
              <div className="mb-2 h-2 w-16 rounded-full bg-neutral-200" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded-md border border-neutral-200 bg-neutral-50" />
                <div className="h-8 flex-1 rounded-md border border-neutral-200 bg-neutral-50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (index === 1) {
    // Brand swatches — brand-derived tints instead of stock violet/sky/rose.
    return (
      <div className="mt-auto flex items-center justify-center gap-2 pt-4">
        <div className="h-12 w-12 rounded-full shadow-md ring-4 ring-white" style={{ backgroundColor: accent }} />
        <div className="h-12 w-12 -translate-x-4 rounded-full shadow-md ring-4 ring-white" style={{ backgroundColor: `color-mix(in srgb, ${accent} 65%, #ffffff)` }} />
        <div className="h-12 w-12 -translate-x-8 rounded-full shadow-md ring-4 ring-white" style={{ backgroundColor: `color-mix(in srgb, ${accent} 40%, #ffffff)` }} />
        <div className="h-12 w-12 -translate-x-12 rounded-full shadow-md ring-4 ring-white" style={{ backgroundColor: `color-mix(in srgb, ${accent} 55%, #0f172a)` }} />
      </div>
    );
  }
  if (index === 2) {
    // Collaboration cursors.
    return (
      <div className="relative mt-auto flex h-[100px] w-full items-center justify-center rounded-xl bg-neutral-50 pt-4">
        <div className="absolute left-6 top-6 flex items-center gap-1">
          <div className="h-4 w-4 border-[6px] border-transparent" style={{ borderBottomColor: accent, borderLeftColor: accent, transform: "rotate(-45deg)" }} />
          <div className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm" style={{ backgroundColor: accent }}>Sarah</div>
        </div>
        <div className="absolute bottom-6 right-8 flex items-center gap-1">
          <div className="h-4 w-4 border-[6px] border-transparent border-b-neutral-700 border-l-neutral-700" style={{ transform: "rotate(-45deg)" }} />
          <div className="rounded-full bg-neutral-700 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">David</div>
        </div>
      </div>
    );
  }
  if (index === 3) {
    // A/B testing bar chart.
    return (
      <div className="mt-auto flex h-[100px] items-end justify-between gap-3 px-4 pt-4">
        <div className="w-full flex-1 rounded-t-md bg-neutral-200" style={{ height: "40%" }} />
        <div className="w-full flex-1 rounded-t-md" style={{ height: "65%", backgroundColor: `color-mix(in srgb, ${accent} 50%, transparent)` }} />
        <div className="w-full flex-1 rounded-t-md shadow-sm" style={{ height: "90%", backgroundColor: accent }} />
        <div className="w-full flex-1 rounded-t-md bg-neutral-200" style={{ height: "30%" }} />
      </div>
    );
  }
  if (index === 4) {
    // Role-based access user list.
    return (
      <div className="mt-auto flex flex-col gap-2 rounded-xl bg-white/60 pt-4">
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-neutral-300" />
            <div className="h-2 w-16 rounded-full bg-neutral-300" />
          </div>
          <div className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>Admin</div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-neutral-300" />
            <div className="h-2 w-12 rounded-full bg-neutral-300" />
          </div>
          <div className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">Editor</div>
        </div>
      </div>
    );
  }
  // index 5+: deploy success callout.
  return (
    <div className="mt-auto flex flex-col items-center justify-center pt-6">
      <div className="flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <div className="absolute inset-0 animate-ping rounded-full border border-emerald-500 opacity-20 motion-reduce:hidden"></div>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-emerald-900">Deployed Successfully</span>
          <span className="text-[10px] text-emerald-700">Live on edge network</span>
        </div>
      </div>
    </div>
  );
}

export function BlockFeaturesBentoShowcase({ props, brand, onFieldChange }: Props) {
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
  const cardBorder = dark ? "rgba(255,255,255,0.09)" : "rgba(11,11,15,0.07)";
  const cardShadow = dark
    ? "0 18px 40px -22px rgba(0,0,0,0.7)"
    : "0 1px 2px rgba(15,15,20,0.04), 0 10px 30px -12px rgba(15,15,20,0.10)";

  const update = <K extends keyof FeaturesBentoShowcaseBlockProps>(key: K, value: FeaturesBentoShowcaseBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTile = (i: number, patch: Partial<FeaturesBentoShowcaseBlockProps["tiles"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, tiles: props.tiles.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  return (
    <section
      className="fbsh-section relative w-full overflow-hidden px-6 py-20 lg:px-10 lg:py-28"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <style>{`
        .fbsh-card { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease; }
        @media (hover: hover) {
          .fbsh-card:hover {
            transform: translateY(-4px);
            box-shadow: ${dark
              ? "0 24px 48px -20px rgba(0,0,0,0.75)"
              : "0 1px 2px rgba(15,15,20,0.05), 0 18px 44px -14px rgba(15,15,20,0.16)"};
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fbsh-card, .fbsh-card:hover { transition: none; transform: none; }
        }
      `}</style>
      <div className="relative z-10 mx-auto max-w-[1280px]">
        {/* ── Section header. ── */}
        <div className="mb-12 max-w-3xl lg:mb-16">
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
            className="font-bold tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.5vw, 3.5rem)", lineHeight: 1.05 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-4 max-w-2xl text-base leading-relaxed lg:text-lg"
              style={{ color: muted }}
              multiline />
          )}
        </div>

        {/* ── Mosaic grid: 2×2 media flagship + compact supporting tiles. ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-3 lg:gap-5">
          {props.tiles.map((tile, i) => {
            const isHero = i === 0;
            const hasImage = !!(tile.image && tile.image.trim());
            return (
              <motion.div
                key={i}
                className={cn(
                  "fbsh-card group relative flex flex-col overflow-hidden rounded-3xl border",
                  isHero ? "p-7 sm:p-8" : "p-6 sm:p-7",
                  spanFor(i),
                )}
                style={{ backgroundColor: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
                initial={still ? false : { opacity: 0, y: 20 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={still ? undefined : { duration: 0.55, delay: Math.min(i * 0.07, 0.4), ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={cn("flex flex-col items-start", isHero ? "mb-7 gap-4" : "mb-5 gap-3")}>
                  <div
                    className={cn("flex items-center justify-center rounded-xl", isHero ? "h-12 w-12" : "h-10 w-10")}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      color: accent,
                    }}
                    aria-hidden="true"
                  >
                    <IconOrImage value={tile.icon} fallback={Layers} className={isHero ? "h-6 w-6" : "h-5 w-5"} />
                  </div>
                  <div>
                    <InlineText
                      as="h3"
                      value={tile.title}
                      onUpdate={onFieldChange ? (v) => updateTile(i, { title: v }) : undefined}
                      className={cn("mb-2 font-semibold leading-snug tracking-tight", isHero ? "text-xl sm:text-2xl" : "text-base sm:text-lg")}
                      style={{ fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={tile.description}
                      onUpdate={onFieldChange ? (v) => updateTile(i, { description: v }) : undefined}
                      className={cn("leading-relaxed", isHero ? "max-w-md text-sm sm:text-base" : "text-sm")}
                      style={{ color: muted }}
                      multiline />
                  </div>
                </div>
                {hasImage ? (
                  isHero ? (
                    /* Flagship media bleeds to the card edges. */
                    <div className="relative mt-auto -mb-7 -mx-7 overflow-hidden sm:-mb-8 sm:-mx-8">
                      <InlineImage
                        src={tile.image ?? ""}
                        alt={tile.imageAlt ?? tile.title}
                        className={cn(
                          "h-[240px] w-full object-cover sm:h-[300px]",
                          !reduced && "transition-transform duration-700 group-hover:scale-[1.03]",
                        )}
                        wrapperClassName="block w-full"
                        loading="lazy"
                        onUpdate={onFieldChange ? (url) => updateTile(i, { image: url }) : undefined}
                        onAltUpdate={onFieldChange ? (v) => updateTile(i, { imageAlt: v }) : undefined}
                        focalPoint={tile.imageFocal}
                        onFocalUpdate={onFieldChange ? (v) => updateTile(i, { imageFocal: v }) : undefined}
                      />
                    </div>
                  ) : (
                    <InlineImage
                      src={tile.image ?? ""}
                      alt={tile.imageAlt ?? tile.title}
                      className="h-[140px] w-full rounded-xl object-cover ring-1 ring-black/5"
                      wrapperClassName="mt-auto block w-full"
                      loading="lazy"
                      onUpdate={onFieldChange ? (url) => updateTile(i, { image: url }) : undefined}
                      onAltUpdate={onFieldChange ? (v) => updateTile(i, { imageAlt: v }) : undefined}
                      focalPoint={tile.imageFocal}
                      onFocalUpdate={onFieldChange ? (v) => updateTile(i, { imageFocal: v }) : undefined}
                    />
                  )
                ) : (
                  <TileMockup index={i} accent={accent} />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-20 border-t pt-14 lg:mt-24" style={{ borderColor: hairline }}>
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
                    source="features-bento-showcase-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
                  >
                    {props.ctaPrimaryLabel || "Start building free"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-bento-showcase-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: `${text}33`, color: text, outlineColor: accent }}
                  >
                    {props.ctaSecondaryLabel || "Book a walkthrough"}
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
