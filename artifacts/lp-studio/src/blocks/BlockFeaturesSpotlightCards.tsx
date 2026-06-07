import {
  LayoutTemplate, SplitSquareHorizontal, LineChart, Globe, Users, Search,
  MousePointer2, ChevronRight, Layers,
} from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesSpotlightCardsBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutTemplate, SplitSquareHorizontal, LineChart, Globe, Users, Search, Layers,
};

interface Props {
  props: FeaturesSpotlightCardsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesSpotlightCardsBlockProps) => void;
}

/** Decorative builder-canvas mockup shown beside the spotlight feature.
 *  `accent` themes the active highlights to the brand accent. */
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
  const bg = props.bgColor ?? "#FAFAFA";
  const text = props.textColor ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, bg, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;

  const update = <K extends keyof FeaturesSpotlightCardsBlockProps>(key: K, value: FeaturesSpotlightCardsBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateFeature = (i: number, patch: Partial<FeaturesSpotlightCardsBlockProps["secondaryFeatures"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, secondaryFeatures: props.secondaryFeatures.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  };

  const SpotlightIcon = ICON_MAP[props.spotlightIcon] || Layers;

  return (
    <section className="flex w-full justify-center px-6 py-24 lg:px-8" style={{ backgroundColor: bg, color: text }}>
      <div className="w-full max-w-[1280px]">
        <div className="mb-16 text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="p"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{ fontFamily: DISPLAY }} />
        </div>

        <div className="flex flex-col gap-6">
          {/* Spotlight Feature */}
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/50 md:grid-cols-2">
            <div className="flex flex-col justify-center p-10 md:p-16">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: tint, color: accent }}>
                <SpotlightIcon className="h-6 w-6" />
              </div>
              <InlineText
                as="h3"
                value={props.spotlightTitle}
                onUpdate={onFieldChange ? (v) => update("spotlightTitle", v) : undefined}
                className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl"
                style={{ fontFamily: DISPLAY }} />
              <InlineText
                as="p"
                value={props.spotlightDescription}
                onUpdate={onFieldChange ? (v) => update("spotlightDescription", v) : undefined}
                className="mb-8 text-lg text-neutral-600"
                style={{ fontFamily: BODY }}
                multiline />
              {(props.spotlightButtonLabel || onFieldChange) && (
                <div>
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.spotlightButtonUrl}
                    brand={brand}
                    source="features-spotlight-cards-spotlight"
                    className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.spotlightButtonLabel || "Try the builder"} <ChevronRight className="h-4 w-4" />
                  </CtaButton>
                </div>
              )}
            </div>
            <div className="relative min-h-[400px] bg-neutral-100 p-8">
              <BuilderMockup accent={accent} />
            </div>
          </div>

          {/* Secondary Features Row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5">
            {props.secondaryFeatures.map((feature, i) => {
              const Icon = ICON_MAP[feature.icon] || Layers;
              return (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/50 transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-50 text-neutral-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <InlineText
                    as="h4"
                    value={feature.title}
                    onUpdate={onFieldChange ? (v) => updateFeature(i, { title: v }) : undefined}
                    className="mb-2 font-semibold text-neutral-900"
                    style={{ fontFamily: DISPLAY }} />
                  <InlineText
                    as="p"
                    value={feature.description}
                    onUpdate={onFieldChange ? (v) => updateFeature(i, { description: v }) : undefined}
                    className="text-sm leading-relaxed text-neutral-600"
                    style={{ fontFamily: BODY }}
                    multiline />
                </div>
              );
            })}
          </div>
        </div>

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
                    source="features-spotlight-cards-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Try the builder"}
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-spotlight-cards-cta-secondary"
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
