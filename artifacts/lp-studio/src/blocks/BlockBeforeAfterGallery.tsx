import type { BrandConfig } from "@/lib/brand-config";
import type { BeforeAfterGalleryBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: BeforeAfterGalleryBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: BeforeAfterGalleryBlockProps) => void;
}

export function BlockBeforeAfterGallery({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const text = props.textColor ?? "#0B0B0C";
  const accent = props.accentColor ?? brand.primaryColor ?? "#0B6B3A";
  const beforeLabel = props.beforeLabel ?? "Before";
  const afterLabel = props.afterLabel ?? "After";

  const updateField = <K extends keyof BeforeAfterGalleryBlockProps>(
    key: K,
    value: BeforeAfterGalleryBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updatePair = (i: number, patch: Partial<BeforeAfterGalleryBlockProps["pairs"][number]>) => {
    if (!onFieldChange) return;
    const next = props.pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onFieldChange({ ...props, pairs: next });
  };

  return (
    <section className="px-6 py-20 sm:py-28" style={{ backgroundColor: bg, color: text }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("eyebrow", v) : undefined}
              className="text-xs uppercase tracking-[0.3em] mb-3"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => updateField("headline", v) : undefined}
            className="text-4xl sm:text-5xl font-semibold tracking-tight" style={{ fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => updateField("subheadline", v) : undefined}
              className="mt-3 opacity-70 max-w-2xl mx-auto" style={{ fontFamily: BODY }} />
          )}
        </div>

        <div className="grid gap-10 md:gap-14">
          {props.pairs.map((pair, i) => (
            <div key={i} className="grid md:grid-cols-2 gap-4 md:gap-6">
              <figure className="relative">
                <span className="absolute top-3 left-3 z-10 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", fontFamily: BODY }}>
                  {beforeLabel}
                </span>
                <InlineImage
                  src={pair.beforeSrc}
                  alt={pair.beforeAlt}
                  onUpdate={onFieldChange ? (src: string) => updatePair(i, { beforeSrc: src }) : undefined}
                  className="w-full aspect-[4/3] object-cover rounded-xl"
                />
              </figure>
              <figure className="relative">
                <span className="absolute top-3 left-3 z-10 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded" style={{ backgroundColor: accent, color: "#fff", fontFamily: BODY }}>
                  {afterLabel}
                </span>
                <InlineImage
                  src={pair.afterSrc}
                  alt={pair.afterAlt}
                  onUpdate={onFieldChange ? (src: string) => updatePair(i, { afterSrc: src }) : undefined}
                  className="w-full aspect-[4/3] object-cover rounded-xl"
                />
              </figure>
              {pair.caption && (
                <p className="md:col-span-2 text-sm opacity-70 italic text-center" style={{ fontFamily: BODY }}>
                  {pair.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
