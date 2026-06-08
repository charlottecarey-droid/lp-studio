import {
  Zap, Layers, TrendingUp, BarChart3, Users, ShieldCheck, CloudLightning,
  Globe2, Clock, Sparkles, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsBentoBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;


interface Props {
  props: BenefitsBentoBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsBentoBlockProps) => void;
}

/** Layout span per tile index, mirroring the source bento mockup:
 *  tile 0 = large hero (2×2), tiles 1–3 = small, tile 4 = wide dark (2-wide). */
function spanFor(index: number): string {
  if (index === 0) return "md:col-span-2 md:row-span-2";
  if (index === 4) return "md:col-span-2";
  return "";
}

export function BlockBenefitsBento({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FAFAFA");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const darkOnAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;

  const update = <K extends keyof BenefitsBentoBlockProps>(key: K, value: BenefitsBentoBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateTile = (i: number, patch: Partial<BenefitsBentoBlockProps["tiles"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, tiles: props.tiles.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  };

  return (
    <section className="w-full px-6 py-24 lg:px-8" style={{ background: surface.background, color: text }}>
      <div className="mx-auto max-w-[1280px]">
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
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-4 text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-3">
          {props.tiles.map((tile, i) => {
            const isDark = i === 4;
            const isHero = i === 0;
            if (isDark) {
              return (
                <div
                  key={i}
                  className={`relative flex flex-col justify-center overflow-hidden rounded-3xl p-8 shadow-sm ${spanFor(i)}`}
                  style={{ backgroundColor: accent }}
                >
                  <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: darkOnAccent }} />
                  <div className="relative z-10">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${darkOnAccent}26` }}>
                      <IconOrImage value={tile.icon} fallback={Layers} className="h-5 w-5" />
                    </div>
                    <InlineText
                      as="h3"
                      value={tile.title}
                      onUpdate={onFieldChange ? (v) => updateTile(i, { title: v }) : undefined}
                      className="text-lg font-bold"
                      style={{ color: onAccent, fontFamily: DISPLAY }} />
                    <InlineText
                      as="p"
                      value={tile.description}
                      onUpdate={onFieldChange ? (v) => updateTile(i, { description: v }) : undefined}
                      className="mt-2 max-w-lg"
                      style={{ color: onAccent, opacity: 0.85, fontFamily: BODY }}
                      multiline />
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`group relative flex flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md ${spanFor(i)}`}
              >
                <div className={`mb-4 flex items-center justify-center rounded-xl ${isHero ? "h-12 w-12" : "h-10 w-10"}`} style={{ backgroundColor: tint }}>
                  <IconOrImage value={tile.icon} fallback={Layers} className={isHero ? "h-6 w-6" : "h-5 w-5"} />
                </div>
                <InlineText
                  as="h3"
                  value={tile.title}
                  onUpdate={onFieldChange ? (v) => updateTile(i, { title: v }) : undefined}
                  className={`font-bold ${isHero ? "text-xl" : "text-lg"}`}
                  style={{ color: "#171717", fontFamily: DISPLAY }} />
                <InlineText
                  as="p"
                  value={tile.description}
                  onUpdate={onFieldChange ? (v) => updateTile(i, { description: v }) : undefined}
                  className={`mt-2 ${isHero ? "max-w-md" : ""}`}
                  style={{ color: "#525252", fontFamily: BODY }}
                  multiline />
              </div>
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
                    source="benefits-bento-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold"
                    style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                  >
                    {props.ctaPrimaryLabel || "Get started"}
                    <ArrowRight className="h-4 w-4" />
                  </CtaButton>
                )}
                {(props.ctaSecondaryLabel || onFieldChange) && (
                  <CtaButton
                    ctaAction="url"
                    ctaUrl={props.ctaSecondaryUrl}
                    brand={brand}
                    source="benefits-bento-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
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
