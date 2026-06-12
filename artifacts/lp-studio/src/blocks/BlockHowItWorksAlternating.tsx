import { LayoutTemplate, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { IconOrImage } from "@/lib/icon-value";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { HowItWorksAlternatingBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk } from "@/lib/section-ink";

/* ----------------------------------------------------------------------------
 * How It Works — Alternating Showcase (2026 redesign)
 *
 * Editorial zigzag: each step pairs copy with a real product image (rounded,
 * ring, soft shadow) and an oversized ghost step-numeral set in the display
 * font behind the content at low accent opacity. Rows alternate direction and
 * use varied vertical rhythm so the section reads like an article spread, not
 * a template. All color is brand-derived; reveals are disabled in the builder
 * and under prefers-reduced-motion.
 * -------------------------------------------------------------------------- */

interface Props {
  props: HowItWorksAlternatingBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HowItWorksAlternatingBlockProps) => void;
}

export function BlockHowItWorksAlternating({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FAFAF8", brand);
  const dark = surface.isDark;
  const ink = resolveSectionInk(props, surface);
  const text = ink.text;
  const accent = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  // Accent painted on the section surface — contrast-guarded so a brand whose
  // accent ≈ its background never renders invisible chrome.
  const accentInk = pickContrastingColor(accent, surface.base, [primary, text], 3.0);
  const eyebrowColor = pickContrastingColor(accent, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const onAccent = pickContrastingColor(undefined, accentInk, ["#FFFFFF", "#0f172a"]);
  const muted = ink.muted;
  const hairline = ink.hairline;
  const showCta = props.showCta ?? true;
  const isBuilder = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const animate = !isBuilder && !reduced;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const steps = props.steps ?? [];

  const update = <K extends keyof HowItWorksAlternatingBlockProps>(key: K, value: HowItWorksAlternatingBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateStep = (i: number, patch: Partial<HowItWorksAlternatingBlockProps["steps"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 sm:py-24 lg:px-8 lg:py-32"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {/* ── Editorial header: left-aligned, hairline underscore ── */}
        <div className="mb-16 max-w-2xl sm:mb-20 lg:mb-24">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.26em]"
              style={{ color: eyebrowColor, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
            className="font-bold tracking-tight"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 4vw, 3.25rem)", lineHeight: 1.08 }}
            multiline />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-5 max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        {/* ── Zigzag rows with varied vertical rhythm ── */}
        <div className="flex flex-col">
          {steps.map((step, index) => {
            const isReversed = index % 2 !== 0;
            const numeral = String(index + 1).padStart(2, "0");
            const hasImage = !!step.image?.trim();
            return (
              <motion.div
                key={index}
                className={`flex flex-col items-center gap-10 sm:gap-12 lg:gap-20 ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"}`}
                style={{ marginTop: index === 0 ? 0 : isReversed ? "clamp(4.5rem, 9vw, 8rem)" : "clamp(3.5rem, 7vw, 6rem)" }}
                initial={animate ? { opacity: 0, y: 28 } : false}
                whileInView={animate ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, amount: 0.2 }}
                transition={animate ? { duration: 0.6, ease: [0.22, 1, 0.36, 1] } : undefined}
              >
                {/* Copy column — oversized ghost numeral behind content */}
                <div className="relative w-full lg:w-1/2">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-12 select-none font-black leading-none sm:-top-16"
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: "clamp(6.5rem, 13vw, 11rem)",
                      letterSpacing: "-0.05em",
                      color: `color-mix(in srgb, ${accentInk} 9%, transparent)`,
                      left: "-0.06em",
                    }}
                  >
                    {numeral}
                  </span>
                  <div className="relative flex flex-col items-start pt-8 sm:pt-10">
                    <div className="mb-5 flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${accentInk} 12%, transparent)`,
                          color: accentInk,
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accentInk} 18%, transparent)`,
                        }}
                        aria-hidden="true"
                      >
                        <IconOrImage value={step.icon} fallback={LayoutTemplate} className="h-5 w-5" />
                      </span>
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: eyebrowColor }}
                        aria-hidden="true"
                      >
                        Step {numeral}
                      </span>
                    </div>
                    <InlineText
                      as="h3"
                      value={step.title}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { title: v }) : undefined}
                      className="mb-4 text-2xl font-bold tracking-tight sm:text-[1.7rem]"
                      style={{ fontFamily: DISPLAY, lineHeight: 1.15 }} />
                    <InlineText
                      as="p"
                      value={step.description}
                      onUpdate={onFieldChange ? (v) => updateStep(index, { description: v }) : undefined}
                      className="mb-7 max-w-prose text-base leading-relaxed sm:text-lg"
                      style={{ color: muted, fontFamily: BODY }}
                      multiline />
                    {(step.features ?? []).length > 0 && (
                      <ul className="flex flex-col gap-3">
                        {(step.features ?? []).map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accentInk }} aria-hidden="true" />
                            <InlineText
                              as="span"
                              value={feature}
                              onUpdate={onFieldChange ? (v) => updateStep(index, { features: (step.features ?? []).map((f, fi) => (fi === i ? v : f)) }) : undefined}
                              className="text-sm leading-relaxed sm:text-base"
                              style={{ color: muted, fontFamily: BODY }} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Visual column — real image with premium frame, graceful fallback */}
                <motion.div
                  className="w-full lg:w-1/2"
                  initial={animate ? { opacity: 0, scale: 0.97 } : false}
                  whileInView={animate ? { opacity: 1, scale: 1 } : undefined}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={animate ? { duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] } : undefined}
                >
                  {hasImage || isBuilder ? (
                    <div
                      className={`relative w-full overflow-hidden rounded-2xl ring-1 ${isReversed ? "aspect-[5/4]" : "aspect-[4/3]"}`}
                      style={{
                        backgroundColor: dark ? "rgba(255,255,255,0.05)" : "rgba(11,11,15,0.04)",
                        boxShadow: dark
                          ? "0 24px 60px -24px rgba(0,0,0,0.7)"
                          : "0 1px 2px rgba(15,23,42,0.05), 0 24px 60px -28px rgba(15,23,42,0.28)",
                        ["--tw-ring-color" as string]: dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.08)",
                      }}
                    >
                      <InlineImage
                        src={step.image ?? ""}
                        alt={step.imageAlt || step.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        wrapperClassName="absolute inset-0"
                        loading="lazy"
                        focalPoint={step.imageFocal}
                        onUpdate={onFieldChange ? (src) => updateStep(index, { image: src }) : undefined}
                        onAltUpdate={onFieldChange ? (alt) => updateStep(index, { imageAlt: alt }) : undefined}
                        onFocalUpdate={onFieldChange ? (focal) => updateStep(index, { imageFocal: focal }) : undefined}
                      />
                    </div>
                  ) : (
                    /* No-image fallback: quiet accent-tinted panel with the
                       step numeral as a typographic motif — never a gray box. */
                    <div
                      aria-hidden="true"
                      className={`relative flex w-full items-end overflow-hidden rounded-2xl p-8 ring-1 ${isReversed ? "aspect-[5/4]" : "aspect-[4/3]"}`}
                      style={{
                        background: `linear-gradient(135deg, color-mix(in srgb, ${accentInk} ${dark ? 18 : 9}%, transparent), color-mix(in srgb, ${accentInk} ${dark ? 6 : 3}%, transparent))`,
                        ["--tw-ring-color" as string]: `color-mix(in srgb, ${accentInk} 22%, transparent)`,
                      }}
                    >
                      <span
                        className="select-none font-black leading-none"
                        style={{
                          fontFamily: DISPLAY,
                          fontSize: "clamp(5rem, 10vw, 8.5rem)",
                          letterSpacing: "-0.05em",
                          color: `color-mix(in srgb, ${accentInk} 30%, transparent)`,
                        }}
                      >
                        {numeral}
                      </span>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Trailing CTA band (preserved behavior) ── */}
        {showCta && (
          <div className="mt-20 border-t pt-14 sm:mt-24 sm:pt-16" style={{ borderColor: hairline }}>
            <div className="flex flex-col items-center gap-7 text-center">
              <div className="flex flex-col items-center gap-3">
                {(props.ctaEyebrow || onFieldChange) && (
                  <InlineText
                    as="span"
                    value={props.ctaEyebrow ?? ""}
                    onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                    className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                    style={{ color: eyebrowColor, fontFamily: BODY }} />
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
                    source="how-it-works-alternating-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ backgroundColor: accentInk, color: onAccent, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
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
                    source="how-it-works-alternating-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ borderColor: `color-mix(in srgb, ${text} 22%, transparent)`, color: text, fontFamily: BODY, ["--tw-ring-color" as string]: accentInk }}
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
