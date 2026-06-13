import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, isValidHex } from "@/lib/brand-config";
import type { SingleQuoteBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { Reveal } from "@/lib/premium-toolkit";
import { cn } from "@/lib/utils";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/* ----------------------------------------------------------------------------
 * Single Quote — one statement testimonial. Oversized display-font quote with
 * a hanging accent quotation mark, a tight attribution row (avatar photo →
 * initials fallback, name/role stack, optional company logo), and an optional
 * soft accent tint panel. Two layouts: "centered" statement (default) and an
 * asymmetric "split" (quote left, attribution rail right). The trailing CTA
 * band is compact — no dead vertical space below the attribution.
 * -------------------------------------------------------------------------- */

interface Props {
  props: SingleQuoteBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SingleQuoteBlockProps) => void;
}

/** "Maya Chen" → "MC"; single word → first letter; empty → "•". */
function initialsOf(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function BlockSingleQuote({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#0F172A";
  // Brand-derived accent: panel override → brand accent → brand primary.
  const accent = props.accentColor ?? brand.accentColor ?? brand.primaryColor ?? "#0F172A";
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const border = `color-mix(in srgb, ${text} 12%, transparent)`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0f172a"]);
  const showCta = props.showCta ?? true;
  const reduce = useReducedMotion() ?? false;
  const animate = !onFieldChange && !reduce;
  const split = props.layout === "split";
  // A valid `cardBgColor` override turns the quote into a solid card (even when
  // `tintPanel` is false). The in-panel ink derives from the chosen surface so
  // a custom card color stays readable; the CTA band below keeps section ink.
  const cardOverride =
    props.cardBgColor && (isValidHex(props.cardBgColor) || props.cardBgColor.startsWith("var("))
      ? props.cardBgColor
      : undefined;
  const tintPanel = props.tintPanel === true || cardOverride !== undefined;
  // Ink used INSIDE the panel: derived from the override when set, else the
  // section ink (preserving the historical tint-panel-over-section behavior).
  const panelText = cardOverride ? pickContrastingColor(props.textColor, cardOverride, ["#0F172A", "#F8FAFC"]) : text;
  const panelMuted = cardOverride ? pickContrastingColor(undefined, cardOverride, ["#64748B", "#94A3B8"]) : muted;
  const panelBorder = cardOverride ? `color-mix(in srgb, ${panelText} 12%, transparent)` : border;
  const panelDark = cardOverride ? pickContrastingColor(undefined, cardOverride, ["#0F172A", "#F8FAFC"]) === "#F8FAFC" : surface.isDark;

  const update = <K extends keyof SingleQuoteBlockProps>(key: K, value: SingleQuoteBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  /** Avatar: photo when provided (inline-replaceable in the builder), else an
   *  accent-tinted initials circle. */
  const avatar = props.avatarUrl ? (
    <InlineImage
      src={props.avatarUrl}
      alt={`${props.author} portrait`}
      onUpdate={onFieldChange ? (url) => update("avatarUrl", url) : undefined}
      className="h-12 w-12 shrink-0 rounded-full object-cover"
      wrapperClassName="shrink-0"
      style={{ border: `1px solid ${panelBorder}` }}
      loading="lazy"
    />
  ) : (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{
        background: `color-mix(in srgb, ${accent} ${panelDark ? "26%" : "12%"}, transparent)`,
        color: panelDark ? panelText : accent,
        fontFamily: BODY,
      }}
    >
      {props.avatarInitials || initialsOf(props.author)}
    </span>
  );

  const attribution = (
    <div className={cn("flex items-center gap-3.5", split ? "" : "justify-center")}>
      {avatar}
      <span className="flex min-w-0 flex-col text-left">
        <InlineText
          as="span"
          value={props.author}
          onUpdate={onFieldChange ? (v) => update("author", v) : undefined}
          className="text-base font-semibold leading-tight"
          style={{ color: panelText, fontFamily: BODY }}
        />
        <span className="mt-0.5 text-sm leading-tight" style={{ color: panelMuted, fontFamily: BODY }}>
          <InlineText
            as="span"
            value={props.role}
            onUpdate={onFieldChange ? (v) => update("role", v) : undefined}
            className="inline"
            style={{ color: panelMuted }}
          />
          {" · "}
          <InlineText
            as="span"
            value={props.company}
            onUpdate={onFieldChange ? (v) => update("company", v) : undefined}
            className="inline font-medium"
            style={{ color: panelMuted }}
          />
        </span>
      </span>
      {props.companyLogoUrl && (
        <img
          src={props.companyLogoUrl}
          alt={`${props.company} logo`}
          loading="lazy"
          className={cn("ml-3 h-6 w-auto max-w-[110px] shrink-0 object-contain", panelDark ? "opacity-80" : "opacity-60")}
        />
      )}
    </div>
  );

  // Hanging oversized quotation mark in accent at low opacity.
  const quoteMark = (
    <span
      aria-hidden
      className={cn("pointer-events-none block select-none leading-[0.55]", split ? "" : "mx-auto")}
      style={{
        fontFamily: DISPLAY,
        fontSize: "clamp(4.5rem, 9vw, 7rem)",
        color: accent,
        opacity: panelDark ? 0.4 : 0.22,
      }}
    >
      &ldquo;
    </span>
  );

  const quote = (
    <InlineText
      as="blockquote"
      value={props.quote}
      onUpdate={onFieldChange ? (v) => update("quote", v) : undefined}
      className={cn(
        "text-balance font-medium tracking-tight",
        split ? "text-left" : "mx-auto max-w-3xl text-center",
      )}
      style={{
        color: panelText,
        fontFamily: DISPLAY,
        fontSize: split ? "clamp(1.75rem, 4vw, 2.75rem)" : "clamp(1.625rem, 3.6vw, 2.5rem)",
        lineHeight: 1.18,
      }}
      multiline
    />
  );

  const panelStyle: React.CSSProperties = cardOverride
    ? {
        background: cardOverride,
        border: `1px solid ${panelBorder}`,
        boxShadow: `0 1px 2px color-mix(in srgb, ${panelText} 4%, transparent), 0 24px 56px -32px color-mix(in srgb, ${panelText} 30%, transparent)`,
      }
    : tintPanel
    ? {
        background: `color-mix(in srgb, ${accent} ${surface.isDark ? "10%" : "5%"}, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} ${surface.isDark ? "26%" : "14%"}, transparent)`,
      }
    : {};

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-16 sm:px-10 sm:py-20 md:py-24"
      style={{ background: surface.background, color: text }}
    >
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <Reveal disabled={!animate}>
          <figure
            className={cn(tintPanel && "rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12 md:px-14 md:py-14")}
            style={panelStyle}
          >
            {split ? (
              /* ── Asymmetric: quote left, attribution rail right ── */
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
                <div className="lg:col-span-8">
                  {quoteMark}
                  <div className="mt-1">{quote}</div>
                </div>
                <figcaption className="flex lg:col-span-4 lg:items-end">
                  <div
                    className="flex flex-col gap-4 border-t pt-6 lg:w-full lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
                    style={{ borderColor: `color-mix(in srgb, ${accent} 30%, transparent)` }}
                  >
                    {attribution}
                  </div>
                </figcaption>
              </div>
            ) : (
              /* ── Centered statement ── */
              <div className="flex flex-col items-center text-center">
                {quoteMark}
                <div className="mt-1">{quote}</div>
                <figcaption className="mt-8">{attribution}</figcaption>
              </div>
            )}
          </figure>
        </Reveal>

        {showCta && (
          <Reveal disabled={!animate} delay={0.1}>
            <div className="mt-12 border-t pt-10 sm:mt-14" style={{ borderColor: border }}>
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex flex-col items-center gap-2.5">
                  {(props.ctaEyebrow || onFieldChange) && (
                    <InlineText
                      as="span"
                      value={props.ctaEyebrow ?? ""}
                      onUpdate={onFieldChange ? (v) => update("ctaEyebrow", v) : undefined}
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: accent, fontFamily: BODY }} />
                  )}
                  {(props.ctaHeading || onFieldChange) && (
                    <InlineText
                      as="h3"
                      value={props.ctaHeading ?? ""}
                      onUpdate={onFieldChange ? (v) => update("ctaHeading", v) : undefined}
                      className="text-2xl font-bold tracking-tight md:text-3xl"
                      style={{ color: text, fontFamily: DISPLAY }} />
                  )}
                  {(props.ctaSubheading || onFieldChange) && (
                    <InlineText
                      as="p"
                      value={props.ctaSubheading ?? ""}
                      onUpdate={onFieldChange ? (v) => update("ctaSubheading", v) : undefined}
                      className="max-w-xl text-base leading-relaxed"
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
                      source="single-quote-cta"
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-sm transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
                        focusRing,
                      )}
                      style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY, outlineColor: accent }}
                    >
                      {props.ctaPrimaryLabel || "Get started"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </CtaButton>
                  )}
                  {(props.ctaSecondaryLabel || onFieldChange) && (
                    <CtaButton
                      ctaAction="url"
                      ctaUrl={props.ctaSecondaryUrl}
                      brand={brand}
                      source="single-quote-cta-secondary"
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-base font-semibold transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
                        focusRing,
                      )}
                      style={{ borderColor: `color-mix(in srgb, ${text} 22%, transparent)`, color: text, fontFamily: BODY, outlineColor: accent }}
                    >
                      {props.ctaSecondaryLabel || "Talk to sales"}
                    </CtaButton>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
