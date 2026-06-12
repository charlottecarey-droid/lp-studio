import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Layers, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesTabbedCategoriesBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Features — Tabbed Categories: a pill tab rail with an animated active
 * indicator (springy layout animation — instant under reduced motion) and
 * full tablist semantics (roving tabindex, arrow/Home/End keys). The active
 * panel crossfades between categories (instant under reduced motion) and
 * renders a real image or a CSS product mockup in the visual column.
 * Surface-aware light/dark; brand-accent driven.
 * -------------------------------------------------------------------------- */

interface Props {
  props: FeaturesTabbedCategoriesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesTabbedCategoriesBlockProps) => void;
}

/** Decorative product mockup rendered in the active tab's visual column —
 *  self-contained light "screenshot" panels keyed by index. */
function CategoryVisual({ index, accent }: { index: number; accent: string }) {
  const tint = `color-mix(in srgb, ${accent} 12%, transparent)`;
  const variant = ((index % 3) + 3) % 3;

  if (variant === 0) {
    // Design & Build — fake browser canvas with left rail + right inspector.
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
        <div className="flex h-12 w-full items-center gap-2 border-b border-neutral-200 bg-white px-4">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-neutral-200" />
            <div className="h-3 w-3 rounded-full bg-neutral-200" />
            <div className="h-3 w-3 rounded-full bg-neutral-200" />
          </div>
          <div className="ml-4 h-6 w-48 rounded bg-neutral-100" />
        </div>
        <div className="flex flex-1">
          <div className="flex w-16 flex-col items-center gap-4 border-r border-neutral-200 bg-white py-4">
            <div className="h-8 w-8 rounded bg-neutral-100" />
            <div className="h-8 w-8 rounded bg-neutral-100" />
            <div className="h-8 w-8 rounded" style={{ backgroundColor: tint }} />
            <div className="h-8 w-8 rounded bg-neutral-100" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm overflow-hidden rounded-xl border bg-white" style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`, boxShadow: `0 0 0 2px color-mix(in srgb, ${accent} 10%, transparent)` }}>
              <div className="h-32" style={{ backgroundColor: tint }} />
              <div className="p-6">
                <div className="mb-4 h-4 w-1/3 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)` }} />
                <div className="mb-2 h-3 w-full rounded-full bg-neutral-100" />
                <div className="h-3 w-5/6 rounded-full bg-neutral-100" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-8 w-24 rounded" style={{ backgroundColor: accent }} />
              <div className="h-8 w-24 rounded bg-neutral-200" />
            </div>
          </div>
          <div className="hidden w-48 border-l border-neutral-200 bg-white p-4 lg:block">
            <div className="mb-4 h-3 w-24 rounded bg-neutral-200" />
            <div className="mb-6 flex gap-2">
              <div className="h-8 w-8 rounded border" style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`, backgroundColor: tint }} />
              <div className="h-8 w-8 rounded border border-neutral-200 bg-neutral-50" />
              <div className="h-8 w-8 rounded border border-neutral-200 bg-neutral-50" />
            </div>
            <div className="mb-4 h-3 w-16 rounded bg-neutral-200" />
            <div className="h-2 w-full rounded bg-neutral-100" />
            <div className="mt-2 h-2 w-4/5 rounded bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 1) {
    // Conversion — A/B/C variant cards with a "Winner" highlight.
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="flex w-full max-w-md items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold" style={{ backgroundColor: tint, color: accent }}>A</div>
              <div>
                <div className="h-4 w-20 rounded bg-neutral-200" />
                <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
              </div>
            </div>
            <div className="text-right">
              <div className="ml-auto h-4 w-12 rounded bg-emerald-200" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
            </div>
          </div>
          <div className="relative flex w-full max-w-md items-center justify-between rounded-xl border-2 p-4 shadow-sm" style={{ borderColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 5%, #ffffff)` }}>
            <div className="absolute -top-3 left-4 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: accent }}>
              Winner
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: accent }}>B</div>
              <div>
                <div className="h-4 w-20 rounded bg-neutral-800" />
                <div className="mt-1 h-3 w-16 rounded bg-neutral-200" />
              </div>
            </div>
            <div className="text-right">
              <div className="ml-auto h-4 w-16 rounded bg-emerald-400" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-200" />
            </div>
          </div>
          <div className="flex w-full max-w-md items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 opacity-50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 font-bold text-neutral-500">C</div>
              <div>
                <div className="h-4 w-20 rounded bg-neutral-200" />
                <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
              </div>
            </div>
            <div className="text-right">
              <div className="ml-auto h-4 w-12 rounded bg-red-200" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // variant 2 — Analytics dashboard with bar chart + stat cards.
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
      <div className="flex h-14 w-full items-center gap-4 border-b border-neutral-200 bg-white px-6">
        <div className="h-4 w-24 rounded bg-neutral-200" />
        <div className="h-4 w-24 rounded" style={{ backgroundColor: tint }} />
        <div className="h-4 w-24 rounded bg-neutral-100" />
      </div>
      <div className="flex flex-1 p-6">
        <div className="flex w-full flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex h-40 w-full items-end gap-2 border-b border-neutral-100 pb-2">
            {[40, 60, 30, 80, 50, 90, 70, 100, 60, 85, 45, 75].map((height, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm"
                style={{ height: `${height}%`, backgroundColor: accent, opacity: (height / 100) * 0.7 + 0.3 }}
              />
            ))}
          </div>
          <div className="flex gap-4">
            <div className="flex-1 rounded-lg bg-neutral-50 p-4">
              <div className="mb-2 h-3 w-16 rounded bg-neutral-200" />
              <div className="h-6 w-24 rounded bg-neutral-800" />
            </div>
            <div className="flex-1 rounded-lg p-4" style={{ backgroundColor: tint, border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)` }}>
              <div className="mb-2 h-3 w-20 rounded" style={{ backgroundColor: `color-mix(in srgb, ${accent} 35%, transparent)` }} />
              <div className="h-6 w-24 rounded" style={{ backgroundColor: accent }} />
            </div>
            <div className="flex-1 rounded-lg bg-neutral-50 p-4">
              <div className="mb-2 h-3 w-16 rounded bg-neutral-200" />
              <div className="h-6 w-24 rounded bg-emerald-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlockFeaturesTabbedCategories({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;
  const uid = useId();

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

  const categories = props.categories ?? [];
  const [activeTabId, setActiveTabId] = useState(categories[0]?.id ?? "");
  const activeIndex = Math.max(0, categories.findIndex((c) => c.id === activeTabId));
  const activeCategory = categories[activeIndex] ?? categories[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabId = (i: number) => `${uid}-tab-${i}`;
  const panelId = `${uid}-panel`;

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (categories.length === 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (activeIndex + 1) % categories.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (activeIndex - 1 + categories.length) % categories.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = categories.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveTabId(categories[next].id);
    tabRefs.current[next]?.focus();
  };

  const update = <K extends keyof FeaturesTabbedCategoriesBlockProps>(key: K, value: FeaturesTabbedCategoriesBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateCategory = (i: number, patch: Partial<FeaturesTabbedCategoriesBlockProps["categories"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, categories: categories.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  };

  const updateFeature = (ci: number, fi: number, patch: Partial<FeaturesTabbedCategoriesBlockProps["categories"][number]["features"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({
      ...props,
      categories: categories.map((c, idx) =>
        idx === ci ? { ...c, features: c.features.map((f, fidx) => (fidx === fi ? { ...f, ...patch } : f)) } : c),
    });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 sm:py-24 lg:px-10 lg:py-32"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative z-10 mx-auto max-w-7xl">
        {/* ── Section header. ── */}
        <div className="mb-10 max-w-3xl lg:mb-12">
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
            style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.5vw, 3.25rem)", lineHeight: 1.06 }}
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

        {/* ── Pill tab rail with animated active indicator. ── */}
        <div
          role="tablist"
          aria-label={props.headline || "Feature categories"}
          onKeyDown={onTabKeyDown}
          className="mb-10 flex w-fit max-w-full flex-wrap gap-1.5 rounded-[1.25rem] p-1.5 lg:mb-14"
          style={{
            backgroundColor: dark ? "rgba(255,255,255,0.05)" : "rgba(11,11,15,0.04)",
            boxShadow: `inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.08)" : "rgba(11,11,15,0.06)"}`,
          }}
        >
          {categories.map((category, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={category.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                type="button"
                id={tabId(i)}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTabId(category.id)}
                className="relative flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: isActive ? onAccent : muted, outlineColor: accent }}
              >
                {isActive && (
                  <motion.span
                    layoutId={still ? undefined : `${uid}-tab-pill`}
                    className="absolute inset-0 rounded-2xl"
                    style={{ backgroundColor: accent }}
                    transition={still ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <IconOrImage value={category.icon} fallback={Layers} className="h-4 w-4" />
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Active panel — crossfade (instant under reduced motion). ── */}
        {activeCategory && (
          <div id={panelId} role="tabpanel" aria-labelledby={tabId(activeIndex)}>
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={activeCategory.id || activeIndex}
                className="grid gap-12 lg:min-h-[500px] lg:grid-cols-2 lg:gap-14"
                initial={still ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={still ? { opacity: 1 } : { opacity: 0, y: -8 }}
                transition={still ? { duration: 0 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Copy column */}
                <div className="flex flex-col justify-center">
                  <div className="mb-9">
                    <InlineText
                      as="h3"
                      value={activeCategory.heading}
                      onUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { heading: v }) : undefined}
                      className="mb-4 text-2xl font-bold leading-snug tracking-tight sm:text-3xl"
                      style={{ fontFamily: DISPLAY }}
                      multiline />
                    <InlineText
                      as="p"
                      value={activeCategory.subheading}
                      onUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { subheading: v }) : undefined}
                      className="max-w-[52ch] text-base leading-relaxed lg:text-lg"
                      style={{ color: muted }}
                      multiline />
                  </div>

                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-1 lg:gap-8">
                    {activeCategory.features.map((feature, fi) => (
                      <div key={`${activeCategory.id}-${fi}`} className="relative pl-12">
                        <div
                          className="absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${accent} 11%, transparent)`,
                            color: accent,
                          }}
                          aria-hidden="true"
                        >
                          <IconOrImage value={feature.icon} fallback={Layers} className="h-4 w-4" />
                        </div>
                        <InlineText
                          as="h4"
                          value={feature.title}
                          onUpdate={onFieldChange ? (v) => updateFeature(activeIndex, fi, { title: v }) : undefined}
                          className="mb-1 text-base font-semibold leading-snug tracking-tight"
                          style={{ fontFamily: DISPLAY }} />
                        <InlineText
                          as="p"
                          value={feature.description}
                          onUpdate={onFieldChange ? (v) => updateFeature(activeIndex, fi, { description: v }) : undefined}
                          className="text-sm leading-relaxed sm:text-[15px]"
                          style={{ color: muted }}
                          multiline />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual column */}
                {activeCategory.image && activeCategory.image.trim() ? (
                  <div
                    className="relative h-[320px] overflow-hidden rounded-2xl ring-1 lg:h-auto lg:min-h-[500px]"
                    style={{
                      "--tw-ring-color": dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.08)",
                      boxShadow: dark
                        ? "0 28px 56px -24px rgba(0,0,0,0.7)"
                        : "0 1px 2px rgba(15,15,20,0.05), 0 24px 48px -20px rgba(15,15,20,0.16)",
                    } as React.CSSProperties}
                  >
                    <InlineImage
                      src={activeCategory.image}
                      alt={activeCategory.imageAlt ?? activeCategory.heading}
                      className="absolute inset-0 h-full w-full object-cover"
                      wrapperClassName="absolute inset-0"
                      loading="lazy"
                      onUpdate={onFieldChange ? (url) => updateCategory(activeIndex, { image: url }) : undefined}
                      onAltUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { imageAlt: v }) : undefined}
                      focalPoint={activeCategory.imageFocal}
                      onFocalUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { imageFocal: v }) : undefined}
                    />
                  </div>
                ) : (
                  <div
                    className="relative h-[400px] rounded-2xl p-2 sm:p-4 lg:h-auto lg:min-h-[500px]"
                    style={{ backgroundColor: `color-mix(in srgb, ${accentRaw} ${dark ? 10 : 5}%, ${dark ? "transparent" : "#FFFFFF"})` }}
                  >
                    <CategoryVisual index={activeIndex} accent={accent} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

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
                    source="features-tabbed-categories-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
                  >
                    {props.ctaPrimaryLabel || "Book a live demo"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-tabbed-categories-cta-secondary"
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
