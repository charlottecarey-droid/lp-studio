import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasIconGridBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { IconOrImage } from "@/lib/icon-value";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: PasIconGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasIconGridBlockProps) => void;
}

const COL_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function BlockPasIconGrid({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const items = props.items ?? [];
  const cols = props.columns ?? (items.length >= 4 ? 4 : 3);

  const update = <K extends keyof PasIconGridBlockProps>(key: K, value: PasIconGridBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });
  const updateItem = (i: number, patch: Partial<PasIconGridBlockProps["items"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  };

  return (
    <section className="w-full py-20 sm:py-28" style={{ backgroundColor: bg, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto px-6 md:px-12">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          {(props.eyebrow || onFieldChange) && (
            <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
          )}
          <InlineText as="h2" value={props.problemHeading} onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.problemBody || onFieldChange) && (
            <InlineText as="p" value={props.problemBody ?? ""} onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
          )}
        </div>
        <div className={`grid grid-cols-1 gap-6 ${COL_CLASS[cols] ?? COL_CLASS[3]}`}>
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border p-6" style={{ borderColor: `${ink}14` }}>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1A` }}>
                <IconOrImage value={it.icon} className="h-6 w-6" style={{ color: accent }} alt={it.title} />
              </div>
              <InlineText as="h3" value={it.title} onUpdate={onFieldChange ? (v) => updateItem(i, { title: v }) : undefined} className="text-lg font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
              {(it.text || onFieldChange) && (
                <InlineText as="p" value={it.text ?? ""} onUpdate={onFieldChange ? (v) => updateItem(i, { text: v }) : undefined} className="mt-2 text-sm leading-relaxed" style={{ color: muted }} multiline />
              )}
            </div>
          ))}
        </div>
        {(props.solutionHeading || props.solutionBody || props.ctaLabel || onFieldChange) && (
          <div className="mx-auto mt-14 max-w-3xl text-center">
            {(props.solutionHeading || onFieldChange) && (
              <InlineText as="h3" value={props.solutionHeading ?? ""} onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined} className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: ink, fontFamily: DISPLAY }} />
            )}
            {(props.solutionBody || onFieldChange) && (
              <InlineText as="p" value={props.solutionBody ?? ""} onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined} className="mt-4 text-lg leading-relaxed" style={{ color: muted }} multiline />
            )}
            {(props.ctaLabel || onFieldChange) && (
              <div className="mt-8">
                <CtaButton
                  {...pickCtaModalConfig(props)}
                  ctaAction={props.ctaAction ?? "url"}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  videoUrl={props.videoUrl}
                  videoPosterUrl={props.videoPosterUrl}
                  brand={brand}
                  source="pas-icon-grid-cta"
                  className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
                  style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
                >
                  {props.ctaLabel || "Get started"}
                </CtaButton>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
