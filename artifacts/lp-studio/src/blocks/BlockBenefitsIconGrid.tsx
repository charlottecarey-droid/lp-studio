import {
  Zap, Layers, TrendingUp, BarChart3, Users, ShieldCheck, CloudLightning,
  Globe2, Clock, Sparkles, ArrowRight,
} from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsIconGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;


interface Props {
  props: BenefitsIconGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsIconGridBlockProps) => void;
}

export function BlockBenefitsIconGrid({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const text = props.textColor ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const tint = `${accent}14`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const muted = pickContrastingColor(undefined, bg, ["#525252", "#a3a3a3"]);
  const showCta = props.showCta ?? true;

  const update = <K extends keyof BenefitsIconGridBlockProps>(key: K, value: BenefitsIconGridBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateItem = (i: number, patch: Partial<BenefitsIconGridBlockProps["items"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: props.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  };

  return (
    <section className="w-full px-6 py-24 sm:py-32" style={{ backgroundColor: bg, color: text }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 max-w-2xl">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="text-base font-semibold leading-7"
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
              className="mt-6 text-lg leading-8"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className={cn("grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2", (props.columns ?? 3) === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {props.items.map((item, i) => {
            return (
              <div key={i} className="flex flex-col">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: tint }}>
                  <IconOrImage value={item.icon} fallback={Zap} className="h-6 w-6" />
                </div>
                <InlineText
                  as="h3"
                  value={item.title}
                  onUpdate={onFieldChange ? (v) => updateItem(i, { title: v }) : undefined}
                  className="text-lg font-semibold leading-8"
                  style={{ fontFamily: DISPLAY }} />
                <InlineText
                  as="p"
                  value={item.description}
                  onUpdate={onFieldChange ? (v) => updateItem(i, { description: v }) : undefined}
                  className="mt-2 text-base leading-7"
                  style={{ color: muted, fontFamily: BODY }}
                  multiline />
              </div>
            );
          })}
        </div>

        {showCta && (
          <div className="mt-24 border-t pt-16" style={{ borderColor: `${text}1a` }}>
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
                    source="benefits-icon-grid-cta"
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
                    source="benefits-icon-grid-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold"
                    style={{ borderColor: `${text}33`, color: text, fontFamily: BODY }}
                  >
                    {props.ctaSecondaryLabel || "Book a demo"}
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
