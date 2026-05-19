import { Check, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { GradientPricingBlockProps } from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: GradientPricingBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GradientPricingBlockProps) => void;
}

export function BlockGradientPricing({ props, brand, onFieldChange }: Props) {
  const accent = props.accentColor || brand.accentColor || "#A78BFA";
  const from = props.gradientFrom || "#0B0B1A";
  const to = props.gradientTo || "#1F1147";
  const field = (key: keyof GradientPricingBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GradientPricingBlockProps[typeof key] }) : undefined;
  const updateTier = onFieldChange
    ? (i: number, patch: Partial<GradientPricingBlockProps["tiers"][number]>) =>
        onFieldChange({ ...props, tiers: props.tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t) })
    : undefined;
  const updateFeature = onFieldChange
    ? (i: number, fi: number, value: string) => {
        const t = props.tiers[i];
        const features = t.features.map((f, j) => (j === fi ? value : f));
        onFieldChange({ ...props, tiers: props.tiers.map((tt, idx) => idx === i ? { ...tt, features } : tt) });
      }
    : undefined;

  return (
    <section
      className="relative overflow-hidden font-sans text-white"
      style={{
        background: `radial-gradient(120% 80% at 0% 0%, ${to} 0%, ${from} 60%, ${from} 100%)`,
      }}
    >
      {/* Soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] rounded-full blur-3xl"
        style={{ backgroundColor: accent, opacity: 0.15 }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-20">
          {props.eyebrow && (
            <div
              className="text-[11px] uppercase tracking-[0.28em] font-semibold mb-4"
              style={{ color: accent }}
            >
              <InlineText as="span" value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
            </div>
          )}
          <h2
            className="font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)", fontFamily: DISPLAY }}
          >
            <InlineText as="span" value={props.headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
          </h2>
          {props.subheadline && (
            <p className="text-base lg:text-lg text-white/70 mt-4 leading-relaxed" style={{ fontFamily: BODY }}>
              <InlineText as="span" value={props.subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {props.tiers.map((tier, i) => {
            const featured = !!tier.featured;
            return (
              <div
                key={i}
                className={cn(
                  "relative rounded-3xl p-8 lg:p-10 flex flex-col",
                  featured ? "lg:-my-4" : "",
                )}
                style={{
                  background: featured
                    ? `linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${featured ? accent : "rgba(255,255,255,0.08)"}`,
                  boxShadow: featured ? `0 30px 80px -30px ${accent}66` : undefined,
                }}
              >
                {tier.badge && featured && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.22em] font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: accent, color: "#0A0A0A" }}
                  >
                    <InlineText as="span" value={tier.badge} onUpdate={updateTier ? (v) => updateTier(i, { badge: v }) : undefined} style={{ fontFamily: BODY }}/>
                  </div>
                )}
                <div className="text-sm font-semibold uppercase tracking-widest text-white/60">
                  <InlineText as="span" value={tier.name} onUpdate={updateTier ? (v) => updateTier(i, { name: v }) : undefined} style={{ fontFamily: BODY }}/>
                </div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-bold leading-none" style={{ ...{fontSize: "clamp(2.5rem, 4vw, 3.75rem)"}, ...{fontFamily: BODY} }}>
                    <InlineText as="span" value={tier.price} onUpdate={updateTier ? (v) => updateTier(i, { price: v }) : undefined} style={{ fontFamily: BODY }}/>
                  </span>
                  {tier.period && (
                    <span className="text-white/50 text-base" style={{ fontFamily: BODY }}>
                      <InlineText as="span" value={tier.period} onUpdate={updateTier ? (v) => updateTier(i, { period: v }) : undefined} style={{ fontFamily: BODY }}/>
                    </span>
                  )}
                </div>
                {tier.description && (
                  <p className="text-sm text-white/65 mt-3 leading-relaxed" style={{ fontFamily: BODY }}>
                    <InlineText as="span" value={tier.description} onUpdate={updateTier ? (v) => updateTier(i, { description: v }) : undefined} multiline style={{ fontFamily: BODY }}/>
                  </p>
                )}
                <ul className="mt-6 space-y-3 flex-1">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-white/85" style={{ fontFamily: BODY }}>
                      <Check
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: accent }}
                      />
                      <span style={{ fontFamily: BODY }}>
                        <InlineText
                          as="span"
                          value={f}
                          onUpdate={updateFeature ? (v) => updateFeature(i, j, v) : undefined}
                        style={{ fontFamily: BODY }}/>
                      </span>
                    </li>
                  ))}
                </ul>
                {onFieldChange ? (
                  <span className={cn( "mt-8 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold", )} style={{ ...(featured ? { backgroundColor: accent, color: "#0A0A0A" } : { backgroundColor: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.16)", }), ...{fontFamily: BODY} }}>
                    <InlineText as="span" value={tier.ctaText} onUpdate={updateTier ? (v) => updateTier(i, { ctaText: v }) : undefined} style={{ fontFamily: BODY }}/>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                ) : (
                  <a
                    href={tier.ctaUrl || "#"}
                    className={cn(
                      "mt-8 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold transition-transform hover:-translate-y-0.5",
                    )}
                    style={
                      featured
                        ? { backgroundColor: accent, color: "#0A0A0A" }
                        : {
                            backgroundColor: "rgba(255,255,255,0.08)",
                            color: "#FFFFFF",
                            border: "1px solid rgba(255,255,255,0.16)",
                          }
                    }
                  >
                    {tier.ctaText}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
