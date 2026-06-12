import { ArrowRight, Check, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  pickCtaButtonColors,
} from "@/lib/brand-config";
import type { PasBeforeAfterBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { Reveal } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { motion, useReducedMotion } from "framer-motion";

/* ----------------------------------------------------------------------------
 * PAS — Before/After: a split comparison with real visual contrast. The
 * "before" panel is muted and desaturated (its optional image renders
 * grayscale); the "after" panel is accent-tinted and elevated with a
 * full-color image. An arrow badge bridges the two on desktop.
 * -------------------------------------------------------------------------- */

interface Props {
  props: PasBeforeAfterBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasBeforeAfterBlockProps) => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function BlockPasBeforeAfter({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const base = surface.base;
  const ink = props.textColor ?? surface.color ?? pickContrastingColor(undefined, base, ["#0f172a", "#ffffff"]);
  const accentPref =
    props.accentColor && isValidHex(props.accentColor) ? props.accentColor : undefined;
  const accentRaw =
    accentPref ?? (isValidHex(brand.accentColor) ? brand.accentColor : brand.primaryColor);
  const accent = pickContrastingColor(accentRaw, base, [brand.primaryColor, ink], 3.0);
  const muted = `color-mix(in srgb, ${ink} 62%, transparent)`;
  const cta = accentPref
    ? (() => {
        const bg = pickContrastingColor(accentPref, base, [brand.accentColor, brand.primaryColor], 3.0);
        return { bg, text: pickContrastingColor(brand.ctaText, bg, [contrastTextColor(bg)], 4.5) };
      })()
    : pickCtaButtonColors(brand, base);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const rows = props.rows ?? [];
  const isBuilder = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  // Entrance reveals render static in the builder and under
  // prefers-reduced-motion (matches the sibling redesigned blocks).
  const still = isBuilder || reduced;

  const update = <K extends keyof PasBeforeAfterBlockProps>(key: K, value: PasBeforeAfterBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateRow = (i: number, patch: Partial<PasBeforeAfterBlockProps["rows"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };

  // The "before" card reads as a dimmed, desaturated neutral (the pain); the
  // "after" card reads as an elevated, brand-tinted win. Every tone derives
  // from the section ink or the brand accent — nothing hardcoded.
  const beforeCardBg = `color-mix(in srgb, ${ink} 4%, transparent)`;
  const beforeBorder = `color-mix(in srgb, ${ink} 11%, transparent)`;
  const afterCardBg = `linear-gradient(160deg, color-mix(in srgb, ${accentRaw} 11%, transparent), color-mix(in srgb, ${accentRaw} 3%, transparent))`;
  const afterBorder = `color-mix(in srgb, ${accentRaw} 32%, transparent)`;
  const afterGlow = `0 28px 64px -32px color-mix(in srgb, ${accentRaw} 55%, transparent)`;

  const tileBase = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";
  const beforeTileStyle = {
    background: `color-mix(in srgb, ${ink} 8%, transparent)`,
    color: muted,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 14%, transparent)`,
  };
  const afterTileStyle = {
    background: `color-mix(in srgb, ${accent} 14%, transparent)`,
    color: accent,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 26%, transparent)`,
  };

  const itemMotion = (i: number) => ({
    initial: still ? false : { opacity: 0, y: 10 },
    whileInView: still ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: still ? undefined : { duration: 0.4, delay: 0.1 + i * 0.06, ease: EASE },
  });

  const cardMotion = (delay: number) => ({
    initial: still ? false : { opacity: 0, y: 24 },
    whileInView: still ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: still ? undefined : { duration: 0.55, delay, ease: EASE },
  });

  const sideImage = (side: "before" | "after") => {
    const url = side === "before" ? props.beforeImageUrl : props.afterImageUrl;
    if (!url) return null;
    const alt = (side === "before" ? props.beforeImageAlt : props.afterImageAlt) || "";
    return (
      <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl">
        <InlineImage
          src={url}
          alt={alt}
          className={`h-full w-full object-cover${side === "before" ? " opacity-80 grayscale" : ""}`}
          wrapperClassName="block h-full w-full"
          loading="lazy"
          onUpdate={
            onFieldChange
              ? (src) => update(side === "before" ? "beforeImageUrl" : "afterImageUrl", src)
              : undefined
          }
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" />
      </div>
    );
  };

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accentRaw} 10%, transparent), transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <Reveal isBuilder={isBuilder} className="mx-auto mb-14 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 inline-block text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: accent }}
            />
          )}
          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
            className="text-balance font-bold leading-[1.06] tracking-tight"
            style={{ color: ink, fontFamily: DISPLAY, fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}
          />
          {(props.subheading || onFieldChange) && (
            <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </Reveal>

        <div className="relative mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-8">
          {/* Before — the dimmed, desaturated pain state */}
          <motion.div
            {...cardMotion(0.05)}
            className="relative h-full rounded-2xl border p-7 sm:p-8"
            style={{ borderColor: beforeBorder, background: beforeCardBg }}
          >
            {sideImage("before")}
            <div className="mb-6 flex items-center gap-3">
              <span className={tileBase} style={beforeTileStyle}>
                <X className="h-5 w-5 stroke-[2.5]" aria-hidden />
              </span>
              <InlineText
                as="h3"
                value={props.beforeTitle ?? "Before"}
                onUpdate={onFieldChange ? (v) => update("beforeTitle", v) : undefined}
                className="text-lg font-bold"
                style={{ color: muted, fontFamily: DISPLAY }}
              />
            </div>
            <ul className="space-y-3.5">
              {rows.map((r, i) => (
                <motion.li key={i} {...itemMotion(i)} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${ink} 7%, transparent)`,
                      color: muted,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 12%, transparent)`,
                    }}
                  >
                    <X className="h-4 w-4 stroke-[2.5]" aria-hidden />
                  </span>
                  <InlineText as="span" value={r.before} onUpdate={onFieldChange ? (v) => updateRow(i, { before: v }) : undefined} className="pt-0.5 text-sm leading-relaxed" style={{ color: muted }} />
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* After — the elevated, brand-tinted win */}
          <motion.div
            {...cardMotion(0.15)}
            className="relative h-full overflow-hidden rounded-2xl border p-7 sm:p-8"
            style={{ borderColor: afterBorder, background: afterCardBg, boxShadow: afterGlow }}
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            {sideImage("after")}
            <div className="mb-6 flex items-center gap-3">
              <span className={tileBase} style={afterTileStyle}>
                <Check className="h-5 w-5 stroke-[3]" aria-hidden />
              </span>
              <InlineText
                as="h3"
                value={props.afterTitle ?? "After"}
                onUpdate={onFieldChange ? (v) => update("afterTitle", v) : undefined}
                className="text-lg font-bold"
                style={{ color: accent, fontFamily: DISPLAY }}
              />
            </div>
            <ul className="space-y-3.5">
              {rows.map((r, i) => (
                <motion.li key={i} {...itemMotion(i)} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${accent} 13%, transparent)`,
                      color: accent,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 24%, transparent)`,
                    }}
                  >
                    <Check className="h-4 w-4 stroke-[3]" aria-hidden />
                  </span>
                  <InlineText as="span" value={r.after} onUpdate={onFieldChange ? (v) => updateRow(i, { after: v }) : undefined} className="pt-0.5 text-sm font-medium leading-relaxed" style={{ color: ink }} />
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Center transition badge — desktop only, never overlaps stacked mobile cards */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-4"
              style={{
                background: cta.bg,
                color: cta.text,
                "--tw-ring-color": surface.isDark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.9)",
              } as React.CSSProperties}
            >
              <ArrowRight className="h-5 w-5 stroke-[2.5]" />
            </span>
          </div>
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <Reveal isBuilder={isBuilder} className="mt-12 text-center">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="pas-before-after-cta"
              className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold transition-transform motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
              style={{
                backgroundColor: cta.bg,
                color: cta.text,
                fontFamily: BODY,
                outlineColor: accent,
                boxShadow: `0 16px 40px -16px color-mix(in srgb, ${cta.bg} 55%, transparent)`,
              }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
