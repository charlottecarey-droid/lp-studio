import {
  Layout, Palette, Users, LineChart, Shield, Rocket, Layers,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FeaturesBentoShowcaseBlockProps } from "@/lib/block-types";
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
  props: FeaturesBentoShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturesBentoShowcaseBlockProps) => void;
}

/** Layout span per tile index, mirroring the source bento mockup: tile 0 is the
 *  flagship 2×2 hero card; the rest fill the remaining grid cells. */
function spanFor(index: number): string {
  if (index === 0) return "md:col-span-2 md:row-span-2";
  return "";
}

/** Decorative mini-mockup rendered at the bottom of each tile, keyed by index
 *  to faithfully port the source bento visuals. `accent` themes the highlights. */
function TileMockup({ index, accent }: { index: number; accent: string }) {
  if (index === 0) {
    // Flagship: builder canvas with left nav, center canvas, right properties.
    return (
      <div className="relative mt-auto flex h-[280px] w-full overflow-hidden rounded-t-xl rounded-br-xl border border-b-0 border-r-0 border-neutral-200 bg-neutral-100 shadow-inner">
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
    // Brand swatches.
    return (
      <div className="mt-auto flex items-center justify-center gap-2 pt-4">
        <div className="h-12 w-12 rounded-full ring-4 ring-white shadow-md" style={{ backgroundColor: accent }} />
        <div className="h-12 w-12 -translate-x-4 rounded-full bg-violet-500 ring-4 ring-white shadow-md" />
        <div className="h-12 w-12 -translate-x-8 rounded-full bg-sky-400 ring-4 ring-white shadow-md" />
        <div className="h-12 w-12 -translate-x-12 rounded-full bg-rose-400 ring-4 ring-white shadow-md" />
      </div>
    );
  }
  if (index === 2) {
    // Collaboration cursors.
    return (
      <div className="relative mt-auto flex h-[100px] w-full items-center justify-center rounded-xl bg-neutral-50 pt-4">
        <div className="absolute left-6 top-6 flex items-center gap-1">
          <div className="h-4 w-4 border-[6px] border-transparent border-b-rose-500 border-l-rose-500" style={{ transform: "rotate(-45deg)" }} />
          <div className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">Sarah</div>
        </div>
        <div className="absolute bottom-6 right-8 flex items-center gap-1">
          <div className="h-4 w-4 border-[6px] border-transparent border-b-blue-500 border-l-blue-500" style={{ transform: "rotate(-45deg)" }} />
          <div className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">David</div>
        </div>
      </div>
    );
  }
  if (index === 3) {
    // A/B testing bar chart.
    return (
      <div className="mt-auto flex h-[100px] items-end justify-between gap-3 px-4 pt-4">
        <div className="w-full flex-1 rounded-t-md bg-neutral-200" style={{ height: "40%" }} />
        <div className="w-full flex-1 rounded-t-md" style={{ height: "65%", backgroundColor: `${accent}80` }} />
        <div className="w-full flex-1 rounded-t-md shadow-sm" style={{ height: "90%", backgroundColor: accent }} />
        <div className="w-full flex-1 rounded-t-md bg-neutral-200" style={{ height: "30%" }} />
      </div>
    );
  }
  if (index === 4) {
    // Role-based access user list.
    return (
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-neutral-300" />
            <div className="h-2 w-16 rounded-full bg-neutral-300" />
          </div>
          <div className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${accent}1f`, color: accent }}>Admin</div>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <div className="absolute inset-0 animate-ping rounded-full border border-emerald-500 opacity-20"></div>
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
  const surface = resolveSectionSurface(props, "#FAFAFA");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;

  const update = <K extends keyof FeaturesBentoShowcaseBlockProps>(key: K, value: FeaturesBentoShowcaseBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTile = (i: number, patch: Partial<FeaturesBentoShowcaseBlockProps["tiles"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, tiles: props.tiles.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  return (
    <section className="relative w-full overflow-hidden px-6 py-24 lg:px-8" style={{ background: surface.background, color: text }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto max-w-[1280px]">
        <div className="mb-16 max-w-2xl">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="p"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="mt-3 text-4xl font-bold tracking-tight md:text-5xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-6 text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-3 lg:gap-6">
          {props.tiles.map((tile, i) => {
            const isHero = i === 0;
            return (
              <motion.div
                key={i}
                className={`group relative flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${spanFor(i)}`}
                initial={isBuilder ? false : { opacity: 0, y: 20 }}
                whileInView={isBuilder ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={isBuilder ? undefined : { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={isHero ? "relative z-10 mb-8 flex flex-col items-start gap-4" : "mb-6"}>
                  <div className={`${isHero ? "" : "mb-4 inline-flex"} flex w-fit items-center justify-center rounded-xl p-3 transition-transform duration-300 group-hover:scale-110`} style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}1f` }}>
                    <IconOrImage value={tile.icon} fallback={Layers} className={isHero ? "h-6 w-6" : "h-5 w-5"} />
                  </div>
                  <div>
                    <InlineText
                      as="h3"
                      value={tile.title}
                      onUpdate={onFieldChange ? (v) => updateTile(i, { title: v }) : undefined}
                      className={`font-bold text-neutral-900 ${isHero ? "mb-2 text-2xl" : "mb-2 text-xl"}`}
                      style={{ fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={tile.description}
                      onUpdate={onFieldChange ? (v) => updateTile(i, { description: v }) : undefined}
                      className={isHero ? "max-w-md text-neutral-600" : "text-sm text-neutral-600"}
                      style={{ fontFamily: BODY }}
                      multiline />
                  </div>
                </div>
                {tile.image && tile.image.trim() ? (
                  <InlineImage
                    src={tile.image}
                    alt={tile.imageAlt ?? tile.title}
                    className={`mt-auto w-full rounded-xl object-cover ${isHero ? "h-[280px]" : "h-[140px]"}`}
                    wrapperClassName="mt-auto block w-full"
                    onUpdate={onFieldChange ? (url) => updateTile(i, { image: url }) : undefined}
                    onAltUpdate={onFieldChange ? (v) => updateTile(i, { imageAlt: v }) : undefined}
                    focalPoint={tile.imageFocal}
                    onFocalUpdate={onFieldChange ? (v) => updateTile(i, { imageFocal: v }) : undefined}
                  />
                ) : (
                  <TileMockup index={i} accent={accent} />
                )}
              </motion.div>
            );
          })}
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
                    source="features-bento-showcase-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Start building free"}
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="features-bento-showcase-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
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
