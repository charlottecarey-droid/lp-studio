import { Check, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasBeforeAfterBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { RevealStagger, RevealItem } from "@/lib/premium-toolkit";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: PasBeforeAfterBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasBeforeAfterBlockProps) => void;
}

export function BlockPasBeforeAfter({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const rows = props.rows ?? [];

  const update = <K extends keyof PasBeforeAfterBlockProps>(key: K, value: PasBeforeAfterBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateRow = (i: number, patch: Partial<PasBeforeAfterBlockProps["rows"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="container relative z-10 mx-auto px-6 md:px-12">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
          )}
          <InlineText as="h2" value={props.heading} onUpdate={onFieldChange ? (v) => update("heading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.subheading || onFieldChange) && (
            <InlineText as="p" value={props.subheading ?? ""} onUpdate={onFieldChange ? (v) => update("subheading", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </div>
        {(() => {
          const gridClass = "mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2";
          const beforeCard = (
            <div className="h-full rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ borderColor: `${ink}14`, backgroundColor: `${ink}08` }}>
              <InlineText as="h3" value={props.beforeTitle ?? "Before"} onUpdate={onFieldChange ? (v) => update("beforeTitle", v) : undefined} className="mb-5 text-lg font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
              <ul className="space-y-3">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <X className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
                    <InlineText as="span" value={r.before} onUpdate={onFieldChange ? (v) => updateRow(i, { before: v }) : undefined} className="text-sm leading-relaxed" style={{ color: muted }} />
                  </li>
                ))}
              </ul>
            </div>
          );
          const afterCard = (
            <div className="h-full rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0F` }}>
              <InlineText as="h3" value={props.afterTitle ?? "After"} onUpdate={onFieldChange ? (v) => update("afterTitle", v) : undefined} className="mb-5 text-lg font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
              <ul className="space-y-3">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
                    <InlineText as="span" value={r.after} onUpdate={onFieldChange ? (v) => updateRow(i, { after: v }) : undefined} className="text-sm leading-relaxed" style={{ color: ink }} />
                  </li>
                ))}
              </ul>
            </div>
          );
          return onFieldChange ? (
            <div className={gridClass}>
              <div>{beforeCard}</div>
              <div>{afterCard}</div>
            </div>
          ) : (
            <RevealStagger className={gridClass}>
              <RevealItem>{beforeCard}</RevealItem>
              <RevealItem>{afterCard}</RevealItem>
            </RevealStagger>
          );
        })()}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-12 text-center">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="pas-before-after-cta"
              className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          </div>
        )}
      </div>
    </section>
  );
}
