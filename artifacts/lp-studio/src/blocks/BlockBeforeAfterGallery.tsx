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
  const imageFit = props.imageFit ?? "cover";
  const layout = props.layout ?? "classic";
  const fitClass = imageFit === "contain" ? "object-contain" : "object-cover";

  const updateField = <K extends keyof BeforeAfterGalleryBlockProps>(
    key: K,
    value: BeforeAfterGalleryBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updatePair = (i: number, patch: Partial<BeforeAfterGalleryBlockProps["pairs"][number]>) => {
    if (!onFieldChange) return;
    const next = props.pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onFieldChange({ ...props, pairs: next });
  };

  /* Showcase layout: each image renders uncropped with its own headline +
   * subheadline to the side. Text sits on the OUTER edge of each column
   * (before: text left of image; after: text right of image), mirroring the
   * side-by-side comparison pattern. Stacks text-above-image on mobile. */
  const showcaseSide = (pair: BeforeAfterGalleryBlockProps["pairs"][number], i: number, side: "before" | "after") => {
    const isBefore = side === "before";
    const src = isBefore ? pair.beforeSrc : pair.afterSrc;
    const alt = isBefore ? pair.beforeAlt : pair.afterAlt;
    const headline = (isBefore ? pair.beforeHeadline : pair.afterHeadline) ?? (isBefore ? beforeLabel : afterLabel);
    const subheadline = (isBefore ? pair.beforeSubheadline : pair.afterSubheadline) ?? "";
    return (
      <div className={`flex flex-col items-start gap-5 md:items-center md:gap-8 ${isBefore ? "md:flex-row" : "md:flex-row-reverse"}`}>
        <div className={`w-full shrink-0 md:w-[220px] ${isBefore ? "" : "md:text-left"}`}>
          <InlineText
            as="h3"
            value={headline}
            onUpdate={onFieldChange ? (v: string) => updatePair(i, isBefore ? { beforeHeadline: v } : { afterHeadline: v }) : undefined}
            className="text-2xl leading-tight tracking-tight sm:text-[1.7rem]"
            style={{ fontFamily: DISPLAY }}
          />
          {(subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={subheadline}
              onUpdate={onFieldChange ? (v: string) => updatePair(i, isBefore ? { beforeSubheadline: v } : { afterSubheadline: v }) : undefined}
              className="mt-2 text-2xl leading-tight opacity-50 sm:text-[1.7rem]"
              style={{ fontFamily: DISPLAY }}
              multiline
            />
          )}
        </div>
        <div className="w-full min-w-0">
          <InlineImage
            src={src}
            alt={alt}
            onUpdate={onFieldChange ? (v: string) => updatePair(i, isBefore ? { beforeSrc: v } : { afterSrc: v }) : undefined}
            className="h-auto w-full object-contain"
            wrapperClassName="block w-full"
          />
        </div>
      </div>
    );
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

        {layout === "showcase" ? (
          <div className="grid gap-14 md:gap-20">
            {props.pairs.map((pair, i) => (
              <div key={i} className="grid gap-10">
                <div className="grid items-center gap-10 md:grid-cols-2 md:gap-8">
                  {showcaseSide(pair, i, "before")}
                  {showcaseSide(pair, i, "after")}
                </div>
                {(pair.caption || onFieldChange) && (
                  <InlineText
                    as="p"
                    value={pair.caption ?? ""}
                    onUpdate={onFieldChange ? (v: string) => updatePair(i, { caption: v }) : undefined}
                    className="text-sm opacity-70 italic text-center"
                    style={{ fontFamily: BODY }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
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
                    className={`w-full aspect-[4/3] ${fitClass} rounded-xl`}
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
                    className={`w-full aspect-[4/3] ${fitClass} rounded-xl`}
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
        )}
      </div>
    </section>
  );
}
