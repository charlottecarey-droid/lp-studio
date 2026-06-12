import { Zap, ArrowRight } from "lucide-react";
import { IconOrImage } from "@/lib/icon-value";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { BenefitsIconGridBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { resolveSectionInk, ensureAccentRegisters } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { motion, useReducedMotion } from "framer-motion";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Benefits — Icon Grid: the compact, crisp benefits layout. Small
 * accent-tinted icon chips, a tight 2/3-column grid, and an optional
 * hairline-divider treatment (`divided`) that draws a fine cell grid instead
 * of open whitespace — no heavy cards. Subtle chip hover (transition only —
 * disabled under reduced motion); scroll reveals off in the builder.
 * -------------------------------------------------------------------------- */

interface Props {
  props: BenefitsIconGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BenefitsIconGridBlockProps) => void;
}

export function BlockBenefitsIconGrid({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const isBuilder = !!onFieldChange;
  const still = isBuilder || reduced;

  const surface = resolveSectionSurface(props, "#FFFFFF", brand);
  const dark = surface.isDark;
  const { text, muted, hairline } = resolveSectionInk(props, surface);
  const accentRaw = props.accentColor || brand.accentColor || brand.primaryColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accent = pickContrastingColor(accentRaw, surface.base, [primary], 3.0);
  const eyebrowColor = pickContrastingColor(accentRaw, surface.base, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;
  const divided = props.divided === true;
  const threeCols = (props.columns ?? 3) === 3;
  const splitHeader = (props.headerLayout ?? "stacked") === "split";
  const filledIcons = (props.iconStyle ?? "tint") === "filled";
  // Icon-chip accent with a saturation floor: a pastel brand accent at 11–16%
  // alpha is invisible on a light surface, so deepen it (hue-preserving) until
  // it registers, instead of swapping to a different brand color.
  const chipAccent = ensureAccentRegisters(accentRaw, surface, 1.4);
  // The glyph needs real contrast against the surface showing through the tint.
  const chipGlyph = pickContrastingColor(chipAccent, surface.base, [accent, primary], 3.0);
  const onChip = pickContrastingColor(undefined, chipAccent, ["#FFFFFF", "#0f172a"]);

  /* Last-row balancing: when items don't fill the final row, either center the
   * remainder (open grid — via doubled column tracks + col-start math) or
   * stretch the remainder to fill the row (divided grid — keeps the hairline
   * cell matrix a perfect rectangle). No lonely bottom-left orphan either way.
   * Track math: sm renders 2 cells across 4 tracks; lg renders 3 cells across
   * 6 tracks (columns=3) or 2 cells across 4 tracks (columns=2). */
  const count = props.items.length;
  const itemPlacement = (i: number): string => {
    const last = i === count - 1;
    const cls: string[] = [];
    const smCentered = count % 2 === 1 && last;
    if (smCentered) cls.push(divided ? "sm:col-span-4" : "sm:col-span-2 sm:col-start-2");
    else cls.push("sm:col-span-2");
    let lgHasStart = false;
    if (threeCols) {
      const r = count % 3;
      if (r === 1 && last) {
        if (divided) cls.push("lg:col-span-6");
        else { cls.push("lg:col-span-2 lg:col-start-3"); lgHasStart = true; }
      } else if (r === 2 && i === count - 2 && !divided) {
        // First of the trailing pair starts one track in; the last item then
        // auto-flows beside it → the pair is centered.
        cls.push("lg:col-span-2 lg:col-start-2");
        lgHasStart = true;
      } else if (r === 2 && i >= count - 2 && divided) {
        cls.push("lg:col-span-3");
      } else {
        cls.push("lg:col-span-2");
      }
    } else {
      if (count % 2 === 1 && last) {
        if (divided) cls.push("lg:col-span-4");
        else { cls.push("lg:col-span-2 lg:col-start-2"); lgHasStart = true; }
      } else {
        cls.push("lg:col-span-2");
      }
    }
    // An sm-level col-start must not leak into the lg grid unchanged.
    if (smCentered && !divided && !lgHasStart) cls.push("lg:col-start-auto");
    return cls.join(" ");
  };

  const update = <K extends keyof BenefitsIconGridBlockProps>(key: K, value: BenefitsIconGridBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateItem = (i: number, patch: Partial<BenefitsIconGridBlockProps["items"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: props.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-16 sm:py-20 lg:px-10"
      style={{ background: surface.background, color: text, fontFamily: BODY }}
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        {/* ── Header: stacked single column, or a split composition that fills
             the top-right with the subheadline column on lg. ── */}
        <div className={cn("mb-12 lg:mb-14", splitHeader ? "lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-12" : "max-w-2xl")}>
          <div className={cn(splitHeader && "lg:col-span-7")}>
            {(props.eyebrow || onFieldChange) && (
              <InlineText
                as="p"
                value={props.eyebrow ?? ""}
                onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
                className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em]"
                style={{ color: eyebrowColor }} />
            )}
            <InlineText
              as="h2"
              value={props.headline}
              onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
              className="font-bold tracking-tight"
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.75rem, 3.4vw, 2.5rem)", lineHeight: 1.12 }}
              multiline />
          </div>
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className={cn(
                "mt-3.5 text-base leading-relaxed",
                splitHeader ? "max-w-2xl lg:col-span-5 lg:mt-0 lg:max-w-md lg:justify-self-end lg:text-right" : "",
              )}
              style={{ color: muted }}
              multiline />
          )}
        </div>

        {/* ── Tight grid — open whitespace, or fine hairline dividers. Column
             tracks are doubled (2 tracks per cell) so a partial last row can be
             centered with col-start math instead of leaving an orphan. ── */}
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-4",
            threeCols ? "lg:grid-cols-6" : "lg:grid-cols-4",
            divided ? "border-t border-l" : count >= 5 ? "gap-x-10 gap-y-9" : "gap-x-10 gap-y-12",
          )}
          style={divided ? { borderColor: hairline } : undefined}
        >
          {props.items.map((item, i) => (
            <motion.div
              key={i}
              className={cn("group flex flex-col", itemPlacement(i), divided && "border-b border-r p-6 sm:p-7")}
              style={divided ? { borderColor: hairline } : undefined}
              initial={still ? false : { opacity: 0, y: 14 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={still ? undefined : { duration: 0.45, delay: Math.min(i * 0.06, 0.36), ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 motion-reduce:transition-none"
                style={
                  filledIcons
                    ? { backgroundColor: chipAccent, color: onChip }
                    : {
                        backgroundColor: `color-mix(in srgb, ${chipAccent} 14%, transparent)`,
                        color: chipGlyph,
                      }
                }
                aria-hidden="true"
              >
                <IconOrImage value={item.icon} fallback={Zap} className="h-5 w-5" />
              </div>
              <InlineText
                as="h3"
                value={item.title}
                onUpdate={onFieldChange ? (v) => updateItem(i, { title: v }) : undefined}
                className="text-[15px] font-semibold leading-snug tracking-tight sm:text-base"
                style={{ fontFamily: DISPLAY }} />
              <InlineText
                as="p"
                value={item.description}
                onUpdate={onFieldChange ? (v) => updateItem(i, { description: v }) : undefined}
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: muted }}
                multiline />
            </motion.div>
          ))}
        </div>

        {/* ── Trailing CTA band. ── */}
        {showCta && (
          <div className="mt-16 border-t pt-12 lg:mt-20" style={{ borderColor: hairline }}>
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
                    source="benefits-icon-grid-cta"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: accent, color: onAccent, outlineColor: accent }}
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
                    source="benefits-icon-grid-cta-secondary"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: `${text}33`, color: text, outlineColor: accent }}
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
