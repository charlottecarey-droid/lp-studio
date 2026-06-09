import { ArrowRight, Check, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasBeforeAfterBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { Reveal, SectionDecor } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { motion } from "framer-motion";

interface Props {
  props: PasBeforeAfterBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasBeforeAfterBlockProps) => void;
}

const DANGER = "#ef4444";
const EASE = [0.22, 1, 0.36, 1] as const;

export function BlockPasBeforeAfter({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const rows = props.rows ?? [];
  const isBuilder = !!onFieldChange;

  const update = <K extends keyof PasBeforeAfterBlockProps>(key: K, value: PasBeforeAfterBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateRow = (i: number, patch: Partial<PasBeforeAfterBlockProps["rows"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };

  // Surface-aware card chrome: the "before" card reads as a dimmed neutral
  // (the pain), the "after" card reads as a vibrant, brand-forward win.
  const beforeCardBg = `${ink}06`;
  const beforeBorder = `${ink}14`;
  const afterCardBg = `linear-gradient(160deg, ${accent}1a, ${accent}05)`;
  const afterBorder = `${accent}40`;
  const afterGlow = `0 26px 60px -30px ${accent}80`;

  const tileBase = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300";
  const beforeTileStyle = { background: `${DANGER}1a`, color: DANGER, boxShadow: `inset 0 0 0 1px ${DANGER}29` };
  const afterTileStyle = { background: `linear-gradient(135deg, ${accent}29, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}29` };

  const itemMotion = (i: number) => ({
    initial: isBuilder ? false : { opacity: 0, y: 10 },
    whileInView: isBuilder ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: isBuilder ? undefined : { duration: 0.4, delay: 0.1 + i * 0.06, ease: EASE },
  });

  const cardMotion = (delay: number) => ({
    initial: isBuilder ? false : { opacity: 0, y: 24 },
    whileInView: isBuilder ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: isBuilder ? undefined : { duration: 0.55, delay, ease: EASE },
  });

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <Reveal isBuilder={isBuilder} className="mx-auto mb-14 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 inline-block rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: accent, background: `${accent}14`, boxShadow: `inset 0 0 0 1px ${accent}29` }}
            />
          )}
          <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.75rem]" style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.subheading || onFieldChange) && (
            <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </Reveal>

        <div className="relative mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-8">
          {/* Before — the dimmed pain state */}
          <motion.div
            {...cardMotion(0.05)}
            className="relative h-full rounded-2xl border p-7 sm:p-8"
            style={{ borderColor: beforeBorder, background: beforeCardBg }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span className={tileBase} style={beforeTileStyle}>
                <X className="h-5 w-5 stroke-[2.5]" />
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
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${DANGER}14`, color: DANGER, boxShadow: `inset 0 0 0 1px ${DANGER}24` }}>
                    <X className="h-4 w-4 stroke-[2.5]" />
                  </span>
                  <InlineText as="span" value={r.before} onUpdate={onFieldChange ? (v) => updateRow(i, { before: v }) : undefined} className="pt-0.5 text-sm leading-relaxed" style={{ color: muted }} />
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* After — the vibrant, brand-forward win */}
          <motion.div
            {...cardMotion(0.15)}
            className="relative h-full overflow-hidden rounded-2xl border p-7 sm:p-8"
            style={{ borderColor: afterBorder, background: afterCardBg, boxShadow: afterGlow }}
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <div className="mb-6 flex items-center gap-3">
              <span className={tileBase} style={afterTileStyle}>
                <Check className="h-5 w-5 stroke-[3]" />
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
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${accent}29, ${accent}0d)`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}29` }}>
                    <Check className="h-4 w-4 stroke-[3]" />
                  </span>
                  <InlineText as="span" value={r.after} onUpdate={onFieldChange ? (v) => updateRow(i, { after: v }) : undefined} className="pt-0.5 text-sm font-medium leading-relaxed" style={{ color: ink }} />
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Center transition badge — only on desktop, never overlaps stacked mobile cards */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex">
            <span className="flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-4" style={{ background: accent, color: onAccent, "--tw-ring-color": surface.isDark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.9)" } as React.CSSProperties}>
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
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm${isBuilder ? "" : " transition-transform duration-300 hover:-translate-y-0.5"}`}
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
