import type { BrandConfig } from "@/lib/brand-config";
import type {
  FeatureCardGridBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { BRAND_BODY_FONT } from "@/lib/brand-fonts";
import {
  alignItemsClass,
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionItemMedia,
  sectionItemVisualValue,
  SectionItemTitle,
  SectionItemBody,
  SectionCtas,
} from "./shared/section-kit";

interface Props {
  props: FeatureCardGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeatureCardGridBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Feature — card grid.
 *
 * A grid of compact features: a 4:3 image tile on top with the title + body
 * sitting directly on the section below it (no card chrome). When an item has no
 * photo (the AI generator is icon-led and never emits image URLs) the image tile
 * degrades to a premium accent-tinted panel with the item's icon centered —
 * never an empty image box. One-up on mobile, two-up on tablets; on desktop the
 * author-controlled "Columns" knob picks four-up (default) or three-up. Every
 * color, type style, alignment, radius, and CTA decision flows through the
 * shared `section-kit` toolkit so all siblings read and edit identically.
 */
export function BlockFeatureCardGrid({
  props,
  brand,
  onFieldChange,
  pageId,
  variantId,
  onCtaClick,
}: Props) {
  const isBuilder = !!onFieldChange;
  const theme = useSectionTheme(props, brand);
  const align = props.align ?? "center";
  const items = props.items ?? [];
  const radius = sectionRadiusClass(props.cardRadius);

  // Desktop column count is author-controlled (default four-up). Tablet stays
  // two-up and mobile one-up (set on the grid container below).
  const gridCols = props.columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";

  // Backstop tint behind the image tile — derived, no baked literal.
  const frameTint = `color-mix(in srgb, ${theme.ink} 8%, ${theme.surface.base})`;

  const update = (patch: Partial<FeatureCardGridBlockProps>) =>
    onFieldChange?.({ ...props, ...patch });
  const updateHeader = (key: "eyebrow" | "heading" | "subhead", value: string) =>
    update({ [key]: value });
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        background: theme.surface.background,
        color: theme.ink,
        fontFamily: BRAND_BODY_FONT,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow={props.eyebrow}
          heading={props.heading || props.headline}
          subhead={props.subhead || props.subheadline}
          align="center"
          theme={theme}
          brand={brand}
          isBuilder={isBuilder}
          onUpdate={updateHeader}
        />

        {items.length > 0 && (
          <div className={cn("mx-auto mt-12 grid grid-cols-1 gap-8 sm:mt-16 sm:grid-cols-2", gridCols)}>
            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "group flex flex-col transition-all duration-300 ease-out motion-safe:hover:-translate-y-2",
                  alignItemsClass(align),
                  alignTextClass(align),
                )}
              >
                <div
                  className={cn(
                    "mb-5 aspect-[4/3] w-full overflow-hidden transition-shadow duration-300 group-hover:shadow-xl",
                    radius,
                  )}
                  style={{ backgroundColor: frameTint }}
                >
                  <SectionItemMedia
                    value={sectionItemVisualValue(item)}
                    accent={theme.accent}
                    base={theme.surface.base}
                    alt={item.title}
                    imgClassName="transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <SectionItemTitle
                  value={item.title}
                  onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                  color={theme.ink}
                />
                <SectionItemBody
                  value={item.description}
                  onUpdate={
                    isBuilder ? (v) => updateItem(i, { description: v }) : undefined
                  }
                  color={theme.muted}
                  className="mt-2"
                />
              </div>
            ))}
          </div>
        )}

        <SectionCtas
          props={props}
          brand={brand}
          theme={theme}
          align="center"
          isBuilder={isBuilder}
          onUpdate={update}
          pageId={pageId}
          variantId={variantId}
          source="feature-card-grid"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
