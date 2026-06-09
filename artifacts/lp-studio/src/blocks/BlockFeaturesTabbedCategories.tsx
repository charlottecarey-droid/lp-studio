import { useState } from "react";
import {
  Paintbrush, Palette, Layers, Split, ListChecks, Sparkles, Route,
  DollarSign, MousePointerClick, MonitorSmartphone, Zap, BarChart3,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesTabbedCategoriesBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;


interface Props {
  props: FeaturesTabbedCategoriesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesTabbedCategoriesBlockProps) => void;
}

/** Decorative product mockup rendered in the active tab's visual column, keyed
 *  by index to faithfully port the source tabbed visuals. `accent` themes the
 *  highlighted elements to the brand accent. */
function CategoryVisual({ index, accent }: { index: number; accent: string }) {
  const tint = `${accent}1f`;
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
            <div className="w-full max-w-sm overflow-hidden rounded-xl border bg-white" style={{ borderColor: `${accent}55`, boxShadow: `0 0 0 2px ${accent}1a` }}>
              <div className="h-32" style={{ backgroundColor: tint }} />
              <div className="p-6">
                <div className="mb-4 h-4 w-1/3 rounded-full" style={{ backgroundColor: `${accent}33` }} />
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
              <div className="h-8 w-8 rounded border" style={{ borderColor: `${accent}55`, backgroundColor: tint }} />
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
          <div className="relative flex w-full max-w-md items-center justify-between rounded-xl border-2 p-4 shadow-sm" style={{ borderColor: accent, backgroundColor: `${accent}0d` }}>
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
            <div className="flex-1 rounded-lg p-4" style={{ backgroundColor: tint, border: `1px solid ${accent}33` }}>
              <div className="mb-2 h-3 w-20 rounded" style={{ backgroundColor: `${accent}55` }} />
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
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;

  const categories = props.categories ?? [];
  const [activeTabId, setActiveTabId] = useState(categories[0]?.id ?? "");
  const activeIndex = Math.max(0, categories.findIndex((c) => c.id === activeTabId));
  const activeCategory = categories[activeIndex] ?? categories[0];

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
    <section className="relative w-full overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8" style={{ background: surface.background, color: text }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-16 max-w-3xl">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-3 text-sm font-semibold uppercase tracking-wide"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-6 text-lg leading-8"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-12 flex flex-wrap gap-2 border-b border-neutral-200 pb-px">
          {categories.map((category) => {
            const isActive = category.id === (activeCategory?.id ?? "");
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveTabId(category.id)}
                className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  borderColor: isActive ? accent : "transparent",
                  color: isActive ? accent : muted,
                  fontFamily: BODY,
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <IconOrImage value={category.icon} fallback={Layers} className="h-4 w-4" />
                {category.label}
              </button>
            );
          })}
        </div>

        {/* Active Tab Content */}
        {activeCategory && (
          <div className="grid min-h-[500px] gap-12 lg:grid-cols-2 lg:gap-8">
            {/* Features Column */}
            <div className="flex flex-col justify-center">
              <div className="mb-10">
                <InlineText
                  as="h3"
                  value={activeCategory.heading}
                  onUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { heading: v }) : undefined}
                  className="mb-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl"
                  style={{ fontFamily: DISPLAY }} />
                <InlineText
                  as="p"
                  value={activeCategory.subheading}
                  onUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { subheading: v }) : undefined}
                  className="text-lg text-neutral-600"
                  style={{ fontFamily: BODY }}
                  multiline />
              </div>

              <dl className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-1">
                {activeCategory.features.map((feature, fi) => {
                  return (
                    <motion.div
                      key={`${activeTabId}-${fi}`}
                      className="group relative pl-12"
                      initial={isBuilder ? false : { opacity: 0, y: 12 }}
                      animate={isBuilder ? undefined : { opacity: 1, y: 0 }}
                      transition={isBuilder ? undefined : { duration: 0.45, delay: fi * 0.07, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <dt className="mb-1 text-lg font-semibold leading-7 text-neutral-900" style={{ fontFamily: DISPLAY }}>
                        <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
                          <IconOrImage value={feature.icon} fallback={Layers} className="h-5 w-5" />
                        </div>
                        <InlineText
                          as="span"
                          value={feature.title}
                          onUpdate={onFieldChange ? (v) => updateFeature(activeIndex, fi, { title: v }) : undefined} />
                      </dt>
                      <dd>
                        <InlineText
                          as="p"
                          value={feature.description}
                          onUpdate={onFieldChange ? (v) => updateFeature(activeIndex, fi, { description: v }) : undefined}
                          className="text-base leading-7 text-neutral-600"
                          style={{ fontFamily: BODY }}
                          multiline />
                      </dd>
                    </motion.div>
                  );
                })}
              </dl>
            </div>

            {/* Visual Column */}
            {activeCategory.image && activeCategory.image.trim() ? (
              <div className="relative h-[400px] overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100/50 lg:h-auto lg:min-h-[500px]">
                <InlineImage
                  src={activeCategory.image}
                  alt={activeCategory.imageAlt ?? activeCategory.heading}
                  className="h-full min-h-[400px] w-full object-cover lg:min-h-[500px]"
                  wrapperClassName="block h-full w-full"
                  onUpdate={onFieldChange ? (url) => updateCategory(activeIndex, { image: url }) : undefined}
                  onAltUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { imageAlt: v }) : undefined}
                  focalPoint={activeCategory.imageFocal}
                  onFocalUpdate={onFieldChange ? (v) => updateCategory(activeIndex, { imageFocal: v }) : undefined}
                />
              </div>
            ) : (
              <div className="relative h-[400px] rounded-2xl border border-neutral-100 bg-neutral-100/50 p-2 sm:p-4 lg:h-auto lg:min-h-[500px]">
                <CategoryVisual index={activeIndex} accent={accent} />
              </div>
            )}
          </div>
        )}

        {showCta && (
          <div className="mt-20 border-t pt-16" style={{ borderColor: `${text}1a` }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-xs font-bold uppercase tracking-[0.18em]"
                    style={{ color: accent, fontFamily: BODY }} />
                )}
                {(props.ctaHeading || onFieldChange) && (
                  <InlineText
                    as="h3"
                    value={props.ctaHeading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                    className="text-2xl font-extrabold tracking-tight md:text-3xl"
                    style={{ fontFamily: DISPLAY }} />
                )}
                {(props.ctaSubheading || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={props.ctaSubheading ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                    className="max-w-xl text-base md:text-lg"
                    style={{ color: muted, fontFamily: BODY }}
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Book a live demo"}
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-tabbed-categories-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
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
